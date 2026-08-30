import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAction } from '../src/game-routes.js';
import {
  ORDER_EXECUTION_REGISTRY,
  PLAYER_ACTION_REGISTRY,
  getPlayerActionMetadata,
  requireOrderExecutionMetadata,
  requirePlayerActionMetadata,
} from '../src/player-action-registry.js';

const VALID_SCOPES = new Set([
  'local-player',
  'factory',
  'profile',
  'contract',
  'facility-listing',
  'auction',
  'order',
  'save-deletion',
]);

test('every active player action declares interaction metadata and an explicit mutation scope', () => {
  for (const [action, metadata] of Object.entries(PLAYER_ACTION_REGISTRY)) {
    assert.ok(['general', 'orders'].includes(metadata.rateLimitCategory), action);
    assert.ok(['immediate', 'retired'].includes(metadata.acknowledgement), action);
    assert.ok(Number(metadata.latencyBudgetMs) > 0, action);
    if (metadata.lifecycle === 'active') {
      assert.equal(metadata.acknowledgement, 'immediate', action);
      assert.ok(VALID_SCOPES.has(metadata.mutationScope), action);
    } else {
      assert.equal(metadata.mutationScope, 'none', action);
    }
  }
});

test('public action routes use the registry rate-limit category', () => {
  const probes = [
    ['POST', '/api/game/check-in'],
    ['POST', '/api/game/production/settle'],
    ['POST', '/api/game/facilities'],
    ['POST', '/api/game/orders'],
    ['POST', '/api/game/contracts'],
    ['POST', '/api/game/auctions'],
    ['POST', '/api/game/provinces/unlock'],
    ['POST', '/api/game/transport'],
    ['POST', '/api/game/contracts/contract-1/accept'],
    ['POST', '/api/game/auctions/auction-1/bids'],
    ['POST', '/api/game/facilities/farm/start'],
    ['POST', '/api/game/facility-listings/listing-1/buy'],
    ['POST', '/api/game/orders/order-1/cancel'],
  ];
  for (const [method, path] of probes) {
    const route = resolveAction(method, path);
    assert.ok(route, `${method} ${path}`);
    assert.equal(route.category, requirePlayerActionMetadata(route.action).rateLimitCategory);
  }
});

test('order execution modes are explicit and unknown modes are rejected', () => {
  for (const [execution, metadata] of Object.entries(ORDER_EXECUTION_REGISTRY)) {
    assert.equal(requireOrderExecutionMetadata(execution), metadata);
  }
  assert.throws(
    () => requireOrderExecutionMetadata('future-unregistered-execution'),
    { code: 'ORDER_EXECUTION_UNREGISTERED', statusCode: 400 },
  );
});

test('unknown player actions are never treated as registered interactions', () => {
  assert.equal(getPlayerActionMetadata('futureUnregisteredAction'), null);
  assert.throws(
    () => requirePlayerActionMetadata('futureUnregisteredAction'),
    { code: 'PLAYER_ACTION_UNREGISTERED', statusCode: 500 },
  );
});
