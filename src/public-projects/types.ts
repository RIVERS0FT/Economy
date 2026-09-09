export type EconomicEventScope = 'global' | 'regional';

export interface RegionalEconomicEventView {
  id: string;
  templateId: string;
  scope?: EconomicEventScope;
  provinceId?: string;
  provinceName?: string;
  title: string;
  description: string;
  announcedAt: number;
  startsAt: number;
  endsAt: number;
  rampMs: number;
  demandMultiplierBps?: number;
  classLabels: string[];
  productIds: string[];
}

export type PublicProjectStatus = 'upcoming' | 'active' | 'completed' | 'expired';

export interface PublicProjectGoalView {
  productId: string;
  targetQuantity: number;
  contributedQuantity: number;
  completedAt: number | null;
}

export interface PublicProjectLeaderboardEntryView {
  rank: number;
  playerName: string;
  contributionValue: number;
  isCurrentPlayer: boolean;
}

export interface PublicProjectView {
  id: string;
  sourceEventId: string;
  provinceId: string;
  provinceName: string;
  title: string;
  description: string;
  announcedAt: number;
  startsAt: number;
  endsAt: number;
  status: PublicProjectStatus;
  goals: PublicProjectGoalView[];
  rewardPoolPoints: number;
  completedGoalCount: number;
  totalContributionValue: number;
  totalContributedQuantity: number;
  myContributionValue: number;
  myContributedQuantity: number;
  myProducts: Record<string, number>;
  rewardPointsClaimed: number;
  rewardPointsClaimable: number;
  leaderboard: PublicProjectLeaderboardEntryView[];
}

export interface PublicProjectCalendarState {
  version: number;
  points: number;
  projects: PublicProjectView[];
}

export interface ExtendedEconomicCalendarState {
  version: number;
  timeZone: 'Asia/Shanghai';
  events: RegionalEconomicEventView[];
  publicProjects?: PublicProjectCalendarState;
}
