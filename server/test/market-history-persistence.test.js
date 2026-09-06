import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkInDateKey } from '../src/daily-check-in.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import { EconomyStore } from '../src/runtime-store.js';

const DAY_MS = 24 * 60 * 60 * 1_000;
const now = 1_700_000_000_000;
const alice = { id: 611, email: 'market-history-restart@example.com', name: 'Market Restart' };

test('commodity official price, daily counters, and dailyHistory survive a process restart on the same SQLite database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-market-history-restart-'));
  const databasePath = join(directory, 'economy.sqlite');
  const marketKey = provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat');
  const todayKey = checkInDateKey(now);
  const yesterdayKey = checkInDateKey(now - DAY_MS);
  try {
    const first = new EconomyStore(databasePath, { scheduledProcessing: false });
    first.getState(alice, now);
    const revision = first.worldCache.revision;
    const world = structuredClone(first.worldCache.world);
    const market = world.markets[marketKey];
    market.officialPrice = 1.37;
    market.lastPrice = 1.37;
    market.priceDateKey = todayKey;
    market.todayBuyQuantity = 198_000_000;
    market.todaySellQuantity = 27_000_000;
    market.dailyHistory = [{
      dateKey: yesterdayKey,
      price: 1.34,
      buyQuantity: 120_000_000,
      sellQuantity: 20_000_000,
      volume: 140_000_000,
    }];
    const persistedRevision = first.saveWorld(revision, world, now + 1);
    assert.ok(persistedRevision > revision);
    const storedSegment = JSON.parse(String(first.database.prepare(
      "SELECT state_json FROM economy_world_segments WHERE segment_key = 'markets'",
    ).get().state_json));
    assert.equal(storedSegment[marketKey].dailyHistory[0].dateKey, yesterdayKey);
    first.close();

    const second = new EconomyStore(databasePath, { scheduledProcessing: false });
    try {
      second.getState(alice, now + 2);
      const restored = second.worldCache.world.markets[marketKey];
      assert.equal(second.worldCache.revision, persistedRevision);
      assert.equal(restored.officialPrice, 1.37);
      assert.equal(restored.priceDateKey, todayKey);
      assert.equal(restored.todayBuyQuantity, 198_000_000);
      assert.equal(restored.todaySellQuantity, 27_000_000);
      assert.deepEqual(restored.dailyHistory, [{
        dateKey: yesterdayKey,
        price: 1.34,
        buyQuantity: 120_000_000,
        sellQuantity: 20_000_000,
        volume: 140_000_000,
      }]);
    } finally {
      second.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
