// Deploys a build to the development stage of the Alexa-hosted skill, in one go:
//
//   npm run deploy:hosted -- <path to the hosted skill checkout> [--yes] [--allow-dirty]
//
// 1. checks both repositories (this one clean, the hosted one on master and in sync with origin),
// 2. stages the build (scripts/stage-hosted.mjs), shows what changed and asks before going on,
// 3. commits and pushes master: Amazon builds the Lambda from that push,
// 4. imports skill-package (manifest, interaction model, icons) through SMAPI: the hosted repo
//    ignores skill.json, and the push alone does not update the manifest or the model,
// 5. waits for the import and the Lambda deployment and prints the result.
//
// `ask deploy` does not do this for hosted skills (ASK CLI 2.30 only says „use git push“).
// Needs the ASK CLI, signed in (`ask configure`), and `zip`. The skill id comes from the hosted
// checkout's .ask/ask-states.json. Live (the prod branch) is never touched: Amazon fills it on
// certification.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const target = args.find((a) => !a.startsWith('--')) ?? process.env.ASK_HOSTED_DIR;
if (!target) fail('Usage: npm run deploy:hosted -- <path to the hosted skill checkout> [--yes] [--allow-dirty]');

const root = resolve(new URL('..', import.meta.url).pathname);
const dest = resolve(target);
const statesFile = join(dest, '.ask', 'ask-states.json');
if (!existsSync(statesFile)) fail(`${dest} has no .ask/ask-states.json: is it a checkout made with \`ask init --hosted-skill-id …\`?`);
const skillId = JSON.parse(readFileSync(statesFile, 'utf8')).profiles?.default?.skillId;
if (!skillId) fail(`no skill id in ${statesFile}`);

// ---------- 1. preflight ----------

const sh = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: 'utf8', ...opts }).trim();
const git = (...argv) => sh('git', ['-C', dest, ...argv]);

if (sh('git', ['-C', root, 'status', '--porcelain']) && !flags.has('--allow-dirty')) {
  fail('This repository has uncommitted changes; the deploy would not match any commit. Commit them, or pass --allow-dirty.');
}
const source = sh('git', ['-C', root, 'log', '-1', '--format=%h %s']);

if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'master') fail(`${dest} is not on master (the branch that deploys the development stage).`);
if (git('status', '--porcelain')) fail(`${dest} has uncommitted changes. Look at them first: git -C ${dest} status`);
git('fetch', '--quiet', 'origin');
const [behind, ahead] = git('rev-list', '--left-right', '--count', 'origin/master...HEAD').split(/\s+/).map(Number);
if (ahead) fail(`${dest}: master is ${ahead} commit(s) ahead of origin/master. Push or sort that out by hand first.`);
if (behind) {
  git('merge', '--ff-only', '--quiet', 'origin/master');
  console.log(`hosted master fast-forwarded by ${behind} commit(s) from origin`);
}

// ---------- 2. stage ----------

execFileSync('npm', ['run', '--silent', 'stage:hosted', '--', dest], { cwd: root, stdio: 'inherit' });
const changes = git('status', '--short');
console.log(changes ? `\nChanges in the hosted repository:\n${changes}\n` : '\nNo code changes for the hosted repository (manifest and model are imported anyway).\n');

const message = `Deploy ${source}`;
const plan = [
  changes && `commit „${message}“ on master and push it (Amazon builds the development Lambda)`,
  `import skill-package into ${skillId} (development stage: manifest, interaction model, icons)`,
].filter(Boolean);
console.log(`Next:\n${plan.map((p) => `  - ${p}`).join('\n')}`);
if (!flags.has('--yes') && !(await confirm('Go ahead? [y/N] '))) {
  console.log(`Stopped. The staged files are still in ${dest}; \`git -C ${dest} checkout -- . && git -C ${dest} clean -fd\` drops them.`);
  process.exit(0);
}

// ---------- 3. commit and push ----------

let commit = git('rev-parse', 'HEAD');
if (changes) {
  git('add', '-A');
  git('commit', '--quiet', '-m', message);
  commit = git('rev-parse', 'HEAD');
  console.log(`pushing ${commit.slice(0, 7)} …`);
  execFileSync('git', ['-C', dest, 'push', '--quiet', 'origin', 'master'], { stdio: ['ignore', 'ignore', 'inherit'] });
}

// ---------- 4. import skill-package ----------

const ask = (...argv) => JSON.parse(sh('ask', ['smapi', ...argv], { stdio: ['ignore', 'pipe', 'pipe'] }) || '{}');
const work = mkdtempSync(join(tmpdir(), 'jahresrad-'));
try {
  const zipFile = join(work, 'skill-package.zip');
  sh('zip', ['-q', '-r', zipFile, '.'], { cwd: join(dest, 'skill-package') });
  const { uploadUrl } = ask('create-upload-url');
  const put = await fetch(uploadUrl, { method: 'PUT', body: readFileSync(zipFile) });
  if (!put.ok) fail(`upload of skill-package failed: HTTP ${put.status}`);
  const res = ask('import-skill-package', '-s', skillId, '--location', uploadUrl, '--full-response');
  const location = (res.headers ?? []).find((h) => h.key?.toLowerCase() === 'location')?.value ?? '';
  const importId = location.split('/').pop();
  if (!importId) fail(`import started without an import id: ${JSON.stringify(res)}`);
  const imported = await poll('skill-package import', () => ask('get-import-status', '--import-id', importId), (s) => s.status);
  if (imported.status !== 'SUCCEEDED') fail(`import ${imported.status}:\n${JSON.stringify(imported, null, 2)}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

// ---------- 5. wait for the Lambda ----------

// Amazon sometimes reports FAILED for a moment and then SUCCEEDED for the same commit after a retry,
// so a FAILED is only final once it has stayed so for a while.
let failedSince = 0;
const deployed = await poll(
  `Lambda deployment of ${commit.slice(0, 7)}`,
  () => ask('get-skill-status', '-s', skillId).hostedSkillDeployment?.lastUpdateRequest ?? {},
  (s) => {
    if (s.deploymentDetails?.commitId !== commit) return 'IN_PROGRESS';
    if (s.status !== 'FAILED') return s.status;
    failedSince ||= Date.now();
    return Date.now() - failedSince > 90_000 ? 'FAILED' : 'IN_PROGRESS';
  },
);
if (deployed.status !== 'SUCCEEDED') {
  fail(`Lambda deployment ${deployed.status}. Details: developer console → Code → Deploy, or CloudWatch Logs.`);
}

console.log(`\nDeployed ${source} to the development stage of ${skillId}.`);
console.log('Test: developer console → Test, or „Alexa, öffne Jahresrad“ on a device signed in with the developer account.');

// ---------- helpers ----------

async function poll(what, read, state, timeoutMs = 10 * 60_000) {
  const start = Date.now();
  process.stdout.write(`waiting for ${what} `);
  for (;;) {
    const value = read();
    const s = state(value);
    if (s && s !== 'IN_PROGRESS') {
      console.log(` ${s}`);
      return { ...value, status: s };
    }
    if (Date.now() - start > timeoutMs) {
      console.log(' timed out');
      return { ...value, status: 'TIMED_OUT' };
    }
    process.stdout.write('.');
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return /^(y|yes|j|ja)$/i.test(answer.trim());
}

function fail(text) {
  console.error(text);
  process.exit(1);
}
