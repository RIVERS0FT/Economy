import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumeInventoryForSource, freezeInventory, freezeInventoryBatch,
  inventoryFreezeAllocations, inventoryFreezeBreakdown,
  inventoryFrozenForSource, inventoryUsableBySource, releaseInventoryFreeze,
} from '../src/inventory-freezes.js';

const production = { kind: 'production', sourceId: '110000:mill', label: '磨坊' };
const commerce = { kind: 'commercial', sourceId: '110000:store', label: '便利店' };
const stock = (available = 100, frozen = 0) => ({ available, frozen, inTransit: 9 });

test('named freezes conserve goods and distinguish production and commerce', () => {
  const inventory = stock();
  freezeInventory(inventory, production, 40);
  freezeInventory(inventory, commerce, 20);
  assert.equal(inventory.available, 40);
  assert.equal(inventory.frozen, 60);
  assert.equal(inventoryFrozenForSource(inventory, production), 40);
  assert.equal(inventoryUsableBySource(inventory, commerce), 60);
  assert.equal(inventory.inTransit, 9);
  assert.deepEqual(inventoryFreezeBreakdown(inventory).entries.map((row) => row.quantity), [40, 20]);
});

test('consumption uses own freeze before free stock without stealing other allocations', () => {
  const inventory = stock(20);
  freezeInventory(inventory, production, 8);
  freezeInventory(inventory, commerce, 10);
  const before = structuredClone(inventory);
  assert.throws(() => consumeInventoryForSource(inventory, production, 11), /不足/);
  assert.deepEqual(inventory, before);
  consumeInventoryForSource(inventory, production, 9);
  assert.equal(inventory.available, 1);
  assert.equal(inventory.frozen, 10);
  assert.equal(inventoryFrozenForSource(inventory, commerce), 10);
  assert.equal(inventoryFrozenForSource(inventory, production), 0);
});

test('release is source-specific, conservative and does not release legacy escrow', () => {
  const inventory = stock(50, 30);
  freezeInventory(inventory, production, 20);
  assert.throws(() => releaseInventoryFreeze(inventory, production, 21), /超过/);
  releaseInventoryFreeze(inventory, production, 5);
  assert.equal(inventory.available, 35);
  releaseInventoryFreeze(inventory, production);
  assert.equal(inventory.available, 50);
  assert.equal(inventory.frozen, 30);
  assert.equal(inventory.freezeAllocations, undefined);
  assert.equal(releaseInventoryFreeze(inventory, production), 0);
});

test('failed multi-input freeze leaves every inventory untouched', () => {
  const a = stock(5); const b = stock(1);
  assert.throws(() => freezeInventoryBatch([
    { inventory: a, source: production, quantity: 5 },
    { inventory: b, source: production, quantity: 2 },
  ]), /不足/);
  assert.deepEqual(a, stock(5)); assert.deepEqual(b, stock(1));
  assert.throws(() => freezeInventoryBatch([
    { inventory: a, source: production, quantity: 3 },
    { inventory: a, source: commerce, quantity: 3 },
  ]), /不足/);
  assert.deepEqual(a, stock(5));
});

test('multi-input allocations sharing an inventory remain additive', () => {
  const inventory = stock(9);
  assert.equal(freezeInventoryBatch([
    { inventory, source: production, quantity: 5 },
    { inventory, source: commerce, quantity: 4 },
  ]), 9);
  assert.equal(inventory.available, 0);
  assert.equal(inventory.frozen, 9);
});

test('external contract and auction rows explain escrow without double counting', () => {
  const inventory = stock(50, 30);
  freezeInventory(inventory, production, 20);
  const contract = { kind: 'contract', sourceId: 'supply-1', label: '供货合同 supply-1', quantity: 15 };
  const before = structuredClone(inventory);
  const result = inventoryFreezeBreakdown(inventory, [contract, contract,
    { kind: 'auction', sourceId: 'auction-1', quantity: 10 }]);
  assert.equal(result.total, 50);
  assert.deepEqual(result.entries.map((row) => row.quantity), [20, 15, 10, 5]);
  assert.equal(result.entries.reduce((sum, row) => sum + row.quantity, 0), result.total);
  assert.deepEqual(inventory, before);
  result.entries[0].quantity = 999;
  assert.deepEqual(inventory, before);
});

test('unknown legacy freezing and inconsistent source data never become available goods', () => {
  const inventory = stock(0, 10);
  const result = inventoryFreezeBreakdown(inventory, [{ kind: 'contract', sourceId: 'bad', quantity: 11 }]);
  assert.equal(result.inconsistent, true);
  assert.deepEqual(result.entries.map((row) => [row.kind, row.quantity]), [['legacy', 10]]);
  assert.equal(inventory.available, 0);
});

test('invalid quantities, duplicate allocations and overflows fail without mutation', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const inventory = stock();
    assert.throws(() => freezeInventory(inventory, production, value));
    assert.deepEqual(inventory, stock());
  }
  assert.throws(() => inventoryFreezeAllocations({ available: 1, frozen: 2,
    freezeAllocations: [{ ...production, quantity: 3 }] }), /超过/);
  assert.throws(() => inventoryFreezeAllocations({ available: 1, frozen: 2,
    freezeAllocations: [{ ...production, quantity: 1 }, { ...production, quantity: 1 }] }), /重复/);
  assert.throws(() => inventoryFreezeAllocations({ available: Number.MAX_SAFE_INTEGER, frozen: 1 }));
  assert.throws(() => freezeInventory(stock(), { kind: 'invented', sourceId: 'x' }, 1));
});

test('read-only access and zero operations do not install allocations', () => {
  const inventory = stock(0, 0);
  assert.deepEqual(inventoryFreezeAllocations(inventory), []);
  assert.equal(freezeInventory(inventory, production, 0), 0);
  assert.equal(consumeInventoryForSource(inventory, production, 0), 0);
  assert.deepEqual(inventory, stock(0, 0));
});

test('a cross-inventory total overflow fails before either inventory commits', () => {
  const a = stock(Number.MAX_SAFE_INTEGER); const b = stock(1);
  assert.throws(() => freezeInventoryBatch([
    { inventory: a, source: production, quantity: Number.MAX_SAFE_INTEGER },
    { inventory: b, source: commerce, quantity: 1 },
  ]), /安全整数/);
  assert.deepEqual(a, stock(Number.MAX_SAFE_INTEGER));
  assert.deepEqual(b, stock(1));
});
