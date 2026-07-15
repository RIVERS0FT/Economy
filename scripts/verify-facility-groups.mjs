import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'server/src/facility-groups.js',
  'server/test/facility-groups.test.js',
  'server/test/listed-factory-production.test.js',
  'src/types.ts',
  'src/main.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/ui/layout.tsx',
  'src/components/icons/GameIcons.tsx',
  'src/components/facilities/FacilityProgress.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/styles/design-system.css',
  'src/styles/industry-system.css',
  'src/styles/facility-production-formula.css',
  'src/styles/unified-market-admin.css',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

for (const text of [
  "export type FacilityStatus = 'running' | 'stopped' | 'error'",
  'enabled: boolean',
  'statusReason?: FacilityStatusReason',
  'activeRecipeId: string',
  'pendingRecipeId?: string',
  'lifetimeOutput: number',
]) requireText('src/types.ts', text);

for (const text of [
  "group.status = 'running'",
  "group.status = 'stopped'",
  "group.status = 'error'",
  'reconcileFacilityGroup',
  'applyPendingRecipe',
  'setGroupRecipe',
  'activeRecipeFor',
  "reason: 'warehouse_full'",
  "reason: 'insufficient_funds'",
  "reason: 'insufficient_input'",
  'world.version = 8',
]) requireText('server/src/facility-groups.js', text);

for (const text of [
  'SwitchControl',
  'checked={group.enabled}',
  'facilityStatusLabel',
  '异常：资金不足',
  '异常：仓库已满',
  '异常：原料不足',
  'facility-status-header',
  'facility-count-summary',
  'FacilityProductionFormula',
  'products={game.products}',
  'inventories={game.inventories}',
  'facility-recipe-section',
  '生产配方',
  '下一周期切换为：',
  'setFacilityRecipe',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const forbidden of [
  'facilityStatusDetail',
  '正常生产中',
  '下一周期：',
  '当前计划：持续运行',
  '>保存计划</Button>',
  '目标产量',
  'setProductionPlan',
  '下一周期按 ',
  'facility-group-counts',
  'facility-group-specs',
  '<span>周期 <strong>',
  '<span>产量 <strong>',
  '<span>成本 <strong>',
  '<span>原料 <strong>',
]) forbidText('src/pages/ProductionPage.tsx', forbidden);

for (const text of [
  'MultiRecipeFacilityType',
  'inputs?: FacilityRecipeItem[]',
  'outputs?: FacilityRecipeItem[]',
  'facility-formula-top',
  'facility-formula-input-group',
  'facility-formula-input-item',
  'facility-formula-center',
  'facility-formula-output-group',
  'facility-formula-output-item',
  'facility-formula-progress',
  'facility-formula-meta-icon',
  'CycleIcon',
  'CreditsIcon',
  'WarehouseIcon',
  'role="group"',
  'aria-label={description}',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);

for (const forbidden of [
  'facility-formula-summary',
  'facility-formula-arrow',
  '→',
  '⏱',
  '💰',
]) forbidText('src/components/facilities/FacilityProductionFormula.tsx', forbidden);

for (const text of [
  "group.status === 'error'",
  '等待条件恢复',
  '本周期剩余',
  'facility-progress-running',
  'is-idle',
  "style={{ width: '0%' }}",
]) requireText('src/components/facilities/FacilityProgress.tsx', text);

for (const text of [
  'export function SwitchControl',
  "className={classNames('ui-switch'",
]) requireText('src/components/ui/layout.tsx', text);

for (const text of [
  'export function CycleIcon',
  'export function CreditsIcon',
  'export function WarehouseIcon',
  'aria-hidden="true"',
  'focusable="false"',
]) requireText('src/components/icons/GameIcons.tsx', text);

for (const text of [
  '.ui-switch',
  '.ui-switch:checked',
  '.ui-switch::before',
]) requireText('src/styles/design-system.css', text);

for (const text of [
  'min-height: 320px',
  '.facility-status-header > .ui-switch',
  '.facility-count-summary',
  '.production-plan-heading',
  '.production-plan-status',
]) requireText('src/styles/industry-system.css', text);

for (const text of [
  '.facility-production-formula',
  '.facility-formula-top',
  '.facility-formula-input-item',
  '.facility-formula-output-item',
  '.facility-formula-center',
  '.facility-formula-progress',
  '.facility-formula-meta-icon',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)',
  'grid-template-rows: auto minmax(112px, auto) minmax(0, 1fr) auto',
]) requireText('src/styles/facility-production-formula.css', text);
forbidText('src/styles/facility-production-formula.css', '.facility-formula-summary');

requireText('src/main.tsx', "import './styles/facility-production-formula.css';");

for (const forbidden of [
  'facility-power-button',
  'factory-switch',
  'music-switch',
  'production-toggle',
]) {
  forbidText('src/pages/ProductionPage.tsx', forbidden);
  forbidText('src/styles/unified-market-admin.css', forbidden);
}

for (const text of [
  'factory automatically recovers after funds return',
  'running farm crop changes apply at the next cycle boundary',
  'warehouse errors recover without backfilling missed cycles',
  'manual stop disables automatic recovery',
  'legacy completed target plans migrate to a manual stop',
  'legacy running target plans become continuous production',
]) requireText('server/test/facility-groups.test.js', text);

for (const text of [
  '三种顶层状态',
  '自动恢复',
  'activeRecipeId',
  'pendingRecipeId',
  '持续生产与通用配方切换',
  '下一周期切换为：配方名称',
  '固定价格工厂挂牌市场',
  '集群生产公式',
  '多输入和多输出',
  '进度条',
  '周期 SVG 图标',
  '进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

for (const text of [
  'SwitchControl',
  '.ui-switch',
  '唯一',
  '桌面端所有工厂集群卡片使用统一高度',
  '生产配方',
  'facility-production-formula.css',
  'CycleIcon',
  'CreditsIcon',
  'WarehouseIcon',
  '输入在左、周期成本在中、输出在右',
  '生产进度条',
  '进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字',
  '完整文本无障碍描述',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`工厂三态、生产公式、自动恢复与统一开关验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('工厂持续生产、通用配方周期边界切换、三态自动恢复、多输入输出公式和自适应卡片验证通过。');
