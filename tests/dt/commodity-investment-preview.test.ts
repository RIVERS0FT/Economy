import assert from 'node:assert/strict';
import test from 'node:test';
import { investmentTradePreview, availableInvestmentQuote, investmentDateKey, formatInvestmentExpiry } from '../../src/investment/tradePreview.ts';

const now = Date.UTC(2026, 8, 11, 5);
const quote = { productId: 'wheat', available: true, contractId: 'wheat:2026-09-07', priceDateKey: '2026-09-11',
  expiresAt: Date.UTC(2026, 8, 13, 16), feeBps: 100, price: 10 };
const preview = (input = {}) => investmentTradePreview({ quote, now, side: 'buy', draft: '10', credits: 1000, heldQuantity: 100, ...input });

test('investment preview computes full-funded purchase without a client price in its request', () => {
  const result = preview();
  assert.equal(result?.amount, 100); assert.equal(result?.fee, 0); assert.equal(result?.maxQuantity, 100);
  assert.deepEqual(result?.input, { productId: 'wheat', contractId: quote.contractId, priceDateKey: quote.priceDateKey, side: 'buy', quantity: 10 });
});
test('investment preview excludes short-selling and fractional, scientific or unsafe quantities', () => {
  for (const draft of ['-1', '1.1', '1e2', 'NaN', 'Infinity', '9007199254740992', '', '0']) assert.equal(preview({ draft })?.input, null);
  assert.equal(preview({ side: 'sell', draft: '101' })?.input, null);
  assert.equal(preview({ side: 'sell', heldQuantity: 0 })?.maxQuantity, 0);
  assert.equal(preview({ credits: 99 })?.input, null);
  assert.equal(preview({ credits: 0 })?.maxQuantity, 0);
});
test('investment preview prorates cumulative fee rather than resetting at each partial close', () => {
  const small = { ...quote, price: 0.01 };
  const first = preview({ quote: small, side: 'sell', draft: '1' });
  assert.equal(first?.fee, 0.0001); assert.equal(first?.amount, 0.0099);
  const next = preview({ quote: small, side: 'sell', draft: '1', closeGross: 0.01, feesPaid: 0.0001 });
  assert.equal(next?.fee, 0.0001); assert.equal(next?.amount, 0.0099);
  assert.equal(preview({ feesPaid: 1 }), null);
});
test('investment quote expires at the boundary and follows Shanghai dates, not browser timezone', () => {
  assert.equal(investmentDateKey(Date.UTC(2026, 8, 10, 16)), '2026-09-11');
  assert.equal(availableInvestmentQuote(quote, quote.expiresAt), false);
  assert.equal(preview({ quote: { ...quote, priceDateKey: '2026-09-10' } }), null);
  assert.equal(preview({ quote: { ...quote, contractId: '' } }), null);
  for (const invalid of [NaN, Infinity, -1]) assert.equal(investmentDateKey(invalid), '');
  assert.match(formatInvestmentExpiry(quote.expiresAt), /2026\/09\/14.*00:00/);
  assert.equal(formatInvestmentExpiry(NaN), '待核对');
});
test('investment preview rejects unavailable, corrupted and overflowing money, not zero estimates', () => {
  for (const price of [0, NaN, Infinity, -1, 1.0000001]) assert.equal(preview({ quote: { ...quote, price } }), null);
  for (const credits of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) assert.equal(preview({ credits }), null);
  assert.equal(preview({ quote: undefined }), null);
  assert.equal(preview({ quote: { ...quote, available: false } }), null);
  assert.equal(preview({ heldQuantity: -1 }), null);
});
