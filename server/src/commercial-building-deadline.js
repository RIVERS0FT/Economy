import { hasCommercialCycle } from '../../shared/commercial-staffing.js';
function finiteTimestamp(value) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : null;
}

export function nextCommercialBuildingDeadline(world) {
  let deadline = null;
  for (const player of Object.values(world?.players || {})) {
    for (const group of player?.commercialBuildingGroups || []) {
      if (!hasCommercialCycle(group)) continue;
      const completesAt = finiteTimestamp(group?.cycleCompletesAt);
      if (completesAt === null) continue;
      deadline = deadline === null ? completesAt : Math.min(deadline, completesAt);
    }
  }
  return deadline;
}
