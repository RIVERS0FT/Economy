import {
  CURRENT_CLIENT_STATE_VERSION,
  isCompatibleClientStateVersion,
  MIN_COMPATIBLE_CLIENT_STATE_VERSION,
} from '../../shared/economy-state-version.js';

export const STATE_PARTITION_NAMES = Object.freeze([
  'catalog',
  'player',
  'market',
  'auction',
  'leaderboard',
]);

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

function describeVersion(value) {
  return Number.isInteger(value) ? String(value) : '无效值';
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
  for (const name of STATE_PARTITION_NAMES) Object.assign(state, partitions[name]);

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
    },
    getPartitionRevisions() {
      return { ...partitionRevisions };
    },
    accept(payload) {
      if (!payload || typeof payload !== 'object' || !validRevision(payload.revision)) return payload;
      if (revision !== null && payload.revision < revision) {
        return state ? { ...payload, state } : payload;
      }
      const incomingPartitionRevisions = validPartitionRevisions(payload.partitionRevisions);
      if (Object.keys(incomingPartitionRevisions).length > 0) partitionRevisions = incomingPartitionRevisions;
      if (payload.patches && Object.keys(payload.patches).length > 0) {
        const merged = mergeStatePatches(partitions, payload.patches);
        partitions = merged.partitions;
        state = merged.state;
      }
      revision = payload.revision;
      return state ? { ...payload, state } : payload;
    },
  };
}
