import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createContractRuntimeIndex,
  getContractRuntimeIndexDiagnostics,
  resetContractRuntimeIndexDiagnostics,
} from '../src/contract-runtime-index.js';

function activeContract(id, buyerId, supplierId, quantityPerDelivery, overrides = {}) {
  return {
    id,
    publisherId: buyerId,
    buyerId,
    supplierId,
    status: 'active',
    quantityPerDelivery,
    completedDeliveries: 0,
    totalDeliveries: 4,
    nextDueAt: 2_000_000 + Number(id.replace(/\D/g, '') || 0),
    ...overrides,
  };
}

function referenceReserved(contracts, buyerId, exceptContractId = null) {
  return contracts.reduce((sum, contract) => {
    if (
      contract.status !== 'active'
      || Number(contract.buyerId) !== Number(buyerId)
      || contract.id === exceptContractId
      || contract.completedDeliveries >= contract.totalDeliveries
    ) return sum;
    return sum + contract.quantityPerDelivery;
  }, 0);
}

test('contract runtime index matches the reference reservation scan for 2000 contracts', () => {
  const world = { productionContracts: [] };
  for (let index = 0; index < 2_000; index += 1) {
    const buyerId = index % 40 + 1;
    const supplierId = index % 60 + 101;
    const status = index % 11 === 0 ? 'open' : index % 13 === 0 ? 'completed' : 'active';
    world.productionContracts.push(activeContract(
      `contract-${index}`,
      buyerId,
      supplierId,
      index % 9 + 1,
      {
        status,
        offerExpiresAt: status === 'open' ? 3_000_000 + index : undefined,
        nextDueAt: status === 'active' ? 2_000_000 + index : null,
      },
    ));
  }

  resetContractRuntimeIndexDiagnostics(world);
  const runtimeIndex = createContractRuntimeIndex(world);
  assert.equal(createContractRuntimeIndex(world), runtimeIndex);
  assert.equal(getContractRuntimeIndexDiagnostics(world).builds, 1);

  for (let buyerId = 1; buyerId <= 40; buyerId += 1) {
    assert.equal(
      runtimeIndex.reservedContractIncomingForBuyer(buyerId),
      referenceReserved(world.productionContracts, buyerId),
    );
    assert.equal(
      runtimeIndex.reservedIncomingForBuyer(buyerId),
      referenceReserved(world.productionContracts, buyerId),
    );
    const except = world.productionContracts.find((contract) => (
      contract.status === 'active' && contract.buyerId === buyerId
    ));
    if (except) {
      assert.equal(
        runtimeIndex.reservedContractIncomingForBuyer(buyerId, except.id),
        referenceReserved(world.productionContracts, buyerId, except.id),
      );
    }
  }
});

test('contract runtime transitions release and acquire counts without rebuilding', () => {
  const active = activeContract('active-1', 1, 2, 25);
  const open = {
    id: 'open-1',
    publisherId: 3,
    buyerId: 3,
    supplierId: null,
    status: 'open',
    quantityPerDelivery: 40,
    completedDeliveries: 0,
    totalDeliveries: 2,
    offerExpiresAt: 5_000,
  };
  const world = { productionContracts: [active, open] };
  resetContractRuntimeIndexDiagnostics(world);
  const runtimeIndex = createContractRuntimeIndex(world);
  assert.equal(createContractRuntimeIndex(world), runtimeIndex);

  assert.equal(runtimeIndex.reservedContractIncomingForBuyer(1), 25);
  assert.equal(runtimeIndex.activeCountForParticipant(1), 1);
  assert.equal(runtimeIndex.activeCountForParticipant(2), 1);
  assert.equal(runtimeIndex.openCountForPublisher(3), 1);

  runtimeIndex.transition(active, () => {
    active.status = 'completed';
    active.completedDeliveries = active.totalDeliveries;
  });
  assert.equal(runtimeIndex.reservedContractIncomingForBuyer(1), 0);
  assert.equal(runtimeIndex.activeCountForParticipant(1), 0);
  assert.equal(runtimeIndex.activeCountForParticipant(2), 0);

  runtimeIndex.transition(open, () => {
    open.status = 'active';
    open.buyerId = 3;
    open.supplierId = 4;
    open.nextDueAt = 4_000;
  });
  assert.equal(runtimeIndex.openCountForPublisher(3), 0);
  assert.equal(runtimeIndex.activeCountForParticipant(3), 1);
  assert.equal(runtimeIndex.activeCountForParticipant(4), 1);
  assert.equal(runtimeIndex.reservedContractIncomingForBuyer(3), 40);
  assert.equal(runtimeIndex.nextDeadlineAt(), 4_000);
  assert.equal(getContractRuntimeIndexDiagnostics(world).builds, 1);
});

test('contract runtime deadline reads a live grace deadline without rebuilding', () => {
  const contract = activeContract('active-1', 1, 2, 25, { nextDueAt: 1_000 });
  const world = { productionContracts: [contract] };
  resetContractRuntimeIndexDiagnostics(world);
  const runtimeIndex = createContractRuntimeIndex(world);

  assert.equal(runtimeIndex.nextDeadlineAt(), 1_000);
  contract.graceEndsAt = 5_000;
  assert.equal(createContractRuntimeIndex(world), runtimeIndex);
  assert.equal(runtimeIndex.nextDeadlineAt(), 5_000);
  assert.equal(getContractRuntimeIndexDiagnostics(world).builds, 1);
});

test('unified incoming reservation adds commodity orders and highest auction bids', () => {
  const world = {
    productionContracts: [activeContract('active-1', 1, 2, 25)],
    orders: [{
      id: 'buy-1',
      assetKind: 'commodity',
      assetId: 'wheat',
      productId: 'wheat',
      side: 'buy',
      ownerType: 'player',
      ownerId: 1,
      price: 1,
      quantity: 40,
      remaining: 40,
      status: 'open',
      createdAt: 1,
    }],
    assetAuctions: [{
      id: 'auction-1',
      status: 'open',
      escrowStatus: 'held',
      highestBidderId: 1,
      items: [{ assetKind: 'commodity', assetId: 'wheat', quantity: 30 }],
    }],
  };
  const runtimeIndex = createContractRuntimeIndex(world);
  assert.equal(runtimeIndex.reservedContractIncomingForBuyer(1), 25);
  assert.equal(runtimeIndex.reservedIncomingForBuyer(1), 95);
  assert.equal(runtimeIndex.reservedIncomingForBuyer(1, 'active-1'), 70);
});
