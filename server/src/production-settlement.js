import { consumeCommodityFreeze, frozenForSource } from './commodity-freezes.js';
import { reconcileBuildingInputFreezes } from './building-input-freezes.js';
import { completeBuildingCycleAutoOperation, recordCompletedIndustrialOutput } from './cycle-auto-operation.js';
import {
  applyProductionUsageToResources,
  createProductionSettlementBasisId,
  createProductionSettlementClaim,
  dueProductionCycles,
  FACILITY_STAFFING_FULL_BPS,
  maxProductionCyclesForResources,
  productionResourceUsage,
  productionSettlementFits,
  projectFacilityStaffingRate,
  projectProductionCycles,
  PRODUCTION_SETTLEMENT_VERSION,
} from '../../shared/production-settlement.js';
import { FACILITY_TYPE_CATALOG } from './domain.js';
import { productionAvailableCount } from './facility-production-availability.js';
import { ensurePopulationEconomy, POPULATION_MODEL_IDS } from './population-economy.js';
import { POPULATION_PRODUCTION_PROFILE_BPS } from './population-demographics.js';
import {
  internalMoneyToMicros,
  microsToInternalMoney,
  roundInternalMoney,
} from './money.js';
import { normalizeProvinceId, provinceScopedKey } from './provinces.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const WAGE_RATE_DENOMINATOR = 10_000n;
const WAGE_ROUNDING_HALF = 5_000n;

function safeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : fallback;
}

function nonNegativeInteger(value) {
  return Math.max(0, safeInteger(value, 0));
}

