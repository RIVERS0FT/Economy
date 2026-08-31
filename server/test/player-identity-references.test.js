import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createWorld, applyAction, migrateWorld } from '../src/domain.js';
import { createProductionContractClientState, migrateProductionContractWorld } from '../src/contracts.js';
import { createAssetAuctionClientState } from '../src/asset-auctions.js';

function user(id) { return { id, username: `user-${id}` }; }

function findOwnOpenOrder(world, userId) {
  return (world.orders || []).find((order) => order.ownerType === 'player' && Number(order.ownerId) === Number(userId));
}

test('player business relationships persist stable ids instead of mutable names', () => {
  const now = 1_780_000_000_000;
  const world = createWorld(now);
  applyAction(world, user(101), 'ensurePlayer', {}, now);
  const player = world.players['101'];
  player.playerName = 'Alice';
  player.credits = 100_000;
  player.inventories.wheat.available = 100;

  const orderResult = applyAction(world, user(101), 'placeOrder', {
    side: 'sell', productId: 'wheat', quantity: 1, price: 10,
  }, now + 1);
  assert.equal(orderResult.ok, true);
  const order = findOwnOpenOrder(world, 101);
  assert.ok(order);
  assert.equal(order.ownerId, 101);
  assert.equal(Object.hasOwn(order, 'ownerName'), false);

  migrateProductionContractWorld(world);
  world.productionContracts.push({
    id: 'legacy-contract', kind: 'supply', publisherId: 101, publisherName: 'Old Alice',
    publisherRole: 'supplier', supplierId: 101, supplierName: 'Old Alice', buyerId: null,
    productId: 'wheat', quantityPerDelivery: 1, unitPrice: 10, deliveryIntervalMs: 3_600_000,
    totalDeliveries: 2, completedDeliveries: 0, firstDeliveryDelayMs: 0,
    createdAt: now, offerExpiresAt: now + 10_000, status: 'open',
  });
  migrateProductionContractWorld(world);
  const stored = world.productionContracts.find((contract) => contract.id === 'legacy-contract');
  assert.equal(Object.hasOwn(stored, 'publisherName'), false);
  assert.equal(Object.hasOwn(stored, 'supplierName'), false);
  let projected = createProductionContractClientState(world, 101, now).productionContracts
    .find((contract) => contract.id === 'legacy-contract');
  assert.equal(projected.publisherName, 'Alice');
  assert.equal(projected.supplierName, 'Alice');

  player.playerName = 'Alice Updated';
  projected = createProductionContractClientState(world, 101, now).productionContracts
    .find((contract) => contract.id === 'legacy-contract');
  assert.equal(projected.publisherName, 'Alice Updated');
  assert.equal(projected.supplierName, 'Alice Updated');
});

test('player auction client projection resolves seller name from sellerId', () => {
  const world = createWorld(1_780_000_000_000);
  applyAction(world, user(202), 'ensurePlayer', {}, 1_780_000_000_000);
  world.players['202'].playerName = 'Bob Current';
  world.assetAuctions = [{
    id: 'auction-player-id', auctionRuleVersion: 2,
    items: [{ assetKind: 'commodity', assetId: 'wheat', quantity: 1, provinceId: '110000' }],
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', quantity: 1,
    sellerType: 'player', sellerId: 202, startingBid: 1, reservePrice: null, minimumIncrement: 0.01,
    highestBid: null, highestBidderId: null, bidderAliases: {}, bids: [], bidCount: 0,
    status: 'open', escrowStatus: 'held', createdAt: 1_780_000_000_000,
    originalEndsAt: 1_780_000_100_000, endsAt: 1_780_000_100_000,
    extensionWindowMs: 120000, extensionDurationMs: 120000, maxExtensionMs: 1800000, extensionCount: 0,
    listingFee: 0, listingFeeStatus: 'none', sellerFeeBps: 100, buyerFeeBps: 0,
    sellerFee: null, sellerNetProceeds: null, settlementReason: null,
  }];
  let view = createAssetAuctionClientState(world, 202).assetAuctions[0];
  assert.equal(view.sellerName, 'Bob Current');
  world.players['202'].playerName = 'Bob Updated';
  view = createAssetAuctionClientState(world, 202).assetAuctions[0];
  assert.equal(view.sellerName, 'Bob Updated');
});

test('legacy mutable player identity mirrors are stripped during base world migration', () => {
  const now = 1_780_000_000_000;
  const world = createWorld(now);
  applyAction(world, user(303), 'ensurePlayer', {}, now);
  world.players['303'].trades = [{
    id: 'legacy-player-trade', type: 'commodity', productId: 'wheat',
    counterparty: 'Mutable Old Name', createdAt: now - 1,
  }];
  world.orders.push({
    id: 'legacy-player-order', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    provinceId: '110000', side: 'sell', ownerType: 'player', ownerId: 303,
    ownerName: 'Mutable Old Name', price: 10, quantity: 1, remaining: 0, status: 'filled',
    fills: [{ id: 'legacy-fill', counterparty: 'Another Mutable Name', createdAt: now - 1 }],
    createdAt: now - 2,
  });
  world.facilityListings.push({
    id: 'legacy-player-listing', facilityId: 'legacy-facility', ownerType: 'player', ownerId: 303,
    ownerName: 'Mutable Old Name', price: 100, createdAt: now - 2,
    facility: { id: 'legacy-facility', facilityTypeId: 'farm', outputProductId: 'wheat' },
  });

  migrateWorld(world, now + 1);

  assert.equal(Object.hasOwn(world.players['303'], 'trades'), false);
  const migratedOrder = world.orders.find((order) => order.id === 'legacy-player-order');
  assert.ok(migratedOrder);
  assert.equal(Object.hasOwn(migratedOrder, 'ownerName'), false);
  assert.equal(Object.hasOwn(migratedOrder.fills[0], 'counterparty'), false);
  const migratedListing = world.facilityListings.find((listing) => listing.id === 'legacy-player-listing');
  assert.ok(migratedListing);
  assert.equal(Object.hasOwn(migratedListing, 'ownerName'), false);
  const systemListing = world.facilityListings.find((listing) => listing.ownerType === 'market');
  assert.equal(systemListing?.ownerName, '系统资产市场');
});

test('base world migration keeps stable-id identity cleanup centrally wired', () => {
  const identitySource = readFileSync(new URL('../src/player-identity.js', import.meta.url), 'utf8');
  const domainSource = readFileSync(new URL('../src/domain.js', import.meta.url), 'utf8');
  assert.match(identitySource, /export function stripMutablePlayerIdentityMirrors\(world\)/);
  assert.match(domainSource, /stripMutablePlayerIdentityMirrors\(migrated\)/);
});
