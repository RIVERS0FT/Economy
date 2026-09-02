import { useCallback, useRef, useSyncExternalStore } from 'react';
import type { EconomyState } from '../types';
import {
  getStateAuthorityPartition,
  getStateAuthoritySliceRevision,
  getStateAuthoritySnapshot,
  subscribeStateAuthority,
  subscribeStateAuthorityDependencies,
  subscribeStateAuthorityPartition,
  type StateAuthorityDependency,
  type StateAuthoritySnapshot,
  type StatePartitionName,
  type StateSliceName,
} from './stateDelivery.js';

const subscribe = (listener: () => void) => subscribeStateAuthority(listener);
const EMPTY_SELECTION_SNAPSHOT = Object.freeze({ ready: false, refs: Object.freeze([]) });
const selectionCache = new Map<string, {
  ready: boolean;
  refs: unknown[];
  snapshot: { ready: boolean; refs: readonly unknown[] };
}>();

function normalizedDependencyNames(key: string): StateAuthorityDependency[] {
  return key.split('|').filter(Boolean) as StateAuthorityDependency[];
}

function parentPartitionForSlice(name: StateSliceName): StatePartitionName {
  return name.startsWith('market.') ? 'market' : 'player';
}

function authorityDependencyReference(name: StateAuthorityDependency) {
  if (name.includes('.')) {
    const sliceName = name as StateSliceName;
    return getStateAuthoritySliceRevision(sliceName)
      ?? getStateAuthorityPartition(parentPartitionForSlice(sliceName));
  }
  return getStateAuthorityPartition(name as StatePartitionName);
}

function selectionSnapshot(key: string) {
  const names = normalizedDependencyNames(key);
  const state = getStateAuthoritySnapshot().state;
  const ready = state !== null;
  const refs = names.map(authorityDependencyReference);
  const cached = selectionCache.get(key);
  if (
    cached
    && cached.ready === ready
    && cached.refs.length === refs.length
    && cached.refs.every((value, index) => value === refs[index])
  ) return cached.snapshot;
  const snapshot = Object.freeze({ ready, refs: Object.freeze(refs) });
  selectionCache.set(key, { ready, refs, snapshot });
  return snapshot;
}

export function getGameAuthoritySnapshot(): StateAuthoritySnapshot {
  return getStateAuthoritySnapshot();
}

export function readGameAuthorityState(): EconomyState | null {
  return getStateAuthoritySnapshot().state;
}

function useAuthorityRenderSnapshot(readySelector: () => boolean): EconomyState | null {
  const ready = useSyncExternalStore(
    subscribe,
    readySelector,
    () => false,
  );
  // Keep the low-frequency readiness subscription, but return one accepted state
  // object for the whole render. A live Proxy can tear if authority is reset while
  // React is rendering and turn a previously valid catalog field into undefined.
  return ready ? readGameAuthorityState() : null;
}

export function useGameAuthorityState(): EconomyState | null {
  const currentState = useAuthorityRenderSnapshot(() => readGameAuthorityState() !== null);
  const retainedStateRef = useRef<EconomyState | null>(null);
  if (currentState) retainedStateRef.current = currentState;
  // Transport recovery may temporarily reset the shared delivery cache before a
  // full snapshot is accepted. A mounted ready game must keep rendering its last
  // accepted authority until the component itself crosses a real lifecycle boundary.
  return currentState ?? retainedStateRef.current;
}

export function useGameAuthorityView(userId: number): EconomyState | null {
  return useAuthorityRenderSnapshot(() => readGameAuthorityState()?.userId === userId);
}

export function useGameAuthorityDependencies(
  names: readonly StateAuthorityDependency[],
): EconomyState | null {
  const key = names.join('|');
  const subscribeSelection = useCallback(
    (listener: () => void) => subscribeStateAuthorityDependencies(normalizedDependencyNames(key), listener),
    [key],
  );
  const getSelectionSnapshot = useCallback(() => selectionSnapshot(key), [key]);
  useSyncExternalStore(
    subscribeSelection,
    getSelectionSnapshot,
    () => EMPTY_SELECTION_SNAPSHOT,
  );
  return readGameAuthorityState();
}

export function useGameAuthorityPartitions(
  names: readonly StatePartitionName[],
): EconomyState | null {
  return useGameAuthorityDependencies(names);
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
  const subscribePartition = useCallback(
    (listener: () => void) => subscribeStateAuthorityPartition(name, listener),
    [name],
  );
  return useSyncExternalStore(
    subscribePartition,
    () => getStateAuthorityPartition(name),
    () => null,
  );
}
