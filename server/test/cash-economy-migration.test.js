import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { inventoryForProvince } from '../src/provinces.js';
import { freezeCommodity } from '../src/commodity-freezes.js';
import { EconomyStore } from '../src/runtime-store.js';
import { commodityInvestmentQuote } from '../src/commodity-investment-prices.js';
import { planCashEconomyMigration, applyCashEconomyMigration } from '../src/cash-economy-migration.js';

const NOW = Date.parse('2026-09-10T08:00:00Z');
function setup() {
  const world = createWorld(NOW);
  const a = ensurePlayer(world, { id: 910, name: 'migration-a' }, NOW);
  const b = ensurePlayer(world, { id: 911, name: 'migration-b' }, NOW);
  a.credits = 10000; b.credits = 10000;
  const wheat = inventoryForProvince(a, 'wheat', '110000'); wheat.available = 100;
  return { world, a, b, wheat };
}
function closedDraft(world) {
  const plan = planCashEconomyMigration(world, NOW);
  assert.equal(plan.ready, true, JSON.stringify(plan.blockers));
  assert.equal(applyCashEconomyMigration(world, plan).applied, true);
  return world;
}
function contract(world, a, b, wheat, overrides = {}) {
  const row = { id: 'goods-contract', kind: 'supply', supplyMode: 'daily', status: 'active',
    provinceId: '110000', productId: 'wheat', buyerId: b.userId, supplierId: a.userId,
    buyerEscrowCredits: 50, buyerBondCredits: 10, supplierBondCredits: 10,
    supplierReservedQuantity: 10, totalDeliveredQuantity: 37, completedDeliveryEvents: 4,
    buyerAutoFund: true, supplierAutoReserve: true, ...overrides };
  world.productionContracts = [row];
  b.credits -= 60; b.frozenCredits = 60;
  a.credits -= 10; a.frozenCredits = 10;
  freezeCommodity(wheat, 'contract', row.id, 10);
  return row;
}
function auction(world, a, b, wheat) {
  freezeCommodity(wheat, 'auction', 'goods-auction', 20);
  a.credits -= 0.5; b.credits -= 50; b.frozenCredits = 50;
  world.auctionFeeEscrowCredits = 0.5;
  const row = { id: 'goods-auction', status: 'open', escrowStatus: 'held', sellerId: a.userId,
    highestBidderId: b.userId, highestBid: 50, listingFeeStatus: 'held', listingFee: 0.5,
    items: [{ assetKind: 'commodity', assetId: 'wheat', provinceId: '110000', quantity: 20 }] };
  world.assetAuctions = [row];
  return row;
}

test('migration planning is read-only and fee-free liquidation is applied once without creating trading volume', () => {
  const { world, a } = setup();
  const original = structuredClone(world);
  const originalStats = structuredClone(a.stats);
  const market = structuredClone(world.markets['110000:wheat']);
  const price = market.officialPrice;
  const plan = planCashEconomyMigration(world, NOW);
  assert.equal(plan.ready, true, JSON.stringify(plan.blockers));
  assert.deepEqual(world, original);
  assert.equal(plan.players.find((row) => row.userId === a.userId).liquidationCredits, price * 100);
  applyCashEconomyMigration(world, plan);
  const after = world.players[String(a.userId)];
  assert.equal(after.credits, 10000 + price * 100);
  assert.deepEqual(after.inventories, {});
  assert.deepEqual(after.stats, originalStats);
  assert.deepEqual(world.markets['110000:wheat'], market);
  assert.equal(after.cashInventoryMigration.liquidationCredits, price * 100);
  const first = structuredClone(world);
  assert.equal(applyCashEconomyMigration(world, plan).applied, false);
  assert.equal(planCashEconomyMigration(world, NOW + 1).alreadyApplied, true);
  assert.deepEqual(world, first);
  assert.equal(commodityInvestmentQuote(world, 'wheat', NOW).price > 0, true);
});

test('stale or forged plans cannot overwrite newer money or replay a migration', () => {
  const { world, a } = setup(); const plan = planCashEconomyMigration(world, NOW);
  a.credits += 1;
  const before = structuredClone(world);
  assert.throws(() => applyCashEconomyMigration(world, plan), { code: 'CASH_MIGRATION_PLAN_STALE' });
  assert.throws(() => applyCashEconomyMigration(world, { ...plan }), { code: 'CASH_MIGRATION_PLAN_INVALID' });
  assert.deepEqual(world, before);
});

