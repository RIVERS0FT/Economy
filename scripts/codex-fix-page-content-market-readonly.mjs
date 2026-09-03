import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'scripts/verify-page-content.mjs';
let source = readFileSync(path, 'utf8');
const oldBlock = `for (const text of [\n  'readOnly = false',\n  'readOnly?: boolean;',\n  '即时交易',\n  '今日成交价',\n  '下次调价',\n]) requireText('src/pages/MarketPage.tsx', text);\nfor (const text of [\n  '实时五档',\n  'orderBook.bids',\n  'orderBook.asks',\n  'market-order-price',\n]) forbidText('src/pages/MarketPage.tsx', text);`;
const newBlock = `for (const text of [\n  '即时交易',\n  '今日成交价',\n  '下次调价',\n  'local-trades-section',\n]) requireText('src/pages/MarketPage.tsx', text);\nfor (const text of [\n  'readOnly = false',\n  'readOnly?: boolean;',\n  '该地区尚未解锁，市场仅供查看。',\n  'market-trade-readonly',\n  '实时五档',\n  'orderBook.bids',\n  'orderBook.asks',\n  'market-order-price',\n]) forbidText('src/pages/MarketPage.tsx', text);`;
if (!source.includes(oldBlock)) throw new Error('找不到页面职责中的旧市场只读断言');
source = source.replace(oldBlock, newBlock);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-fix-page-content-market-readonly.mjs', '.github/workflows/codex-fix-page-content-market-readonly.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
