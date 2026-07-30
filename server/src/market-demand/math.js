import { floorInternalMoney, internalMoneyToMicros, microsToInternalMoney, roundInternalMoney } from '../money.js';

export const clamp = (minimum, maximum, value) => Math.max(minimum, Math.min(maximum, value));
export const clone = (value) => structuredClone(value);
export const round4 = (value) => Number(Number(value || 0).toFixed(4));
export const floorMoney = (value) => Math.max(0, floorInternalMoney(value) || 0);
export const roundMoney = (value) => Math.max(0, roundInternalMoney(value) || 0);

export function geometricWeightedMean(signals) {
  const active = signals.filter((signal) => Number.isFinite(signal.value) && signal.value > 0 && signal.weight > 0);
  const totalWeight = active.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight <= 0) return null;
  return Math.exp(active.reduce((sum, signal) => sum + signal.weight * Math.log(signal.value), 0) / totalWeight);
}

export function normalizeShares(rawShares, minimumShares = {}) {
  const ids = Object.keys(rawShares);
  if (ids.length === 0) return {};
  const positive = Object.fromEntries(ids.map((id) => [id, Math.max(0, Number(rawShares[id] || 0))]));
  const minimumTotal = ids.reduce((sum, id) => sum + clamp(0, 1, Number(minimumShares[id] || 0)), 0);
  const minima = minimumTotal > 1
    ? Object.fromEntries(ids.map((id) => [id, Number(minimumShares[id] || 0) / minimumTotal]))
    : Object.fromEntries(ids.map((id) => [id, clamp(0, 1, Number(minimumShares[id] || 0))]));
  const freeShare = Math.max(0, 1 - Object.values(minima).reduce((sum, value) => sum + value, 0));
  const scoreTotal = Object.values(positive).reduce((sum, value) => sum + value, 0);
  const fallback = scoreTotal > 0 ? positive : Object.fromEntries(ids.map((id) => [id, 1]));
  const fallbackTotal = Object.values(fallback).reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(ids.map((id) => [id, minima[id] + freeShare * fallback[id] / fallbackTotal]));
}

export function smoothShares(targetShares, previousShares, minimumShares = {}) {
  const smoothed = {};
  for (const id of Object.keys(targetShares)) {
    const target = Number(targetShares[id] || 0);
    const previous = Number.isFinite(Number(previousShares?.[id])) ? Number(previousShares[id]) : target;
    const blended = previous * (1 - 0.30) + target * 0.30;
    smoothed[id] = clamp(previous - 0.15, previous + 0.15, blended);
  }
  return normalizeShares(smoothed, minimumShares);
}

function weightUnits(value) {
  const normalized = Math.max(0, Number(value || 0));
  if (!Number.isFinite(normalized) || normalized <= 0) return 0n;
  return BigInt(Math.max(1, Math.round(normalized * 1_000_000_000)));
}

export function allocateMoneyBudget(entries, totalBudget) {
  const resultMicros = new Map(entries.map((entry) => [entry.id, 0n]));
  const totalMicros = internalMoneyToMicros(Math.max(0, totalBudget));
  if (totalMicros === null || totalMicros <= 0n) return new Map(entries.map((entry) => [entry.id, 0]));
  let candidates = entries.map((entry, index) => ({
    ...entry,
    index,
    weightUnits: weightUnits(entry.weight),
    maxMicros: internalMoneyToMicros(Math.max(0, Number(entry.maxBudget ?? totalBudget))) || 0n,
  })).filter((entry) => entry.weightUnits > 0n && entry.maxMicros > 0n);
  let remaining = totalMicros;
  while (remaining > 0n && candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, entry) => sum + entry.weightUnits, 0n);
    let distributed = 0n;
    const ranked = [];
    for (const entry of candidates) {
      const current = resultMicros.get(entry.id) || 0n;
      const available = entry.maxMicros - current;
      if (available <= 0n) continue;
      const numerator = remaining * entry.weightUnits;
      const rawGrant = numerator / totalWeight;
      const grant = rawGrant > available ? available : rawGrant;
      if (grant > 0n) {
        resultMicros.set(entry.id, current + grant);
        distributed += grant;
      }
      ranked.push({ entry, remainder: numerator % totalWeight });
    }
    if (distributed <= 0n) {
      ranked.sort((left, right) => {
        if (left.remainder !== right.remainder) return left.remainder > right.remainder ? -1 : 1;
        if (left.entry.weightUnits !== right.entry.weightUnits) return left.entry.weightUnits > right.entry.weightUnits ? -1 : 1;
        return left.entry.index - right.entry.index;
      });
      const winner = ranked.find(({ entry }) => (resultMicros.get(entry.id) || 0n) < entry.maxMicros)?.entry;
      if (!winner) break;
      resultMicros.set(winner.id, (resultMicros.get(winner.id) || 0n) + 1n);
      distributed = 1n;
    }
    remaining -= distributed;
    candidates = candidates.filter((entry) => (resultMicros.get(entry.id) || 0n) < entry.maxMicros);
  }
  return new Map(entries.map((entry) => [entry.id, microsToInternalMoney(resultMicros.get(entry.id) || 0n) || 0]));
}

export const allocateIntegerBudget = allocateMoneyBudget;
