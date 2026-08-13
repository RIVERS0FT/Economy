import { useCallback, useSyncExternalStore } from 'react';
import type { EconomyState } from '../types';
import {
  getStateAuthorityPartition,
  getStateAuthoritySnapshot,
  subscribeStateAuthority,
  subscribeStateAuthorityPartition,
  subscribeStateAuthorityPartitions,
  type StateAuthoritySnapshot,
  type StatePartitionName,
} from './stateDelivery.js';

const subscribe = (listener: () => void) => subscribeStateAuthority(listener);
const EMPTY_SELECTION_SNAPSHOT = Object.freeze({ ready: false, refs: Object.freeze([]) });
const selectionCache = new Map<string, {
  ready: boolean;
  refs: Array<Partial<EconomyState> | null>;
  snapshot: { ready: boolean; refs: readonly (Partial<EconomyState> | null)[] };
}>();

function normalizedSelectionNames(key: string): StatePartitionName[] {
  return key.split('|').filter(Boolean) as StatePartitionName[];
}

function selectionSnapshot(key: string) {
  const names = normalizedSelectionNames(key);
  const state = getStateAuthoritySnapshot().state;
  const ready = state !== null;
  const refs = names.map((name) => getStateAuthorityPartition(name));
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

function currentStateProperty(property: PropertyKey) {
  const state = getStateAuthoritySnapshot().state as Record<PropertyKey, unknown> | null;
  return state?.[property];
}

const AUTHORITY_STATE_VIEW = new Proxy<Record<PropertyKey, unknown>>({}, {
  get: (_target, property) => currentStateProperty(property),
  has: (_target, property) => {
    const state = getStateAuthoritySnapshot().state as Record<PropertyKey, unknown> | null;
    return Boolean(state && property in state);
  },
  ownKeys: () => Reflect.ownKeys(getStateAuthoritySnapshot().state ?? {}),
  getOwnPropertyDescriptor: (_target, property) => {
    const state = getStateAuthoritySnapshot().state as Record<PropertyKey, unknown> | null;
    if (!state || !(property in state)) return undefined;
    return {
      configurable: true,
      enumerable: true,
      writable: false,
      value: state[property],
    };
  },
  set: () => {
    throw new TypeError('权威游戏状态视图为只读');
  },
  deleteProperty: () => {
    throw new TypeError('权威游戏状态视图为只读');
  },
}) as EconomyState;

export function getGameAuthoritySnapshot(): StateAuthoritySnapshot {
  return getStateAuthoritySnapshot();
}

export function readGameAuthorityState(): EconomyState | null {
  return getStateAuthoritySnapshot().state;
}

export function useGameAuthorityState(): EconomyState | null {
  return useSyncExternalStore(
    subscribe,
    () => getStateAuthoritySnapshot().state,
    () => null,
  );
}

export function useGameAuthorityView(userId: number): EconomyState | null {
  const ready = useSyncExternalStore(
    subscribe,
    () => getStateAuthoritySnapshot().state?.userId === userId,
    () => false,
  );
  return ready ? AUTHORITY_STATE_VIEW : null;
}

export function useGameAuthorityPartitions(
  names: readonly StatePartitionName[],
): EconomyState | null {
  const key = names.join('|');
  const subscribeSelection = useCallback(
    (listener: () => void) => subscribeStateAuthorityPartitions(normalizedSelectionNames(key), listener),
    [key],
  );
  const getSelectionSnapshot = useCallback(() => selectionSnapshot(key), [key]);
  useSyncExternalStore(
    subscribeSelection,
    getSelectionSnapshot,
    () => EMPTY_SELECTION_SNAPSHOT,
  );
  return getStateAuthoritySnapshot().state;
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
