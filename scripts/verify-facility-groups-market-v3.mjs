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
  'src/styles/unified-market-admin.css',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
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
  'world.version = 6',
]) requireText('server/src/facility-groups.js', text);

for (const text of [
  'SwitchControl',
  'checked={group.enabled}',
  '下一周期生效',
  'facilityStatusDetail',
  "case 'insufficient_funds'",
  "case 'warehouse_full'",
  'facility-status-header',
]) requireText('src/pages/ProductionPage.tsx', text);
for (const text of ['group.status === \'error\'', '等待异常条件解除', 'facility-progress-compact']) requireText('src/components/facilities/FacilityProgress.tsx', text);

for (const text of [
  'export function SwitchControl',
  'className={classNames(\'ui-switch\'',
]) requireText('src/components/ui/layout.tsx', text);

for (const text of [
  '.ui-switch',
  '.ui-switch:checked',
  '.ui-switch::before',
]) requireText('src/styles/design-system.css', text);

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
]) requireText('server/test/facility-groups.test.js', text);

for (const text of [
  '三种顶层状态',
  '自动恢复',
  'pendingProductionPlan',
  '下一周期',
]) requireText('docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', text);

for (const text of [
  'SwitchControl',
  '.ui-switch',
  '唯一',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`工厂三态、自动恢复与统一开关验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('工厂三态、集中状态展示、自动恢复、下一周期计划和统一开关验证通过。');
