import {
  applyProductionContractAction as applyLegacyProductionContractAction,
  createMarketReserveProcurementContract,
  createProductionContractClientState as createLegacyProductionContractClientState,
  migrateProductionContractWorld as migrateLegacyProductionContractWorld,
  processProductionContracts as processLegacyProductionContracts,
} from './contracts.js';
import {
  applyDailySupplyContractAction,
  CONTRACT_DAY_MS,
  isDailySupplyContract,
  migrateDailySupplyContracts,
  processDailySupplyContracts,
  publicDailySupplyContract,
} from './daily-supply-contracts.js';

export { createMarketReserveProcurementContract };

function partitionContracts(world) {
  const original = world.productionContracts || [];
  const daily = original.filter(isDailySupplyContract);
  const legacy = original.filter((contract) => !isDailySupplyContract(contract));
  return { original, daily, legacy };
}

function legacyWorldView(world, legacy) {
  const original = world.productionContracts || [];
  return legacy.length === original.length
    ? world
    : { ...world, productionContracts: legacy };
}

function runLegacy(world, callback) {
  const { original, daily, legacy } = partitionContracts(world);
  world.productionContracts = legacy;
  try {
    return callback({ original, daily, legacy });
  } finally {
    const processedLegacy = world.productionContracts || [];
    const legacyById = new Map(processedLegacy.map((contract) => [contract.id, contract]));
    const dailyById = new Map(daily.map((contract) => [contract.id, contract]));
    const restored = original.flatMap((contract) => {
      if (dailyById.has(contract.id)) return [dailyById.get(contract.id)];
      if (legacyById.has(contract.id)) return [legacyById.get(contract.id)];
      return [];
    });
    for (const contract of processedLegacy) if (!original.some((item) => item.id === contract.id)) restored.push(contract);
    for (const contract of daily) if (!original.some((item) => item.id === contract.id)) restored.push(contract);
    world.productionContracts = restored;
  }
}

function legacyCommercialPayload(action, payload = {}) {
  if (action !== 'createProductionContract') return payload;
  if (payload.kind === 'loan' && payload.termDays !== undefined && payload.termMs === undefined) {
    const termMs = Math.round(Number(payload.termDays) * CONTRACT_DAY_MS);
    return { ...payload, termMs };
  }
  if (payload.kind === 'facility_lease') {
    const periodMs = payload.periodMs ?? (payload.periodDays !== undefined ? Math.round(Number(payload.periodDays) * CONTRACT_DAY_MS) : undefined);
    const firstPeriodDelayMs = payload.firstPeriodDelayMs ?? (payload.firstPeriodDelayDays !== undefined ? Math.round(Number(payload.firstPeriodDelayDays) * CONTRACT_DAY_MS) : undefined);
    return { ...payload, periodMs, firstPeriodDelayMs };
  }
  return payload;
}

export function migrateProductionContractWorld(world, now = Date.now()) {
  const { original, daily, legacy } = partitionContracts(world);
  world.productionContracts = legacy;
  migrateLegacyProductionContractWorld(world);
  const migratedLegacy = world.productionContracts || [];
  world.productionContracts = original.map((contract) => isDailySupplyContract(contract)
    ? daily.find((item) => item.id === contract.id) || contract
    : migratedLegacy.find((item) => item.id === contract.id) || contract);
  for (const contract of migratedLegacy) if (!original.some((item) => item.id === contract.id)) world.productionContracts.push(contract);
  migrateDailySupplyContracts(world, now);
  return world;
}

export function processProductionContracts(world, now = Date.now()) {
  migrateProductionContractWorld(world, now);
  runLegacy(world, () => processLegacyProductionContracts(world, now));
  processDailySupplyContracts(world, now);
  return world;
}

function isDailyCreate(action, payload) {
  return action === 'createProductionContract'
    && (!payload.kind || payload.kind === 'supply')
    && (payload.dailyMaxQuantity !== undefined || payload.durationDays !== undefined || payload.startDelayDays !== undefined);
}

export function applyProductionContractAction(world, user, action, payload = {}, now = Date.now()) {
  migrateProductionContractWorld(world, now);
  if (isDailyCreate(action, payload)) return applyDailySupplyContractAction(world, user, action, payload, now);
  const target = (world.productionContracts || []).find((contract) => contract.id === String(payload.contractId || ''));
  if (isDailySupplyContract(target)) return applyDailySupplyContractAction(world, user, action, payload, now);
  const legacyPayload = legacyCommercialPayload(action, payload);
  return runLegacy(world, () => applyLegacyProductionContractAction(world, user, action, legacyPayload, now));
}

function enrichCommercialDays(contract) {
  if (contract.kind === 'loan') return { ...contract, termDays: Number(contract.termMs || 0) / CONTRACT_DAY_MS };
  if (contract.kind === 'facility_lease') return {
    ...contract,
    periodDays: Number(contract.periodMs || 0) / CONTRACT_DAY_MS,
    firstPeriodDelayDays: Number(contract.firstPeriodDelayMs || 0) / CONTRACT_DAY_MS,
  };
  return contract;
}

function dailyVisibleContracts(world, userId, now) {
  const daily = (world.productionContracts || []).filter(isDailySupplyContract);
  const visibleOpen = daily.filter((contract) => contract.status === 'open')
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
    .slice(0, 200);
  const own = daily.filter((contract) => [contract.publisherId, contract.buyerId, contract.supplierId]
    .some((id) => Number(id) === Number(userId)));
  const active = own.filter((contract) => contract.status === 'active');
  const ownOpen = own.filter((contract) => contract.status === 'open');
  const recent = own.filter((contract) => !['open', 'active'].includes(contract.status))
    .sort((left, right) => Number(right.endedAt || right.createdAt || 0) - Number(left.endedAt || left.createdAt || 0))
    .slice(0, 100);
  const byId = new Map([...visibleOpen, ...active, ...recent, ...ownOpen].map((contract) => [contract.id, contract]));
  return [...byId.values()].map((contract) => publicDailySupplyContract(world, contract, userId, now));
}

export function createProductionContractClientState(world, userId, now = Date.now()) {
  const { legacy } = partitionContracts(world);
  const legacyState = createLegacyProductionContractClientState(
    legacyWorldView(world, legacy),
    userId,
    now,
  );
  const legacyContracts = (legacyState?.productionContracts || []).map(enrichCommercialDays);
  const dailyContracts = dailyVisibleContracts(world, userId, now);
  const productionContracts = [...legacyContracts, ...dailyContracts];
  const ownActive = productionContracts.filter((contract) => contract.status === 'active' && (contract.isParticipant || contract.isBuyer || contract.isSupplier || contract.isLender || contract.isBorrower || contract.isLessor || contract.isLessee));
  const ownOpen = productionContracts.filter((contract) => contract.status === 'open' && contract.isPublisher);
  const negotiationAttention = productionContracts.reduce((sum, contract) => sum + (contract.negotiations || []).filter((item) => item.awaitingMyResponse).length, 0);
  return {
    productionContracts,
    productionContractSummary: {
      active: ownActive.length,
      open: ownOpen.length,
      needsAttention: ownActive.filter((contract) => Boolean(contract.issue)).length + negotiationAttention,
      upcomingWithin24Hours: ownActive.filter((contract) => contract.nextDueAt !== null && Number(contract.nextDueAt) <= now + CONTRACT_DAY_MS).length,
    },
  };
}
