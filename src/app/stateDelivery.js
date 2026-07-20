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

export function mergeStatePatches(currentState, patches) {
  const next = { ...(currentState || {}) };
  if (patches && typeof patches === 'object' && !Array.isArray(patches)) {
    for (const name of STATE_PARTITION_NAMES) {
      const patch = patches[name];
      if (patch && typeof patch === 'object' && !Array.isArray(patch)) Object.assign(next, patch);
    }
  }
  if (next.version !== 15 || !Number.isInteger(next.userId)) {
    throw new Error('服务器未返回完整的初始分区状态');
  }
  return next;
}

export function createStateDeliveryCache() {
  let state = null;
  let revision = null;
  let partitionRevisions = {};

  return {
    reset() {
      state = null;
      revision = null;
      partitionRevisions = {};
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
        state = mergeStatePatches(state, payload.patches);
      }
      revision = payload.revision;
      return state ? { ...payload, state } : payload;
    },
  };
}
