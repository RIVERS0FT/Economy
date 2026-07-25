import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyProductionContractAction } from '../src/contracts.js';
import { createContractRuntimeIndex } from '../src/contract-runtime-index.js';
import { createWarehouseUsage } from '../src/warehouse.js';

const now = 1_800_000_000_000;
const buyerUser = { id: 101, email: 'buyer@example.com', name: '采购方' };
const supplierUser = { id: 202, email: 'supplier@example.com', name: '供应方' };

function commodityBuyOrder(ownerId, quantity) {
  return {
    id: `unified-buy-${ownerId}-${quantity}`,
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    side: 'buy',
    ownerType: 'player',
    ownerId,
    ownerName: `玩家 ${ownerId}`,
    price: 1,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  };
}

function highestBidAuction(userId, quantity) {
  return {
    id: `unified-auction-${userId}-${quantity}`,
    status: 'open',
    escrowStatus: 'held',
    highestBidderId: userId,
    items: [{ assetKind: 'commodity', assetId: 'wheat', quantity }],
  };
}

function activeContract(id, buyerId, supplierId, quantityPerDelivery) {
  return {
    id,
    publisherId: buyerId,
    buyerId,
    supplierId,
    status: 'active',
    quantityPerDelivery,
    completedDeliveries: 0,
    totalDeliveries: 2,
    nextDueAt: now + 60_000,
  };
}

test('warehouse usage combines inventory, buy orders, highest bids, and active contract next batches', () => {
  const world = createWorld(now);
  const buyer = ensurePlayer(world, buyerUser, now);
  buyer.inventoryCapacity = 500;
  buyer.inventories.wheat.available = 10;
  world.orders.push(commodityBuyOrder(buyerUser.id, 40));
  world.assetAuctions = [highestBidAuction(buyerUser.id, 30)];
  world.productionContracts = [
    activeContract('unified-contract-a', buyerUser.id, 202, 50),
    activeContract('unified-contract-b', buyerUser.id, 303, 20),
  ];

  const usage = createWarehouseUsage(world, buyer);
  assert.equal(usage.warehouseStoredQuantity, 10);
  assert.equal(usage.warehouseReservedQuantity, 140);
  assert.equal(usage.warehouseUsedCapacity, 150);
  assert.equal(usage.warehouseAvailableCapacity, 350);

  const runtimeIndex = createContractRuntimeIndex(world);
  const excludingCurrent = createWarehouseUsage(world, buyer, {
    contractRuntimeIndex: runtimeIndex,
    exceptContractId: 'unified-contract-a',
  });
  assert.equal(excludingCurrent.warehouseReservedQuantity, 90);
  assert.equal(excludingCurrent.warehouseAvailableCapacity, 400);
});

test('contract acceptance rejects capacity already reserved by buy orders and highest bids', () => {
  const world = createWorld(now);
  const buyer = ensurePlayer(world, buyerUser, now);
  const supplier = ensurePlayer(world, supplierUser, now);
  buyer.credits = 100_000;
  supplier.credits = 100_000;
  supplier.inventories.wheat.available = 1_000;
  buyer.inventoryCapacity = 500;
  buyer.inventories.wheat.available = 400;
  world.orders.push(commodityBuyOrder(buyerUser.id, 50));
  world.assetAuctions = [highestBidAuction(buyerUser.id, 30)];

  const created = applyProductionContractAction(world, buyerUser, 'createProductionContract', {
    publisherRole: 'buyer',
    productId: 'wheat',
    quantityPerDelivery: 25,
    unitPrice: 2,
    deliveryIntervalMs: 10 * 60 * 1000,
    totalDeliveries: 2,
    firstDeliveryDelayMs: 0,
  }, now);
  assert.equal(created.ok, true);
  const contract = world.productionContracts[0];

  const accepted = applyProductionContractAction(world, supplierUser, 'acceptProductionContract', {
    contractId: contract.id,
  }, now + 1);
  assert.equal(accepted.ok, false);
  assert.equal(accepted.message, '采购方仓库无法容纳下一批商品');
  assert.equal(contract.status, 'open');
});
