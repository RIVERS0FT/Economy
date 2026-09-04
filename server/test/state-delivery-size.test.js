import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import { createPartitionedStateDelivery } from '../src/state-partitions.js';
import {
  DEFAULT_PROVINCE_ID,
  PROVINCE_CATALOG,
  provinceScopedKey,
} from '../src/provinces.js';

const TWO_MIB = 2 * 1024 * 1024;

test('48-province initial state remains below two MiB without embedded market histories or retired cycle aliases', () => {
  const now = Date.UTC(2026, 7, 28, 12, 0, 0);
  const user = { id: 321, email: 'state-size@example.com', name: 'State Size', role: 'user' };
  const store = new EconomyStore(':memory:');
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    const commodityTemplates = Object.entries(loaded.world.markets)
      .filter(([key]) => key.startsWith(`${DEFAULT_PROVINCE_ID}:`));
    const facilityTemplates = Object.entries(loaded.world.facilityMarkets)
      .filter(([key]) => key.startsWith(`${DEFAULT_PROVINCE_ID}:`));
    for (const province of PROVINCE_CATALOG) {
      for (const [key, market] of commodityTemplates) {
        const assetId = key.slice(key.indexOf(':') + 1);
        const copy = structuredClone(market);
        copy.priceHistory = Array.from({ length: 24 }, (_, index) => ({
          price: 10 + index / 100,
          quantity: index + 1,
          createdAt: now - index * 60_000,
          takerSide: index % 2 === 0 ? 'buy' : 'sell',
          marketRole: 'must-not-ship',
          signalWeight: 99,
        }));
        loaded.world.markets[provinceScopedKey(province.id, assetId)] = copy;
      }
      for (const [key, market] of facilityTemplates) {
        const assetId = key.slice(key.indexOf(':') + 1);
        loaded.world.facilityMarkets[provinceScopedKey(province.id, assetId)] = structuredClone(market);
      }
    }
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const snapshot = store.getStateSnapshot(user, undefined, now + 2);
    const delivery = createPartitionedStateDelivery(snapshot, {}, now + 2);
    const serialized = JSON.stringify(delivery);
    assert.equal(Object.keys(snapshot.state.provinceMarkets).length, 48);
    assert.equal(serialized.includes('must-not-ship'), false);
    assert.equal(serialized.includes('priceHistory'), false);
    assert.equal(serialized.includes('cycleBuyQuantity'), false);
    assert.equal(serialized.includes('cycleSellQuantity'), false);
    assert.equal(typeof snapshot.state.provinceMarkets[DEFAULT_PROVINCE_ID].wheat.officialPrice, 'number');
    assert.equal(Buffer.byteLength(serialized) <= TWO_MIB, true, `initial state was ${Buffer.byteLength(serialized)} bytes`);
  } finally {
    store.close();
  }
});
