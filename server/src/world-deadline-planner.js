import { createContractRuntimeIndex } from './contract-runtime-index.js';
import { nextDailyCheckInResetAt } from './daily-check-in.js';
import { nextBankDeadlineAt } from './banking.js';
import { nextWeeklyCashSettlementDeadlineAt } from './weekly-cash-settlement.js';
import { FACILITY_TYPE_CATALOG } from './domain.js';
import { isOpenOrder } from './order-identity.js';
import { POPULATION_POLICY_CYCLE_MS } from './population-policy.js';
import { nextEconomicEventDeadline } from './economic-events.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));

function finiteTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
}

function earlier(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function recipeForGroup(group) {
  const type = FACILITY_TYPES.get(String(group?.facilityTypeId || ''));
  if (!type) return null;
  const recipes = Array.isArray(type.recipes) && type.recipes.length > 0
    ? type.recipes
    : type.output
      ? [{
        id: `${type.id}-default`,
        cycleMs: type.cycleMs,
        operatingCost: type.operatingCost,
        inputs: type.inputs || (type.input ? [type.input] : []),
        output: type.output,
      }]
      : [];
  return recipes.find((recipe) => recipe.id === group?.activeRecipeId)
    || recipes.find((recipe) => recipe.id === type.defaultRecipeId)
    || recipes[0]
    || null;
}

export function nextConstructionEmploymentAt(construction) {
  if (!construction) return null;
  const startedAt = finiteTimestamp(construction.startedAt);
  const completesAt = finiteTimestamp(construction.completesAt);
  if (startedAt === null || completesAt === null || completesAt <= startedAt) return completesAt;
  const buildCost = Math.max(0, Math.floor(Number(construction.buildCost || 0)));
  const released = Math.max(0, Math.floor(Number(construction.employmentReleased || 0)));
  if (buildCost <= 0 || released >= buildCost) return completesAt;
  const duration = completesAt - startedAt;
  const nextReleased = Math.min(buildCost, released + 1);
  return Math.min(
    completesAt,
    startedAt + Math.ceil(nextReleased * duration / buildCost),
  );
}

function facilityDeadline(world) {
  let deadline = null;
  for (const player of Object.values(world.players || {})) {
    const construction = player.facilityConstruction;
    if (construction) {
      deadline = earlier(deadline, finiteTimestamp(construction.completesAt));
      deadline = earlier(deadline, nextConstructionEmploymentAt(construction));
    }
    for (const group of player.facilityGroups || []) {
      if (group.status !== 'running' || !group.cycleStartedAt) continue;
      const recipe = recipeForGroup(group);
      const cycleMs = Math.max(1, Number(recipe?.cycleMs || 0));
      deadline = earlier(deadline, finiteTimestamp(Number(group.cycleStartedAt) + cycleMs));
    }
  }
  return deadline;
}

function marketDeadline(world, now) {
  const marketDemand = world.marketDemand;
  if (!marketDemand || typeof marketDemand !== 'object') return now;
  let deadline = nextEconomicEventDeadline(now);
  const transmission = marketDemand.priceTransmission;
  const cycleMs = Math.max(0, Number(transmission?.cycleMs || 0));
  if (cycleMs > 0) {
    const lastCycleId = Number.isFinite(Number(transmission?.lastCycleId))
      ? Number(transmission.lastCycleId)
      : -1;
    deadline = earlier(deadline, Math.max(0, (lastCycleId + 1) * cycleMs));
  }
  for (const group of Object.values(marketDemand.groups || {})) {
    deadline = earlier(deadline, finiteTimestamp(group?.nextDemandAt));
  }
  const expiryCycle = world.populationEconomy?.policy?.expiresAfterCycleId;
  if (expiryCycle !== null && expiryCycle !== undefined && Number.isFinite(Number(expiryCycle))) {
    deadline = earlier(deadline, Math.max(0, Number(expiryCycle) * POPULATION_POLICY_CYCLE_MS));
  }
  return deadline;
}

function auctionDeadline(world) {
  let deadline = null;
  for (const auction of world.assetAuctions || []) {
    if (auction?.status !== 'open') continue;
    deadline = earlier(deadline, finiteTimestamp(auction.endsAt));
  }
  return deadline;
}

function leaderboardDeadline(world, now) {
  const state = world.leaderboardState;
  if (
    !state
    || typeof state.periodKey !== 'string'
    || !Number.isFinite(Number(state.endsAt))
    || Number(state.endsAt) <= Number(state.startsAt)
  ) return now;
  return Number(state.endsAt);
}

function orderPruneDeadline(world, now) {
  if ((world.orders || []).length > 4_000 || (world.facilityListings || []).length > 800) return now;
  let deadline = null;
  for (const order of world.orders || []) {
    if (isOpenOrder(order)) continue;
    const createdAt = finiteTimestamp(order.createdAt);
    if (createdAt === null) continue;
    deadline = earlier(deadline, createdAt + DAY_MS + 1);
  }
  return deadline;
}

export function createWorldDeadlinePlan(world, now = Date.now()) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  if (!world || typeof world !== 'object') {
    return { nextDueAt: normalizedNow, deadlines: { initialization: normalizedNow } };
  }
  const deadlines = {
    facility: facilityDeadline(world),
    market: marketDeadline(world, normalizedNow),
    auction: auctionDeadline(world),
    contract: createContractRuntimeIndex(world).nextDeadlineAt(),
    leaderboard: leaderboardDeadline(world, normalizedNow),
    checkIn: nextDailyCheckInResetAt(normalizedNow),
    bank: nextBankDeadlineAt(world, normalizedNow),
    weeklyCashSettlement: nextWeeklyCashSettlementDeadlineAt(world, normalizedNow),
    orderPrune: orderPruneDeadline(world, normalizedNow),
  };
  const nextDueAt = Object.values(deadlines).reduce(earlier, null);
  return { nextDueAt, deadlines };
}
