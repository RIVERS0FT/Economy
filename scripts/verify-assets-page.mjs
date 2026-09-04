import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const componentPath = 'src/components/assets/AssetOverviewPanel.tsx';
const bankPath = 'src/pages/BankPage.tsx';
const stylesPath = 'src/styles/asset-overview.css';
const navigationPath = 'src/config/navigation.ts';
const localStorePath = 'src/utils/localActivityStore.ts';
const typesPath = 'src/types.ts';
const designPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const localDesignPath = 'docs/LOCAL_ACTIVITY_LOG_DESIGN.md';
const runtimeHarnessPath = 'tests/browser/bank-runtime-harness.tsx';
const runtimeSpecPath = 'tests/browser/bank-runtime.spec.ts';
const failures = [];

function requireFile(path) {
  if (!existsSync(path)) failures.push(`缺少文件：${path}`);
}
function requireText(path, text, message) {
  if (!read(path).includes(text)) failures.push(message ?? `${path} 缺少：${text}`);
}
function forbidText(path, text, message) {
  if (read(path).includes(text)) failures.push(message ?? `${path} 不得包含：${text}`);
}

for (const path of [
  componentPath,
  bankPath,
  stylesPath,
  navigationPath,
  localStorePath,
  typesPath,
  designPath,
  localDesignPath,
  runtimeHarnessPath,
  runtimeSpecPath,
  'bank-runtime-test.html',
]) requireFile(path);

for (const removedPath of [
  'src/pages/AssetsPage.tsx',
  'tests/browser/assets-runtime-harness.tsx',
  'tests/browser/assets-runtime.spec.ts',
  'assets-runtime-test.html',
]) {
  if (existsSync(removedPath)) failures.push(`独立资产页文件不得恢复：${removedPath}`);
}

for (const text of [
  'export function AssetOverviewPanel',
  'title="资产总览"',
  'asset-total-summary',
  'asset-total-splits',
  'asset-allocation-summary',
  'asset-composition-table',
  'aria-label="资产构成明细"',
  'asset-composition-row cash',
  'asset-composition-row commodity',
  'asset-composition-row facility',
  'asset-composition-row commercial',
  'commercialValue',
  'commercialBuildingCount',
  '冻结资产和抵押工厂仍归当前玩家所有并计入资产毛值；商业建筑第一版没有冻结、抵押或产权交易状态；贷款负债从资产毛值中扣除形成净资产。',
]) requireText(componentPath, text);

for (const text of [
  "import { AssetOverviewPanel } from '../components/assets/AssetOverviewPanel'",
  '<AssetOverviewPanel model={model} />',
  'className="bank-account-balance-strip"',
  'title="资金管理"',
  '本周资金计划',
  'title="工厂抵押融资"',
  'bank-collateral-list',
  '授信利用率',
  'title="银行记录"',
]) requireText(bankPath, text);
for (const text of [
  'bank-metric-grid',
  'title="本地资产变动"',
  'localAssetEvents',
  'title="存款账户"',
  'title="存款利息与周结算"',
  '<table className="bank-collateral-table">',
]) forbidText(bankPath, text);

for (const text of [
  '.asset-overview-body',
  'grid-template-columns: minmax(240px, 0.8fr) minmax(190px, 0.6fr) minmax(440px, 1.6fr)',
  '.asset-composition-header',
  '.asset-composition-row',
  '@media (max-width: 720px)',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);',
]) requireText(stylesPath, text);

forbidText(navigationPath, "{ id: 'assets', label: '资产' }");
requireText(navigationPath, "{ id: 'bank', label: '银行' }");
for (const text of [
  '独立资产页面已经永久删除，资产总览唯一归属银行页',
  '页面顺序固定为“资产总览／资金管理／工厂抵押融资／银行记录”',
  '不得恢复独立资产页',
  '商业建筑按服务器目录 `systemValue` 估值',
  '第一版全部计入可用建筑资产，不进入冻结、抵押或产权交易',
]) requireText(designPath, text);

for (const text of [
  '本地文档版本：v7',
  'economy.local-activity.v7.<userId>',
  '`snapshot.orders[]` 只保存当前玩家自己的公开订单、州级地区 ID 与匿名 fills',
  '永久丢弃全部 `assetEvents[]`',
]) requireText(localDesignPath, text);
for (const text of ['assetEvents', 'AssetEvent']) forbidText(localStorePath, text);
forbidText(typesPath, 'export interface AssetEvent');
requireText(localStorePath, 'export function clearLocalTrades');
requireText(localStorePath, 'const STORAGE_VERSION = 7');

requireText(runtimeHarnessPath, '<BankPage model={model} />');
for (const text of [
  "getByRole('heading', { name: '资产总览', exact: true })",
  "getByText('当前净资产', { exact: true })).toHaveCount(1)",
  "getByText('冻结资产', { exact: true })).toHaveCount(1)",
  'compositionColumns).toBe(2)',
  'cashWorkspaceColumns).toBe(1)',
  'scrollWidth <= element.clientWidth + 1',
]) requireText(runtimeSpecPath, text);

requireText(componentPath, '商品按当日官方价、工厂按最近产权成交价、商业建筑按目录系统价值估值');
forbidText(componentPath, '商品和工厂按最近一次订单簿真实成交价估值');
requireText(designPath, '商品按各州当日官方系统价估值；工厂按最近一次真实产权成交价估值');
requireText(designPath, '商业建筑按服务器目录 `systemValue` 估值');

if (failures.length) {
  console.error(`银行资产总览与本地资产变动删除验证失败：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('银行资产总览、商业建筑资产估值、资金管理与抵押融资布局、十二个正式页面与十一项可见导航、本地成交 v7、移动资产构成与独立资产页删除验证通过。');
