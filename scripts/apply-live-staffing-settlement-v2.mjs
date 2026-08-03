import { existsSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function read(path) { return readFileSync(path, 'utf8'); }
function write(path, content) { writeFileSync(path, content); }
function exact(path, before, after) {
  const source = read(path);
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${path}: expected one exact match, got ${count}: ${before.slice(0, 100)}`);
  write(path, source.replace(before, after));
}
function regex(path, pattern, replacement, minimum = 1) {
  const source = read(path);
  let count = 0;
  const next = source.replace(pattern, (...args) => {
    count += 1;
    return typeof replacement === 'function' ? replacement(...args) : replacement;
  });
  if (count < minimum) throw new Error(`${path}: expected regex ${pattern} at least ${minimum}, got ${count}`);
  write(path, next);
}
function update(path, fn) {
  const source = read(path);
  const next = fn(source);
  if (next === source) throw new Error(`${path}: update produced no change`);
  write(path, next);
}
function walk(root) {
  const output = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    if (statSync(path).isDirectory()) output.push(...walk(path));
    else output.push(path.replaceAll('\\', '/'));
  }
  return output;
}

// Repair and replace the staffing-focused tail of the server test file.
update('server/test/facility-groups.test.js', (source) => {
  const bodyMarker = `\n  const world = createWorld(now);\n  const buyer = ensurePlayer(world, alice, now);\n  const seller = ensurePlayer(world, bob, now);\n  buyer.credits = 10_000;\n  buyer.facilityGroups = [group('farm', 10, {`;
  const start = source.lastIndexOf(bodyMarker);
  if (start < 0) throw new Error('facility-groups test tail marker missing');
  const replacement = `

test('purchased factories join a running group immediately and dilute live staffing', () => {
  const world = createWorld(now);
  const buyer = ensurePlayer(world, alice, now);
  const seller = ensurePlayer(world, bob, now);
  buyer.credits = 10_000;
  buyer.facilityGroups = [group('farm', 10, {
    enabled: true,
    status: 'running',
    participatingCount: 10,
    cycleStartedAt: now,
    staffingRateBps: 8_000,
    staffingUpdatedAt: now,
  })];
  seller.facilityGroups = [group('farm', 2)];
  migrateFacilityGroupWorld(world, now);
  assert.equal(applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 80,
  }, now + 1).ok, true);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 2, price: 80,
  }, now + 2).ok, true);
  const farm = buyer.facilityGroups[0];
  assert.equal(farm.count, 12);
  assert.equal(farm.participatingCount, 12);
  assert.equal(farm.staffingRateBps, 6_666);
  assert.equal(farm.cycleStartedAt, now);
  assert.equal(Object.hasOwn(farm, 'cycleStaffingRateBps'), false);
  const state = createFacilityGroupClientState(world, alice.id, now + 2).facilityGroups[0];
  assert.equal(state.productionAvailableCount, 12);
  assert.equal(state.projectedEffectiveCount, 7);
  assert.equal(state.staffingUpdatedAt, now + 2);
  assert.equal(state.staffingBatchCarryBps, 0);
});

test('stopped factory staffing decays linearly from its stored timestamp', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 2, {
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  const state = createFacilityGroupClientState(world, alice.id, now + 15 * 60_000);
  const farm = state.facilityGroups[0];
  assert.equal(farm.staffingRateBps, 5_000);
  assert.equal(farm.staffingUpdatedAt, now + 15 * 60_000);
  assert.equal(farm.productionAvailableCount, 2);
  assert.equal(farm.projectedEffectiveCount, 1);
  assert.equal(player.facilityGroups[0].staffingRateBps, 10_000, 'read-only projection must not create a high-frequency write loop');
});

test('running factory settles each completed cycle at its completion staffing rate and carries fractional capacity', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [group('farm', 1, {
    enabled: true,
    status: 'running',
    participatingCount: 1,
    cycleStartedAt: now,
    staffingRateBps: 2_500,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
  })];
  migrateFacilityGroupWorld(world, now);

  const midway = createFacilityGroupClientState(world, alice.id, now + 60_000).facilityGroups[0];
  assert.equal(midway.staffingRateBps, 3_500);
  assert.equal(midway.staffingUpdatedAt, now + 60_000);
  assert.equal(midway.projectedEffectiveCount, 0);
  assert.equal(Object.hasOwn(midway, 'cycleStaffingRateBps'), false);
  assert.equal(Object.hasOwn(midway, 'cycleEffectiveCount'), false);

  processFacilityGroupWorld(world, now + 80_000);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(player.credits, 99);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 3_330);
  assert.equal(player.facilityGroups[0].staffingRateBps, 3_832);
});

