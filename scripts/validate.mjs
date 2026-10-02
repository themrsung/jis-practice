#!/usr/bin/env node
// Validate corpus files: every jp line must be fully typeable on the JIS kana layout.
// Usage: node scripts/validate.mjs corpus/*.txt
import { readFileSync } from 'node:fs';
import { parseCorpus, parseLine, tokensToRomaji } from '../src/engine.js';

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: node scripts/validate.mjs <corpus.txt>...'); process.exit(2); }
let bad = 0;
for (const f of files) {
  if (f.endsWith('.md')) continue;
  const { meta, entries } = parseCorpus(readFileSync(f, 'utf8'));
  const problems = [];
  for (const k of ['id', 'title']) if (!meta[k]) problems.push(`missing header "# ${k}:"`);
  entries.forEach((e, i) => {
    const { tokens, errors } = parseLine(e.jp);
    const where = `entry ${i + 1}: ${e.jp.trim().slice(0, 40)}`;
    for (const err of errors) problems.push(`${where}\n    ${err}`);
    if (!e.en) problems.push(`${where}\n    missing en:`);
    if (!e.ko) problems.push(`${where}\n    missing ko:`);
    const len = tokens.reduce((n, t) => n + t.text.length, 0);
    if (len > 80) problems.push(`${where}\n    line too long (${len} chars)`);
    if (process.env.ROMAJI) console.log(tokensToRomaji(tokens));
  });
  console.log(`${f}: ${entries.length} entries, ${problems.length} problem(s)`);
  for (const p of problems) console.log('  - ' + p);
  bad += problems.length;
}
process.exit(bad ? 1 : 0);
