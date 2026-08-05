import test from 'node:test';
import assert from 'node:assert/strict';
import { applyProductionContractAction, createProductionContractClientState, migrateProductionContractWorld, processProductionContracts } from '../src/contracts.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { leasedInFacilityQuantity, leasedOutFacilityQuantity, playerLoanCollateralQuantity } from '../src/contract-asset-locks.js';

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
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'createProductionContract', { kind: 'facility_lease', publisherSide: 'lessor', facilityTypeId: facility.id, quantity: 3, rentPerPeriod: 10, periodMs: 60 * 60 * 1000, totalPeriods: 2, firstPeriodDelayMs: 0 }, now).ok, true);
  let contract = state.productionContracts[0];
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);
  contract = state.productionContracts[0];
  assert.equal(leasedOutFacilityQuantity(state, 1, facility.id), 3);
  assert.equal(leasedInFacilityQuantity(state, 2, facility.id), 3);
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

test('schema 5 migrates legacy supply contracts without changing roles', () => {
  const state = world();
  state.productionContracts = [{ id: 'legacy', publisherId: 1, publisherName: '甲', publisherRole: 'buyer', buyerId: 1, buyerName: '甲', supplierId: null, supplierName: null, productId: 'wheat', quantityPerDelivery: 1, unitPrice: 1, deliveryIntervalMs: 600000, totalDeliveries: 2, completedDeliveries: 0, firstDeliveryDelayMs: 0, createdAt: 1, offerExpiresAt: 2, status: 'open' }];
  migrateProductionContractWorld(state);
  assert.equal(state.productionContractSchemaVersion, 5);
  assert.equal(state.productionContracts[0].kind, 'supply');
  assert.equal(state.productionContracts[0].publisherSide, 'buyer');
});