test('cycle completion rate can increase integer output beyond the cycle-start projection', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [group('farm', 4, {
    enabled: true,
    status: 'running',
    participatingCount: 4,
    cycleStartedAt: now,
    staffingRateBps: 2_400,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 20_000);

  assert.equal(player.inventories.wheat.available, 1, 'completion rate 27.33% yields one integer batch while the 24% start rate yields zero');
  assert.equal(player.credits, 99);
  assert.equal(player.facilityGroups[0].staffingRateBps, 2_733);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 932);
});

test('completion-time capacity still settles atomically when the final requirement is unavailable', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 4, {
    enabled: true,
    status: 'running',
    participatingCount: 4,
    cycleStartedAt: now,
    staffingRateBps: 2_400,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 20_000);

  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.facilityGroups[0].statusReason, 'insufficient_funds');
  assert.equal(player.inventories.wheat.available, 0);
  assert.equal(player.credits, 0);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 0);
});

test('error staffing decays and auto recovery starts from the reduced live rate', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 2, {
    enabled: true,
    status: 'error',
    statusReason: 'insufficient_funds',
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 15 * 60_000);
  const waiting = createFacilityGroupClientState(world, alice.id, now + 15 * 60_000).facilityGroups[0];
  assert.equal(waiting.status, 'error');
  assert.equal(waiting.staffingRateBps, 5_000);

  player.credits = 100;
  processFacilityGroupWorld(world, now + 15 * 60_000 + 1);
  const recovered = player.facilityGroups[0];
  assert.equal(recovered.status, 'running');
  assert.equal(recovered.staffingRateBps, 4_999);
  assert.equal(recovered.cycleStartedAt, now + 15 * 60_000 + 1);
  assert.equal(Object.hasOwn(recovered, 'cycleStaffingRateBps'), false);
});
`;
  return source.slice(0, start) + replacement;
});

// Remove obsolete lock fields from fixtures and legacy test setup; dedicated tests above cover the new behavior.
for (const path of [
  'server/test/listed-factory-production.test.js',
  'server/test/facility-staffing-zero-capacity.test.js',
  'server/test/production-methods.test.js',
  'server/test/asset-auctions.test.js',
  'tests/browser/runtime-harness.tsx',
]) {
  let source = read(path);
  source = source.replace(/^\s*cycleStaffingRateBps:\s*[^\n]+\n/gm, '');
  source = source.replace(/^\s*cycleEffectiveCount:\s*[^\n]+\n/gm, '');
  source = source.replace(/^\s*nextCycleCount:\s*[^\n]+\n/gm, '');
  source = source.replace(/^\s*nextCycleStaffingRateBps:\s*[^\n]+\n/gm, '');
  source = source.replace(/^\s*nextCycleEffectiveCount:\s*[^\n]+\n/gm, '');
  source = source.replace(/^\s*pendingJoinCount:\s*[^\n]+\n/gm, '');
  source = source.replace(/^\s*assert\.[^\n]*cycleStaffingRateBps[^\n]*\n/gm, '');
  source = source.replace(/^\s*assert\.[^\n]*cycleEffectiveCount[^\n]*\n/gm, '');
  source = source.replace(/version:\s*24\b/g, 'version: 25');
  write(path, source);
}

// Browser regression: the three duplicate descriptions are absent and the operations strip is below both material columns.
update('tests/browser/production-methods.spec.ts', (source) => {
  source = source.replace(/\n    const summary = detail\.locator\('\.facility-production-method-summary'\);[\s\S]*?await expect\(summary\)\.not\.toContainText\('缩短周期并提高成本'\);\n/, `
    await expect(detail.locator('.facility-production-method-summary')).toHaveCount(0);
    await expect(detail.locator('.facility-staffing-meta')).toHaveCount(0);
    await expect(detail.locator('.facility-formula-scope')).toHaveCount(0);
    await expect(detail).not.toContainText('配置切换结果会提示');
    await expect(detail).not.toContainText('1m · 产出 1 · 成本 12');
