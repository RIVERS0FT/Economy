import { createContractRuntimeIndex } from './contract-runtime-index.js';
import { nextDailyCheckInResetAt } from './daily-check-in.js';
import { nextBankDeadlineAt } from './banking.js';
import { nextWeeklyCashSettlementDeadlineAt } from './weekly-cash-settlement.js';
import { isOpenOrder } from './order-identity.js';
import { POPULATION_POLICY_CYCLE_MS } from './population-policy.js';
import { nextEconomicEventDeadline } from './economic-events.js';
import { nextResearchDeadlineAt } from './research.js';
import { nextTransportDeadline } from './transport.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function finiteTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
}

function earlier(left, right) {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

export function nextConstructionEmploymentAt() {
  return null;
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
    // Player facility production is settled lazily per player and is intentionally absent from the global scheduler.
    facility: null,
    market: marketDeadline(world, normalizedNow),
    auction: auctionDeadline(world),
    contract: createContractRuntimeIndex(world).nextDeadlineAt(),
    leaderboard: leaderboardDeadline(world, normalizedNow),
    checkIn: nextDailyCheckInResetAt(normalizedNow),
    bank: nextBankDeadlineAt(world, normalizedNow),
    weeklyCashSettlement: nextWeeklyCashSettlementDeadlineAt(world, normalizedNow),
    research: nextResearchDeadlineAt(world),
    transport: nextTransportDeadline(world),
    orderPrune: orderPruneDeadline(world, normalizedNow),
  };
  const nextDueAt = Object.values(deadlines).reduce(earlier, null);
  return { nextDueAt, deadlines };
}
