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
  '冻结资产和抵押工厂仍归当前玩家所有并计入资产毛值；贷款负债从资产毛值中扣除形成净资产。',
]) requireText(componentPath, text);

for (const text of [
  "import { AssetOverviewPanel } from '../components/assets/AssetOverviewPanel'",
  '<AssetOverviewPanel model={model} />',
  'className="bank-account-balance-strip"',
  'title="存款账户"',
  'title="存款利息"',
  'title="工厂抵押贷款"',
  'title="银行记录"',
]) requireText(bankPath, text);
for (const text of ['bank-metric-grid', 'title="本地资产变动"', 'localAssetEvents']) forbidText(bankPath, text);

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
  '页面顺序固定为“资产总览／存款账户与存款利息／工厂抵押贷款／银行记录”',
  '不得恢复独立资产页',
]) requireText(designPath, text);

for (const text of [
  '本地文档版本：v6',
  'economy.local-activity.v6.<userId>',
  '`snapshot.orders[]` 只保存当前玩家自己的公开订单与匿名 fills',
  '永久丢弃全部 `assetEvents[]`',
]) requireText(localDesignPath, text);
for (const text of ['assetEvents', 'AssetEvent']) forbidText(localStorePath, text);
forbidText(typesPath, 'export interface AssetEvent');
requireText(localStorePath, 'export function clearLocalTrades');
requireText(localStorePath, 'const STORAGE_VERSION = 6');

requireText(runtimeHarnessPath, '<BankPage model={model} />');
for (const text of [
  "getByRole('heading', { name: '资产总览', exact: true })",
  "getByText('当前净资产', { exact: true })).toHaveCount(1)",
  "getByText('冻结资产', { exact: true })).toHaveCount(1)",
  'compositionColumns).toBe(2)',
  'scrollWidth <= element.clientWidth + 1',
]) requireText(runtimeSpecPath, text);

if (failures.length) {
  console.error(`银行资产总览与本地资产变动删除验证失败：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('银行资产总览、九页导航、本地成交 v6、移动资产构成与独立资产页删除验证通过。');
