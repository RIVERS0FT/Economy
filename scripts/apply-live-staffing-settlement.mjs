import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const changed = new Set();

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
  changed.add(path);
}

function update(path, transform) {
  const before = read(path);
  const after = transform(before);
  if (after === before) throw new Error(`${path}: patch produced no change`);
  write(path, after);
}

function replaceExact(path, before, after) {
  update(path, (source) => {
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`${path}: missing exact fragment: ${before.slice(0, 120)}`);
    if (source.indexOf(before, first + before.length) >= 0) {
      throw new Error(`${path}: exact fragment is not unique: ${before.slice(0, 120)}`);
    }
    return source.slice(0, first) + after + source.slice(first + before.length);
  });
}

function replaceAll(path, before, after, minimum = 1) {
  update(path, (source) => {
    const count = source.split(before).length - 1;
    if (count < minimum) throw new Error(`${path}: expected at least ${minimum} occurrences of ${before}`);
    return source.split(before).join(after);
  });
}

function replaceRegex(path, pattern, replacement, minimum = 1) {
  update(path, (source) => {
    let count = 0;
    const after = source.replace(pattern, (...args) => {
      count += 1;
      return typeof replacement === 'function' ? replacement(...args) : replacement;
    });
    if (count < minimum) throw new Error(`${path}: regex matched ${count}, expected at least ${minimum}: ${pattern}`);
    return after;
  });
}

function replaceSection(path, startMarker, endMarker, replacement) {
  update(path, (source) => {
    const start = source.indexOf(startMarker);
    if (start < 0) throw new Error(`${path}: missing section start ${startMarker}`);
    const end = source.indexOf(endMarker, start + startMarker.length);
    if (end < 0) throw new Error(`${path}: missing section end ${endMarker}`);
    return source.slice(0, start) + replacement.trimEnd() + '\n\n' + source.slice(end);
  });
}

replaceExact(
  'server/shared/economy-state-version.js',
  'export const CURRENT_CLIENT_STATE_VERSION = 24;\nexport const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 24;',
  'export const CURRENT_CLIENT_STATE_VERSION = 25;\nexport const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 25;',
);

