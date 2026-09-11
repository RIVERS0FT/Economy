import { startCashProductionCycle, settleCashProductionCycle, pauseCashProductionCycle } from './cash-production-cycles.js';
import { productionAvailableCount } from './facility-production-availability.js';
import { creditPopulationEmployment } from './population-economy.js';
import { projectFacilityStaffingRate } from '../../shared/production-settlement.js';

const RETRY_MS = 60_000;

function automatic(player, group) {
  return player.factoryAutoOperationPolicies?.[`${group.provinceId}:${group.facilityTypeId}`]?.enabled !== false;
}

function applyEmployment(world, result) {
  const job = result.employment;
  if (job) creditPopulationEmployment(world, job.amount, job.source, job);
}

/** A committed snapshot is the only production authority. No client-proposed resource arithmetic. */
export function processCashProductionGroup(world, player, group, now, { manual = false, allowStart = true } = {}) {
  if (world.cashEconomy?.version !== 1) return { ok: false, message: '当前世界未启用现金生产' };
  let completed = false;
  if (group.cashCycle) {
    if (Number(group.cashPriceRetryAt ?? 0) > now) return { ok: true, settled: false, started: false, waiting: true };
    try {
      const result = settleCashProductionCycle(world, player, group, now);
      applyEmployment(world, result);
      completed = result.settled;
      delete group.cashPriceRetryAt;
      delete group.cashPriceError;
    } catch (error) {
      if (error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
      // Retain both the paid cycle and its original valuation date. Other players can still progress.
      group.cashPriceRetryAt = now + RETRY_MS;
      group.cashPriceError = '完成日价格待核对，已投入周期保留';
      return { ok: true, settled: false, started: false, waiting: true };
    }
  }
  if (group.cashCycle) return { ok: true, settled: completed, started: false };
  const canStart = allowStart && player.__suppressInitialAutoOperationBootstrap !== true
    && (manual || (group.enabled && automatic(player, group)));
  if (!canStart) {
    group.status = 'stopped';
    group.statusReason = 'manual';
    group.participatingCount = 0;
    return { ok: true, settled: completed, started: false };
  }
  if (productionAvailableCount(world, player, group) < 1) {
    group.status = 'error';
    group.statusReason = 'no_available_facility';
    return { ok: true, settled: completed, started: false };
  }
  let result;
  try { result = startCashProductionCycle(world, player, group, now, { manual }); }
  catch (error) {
    if (error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
    result = { started: false, reason: 'price_unavailable' };
  }
  applyEmployment(world, result);
  if (!result.started) {
    group.staffingRateBps = projectFacilityStaffingRate(group, now);
    group.staffingUpdatedAt = now;
    group.status = 'error';
    group.statusReason = result.reason;
    group.participatingCount = 0;
  }
  return { ok: true, settled: completed, started: result.started, reason: result.reason };
}

export function processCashProductionForPlayer(world, player, now, options = {}) {
  let settled = 0; let started = 0;
  // Deterministic cash allocation; it does not attempt unrecorded past cycles or all future cycles.
  for (const group of [...(player?.facilityGroups ?? [])].sort((left, right) => (
    `${left.provinceId}:${left.facilityTypeId}`.localeCompare(`${right.provinceId}:${right.facilityTypeId}`)
  ))) {
    const result = processCashProductionGroup(world, player, group, now, options);
    settled += Number(result.settled === true);
    started += Number(result.started === true);
  }
  return { ok: true, message: '', settled, started, settledThrough: now };
}

export function processCashProductionWorld(world, now, options = {}) {
  if (world.cashEconomy?.version !== 1) return false;
  let changed = false;
  for (const player of Object.values(world.players ?? {})) {
    const result = processCashProductionForPlayer(world, player, now, options);
    changed ||= result.settled > 0 || result.started > 0;
  }
  return changed;
}

export function nextCashProductionDeadline(world) {
  if (world.cashEconomy?.version !== 1) return null;
  let next = null;
  for (const player of Object.values(world.players ?? {})) {
    for (const group of player.facilityGroups ?? []) {
      if (!group.cashCycle) continue;
      const at = Math.max(group.cashCycle.completesAt, Number(group.cashPriceRetryAt ?? 0));
      next = next === null ? at : Math.min(next, at);
    }
  }
  return next;
}

export function stopCashProduction(player, group, now) {
  pauseCashProductionCycle(player, group, now);
  return { ok: true, message: group.cashCycle ? '后续生产已停止，已投入周期仍会完成结算' : '生产已停止' };
}
