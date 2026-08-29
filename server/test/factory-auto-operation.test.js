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

test('factory policy aggregates extra input coverage into product execution policy', () => {
  const { type, recipe } = inputFacility();
  const input = recipe.inputs[0];
  const output = recipe.output;
  const player = {
    facilityGroups: [{
      facilityTypeId: type.id,
      provinceId: DEFAULT_PROVINCE_ID,
      count: 2,
      participatingCount: 2,
      enabled: true,
      status: 'running',
      activeRecipeId: recipe.id,
    }],
    factoryAutoOperationPolicies: {
      [provinceScopedKey(DEFAULT_PROVINCE_ID, type.id)]: {
        enabled: true,
        inputCoverageCycles: 3,
        mode: 'balanced',
        outputMode: 'surplus',
      },
    },
  };

  const policies = deriveFactoryAutoTradePolicies(player, DEFAULT_PROVINCE_ID);
  assert.equal(policies[input.productId].buy.enabled, true);
  assert.equal(
    policies[input.productId].buy.targetFreeInventory,
    input.quantity * 2 * 2,
    'one cycle stays in productionReserved; policy stores only the extra two cycles',
  );
  assert.equal(
    policies[input.productId].buy.maxPrice,
    roundedPrice(product(input.productId).basePrice * 1.05),
  );
  assert.equal(policies[output.productId].sell.enabled, true);
  assert.equal(
    policies[output.productId].sell.price,
    roundedPrice(product(output.productId).basePrice),
  );
});

test('keep output disables automatic selling while preserving input purchasing', () => {
  const { type, recipe } = inputFacility();
  const input = recipe.inputs[0];
  const player = {
    facilityGroups: [{
      facilityTypeId: type.id,
      provinceId: DEFAULT_PROVINCE_ID,
      count: 1,
      participatingCount: 1,
      enabled: true,
      status: 'running',
      activeRecipeId: recipe.id,
    }],
    factoryAutoOperationPolicies: {
      [provinceScopedKey(DEFAULT_PROVINCE_ID, type.id)]: {
        enabled: true,
        inputCoverageCycles: 2,
        mode: 'supply',
        outputMode: 'keep',
      },
    },
  };

  const policies = deriveFactoryAutoTradePolicies(player, DEFAULT_PROVINCE_ID);
  assert.equal(policies[input.productId].buy.enabled, true);
  assert.equal(policies[recipe.output.productId].sell.enabled, false);
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