`);
  source = source.replace(
    `    const formulaMeta = inputSide.locator(':scope > .facility-formula-meta');`,
    `    const formulaMeta = settlement.locator(':scope > .facility-formula-visual > .facility-formula-meta');`,
  );
  source = source.replace(
    `    expect(metaBox.x).toBeGreaterThanOrEqual(inputSideBox.x - 1);
    expect(metaBox.x + metaBox.width).toBeLessThanOrEqual(inputSideBox.x + inputSideBox.width + 1);
    expect(metaBox.x + metaBox.width).toBeLessThan(outputBox.x);`,
    `    expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputSideBox.y + inputSideBox.height, outputBox.y + outputBox.height) - 1);
    expect(metaBox.x).toBeGreaterThanOrEqual(formulaTop.boundingBox ? 0 : 0);`,
  );
  source = source.replace(
    `    await expect(sheet.locator('.facility-production-method-summary small')).toHaveCount(0);`,
    `    await expect(sheet.locator('.facility-production-method-summary')).toHaveCount(0);
    await expect(sheet.locator('.facility-staffing-meta')).toHaveCount(0);
    await expect(sheet.locator('.facility-formula-scope')).toHaveCount(0);`,
  );
  source = source.replace(
    `    expect(metaBox.y).toBeGreaterThanOrEqual(inputBox.y + inputBox.height - 1);`,
    `    expect(metaBox.y).toBeGreaterThanOrEqual(Math.max(inputBox.y + inputBox.height, outputBox.y + outputBox.height) - 1);`,
  );
  return source;
});

// Remove the intentionally awkward no-op assertion introduced above while keeping the geometry check deterministic.
exact(
  'tests/browser/production-methods.spec.ts',
  `    expect(metaBox.x).toBeGreaterThanOrEqual(formulaTop.boundingBox ? 0 : 0);`,
  `    expect(metaBox.x).toBeGreaterThanOrEqual(inputSideBox.x - 1);`,
);

// Update static verification contracts.
update('scripts/verify-facility-groups.mjs', (source) => {
  source = source.replace("  'src/types.ts',\n", "  'src/types.ts',\n  'src/utils/facilityStaffing.ts',\n");
  source = source.replace("  'cycleStaffingRateBps?: number',\n  'cycleEffectiveCount?: number',\n", "  'staffingUpdatedAt?: number',\n  'staffingBatchCarryBps?: number',\n");
  source = source.replace("  'cycleEffectiveCount',\n", "  'settlementStaffingRateBps',\n  'cycleDueAt',\n");
  source = source.replace("  '生产进度已清零',\n", "  '生产进度已清零',\n  'now={now}',\n");
  source = source.replace("  'running factory staffing locks each cycle and carries fractional capacity',\n", "  'running factory settles each completed cycle at its completion staffing rate and carries fractional capacity',\n  'cycle completion rate can increase integer output beyond the cycle-start projection',\n  'completion-time capacity still settles atomically when the final requirement is unavailable',\n");
  source = source.replace("  '工厂满员率与等效产能',\n", "  '工厂满员率与等效产能',\n  '周期完成时刻的满员率',\n");
  source = source.replace("  '时间与成本固定放在输入组合区的物资行下方同一行显示',\n", "  '时间与成本固定放在投入与产出下方的同一条操作数据带',\n");
  source = source.replace("  '公式、进度和单厂平均利润共同组成一张“生产结算”卡',\n", "  '公式、操作数据带、进度和单厂平均利润共同组成一张“生产结算”卡',\n");
  source = source.replace("  '公式、进度和单厂平均利润共同组成一张“生产结算”卡',", "  '公式、操作数据带、进度和单厂平均利润共同组成一张“生产结算”卡',");
  const insertion = `
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
`;
  source = source.replace("for (const text of [\n  'SwitchControl',", insertion + "\nfor (const text of [\n  'SwitchControl',");
  return source;
});

update('scripts/verify-production-settlement-layout.mjs', (source) => {
  source = source.replace(
    `const metaStart = formula.indexOf('className="facility-formula-meta"', inputSideStart);
