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
  'src/pages/ProductionPage.tsx',
  'src/components/ui/layout.tsx',
  'src/components/facilities/FacilityProgress.tsx',
  'src/styles/design-system.css',
  'src/styles/industry-system.css',
  'src/styles/unified-market-admin.css',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

for (const text of [
  "export type FacilityStatus = 'running' | 'stopped' | 'error'",
  'enabled: boolean',
  'statusReason?: FacilityStatusReason',
  'pendingProductionPlan?: PendingProductionPlan',
]) requireText('src/types.ts', text);

for (const text of [
  "group.status = 'running'",
  "group.status = 'stopped'",
  "group.status = 'error'",
  'reconcileFacilityGroup',
  'pendingProductionPlan',
  "reason: 'warehouse_full'",
  "reason: 'insufficient_funds'",
  "reason: 'insufficient_input'",
  "setGroupStopped(group, 'plan_complete')",
  'world.version = 7',
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
  '>保存计划</Button>',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const forbidden of [
  'facilityStatusDetail',
  '正常生产中',
  '下一周期生效',
  '下一周期按 ',
  'facility-group-counts',
]) forbidText('src/pages/ProductionPage.tsx', forbidden);

for (const text of [
  "group.status === 'error'",
  '等待条件恢复',
  '本周期剩余',
  'facility-progress-compact',
]) requireText('src/components/facilities/FacilityProgress.tsx', text);

for (const text of [
  'export function SwitchControl',
  "className={classNames('ui-switch'",
]) requireText('src/components/ui/layout.tsx', text);

for (const text of [
  '.ui-switch',
  '.ui-switch:checked',
  '.ui-switch::before',
]) requireText('src/styles/design-system.css', text);

for (const text of [
  'height: 384px',
  '.facility-status-header > .ui-switch',
  '.facility-count-summary',
  '.production-plan-summary',
]) requireText('src/styles/industry-system.css', text);

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
  'running plan changes apply at the next cycle boundary',
  'warehouse errors recover without backfilling missed cycles',
  'manual stop disables automatic recovery',
  'target production completion disables the run switch',
  'target completion preserves pending plan but still stops',
]) requireText('server/test/facility-groups.test.js', text);

for (const text of [
  '三种顶层状态',
  '自动恢复',
  'pendingProductionPlan',
  '定量生产完成后关闭开关',
  '固定价格工厂挂牌市场',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

for (const text of [
  'SwitchControl',
  '.ui-switch',
  '唯一',
  '工厂卡桌面固定高度',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`工厂三态、自动恢复与统一开关验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('工厂三态、自动恢复、定量完成关停、固定高度卡片、简化计划和统一开关验证通过。');
