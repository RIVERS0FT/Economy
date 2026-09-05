import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import { EconomyStore } from '../src/runtime-store.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;
const fixtureType = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.length);
const fixtureRecipe = fixtureType?.recipes?.[0];
if (!fixtureType || !fixtureRecipe) throw new Error('catalog needs a factory recipe');
const policyKey = provinceScopedKey(DEFAULT_PROVINCE_ID, fixtureType.id);

function request(payload, requestKey) {
  return {
    action: 'placeOrder',
    payload,
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  };
}

function persistedPlayer(store) {
  const row = store.database.prepare(
    'SELECT state_json FROM economy_world_players WHERE user_id = 1',
  ).get();
  return JSON.parse(String(row.state_json));
}

function installFactory(store) {
  store.transaction(() => {
    const loaded = store.loadWorld(now);
    const player = ensurePlayer(loaded.world, alice, now);
    player.facilityGroups = [{
      facilityTypeId: fixtureType.id,
      provinceId: DEFAULT_PROVINCE_ID,
      count: 2,
      participatingCount: 2,
      productionAvailableCount: 2,
      enabled: true,
      status: 'running',
      statusReason: '',
      activeRecipeId: fixtureRecipe.id,
      cycleStartedAt: now,
      lifetimeOutput: 0,
    }];
    store.saveWorld(loaded.revision, loaded.world, now);
  });
}

test('runtime store persists factory automatic operation and returns it in formal client state', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    installFactory(store);
    const activityBefore = persistedPlayer(store).lastEconomicActivityAt;

    const saved = store.apply(alice, request({
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: fixtureType.id,
      execution: 'factory-auto-operation-policy',
      enabled: true,
      inputCoverageCycles: 3,
      mode: 'profit',
      outputMode: 'surplus',
    }, 'factory-auto-operation-12345678'), now + 1);
    assert.equal(saved.result.ok, true, saved.result.message);

    const expected = {
      enabled: true,
      inputCoverageCycles: 3,
      mode: 'balanced',
      outputMode: 'surplus',
    };
    const persisted = persistedPlayer(store);
    assert.deepEqual(persisted.factoryAutoOperationPolicies[policyKey], expected);
    assert.equal(persisted.lastEconomicActivityAt, activityBefore);

    const reloaded = store.getState(alice, now + 2);
    assert.deepEqual(reloaded.factoryAutoOperationPolicies[policyKey], expected);
  } finally {
    store.close();
  }
});

test('runtime store keeps a disabled factory policy while removing its effective commodity execution', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    installFactory(store);
    const saved = store.apply(alice, request({
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: fixtureType.id,
      execution: 'factory-auto-operation-policy',
      enabled: false,
      inputCoverageCycles: 5,
      mode: 'supply',
      outputMode: 'keep',
    }, 'factory-auto-operation-off-12345678'), now + 1);
    assert.equal(saved.result.ok, true, saved.result.message);

    const expected = {
      enabled: false,
      inputCoverageCycles: 5,
      mode: 'balanced',
      outputMode: 'surplus',
    };
    const persisted = persistedPlayer(store);
    assert.deepEqual(persisted.factoryAutoOperationPolicies[policyKey], expected);

    const reloaded = store.getState(alice, now + 2);
    assert.deepEqual(reloaded.factoryAutoOperationPolicies[policyKey], expected);
    assert.deepEqual(reloaded.onlineAutoBuyPolicies, {});
    assert.deepEqual(reloaded.onlineAutoSellPolicies, {});
  } finally {
    store.close();
  }
});

test('runtime store rejects invalid factory automatic operation without persisting it', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    installFactory(store);
    const rejected = store.apply(alice, request({
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: fixtureType.id,
      execution: 'factory-auto-operation-policy',
      enabled: true,
      inputCoverageCycles: 4,
      mode: 'balanced',
      outputMode: 'surplus',
    }, 'factory-auto-operation-invalid-12345678'), now + 1);
    assert.equal(rejected.result.ok, false);
    assert.equal(Object.hasOwn(persistedPlayer(store).factoryAutoOperationPolicies || {}, policyKey), false);
  } finally {
    store.close();
  }
});

test('legacy regional sale action is rejected because sale follows building automatic operation', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    const before = JSON.stringify(persistedPlayer(store));
    const rejected = store.apply(alice, request({ provinceId: DEFAULT_PROVINCE_ID,
      execution: 'factory-auto-operation-policy', operation: 'province-auto-sale', enabled: true,
    }, 'region-auto-sale-retired-12345678'), now + 1);
    assert.equal(rejected.result.ok, false);
    assert.match(rejected.result.message, /已并入建筑自动经营/);
    assert.equal(JSON.stringify(persistedPlayer(store)), before);
  } finally { store.close(); }
});
