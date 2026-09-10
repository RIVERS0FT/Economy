import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureBankWorld } from '../src/banking.js';
import { applyProductionContractAction, processProductionContracts } from '../src/contracts.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { provinceScopedKey } from '../src/provinces.js';

function player(userId, credits = 100_000) {
  const facility = FACILITY_TYPE_CATALOG[0];
  return {
    userId,
    credits,
    frozenCredits: 0,
    inventories: {},
    inventoryCapacity: 1_000_000,
    facilityGroups: [{
      provinceId: '440000',
      facilityTypeId: facility.id,
      count: 10,
      participatingCount: 10,
      enabled: true,
      status: 'running',
      cycleStartedAt: 1,
      lifetimeOutput: 0,
      activeRecipeId: facility.defaultRecipeId,
      staffingRateBps: 10_000,
      staffingUpdatedAt: 1,
      staffingBatchCarryBps: 0,
    }],
    research: { unlockedComplexity: 'C7', completedAt: 1, active: null },
    stats: {},
    bankAccount: null,
  };
}

function world() {
  const facility = FACILITY_TYPE_CATALOG[0];
  return {
    version: 26,
    players: { '1': player(1), '2': player(2) },
    productionContracts: [],
    orders: [],
    assetAuctions: [],
    facilityMarkets: {
      [provinceScopedKey('440000', facility.id)]: { lastTradePrice: facility.systemValue },
    },
    populationEconomy: {},
  };
}

test('player-loan bank clearing keeps seized collateral in the contract province bank reserve', () => {
  const state = world();
  const facility = FACILITY_TYPE_CATALOG[0];
  const now = 5_000_000;
  const create = applyProductionContractAction(state, { id: 1 }, 'createProductionContract', {
    kind: 'loan',
    publisherSide: 'borrower',
    provinceId: '440000',
    principal: 10,
    interestRateBps: 500,
    termMs: 12 * 60 * 60 * 1000,
    facilityTypeId: facility.id,
    collateralQuantity: 2,
  }, now);
  assert.equal(create.ok, true);
  const contractId = state.productionContracts[0].id;
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId }, now).ok, true);

  ensureBankWorld(state, now);
  state.players['1'].credits = 0;
  state.players['1'].bankAccount.depositCredits = 0;
  const lenderFactoryCount = state.players['2'].facilityGroups[0].count;

  processProductionContracts(state, now + 12 * 60 * 60 * 1000 + 1);
  const graceEndsAt = state.productionContracts[0].graceEndsAt;
  assert.ok(graceEndsAt);
  processProductionContracts(state, graceEndsAt + 1);

  const settled = state.productionContracts[0];
  const reserveKey = provinceScopedKey('440000', facility.id);
  assert.equal(settled.status, 'terminated');
  assert.equal(settled.terminationReason, 'borrower_default');
  assert.equal(settled.collateralTransferredQuantity, 0);
  assert.ok(settled.bankCollateralSeizedQuantity > 0);
  assert.equal(state.bank.facilityReserves[reserveKey], settled.bankCollateralSeizedQuantity);
  assert.equal(state.players['2'].facilityGroups[0].count, lenderFactoryCount);
  assert.equal(
    state.players['1'].facilityGroups[0].count,
    10 - settled.bankCollateralSeizedQuantity,
  );
});
