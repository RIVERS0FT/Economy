import test from 'node:test';
import assert from 'node:assert/strict';

import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import {
  DEFAULT_FACTORY_AUTO_OPERATION_POLICY,
  deriveFactoryAutoTradePolicies,
  factoryAutoOperationPolicyFor,
  normalizeFactoryAutoOperationPolicy,
} from '../src/factory-auto-operation.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

function inputFacility() {
  for (const type of FACILITY_TYPE_CATALOG) {
    const recipe = type.recipes?.find((candidate) => (candidate.inputs || []).length > 0);
    if (recipe) return { type, recipe };
  }
  throw new Error('catalog needs an input-consuming facility');
}

function product(productId) {
  const value = PRODUCT_CATALOG.find((candidate) => candidate.id === productId);
  assert.ok(value, `missing product ${productId}`);
  return value;
}

function roundedPrice(value) {
  return Math.max(0.01, Math.round(value * 100) / 100);
}

test('missing factory policy uses the low-operation default', () => {
  const { type } = inputFacility();
  const player = { facilityGroups: [] };
  assert.deepEqual(
    factoryAutoOperationPolicyFor(player, DEFAULT_PROVINCE_ID, type.id),
    DEFAULT_FACTORY_AUTO_OPERATION_POLICY,
  );
});

test('old commodity execution policies remain disabled even when factory operation is enabled', () => {
  const { type, recipe } = inputFacility();
  const player = { facilityGroups: [{ facilityTypeId: type.id, enabled: true, count: 3, activeRecipeId: recipe.id }] };
  const before = structuredClone(player);
  const policies = deriveFactoryAutoTradePolicies(player, DEFAULT_PROVINCE_ID);
  assert.ok(Object.values(policies).every((policy) => !policy.buy.enabled && !policy.sell.enabled));
  assert.deepEqual(player, before);
});

test('legacy modes normalize without retaining base-price thresholds or keep exemptions', () => {
  assert.deepEqual(normalizeFactoryAutoOperationPolicy({ enabled: true, inputCoverageCycles: 3, mode: 'supply', outputMode: 'keep' }),
    { enabled: true, inputCoverageCycles: 3, mode: 'balanced', outputMode: 'surplus' });
});

test('invalid factory policy is rejected instead of silently changing strategy', () => {
  assert.equal(normalizeFactoryAutoOperationPolicy({
    enabled: true,
    inputCoverageCycles: 4,
    mode: 'balanced',
    outputMode: 'surplus',
  }), null);
  assert.equal(normalizeFactoryAutoOperationPolicy({
    enabled: true,
    inputCoverageCycles: 2,
    mode: 'unknown',
    outputMode: 'surplus',
  }), null);
});


test('coverage and enablement cannot be coerced from fractional or string input', () => {
  for (const invalid of [
    { enabled: 'true', inputCoverageCycles: 2 },
    { enabled: true, inputCoverageCycles: '2' },
    { enabled: true, inputCoverageCycles: 2.5 },
  ]) {
    assert.equal(normalizeFactoryAutoOperationPolicy({ mode: 'balanced', outputMode: 'surplus', ...invalid }), null);
  }
});
