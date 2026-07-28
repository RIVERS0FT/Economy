import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertInternalMoney,
  assertPlayerMoney,
  ceilPlayerMoney,
  floorPlayerMoney,
  normalizePlayerMoneyInput,
  normalizePlayerMoneyPayload,
  normalizeWorldMoneyPrecision,
  roundInternalMoney,
} from '../src/money.js';
import { applyMarketSellFee, calculateCumulativeMarketSellFee } from '../src/market-sell-fee.js';

test('玩家金额按数轴向下截断到两位', () => {
  assert.equal(floorPlayerMoney(9.996), 9.99);
  assert.equal(floorPlayerMoney(-9.996), -10);
  assert.equal(ceilPlayerMoney(9.996), 10);
  assert.equal(normalizePlayerMoneyInput('12.345678'), 12.34);
  assert.equal(normalizePlayerMoneyInput('0.009'), null);
  assert.equal(assertPlayerMoney(9.99), true);
  assert.equal(assertPlayerMoney(9.991), false);
});

test('服务器内部金额最多保留六位', () => {
  assert.equal(roundInternalMoney(1.23456749), 1.234567);
  assert.equal(roundInternalMoney(1.2345675), 1.234568);
  assert.equal(assertInternalMoney(0.0999), true);
});

test('玩家提交金额字段统一向下规范化且不改变宝石和数量', () => {
  assert.deepEqual(normalizePlayerMoneyPayload('placeOrder', {
    price: '9.996', quantity: 3, gems: 2,
    nested: { amount: '12.345678' },
  }), {
    price: 9.99, quantity: 3, gems: 2,
    nested: { amount: 12.34 },
  });
});

test('市场卖方手续费累计到六位小数', () => {
  assert.equal(calculateCumulativeMarketSellFee(9.99), 0.0999);
  const order = { ownerType: 'player', side: 'sell', fills: [] };
  assert.deepEqual(applyMarketSellFee(order, 9.99), { fee: 0.0999, netTotal: 9.8901 });
});

test('世界保存前清算玩家尾差且宝石保持整数', () => {
  const world = {
    players: {
      1: {
        credits: 9.996,
        frozenCredits: 1.239,
        gems: 4.9,
        stats: {}, ledger: [], trades: [],
        bankAccount: { depositCredits: 2.999, depositInterestCarryMicros: 7, recentTransactions: [] },
      },
    },
    bank: { interestPoolMicros: 10 },
    orders: [], markets: {}, facilityMarkets: {}, assetAuctions: [], productionContracts: [],
  };
  normalizeWorldMoneyPrecision(world);
  assert.equal(world.players[1].credits, 9.99);
  assert.equal(world.players[1].frozenCredits, 1.23);
  assert.equal(world.players[1].bankAccount.depositCredits, 2.99);
  assert.equal(world.players[1].gems, 4);
  assert.equal(world.players[1].bankAccount.depositInterestCarryMicros, 0);
  assert.equal(world.bank.interestPoolMicros, 17);
  assert.equal(world.moneyPrecision.roundingReserveMicros, 25000);
});
