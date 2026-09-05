import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import { createProductionSettlementBasis } from '../src/production-settlement.js';
import { createProductionSettlementClaim } from '../../shared/production-settlement.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { ensurePlayer } from '../src/domain.js';
import { freezeCommodity, frozenForSource } from '../src/commodity-freezes.js';
import { reconcileBuildingInputFreezes } from '../src/building-input-freezes.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { CONTRACT_DAY_MS, CONTRACT_DAY_OFFSET_MS } from '../src/daily-supply-contracts.js';

const now = 1_850_000_000_000;
const region = '110000';
const user = { id: 1, email: 'cycle-runtime@example.test', role: 'user' };
function setup({ contract = false } = {}) {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  store.getState(user, now); store.stopScheduler();
  const world = store.worldCache.world;
  const player = world.players['1'];
  player.credits = 1_000; player.provinceAutoSaleEnabled = { [region]: true };
  const wheat = inventoryForProvince(player, 'wheat', region); wheat.available = 2;
  player.facilityGroups = [{ provinceId: region, facilityTypeId: 'mill', count: 1, participatingCount: 1,
    enabled: true, status: 'running', activeRecipeId: 'mill-default', lifetimeOutput: 0, cycleStartedAt: now,
    staffingRateBps: 10_000, staffingUpdatedAt: now, staffingBatchCarryBps: 0 }];
  migrateFacilityGroupWorld(world, now);
  world.markets[provinceScopedKey(region, 'wheat')].officialPrice = 5;
  world.markets[provinceScopedKey(region, 'flour')].officialPrice = 25;
  const fruit = inventoryForProvince(player, 'fruit', region); fruit.available = 6;
  // A stale production hold becomes sellable only during reconciliation. Its market must be cloned too.
  freezeCommodity(fruit, 'production', `${region}:removed-building`, 6);
  if (contract) {
    const supplier = ensurePlayer(world, { id: 2, email: 'cycle-supplier@example.test', name: 'Supplier' }, now);
    const supplied = inventoryForProvince(supplier, 'wheat', region); supplied.available = 4;
    freezeCommodity(supplied, 'contract', 'cycle-supply', 4);
    player.frozenCredits = Number(player.frozenCredits || 0) + 16;
    world.productionContracts = [{ id: 'cycle-supply', kind: 'supply', supplyMode: 'daily', contractSchemaVersion: 11,
      publisherId: 1, publisherRole: 'buyer', buyerId: 1, supplierId: 2, provinceId: region, productId: 'wheat',
      dailyMaxQuantity: 4, unitPrice: 4, durationDays: 30, startDelayDays: 0, status: 'active', createdAt: now - 1000,
      acceptedAt: now - 1000, startsAt: now - 1000, endsAt: now + CONTRACT_DAY_MS * 30,
      currentDayKey: Math.floor((now + CONTRACT_DAY_OFFSET_MS) / CONTRACT_DAY_MS), dailyUsedQuantity: 0,
      totalDeliveredQuantity: 0, completedDeliveryEvents: 0, buyerEscrowCredits: 16, supplierReservedQuantity: 4,
      buyerBondCredits: 0, supplierBondCredits: 0, buyerAutoFund: false, supplierAutoReserve: false,
      prioritySupply: { enabled: false, minDailyProduction: 0, minContractPrice: 0 }, negotiations: [] }];
  }
  const baselineRevision = store.worldCache.revision;
  store.transaction(() => store.saveWorldIfChanged(baselineRevision, world, now)); store.stopScheduler();
  const dueAt = now + createProductionSettlementBasis(world, user.id, now).groups[0].recipe.cycleMs;
  return { store, dueAt };
}
function request(store, dueAt, key = 'cycle-runtime') {
  return { action: 'settleProduction', requestKey: key, method: 'POST', path: '/api/game/production/settle',
    payload: { productionSettlement: createProductionSettlementClaim(createProductionSettlementBasis(store.worldCache.world, user.id, dueAt)) } };
}
function databaseState(store) {
  return {
    meta: store.database.prepare('SELECT * FROM economy_world_meta').all(),
    players: store.database.prepare('SELECT * FROM economy_world_players ORDER BY user_id').all(),
    segments: store.database.prepare('SELECT * FROM economy_world_segments ORDER BY segment_key').all(),
    audit: store.database.prepare('SELECT * FROM economy_contract_audit_events ORDER BY contract_id, sequence').all(),
  };
}

test('scheduled cycle transaction persists market, own-source freezes and contract counterparty together', () => {
  const { store, dueAt } = setup({ contract: true });
  try {
    const meta = request(store, dueAt);
    const response = store.apply(user, meta, dueAt); store.stopScheduler();
    assert.equal(response.result.ok, true);
    const world = store.worldCache.world;
    const buyer = world.players['1']; const supplier = world.players['2'];
    assert.equal(buyer.facilityGroups[0].lifetimeOutput, 1);
    assert.equal(world.productionContracts[0].totalDeliveredQuantity, 4);
    assert.equal(frozenForSource(inventoryForProvince(buyer, 'wheat', region), 'production', `${region}:mill`), 4);
    assert.equal(inventoryForProvince(supplier, 'wheat', region).frozen, 0);
    assert.equal(inventoryForProvince(buyer, 'fruit', region).available, 0);
    assert.ok(world.markets[provinceScopedKey(region, 'fruit')].todaySellQuantity >= 6);
    assert.ok(databaseState(store).audit.length > 0);
    const before = JSON.stringify(world); const db = databaseState(store);
    assert.deepEqual(store.apply(user, meta, dueAt), response);
    assert.equal(JSON.stringify(store.worldCache.world), before);
    assert.deepEqual(databaseState(store), db);
  } finally { store.close(); }
});

test('rejected player action cannot leak preliminary cycle trades into cached market or contract state', () => {
  const { store, dueAt } = setup({ contract: true });
  try {
    const before = JSON.stringify(store.worldCache.world); const db = databaseState(store);
    const response = store.apply(user, { action: 'bankDeposit', payload: { amount: 1_000_000_000 },
      requestKey: 'reject-cycle-body', method: 'POST', path: '/api/game/bank/deposit' }, dueAt);
    assert.equal(response.result.ok, false);
    assert.equal(JSON.stringify(store.worldCache.world), before);
    assert.deepEqual(databaseState(store), db);
    assert.equal(store.apply(user, request(store, dueAt, 'after-rejection'), dueAt).result.ok, true);
  } finally { store.close(); }
});

test('SQLite write failure rolls back cycle completion, market volume, supplier custody, audit and idempotency', () => {
  const { store, dueAt } = setup({ contract: true });
  try {
    const meta = request(store, dueAt, 'cycle-write-failure');
    const before = JSON.stringify(store.worldCache.world); const db = databaseState(store);
    store.database.exec("CREATE TRIGGER reject_cycle_commit BEFORE UPDATE ON economy_world_players BEGIN SELECT RAISE(ABORT, 'injected cycle persistence failure'); END;");
    assert.throws(() => store.apply(user, meta, dueAt), /injected cycle persistence failure/);
    assert.equal(JSON.stringify(store.worldCache.world), before);
    assert.deepEqual(databaseState(store), db);
    assert.equal(store.selectIdempotency.get(user.id, meta.requestKey), undefined);
    store.database.exec('DROP TRIGGER reject_cycle_commit');
    assert.equal(store.apply(user, meta, dueAt).result.ok, true);
  } finally { store.close(); }
});
