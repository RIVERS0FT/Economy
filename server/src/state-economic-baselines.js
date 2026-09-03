import baselineData from '../../shared/us-state-economic-baselines.json' with { type: 'json' };
import provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json' with { type: 'json' };
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

function percentileRanks(metric) {
  const sorted = [...rows].sort((left, right) => (
    Number(left[metric]) - Number(right[metric])
    || String(left.provinceId).localeCompare(String(right.provinceId))
  ));
  const denominator = Math.max(1, sorted.length - 1);
  const ranks = new Map();
  let index = 0;
  while (index < sorted.length) {
    let end = index + 1;
    while (end < sorted.length && Number(sorted[end][metric]) === Number(sorted[index][metric])) end += 1;
    const percentile = ((index + end - 1) / 2) / denominator;
    for (let cursor = index; cursor < end; cursor += 1) ranks.set(sorted[cursor].provinceId, percentile);
    index = end;
  }
  return ranks;
}

const populationPercentiles = percentileRanks('population');
const wagePercentiles = percentileRanks('averageWeeklyWage');
const pcePercentiles = percentileRanks('pceMillions');
const economicScores = rows.map((row) => Object.freeze({
  provinceId: row.provinceId,
  score:
    (pcePercentiles.get(row.provinceId) || 0) * Number(provinceEconomicLevelPolicy.weights.pceMillions)
    + (wagePercentiles.get(row.provinceId) || 0) * Number(provinceEconomicLevelPolicy.weights.averageWeeklyWage)
    + (populationPercentiles.get(row.provinceId) || 0) * Number(provinceEconomicLevelPolicy.weights.population),
}));
const economicScoreByProvinceId = new Map(economicScores.map((row) => [row.provinceId, row.score]));
const economicLevelByProvinceId = new Map();
const levelCount = Number(provinceEconomicLevelPolicy.levelCount);
[...economicScores]
  .sort((left, right) => left.score - right.score || left.provinceId.localeCompare(right.provinceId))
  .forEach((row, index) => {
    economicLevelByProvinceId.set(
      row.provinceId,
      Math.min(levelCount, Math.floor(index * levelCount / Math.max(1, economicScores.length)) + 1),
    );
  });

export const STATE_ECONOMIC_BASELINES = Object.freeze(rows);

export function stateEconomicBaselineFor(provinceId) {
  return byProvinceId.get(String(provinceId || '')) || byProvinceId.get(DEFAULT_PROVINCE_ID);
}

export function stateEconomicScoreFor(provinceId) {
  return economicScoreByProvinceId.get(String(provinceId || '')) || 0;
}

export function stateEconomicLevelFor(provinceId) {
  return economicLevelByProvinceId.get(String(provinceId || '')) || 1;
}

export function activePopulationDemandProvinceIds(world) {
  const active = new Set();
  for (const player of Object.values(world?.players || {})) {
    const startingProvinceId = String(player?.startingProvinceId || '');
    if (provinceById.has(startingProvinceId)) active.add(startingProvinceId);
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
