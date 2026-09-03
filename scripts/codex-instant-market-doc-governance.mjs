import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
const read = (p) => readFileSync(p, 'utf8');
const write = (p, s) => writeFileSync(p, s.endsWith('\n') ? s : `${s}\n`);
const replace = (p, from, to) => { if (!existsSync(p)) return; const s=read(p); if (s.includes(from)) write(p,s.replaceAll(from,to)); };

replace(
  'docs/README.md',
  '`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 市场订单、冻结、撮合、成交与市场资产交易语义 | 市场页面布局、行情图几何、服务器容量与存储实现',
  '`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` | 商品即时交易、每日官方系统价、服务器内部消费／储备订单边界与历史玩家挂单迁移 | 市场页面布局、人口需求预算细节、服务器容量与部署实现',
);
replace(
  'docs/README.md',
  '| 市场订单、冻结、撮合、成交 | `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |',
  '| 商品即时交易、每日官方系统价、内部人口／储备订单边界、历史挂单迁移 | `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` |',
);

replace(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '地区市场允许只读查看行情与订单簿',
  '地区市场允许只读查看今日官方价格与真实成交行情',
);
replace(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '玩家买卖单价格恰好等于官方系统价时，在真实订单簿撮合完成后由系统按该价格实时全量清算；官方系统价每个 5 分钟周期按该周期系统买卖量调整一次，调价瞬间恰好等于新价格的玩家订单全部由系统清算。玩家间成交不计入系统买卖比；官方系统价同时是商品估值与市场价口径。规则细节以 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 为准。',
  '玩家商品买卖只提交方向与数量，由服务器按州×商品当日官方系统价即时全量结算，不创建开放挂单。官方系统价在北京时间一个自然日内固定，服务器每日 00:00 只根据前一自然日真实玩家↔系统即时买卖量失衡调整次日价格；内部人口／储备订单不形成玩家盘口。官方系统价继续作为商品估值与市场价口径，细节以 `UNIFIED_ASSET_ORDER_BOOK_DESIGN.md` 为准。',
);

replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '地区市场允许只读查看行情与订单簿',
  '地区市场允许只读查看今日官方价格与真实成交行情',
);
replace(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '订单簿只读',
  '今日价格与真实成交行情只读',
);

replace(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '每州×商品的官方系统价价格周期',
  '每州×商品的北京时间自然日官方系统价周期',
);
replace(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '玩家订单达到官方系统价',
  '玩家即时商品交易提交后',
);

const orderDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const required = [
  '官方系统价以 `Asia/Shanghai` 自然日为唯一周期',
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '玩家商品页面永久移除：价格输入框',
  '内部人口／储备订单继续复用共享撮合内核',
  '建厂一键购料不再读取真实卖盘深度',
  '工厂自动采购和自动出售继续由玩家策略决定是否执行，但不再维护 managed-order ID',
];
for (const text of required) if (!orderDesign.includes(text)) throw new Error(`即时市场权威设计缺少: ${text}`);

for (const path of ['scripts/codex-instant-market-doc-governance.mjs', '.github/workflows/codex-instant-market-doc-governance.yml']) { if (existsSync(path)) unlinkSync(path); }
