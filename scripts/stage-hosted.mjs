// Copies a build into the local checkout of the Alexa-hosted skill (the repository `ask init
// --hosted-skill-id …` or the developer console created), ready for `ask deploy` there.
//
//   npm run stage:hosted -- <path to the hosted skill checkout>
//
// Copied: lambda/index.js, lambda/package.json, the interaction model, the icons and the manifest.
// The manifest is merged so the hosted skill keeps what Amazon manages (endpoint, regions).
// Nothing is committed or pushed; that stays a deliberate step.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const target = process.argv[2] ?? process.env.ASK_HOSTED_DIR;
if (!target) {
  console.error('Usage: npm run stage:hosted -- <path to the hosted skill checkout>');
  process.exit(1);
}
const root = resolve(new URL('..', import.meta.url).pathname);
const dest = resolve(target);
if (!existsSync(join(dest, 'skill-package', 'skill.json'))) {
  console.error(`${dest} does not look like a hosted skill checkout (skill-package/skill.json missing)`);
  process.exit(1);
}

mkdirSync(join(dest, 'lambda'), { recursive: true });
cpSync(join(root, 'lambda', 'index.js'), join(dest, 'lambda', 'index.js'));
cpSync(join(root, 'lambda', 'package.json'), join(dest, 'lambda', 'package.json'));
mkdirSync(join(dest, 'skill-package', 'interactionModels', 'custom'), { recursive: true });
cpSync(
  join(root, 'skill-package', 'interactionModels', 'custom', 'de-DE.json'),
  join(dest, 'skill-package', 'interactionModels', 'custom', 'de-DE.json'),
);

const ours = JSON.parse(readFileSync(join(root, 'skill-package', 'skill.json'), 'utf8')).manifest;
const theirsPath = join(dest, 'skill-package', 'skill.json');
const theirs = JSON.parse(readFileSync(theirsPath, 'utf8')).manifest ?? {};
const merged = structuredClone(ours);
// Keep what the hosted skill manages itself.
if (theirs.apis?.custom?.endpoint) merged.apis.custom.endpoint = theirs.apis.custom.endpoint;
if (theirs.apis?.custom?.regions) merged.apis.custom.regions = theirs.apis.custom.regions;
// Skill events (SKILL_DISABLED) go to the same Lambda as the requests unless the hosted skill says otherwise.
if (theirs.events?.endpoint) merged.events.endpoint = theirs.events.endpoint;
else if (theirs.apis?.custom?.endpoint?.uri) merged.events.endpoint = { uri: theirs.apis.custom.endpoint.uri };
if (theirs.events?.regions) merged.events.regions = theirs.events.regions;
// Icons: ours (skill-package/assets) when the manifest names them, otherwise the hosted skill's.
for (const [locale, info] of Object.entries(theirs.publishingInformation?.locales ?? {})) {
  const mine = merged.publishingInformation.locales[locale];
  if (!mine) continue;
  if (!mine.smallIconUri && info.smallIconUri) mine.smallIconUri = info.smallIconUri;
  if (!mine.largeIconUri && info.largeIconUri) mine.largeIconUri = info.largeIconUri;
}
if (existsSync(join(root, 'skill-package', 'assets'))) {
  cpSync(join(root, 'skill-package', 'assets'), join(dest, 'skill-package', 'assets'), { recursive: true });
}
writeFileSync(theirsPath, JSON.stringify({ manifest: merged }, null, 2) + '\n');

console.log(`Staged into ${dest}. Next, in that directory: git add -A && git commit -m "…" && ask deploy`);
