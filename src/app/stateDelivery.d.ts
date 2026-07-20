import type { EconomyState } from '../types';

export type StatePartitionName = 'catalog' | 'player' | 'market' | 'auction' | 'leaderboard';
export type StatePartitionRevisions = Partial<Record<StatePartitionName, string>>;
export type StatePartitionPatches = Partial<Record<StatePartitionName, Partial<EconomyState>>>;

export interface StateDeliveryEnvelope {
  revision: number;
  unchanged: boolean;
  partitionRevisions?: StatePartitionRevisions;
  patches?: StatePartitionPatches;
}

export const STATE_PARTITION_NAMES: readonly StatePartitionName[];
export function mergeStatePatches(
  currentState: EconomyState | null,
  patches: StatePartitionPatches | undefined,
): EconomyState;
export function createStateDeliveryCache(): {
  reset(): void;
  getPartitionRevisions(): StatePartitionRevisions;
  accept<T extends StateDeliveryEnvelope>(payload: T): T & { state?: EconomyState };
};
