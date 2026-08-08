import { useSyncExternalStore } from 'react';
import type { EconomyState } from '../types';
import {
  getStateAuthorityPartition,
  getStateAuthoritySnapshot,
  subscribeStateAuthority,
  type StateAuthoritySnapshot,
  type StatePartitionName,
} from './stateDelivery.js';

const subscribe = (listener: () => void) => subscribeStateAuthority(listener);

export function getGameAuthoritySnapshot(): StateAuthoritySnapshot {
  return getStateAuthoritySnapshot();
}

export function useGameAuthorityState(): EconomyState | null {
  return useSyncExternalStore(
    subscribe,
    () => getStateAuthoritySnapshot().state,
    () => null,
  );
}

export function useGameAuthorityRevision(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => getStateAuthoritySnapshot().revision,
    () => null,
  );
}

export function useGameAuthorityPartition(
  name: StatePartitionName,
): Partial<EconomyState> | null {
  return useSyncExternalStore(
    subscribe,
    () => getStateAuthorityPartition(name),
    () => null,
  );
}
