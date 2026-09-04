import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer, processWorld } from '../src/domain.js';
import { applyAssetAuctionAction, processAssetAuctions } from '../src/asset-auctions.js';
import { applyProductionContractAction, processProductionContracts } from '../src/contracts.js';
import { processMarketReserveOperations } from '../src/market-reserve-operations.js';

const now = 1_800_000_000_000;
const cycleMs = 5 * 60 * 1000;
const supplierUser = { id: 701, email: 'reserve-supplier@example.com', name: 'Reserve Supplier' };
const bidderUser = { id: 702, email: 'reserve-bidder@example.com', name: 'Reserve Bidder' };

function forceDemandCycle(world, groupId, cycleId) {
  world.marketDemand.groups[groupId].lastCycleId = cycleId;
}

function reserveFor(world, groupId = 'food', productId = 'wheat') {
  return world.marketDemand.liquidity.groups[groupId].reserves[productId];
}

function reserveGroup(world, groupId = 'food') {
  return world.marketDemand.liquidity.groups[groupId];
}

test('emergency reserve ask remains internal while player buying uses the daily system price', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, bidderUser, now);
  player.credits = 100_000;
  const reserve = reserveFor(world);
  reserve.inventory = 1;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 20;
  for (const state of Object.values(world.demandGroups)) {
    state.nextDemandAt = now;
    state.lastCycleId = Math.floor(now / cycleMs) - 1;
  }
  processWorld(world, now + 1);

  const emergency = world.orders.find((order) => (
    order.productId === 'wheat'
      && order.demandTier === 'liquidity-emergency-sell'
      && ['open', 'partial'].includes(order.status)
  ));
  assert.ok(emergency);
  assert.ok(emergency.price > Number(world.marketDemand.priceTransmission.products.wheat.referencePrice || 0));
  assert.ok(emergency.quantity <= Math.max(1, Math.ceil(reserve.targetInventory * 0.05)));
  const remainingBefore = emergency.remaining;
  const inventoryBefore = reserve.inventory;
  const frozenBefore = reserve.frozenInventory;

  const result = applyAction(world, bidderUser, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: emergency.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(emergency.remaining, remainingBefore);
  assert.ok(['open', 'partial'].includes(emergency.status));
  assert.equal(reserve.inventory, inventoryBefore);
  assert.equal(reserve.frozenInventory, frozenBefore);
  const latest = world.markets.wheat.priceHistory.at(-1);
  assert.equal(latest.marketRole, 'player');
  assert.equal(latest.signalWeight, 1);
}

test('two shortage cycles publish a fixed-term market reserve procurement contract and settle into reserve inventory', () => {
  const world = createWorld(now);
  const supplier = ensurePlayer(world, supplierUser, now);
  supplier.credits = 10_000;
  supplier.inventories.wheat.available = 100;
  const reserve = reserveFor(world);
  reserve.inventory = 1;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 20;
  reserveGroup(world).credits = 20_000;
  reserveGroup(world).frozenCredits = 0;

  forceDemandCycle(world, 'food', 100);
  processMarketReserveOperations(world, now);
  assert.equal(Boolean(world.productionContracts?.some((contract) => contract.publisherType === 'market_reserve')), false);
  forceDemandCycle(world, 'food', 101);
  processMarketReserveOperations(world, now + cycleMs);

  const contract = world.productionContracts.find((item) => item.publisherType === 'market_reserve' && item.productId === 'wheat');
  assert.ok(contract);
  assert.equal(contract.fixedTerms, true);
  assert.equal(contract.publisherId, 0);
  assert.equal(world.players['0'], undefined);
  const fundsBefore = reserveGroup(world).credits + reserveGroup(world).frozenCredits;
  const inventoryBefore = reserve.inventory + reserve.frozenInventory;

  const accepted = applyProductionContractAction(world, supplierUser, 'acceptProductionContract', {
    contractId: contract.id,
  }, now + cycleMs + 1);
  assert.equal(accepted.ok, true);
  const activeContract = world.productionContracts.find((item) => item.id === contract.id);
  assert.ok(activeContract);
  assert.equal(activeContract.status, 'active');
  assert.ok(activeContract.buyerEscrowCredits > 0);
  assert.ok(activeContract.buyerBondCredits > 0);
  assert.ok(reserveGroup(world).frozenCredits >= activeContract.buyerEscrowCredits + activeContract.buyerBondCredits);
  assert.equal(activeContract.negotiations.length, 0);

  processProductionContracts(world, Number(activeContract.nextDueAt) + 1);
  const settledContract = world.productionContracts.find((item) => item.id === contract.id);
  assert.ok(settledContract);
  assert.equal(settledContract.completedDeliveries, 1);
  assert.equal(reserve.inventory + reserve.frozenInventory, inventoryBefore + settledContract.quantityPerDelivery);
  assert.ok(reserveGroup(world).credits + reserveGroup(world).frozenCredits < fundsBefore);
  assert.ok(supplier.stats.contractGoodsSupplied >= settledContract.quantityPerDelivery);
});

test('three surplus cycles publish a real-inventory reserve auction and return net proceeds to reserve credits', () => {
  const world = createWorld(now);
  const bidder = ensurePlayer(world, bidderUser, now);
  bidder.credits = 100_000;
  const reserve = reserveFor(world);
  reserve.inventory = 40;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 10;
  const group = reserveGroup(world);
  group.credits = 10_000;
  group.frozenCredits = 0;

  for (let index = 0; index < 3; index += 1) {
    forceDemandCycle(world, 'food', 200 + index);
    processMarketReserveOperations(world, now + index * cycleMs);
  }
  const auction = world.assetAuctions.find((item) => item.sellerType === 'market_reserve' && item.productId === 'wheat');
  assert.ok(auction);
  assert.equal(auction.sellerId, 0);
  assert.equal(world.players['0'], undefined);
  assert.ok(reserve.frozenInventory >= auction.quantity);
  assert.ok(auction.quantity <= Math.max(1, Math.floor(reserve.targetInventory * 0.25)));

  const bid = applyAssetAuctionAction(world, bidderUser, 'placeAuctionBid', {
    auctionId: auction.id,
    amount: auction.reservePrice,
  }, now + 2 * cycleMs + 1);
  assert.equal(bid.ok, true);
  const reserveCreditsBeforeSettlement = group.credits;
  processAssetAuctions(world, Number(auction.endsAt) + 1);
  assert.equal(auction.status, 'sold');
  assert.ok(bidder.inventories.wheat.available >= auction.quantity);
  assert.ok(group.credits > reserveCreditsBeforeSettlement);
  assert.ok(reserve.lastAuctionSettledAt >= auction.endsAt);
});