function positiveInteger(value, fallback = 1) {
  const normalized = safeInteger(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function bigint(value) {
  try { return BigInt(value ?? 0); } catch { return 0n; }
}

function safeBigIntNumber(value, label) {
  const amount = bigint(value);
  if (amount < 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    const error = new Error(`${label}超出系统可表示范围`);
    error.statusCode = 409;
    error.code = 'PRODUCTION_SETTLEMENT_RANGE';
    throw error;
  }
  return Number(amount);
}

function stale(message = '生产结算基线已经变化，请重新同步') {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = 'PRODUCTION_SETTLEMENT_STALE';
  throw error;
}

function invalid(message = '生产结算声明无效') {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = 'PRODUCTION_SETTLEMENT_INVALID';
  throw error;
}

function recipeFor(type, recipeId) {
  const recipes = Array.isArray(type?.recipes) && type.recipes.length > 0
    ? type.recipes
    : type?.output
      ? [{
        id: `${type.id}-default`,
        cycleMs: type.cycleMs,
        operatingCost: type.operatingCost,
        inputs: type.inputs || (type.input ? [type.input] : []),
        output: type.output,
      }]
      : [];
  return recipes.find((recipe) => recipe.id === recipeId)
    || recipes.find((recipe) => recipe.id === type?.defaultRecipeId)
    || recipes[0]
    || null;
}

function inventoryAvailable(player, key) {
  return nonNegativeInteger(player?.inventories?.[key]?.available);
}

function mutableInventory(player, key) {
  player.inventories ||= {};
  player.inventories[key] ||= { available: 0, frozen: 0, inTransit: 0 };
  return player.inventories[key];
}

function currentProductionWageMultiplier(world) {
  const normalized = safeInteger(world?.populationEconomy?.policy?.productionWageMultiplierBps, 10_000);
  return normalized >= 5_000 ? normalized : 10_000;
}

function groupBasis(world, player, group, groupIndex, settleThrough, inventoryKeys) {
  const type = FACILITY_TYPES.get(String(group?.facilityTypeId || ''));
  const recipe = type ? recipeFor(type, group.activeRecipeId) : null;
  const provinceId = normalizeProvinceId(group?.provinceId);
  if (!type || !recipe) return null;
  const inputs = (recipe.inputs || (recipe.input ? [recipe.input] : [])).map((item) => {
    const inventoryKey = provinceScopedKey(provinceId, item.productId);
    inventoryKeys.add(inventoryKey);
    return {
      productId: String(item.productId || ''),
      quantity: nonNegativeInteger(item.quantity),
      inventoryKey,
    };
  });
  const outputKey = provinceScopedKey(provinceId, recipe.output.productId);
  inventoryKeys.add(outputKey);
  const availableCount = productionAvailableCount(world, player, group);
  const participatingCount = group?.status === 'running'
    ? Math.min(nonNegativeInteger(group.participatingCount), availableCount)
    : 0;
  const operatingCostMicros = internalMoneyToMicros(recipe.operatingCost);
  if (operatingCostMicros === null || operatingCostMicros < 0n) return null;
  return {
    groupIndex,
    key: `${provinceId}:${type.id}`,
    provinceId,
    facilityTypeId: type.id,
    complexity: type.complexity,
    enabled: Boolean(group.enabled),
    status: String(group.status || 'stopped'),
    productionAvailableCount: availableCount,
    participatingCount,
    cycleStartedAt: Number.isFinite(Number(group.cycleStartedAt)) ? Math.max(0, Number(group.cycleStartedAt)) : null,
    staffingRateBps: Math.min(FACILITY_STAFFING_FULL_BPS, Math.max(0, safeInteger(group.staffingRateBps, FACILITY_STAFFING_FULL_BPS))),
    staffingUpdatedAt: Number.isFinite(Number(group.staffingUpdatedAt)) ? Math.max(0, Number(group.staffingUpdatedAt)) : settleThrough,
    staffingBatchCarryBps: nonNegativeInteger(group.staffingBatchCarryBps) % FACILITY_STAFFING_FULL_BPS,
    cycleWageMultiplierBps: safeInteger(group.cycleWageMultiplierBps, 10_000),
    recipe: {
      id: String(recipe.id || ''),
      cycleMs: positiveInteger(recipe.cycleMs, 1),
      operatingCostMicros: operatingCostMicros.toString(),
      inputs,
      output: {
        productId: String(recipe.output.productId || ''),
        quantity: nonNegativeInteger(recipe.output.quantity),
        inventoryKey: outputKey,
      },
    },
  };
}

export function createProductionSettlementBasis(world, userId, settleThrough = Date.now()) {
  const normalizedSettleThrough = Math.max(0, Number(settleThrough) || 0);
  const player = world?.players?.[String(userId)];
  if (!player) {
    const basis = {
      version: PRODUCTION_SETTLEMENT_VERSION,
      basisId: '',
      userId: Number(userId),
      saveEpoch: 0,
      settleThrough: normalizedSettleThrough,
      resources: { creditsMicros: '0', inventories: {} },
      groups: [],
    };
    basis.basisId = createProductionSettlementBasisId(basis);
    return basis;
  }
  const inventoryKeys = new Set();
  const groups = (player.facilityGroups || [])
    .map((group, groupIndex) => groupBasis(world, player, group, groupIndex, normalizedSettleThrough, inventoryKeys))
    .filter(Boolean)
    .sort((left, right) => left.key.localeCompare(right.key));
  const creditsMicros = internalMoneyToMicros(player.credits) || 0n;
  const resources = {
    creditsMicros: creditsMicros.toString(),
    inventories: Object.fromEntries([...inventoryKeys].sort().map((key) => [key, inventoryAvailable(player, key)])),
    inputFreezes: Object.fromEntries(groups.map((group) => [group.key, Object.fromEntries(group.recipe.inputs.map((input) => [
      input.inventoryKey, frozenForSource(player.inventories?.[input.inventoryKey], 'production', group.key),
    ]))])),
  };
  const basis = {
    version: PRODUCTION_SETTLEMENT_VERSION,
    basisId: '',
    userId: Number(userId),
    saveEpoch: nonNegativeInteger(player.saveEpoch),
    settleThrough: normalizedSettleThrough,
    resources,
    groups,
  };
  basis.basisId = createProductionSettlementBasisId(basis);
  return basis;
}

function mutableResourcesFromBasis(basis) {
  return {
    creditsMicros: String(basis.resources?.creditsMicros || '0'),
    inventories: { ...(basis.resources?.inventories || {}) },
    inputFreezes: structuredClone(basis.resources?.inputFreezes || {}),
  };
}

function resourceBlockReason(groupBasis, resources, completedCycles) {
  const current = productionResourceUsage(groupBasis, completedCycles);
  const next = productionResourceUsage(groupBasis, completedCycles + 1);
  const nextCost = next.costMicros - current.costMicros;
  if (nextCost > bigint(resources.creditsMicros)) return 'insufficient_funds';
  for (const [key, total] of Object.entries(next.inputs)) {
    const required = bigint(total) - bigint(current.inputs[key]);
    if (required > bigint(resources.inventories?.[key]) + bigint(resources.inputFreezes?.[groupBasis.key]?.[key])) return 'insufficient_input';
  }
  return null;
}

function updatePlayerResources(player, resources) {
  const credits = microsToInternalMoney(bigint(resources.creditsMicros));
  if (credits === null || credits < 0) invalid('生产结算后的资金超出系统可表示范围');
  player.credits = credits;
  for (const [sourceId, inputs] of Object.entries(resources.inputFreezes || {})) {
    for (const [key, remainingValue] of Object.entries(inputs)) {
      const inventory = mutableInventory(player, key);
      const remaining = safeBigIntNumber(remainingValue, '生产冻结');
      const held = frozenForSource(inventory, 'production', sourceId);
      if (remaining > held) invalid('生产冻结基线不允许增加商品');
      consumeCommodityFreeze(inventory, 'production', sourceId, held - remaining);
    }
  }
  for (const [key, quantityValue] of Object.entries(resources.inventories || {})) {
    const quantity = safeBigIntNumber(quantityValue, '生产结算库存');
    mutableInventory(player, key).available = quantity;
  }
}

function allocateProductionEmployment(totalMicros, profile) {
  const ids = [...POPULATION_MODEL_IDS];
  const rows = ids.map((id, index) => {
    const numerator = totalMicros * BigInt(nonNegativeInteger(profile?.[id]));
    return {
      id,
      index,
      value: numerator / 10_000n,
      remainder: numerator % 10_000n,
    };
  });
  let assigned = rows.reduce((sum, row) => sum + row.value, 0n);
  rows.sort((left, right) => (
    left.remainder === right.remainder
      ? left.index - right.index
      : left.remainder > right.remainder ? -1 : 1
  ));
  for (let cursor = 0; assigned < totalMicros; cursor = (cursor + 1) % rows.length) {
    rows[cursor].value += 1n;
    assigned += 1n;
  }
  return Object.fromEntries(rows.map((row) => [row.id, row.value]));
}

function addPopulationProductionEmployment(world, group, wageMicros, payerMicros, complexity) {
  if (wageMicros <= 0n && payerMicros <= 0n) return;
  const state = ensurePopulationEconomy(world);
  const profile = POPULATION_PRODUCTION_PROFILE_BPS[String(complexity || 'C1')] || POPULATION_PRODUCTION_PROFILE_BPS.C1;
  const previousTotal = bigint(group.productionEmploymentTotalMicros);
  const nextTotal = previousTotal + wageMicros;
  const target = allocateProductionEmployment(nextTotal, profile);
  const previousAllocated = Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [
    id,
    bigint(group.productionEmploymentAllocatedMicros?.[id]),
  ]));
  for (const modelId of POPULATION_MODEL_IDS) {
    const delta = target[modelId] - previousAllocated[modelId];
    if (delta <= 0n) continue;
    const amount = microsToInternalMoney(delta);
    if (amount === null) invalid('生产就业收入超出系统可表示范围');
    state.models[modelId].pendingIncome.production = roundInternalMoney(
      Number(state.models[modelId].pendingIncome.production || 0) + amount,
    ) || 0;
  }
  const wage = microsToInternalMoney(wageMicros) || 0;
  const payer = microsToInternalMoney(payerMicros) || 0;
  state.stats.totalEmploymentIncome = roundInternalMoney(Number(state.stats.totalEmploymentIncome || 0) + wage) || 0;
  state.stats.productionIncome = roundInternalMoney(Number(state.stats.productionIncome || 0) + wage) || 0;
  state.stats.productionByComplexity[String(complexity || 'C1')] = roundInternalMoney(
    Number(state.stats.productionByComplexity[String(complexity || 'C1')] || 0) + wage,
  ) || 0;
  if (wage > payer) {
    state.stats.productionWageSubsidyIssued = roundInternalMoney(
      Number(state.stats.productionWageSubsidyIssued || 0) + wage - payer,
    ) || 0;
  } else if (payer > wage) {
    state.stats.productionWageWithheld = roundInternalMoney(
      Number(state.stats.productionWageWithheld || 0) + payer - wage,
    ) || 0;
  }
  group.productionEmploymentTotalMicros = nextTotal.toString();
  group.productionEmploymentAllocatedMicros = Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [id, target[id].toString()]));
}

