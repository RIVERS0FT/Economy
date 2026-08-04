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
  'src/utils/facilityStaffing.ts',
  'src/main.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/production/ProductionFacilityDetail.tsx',
  'src/components/ui/layout.tsx',
  'src/components/icons/GameIcons.tsx',
  'src/components/facilities/FacilityProgress.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/styles/design-system.css',
  'src/styles/industry-system.css',
  'src/styles/facility-production-formula.css',
  'src/styles/facility-group-card-grid.css',
  'src/styles/facility-detail-sheet.css',
  'src/styles/production-surface.css',
  'src/styles/unified-market-admin.css',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'tests/browser/bank-runtime-harness.tsx',
  'tests/browser/market-runtime-harness.tsx',
].forEach(requireFile);

for (const text of [
  "export type FacilityStatus = 'running' | 'stopped' | 'error'",
  'enabled: boolean',
  'statusReason?: FacilityStatusReason',
  'activeRecipeId: string',
  'lifetimeOutput: number',
  'staffingRateBps?: number',
  'staffingUpdatedAt?: number',
  'staffingBatchCarryBps?: number',
  'productionAvailableCount?: number',
  'projectedEffectiveCount?: number',
]) requireText('src/types.ts', text);

for (const text of [
  "group.status = 'running'",
  "group.status = 'stopped'",
  "group.status = 'error'",
  'reconcileFacilityGroup',
  'expandAvailableFacilities',
  'applyConfigurationStaffingPenalty',
  'FACILITY_CONFIGURATION_STAFFING_PENALTY_BPS',
  'setGroupRecipe',
  'activeRecipeFor',
  "reason: 'warehouse_full'",
  "reason: 'insufficient_funds'",
  "reason: 'insufficient_input'",
  'world.version = 20',
  'FACILITY_STAFFING_RECOVERY_MS',
  'FACILITY_STAFFING_DECAY_MS',
  'projectStaffingRate',
  'settlementStaffingRateBps',
  'cycleDueAt',
]) requireText('server/src/facility-groups.js', text);


for (const forbidden of [
  'cycleStaffingRateBps?: number',
  'cycleEffectiveCount?: number',
  'nextCycleStaffingRateBps?: number',
]) forbidText('src/types.ts', forbidden);
for (const forbidden of [
  'group.cycleStaffingRateBps',
  'cycleEffectiveCount:',
]) forbidText('server/src/facility-groups.js', forbidden);
for (const forbidden of [
  'facility-staffing-meta',
  'facility-production-method-summary',
  'facility-formula-scope',
  '配置切换结果会提示',
]) forbidText('src/pages/production/ProductionFacilityDetail.tsx', forbidden);

for (const text of [
  'SwitchControl',
  'checked={group.enabled}',
  'facilityStatusLabel',
  '异常：资金不足',
  '异常：仓库已满',
  '异常：原料不足',
  'facility-status-header',
  'facility-card-title-row',
  'facility-card-title-block',
  'facility-count-summary',
  'facility-staffing-summary',
  'FacilityProductionFormula',
  'products={game.products}',
  'inventories={game.inventories}',
  '生产产物',
  '生产进度已清零',
  'now={now}',
  'setFacilityRecipe',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const text of [
  'facility-production-settings',
  'facility-production-settings-grid',
  '<strong>生产设置</strong>',
  '生产产物',
]) requireText('src/pages/production/ProductionFacilityDetail.tsx', text);
for (const forbidden of [
  'facility-recipe-section',
  'facility-production-method-section',
  '<strong>{selectedMethod.name}</strong>',
]) forbidText('src/pages/production/ProductionFacilityDetail.tsx', forbidden);

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
  'facility-card-status-row',
  'facility-detail-sheet-close',
  'facility-card-spacer',
]) forbidText('src/pages/ProductionPage.tsx', forbidden);

for (const text of [
  'MultiRecipeFacilityType',
  'inputs?: FacilityRecipeItem[]',
  'outputs?: FacilityRecipeItem[]',
  'facility-formula-top',
  'facility-formula-input-side',
  'facility-formula-input-group',
  'facility-formula-input-item',
  'facility-formula-meta',
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
  'facility-formula-center',
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
  '.production-build-card',
  'grid-template-columns: 1fr;',
  'gap: var(--space-3);',
]) requireText('src/styles/industry-system.css', text);
for (const forbidden of ['.production-grid {']) forbidText('src/styles/industry-system.css', forbidden);