replaceSection(
  'server/src/facility-groups.js',
  'function expandAvailableFacilities(group, previousCount, nextCount, now) {',
  'function applyConfigurationStaffingPenalty(group, now) {',
  `function expandAvailableFacilities(group, previousCount, nextCount, now) {
  const previous = Math.max(0, Math.floor(Number(previousCount) || 0));
  const next = Math.max(0, Math.floor(Number(nextCount) || 0));
  if (next <= previous) return;
  const currentRate = commitStaffingRate(group, now);
  group.staffingRateBps = scaleStaffingRateForExpansion(currentRate, previous, next);
  group.staffingUpdatedAt = Math.max(0, Number(now) || 0);
  if (group.status === 'running') group.participatingCount = next;
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function cycleCapacity(',
  'function calculateProductionWage(cost, multiplierBps) {',
  `function cycleCapacity(
  group,
  count,
  rateBps = group?.staffingRateBps,
  carryBps = group?.staffingBatchCarryBps,
) {
  const physicalCount = Math.max(0, Math.floor(Number(count) || 0));
  const staffingRateBps = normalizeStaffingRate(rateBps)
    ?? normalizeStaffingRate(group?.staffingRateBps)
    ?? FACILITY_STAFFING_FULL_BPS;
  const numerator = physicalCount * staffingRateBps + normalizeStaffingCarry(carryBps);
  return {
    effectiveCount: Math.floor(numerator / FACILITY_STAFFING_FULL_BPS),
    carryBps: numerator % FACILITY_STAFFING_FULL_BPS,
  };
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function createGroup(typeId, overrides = {}, now = Date.now()) {',
  'function normalizeGroup(group, now = Date.now()) {',
  `function createGroup(typeId, overrides = {}, now = Date.now()) {
  const type = typeFor(typeId);
  const legacyStatus = String(overrides.status || 'stopped');
  const legacyPlanComplete = legacyStatus === 'plan_complete' || overrides.statusReason === 'plan_complete';
  const enabled = legacyPlanComplete
    ? false
    : typeof overrides.enabled === 'boolean'
    ? overrides.enabled
    : legacyStatus === 'running' || legacyStatus === 'error'
      || ['full', 'insufficient_funds', 'insufficient_input'].includes(legacyStatus);
  const status = legacyStatus === 'running'
    ? 'running'
    : enabled
      ? 'error'
      : 'stopped';
  const staffingRateBps = normalizeStaffingRate(overrides.staffingRateBps)
    ?? FACILITY_STAFFING_FULL_BPS;
  const staffingUpdatedAt = Number.isFinite(Number(overrides.staffingUpdatedAt))
    ? Math.min(Math.max(0, Number(overrides.staffingUpdatedAt)), Math.max(0, Number(now) || 0))
    : Math.max(0, Number(now) || 0);
  return {
    facilityTypeId: typeId,
    count: Math.max(0, Number(overrides.count || 0)),
    participatingCount: Math.max(0, Number(overrides.participatingCount || 0)),
    enabled,
    status,
    statusReason: normalizeStatusReason(overrides.statusReason || overrides.stopReason, enabled),
    cycleStartedAt: overrides.cycleStartedAt,
    cycleWageMultiplierBps: normalizeProductionWageMultiplier(overrides.cycleWageMultiplierBps) || undefined,
    staffingRateBps,
    staffingUpdatedAt,
    staffingBatchCarryBps: normalizeStaffingCarry(overrides.staffingBatchCarryBps),
    lifetimeOutput: Math.max(0, Number(overrides.lifetimeOutput ?? overrides.completedQuantity ?? 0)),
    activeRecipeId: recipeFor(type, overrides.activeRecipeId)?.id,
  };
}`,
);

replaceExact(
  'server/src/facility-groups.js',
  `    normalized.cycleStaffingRateBps = scaleStaffingRateForExpansion(
      normalizeStaffingRate(normalized.cycleStaffingRateBps) ?? currentRate,
      previousCount,
      nextCount,
    );
`,
  '',
);
replaceExact(
  'server/src/facility-groups.js',
  `      normalized.cycleStaffingRateBps = penalizedRate;
      delete normalized.cycleWageMultiplierBps;
`,
  `      delete normalized.cycleWageMultiplierBps;
`,
);
replaceExact(
  'server/src/facility-groups.js',
  `    delete normalized.cycleWageMultiplierBps;
    delete normalized.cycleStaffingRateBps;
`,
  `    delete normalized.cycleWageMultiplierBps;
`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function clearGroupRuntime(group) {',
  'function setGroupStopped(group, reason = \'manual\', now = Date.now()) {',
  `function clearGroupRuntime(group) {
  group.participatingCount = 0;
  delete group.cycleStartedAt;
  delete group.cycleWageMultiplierBps;
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function startGroupRuntime(world, group, count, now) {',
  'function recipeInputs(recipe) {',
  `function startGroupRuntime(world, group, count, now) {
  const staffingRateBps = commitStaffingRate(group, now);
  group.enabled = true;
  group.status = 'running';
  delete group.statusReason;
  group.participatingCount = count;
  group.cycleStartedAt = now;
  group.cycleWageMultiplierBps = currentProductionWageMultiplier(world, now);
  group.staffingRateBps = staffingRateBps;
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function reconcileFacilityGroup(world, player, group, now) {',
  'function executeCycle(world, player, group, type, count, now) {',
  `function reconcileFacilityGroup(world, player, group, now) {
  const type = typeFor(group.facilityTypeId);
  if (!type) return;

  if (!group.enabled) {
    setGroupStopped(group, 'manual', now);
    return;
  }

  const available = availableGroupCount(world, player, group);
  if (group.status === 'running') {
    group.cycleWageMultiplierBps = normalizeProductionWageMultiplier(group.cycleWageMultiplierBps)
      || currentProductionWageMultiplier(world, now);
    const previousCount = group.participatingCount;
    if (available > previousCount) expandAvailableFacilities(group, previousCount, available, now);
    else group.participatingCount = available;
    if (group.participatingCount < 1) {
      setGroupError(group, 'no_available_facility', now);
      return;
    }
    const recipe = activeRecipeFor(type, group);
    const cycleDueAt = Number(group.cycleStartedAt || now) + recipe.cycleMs;
    const evaluationAt = Math.min(Math.max(0, Number(now) || 0), cycleDueAt);
    const liveStaffingRateBps = projectStaffingRate(group, evaluationAt);
    const capacity = cycleCapacity(group, group.participatingCount, liveStaffingRateBps);
    const blocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      capacity.effectiveCount,
    );
    if (!blocked) return;
    setGroupError(group, blocked.reason, now);
    return;
  }

  const staffingRateBps = projectStaffingRate(group, now);
  const capacity = cycleCapacity(group, available, staffingRateBps);
  const blocked = blockReason(
    world,
    player,
    group,
    type,
    available,
    capacity.effectiveCount,
  );
  if (!blocked) {
    startGroupRuntime(world, group, available, now);
    return;
  }
  if (group.status !== 'error' || group.statusReason !== blocked.reason) {
    setGroupError(group, blocked.reason, now);
  }
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function executeCycle(world, player, group, type, count, now) {',
  'function finishConstruction(world, player, now) {',
  `function executeCycle(world, player, group, type, count, capacity, cycleDueAt, now) {
  const recipe = activeRecipeFor(type, group);
  const requirements = groupRequirements(recipe, capacity.effectiveCount);
  const wageMultiplierBps = normalizeProductionWageMultiplier(group.cycleWageMultiplierBps) || 10_000;
  const populationWage = calculateProductionWage(requirements.cost, wageMultiplierBps);
  player.credits -= requirements.cost;
  if (requirements.cost > 0 || populationWage > 0) {
    creditPopulationEmployment(world, populationWage, 'production', {
      complexity: type.complexity,
      payerAmount: requirements.cost,
    });
  }
  player.stats.productionPayroll = Number(player.stats.productionPayroll || 0) + requirements.cost;
  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + requirements.cost;
  player.stats.producedGoods = Number(player.stats.producedGoods || 0) + requirements.output;
  for (const item of requirements.inputs) inventoryFor(player, item.productId).available -= item.quantity;
  inventoryFor(player, recipe.output.productId).available += requirements.output;
  group.lifetimeOutput += requirements.output;
  group.staffingBatchCarryBps = capacity.carryBps;
  group.cycleStartedAt = cycleDueAt;
  commitStaffingRate(group, cycleDueAt);
  group.cycleWageMultiplierBps = currentProductionWageMultiplier(world, now);
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function processGroup(world, player, group, now) {',
  'function reconcileAllFacilityGroups(world, now) {',
  `function processGroup(world, player, group, now) {
  reconcileFacilityGroup(world, player, group, now);
  const type = typeFor(group.facilityTypeId);
  if (!type || group.status !== 'running' || !group.cycleStartedAt) return;

  let processed = 0;
  while (processed < MAX_CYCLES_PER_GROUP && group.status === 'running') {
    const recipe = activeRecipeFor(type, group);
    if (now - group.cycleStartedAt < recipe.cycleMs) break;
    const cycleDueAt = group.cycleStartedAt + recipe.cycleMs;
    const settlementStaffingRateBps = projectStaffingRate(group, cycleDueAt);
    const capacity = cycleCapacity(group, group.participatingCount, settlementStaffingRateBps);
    const blocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      capacity.effectiveCount,
    );
    if (blocked) {
      setGroupError(group, blocked.reason, cycleDueAt);
      break;
    }

    executeCycle(world, player, group, type, group.participatingCount, capacity, cycleDueAt, now);
    processed += 1;

    const nextStaffingRateBps = projectStaffingRate(group, group.cycleStartedAt);
    const nextCapacity = cycleCapacity(group, group.participatingCount, nextStaffingRateBps);
    const nextBlocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      nextCapacity.effectiveCount,
    );
    if (nextBlocked) {
      setGroupError(group, nextBlocked.reason, group.cycleStartedAt);
      break;
    }
  }
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function setGroupRecipe(world, userId, payload, now) {',
  'function reduceRunningGroupForSellOrder(group, type, quantity, now = Date.now()) {',
  `function setGroupRecipe(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id) : null;
  if (!group) return result(false, '工厂集群不存在');
  const recipes = recipesFor(type);
  const recipe = recipes.find((candidate) => candidate.id === payload.recipeId);
  if (!recipe) return result(false, '生产配方不存在');
  const currentRecipe = activeRecipeFor(type, group);
  if (currentRecipe?.id === recipe.id) {
    delete group.pendingRecipeId;
    return result(true, \`${type.name}已经使用${recipeConfigurationLabel(type, recipe)}\`);
  }

  const { before, after } = applyConfigurationStaffingPenalty(group, now);
  group.activeRecipeId = recipe.id;
  delete group.pendingRecipeId;

  if (group.status === 'running') {
    group.participatingCount = availableGroupCount(world, player, group);
    group.cycleStartedAt = now;
    group.cycleWageMultiplierBps = currentProductionWageMultiplier(world, now);
    const capacity = cycleCapacity(group, group.participatingCount, after);
    const blocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      capacity.effectiveCount,
    );
    if (blocked) setGroupError(group, blocked.reason, now);
  } else {
    reconcileFacilityGroup(world, player, group, now);
  }

  return result(
    true,
    \`已切换为${recipeConfigurationLabel(type, recipe)}，生产进度已清零，满员率由 ${Math.round(before / 100)}% 降至 ${Math.round(after / 100)}%\`,
  );
}`,
);

replaceSection(
  'server/src/facility-groups.js',
  'function clientGroup(world, player, group, now) {',
  'export function createFacilityGroupClientState(world, userId, now = Date.now()) {',
  `function clientGroup(world, player, group, now) {
  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId);
  const auctionedCount = auctionedQuantity(world, player.userId, group.facilityTypeId);
  const frozenCount = listedCount + auctionedCount;
  const mortgagedCount = mortgagedFacilityQuantity(player, group.facilityTypeId);
  const productionAvailableCount = Math.max(0, group.count - frozenCount);
  const availableCount = Math.max(0, productionAvailableCount - mortgagedCount);
  const staffingRateBps = projectStaffingRate(group, now);
  const projectedResult = cycleCapacity(
    group,
    productionAvailableCount,
    staffingRateBps,
  );
  const {
    cycleWageMultiplierBps: _cycleWageMultiplierBps,
    cycleStaffingRateBps: _legacyCycleStaffingRateBps,
    ...publicGroup
  } = clone(group);
  return {
    ...publicGroup,
    staffingRateBps,
    staffingUpdatedAt: Math.max(0, Number(now) || 0),
    staffingBatchCarryBps: normalizeStaffingCarry(group.staffingBatchCarryBps),
    productionAvailableCount,
    projectedEffectiveCount: projectedResult.effectiveCount,
    listedCount,
    auctionedCount,
    frozenCount,
    mortgagedCount,
    availableCount,
  };
}`,
);

const serverSource = read('server/src/facility-groups.js');
if (serverSource.includes('group.cycleStaffingRateBps') || serverSource.includes('normalized.cycleStaffingRateBps')) {
  throw new Error('server/src/facility-groups.js still uses cycleStaffingRateBps');
}

update('src/types.ts', (source) => {
  const block = `  /** Current projected cluster staffing rate in basis points, where 10000 = 100%. */
  staffingRateBps?: number;
  /** Staffing rate locked when the current full production cycle started. */
  cycleStaffingRateBps?: number;
  /** Integer equivalent factory batches settled by the current cycle. */
  cycleEffectiveCount?: number;
  /** @deprecated Version 24 compatibility alias; always 0 because factories no longer queue for the next cycle. */
  pendingJoinCount?: number;
  /** @deprecated Version 24 compatibility alias for productionAvailableCount. */
  nextCycleCount?: number;
  /** @deprecated Version 24 compatibility alias for staffingRateBps. */
  nextCycleStaffingRateBps?: number;
  /** @deprecated Version 24 compatibility alias for projectedEffectiveCount. */
  nextCycleEffectiveCount?: number;
`;
  const replacement = `  /** Current projected cluster staffing rate in basis points, where 10000 = 100%. */
  staffingRateBps?: number;
  /** Server timestamp at which staffingRateBps was projected. */
  staffingUpdatedAt?: number;
  /** Fixed-point equivalent-capacity carry retained between completed cycles. */
  staffingBatchCarryBps?: number;
`;
  if (!source.includes(block)) throw new Error('src/types.ts missing FacilityGroup staffing block');
  source = source.replace(block, replacement);
  source = source.replace(/(export interface EconomyState \{[\s\S]*?\bversion:\s*)24(;)/, '$125$2');
  return source;
});

write('src/utils/facilityStaffing.ts', `import type { FacilityGroup } from '../types';

export const FACILITY_STAFFING_FULL_BPS = 10_000;
export const FACILITY_STAFFING_RECOVERY_MS = 10 * 60 * 1000;
export const FACILITY_STAFFING_DECAY_MS = 30 * 60 * 1000;

function normalizedRate(value: number | undefined) {
  return Math.max(0, Math.min(FACILITY_STAFFING_FULL_BPS, Math.floor(Number(value ?? FACILITY_STAFFING_FULL_BPS))));
}

function normalizedCarry(value: number | undefined) {
  const normalized = Math.max(0, Math.floor(Number(value ?? 0)));
  return normalized % FACILITY_STAFFING_FULL_BPS;
}

function staffingDeltaBps(elapsedMs: number, durationMs: number) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedMs) || 0));
  return Math.min(FACILITY_STAFFING_FULL_BPS, Math.floor(elapsed * FACILITY_STAFFING_FULL_BPS / durationMs));
}

export function projectFacilityStaffingRate(group: FacilityGroup, now: number) {
  const baseRate = normalizedRate(group.staffingRateBps);
  const updatedAt = Number.isFinite(Number(group.staffingUpdatedAt))
    ? Math.max(0, Number(group.staffingUpdatedAt))
    : Math.max(0, Number(now) || 0);
  const elapsed = Math.max(0, Number(now) - updatedAt);
  if (group.status === 'running' && group.enabled) {
    return Math.min(FACILITY_STAFFING_FULL_BPS, baseRate + staffingDeltaBps(elapsed, FACILITY_STAFFING_RECOVERY_MS));
  }
  return Math.max(0, baseRate - staffingDeltaBps(elapsed, FACILITY_STAFFING_DECAY_MS));
}

export function facilityEffectiveCount(group: FacilityGroup, physicalCount: number, now: number) {
  const count = Math.max(0, Math.floor(Number(physicalCount) || 0));
  const rateBps = projectFacilityStaffingRate(group, now);
  return Math.floor((count * rateBps + normalizedCarry(group.staffingBatchCarryBps)) / FACILITY_STAFFING_FULL_BPS);
}
`);

replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `import { resolveFacilityProfitPresentation } from '../../utils/facilityProfitPresentation';
`,
  `import { resolveFacilityProfitPresentation } from '../../utils/facilityProfitPresentation';
import { facilityEffectiveCount, projectFacilityStaffingRate } from '../../utils/facilityStaffing';
`,
);

replaceSection(
  'src/pages/production/ProductionFacilityDetail.tsx',
  'export function FacilityStaffingSummary({',
  'export function recipeVariantsForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {',
  `export function FacilityStaffingSummary({
  entry,
  now,
}: {
  entry: FacilityClusterEntry;
  now: number;
}) {
  const { group, type } = entry;
  const currentRateBps = projectFacilityStaffingRate(group, now);
  const currentPercent = staffingPercent(currentRateBps);
  const physicalCount = group.status === 'running'
    ? group.participatingCount
    : group.productionAvailableCount ?? group.participatingCount;
  const effectiveCount = facilityEffectiveCount(group, physicalCount, now);
  const directionLabel = group.status === 'running'
    ? currentPercent >= 100 ? '已满员' : '恢复中'
    : currentPercent <= 0 ? '已降至最低' : '下降中';
  const description = \`${type.name}当前满员率 ${currentPercent}%，${directionLabel}，当前 ${physicalCount} 座工厂形成 ${effectiveCount} 座整数等效产能；周期完成时按届时满员率结算。\`;

  return (
    <section className="facility-staffing-summary" aria-label={description}>
      <div className="facility-staffing-heading">
        <strong>满员率 {formatNumber(currentPercent)}%</strong>
        <span>{directionLabel}</span>
      </div>
      <div
        className="facility-staffing-track"
        role="progressbar"
        aria-label={\`${type.name}满员率\`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={currentPercent}
      >
        <span className="facility-staffing-fill" style={{ width: \`${currentPercent}%\` }} />
      </div>
    </section>
  );
}`,
);

replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `  products,
  onSelect,
}: {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  onSelect: (trigger: HTMLButtonElement) => void;
}) {`,
  `  products,
  now,
  onSelect,
}: {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  now: number;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {`,
);
replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  '  const profitScope = currentFormulaScope(group);',
  '  const profitScope = currentFormulaScope(group, now);',
);
replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `  const selectedMethod = recipeState.productionMethodGroup?.methods.find(
    (method) => method.id === recipeState.selectedProductionMethodId,
  );
  const selectedPlan = selectedMethod?.plansByRecipeId[recipeState.selectedBaseRecipeId];

`,
  '',
);
replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `      <div className="facility-detail-artwork" aria-hidden="true">
        <FacilityIcon facilityTypeId={type.id} className="facility-detail-artwork-icon" />
      </div>

      <FacilityStaffingSummary entry={entry} />

      <section className="facility-production-settings">
        <div className="facility-production-settings-heading">
  <strong>生产设置</strong>
  <small className="facility-recipe-status">
    配置切换结果会提示“生产进度已清零”，并同步降低满员率。
  </small>
</div>
`,
  `      <div className="facility-detail-overview">
        <div className="facility-detail-identity-column">
          <div className="facility-detail-artwork" aria-hidden="true">
            <FacilityIcon facilityTypeId={type.id} className="facility-detail-artwork-icon" />
          </div>
          <FacilityStaffingSummary entry={entry} now={now} />
        </div>

        <div className="facility-detail-operation-column">
          <section className="facility-production-settings">
            <div className="facility-production-settings-heading">
              <strong>生产设置</strong>
            </div>
`,
);
replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `        {selectedMethod && selectedPlan ? (
          <div className="facility-production-method-summary" aria-live="polite">
            <span>
              {formatDuration(selectedPlan.cycleMs)} · 产出 {formatNumber(selectedPlan.output.quantity)} · 成本 {formatNumber(selectedPlan.operatingCost)}
            </span>
          </div>
        ) : null}
      </section>

      <FacilityProductionFormula
        group={group}
        type={recipeState.formulaType}
        products={products}
        inventories={inventories}
        now={now}
      />
`,
  `          </section>

          <FacilityProductionFormula
            group={group}
            type={recipeState.formulaType}
            products={products}
            inventories={inventories}
            now={now}
          />
        </div>
      </div>
`,
);
replaceExact(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `import { formatDuration, formatNumber } from '../../utils/formatters';`,
  `import { formatNumber } from '../../utils/formatters';`,
);

replaceExact(
  'src/pages/ProductionPage.tsx',
  `                products={game.products}
                onSelect=`,
  `                products={game.products}
                now={now}
                onSelect=`,
);
replaceExact(
  'src/pages/ProductionPage.tsx',
  'description="同类未冻结工厂共享生产周期、配方、生产方式与满员率；新增工厂立即参与运行，配置切换立即清零进度并降低满员率。"',
  'description="同类未冻结工厂共享生产周期、配方、生产方式与满员率；变化即时生效，每个周期按完成时刻的满员率结算。"',
);

replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  `import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
`,
  `import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
import { facilityEffectiveCount, projectFacilityStaffingRate } from '../../utils/facilityStaffing';
`,
);
replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  `  label: string;
  description: string;
`,
  `  description: string;
`,
);
replaceSection(
  'src/components/facilities/FacilityProductionFormula.tsx',
  'function formulaScope(',
  'function recipeText(items: FacilityRecipeItem[], productNames: ProductNameMap, multiplier: number) {',
  `function formulaScope(
  name: string,
  group: FacilityGroup,
  physicalCount: number,
  now: number,
  descriptionPrefix: string,
): FormulaScope {
  const normalizedPhysicalCount = Math.max(0, physicalCount);
  const staffingRateBps = projectFacilityStaffingRate(group, now);
  const effectiveCount = facilityEffectiveCount(group, normalizedPhysicalCount, now);
  return {
    name,
    count: effectiveCount,
    physicalCount: normalizedPhysicalCount,
    staffingRateBps,
    description: \`${descriptionPrefix}${formatNumber(normalizedPhysicalCount)} 座工厂按完成时预计 ${staffingRateLabel(staffingRateBps)} 满员率形成 ${formatNumber(effectiveCount)} 座整数等效产能，\`,
  };
}

export function currentFormulaScope(group: FacilityGroup, now: number): FormulaScope {
  if (group.status === 'running') {
    return formulaScope('本周期', group, group.participatingCount, now, '当前 ');
  }

  const physicalCount = group.productionAvailableCount ?? group.participatingCount;
  if (group.status === 'error') {
    return formulaScope('恢复后', group, physicalCount, now, '条件恢复后 ');
  }

  return formulaScope('启动后', group, physicalCount, now, '启动后 ');
}`,
);
replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  '  const scope = currentFormulaScope(group);',
  '  const scope = currentFormulaScope(group, now);',
);
replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  `      <div className="facility-production-formula-heading">
        <strong>生产结算</strong>
        <div className="facility-formula-scope" aria-hidden="true">{scope.label}</div>
      </div>`,
  `      <div className="facility-production-formula-heading">
        <strong>生产结算</strong>
      </div>`,
);
replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  `          <div className="facility-formula-input-side">
            <div className="facility-formula-input">`,
  `          <div className="facility-formula-input-side">
            <span className="facility-formula-side-label">投入</span>
            <div className="facility-formula-input">`,
);
replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  `            </div>

            <div className="facility-formula-meta">
              <span className="facility-formula-meta-unit is-cycle">
                <CycleIcon className="facility-formula-meta-icon" />
                <span>{formatDuration(type.cycleMs)}</span>
              </span>
              <span className="facility-formula-meta-unit is-cost">
                <CreditsIcon className="facility-formula-meta-icon" />
                <span>{formatCurrency(type.operatingCost * scope.count)}</span>
              </span>
            </div>
          </div>

          <div className="facility-formula-output">
            <RecipeItems`,
  `            </div>
          </div>

          <div className="facility-formula-output-side">
            <span className="facility-formula-side-label">产出</span>
            <div className="facility-formula-output">
              <RecipeItems`,
);
replaceExact(
  'src/components/facilities/FacilityProductionFormula.tsx',
  `              itemClassName="facility-formula-output-item"
            />
          </div>
        </div>

        <div className="facility-formula-progress">`,
  `                itemClassName="facility-formula-output-item"
              />
            </div>
          </div>
        </div>

        <div className="facility-formula-meta">
          <span className="facility-formula-meta-unit is-cycle">
            <CycleIcon className="facility-formula-meta-icon" />
            <span>{formatDuration(type.cycleMs)}</span>
          </span>
          <span className="facility-formula-meta-unit is-cost">
            <CreditsIcon className="facility-formula-meta-icon" />
            <span>{formatCurrency(type.operatingCost * scope.count)}</span>
          </span>
        </div>

        <div className="facility-formula-progress">`,
);

