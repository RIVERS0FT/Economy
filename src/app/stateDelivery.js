import {
  CURRENT_CLIENT_STATE_VERSION,
  isCompatibleClientStateVersion,
  MIN_COMPATIBLE_CLIENT_STATE_VERSION,
} from '../../server/shared/economy-state-version.js';
import {
  STATE_SLICE_NAMES,
  STATE_SLICE_NAMES_BY_PARTITION,
  stateSliceNameForKey,
} from '../../server/shared/economy-state-slices.js';

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
  sliceRevisions: Object.freeze({}),
  changedPartitions: Object.freeze([]),
  changedSlices: Object.freeze([]),
});
let authoritySnapshot = EMPTY_AUTHORITY_SNAPSHOT;
let activeDeliveryCache = null;
const authorityListeners = new Set();
const partitionAuthorityListeners = new Map(
  STATE_PARTITION_NAMES.map((name) => [name, new Set()]),
);
const sliceAuthorityListeners = new Map(
  STATE_SLICE_NAMES.map((name) => [name, new Set()]),
);

export class StateDeliveryIntegrityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StateDeliveryIntegrityError';
    this.code = 'STATE_DELIVERY_INTEGRITY';
  }
}

function validRevision(value) {
  return Number.isInteger(value) && value >= 0;
}

function validRevisionToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

function validPartitionRevisions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(STATE_PARTITION_NAMES.flatMap((name) => {
    const revision = value[name];
    return validRevisionToken(revision) ? [[name, revision]] : [];
  }));
}

function validSliceRevisions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(STATE_SLICE_NAMES.flatMap((name) => {
    const revision = value[name];
    return validRevisionToken(revision) ? [[name, revision]] : [];
  }));
}