for (const text of [
  '.facility-information-heading',
  '.facility-count-summary',
  'align-self: start;',
  'grid-auto-rows: auto;',
  'grid-template-rows: auto;',
]) requireText('src/styles/facility-group-card-grid.css', text);
for (const forbidden of [
  '--facility-card-height',
  'grid-auto-rows: 1fr;',
  'align-self: stretch;',
  '.facility-card-spacer',
  'top: var(--desktop-page-top-offset);',
  '@container (max-width: 519px)',
  'grid-area: input;',
  'grid-area: output;',
  '.facility-formula-center',
]) forbidText('src/styles/facility-group-card-grid.css', forbidden);

for (const text of [
  'Desktop production sticky alignment',
  '.production-workspace > .production-build-card,',
  '.production-workspace > .facility-cluster-detail-shell {',
  'position: sticky;',
  'top: 0;',
  'max-height: calc(100dvh - var(--desktop-page-top-offset) - var(--desktop-layout-gutter));',
  'overflow-y: auto;',
]) requireText('src/styles/production-surface.css', text);

const facilityGroupBlocks = read('src/styles/facility-group-card-grid.css')
  .split('.facility-group-card {')
  .slice(1)
  .map((part) => part.slice(0, part.indexOf('}')));
if (facilityGroupBlocks.some((block) => block.includes('grid-template-rows: auto auto auto minmax(0, 1fr) auto;'))) {
  failures.push('工厂详情卡不得恢复弹性空白轨道');
}

for (const text of [
  '.facility-detail-sheet-header',
  '.facility-detail-sheet.is-closing',
  '--facility-sheet-max-height',
  'animation: facility-sheet-open',
  '@keyframes facility-sheet-open',
]) requireText('src/styles/facility-detail-sheet.css', text);
for (const forbidden of ['.facility-detail-sheet-close', '88dvh']) forbidText('src/styles/facility-detail-sheet.css', forbidden);
for (const text of [
  'useLayoutEffect',
  "window.visualViewport?.height ?? window.innerHeight",
  "sheet?.focus({ preventScroll: true });",
  "returnFocusRef.current?.focus({ preventScroll: true })",
]) requireText('src/pages/production/MobileFacilityDetailSheet.tsx', text);
for (const forbidden of [
  "document.body.style.overflow = 'hidden';",
  'const focusFrame = window.requestAnimationFrame',
]) forbidText('src/pages/production/MobileFacilityDetailSheet.tsx', forbidden);
requireText('src/styles/facility-group-card-grid.css', '--ui-interactive-active-transform: none;');
forbidText('src/styles/facility-group-card-grid.css', '88dvh');

for (const text of [
  '.facility-production-formula',
  '.facility-formula-top',
  '.facility-formula-input-side',
  '.facility-formula-input-item',
  '.facility-formula-output-item',
  '.facility-formula-meta',
  '.facility-formula-progress',
  '.facility-formula-meta-icon',
  'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)',
  '.facility-production-formula-heading',
  'display: inline-flex;',
  '.facility-formula-meta-unit.is-cost {',
  'border-left: 1px solid var(--color-divider);',
]) requireText('src/styles/facility-production-formula.css', text);

for (const forbidden of [
  '.facility-formula-summary',
  '.facility-formula-center',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)',
]) forbidText('src/styles/facility-production-formula.css', forbidden);
forbidText(
  'src/styles/facility-production-formula.css',
  'grid-template-rows: auto minmax(112px, auto) minmax(0, 1fr) auto',
);
forbidText('src/styles/facility-production-formula.css', '.facility-group-card {');

