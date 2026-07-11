import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
}

function requireOrderedText(path, earlier, later) {
  const content = read(path);
  const first = content.indexOf(earlier);
  const second = content.indexOf(later);
  if (first < 0 || second < 0 || first >= second) {
    failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
  }
}

const pagePaths = [
  'src/pages/OverviewPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/LeaderboardPage.tsx',
  'src/pages/SettingsPage.tsx',
];

[
  'README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  ...pagePaths,
].forEach(requireFile);

for (const text of [
  "{ id: 'home', label: '概览'",
  "{ id: 'market', label: '市场'",
  "{ id: 'production', label: '生产'",
  "{ id: 'assets', label: '资金'",
  "{ id: 'leaderboard', label: '排行'",
  "{ id: 'settings', label: '设置'",
]) requireText('src/config/navigation.ts', text);

for (const text of [
  "case 'market'", "case 'production'", "case 'assets'", "case 'leaderboard'", "case 'settings'", "case 'home'",
  '<OverviewPage model={model} />', '<MarketPage model={model} />', '<ProductionPage model={model} />',
  '<AssetsPage model={model} />', '<LeaderboardPage model={model} />', '<SettingsPage model={model} />',
]) requireText('src/pages/PageRouter.tsx', text);

for (const text of [
  '基础工作', 'market-summary', '生产摘要', '财富构成', '当前浏览器最近成交',
  '共享仓库剩余', "setTab('market')", "setTab('production')", "setTab('assets')",
]) requireText('src/pages/OverviewPage.tsx', text);
for (const text of ['待领取产成品', 'pendingGoods', 'WarehouseUpgradeCard']) forbidText('src/pages/OverviewPage.tsx', text);

for (const text of [
  'title="市场"', '限价订单', '订单簿', '近期成交曲线', '我的订单与成交',
  '未完成订单', '本地成交记录', '工厂挂牌', 'cancelOrder(order.id)',
  'buyFacility(listing.id)', '产成品', '直接进入共享仓库',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'internalCapacity', '内部容量', 'buildFacility(', 'setProductionPlan(']) {
  forbidText('src/pages/MarketPage.tsx', text);
}

for (const text of [
  'title="工厂"',
  '管理共享仓库、建设工厂、设置生产计划',
  "import { WarehouseUpgradeCard } from '../components/warehouse/WarehouseUpgradeCard';",
  '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />',
  '建设新工厂', '生产计划', '启动生产', '停止生产', '产成品自动入仓',
  '直接进入共享仓库', '仓库{outputName}', '挂牌出售', '撤销工厂挂牌',
]) requireText('src/pages/ProductionPage.tsx', text);
requireOrderedText(
  'src/pages/ProductionPage.tsx',
  '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />',
  '建设新工厂',
);
for (const text of ['collectFacility', '领取{outputName}', '内部容量', 'internalCapacity', 'internalGoods']) {
  forbidText('src/pages/ProductionPage.tsx', text);
}

for (const text of [
  'title="资金与资产"', '可用资金', '冻结资金', '当前总资产', '商品资产', '工厂资产',
  '资产配置', '商品库存与估值', '货币发行与回收', '本地资金与资产变动',
  'clearLocalActivity', 'event.warehouseChange', '产出入仓', '已直接进入共享仓库',
]) requireText('src/pages/AssetsPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'upgradeWarehouse()', 'placeCommodityOrder(', 'buildFacility(', 'internalGoodsDelta)']) {
  forbidText('src/pages/AssetsPage.tsx', text);
}

for (const text of [
  'title="总资产排行榜"', '我的排名', '与上一名差距', '本周资产变化',
  'leaderboard-table', 'current-player-row',
]) requireText('src/pages/LeaderboardPage.tsx', text);

for (const text of [
  'title="设置"', '玩家资料', '游戏设置', '登录会话', '退出登录',
  '重置服务器经济状态', '不会删除服务器经济状态或当前浏览器的本地活动记录',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const [path, forbidden] of [
  ['src/pages/AssetsPage.tsx', ['WarehouseUpgradeCard', 'upgradeWarehouse()', 'placeCommodityOrder(', 'buildFacility(']],
  ['src/pages/LeaderboardPage.tsx', ['WarehouseUpgradeCard', 'upgradeWarehouse()', 'placeCommodityOrder(', 'buildFacility(']],
  ['src/pages/SettingsPage.tsx', [
    'WarehouseUpgradeCard', 'warehouseLevel', 'warehouseUpgradeCost', 'warehouseNextCapacity',
    'warehouseUsedCapacity', 'inventoryCapacity', 'upgradeWarehouse()', 'placeCommodityOrder(',
    'setProductionPlan(', '<DataList', '<DataRow', '账号与产业摘要', '仓库使用',
    '工厂总数', '运行中工厂', '施工中工厂', '阻塞工厂', '商品种类',
    '未完成订单', '当前排名', 'derived.', 'game.facilities', 'game.products',
  ]],
]) {
  for (const text of forbidden) forbidText(path, text);
}

for (const text of [
  '# Economy 页面内容与导航职责设计',
  '概览｜市场｜生产｜资金｜排行｜设置',
  '本文中的“工厂页面”指用户从“生产”导航进入的 `ProductionPage`',
  '共享仓库必须位于建设与工厂列表之前',
  '`WarehouseUpgradeCard` 只能由 `ProductionPage` 渲染',
  '产成品自动入仓说明',
  '不得显示工厂内部商品、内部容量或领取按钮',
  '资金页不负责仓库管理',
  '设置页不得显示账号与产业只读摘要或仓库使用摘要',
  '模块唯一归属',
  '未更新本设计、相关专项设计和防回退检查的页面结构修改不应合并',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '页面内容与模块归属以 `docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为准',
  '共享仓库完整管理卡固定在“生产”页面',
  '共享仓库完整管理入口只存在于此页面',
  '资金页不提供仓库扩容',
  '产成品直接进入共享仓库',
  '不存在“领取产成品”操作',
  '设置页不显示账号与产业摘要、仓库使用摘要、仓库等级、扩容费用或扩容按钮',
]) requireText('README.md', text);

for (const text of [
  '共享仓库完整管理卡必须位于 `ProductionPage`',
  '`AssetsPage`、`SettingsPage`、`OverviewPage`、`MarketPage` 和 `LeaderboardPage` 不得渲染 `WarehouseUpgradeCard`',
  '工厂没有 `internalGoods` 或 `internalCapacity`',
  '不存在从工厂领取产成品的操作',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '所有工厂不设置内部产成品仓库或内部容量',
  '产成品直接进入玩家共享仓库',
  '不提供产成品领取操作',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

if (failures.length) {
  console.error('页面内容与模块归属验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('页面内容与模块归属验证通过：工厂产成品直接入仓，领取与内部容量已从正式页面移除。');