function validPartitionSnapshot(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function catalogIntegrityIssue(catalog) {
  if (!validPartitionSnapshot(catalog)) return 'catalog 分区缺失';
  if (!Number.isInteger(catalog.version)) return 'catalog.version 无效';
  for (const key of ['products', 'facilityTypes', 'commercialBuildingTypes', 'researchLevels', 'provinces']) {
    if (!Array.isArray(catalog[key])) return `catalog.${key} 不是有效数组`;
  }
  if (catalog.products.length === 0) return 'catalog.products 为空';
  if (catalog.facilityTypes.length === 0) return 'catalog.facilityTypes 为空';
  if (catalog.commercialBuildingTypes.length === 0) return 'catalog.commercialBuildingTypes 为空';
  if (catalog.researchLevels.length === 0) return 'catalog.researchLevels 为空';
  if (catalog.provinces.length === 0) return 'catalog.provinces 为空';
  if (typeof catalog.defaultProvinceId !== 'string' || !catalog.defaultProvinceId) {
    return 'catalog.defaultProvinceId 缺失';
  }
  const hasDefaultProvince = catalog.provinces.some((province) => (
    validPartitionSnapshot(province) && province.id === catalog.defaultProvinceId
  ));
  if (!hasDefaultProvince) return 'catalog.defaultProvinceId 不存在于 catalog.provinces';
  return '';
}

function changedPartitionNames(patches) {
  if (!validPartitionSnapshot(patches)) return [];
  return STATE_PARTITION_NAMES.filter((name) => validPartitionSnapshot(patches[name]));
}

function changedSliceNames(previousRevisions, incomingRevisions, changedPartitions) {
  const changed = [];
  for (const partitionName of changedPartitions) {
    const names = STATE_SLICE_NAMES_BY_PARTITION[partitionName] || [];
    if (names.length === 0) continue;
    const hasIncomingMetadata = names.some((name) => validRevisionToken(incomingRevisions[name]));
    if (!hasIncomingMetadata) {
      changed.push(...names);
      continue;
    }
    for (const name of names) {
      const incomingRevision = incomingRevisions[name];
      if (!validRevisionToken(incomingRevision) || previousRevisions[name] !== incomingRevision) {
        changed.push(name);
      }
    }
  }
  return changed;
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

function notifySliceListeners(names) {
  const listeners = new Set();
  for (const name of names) {
    const sliceListeners = sliceAuthorityListeners.get(name);
    if (sliceListeners) {
      for (const listener of sliceListeners) listeners.add(listener);
    }
    if (!name.endsWith('.misc')) continue;
    const partitionName = name.slice(0, name.indexOf('.'));
    for (const siblingName of STATE_SLICE_NAMES_BY_PARTITION[partitionName] || []) {
      const siblingListeners = sliceAuthorityListeners.get(siblingName);
      if (!siblingListeners) continue;
      for (const listener of siblingListeners) listeners.add(listener);
    }
  }
  for (const listener of listeners) listener();
}

function publishAuthority(revision, state, partitions, sliceRevisions, changedPartitions, changedSlices) {
  const previousState = authoritySnapshot.state;
  authoritySnapshot = {
    revision: validRevision(revision) ? revision : null,
    state: state || null,
    partitions: { ...(partitions || {}) },
    sliceRevisions: { ...(sliceRevisions || {}) },
    changedPartitions: Object.freeze([...(changedPartitions || [])]),
    changedSlices: Object.freeze([...(changedSlices || [])]),
  };
  for (const listener of [...authorityListeners]) listener();
  const clearing = state === null && previousState !== null;
  notifyPartitionListeners(clearing ? STATE_PARTITION_NAMES : (changedPartitions || []));
  notifySliceListeners(clearing ? STATE_SLICE_NAMES : (changedSlices || []));
}

export function getStateAuthoritySnapshot() {
  return authoritySnapshot;
}

export function getStateAuthorityPartition(name) {
  return authoritySnapshot.partitions?.[name] || null;
}

export function getStateAuthoritySliceRevision(name) {
  return authoritySnapshot.sliceRevisions?.[name] || null;
}

export function getActiveStatePartitionRevisions() {
  return activeDeliveryCache?.getPartitionRevisions?.() ?? {};
}

export function acceptExternalStateDelivery(payload) {
  if (!activeDeliveryCache) {
    throw new StateDeliveryIntegrityError('客户端权威状态尚未初始化');
  }
  return activeDeliveryCache.accept(payload);
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

export function subscribeStateAuthoritySlice(name, listener) {
  const listeners = sliceAuthorityListeners.get(name);
  if (!listeners || typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function subscribeStateAuthorityDependencies(names, listener) {
  if (typeof listener !== 'function') return () => {};
  const uniqueNames = [...new Set(Array.isArray(names) ? names : [])];
  const unsubscribers = uniqueNames.flatMap((name) => {
    if (partitionAuthorityListeners.has(name)) return [subscribeStateAuthorityPartition(name, listener)];
    if (sliceAuthorityListeners.has(name)) return [subscribeStateAuthoritySlice(name, listener)];
    return [];
  });
  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

function reuseUnchangedSliceReferences(
  currentPartitions,
  patches,
  previousSliceRevisions,
  incomingSliceRevisions,
) {
  if (!validPartitionSnapshot(patches)) return patches;
  const sharedPatches = { ...patches };
  for (const partitionName of ['player', 'market']) {
    const incomingPartition = patches[partitionName];
    const previousPartition = currentPartitions?.[partitionName];
    if (!validPartitionSnapshot(incomingPartition) || !validPartitionSnapshot(previousPartition)) continue;
    const nextPartition = { ...incomingPartition };
    for (const sliceName of STATE_SLICE_NAMES_BY_PARTITION[partitionName] || []) {
      const incomingRevision = incomingSliceRevisions[sliceName];
      if (!validRevisionToken(incomingRevision) || previousSliceRevisions[sliceName] !== incomingRevision) continue;
      const keys = new Set([
        ...Object.keys(previousPartition),
        ...Object.keys(nextPartition),
      ]);
      for (const key of keys) {
        if (stateSliceNameForKey(partitionName, key) !== sliceName) continue;
        if (Object.prototype.hasOwnProperty.call(previousPartition, key)) nextPartition[key] = previousPartition[key];
        else delete nextPartition[key];
      }
    }
    sharedPatches[partitionName] = nextPartition;
  }
  return sharedPatches;
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
    throw new StateDeliveryIntegrityError(`服务器未返回完整的初始分区状态：缺少 ${missingPartitions.join('、')} 分区`);
  }

  const catalogIssue = catalogIntegrityIssue(partitions.catalog);
  if (catalogIssue) {
    throw new StateDeliveryIntegrityError(`服务器返回的目录状态不完整：${catalogIssue}`);
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
    throw new StateDeliveryIntegrityError('服务器未返回有效的玩家状态');
  }
  return { partitions, state };
}

export function createStateDeliveryCache(options = {}) {
  const validateState = typeof options.validateState === 'function' ? options.validateState : null;
  let state = null;
  let revision = null;
  let partitionRevisions = {};
  let sliceRevisions = {};
  let partitions = {};

  const cache = {
    reset() {
      state = null;
      revision = null;
      partitionRevisions = {};
      sliceRevisions = {};
      partitions = {};
      publishAuthority(null, null, {}, {}, [], []);
    },
    getPartitionRevisions() {
      return { ...partitionRevisions };
    },
    getSliceRevisions() {
      return { ...sliceRevisions };
    },
    getSnapshot() {
      return {
        revision,
        state,
        partitions: { ...partitions },
        sliceRevisions: { ...sliceRevisions },
      };
    },
    accept(payload) {
      if (!payload || typeof payload !== 'object' || !validRevision(payload.revision)) return payload;
      if (revision !== null && payload.revision < revision) {
        return state
          ? { ...payload, state, stateChanged: false, changedPartitions: [], changedSlices: [] }
          : { ...payload, stateChanged: false, changedPartitions: [], changedSlices: [] };
      }
      const incomingPartitionRevisions = validPartitionRevisions(payload.partitionRevisions);
      const nextPartitionRevisions = Object.keys(incomingPartitionRevisions).length > 0
        ? incomingPartitionRevisions
        : partitionRevisions;
      const incomingSliceRevisions = validSliceRevisions(payload.sliceRevisions);
      const changedPartitions = changedPartitionNames(payload.patches);
      const changedSlices = changedSliceNames(sliceRevisions, incomingSliceRevisions, changedPartitions);
      if (state === null && changedPartitions.length === 0) {
        throw new StateDeliveryIntegrityError('服务器未返回完整的初始分区状态');
      }
      let nextPartitions = partitions;
      let nextState = state;
      const nextSliceRevisions = { ...sliceRevisions };
      if (changedPartitions.length > 0) {
        const sharedPatches = reuseUnchangedSliceReferences(
          partitions,
          payload.patches,
          sliceRevisions,
          incomingSliceRevisions,
        );
        const merged = mergeStatePatches(partitions, sharedPatches);
        nextPartitions = merged.partitions;
        nextState = merged.state;
      }
      for (const partitionName of ['player', 'market']) {
        if (!changedPartitions.includes(partitionName)) continue;
        for (const sliceName of STATE_SLICE_NAMES_BY_PARTITION[partitionName] || []) {
          const incomingRevision = incomingSliceRevisions[sliceName];
          if (validRevisionToken(incomingRevision)) nextSliceRevisions[sliceName] = incomingRevision;
          else delete nextSliceRevisions[sliceName];
        }
      }
      if (nextState && validateState) validateState(nextState);
      partitionRevisions = nextPartitionRevisions;
      sliceRevisions = nextSliceRevisions;
      partitions = nextPartitions;
      state = nextState;
      revision = payload.revision;
      publishAuthority(revision, state, partitions, sliceRevisions, changedPartitions, changedSlices);
      const acceptance = {
        ...payload,
        stateChanged: changedPartitions.length > 0,
        changedPartitions,
        changedSlices,
      };
      return state ? { ...acceptance, state } : acceptance;
    },
  };
  activeDeliveryCache = cache;
  return cache;
}