function settleProductionWage(world, player, group, groupBasis, costMicros, multiplierBps) {
  if (costMicros <= 0n) return;
  const multiplier = Math.max(5_000, safeInteger(multiplierBps, 10_000));
  const carry = group.productionWageCarryNumerator === undefined
    ? WAGE_ROUNDING_HALF
    : bigint(group.productionWageCarryNumerator);
  const numerator = costMicros * BigInt(multiplier) + carry;
  const wageMicros = numerator / WAGE_RATE_DENOMINATOR;
  group.productionWageCarryNumerator = Number(numerator % WAGE_RATE_DENOMINATOR);
  addPopulationProductionEmployment(world, group, wageMicros, costMicros, groupBasis.complexity);
  const cost = microsToInternalMoney(costMicros) || 0;
  player.stats ||= {};
  player.stats.productionPayroll = roundInternalMoney(Number(player.stats.productionPayroll || 0) + cost) || 0;
  player.stats.employmentPayments = roundInternalMoney(Number(player.stats.employmentPayments || 0) + cost) || 0;
}

function setGroupError(group, reason, staffingRateBps, staffingUpdatedAt) {
  group.enabled = true;
  group.status = 'error';
  group.statusReason = reason;
  group.staffingRateBps = Math.min(FACILITY_STAFFING_FULL_BPS, Math.max(0, safeInteger(staffingRateBps, group.staffingRateBps)));
  group.staffingUpdatedAt = Math.max(0, Number(staffingUpdatedAt) || 0);
  group.participatingCount = 0;
  delete group.cycleStartedAt;
  delete group.cycleWageMultiplierBps;
}

