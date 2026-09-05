import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductionContractAction, createProductionContractClientState, migrateProductionContractWorld, processProductionContracts } from '../src/contracts.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { contractLockedFacilityQuantity, leasedInFacilityQuantity, leasedOutFacilityQuantity, playerLoanCollateralQuantity } from '../src/contract-asset-locks.js';

function player(userId, name, credits = 100_000) {
  const facility = FACILITY_TYPE_CATALOG[0];
  return {
    userId, playerName: name, credits, frozenCredits: 0, inventories: {}, inventoryCapacity: 1_000_000,
    facilityGroups: [{ facilityTypeId: facility.id, count: 10, participatingCount: 10, enabled: true, status: 'running', cycleStartedAt: 1, lifetimeOutput: 0, activeRecipeId: facility.defaultRecipeId, staffingRateBps: 10000, staffingUpdatedAt: 1, staffingBatchCarryBps: 0 }],
    research: { unlockedComplexity: 'C7', completedAt: 1, active: null }, stats: {}, bankAccount: null,
  };
}
function world() {
  const facility = FACILITY_TYPE_CATALOG[0];
  return { version: 26, players: { '1': player(1, '甲'), '2': player(2, '乙') }, productionContracts: [], orders: [], assetAuctions: [], facilityMarkets: { [facility.id]: { lastTradePrice: facility.systemValue } }, populationEconomy: {} };
}

test('player loan preserves funds and locks collateral until repayment', () => {
  const state = world(); const facility = FACILITY_TYPE_CATALOG[0]; const now = 1_000_000;
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'createProductionContract', { kind: 'loan', publisherSide: 'borrower', principal: 10, interestRateBps: 500, termMs: 24 * 60 * 60 * 1000, facilityTypeId: facility.id, collateralQuantity: 2 }, now).ok, true);
  let contract = state.productionContracts[0];
  const totalBefore = state.players['1'].credits + state.players['2'].credits;
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);
  contract = state.productionContracts[0];
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 2);
  assert.equal(state.players['1'].credits + state.players['2'].credits, totalBefore);
  state.players['1'].credits += 10;
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'repayPlayerLoan', { contractId: contract.id }, now + 1).ok, true);
  contract = state.productionContracts[0];
  assert.equal(contract.status, 'completed');
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 0);
});

test('facility lease transfers only production usage and settles rent', () => {
  const state = world(); const facility = FACILITY_TYPE_CATALOG[0]; const now = 2_000_000;
  state.players['2'].facilityGroups = [];
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'createProductionContract', { kind: 'facility_lease', publisherSide: 'lessor', facilityTypeId: facility.id, quantity: 3, rentPerPeriod: 10, periodMs: 60 * 60 * 1000, totalPeriods: 2, firstPeriodDelayMs: 0 }, now).ok, true);
  let contract = state.productionContracts[0];
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);
  contract = state.productionContracts[0];
  assert.equal(leasedOutFacilityQuantity(state, 1, facility.id), 3);
  assert.equal(leasedInFacilityQuantity(state, 2, facility.id), 3);
  assert.equal(state.players['2'].facilityGroups.some((group) => group.facilityTypeId === facility.id && group.count === 0), true);
  processProductionContracts(state, now + 1);
  contract = state.productionContracts[0];
  assert.equal(contract.completedPeriods, 1);
  const client = createProductionContractClientState(state, 2, now + 1);
  assert.equal(client.productionContracts[0].kind, 'facility_lease');
  processProductionContracts(state, now + 60 * 60 * 1000 + 2);
  contract = state.productionContracts[0];
  assert.equal(contract.status, 'completed');
  assert.equal(leasedOutFacilityQuantity(state, 1, facility.id), 0);
});


test('lease grace suspends production usage without unlocking the lessor asset', () => {
  const state = world(); const facility = FACILITY_TYPE_CATALOG[0]; const now = 3_000_000;
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'createProductionContract', { kind: 'facility_lease', publisherSide: 'lessor', facilityTypeId: facility.id, quantity: 2, rentPerPeriod: 10, periodMs: 60 * 60 * 1000, totalPeriods: 2, firstPeriodDelayMs: 0 }, now).ok, true);
  const contractId = state.productionContracts[0].id;
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId }, now).ok, true);
  state.players['2'].credits = 0;
  processProductionContracts(state, now + 1);
  processProductionContracts(state, now + 60 * 60 * 1000 + 2);
  const contract = state.productionContracts[0];
  assert.ok(contract.graceEndsAt);
  assert.equal(leasedOutFacilityQuantity(state, 1, facility.id), 0);
  assert.equal(leasedInFacilityQuantity(state, 2, facility.id), 0);
  assert.equal(contractLockedFacilityQuantity(state, 1, facility.id), 2);
  processProductionContracts(state, contract.graceEndsAt + 1);
  let breached = state.productionContracts[0];
  assert.equal(breached.status, 'active');
  assert.equal(breached.terminationReason, 'lessee_default');
  assert.ok(breached.breachedAt);
  assert.equal(breached.lastCompensationFromId, undefined);
  assert.equal(contractLockedFacilityQuantity(state, 1, facility.id), 0, '违约确认后出租方资产不再被租赁锁定');
  assert.ok(state.players['2'].frozenCredits > 0, '承租方违约保证金保持冻结等待出租方领取');
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 1).ok, false);
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 2).ok, true);
  breached = state.productionContracts[0];
  assert.equal(breached.status, 'terminated');
  assert.equal(breached.lastCompensationFromId, 2);
  assert.equal(breached.lastCompensationToId, 1);
});


