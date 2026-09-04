import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/codex-fix-daily-market-consistency.mjs';
let source = readFileSync(path, 'utf8');
const oldText = `replaceOnce(\n  'tests/browser/runtime-harness.tsx',\n  '        lastPrice: 76,\\n        lastTradePrice: 76.25,',\n  '        lastPrice: 76,\\n        officialPrice: 76.25,\\n        lastTradePrice: 76.25,',\n  'machinery official-price fixture',\n);`;
const newText = `replaceOnce(\n  'tests/browser/runtime-harness.tsx',\n  \`      markets.machinery = {\\n        ...markets.machinery,\\n        lastTradePrice: 76.25,\\n      };\`,\n  \`      markets.machinery = {\\n        ...markets.machinery,\\n        officialPrice: 76.25,\\n        lastTradePrice: 76.25,\\n      };\`,\n  'machinery official-price fixture',\n);`;
if (!source.includes(oldText)) throw new Error('stale machinery consistency replacement not found');
source = source.replace(oldText, newText);
writeFileSync(path, source);
if (existsSync('scripts/codex-fix-consistency-fixture.mjs')) unlinkSync('scripts/codex-fix-consistency-fixture.mjs');
