import baselineData from '../../shared/us-state-economic-baselines.json' with { type: 'json' };
import { DEFAULT_PROVINCE_ID, PROVINCE_CATALOG } from './provinces.js';

export const STATE_ECONOMIC_BASELINE_VERSION = 1;
export const STATE_ECONOMIC_BASELINE_SOURCES = Object.freeze(structuredClone(baselineData.sources));

const provinceById = new Map(PROVINCE_CATALOG.map((province) => [province.id, province]));
const rows = baselineData.states.map((row) => Object.freeze({ ...row }));
const byProvinceId = new Map(rows.map((row) => [row.provinceId, row]));

if (Number(baselineData.version) !== STATE_ECONOMIC_BASELINE_VERSION) {
  throw new Error(`州级经济基准版本不受支持: ${baselineData.version}`);
}
if (rows.length !== PROVINCE_CATALOG.length || byProvinceId.size !== PROVINCE_CATALOG.length) {
  throw new Error('州级经济基准必须与连续 48 州一一对应');
}
for (const province of PROVINCE_CATALOG) {
  const row = byProvinceId.get(province.id);
  if (!row
    || row.state !== province.mapName
    || row.shortName !== province.shortName
    || !Number.isSafeInteger(Number(row.population))
    || Number(row.population) <= 0
    || !Number.isFinite(Number(row.averageWeeklyWage))
    || Number(row.averageWeeklyWage) <= 0
    || !Number.isFinite(Number(row.pceMillions))
    || Number(row.pceMillions) <= 0) {
    throw new Error(`州级经济基准无效: ${province.id}`);
  }
}

export const STATE_ECONOMIC_BASELINES = Object.freeze(rows);

export function stateEconomicBaselineFor(provinceId) {
  return byProvinceId.get(String(provinceId || '')) || byProvinceId.get(DEFAULT_PROVINCE_ID);
}

export function activePopulationDemandProvinceIds(world) {
  const active = new Set();
  for (const player of Object.values(world?.players || {})) {
    const startingProvinceId = String(player?.startingProvinceId || '');
    if (provinceById.has(startingProvinceId)) active.add(startingProvinceId);
    for (const provinceId of player?.unlockedProvinces || []) {
      const id = String(provinceId || '');
      if (provinceById.has(id)) active.add(id);
    }
    for (const group of player?.facilityGroups || []) {
      const id = String(group?.provinceId || '');
      if (Number(group?.count || 0) > 0 && provinceById.has(id)) active.add(id);
    }
  }
  if (active.size === 0) active.add(DEFAULT_PROVINCE_ID);
  return PROVINCE_CATALOG.filter((province) => active.has(province.id)).map((province) => province.id);
}

export function populationDemandProvinceWeights(world) {
  const rowsForWorld = activePopulationDemandProvinceIds(world).map((provinceId) => stateEconomicBaselineFor(provinceId));
  const pceTotal = rowsForWorld.reduce((sum, row) => sum + Number(row.pceMillions || 0), 0);
  if (!(pceTotal > 0)) {
    const fallback = stateEconomicBaselineFor(DEFAULT_PROVINCE_ID);
    return [{ ...fallback, weight: 1, pceShare: 1 }];
  }
  return rowsForWorld.map((row) => Object.freeze({
    ...row,
    weight: Number(row.pceMillions),
    pceShare: Number(row.pceMillions) / pceTotal,
  }));
}