const mainSource = read('src/styles/app.css');
requireText('src/styles/app.css', "url('./facility-production-formula.css')");
if (
  mainSource.indexOf("url('./facility-production-formula.css')")
  <= mainSource.indexOf("url('./facility-group-card-grid.css')")
) failures.push('生产结算样式必须晚于工厂详情基础样式加载');

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
  'running farm crop changes apply immediately with a staffing penalty and progress reset',
  'legacy pending factory and recipe state migrates once into immediate participation',
  'purchased factories join a running group immediately and dilute live staffing',
  'warehouse errors recover without backfilling missed cycles',
  'manual stop disables automatic recovery',
  'stopped factory staffing decays linearly from its stored timestamp',
  'running factory settles each completed cycle at its completion staffing rate and carries fractional capacity',
  'cycle completion rate can increase integer output beyond the cycle-start projection',
  'completion-time capacity still settles atomically when the final requirement is unavailable',
  'error staffing decays and auto recovery starts from the reduced live rate',
  'legacy completed target plans migrate to a manual stop',
  'legacy running target plans become continuous production',
]) requireText('server/test/facility-groups.test.js', text);

for (const text of [
  '三种顶层状态',
  '自动恢复',
  'activeRecipeId',
  '生产配置切换立即写入 `activeRecipeId`',
  '持续生产与通用配方切换',
  '生产进度立即清零',
  '固定价格工厂挂牌市场',
  '集群生产公式',
  '集群生产公式支持无输入、单输入、多输入和单输出',
  '进度条',
  '时间与成本固定放在投入与产出下方的同一条操作数据带',
  '进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字',
  '工厂信息是唯一身份与经营摘要区',
  '不包含顶部关闭按钮',
  '点击遮罩和按下 `Escape` 必须与有效下拉关闭共用同一收起流程',
  '桌面详情卡高度由自然内容流决定',
  '移动 Bottom Sheet 打开期间只允许单向上移',
  '移动触控下工厂选择卡不得使用缩放按压反馈',
  '玩家可见“生产产物”与“作业制度”必须合并为同一个“生产设置”区',
  '生产进度位于数据带下方，并且是生产结算最后一个可见元素',
  '工厂满员率与等效产能',
  '周期完成时刻的满员率',
  'staffingBatchCarryBps',
  '不得新增每秒或更高频率扫描全世界工厂的调度器',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

for (const text of [
  'SwitchControl',
  '.ui-switch',
  '唯一',
  '生产产物',
  'facility-production-formula.css',
  'CycleIcon',
  'CreditsIcon',
  'WarehouseIcon',
  '工厂生产公式固定采用双列顶层布局',
  '左侧为输入组合区，右侧为输出区',
  '输入与输出物资槽顶部对齐',
  '时间与成本不得回到输入输出之间的独立中列',
  '生产进度条',
  '进度条下方不得显示当前周期、恢复运行、产出、成本或其他说明文字',
  '完整文本无障碍描述',
  '玩家可见的“生产产物”与“作业制度”使用同一个“生产设置”区',
  '首次可见绘制前通过 `useLayoutEffect` 完成页面滚动锁定',
  '`focus({ preventScroll: true })`',
  '生产进度位于数据带下方，并且是生产结算最后一个可见元素',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

for (const path of [
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
]) {
  for (const forbidden of [
    'cycleStaffingRateBps',
    'cycleEffectiveCount',
    'nextCycleCount',
    'nextCycleStaffingRateBps',
    'nextCycleEffectiveCount',
    'pendingJoinCount',
    '每个新完整周期锁定',
    '四项数量摘要',
  ]) forbidText(path, forbidden);
}
for (const path of [
  'tests/browser/bank-runtime-harness.tsx',
  'tests/browser/market-runtime-harness.tsx',
]) {
  for (const forbidden of ['pendingJoinCount', 'nextCycleCount', 'nextCycleStaffingRateBps', 'nextCycleEffectiveCount']) {
    forbidText(path, forbidden);
  }
  for (const required of ['productionAvailableCount', 'projectedEffectiveCount', 'staffingRateBps', 'staffingUpdatedAt', 'staffingBatchCarryBps']) {
    requireText(path, required);
  }
}
for (const text of [
  '不存在周期开始时锁定的满员率或整数等效产能字段',
  '离线补算多个周期时必须逐周期使用各自的 `cycleDueAt`',
  '满员率状态带只显示当前百分比、恢复／下降方向和进度条',
  '生产结算标题只显示“生产结算”',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

if (failures.length) {
  console.error(`工厂三态、生产公式、自动恢复与统一开关验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('工厂即时加入、配置立即切换、满员率稀释与惩罚、紧凑标题状态、三态自动恢复和生产结算验证通过。');
