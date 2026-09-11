import test from 'node:test';
import assert from 'node:assert/strict';
import { commodityInvestmentPreview, maximumCommodityInvestmentQuantity } from '../../src/investments/commodityInvestmentPreview.ts';

test('investment preview uses cents, integer units and a close-only fee', () => {
  assert.deepEqual(commodityInvestmentPreview(2.13, 100, 'buy'), { gross: 213, fee: 0, cash: 213 });
  assert.deepEqual(commodityInvestmentPreview(2.13, 100, 'sell'), { gross: 213, fee: 2.13, cash: 210.87 });
  assert.deepEqual(commodityInvestmentPreview(0.01, 1, 'sell'), { gross: 0.01, fee: 0.0001, cash: 0.0099 });
  assert.equal(maximumCommodityInvestmentQuantity(2.999999, 1), 2);
  assert.equal(maximumCommodityInvestmentQuantity(3, 0.1), 30);
});

test('invalid or overflowing preview cannot offer a trade or round fractional units', () => {
  for (const quantity of [0, -1, 1.01, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.equal(commodityInvestmentPreview(2, quantity, 'buy'), null);
  }
  for (const price of [0, -1, 1.001, NaN, Infinity, Number.MAX_VALUE]) {
    assert.equal(commodityInvestmentPreview(price, 1, 'buy'), null);
  }
  for (const credits of [-1, NaN, Infinity, Number.MAX_VALUE]) assert.equal(maximumCommodityInvestmentQuantity(credits, 1), 0);
  assert.equal(commodityInvestmentPreview(1, 1, 'sell', 10001), null);
  assert.equal(commodityInvestmentPreview(1, 1, 'sell', -1), null);
  assert.equal(commodityInvestmentPreview(1, 1, 'invalid' as 'buy'), null);
});

test('the sum of finite cent-price partial-close fees agrees with a full close', () => {
  const parts = [11, 2, 57, 30];
  const feeMicros = parts.reduce((sum, quantity) => sum + Math.round(commodityInvestmentPreview(3.19, quantity, 'sell')!.fee * 1e6), 0);
  assert.equal(feeMicros, Math.round(commodityInvestmentPreview(3.19, 100, 'sell')!.fee * 1e6));
});
