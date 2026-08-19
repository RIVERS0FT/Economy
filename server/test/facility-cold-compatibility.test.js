import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };
const now = 1_700_000_000_000;

test('current V2 cold load migrates retired facility transition state exactly once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-facility-cold-compat-'));
  const databasePath = join(directory, 'economy.sqlite');
  try {
    const seed = new EconomyStore(databasePath, { scheduledProcessing: false });
    seed.getState(alice, now);
    const metaBefore = seed.database.prepare(
      'SELECT revision, world_version, storage_schema_version FROM economy_world_meta WHERE id = 1',
    ).get();
    const row = seed.database.prepare(
      'SELECT state_json FROM economy_world_players WHERE user_id = 1',
    ).get();
    const player = JSON.parse(String(row.state_json));
    player.facilityGroups = [{
      facilityTypeId: 'machine-factory',
      provinceId: '110000',
      count: 2,
      participatingCount: 0,
      enabled: false,
      status: 'stopped',
      statusReason: 'manual',
      activeRecipeId: 'machine-factory-default',
      lifetimeOutput: 0,
      pendingJoinCount: Number.MAX_SAFE_INTEGER + 1,
    }];
    seed.database.prepare(
      'UPDATE economy_world_players SET state_json = ? WHERE user_id = 1',
    ).run(JSON.stringify(player));
    seed.close();

    const migrated = new EconomyStore(databasePath, { scheduledProcessing: true });
    migrated.stopScheduler();
    migrated.getState(alice, now + 1);
    const migratedGroup = migrated.worldCache.world.players['1'].facilityGroups[0];
    assert.equal(Object.hasOwn(migratedGroup, 'pendingJoinCount'), false);
    assert.equal(migratedGroup.count, 2);
    assert.equal(migratedGroup.participatingCount, 0);
    const metaAfter = migrated.database.prepare(
      'SELECT revision, world_version, storage_schema_version FROM economy_world_meta WHERE id = 1',
    ).get();
    assert.equal(Number(metaAfter.revision), Number(metaBefore.revision) + 1);
    assert.equal(Number(metaAfter.world_version), Number(metaBefore.world_version));
    assert.equal(Number(metaAfter.storage_schema_version), Number(metaBefore.storage_schema_version));
    const persisted = JSON.parse(String(migrated.database.prepare(
      'SELECT state_json FROM economy_world_players WHERE user_id = 1',
    ).get().state_json));
    assert.equal(Object.hasOwn(persisted.facilityGroups[0], 'pendingJoinCount'), false);
    migrated.close();

    const reopened = new EconomyStore(databasePath, { scheduledProcessing: true });
    reopened.stopScheduler();
    reopened.getState(alice, now + 2);
    const metaReopened = reopened.database.prepare(
      'SELECT revision, world_version, storage_schema_version FROM economy_world_meta WHERE id = 1',
    ).get();
    assert.deepEqual(metaReopened, metaAfter);
    assert.equal(Object.hasOwn(
      reopened.worldCache.world.players['1'].facilityGroups[0],
      'pendingJoinCount',
    ), false);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
