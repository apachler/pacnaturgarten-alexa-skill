// Checks the interaction model for mistakes the Alexa console only reports at build time:
// duplicate samples across intents, slots used but not declared (or declared but unused),
// characters Alexa refuses in samples, and unknown slot types.
import { readFileSync } from 'node:fs';

const file = new URL('../skill-package/interactionModels/custom/de-DE.json', import.meta.url);
const { languageModel } = JSON.parse(readFileSync(file, 'utf8')).interactionModel;
const problems = [];
const seen = new Map();
const types = new Set(languageModel.types.map((t) => t.name));

if (languageModel.invocationName !== languageModel.invocationName.toLowerCase()) problems.push('invocation name must be lower case');

for (const intent of languageModel.intents) {
  const declared = new Set((intent.slots ?? []).map((s) => s.name));
  const used = new Set();
  for (const s of intent.slots ?? []) {
    if (!s.type.startsWith('AMAZON.') && !types.has(s.type)) problems.push(`${intent.name}: unknown slot type ${s.type}`);
  }
  for (const sample of intent.samples) {
    const key = sample.toLowerCase().trim();
    if (seen.has(key)) problems.push(`"${sample}" in ${intent.name} and ${seen.get(key)}`);
    seen.set(key, intent.name);
    if (/[?!,;:"()]/.test(sample.replace(/\{[^}]+\}/g, ''))) problems.push(`${intent.name}: invalid character in "${sample}"`);
    for (const [, name] of sample.matchAll(/\{([^}]+)\}/g)) {
      used.add(name);
      if (!declared.has(name)) problems.push(`${intent.name}: slot {${name}} not declared`);
    }
  }
  for (const name of declared) if (!used.has(name)) problems.push(`${intent.name}: slot ${name} never used in a sample`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`interaction model ok: ${languageModel.intents.length} intents, ${seen.size} samples`);
