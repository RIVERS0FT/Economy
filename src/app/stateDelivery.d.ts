import type { EconomyState } from '../types';

export type StatePartitionName = 'catalog' | 'player' | 'market' | 'auction' | 'contract' | 'leaderboard';
export type StatePartitionRevisions = Partial<Record<StatePartitionName, string>>;
export type StatePartitionSnapshots = Partial<Record<StatePartitionName, Partial<EconomyState>>>;
export type StatePartitionPatches = StatePartitionSnapshots;

export interface StateDeliveryEnvelope {
  revision: number;
  unchanged: boolean;
  serverNow: number;
  partitionRevisions?: StatePartitionRevisions;
  patches?: StatePartitionPatches;
  stateChanged?: boolean;
  changedPartitions?: readonly StatePartitionName[];
}

export interface StatePatchMerge {
  partitions: StatePartitionSnapshots;
  state: EconomyState;
}

export interface StateAuthoritySnapshot {
  revision: number | null;
  state: EconomyState | null;
  partitions: StatePartitionSnapshots;
  changedPartitions: readonly StatePartitionName[];
}

export const STATE_PARTITION_NAMES: readonly StatePartitionName[];
export function getStateAuthoritySnapshot(): StateAuthoritySnapshot;
export function getStateAuthorityPartition(name: StatePartitionName): Partial<EconomyState> | null;
export function subscribeStateAuthority(listener: () => void): () => void;
export function subscribeStateAuthorityPartition(
  name: StatePartitionName,
  listener: () => void,
): () => void;
export function subscribeStateAuthorityPartitions(
  names: readonly StatePartitionName[],
  listener: () => void,
): () => void;
export function mergeStatePatches(
  currentPartitions: StatePartitionSnapshots | undefined,
  patches: StatePartitionPatches | undefined,
): StatePatchMerge;
export function createStateDeliveryCache(): {
  reset(): void;
  getPartitionRevisions(): StatePartitionRevisions;
  getSnapshot(): {
    revision: number | null;
    state: EconomyState | null;
    partitions: StatePartitionSnapshots;
  };
  accept<T extends StateDeliveryEnvelope>(payload: T): T & {
    state?: EconomyState;
    stateChanged: boolean;
    changedPartitions: readonly StatePartitionName[];
  };
};