test('daily goods contracts refund actual bonds and daily escrow, retaining delivered history and avoiding default penalties', () => {
  const { world, a, b, wheat } = setup(); contract(world, a, b, wheat);
  closedDraft(world);
  assert.equal(world.productionContracts[0].status, 'terminated');
  assert.equal(world.productionContracts[0].terminationReason, 'cash_economy_retirement');
  assert.equal(world.productionContracts[0].totalDeliveredQuantity, 37);
  assert.equal(world.productionContracts[0].completedDeliveryEvents, 4);
  assert.equal(world.productionContracts[0].buyerEscrowCredits, 0);
  assert.equal(world.players[String(b.userId)].credits, 10000);
  assert.equal(world.players[String(b.userId)].frozenCredits, 0);
  assert.equal(world.players[String(a.userId)].frozenCredits, 0);
  assert.equal(world.players[String(a.userId)].cashInventoryMigration.items[0].quantity, 100);
});

test('accepted legacy renewal escrow is released once with its own source, not the main contract source', () => {
  const { world, a, b, wheat } = setup(); const row = contract(world, a, b, wheat, { supplyMode: 'batch' });
  row.renewalProposal = { status: 'accepted', buyerEscrowCredits: 25, buyerBondCredits: 5, supplierBondCredits: 5, supplierReservedQuantity: 5 };
  a.credits -= 5; a.frozenCredits += 5; b.credits -= 30; b.frozenCredits += 30;
  freezeCommodity(wheat, 'contract', `${row.id}:renewal`, 5);
  closedDraft(world);
  assert.equal(world.players[String(a.userId)].frozenCredits, 0);
  assert.equal(world.players[String(b.userId)].credits, 10000);
  assert.equal(world.productionContracts[0].renewalProposal.status, 'cancelled');
  assert.equal(world.productionContracts[0].renewalProposal.supplierReservedQuantity, 0);
});

test('ordinary commodity auctions return highest bids and held listing fees without charging a sales fee', () => {
  const { world, a, b, wheat } = setup(); auction(world, a, b, wheat);
  closedDraft(world);
  assert.equal(world.assetAuctions[0].settlementReason, 'migration_cancelled');
  assert.equal(world.assetAuctions[0].escrowStatus, 'released');
  assert.equal(world.assetAuctions[0].listingFeeStatus, 'refunded');
  assert.equal(world.auctionFeeEscrowCredits, 0);
  assert.equal(world.players[String(b.userId)].credits, 10000);
  assert.equal(world.players[String(a.userId)].cashInventoryMigration.items[0].quantity, 100);
});

test('bank assets, factory auctions, loan and lease contracts, and invested commercial cycles are not rewritten', () => {
  const { world, a } = setup();
  world.assetAuctions = [{ id: 'factory-auction', status: 'open', listingFeeStatus: 'none', items: [{ assetKind: 'facility', assetId: 'farm', quantity: 1 }] }];
  world.productionContracts = [{ kind: 'loan', id: 'loan-1', status: 'active' }, { kind: 'facility_lease', id: 'lease-1', status: 'active' }];
  a.commercialBuildingGroups = [{ provinceId: '110000', commercialTypeId: 'convenience-store', cycleActive: true, pendingRevenue: 99, cycleStartedAt: NOW - 1000 }];
  const retained = structuredClone({ bank: a.bankAccount, commercial: a.commercialBuildingGroups, contracts: world.productionContracts, auctions: world.assetAuctions });
  closedDraft(world);
  assert.deepEqual(world.players[String(a.userId)].bankAccount, retained.bank);
  assert.deepEqual(world.players[String(a.userId)].commercialBuildingGroups, retained.commercial);
  assert.deepEqual(world.productionContracts, retained.contracts);
  assert.deepEqual(world.assetAuctions, retained.auctions);
});