test('loan default transfers only enough collateral and releases the remainder', () => {
  const state = world(); const facility = FACILITY_TYPE_CATALOG[0]; const now = 4_000_000;
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'createProductionContract', { kind: 'loan', publisherSide: 'borrower', principal: 10, interestRateBps: 500, termMs: 12 * 60 * 60 * 1000, facilityTypeId: facility.id, collateralQuantity: 2 }, now).ok, true);
  const contractId = state.productionContracts[0].id;
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId }, now).ok, true);
  state.players['1'].credits = 0;
  processProductionContracts(state, now + 12 * 60 * 60 * 1000 + 1);
  const grace = state.productionContracts[0];
  assert.ok(grace.graceEndsAt);
  processProductionContracts(state, grace.graceEndsAt + 1);
  let breached = state.productionContracts[0];
  assert.equal(breached.status, 'active');
  assert.equal(breached.terminationReason, 'borrower_default');
  assert.ok(breached.breachedAt);
  assert.equal(breached.defaultCollateralQuantity, 1);
  assert.equal(breached.collateralTransferredQuantity, 0, '违约确认时不得自动转移冻结工厂');
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 2, '等待出借方处置期间冻结仍保持锁定');
  assert.equal(state.players['1'].facilityGroups[0].count, 10);
  assert.equal(state.players['2'].facilityGroups[0].count, 10);
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 1).ok, false);
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 2).ok, true);
  breached = state.productionContracts[0];
  assert.equal(breached.status, 'terminated');
  assert.equal(breached.collateralTransferredQuantity, 1);
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 0);
  assert.equal(state.players['1'].facilityGroups[0].count, 9);
  assert.equal(state.players['2'].facilityGroups[0].count, 11);
});

test('schema 10 migrates legacy supply contracts to ID-only player relationships without changing roles', () => {
  const state = world();
  state.productionContracts = [{ id: 'legacy', publisherId: 1, publisherName: '甲', publisherRole: 'buyer', buyerId: 1, buyerName: '甲', supplierId: null, supplierName: null, productId: 'wheat', quantityPerDelivery: 1, unitPrice: 1, deliveryIntervalMs: 600000, totalDeliveries: 2, completedDeliveries: 0, firstDeliveryDelayMs: 0, createdAt: 1, offerExpiresAt: 2, status: 'open' }];
  migrateProductionContractWorld(state);
  assert.equal(state.productionContractSchemaVersion, 10);
  assert.equal(state.productionContracts[0].kind, 'supply');
  assert.equal(state.productionContracts[0].publisherSide, 'buyer');
  assert.equal(Object.hasOwn(state.productionContracts[0], 'publisherName'), false);
  assert.equal(Object.hasOwn(state.productionContracts[0], 'buyerName'), false);
  assert.equal(Object.hasOwn(state.productionContracts[0], 'supplierName'), false);
});

test('facility lease usage and locks stay in the contract province', () => {
  const state = world(); const facility = FACILITY_TYPE_CATALOG[0]; const now = 5_000_000;
  state.players['1'].facilityGroups = [
    { ...state.players['1'].facilityGroups[0], provinceId: '110000', count: 4 },
    { ...state.players['1'].facilityGroups[0], provinceId: '440000', count: 6 },
  ];
  state.players['2'].facilityGroups = [];
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'createProductionContract', {
    kind: 'facility_lease',
    publisherSide: 'lessor',
    provinceId: '440000',
    facilityTypeId: facility.id,
    quantity: 3,
    rentPerPeriod: 10,
    periodMs: 60 * 60 * 1000,
    totalPeriods: 2,
    firstPeriodDelayMs: 0,
  }, now).ok, true);
  const contractId = state.productionContracts[0].id;
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId }, now).ok, true);
  assert.equal(leasedOutFacilityQuantity(state, 1, facility.id, '110000'), 0);
  assert.equal(leasedOutFacilityQuantity(state, 1, facility.id, '440000'), 3);
  assert.equal(leasedInFacilityQuantity(state, 2, facility.id, '110000'), 0);
  assert.equal(leasedInFacilityQuantity(state, 2, facility.id, '440000'), 3);
  assert.equal(state.players['2'].facilityGroups.some((group) => (
    group.provinceId === '440000' && group.facilityTypeId === facility.id && group.count === 0
  )), true);
});
