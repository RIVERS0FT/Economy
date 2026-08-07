import type { EconomyState, EconomyStats } from './types';

export type LeaderboardBoardId = 'wealth' | 'growth' | 'production' | 'trading';
export type LeaderboardUnit = 'currency' | 'points' | 'quantity';

export interface RankedLeaderboardEntry {
  rank: number;
  playerName: string;
  score: number;
  secondary: number;
  detail?: string;
  isCurrentPlayer?: boolean;
  rewardGems?: number;
}

export interface LeaderboardPersonalBest {
  score: number;
  periodKey: string;
  currentIsRecord: boolean;
}

export interface RankedLeaderboardBoard {
  id: LeaderboardBoardId;
  title: string;
  description: string;
  unit: LeaderboardUnit;
  rewarded: boolean;
  entries: RankedLeaderboardEntry[];
  currentPlayer: RankedLeaderboardEntry | null;
  totalPlayers: number;
  personalBest?: LeaderboardPersonalBest | null;
}

export interface RankedLeaderboardsState {
  period: {
    key: string;
    startsAt: number;
    endsAt: number;
    partial: boolean;
    rewardEnabled: boolean;
    rewards: number[];
    timeZone: 'Asia/Shanghai';
  };
  boards: Record<LeaderboardBoardId, RankedLeaderboardBoard>;
}

type EconomyStatsWithLeaderboards = EconomyStats & {
  productionScore?: number;
  marketSellScore?: number;
  marketTradeCount?: number;
  gemExchangeCredits?: number;
  leaderboardGemsIssued?: number;
  leaderboards?: RankedLeaderboardsState;
};

export function leaderboardsFromGame(game: EconomyState) {
  return game.leaderboards ?? (game.stats as EconomyStatsWithLeaderboards).leaderboards;
}