test('known unconsumed operating reservations may be liquidated; already invested commercial inputs are not minted again', () => {
  const { world, a, wheat } = setup();
  a.commercialBuildingGroups = [{ provinceId: '110000', commercialTypeId: 'convenience-store', cycleActive: true, pendingRevenue: 50 }];
  const food = inventoryForProvince(a, 'food', '110000'); food.available = 20;
  freezeCommodity(food, 'commercial', '110000:convenience-store', 10);
  closedDraft(world);
  assert.equal(world.players[String(a.userId)].cashInventoryMigration.items[0].quantity, 100);
  assert.equal(world.players[String(a.userId)].cashInventoryMigration.items.find((row) => row.productId === 'food').quantity, 20);
  assert.equal(world.players[String(a.userId)].commercialBuildingGroups[0].pendingRevenue, 50);
});

for (const [label, mutate, code] of [
  ['unattributed goods', ({ wheat }) => { wheat.available -= 1; wheat.frozen = 1; }, 'CASH_MIGRATION_UNKNOWN_FREEZE'],
  ['unknown source', ({ wheat }) => freezeCommodity(wheat, 'legacy', 'unknown', 1), 'CASH_MIGRATION_UNKNOWN_FREEZE'],
  ['wrong source amount', (x) => { const c = contract(x.world, x.a, x.b, x.wheat); c.supplierReservedQuantity = 11; }, 'CASH_MIGRATION_CUSTODY'],
  ['missing participant', (x) => { contract(x.world, x.a, x.b, x.wheat); delete x.world.players[String(x.b.userId)]; }, 'CASH_MIGRATION_PARTICIPANT'],
  ['insufficient frozen cash', (x) => { contract(x.world, x.a, x.b, x.wheat); x.b.frozenCredits = 59; }, 'CASH_MIGRATION_ESCROW'],
  ['legacy running production', ({ a }) => { a.facilityGroups = [{ provinceId: '110000', facilityTypeId: 'farm', status: 'running', cycleStartedAt: NOW - 1000 }]; }, 'CASH_MIGRATION_ACTIVE_PRODUCTION'],
  ['owned cargo in transit', ({ wheat }) => { wheat.available -= 1; wheat.inTransit = 1; }, 'CASH_MIGRATION_IN_TRANSIT'],
  ['mixed auction', (x) => { auction(x.world, x.a, x.b, x.wheat).items.push({ assetKind: 'facility', assetId: 'farm', provinceId: '110000', quantity: 1 }); }, 'CASH_MIGRATION_MIXED_AUCTION'],
  ['unprocessed world', ({ world }) => { world.lastProcessedAt = NOW - 1; }, 'CASH_MIGRATION_WORLD_STALE'],
  ['open player order', ({ world, a }) => { world.orders.push({ id: 'old-order', ownerId: a.userId, status: 'open', assetKind: 'commodity' }); }, 'CASH_MIGRATION_OPEN_ORDER'],
]) {
  test(`${label} blocks the entire migration without refunds, liquidation or partial changes`, () => {
    const x = setup(); mutate(x); const before = structuredClone(x.world);
    const plan = planCashEconomyMigration(x.world, NOW);
    assert.equal(plan.ready, false);
    assert.equal(plan.blockers[0].code, code, JSON.stringify(plan));
    assert.deepEqual(x.world, before);
    assert.throws(() => applyCashEconomyMigration(x.world, plan), { code: 'CASH_MIGRATION_PLAN_INVALID' });
    assert.deepEqual(x.world, before);
  });
}

test('refunds cannot consume the known bid custody of a retained factory auction', () => {
  const x = setup(); auction(x.world, x.a, x.b, x.wheat);
  x.world.assetAuctions.push({ id: 'factory', status: 'open', highestBidderId: x.b.userId, highestBid: 80,
    listingFeeStatus: 'none', items: [{ assetKind: 'facility', assetId: 'farm', quantity: 1 }] });
  // 50 is owed to the commodity auction, 80 to the factory auction; only 100 is really frozen.
  x.b.frozenCredits = 100;
  const before = structuredClone(x.world);
  const plan = planCashEconomyMigration(x.world, NOW);
  assert.equal(plan.ready, false); assert.equal(plan.blockers[0].code, 'CASH_MIGRATION_ESCROW');
  assert.deepEqual(x.world, before);
});