const outputStart = formula.indexOf('className="facility-formula-output"', inputSideStart);
assert.ok(inputSideStart >= 0 && inputStart > inputSideStart, '输入物资必须位于输入侧组合区内');
assert.ok(metaStart > inputStart && outputStart > metaStart, '两行周期成本仪表必须位于输入物资之后、输出之前');`,
    `const outputStart = formula.indexOf('className="facility-formula-output"', inputSideStart);
const metaStart = formula.indexOf('className="facility-formula-meta"', outputStart);
assert.ok(inputSideStart >= 0 && inputStart > inputSideStart, '输入物资必须位于输入侧组合区内');
assert.ok(outputStart > inputStart && metaStart > outputStart, '周期成本操作数据带必须位于投入与产出之后');`,
  );
  source = source.replace("  'className=\"facility-formula-output\"',\n", "  'className=\"facility-formula-output-side\"',\n  'className=\"facility-formula-output\"',\n  'className=\"facility-formula-side-label\"',\n");
  source = source.replace("  'grid-template-areas: none;',\n", '');
  source = source.replace("  'border-top: 1px solid var(--color-divider);',\n", '');
  source = source.replace("console.log('生产结算商品 PNG、输入输出仓库库存、两行周期成本、统一富内容下拉框、流向进度、响应式与利润结果栏验证通过。');", "console.log('生产结算商品 PNG、投入产出、单行周期成本操作带、实时满员率、响应式与利润结果栏验证通过。');");
  return source;
});

update('scripts/verify-unified-factory-recipes-grid.mjs', (source) => {
  source = source.replaceAll('cycleStaffingRateBps', 'staffingRateBps');
  source = source.replaceAll('cycleEffectiveCount', 'projectedEffectiveCount');
  source = source.replaceAll('本周期 P 座 · 满员率 R% · 等效 × E', '生产结算标题不显示周期、满员率和等效产能长句');
  source = source.replaceAll('时间与成本固定放在输入组合区的物资行下方同一行显示', '时间与成本固定放在投入与产出下方的同一条操作数据带');
  return source;
});

// Version 25 is the only accepted client shape after removing locked-cycle fields.
for (const path of walk('docs').filter((path) => path.endsWith('.md'))) {
  let source = read(path);
  source = source.replaceAll('> 客户端状态版本：24', '> 客户端状态版本：25');
  source = source.replaceAll('当前客户端只接受版本 24', '当前客户端只接受版本 25');
  source = source.replaceAll('客户端状态版本 24', '客户端状态版本 25');
  write(path, source);
}

update('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', (source) => {
  source = source.replace('> 更新时间：2026-08-03', '> 更新时间：2026-08-04');
  source = source.replaceAll('本周期锁定满员率', '周期完成时满员率');
  source = source.replaceAll('锁定满员率', '完成时满员率');
  source = source.replaceAll('cycleStaffingRateBps', 'staffingRateBps');
  source = source.replaceAll('cycleEffectiveCount', '周期完成时整数等效产能');
  source = source.replace(
    '已开始周期同时锁定开始时工资系数与满员率，政策修改、满员率继续变化和到期恢复均从下一完整周期生效。',
    '已开始周期只锁定开始时工资系数；满员率在周期内持续恢复或下降，并在每个周期完成时按该完成时刻的实际值结算。',
  );
  source = source.replace(
    '时间与成本固定放在输入组合区的物资行下方同一行显示，中间使用竖向分隔线；',
    '时间与成本固定放在投入与产出下方的同一条操作数据带，中间使用竖向分隔线；',
  );
  source = source.replace(
    '公式上方必须显示“本周期 P 座 · 满员率 R% · 等效 × E”，停止或异常时显示对应的“启动后／恢复后 P 座 · 满员率 R% · 等效 × E”范围标识。',
    '生产结算标题只显示“生产结算”，不得显示“本周期／启动后／恢复后 P 座 · 满员率 R% · 等效 × E”等长句；实时数量只用于公式数值和完整无障碍描述。',
  );
  source = source.replace(
    '作业制度下方只显示周期、单周期产出和周期成本，不显示制度说明，也不得重复当前制度名称。',
    '生产设置下方不得再显示“周期 · 产出 · 成本”摘要或制度说明；周期与最终成本唯一显示在生产结算操作数据带。',
  );
  source += `

