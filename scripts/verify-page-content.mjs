import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'src/pages/MarketPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/config/navigation.ts',
  'src/app/GameApp.tsx',
  'src/app/AdminApp.tsx',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'unified-asset-tabs',
  'placeAssetOrder',
  'single-order-book',
  'order-book-divider',
  'localTrades.map',
  '<FactoryIcon />',
]) requireText('src/pages/MarketPage.tsx', text);

for (const text of [
  'market-stat-strip',
  '工厂数量市场',
  '仅保存在当前浏览器；更换设备或清除网站数据后不会恢复。',
  '>⚙</span>',
]) forbidText('src/pages/MarketPage.tsx', text);

for (const text of [
  'SwitchControl',
  'checked={group.enabled}',
  '>运行 {model.derived.runningFacilities}',
  '>停止 {model.derived.stoppedFacilities}',
  '>异常 {model.derived.blockedFacilities}',
  'facility-status-header',
  '异常：资金不足',
  '异常：仓库已满',
  '异常：原料不足',
  '运行中',
  '下一周期加入',
  '冻结中',
  '当前计划：持续运行',
  '>保存计划</Button>',
  '在统一订单簿中买卖该工厂',
  '>前往市场 →',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'facility-power-button',
  '产成品去向',
  '启动全部未挂牌工厂',
  '停止全部',
  'facility-stop-reason',
  'facility-auto-recovery-note',
  '手动停止',
  '正常生产中',
  '下一周期按 ',
  '持有 <strong>',
  '下一周期生效',
]) forbidText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'title="资产"',
  '查看现金、商品、工厂资产与当前浏览器中的资产变化记录。',
  'title="本地资产变动"',
  'className="widget span-3 asset-event-panel"',
  'ProductIconLabel',
]) requireText('src/pages/AssetsPage.tsx', text);

for (const text of [
  '商品库存与估值',
  'product-asset-grid',
  'product-asset-card',
  'setSelectedProductId',
]) forbidText('src/pages/AssetsPage.tsx', text);

requireText('src/config/navigation.ts', "{ id: 'assets', label: '资产' }");
forbidText('src/config/navigation.ts', "{ id: 'assets', label: '资金' }");

for (const text of [
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'ProductIconLabel',
  '<strong>库存 {total}</strong>',
  '等级 {game.warehouseLevel}',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);
for (const text of ['WarehouseContentFilter', '全部商品', '查看全部商品', 'warehouseMaxLevel', '已达最高等级']) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

for (const text of [
  '点击工作次数',
  '生产商品总数',
  '买入商品总数',
  '卖出商品总数',
  '礼品兑换',
  '退出登录',
  '重置经济状态',
]) requireText('src/pages/SettingsPage.tsx', text);

for (const text of ['登录会话', '重置服务器经济状态']) forbidText('src/pages/SettingsPage.tsx', text);
for (const text of ["label: '仓库剩余'", "id: 'warehouse'"]) requireText('src/app/GameApp.tsx', text);
for (const text of ["id: 'inventory'", "id: 'market'"]) forbidText('src/app/GameApp.tsx', text);

for (const text of [
  '概览｜市场｜生产｜资产｜排行｜设置',
  '| 资产 | `assets` | `AssetsPage` | 资产结果与本地变化 |',
  '资产页不得再显示逐商品“商品库存与估值”卡片',
  '仓库不再提供“有库存／全部商品”筛选',
  '建设新工厂卡独占左侧列并在桌面滚动时常驻',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

if (failures.length) {
  console.error(`页面内容与职责验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('页面内容、无限仓库、左侧常驻建设卡、固定高度工厂卡和简化计划职责验证通过。');
