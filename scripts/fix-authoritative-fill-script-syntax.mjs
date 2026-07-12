import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const path = 'scripts/apply-authoritative-fill-fix.mjs';
const source = readFileSync(path, 'utf8');
const lines = source.split('\n');
let replaced = false;
const output = lines.map((line) => {
  if (!line.includes("for (const text of ['maker price'")) return line;
  replaced = true;
  return "for (const text of ['maker price','反推玩家成交价','逐笔']) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);`, 'fill verification');";
}).join('\n');
if (!replaced) throw new Error('Unable to find invalid verification line');
writeFileSync(path, output);
rmSync('scripts/fix-authoritative-fill-script-syntax.mjs', { force: true });
