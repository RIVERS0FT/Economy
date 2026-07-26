import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeRouteParameter, resolveAction } from '../src/game-routes.js';

test('game routes decode identifiers and reject unsupported methods', () => {
  assert.deepEqual(resolveAction('POST', '/api/game/facilities/electronics-factory/recipe'), {
    action: 'setFacilityRecipe',
    category: 'general',
    routePayload: { facilityTypeId: 'electronics-factory' },
  });
  assert.deepEqual(resolveAction('POST', '/api/game/orders/order%3A123/cancel'), {
    action: 'cancelOrder',
    category: 'orders',
    routePayload: { orderId: 'order:123' },
  });
  assert.deepEqual(resolveAction('POST', '/api/game/bank/deposits'), {
    action: 'bankDeposit',
    category: 'general',
  });
  assert.deepEqual(resolveAction('POST', '/api/game/bank/loans/loan%3A123/repay'), {
    action: 'bankRepay',
    category: 'general',
    routePayload: { loanId: 'loan:123' },
  });
  assert.deepEqual(resolveAction('POST', '/api/game/bank/loans/loan%3A123/auto-repay'), {
    action: 'bankSetAutoRepay',
    category: 'general',
    routePayload: { loanId: 'loan:123' },
  });
  assert.equal(resolveAction('GET', '/api/game/orders'), null);
});

test('malformed route encoding is rejected as a client error', () => {
  const isBadRequest = (error) => error.statusCode === 400 && error.message === '请求路径编码无效';
  assert.throws(() => decodeRouteParameter('%E0%A4%A'), isBadRequest);
  assert.throws(() => resolveAction('POST', '/api/game/orders/%E0%A4%A/cancel'), isBadRequest);
});
