import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
function requireFile(path) { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); }
function requireText(path, text) { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); }
function forbidText(path, text) { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); }
function requireOrderedText(path, earlier, later) {
  const content = read(path); const first = content.indexOf(earlier); const second = content.indexOf(later);
  if (first < 0 || second < 0 || first >= second) failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
}

[
  'README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/pages/OverviewPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/LeaderboardPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/styles/market-funds.css',
].forEach(requireFile);

for (const text of [
  "{ id: 'home', label: '概览'", "{ id: 'market', label: '市场'", "{ id: 'production', label: '生产'",
  "{ id: 'assets', label: '资金'", "{ id: 'leaderboard', label: '排行'", "{ id: 'settings', label: '设置'",
]) requireText('src/config/navigation.ts', text);

for (const text of [
  "case 'home'", "case 'market'", "case 'production'", "case 'assets'", "case 'leaderboard'", "case 'settings'",
]) requireText('src/pages/PageRouter.tsx', text);

for (const text of ['基础工作', '生产摘要', '财富构成', '当前浏览器最近成交', '下一周期加入', '共享仓库剩余']) requireText('src/pages/OverviewPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', '完整订单簿', '待领取产成品']) forbidText('src/pages/OverviewPage.tsx', text);

for (const text of [
  'title="市场"', '限价订单', 'order-quick-fill', '1/4 仓', '1/2 仓', '全仓',
  'single-order-book', 'order-book-divider', '最低价前 5 笔', '最高价前 5 笔',
  '我的订单与成交', '本地成交记录', 'local-trades-table', 'localTrades.map', '工厂数量市场',
]) requireText('src/pages/MarketPage.tsx', text);
requireOrderedText('src/pages/MarketPage.tsx', '限价', '数量');
requireOrderedText('src/pages/MarketPage.tsx', '数量', 'order-quick-fill');
for (const text of [
  'WarehouseUpgradeCard', 'buildFacility(', 'setProductionPlan(', 'book-columns', 'aggregateOrderBook',
  'order-book-midpoint', '买入快捷数量按资金与仓库剩余空间共同计算',
]) forbidText('src/pages/MarketPage.tsx', text);

for (const text of ['.single-order-book', 'align-self: stretch', '.order-book-divider', '.local-trades-table', 'max-height: none']) requireText('src/styles/market-funds.css', text);
for (const text of ['.order-book-midpoint', 'align-self: start']) forbidText('src/styles/market-funds.css', text);

for (const text of ['买单预占', 'warehouseReservedQuantity']) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);
forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', '未完成买单剩余数量');

for (const text of [
  'title="工厂"', '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />',
  '建设新工厂', 'game.facilityGroups.map', '当前参与', '下一周期', '待加入', '已挂牌',
  '周期产量', '周期成本', '原料库存', '统一生产计划', '启动全部未挂牌工厂', '停止全部',
  '挂牌工厂不参与生产', '挂牌数量', '单座价格',
]) requireText('src/pages/ProductionPage.tsx', text);
requireOrderedText('src/pages/ProductionPage.tsx', '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />', '建设新工厂');
for (const text of ['facility.id', 'facility.name', '展开管理', '实例列表', '小时产量', '小时运营费', '累计产量', '系统参考估值', 'collectFacility']) forbidText('src/pages/ProductionPage.tsx', text);

for (const text of ['title="资金与资产"', '工厂资产', '类型数量与系统估值', '资产配置', '商品库存与估值', '本地资金与资产变动', 'game.facilityGroups']) requireText('src/pages/AssetsPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'upgradeWarehouse()', 'placeCommodityOrder(', 'buildFacility(']) forbidText('src/pages/AssetsPage.tsx', text);

for (const text of ['title="总资产排行榜"', '我的排名', '本周资产变化']) requireText('src/pages/LeaderboardPage.tsx', text);
for (const text of ['title="设置"', '玩家资料', '游戏设置', '登录会话', '退出登录', '重置服务器经济状态']) requireText('src/pages/SettingsPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', '<DataList', '<DataRow', '工厂总数', '仓库使用', '当前排名', 'derived.']) forbidText('src/pages/SettingsPage.tsx', text);

for (const text of [
  '# Economy 页面内容与导航职责设计', '概览｜市场｜生产｜资金｜排行｜设置',
  '限价输入位于数量输入之前', '`1/4 仓`、`1/2 仓`、`全仓`', '单列订单簿',
  '最优 5 笔卖单、中性分隔线、最优 5 笔买单', '订单簿内部不得显示最近成交或价差指标卡',
  '订单簿卡片必须拉伸到所在网格行高度', '本地成交记录面板不得设置固定高度',
  '每种 `facilityTypeId` 最多一张卡', '工厂实例名称、ID、列表或展开实例',
  '资金页不负责仓库管理', '设置页只允许',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '订单簿固定为单列：卖盘最优 5 笔、中性分隔线、买盘最优 5 笔',
  '本地成交记录不设置内部固定高度',
]) requireText('README.md', text);

if (failures.length) {
  console.error('页面内容与模块归属验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('页面职责验证通过：订单簿分隔、等高布局、本地成交自然增长和模块唯一归属满足设计。');
