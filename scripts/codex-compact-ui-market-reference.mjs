import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'docs/UI_DESIGN_SYSTEM.md';
let source = readFileSync(path, 'utf8');
const verbose = '不得根据生产配方语义自动推断采购／出售方向；进入商品详情后的即时交易数量初始化为 `1`，成交价格只读取服务器当日 `officialPrice`，生产页不得预填自定义价格或自动提交交易，也不得改写建筑页建设工厂类型、数量、配方、作业制度或任何服务器权威生产状态。具体交易语义仍以页面与商品市场权威 DESIGN 为准。';
const compact = '生产结算物资槽跳转后的交易方向、数量与成交价统一引用 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 与 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md`；本文只约束槽位视觉与交互，不复制业务草稿或成交规则。';
if (!source.includes(verbose)) throw new Error('找不到待压缩的 UI 市场业务副本');
source = source.replace(verbose, compact);
writeFileSync(path, source.endsWith('\n') ? source : `${source}\n`);
for (const temp of ['scripts/codex-compact-ui-market-reference.mjs', '.github/workflows/codex-compact-ui-market-reference.yml']) {
  if (existsSync(temp)) unlinkSync(temp);
}
