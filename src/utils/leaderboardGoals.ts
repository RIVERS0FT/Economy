import type { RankedLeaderboardBoard } from '../leaderboardTypes';

export interface PersonalLeaderboardGoal {
  bandLabel: string;
  targetLabel: string;
  targetRank: number;
  distance: number;
}

function targetRank(totalPlayers: number, share: number) {
  return Math.max(1, Math.ceil(Math.max(1, totalPlayers) * share));
}

export function personalLeaderboardGoal(board: RankedLeaderboardBoard): PersonalLeaderboardGoal | null {
  const rank = Number(board.currentPlayer?.rank);
  const totalPlayers = Math.max(0, Number(board.totalPlayers) || 0);
  if (!Number.isInteger(rank) || rank <= 0 || totalPlayers <= 0) return null;

  const top50 = targetRank(totalPlayers, 0.5);
  const top25 = targetRank(totalPlayers, 0.25);
  const top10 = targetRank(totalPlayers, 0.1);
  const bandLabel = rank <= top10
    ? '前 10%'
    : rank <= top25
      ? '前 25%'
      : rank <= top50
        ? '前 50%'
        : '前 100%';

  let nextRank = 1;
  let targetLabel = '榜首';
  if (rank > top50) {
    nextRank = top50;
    targetLabel = '前 50%';
  } else if (rank > top25) {
    nextRank = top25;
    targetLabel = '前 25%';
  } else if (rank > top10) {
    nextRank = top10;
    targetLabel = '前 10%';
  } else if (rank > 3) {
    nextRank = Math.min(3, totalPlayers);
    targetLabel = '前三';
  } else if (rank === 1) {
    nextRank = 1;
    targetLabel = '保持榜首';
  }

  return {
    bandLabel,
    targetLabel,
    targetRank: nextRank,
    distance: Math.max(0, rank - nextRank),
  };
}
