import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTRACT_DAY_MS,
  allocateDailySupplyReservesForSupplier,
  consumeDailySupplyForBuyer,
  processDailySupplyContracts,
  recordDailyProductProduction,
} from '../src/daily-supply-contracts.js';
import { inventoryForProvince } from '../src/provinces.js';

const PROVINCE_ID = '120000';
const PRODUCT_ID = 'wheat';
const NOW = 1_800 * CONTRACT_DAY_MS + 12_345;

function player(userId, credits = 10_000) {
  return {
    userId,
    credits,
    frozenCredits: 0,
    inventories: {},
    facilityGroups: [],
    stats: {},
  };
}

function dailyContract(overrides = {}) {
  return {
    id: 'daily-contract',
    kind: 'supply',
    supplyMode: 'daily',
    contractSchemaVersion: 11,
    publisherId: 1,
    publisherRole: 'buyer',
    buyerId: 1,
    supplierId: 2,
    provinceId: PROVINCE_ID,
    productId: PRODUCT_ID,
    dailyMaxQuantity: 10,
    unitPrice: 5,
    durationDays: 30,
    startDelayDays: 0,
    status: 'active',
    createdAt: NOW - CONTRACT_DAY_MS,
    acceptedAt: NOW - 1_000,
    startsAt: NOW - 1_000,
    endsAt: NOW + 30 * CONTRACT_DAY_MS,
    currentDayKey: Math.floor(NOW / CONTRACT_DAY_MS),
    dailyUsedQuantity: 0,
    totalDeliveredQuantity: 0,
    completedDeliveryEvents: 0,
    buyerEscrowCredits: 0,
    supplierReservedQuantity: 0,
    buyerBondCredits: 0,
    supplierBondCredits: 0,
    buyerAutoFund: false,
    supplierAutoReserve: false,
    prioritySupply: { enabled: false, minDailyProduction: 0, minContractPrice: 0 },
    negotiations: [],
    ...overrides,
  };
}

function world(contract = dailyContract()) {
  return {
    players: {
      '1': player(1),
      '2': player(2),
    },
    productionContracts: [contract],
    orders: [],
  };
}

test('daily regional purchase contract is used only when fixed price is below executable market price', () => {
  const state = world(dailyContract({
    buyerEscrowCredits: 50,
    supplierReservedQuantity: 10,
  }));
  state.players['1'].frozenCredits = 50;
  const supplierInventory = inventoryForProvince(state.players['2'], PRODUCT_ID, PROVINCE_ID);
  supplierInventory.frozen = 10;

  const expensiveMarket = consumeDailySupplyForBuyer(state, 1, PROVINCE_ID, PRODUCT_ID, 8, 6, NOW);
  assert.equal(expensiveMarket.quantity, 8);
  assert.equal(expensiveMarket.gross, 40);
  assert.deepEqual(expensiveMarket.contractIds, ['daily-contract']);
  assert.equal(inventoryForProvince(state.players['1'], PRODUCT_ID, PROVINCE_ID).available, 8);
  assert.equal(inventoryForProvince(state.players['1'], PRODUCT_ID, '110000').available, 0);
  assert.equal(state.productionContracts[0].dailyUsedQuantity, 8);
  assert.equal(state.productionContracts[0].dailyRemainingQuantity, 2);

  const cheaperMarket = consumeDailySupplyForBuyer(state, 1, PROVINCE_ID, PRODUCT_ID, 2, 4, NOW);
  assert.equal(cheaperMarket.quantity, 0);
  assert.equal(state.productionContracts[0].dailyUsedQuantity, 8);
});

test('daily quota resets on the next authority day and never moves goods across regions', () => {
  const state = world(dailyContract({
    dailyUsedQuantity: 10,
    totalDeliveredQuantity: 10,
    buyerAutoFund: false,
    supplierAutoReserve: false,
  }));
  const otherProvinceInventory = inventoryForProvince(state.players['2'], PRODUCT_ID, '110000');
  otherProvinceInventory.available = 999;
  processDailySupplyContracts(state, NOW + CONTRACT_DAY_MS);

  assert.equal(state.productionContracts[0].dailyUsedQuantity, 0);
  assert.equal(state.productionContracts[0].dailyRemainingQuantity, 10);
  assert.equal(inventoryForProvince(state.players['2'], PRODUCT_ID, '110000').available, 999);
  assert.equal(inventoryForProvince(state.players['2'], PRODUCT_ID, PROVINCE_ID).available, 0);
});

test('priority supply requires both production and price conditions before automatic reservation', () => {
  const state = world(dailyContract({
    publisherId: 2,
    publisherRole: 'supplier',
    buyerAutoFund: false,
    supplierAutoReserve: true,
    prioritySupply: { enabled: true, minDailyProduction: 10, minContractPrice: 5 },
    unitPrice: 6,
  }));
  inventoryForProvince(state.players['2'], PRODUCT_ID, PROVINCE_ID).available = 20;

  recordDailyProductProduction(state.players['2'], PROVINCE_ID, PRODUCT_ID, 9, NOW);
  assert.equal(allocateDailySupplyReservesForSupplier(state, 2, PROVINCE_ID, PRODUCT_ID, NOW), 0);
  assert.equal(state.productionContracts[0].supplierReservedQuantity, 0);

  recordDailyProductProduction(state.players['2'], PROVINCE_ID, PRODUCT_ID, 1, NOW);
  assert.equal(allocateDailySupplyReservesForSupplier(state, 2, PROVINCE_ID, PRODUCT_ID, NOW), 10);
  assert.equal(state.productionContracts[0].supplierReservedQuantity, 10);
  assert.equal(inventoryForProvince(state.players['2'], PRODUCT_ID, PROVINCE_ID).available, 10);
  assert.equal(inventoryForProvince(state.players['2'], PRODUCT_ID, PROVINCE_ID).frozen, 10);
});

test('priority supply does not reserve when contract price is below supplier minimum', () => {
  const state = world(dailyContract({
    publisherId: 2,
    publisherRole: 'supplier',
    buyerAutoFund: false,
    supplierAutoReserve: true,
    prioritySupply: { enabled: true, minDailyProduction: 1, minContractPrice: 7 },
    unitPrice: 6,
  }));
  inventoryForProvince(state.players['2'], PRODUCT_ID, PROVINCE_ID).available = 20;
  recordDailyProductProduction(state.players['2'], PROVINCE_ID, PRODUCT_ID, 100, NOW);

  assert.equal(allocateDailySupplyReservesForSupplier(state, 2, PROVINCE_ID, PRODUCT_ID, NOW), 0);
  assert.equal(state.productionContracts[0].supplierReservedQuantity, 0);
});