function applyCompletedCycles(world, player, group, groupBasis, completedCycles, resources, settleThrough) {
  const due = dueProductionCycles(groupBasis, settleThrough);
  if (completedCycles < 0 || completedCycles > due) invalid();
  const usage = productionResourceUsage(groupBasis, completedCycles);
  if (completedCycles > 0) {
    applyProductionUsageToResources(resources, usage);
    updatePlayerResources(player, resources);
    const output = safeBigIntNumber(usage.outputQuantity, '生产产量');
    player.stats ||= {};
    player.stats.producedGoods = nonNegativeInteger(player.stats.producedGoods) + output;
    if (!Number.isSafeInteger(player.stats.producedGoods)) invalid('累计生产数量超出系统可表示范围');
    group.lifetimeOutput = nonNegativeInteger(group.lifetimeOutput) + output;
    if (!Number.isSafeInteger(group.lifetimeOutput)) invalid('工厂累计产量超出系统可表示范围');
    const firstCycleCostMicros = productionResourceUsage(groupBasis, 1).costMicros;
    settleProductionWage(
      world,
      player,
      group,
      groupBasis,
      firstCycleCostMicros,
      groupBasis.cycleWageMultiplierBps,
    );
    const remainingCostMicros = usage.costMicros - firstCycleCostMicros;
    settleProductionWage(
      world,
      player,
      group,
      groupBasis,
      remainingCostMicros,
      currentProductionWageMultiplier(world),
    );
    group.staffingBatchCarryBps = usage.finalCarryBps;
    group.staffingRateBps = usage.finalStaffingRateBps;
    group.staffingUpdatedAt = usage.finalCycleStartedAt;
    group.cycleStartedAt = usage.finalCycleStartedAt;
  }

  if (groupBasis.participatingCount < 1) {
    setGroupError(group, 'no_available_facility', projectFacilityStaffingRate(groupBasis, settleThrough), settleThrough);
    return;
  }
  if (completedCycles < due) {
    const reason = resourceBlockReason(groupBasis, resources, completedCycles) || 'insufficient_input';
    const nextProjection = projectProductionCycles(groupBasis, completedCycles + 1);
    setGroupError(group, reason, nextProjection.finalStaffingRateBps, nextProjection.finalCycleStartedAt);
    return;
  }

  group.cycleWageMultiplierBps = currentProductionWageMultiplier(world);
  const currentProjection = projectProductionCycles({
    ...groupBasis,
    cycleStartedAt: group.cycleStartedAt,
    staffingRateBps: group.staffingRateBps,
    staffingUpdatedAt: group.staffingUpdatedAt,
    staffingBatchCarryBps: group.staffingBatchCarryBps,
  }, 1);
  const effective = currentProjection.effectiveUnits;
  const nextCost = bigint(groupBasis.recipe.operatingCostMicros) * effective;
  if (nextCost > bigint(resources.creditsMicros)) {
    setGroupError(group, 'insufficient_funds', group.staffingRateBps, group.cycleStartedAt);
    return;
  }
  for (const item of groupBasis.recipe.inputs || []) {
    const needed = BigInt(nonNegativeInteger(item.quantity)) * effective;
    if (needed > bigint(resources.inventories?.[item.inventoryKey])
      + bigint(resources.inputFreezes?.[groupBasis.key]?.[item.inventoryKey])) {
      setGroupError(group, 'insufficient_input', group.staffingRateBps, group.cycleStartedAt);
      return;
    }
  }
}

