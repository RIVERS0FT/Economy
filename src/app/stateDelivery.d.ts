import type { EconomyState } from '../types';

export type StatePartitionName = 'catalog' | 'player' | 'market' | 'auction' | 'contract' | 'leaderboard';
export type StateSliceName =
  | 'player.identity'
  | 'player.assets'
  | 'player.production'
  | 'player.progression'
  | 'player.bank'
  | 'player.stats'
  | 'player.misc'
  | 'market.orders'
  | 'market.quotes'
  | 'market.calendar'
  | 'market.misc';
export type StateAuthorityDependency = StatePartitionName | StateSliceName;
export type StatePartitionRevisions = Partial<Record<StatePartitionName, string>>;
export type StateSliceRevisions = Partial<Record<StateSliceName, string>>;
export type StatePartitionSnapshots = Partial<Record<StatePartitionName, Partial<EconomyState>>>;
export type StatePartitionPatches = StatePartitionSnapshots;

export interface StateDeliveryEnvelope {
  revision: number;
  unchanged: boolean;
  serverNow: number;
  partitionRevisions?: StatePartitionRevisions;
  sliceRevisions?: StateSliceRevisions;
  patches?: StatePartitionPatches;
  stateChanged?: boolean;
  changedPartitions?: readonly StatePartitionName[];
  changedSlices?: readonly StateSliceName[];
}

export interface StatePatchMerge {
  partitions: StatePartitionSnapshots;
  state: EconomyState;
}

export interface StateAuthoritySnapshot {
  revision: number | null;
  state: EconomyState | null;
  partitions: StatePartitionSnapshots;
  sliceRevisions: StateSliceRevisions;
  changedPartitions: readonly StatePartitionName[];
  changedSlices: readonly StateSliceName[];
}

export interface StateDeliveryCacheOptions {
  validateState?: (state: EconomyState) => void;
}

export class StateDeliveryIntegrityError extends Error {
  readonly code: 'STATE_DELIVERY_INTEGRITY';
  constructor(message: string);
}

export const STATE_PARTITION_NAMES: readonly StatePartitionName[];
export function getStateAuthoritySnapshot(): StateAuthoritySnapshot;
export function getStateAuthorityPartition(name: StatePartitionName): Partial<EconomyState> | null;
export function getStateAuthoritySliceRevision(name: StateSliceName): string | null;
export function subscribeStateAuthority(listener: () => void): () => void;
export function subscribeStateAuthorityPartition(
  name: StatePartitionName,
  listener: () => void,
): () => void;
export function subscribeStateAuthorityPartitions(
  names: readonly StatePartitionName[],
  listener: () => void,
): () => void;
export function subscribeStateAuthoritySlice(
  name: StateSliceName,
  listener: () => void,
): () => void;
export function subscribeStateAuthorityDependencies(
  names: readonly StateAuthorityDependency[],
  listener: () => void,
): () => void;
export function mergeStatePatches(
  currentPartitions: StatePartitionSnapshots | undefined,
  patches: StatePartitionPatches | undefined,
): StatePatchMerge;
export function createStateDeliveryCache(options?: StateDeliveryCacheOptions): {
  reset(): void;
  getPartitionRevisions(): StatePartitionRevisions;
  getSliceRevisions(): StateSliceRevisions;
  getSnapshot(): {
    revision: number | null;
    state: EconomyState | null;
    partitions: StatePartitionSnapshots;
    sliceRevisions: StateSliceRevisions;
  };
  accept<T extends StateDeliveryEnvelope>(payload: T): T & {
    state?: EconomyState;
    stateChanged: boolean;
    changedPartitions: readonly StatePartitionName[];
    changedSlices: readonly StateSliceName[];
  };
};
