import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';
import { DEFAULT_PROVINCE_ID, inventoryForProvince } from '../src/provinces.js';

const buyer = { id: 311, email: 'quote-buyer@example.com', name: 'Quote Buyer', role: 'user' };
const now = 1_700_300_000_000;

test('official-price missing-material quote is read-only and complete', () => {
  const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
  const store = new EconomyStore(':memory:');
  try {
    store.getState(buyer, now);
    const loaded = store.loadWorld(now + 1);
    const player = loaded.world.players[String(buyer.id)];
    for (const input of ranch.buildInputs) inventoryForProvince(player, input.productId, DEFAULT_PROVINCE_ID).available = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    const state = store.getState(buyer, now + 2);
    const before = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    const committedWorldBefore = JSON.stringify(store.worldCache.world);
    const orderCountBefore = store.worldCache.world.orders.length;

    const response = store.getFacilityBuildQuote(buyer, {
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
    }, now + 3);
    assert.equal(response.serverNow, now + 3);
    assert.equal(response.quote.complete, true);
    assert.ok(response.quote.estimatedTotal > 0);
    assert.equal(
      response.quote.missingQuantity,
      ranch.buildInputs.reduce((sum, input) => sum + input.quantity, 0),
    );
    assert.deepEqual(response.quote.unavailableProductIds, []);
    assert.deepEqual(response.quote.selfCrossingProductIds, []);
    for (const input of ranch.buildInputs) {
      assert.equal(response.quote.materialPriceCaps[input.productId], state.markets[input.productId].officialPrice);
      assert.equal(response.quote.materialOrderPrices[input.productId], state.markets[input.productId].officialPrice);
    }
    const expectedTotal = ranch.buildInputs.reduce((sum, input) => (
      sum + state.markets[input.productId].officialPrice * input.quantity
    ), 0);
    assert.equal(Number(response.quote.estimatedTotal.toFixed(6)), Number(expectedTotal.toFixed(6)));

    const repeated = store.getFacilityBuildQuote(buyer, {
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
    }, now + 4);
    assert.deepEqual(repeated.quote, response.quote);
    assert.equal(store.worldCache.world.orders.length, orderCountBefore, 'read-only quote must not create player commodity orders');
    const after = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    assert.deepEqual(after, before, 'read-only quote must not write the database');
    assert.equal(JSON.stringify(store.worldCache.world), committedWorldBefore, 'read-only quote must not mutate the committed in-memory world');

    assert.throws(() => store.getFacilityBuildQuote(buyer, {
      provinceId: DEFAULT_PROVINCE_ID, facilityTypeId: 'ranch', quantity: 0,
    }, now + 5), (error) => error.statusCode === 400);
    assert.throws(() => store.getFacilityBuildQuote(buyer, {
      provinceId: DEFAULT_PROVINCE_ID, facilityTypeId: 'missing', quantity: 1,
    }, now + 6), (error) => error.statusCode === 400);
    assert.throws(() => store.getFacilityBuildQuote(buyer, {
      provinceId: 'missing', facilityTypeId: 'ranch', quantity: 1,
    }, now + 7), (error) => error.statusCode === 404);
  } finally {
    store.close();
  }
});
