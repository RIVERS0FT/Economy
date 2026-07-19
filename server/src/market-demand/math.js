import { SHARE_MAX_CHANGE, SHARE_SMOOTHING } from './catalog.js';

export const clamp = (minimum, maximum, value) => Math.max(minimum, Math.min(maximum, value));
export const clone = (value) => structuredClone(value);
export const round4 = (value) => Number(Number(value || 0).toFixed(4));

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
    const blended = previous * (1 - SHARE_SMOOTHING) + target * SHARE_SMOOTHING;
    smoothed[id] = clamp(previous - SHARE_MAX_CHANGE, previous + SHARE_MAX_CHANGE, blended);
  }
  return normalizeShares(smoothed, minimumShares);
}

export function allocateIntegerBudget(entries, totalBudget) {
  const result = new Map(entries.map((entry) => [entry.id, 0]));
  const active = entries.filter((entry) => Number(entry.weight || 0) > 0 && Number(entry.maxBudget ?? totalBudget) > 0);
  if (active.length === 0 || totalBudget <= 0) return result;
  let remaining = Math.max(0, Math.floor(totalBudget));
  let candidates = active;
  while (remaining > 0 && candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, entry) => sum + Number(entry.weight), 0);
    let distributed = 0;
    for (const entry of candidates) {
      const current = result.get(entry.id) || 0;
      const available = Math.max(0, Math.floor(Number(entry.maxBudget ?? totalBudget)) - current);
      if (available <= 0) continue;
      const grant = Math.min(available, Math.floor(remaining * Number(entry.weight) / totalWeight));
      if (grant <= 0) continue;
      result.set(entry.id, current + grant);
      distributed += grant;
    }
    if (distributed <= 0) {
      const winner = [...candidates].sort((left, right) => Number(right.weight) - Number(left.weight) || left.id.localeCompare(right.id))[0];
      result.set(winner.id, (result.get(winner.id) || 0) + 1);
      distributed = 1;
    }
    remaining -= distributed;
    candidates = candidates.filter((entry) => (result.get(entry.id) || 0) < Math.floor(Number(entry.maxBudget ?? totalBudget)));
  }
  return result;
}
