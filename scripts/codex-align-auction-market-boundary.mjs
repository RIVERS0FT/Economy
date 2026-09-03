import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-asset-auctions.mjs';
let source = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const oldLine = "requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['拍卖使用自身规则快照', '拍卖独立收费不得被误删']);";
const newLine = "requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['工厂资产不得重新进入商品即时市场；工厂所有权转移继续只通过拍卖完成']);";
if (!source.includes(oldLine)) throw new Error('找不到旧拍卖/市场跨职责断言');
source = source.replace(oldLine, newLine);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of [
  'scripts/codex-align-auction-market-boundary.mjs',
  '.github/workflows/codex-align-auction-market-boundary.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
