import {
  CURRENT_CLIENT_STATE_VERSION,
  isCompatibleClientStateVersion,
  MIN_COMPATIBLE_CLIENT_STATE_VERSION,
} from '../../server/shared/economy-state-version.js';

export const STATE_PARTITION_NAMES = Object.freeze([
  'catalog',
  'player',
  'market',
  'auction',
  'contract',
  'leaderboard',
]);

const EMPTY_AUTHORITY_SNAPSHOT = Object.freeze({
  revision: null,
  state: null,
  partitions: Object.freeze({}),
  changedPartitions: Object.freeze([]),
});
let authoritySnapshot = EMPTY_AUTHORITY_SNAPSHOT;
const authorityListeners = new Set();
const partitionAuthorityListeners = new Map(
  STATE_PARTITION_NAMES.map((name) => [name, new Set()]),
);

function validRevision(value) {
  return Number.isInteger(value) && value >= 0;
}

function validPartitionRevisions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(STATE_PARTITION_NAMES.flatMap((name) => {
    const revision = value[name];
    return typeof revision === 'string' && revision.length > 0 ? [[name, revision]] : [];
  }));
}

function validPartitionSnapshot(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function changedPartitionNames(patches) {
  if (!validPartitionSnapshot(patches)) return [];
  return STATE_PARTITION_NAMES.filter((name) => validPartitionSnapshot(patches[name]));
}

function describeVersion(value) {
  return Number.isInteger(value) ? String(value) : '无效值';
}

function notifyPartitionListeners(names) {
  const listeners = new Set();
  for (const name of names) {
    const partitionListeners = partitionAuthorityListeners.get(name);
    if (!partitionListeners) continue;
    for (const listener of partitionListeners) listeners.add(listener);
  }
  for (const listener of listeners) listener();
}

function publishAuthority(revision, state, partitions, changedPartitions) {
  const previousState = authoritySnapshot.state;
  authoritySnapshot = {
    revision: validRevision(revision) ? revision : null,
    state: state || null,
    partitions: { ...(partitions || {}) },
    changedPartitions: Object.freeze([...(changedPartitions || [])]),
  };
  for (const listener of [...authorityListeners]) listener();
  const partitionNotifications = state === null && previousState !== null
    ? STATE_PARTITION_NAMES
    : changedPartitions;
  notifyPartitionListeners(partitionNotifications || []);
}

export function getStateAuthoritySnapshot() {
  return authoritySnapshot;
}

export function getStateAuthorityPartition(name) {
  return authoritySnapshot.partitions?.[name] || null;
}

export function subscribeStateAuthority(listener) {
  if (typeof listener !== 'function') return () => {};
  authorityListeners.add(listener);
  return () => authorityListeners.delete(listener);
}

export function subscribeStateAuthorityPartition(name, listener) {
  const listeners = partitionAuthorityListeners.get(name);
  if (!listeners || typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeStateAuthorityPartitions(names, listener) {
  if (typeof listener !== 'function') return () => {};
  const uniqueNames = [...new Set((Array.isArray(names) ? names : []).filter(
    (name) => partitionAuthorityListeners.has(name),
  ))];
  const unsubscribers = uniqueNames.map((name) => subscribeStateAuthorityPartition(name, listener));
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export function mergeStatePatches(currentPartitions, patches) {
  const partitions = validPartitionSnapshot(currentPartitions) ? { ...currentPartitions } : {};
  if (validPartitionSnapshot(patches)) {
    for (const name of STATE_PARTITION_NAMES) {
      const patch = patches[name];
      if (validPartitionSnapshot(patch)) partitions[name] = { ...patch };
    }
  }

  const missingPartitions = STATE_PARTITION_NAMES.filter(
    (name) => !validPartitionSnapshot(partitions[name]),
  );
  if (missingPartitions.length > 0) {
    throw new Error(`服务器未返回完整的初始分区状态：缺少 ${missingPartitions.join('、')} 分区`);
  }

  const state = {};
  for (const name of STATE_PARTITION_NAMES) {
    const partition = partitions[name];
    Object.assign(state, partition);
  }

  if (!isCompatibleClientStateVersion(state.version)) {
    throw new Error(
      `客户端状态版本不兼容：支持 ${MIN_COMPATIBLE_CLIENT_STATE_VERSION}–${CURRENT_CLIENT_STATE_VERSION}，服务器返回 ${describeVersion(state.version)}`,
    );
  }
  if (!Number.isInteger(state.userId)) {
    throw new Error('服务器未返回有效的玩家状态');
  }
  return { partitions, state };
}

export function createStateDeliveryCache() {
  let state = null;
  let revision = null;
  let partitionRevisions = {};
  let partitions = {};

  return {
    reset() {
      state = null;
      revision = null;
      partitionRevisions = {};
      partitions = {};
      publishAuthority(null, null, {}, []);
    },
    getPartitionRevisions() {
      return { ...partitionRevisions };
    },
    getSnapshot() {
      return {
        revision,
        state,
        partitions: { ...partitions },
      };
    },
    accept(payload) {
      if (!payload || typeof payload !== 'object' || !validRevision(payload.revision)) return payload;
      if (revision !== null && payload.revision < revision) {
        return state
          ? { ...payload, state, stateChanged: false, changedPartitions: [] }
          : { ...payload, stateChanged: false, changedPartitions: [] };
      }
      const incomingPartitionRevisions = validPartitionRevisions(payload.partitionRevisions);
      if (Object.keys(incomingPartitionRevisions).length > 0) partitionRevisions = incomingPartitionRevisions;
      const changedPartitions = changedPartitionNames(payload.patches);
      if (changedPartitions.length > 0) {
        const merged = mergeStatePatches(partitions, payload.patches);
        partitions = merged.partitions;
        state = merged.state;
      }
      revision = payload.revision;
      publishAuthority(revision, state, partitions, changedPartitions);
      const acceptance = {
        ...payload,
        stateChanged: changedPartitions.length > 0,
        changedPartitions,
      };
      return state ? { ...acceptance, state } : acceptance;
    },
  };
}
