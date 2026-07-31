import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertInternalMoney,
  assertPlayerMoney,
  calculateRateMoney,
  ceilPlayerMoney,
  floorPlayerMoney,
  internalMoneyToMicros,
  multiplyMoneyByInteger,
  multiplyMoneyRatio,
  normalizePlayerMoneyInput,
  normalizePlayerMoneyPayload,
  normalizeWorldMoneyPrecision,
  roundInternalMoney,
} from '../src/money.js';
import { applyMarketSellFee, calculateCumulativeMarketSellFee } from '../src/market-sell-fee.js';

test('价格量化使用统一微单位并严格拒绝超过两位的玩家输入', () => {
  assert.equal(floorPlayerMoney(9.996), 9.99);
  assert.equal(floorPlayerMoney(-9.996), -10);
  assert.equal(ceilPlayerMoney(9.996), 10);
  assert.equal(normalizePlayerMoneyInput('12.34'), 12.34);
  assert.equal(normalizePlayerMoneyInput('12.340'), null);
  assert.equal(normalizePlayerMoneyInput('12.345678'), null);
  assert.equal(normalizePlayerMoneyInput('0.009'), null);
  assert.equal(assertPlayerMoney(9.99), true);
  assert.equal(assertPlayerMoney(9.991), false);
});

test('服务器金额只有一套六位微单位运算', () => {
  assert.equal(roundInternalMoney(1.23456749), 1.234567);
  assert.equal(roundInternalMoney(1.2345675), 1.234568);
  assert.equal(internalMoneyToMicros(1.234567), 1_234_567n);
  assert.equal(multiplyMoneyByInteger(9.99, 3), 29.97);
  assert.equal(multiplyMoneyRatio(3, 9.99, 1, 'half-up'), 29.97);
  assert.equal(calculateRateMoney(9.99, 100, 10_000), 0.0999);
  assert.equal(assertInternalMoney(0.0999), true);
});

test('玩家提交金额不再静默截断且不改变宝石和数量', () => {
  assert.deepEqual(normalizePlayerMoneyPayload('placeOrder', {
    price: '9.99', quantity: 3, gems: 2,
    nested: { amount: '12.34' },
  }), {
    price: 9.99, quantity: 3, gems: 2,
    nested: { amount: 12.34 },
  });
  assert.deepEqual(normalizePlayerMoneyPayload('placeOrder', {
    price: '9.996', quantity: 3,
  }), { price: null, quantity: 3 });
});

test('市场卖方手续费通过整数微单位累计', () => {
  assert.equal(calculateCumulativeMarketSellFee(9.99), 0.0999);
  const order = { ownerType: 'player', side: 'sell', fills: [] };
  assert.deepEqual(applyMarketSellFee(order, 9.99), { fee: 0.0999, netTotal: 9.8901 });
});

test('世界保存前保留六位账户金额且不再累计价格尾差准备金', () => {
  const world = {
    players: {
      1: {
        credits: 9.9960014,
        frozenCredits: 1.2390004,
        gems: 4.9,
        stats: {}, ledger: [], trades: [],
        bankAccount: { depositCredits: 2.9990014, depositInterestCarryMicros: 7, recentTransactions: [] },
      },
    },
    bank: { interestPoolMicros: 10 },
    orders: [], markets: {}, facilityMarkets: {}, assetAuctions: [], productionContracts: [],
  };
  normalizeWorldMoneyPrecision(world);
  assert.equal(world.players[1].credits, 9.996001);
  assert.equal(world.players[1].frozenCredits, 1.239);
  assert.equal(world.players[1].bankAccount.depositCredits, 2.999001);
  assert.equal(world.players[1].gems, 4);
  assert.equal(world.players[1].bankAccount.depositInterestCarryMicros, 0);
  assert.equal(world.bank.interestPoolMicros, 17);
  assert.equal(world.moneyPrecision.version, 3);
  assert.equal(world.moneyPrecision.roundingReserveMicros, 0);
});
