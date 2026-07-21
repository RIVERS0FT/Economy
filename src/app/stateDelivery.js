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

export function mergeStatePatches(currentPartitions, patches) {
  const partitions = validPartitionSnapshot(currentPartitions) ? { ...currentPartitions } : {};
  if (validPartitionSnapshot(patches)) {
    for (const name of STATE_PARTITION_NAMES) {
      const patch = patches[name];
      if (validPartitionSnapshot(patch)) partitions[name] = { ...patch };
    }
  }

  const state = {};
  for (const name of STATE_PARTITION_NAMES) {
    const partition = partitions[name];
    if (validPartitionSnapshot(partition)) Object.assign(state, partition);
  }
  if (state.version !== 15 || !Number.isInteger(state.userId)) {
    throw new Error('服务器未返回完整的初始分区状态');
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
