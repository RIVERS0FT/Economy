import { readFileSync } from 'node:fs';
const page = readFileSync('src/pages/MarketPage.tsx', 'utf8');
const design = readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const chartDesign = readFileSync('docs/MARKET_CHART_LAYOUT_DESIGN.md', 'utf8');
const browser = readFileSync('tests/browser/market-desktop-cleanup.spec.ts', 'utf8');
for (const text of ['market-immediate-trade-card', 'market-account-panel', '最近成交', '今日成交价']) if (!page.includes(text)) throw new Error('桌面即时市场缺少: ' + text);
for (const text of ['order-book single-order-book', '实时五档', 'market-order-price', '已有订单', 'market-account-view-switch']) if (page.includes(text)) throw new Error('桌面市场不得恢复挂单 UI: ' + text);
if (!design.includes('玩家商品页面永久移除：价格输入框')) throw new Error('设计必须锁定挂单 UI 退役');
for (const text of [
  '地区商品详情顶部只保留商品身份、今日官方价格、真实 24h 变化和当前可用库存',
  '页面顺序固定为“身份与精简市场事实 → 近 24h 行情图 → 当日价即时交易 → 最近成交”',
  '玩家只调整方向与数量，不显示价格输入、五档盘口、已有订单或撤单',
]) if (!chartDesign.includes(text)) throw new Error('行情布局设计缺少即时市场规则: ' + text);
if (!browser.includes('instant market')) throw new Error('浏览器回归必须覆盖即时市场');
console.log('市场桌面清理验证通过：即时交易与最近成交同时显示，挂单/盘口控件永久退役。');
