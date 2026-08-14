import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);

function replaceOnce(path, before, after) {
  const source = read(path);
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`${path}: missing target:\n${before.slice(0, 300)}`);
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`${path}: target not unique`);
  write(path, source.slice(0, index) + after + source.slice(index + before.length));
}

replaceOnce(
  'server/src/world-storage-v2.js',
  `export function writeFullSegmentedWorld(store, revision, world, now) {`,
  `export function segmentedSnapshotsEqual(left, right) {
  if (!left || !right) return false;
  if (left.playerStateJsonById?.size !== right.playerStateJsonById?.size) return false;
  if (left.segmentStateJsonByKey?.size !== right.segmentStateJsonByKey?.size) return false;
  for (const [key, value] of left.playerStateJsonById || []) {
    if (right.playerStateJsonById?.get(key) !== value) return false;
  }
  for (const [key, value] of left.segmentStateJsonByKey || []) {
    if (right.segmentStateJsonByKey?.get(key) !== value) return false;
  }
  return true;
}

export function writeFullSegmentedWorld(store, revision, world, now) {`,
);

replaceOnce(
  'server/src/world-storage-v2.js',
  `    store.upsertWorldMetaV2.run(
      Number(revision),
      Number(world?.version || 0),
      WORLD_STORAGE_SCHEMA_VERSION,
      now,
    );
  });
  publishSnapshotGauges(snapshot);`,
  `    store.upsertWorldMetaV2.run(
      Number(revision),
      Number(world?.version || 0),
      WORLD_STORAGE_SCHEMA_VERSION,
      now,
    );
    store.updateLegacyWorldManifestV2.run(
      Number(revision),
      legacyManifest(world),
      now,
    );
  });
  publishSnapshotGauges(snapshot);`,
);

replaceOnce(
  'server/src/storage.js',
  `  readSegmentedWorld,
  snapshotSegmentedWorld,
  writeFullSegmentedWorld,`,
  `  readSegmentedWorld,
  segmentedSnapshotsEqual,
  snapshotSegmentedWorld,
  writeFullSegmentedWorld,`,
);

replaceOnce(
  'server/src/storage.js',
  `      this.worldCache
      && player
      && (this.scheduledProcessing || now < this.nextWorldProcessingAt)`,
  `      this.worldCache
      && !this.worldCache.needsPersistence
      && player
      && (this.scheduledProcessing || now < this.nextWorldProcessingAt)`,
);

replaceOnce(
  'server/src/storage.js',
  `    const segmented = readSegmentedWorld(this);
    if (segmented) {
      const world = this.migrateLoadedWorld(segmented.world, now);
      const snapshot = writeFullSegmentedWorld(this, segmented.revision, world, now);
      this.cacheWorld(segmented.revision, null, world, false, snapshot);
      return {
        revision: segmented.revision,
        stateJson: null,
        world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),
      };
    }`,
  `    const segmented = readSegmentedWorld(this);
    if (segmented) {
      const world = this.migrateLoadedWorld(segmented.world, now);
      const migratedSnapshot = snapshotSegmentedWorld(world);
      const needsPersistence = !segmentedSnapshotsEqual(segmented.snapshot, migratedSnapshot);
      this.cacheWorld(
        segmented.revision,
        null,
        world,
        needsPersistence,
        needsPersistence ? segmented.snapshot : migratedSnapshot,
      );
      return {
        revision: segmented.revision,
        stateJson: null,
        world: measureRequestPhase('worldCloneMs', () => structuredClone(world)),
      };
    }`,
);

replaceOnce(
  'server/src/storage.js',
  `    const persistedStateJson = String(row.state_json);
    const world = this.migrateLoadedWorld(migrateWorld(JSON.parse(persistedStateJson), now), now);
    const revision = Number(row.revision);
    const snapshot = writeFullSegmentedWorld(this, revision, world, now);
    this.cacheWorld(revision, null, world, false, snapshot);
    setRequestGauge('legacyWorldJsonBytes', Buffer.byteLength(persistedStateJson));
    return { revision, stateJson: null, world: measureRequestPhase('worldCloneMs', () => structuredClone(world)) };`,
  `    const persistedStateJson = String(row.state_json);
    const persistedWorld = JSON.parse(persistedStateJson);
    const world = this.migrateLoadedWorld(migrateWorld(structuredClone(persistedWorld), now), now);
    const migratedStateJson = measureRequestPhase('legacyWorldMigrationCompareMs', () => JSON.stringify(world));
    const revision = Number(row.revision) + (migratedStateJson === persistedStateJson ? 0 : 1);
    const snapshot = writeFullSegmentedWorld(this, revision, world, now);
    this.cacheWorld(revision, null, world, false, snapshot);
    setRequestGauge('legacyWorldJsonBytes', Buffer.byteLength(persistedStateJson));
    return { revision, stateJson: null, world: measureRequestPhase('worldCloneMs', () => structuredClone(world)) };`,
);

replaceOnce(
  'server/src/storage.js',
  `    if (
      normalizedKnownRevision !== undefined
      && this.worldCache
      && normalizedKnownRevision === this.worldCache.revision
      && (this.scheduledProcessing || now < this.nextWorldProcessingAt)
      && !playerNeedsWeeklyLoginSettlement(this.worldCache.world.players?.[String(user.id)], now)
    ) {
      return { revision: normalizedKnownRevision, unchanged: true };
    }

    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      const playerId = String(user.id);
      const playerWasPresent = Boolean(world.players?.[playerId]);`,
  `    if (this.canReuseStateProjection(user.id, now)) {
      const currentRevision = Number(this.worldCache.revision);
      if (normalizedKnownRevision !== undefined && normalizedKnownRevision === currentRevision) {
        return { revision: currentRevision, unchanged: true };
      }
      const playerId = String(user.id);
      return {
        revision: currentRevision,
        unchanged: false,
        state: measureRequestPhase('stateProjectionMs', () => normalizeJson(createVersionedClientState(
          this.worldCache.world,
          Number(user.id),
          now,
          this.dailyCheckInSummaryFor(this.worldCache.world.players[playerId], now),
        ))),
      };
    }

    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      const playerId = String(user.id);
      const playerWasPresent = Boolean(world.players?.[playerId]);
      if (
        playerWasPresent
        && !this.worldCache?.needsPersistence
        && (this.scheduledProcessing || now < this.nextWorldProcessingAt)
        && !playerNeedsWeeklyLoginSettlement(world.players?.[playerId], now)
      ) {
        const currentRevision = Number(this.worldCache?.revision ?? revision);
        if (normalizedKnownRevision !== undefined && normalizedKnownRevision === currentRevision) {
          return { revision: currentRevision, unchanged: true };
        }
        const committedWorld = this.worldCache?.world || world;
        return {
          revision: currentRevision,
          unchanged: false,
          state: measureRequestPhase('stateProjectionMs', () => normalizeJson(createVersionedClientState(
            committedWorld,
            Number(user.id),
            now,
            this.dailyCheckInSummaryFor(committedWorld.players[playerId], now),
          ))),
        };
      }`,
);

console.log('segmented world storage cold-read fix applied');