update('src/styles/facility-group-card-grid.css', (source) => {
  source = source.replace(
    'grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);',
    'grid-template-columns: repeat(3, minmax(0, 1fr));',
  );
  source = source.replace(',\n.facility-staffing-meta', '');
  source = source.replace(/\n\.facility-recipe-status \{[\s\S]*?\n\}\n/, '\n');
  source = source.replace(/\n@container \(max-width: 479px\) \{[\s\S]*?\n\}\n/, '\n');
  const anchor = `.facility-group-card > * {
  min-width: 0;
  margin-inline: 0;
}
`;
  if (!source.includes(anchor)) throw new Error('facility-group-card-grid.css missing overview anchor');
  source = source.replace(anchor, `${anchor}
.facility-detail-overview,
.facility-detail-identity-column,
.facility-detail-operation-column {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--facility-card-section-gap);
}

.facility-detail-operation-column {
  gap: var(--facility-card-inner-gap);
}

@container (min-width: 620px) {
  .facility-detail-overview {
    grid-template-columns: minmax(11rem, 0.82fr) minmax(0, 1.18fr);
    align-items: start;
  }

  .facility-detail-operation-column .facility-production-settings {
    border-top: 0;
    padding-top: 0;
  }
}
`);
  return source;
});

update('src/styles/facility-production-formula.css', (source) => {
  source = source.replace(/\n\.facility-formula-scope \{[\s\S]*?\n\}\n/, '\n');
  source = source.replace(
    `.facility-formula-input-side {
  min-width: 0;
  display: grid;
  align-content: start;
  justify-items: start;
  gap: var(--space-2);
}
`,
    `.facility-formula-input-side,
.facility-formula-output-side {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-1);
}

.facility-formula-input-side {
  justify-items: start;
}

.facility-formula-output-side {
  justify-items: end;
}

.facility-formula-side-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 700;
  line-height: var(--line-height-tight);
}
`,
  );
  source = source.replace('  max-width: 100%;\n  min-width: 0;\n  grid-area: auto;', '  width: fit-content;\n  max-width: 100%;\n  min-width: 0;\n  grid-area: auto;');
  source = source.replace(/\n  \.facility-formula-scope \{[\s\S]*?\n  \}\n/, '\n');
  return source;
});

replaceExact(
  'src/styles/facility-artwork.css',
  `  .facility-detail-artwork {
    min-height: 7rem;
    aspect-ratio: 16 / 6;
  }`,
  `  .facility-detail-artwork {
    min-height: 5.75rem;
    aspect-ratio: 16 / 5;
  }`,
);

replaceExact(
  'src/styles/facility-detail-sheet.css',
  `  .facility-detail-sheet .facility-production-settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-1);
  }`,
  `  .facility-detail-sheet .facility-detail-overview {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-2);
  }

  .facility-detail-sheet .facility-production-settings-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-1);
  }`,
);

replaceSection(
  'server/test/facility-groups.test.js',
  "test('purchased factories join a running group immediately and dilute current-cycle staffing', () => {",
  '',
  '',
);
