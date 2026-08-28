import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';
import {
  DEFAULT_PROVINCE_ID,
  inventoryForProvince,
  provinceScopedKey,
} from '../src/provinces.js';

const buyer = { id: 311, email: 'quote-buyer@example.com', name: 'Quote Buyer', role: 'user' };
const seller = { id: 312, email: 'quote-seller@example.com', name: 'Quote Seller', role: 'user' };
const now = 1_700_300_000_000;

function order(id, ownerId, productId, side, price, remaining, createdAt) {
  return {
    id,
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    ownerType: 'player',
    ownerId,
    ownerName: ownerId === buyer.id ? buyer.name : seller.name,
    side,
    price,
    quantity: remaining,
    remaining,
    status: 'open',
    createdAt,
    fills: [],
  };
}

test('facility build quote reads real depth without changing the authoritative world', () => {
  const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
  assert.deepEqual(ranch.buildInputs, [
    { productId: 'timber', quantity: 3 },
    { productId: 'ore', quantity: 2 },
  ]);
  const store = new EconomyStore(':memory:');
  try {
    store.getState(buyer, now);
    store.getState(seller, now + 1);
    const loaded = store.loadWorld(now + 2);
    const buyerPlayer = loaded.world.players[String(buyer.id)];
    inventoryForProvince(buyerPlayer, 'timber', DEFAULT_PROVINCE_ID).available = 0;
    inventoryForProvince(buyerPlayer, 'ore', DEFAULT_PROVINCE_ID).available = 0;
    loaded.world.orders = [
      order('own-timber', buyer.id, 'timber', 'sell', 60, 1, now + 10),
      order('timber-1', seller.id, 'timber', 'sell', 60, 1, now + 11),
      order('timber-2', seller.id, 'timber', 'sell', 61, 2, now + 12),
      order('ore-1', seller.id, 'ore', 'sell', 70, 2, now + 13),
    ];
    delete buyerPlayer.inventories[provinceScopedKey(DEFAULT_PROVINCE_ID, 'ore')];
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const before = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    const committedWorldBefore = JSON.stringify(store.worldCache.world);

    const response = store.getFacilityBuildQuote(buyer, {
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
    }, now + 20);
    assert.equal(response.serverNow, now + 20);
    assert.deepEqual(response.quote, {
      complete: true,
      estimatedTotal: 322,
      missingQuantity: 5,
      materialPriceCaps: { timber: 61, ore: 70 },
      materialOrderPrices: { timber: 60, ore: 70 },
      unavailableProductIds: [],
      selfCrossingProductIds: ['timber'],
    });

    const repeated = store.getFacilityBuildQuote(buyer, {
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
    }, now + 21);
    assert.deepEqual(repeated.quote, response.quote);
    const after = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    assert.deepEqual(after, before, 'read-only quote must not write the database');
    assert.equal(
      JSON.stringify(store.worldCache.world),
      committedWorldBefore,
      'read-only quote must not mutate the committed in-memory world',
    );

    assert.throws(
      () => store.getFacilityBuildQuote(buyer, {
        provinceId: DEFAULT_PROVINCE_ID,
        facilityTypeId: 'ranch',
        quantity: 0,
      }, now + 22),
      (error) => error.statusCode === 400,
    );
    assert.throws(
      () => store.getFacilityBuildQuote(buyer, {
        provinceId: DEFAULT_PROVINCE_ID,
        facilityTypeId: 'missing',
        quantity: 1,
      }, now + 23),
      (error) => error.statusCode === 400,
    );
    assert.throws(
      () => store.getFacilityBuildQuote(buyer, {
        provinceId: 'missing',
        facilityTypeId: 'ranch',
        quantity: 1,
      }, now + 24),
      (error) => error.statusCode === 404,
    );
  } finally {
    store.close();
  }
});