test('SQLite rollback after a migration save restores the original goods, cash and migration marker', () => {
  const { world } = setup(); const store = new EconomyStore(':memory:');
  try {
    store.transaction(() => {
      const loaded = store.loadWorld(NOW);
      Object.assign(loaded.world, world);
      store.saveWorldIfChanged(loaded.revision, loaded.world, NOW, loaded.stateJson);
    });
    const original = structuredClone(store.loadWorld(NOW).world);
    assert.throws(() => store.transaction(() => {
      const loaded = store.loadWorld(NOW);
      const plan = planCashEconomyMigration(loaded.world, NOW);
      assert.equal(plan.ready, true, JSON.stringify(plan.blockers));
      applyCashEconomyMigration(loaded.world, plan);
      store.saveWorldIfChanged(loaded.revision, loaded.world, NOW, loaded.stateJson);
      throw new Error('injected-cutover-write-failure');
    }), /injected-cutover-write-failure/);
    const restored = store.loadWorld(NOW).world;
    assert.deepEqual(restored.players, original.players);
    assert.equal(restored.cashEconomy, undefined);
  } finally { store.close(); }
});

test('commodity refunds cannot consume retained factory lease rent and bond custody', () => {
  const x = setup(); contract(x.world, x.a, x.b, x.wheat);
  x.world.productionContracts.push({ kind: 'facility_lease', id: 'lease', status: 'active',
    lesseeId: x.b.userId, lessorId: x.a.userId, lesseeEscrowCredits: 100, lesseeBondCredits: 10, lessorBondCredits: 10 });
  x.a.frozenCredits = 20; x.b.frozenCredits = 169;
  const before = structuredClone(x.world);
  const plan = planCashEconomyMigration(x.world, NOW);
  assert.equal(plan.ready, false); assert.equal(plan.blockers[0].code, 'CASH_MIGRATION_ESCROW');
  assert.deepEqual(x.world, before);
  x.b.frozenCredits = 170;
  closedDraft(x.world);
  assert.equal(x.world.players[String(x.b.userId)].frozenCredits, 110);
  assert.equal(x.world.players[String(x.a.userId)].frozenCredits, 10);
});

test('system reserve auction cargo returns to the reserve, never to a player liquidation account', () => {
  const { world, a, b } = setup();
  const [groupId, group] = Object.entries(world.marketDemand.liquidity.groups)[0];
  group.reserves.wheat = { inventory: 100, frozenInventory: 20 };
  b.credits = 9950; b.frozenCredits = 50;
  world.assetAuctions = [{ id: 'reserve-auction', status: 'open', sellerType: 'market_reserve',
    marketReserveGroupId: groupId, escrowStatus: 'held', highestBidderId: b.userId,
    highestBid: 50, listingFeeStatus: 'none', listingFee: 0,
    items: [{ assetKind: 'commodity', assetId: 'wheat', provinceId: '110000', quantity: 20 }] }];
  closedDraft(world);
  assert.equal(world.marketDemand.liquidity.groups[groupId].reserves.wheat.inventory, 120);
  assert.equal(world.marketDemand.liquidity.groups[groupId].reserves.wheat.frozenInventory, 0);
  assert.equal(world.players[String(b.userId)].credits, 10000);
  assert.equal(world.players[String(a.userId)].cashInventoryMigration.items[0].quantity, 100);
});

test('mutating a report does not change the server-only migration draft', () => {
  const { world, a } = setup(); const plan = planCashEconomyMigration(world, NOW);
  const value = plan.players.find((row) => row.userId === a.userId).creditsAfter;
  plan.players[0].creditsAfter = 1;
  applyCashEconomyMigration(world, plan);
  assert.equal(world.players[String(a.userId)].credits, value);
});

test('a migration cannot revalue a newer world using a backdated cutover price', () => {
  const { world } = setup(); world.lastProcessedAt = NOW + 1;
  const before = structuredClone(world);
  const plan = planCashEconomyMigration(world, NOW);
  assert.equal(plan.ready, false); assert.equal(plan.blockers[0].code, 'CASH_MIGRATION_WORLD_STALE');
  assert.deepEqual(world, before);
});

test('a future or incompatible cash economy marker is never silently downgraded', () => {
  const { world } = setup(); world.cashEconomy = { version: 2, activatedAt: NOW, indexPolicyId: 'new-policy' };
  const before = structuredClone(world);
  assert.throws(() => planCashEconomyMigration(world, NOW), { code: 'CASH_MIGRATION_VERSION' });
  assert.throws(() => applyCashEconomyMigration(world, {}), { code: 'CASH_MIGRATION_VERSION' });
  assert.deepEqual(world, before);
});
