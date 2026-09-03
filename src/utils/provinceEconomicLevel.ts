import stateEconomicBaselines from '../../shared/us-state-economic-baselines.json';
import provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json';

const baselineRows = stateEconomicBaselines.states;
const levelCount = provinceEconomicLevelPolicy.levelCount;

function percentileRanks(metric: 'population' | 'averageWeeklyWage' | 'pceMillions') {
  const sorted = [...baselineRows].sort((left, right) => (
    Number(left[metric]) - Number(right[metric])
    || left.provinceId.localeCompare(right.provinceId)
  ));
  const denominator = Math.max(1, sorted.length - 1);
  const ranks = new Map<string, number>();
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

const scores = baselineRows.map((row) => ({
  provinceId: row.provinceId,
  score:
    (pcePercentiles.get(row.provinceId) ?? 0) * provinceEconomicLevelPolicy.weights.pceMillions
    + (wagePercentiles.get(row.provinceId) ?? 0) * provinceEconomicLevelPolicy.weights.averageWeeklyWage
    + (populationPercentiles.get(row.provinceId) ?? 0) * provinceEconomicLevelPolicy.weights.population,
}));

const economicLevelByProvinceId = new Map<string, number>();
[...scores]
  .sort((left, right) => left.score - right.score || left.provinceId.localeCompare(right.provinceId))
  .forEach((row, index) => {
    economicLevelByProvinceId.set(
      row.provinceId,
      Math.min(levelCount, Math.floor(index * levelCount / Math.max(1, scores.length)) + 1),
    );
  });

const economicScoreByProvinceId = new Map(scores.map((row) => [row.provinceId, row.score]));

export function provinceEconomicLevelFor(provinceId: string) {
  return economicLevelByProvinceId.get(provinceId) ?? 1;
}

export function provinceEconomicScoreFor(provinceId: string) {
  return economicScoreByProvinceId.get(provinceId) ?? 0;
}

export const PROVINCE_ECONOMIC_LEVEL_COUNT = levelCount;