### 周期完成时满员率结算

运行中满员率、参与数量和整数等效产能均即时变化。每个完整周期必须使用该周期准确完成时刻的投影满员率与当时参与数量计算整数等效产能；离线补算多个周期时逐周期使用各自完成时刻，不得使用周期开始值或登录时最终值批量结算。固定点余数跨周期保留。最终资金、全部输入和仓库条件必须按该整数等效产能原子检查，任一条件不足时不扣款、不扣料、不产出。生产工资系数继续在周期开始时锁定，本规则不改变工资政策时点。
`;
  return source;
});

update('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', (source) => {
  source = source.replace('> 更新时间：2026-08-03', '> 更新时间：2026-08-04');
  source = source.replaceAll('cycleStaffingRateBps', 'staffingRateBps');
  source = source.replaceAll('cycleEffectiveCount', '周期完成时整数等效产能');
  source = source.replaceAll('锁定满员率', '周期完成时满员率');
  source = source.replace(
    '公式上方必须显示“本周期 P 座 · 满员率 R% · 等效 × E”，停止或异常时显示对应的“启动后／恢复后 P 座 · 满员率 R% · 等效 × E”范围标识。',
    '生产结算标题只显示“生产结算”，不得显示周期范围、满员率和等效产能长句；满员率状态带只显示当前百分比、恢复／下降状态和进度条。',
  );
  return source;
});

update('docs/UI_DESIGN_SYSTEM.md', (source) => {
  source = source.replace('> 更新时间：2026-08-03', '> 更新时间：2026-08-04');
  source = source.replaceAll('锁定满员率', '周期完成时满员率');
  source = source.replaceAll('时间与成本固定放在输入组合区的物资行下方同一行显示', '时间与成本固定放在投入与产出下方的同一条操作数据带');
  source = source.replaceAll('公式、进度和单厂平均利润共同组成一张“生产结算”卡', '公式、操作数据带、进度和单厂平均利润共同组成一张“生产结算”卡');
  source += `

- 工厂详情参考经营模拟游戏的建筑信息层级组织为“身份与状态 → 场景插画与满员率 → 生产设置 → 投入产出与进度 → 经营结果”，但继续使用本项目组件与视觉令牌。移动端场景插画使用更紧凑的 16:5 比例；满员率状态带不得显示周期范围、锁定值或等效产能说明；生产设置不得重复周期、产出和成本摘要；生产结算标题不得显示右侧长描述。
`;
  return source;
});

// Update browser fixture and any literal EconomyState version left in TypeScript sources.
for (const path of walk('src').filter((path) => /\.(ts|tsx|js)$/.test(path))) {
  let source = read(path);
  source = source.replace(/version:\s*24\b/g, 'version: 25');
  write(path, source);
}

// Static guard for the new client-side projection utility.
const utility = read('src/utils/facilityStaffing.ts');
for (const fragment of [
  'projectFacilityStaffingRate',
  'facilityEffectiveCount',
  'FACILITY_STAFFING_RECOVERY_MS = 10 * 60 * 1000',
  'FACILITY_STAFFING_DECAY_MS = 30 * 60 * 1000',
]) if (!utility.includes(fragment)) throw new Error(`facilityStaffing utility missing ${fragment}`);

for (const path of [
  'src/pages/production/ProductionFacilityDetail.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
]) {
  const source = read(path);
  for (const forbidden of ['facility-staffing-meta', 'facility-production-method-summary', 'facility-formula-scope']) {
    if (source.includes(forbidden)) throw new Error(`${path} still contains ${forbidden}`);
  }
}

// Remove both one-shot helpers and the one-shot workflow from the committed result.
for (const path of [
  'scripts/apply-live-staffing-settlement.mjs',
  'scripts/apply-live-staffing-settlement-v2.mjs',
  '.github/workflows/apply-live-staffing-settlement.yml',
]) {
  if (existsSync(path)) unlinkSync(path);
}

console.log('Live staffing settlement migration applied.');
