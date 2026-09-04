import { readFileSync } from 'node:fs';
const page = readFileSync('src/pages/MarketPage.tsx', 'utf8');
const design = readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const browser = readFileSync('tests/browser/market-desktop-cleanup.spec.ts', 'utf8');
for (const text of ['market-immediate-trade-card', 'market-account-panel', '最近成交', '今日成交价']) if (!page.includes(text)) throw new Error('桌面即时市场缺少: ' + text);
for (const text of ['order-book single-order-book', '实时五档', 'market-order-price', '已有订单', 'market-account-view-switch']) if (page.includes(text)) throw new Error('桌面市场不得恢复挂单 UI: ' + text);
if (!design.includes('玩家商品页面永久移除：价格输入框')) throw new Error('设计必须锁定挂单 UI 退役');
if (!browser.includes('instant market')) throw new Error('浏览器回归必须覆盖即时市场');
console.log('市场桌面清理验证通过：即时交易与最近成交同时显示，挂单/盘口控件永久退役。');
