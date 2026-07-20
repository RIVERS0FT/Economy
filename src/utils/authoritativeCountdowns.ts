import { getCollectibleState } from '../collectibles/types';
import { leaderboardsFromGame } from '../leaderboardTypes';
import type { EconomyState } from '../types';

function addDeadline(deadlines: number[], value: unknown) {
  const deadline = Number(value);
  if (Number.isFinite(deadline) && deadline > 0) deadlines.push(deadline);
}

export function authoritativeCountdownDeadlines(game: EconomyState): number[] {
  const deadlines: number[] = [];

  addDeadline(deadlines, game.facilityConstruction?.completesAt);

  for (const group of game.facilityGroups) {
    if (group.status !== 'running' || !Number.isFinite(group.cycleStartedAt)) continue;
    const type = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
    const recipe = type?.recipes?.find((item) => item.id === group.activeRecipeId)
      ?? type?.recipes?.find((item) => item.id === type.defaultRecipeId)
      ?? type?.recipes?.[0];
    if (!recipe) continue;
    addDeadline(deadlines, Number(group.cycleStartedAt) + recipe.cycleMs);
  }

  for (const auction of getCollectibleState(game).assetAuctions) {
    if (auction.status === 'open') addDeadline(deadlines, auction.endsAt);
  }

  addDeadline(deadlines, leaderboardsFromGame(game)?.period.endsAt);

  return deadlines.sort((left, right) => left - right);
}

export function nextAuthoritativeCountdownDeadline(game: EconomyState): number | null {
  return authoritativeCountdownDeadlines(game)[0] ?? null;
}