function recoverEnabledErrorGroups(world, player, settleThrough, resources) {
  for (const group of player.facilityGroups || []) {
    if (!group?.enabled || group.status !== 'error') continue;
    const type = FACILITY_TYPES.get(String(group.facilityTypeId || ''));
    const recipe = type ? recipeFor(type, group.activeRecipeId) : null;
    if (!type || !recipe) continue;
    const available = productionAvailableCount(world, player, group);
    if (available < 1) continue;
    const staffingRateBps = projectFacilityStaffingRate(group, settleThrough);
    const capacityNumerator = BigInt(available) * BigInt(staffingRateBps)
      + BigInt(nonNegativeInteger(group.staffingBatchCarryBps) % FACILITY_STAFFING_FULL_BPS);
    const effective = capacityNumerator / BigInt(FACILITY_STAFFING_FULL_BPS);
    const costMicros = (internalMoneyToMicros(recipe.operatingCost) || 0n) * effective;
    if (costMicros > bigint(resources.creditsMicros)) continue;
    let blocked = false;
    for (const item of recipe.inputs || (recipe.input ? [recipe.input] : [])) {
      const key = provinceScopedKey(group.provinceId, item.productId);
      if (BigInt(nonNegativeInteger(item.quantity)) * effective > bigint(resources.inventories?.[key])
        + bigint(resources.inputFreezes?.[provinceScopedKey(group.provinceId, group.facilityTypeId)]?.[key])) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    group.status = 'running';
    delete group.statusReason;
    group.participatingCount = available;
    group.cycleStartedAt = settleThrough;
    group.staffingRateBps = staffingRateBps;
    group.staffingUpdatedAt = settleThrough;
    group.cycleWageMultiplierBps = currentProductionWageMultiplier(world);
  }
}

function validateClaimShape(basis, claim) {
  if (claim && Number(claim.version) === 1) stale('生产冻结结算协议已更新，请重新同步');
  if (!claim || Number(claim.version) !== PRODUCTION_SETTLEMENT_VERSION) invalid();
  const claimedBasisId = String(claim.basisId || '');
  if (claimedBasisId && claimedBasisId !== String(basis.basisId || '')) stale();
  if (Number(claim.settleThrough) !== Number(basis.settleThrough)) stale();
  if (!Array.isArray(claim.groups) || claim.groups.length !== basis.groups.length) invalid();
  for (let index = 0; index < basis.groups.length; index += 1) {
    if (String(claim.groups[index]?.key || '') !== basis.groups[index].key) invalid();
    const cycles = Number(claim.groups[index]?.completedCycles);
    if (!Number.isSafeInteger(cycles) || cycles < 0) invalid();
  }
}

function validateClaimedMaximum(groupBasisEntry, claimedCycles, resources, settleThrough) {
  const due = dueProductionCycles(groupBasisEntry, settleThrough);
  if (claimedCycles > due) invalid('客户端生产补算超过服务器时间允许的周期数');
  const candidate = { ...groupBasisEntry, settleThrough };
  if (!productionSettlementFits(candidate, claimedCycles, resources)) {
    invalid('客户端生产补算超出当前权威资金或原料');
  }
  if (claimedCycles < due && productionSettlementFits(candidate, claimedCycles + 1, resources)) {
    invalid('客户端生产补算不是当前权威资源下的最大合法结果');
  }
  return due;
}

export function applyProductionSettlementClaim(world, userId, claim, now = Date.now()) {
  const settleThrough = Math.max(0, Number(claim?.settleThrough) || 0);
  if (settleThrough > Number(now) + 1_000) invalid('生产结算时间不能晚于服务器时间');
  const player = world?.players?.[String(userId)];
  if (!player) stale('玩家生产状态不存在');
  const basis = createProductionSettlementBasis(world, userId, settleThrough);
  validateClaimShape(basis, claim);

  // All stale identity checks must finish before any production state is mutated,
  // so a stale client proposal can safely fall back inside the same outer action transaction.
  for (let index = 0; index < basis.groups.length; index += 1) {
    const groupBasisEntry = basis.groups[index];
    const group = player.facilityGroups?.[groupBasisEntry.groupIndex];
    if (!group || `${normalizeProvinceId(group.provinceId)}:${group.facilityTypeId}` !== groupBasisEntry.key) stale();
  }

  // Validate all groups against one snapshot before any material or money mutation.
  const validationResources = mutableResourcesFromBasis(basis);
  for (let index = 0; index < basis.groups.length; index += 1) {
    const entry = basis.groups[index];
    const count = Number(claim.groups[index].completedCycles);
    if (entry.status !== 'running' || dueProductionCycles(entry, settleThrough) <= 0) {
      if (count !== 0) invalid();
      continue;
    }
    validateClaimedMaximum(entry, count, validationResources, settleThrough);
    if (count > 0) applyProductionUsageToResources(validationResources, productionResourceUsage(entry, count));
  }

  const resources = mutableResourcesFromBasis(basis);
  const completed = [];
  for (let index = 0; index < basis.groups.length; index += 1) {
    const entry = basis.groups[index];
    const group = player.facilityGroups[entry.groupIndex];
    const count = Number(claim.groups[index].completedCycles);
    if (entry.status !== 'running' || dueProductionCycles(entry, settleThrough) <= 0) continue;
    applyCompletedCycles(world, player, group, entry, count, resources, settleThrough);
    if (count > 0) {
      const usage = productionResourceUsage(entry, count);
      completed.push({ group, entry, completedAt: usage.finalCycleStartedAt, output: safeBigIntNumber(usage.outputQuantity, '生产产量') });
    }
  }
  updatePlayerResources(player, resources);
  // A catch-up settles only cycles backed by the original snapshot. New purchases never backfill past downtime.
  for (const event of completed) recordCompletedIndustrialOutput(world, player, event.group, event.entry.recipe.output.productId, event.output, now);
  for (const event of completed) completeBuildingCycleAutoOperation(world, player, event.group, 'production', event.completedAt, now);
  const currentResources = mutableResourcesFromBasis(createProductionSettlementBasis(world, userId, settleThrough));
  recoverEnabledErrorGroups(world, player, settleThrough, currentResources);
  reconcileBuildingInputFreezes(world, player, now);
  return {
    ok: true,
    message: '生产结算已由服务器校验并入账',
    settledThrough: settleThrough,
  };
}

export function settleProductionForPlayerServerSide(world, userId, now = Date.now()) {
  const basis = createProductionSettlementBasis(world, userId, now);
  const claim = createProductionSettlementClaim(basis);
  if (!claim) return { ok: true, message: '没有待结算生产', settledThrough: Number(now) };
  return applyProductionSettlementClaim(world, userId, claim, now);
}

function contractDueAt(contract) {
  const candidates = [contract?.nextDueAt, contract?.dueAt, contract?.graceEndsAt]
    .map(Number)
    .filter((value) => Number.isFinite(value) && value >= 0);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

export function settleProductionForDueContractParticipants(world, now = Date.now()) {
  const playerIds = new Set();
  for (const contract of world?.productionContracts || []) {
    if (contract?.status !== 'active') continue;
    const dueAt = contractDueAt(contract);
    if (dueAt === null || dueAt > Number(now)) continue;
    if (contract.contractType === 'goods_supply' && Number.isSafeInteger(Number(contract.supplierId))) {
      playerIds.add(Number(contract.supplierId));
    }
    if (contract.contractType === 'facility_lease' && Number.isSafeInteger(Number(contract.lesseeId))) {
      playerIds.add(Number(contract.lesseeId));
    }
  }
  for (const userId of playerIds) {
    if (world.players?.[String(userId)]) settleProductionForPlayerServerSide(world, userId, now);
  }
  return playerIds.size;
}
