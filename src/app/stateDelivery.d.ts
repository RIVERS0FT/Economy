import type { EconomyState } from '../types';

export type StatePartitionName = 'catalog' | 'player' | 'market' | 'auction' | 'leaderboard';
export type StatePartitionRevisions = Partial<Record<StatePartitionName, string>>;
export type StatePartitionSnapshots = Partial<Record<StatePartitionName, Partial<EconomyState>>>;
export type StatePartitionPatches = StatePartitionSnapshots;

export interface StateDeliveryEnvelope {
  revision: number;
  unchanged: boolean;
  serverNow: number;
  partitionRevisions?: StatePartitionRevisions;
  patches?: StatePartitionPatches;
}

export interface StatePatchMerge {
  partitions: StatePartitionSnapshots;
  state: EconomyState;
}

export const STATE_PARTITION_NAMES: readonly StatePartitionName[];
export function mergeStatePatches(
  currentPartitions: StatePartitionSnapshots | undefined,
  patches: StatePartitionPatches | undefined,
): StatePatchMerge;
export function createStateDeliveryCache(): {
  reset(): void;
  getPartitionRevisions(): StatePartitionRevisions;
  accept<T extends StateDeliveryEnvelope>(payload: T): T & { state?: EconomyState };
};
