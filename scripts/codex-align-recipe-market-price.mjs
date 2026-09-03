import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-recipe-profit-analysis.mjs';
let source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const oldText = `  "const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;",`;
const newText = `  "marketPrice: typeof market?.officialPrice === 'number' ? market.officialPrice : undefined,",`;
if (!source.includes(oldText)) throw new Error('找不到旧地区市场 officialPrice 局部变量断言');
source = source.replace(oldText, newText);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of [
  'scripts/codex-align-recipe-market-price.mjs',
  '.github/workflows/codex-align-recipe-market-price.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
