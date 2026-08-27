import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROVINCE_ID,
  installDefaultProvinceAliases,
  inventoryForProvince,
  provinceScopedKey,
} from '../src/provinces.js';

const GEORGIA = '310000';

function countOwnKeyScans(target) {
  let scans = 0;
  return {
    record: new Proxy(target, {
      ownKeys(value) {
        scans += 1;
        return Reflect.ownKeys(value);
      },
    }),
    scans: () => scans,
  };
}

test('default province alias installation scans each record only once', () => {
  const defaultKey = provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat');
  const georgiaKey = provinceScopedKey(GEORGIA, 'wheat');
  const observed = countOwnKeyScans({
    [defaultKey]: { price: 4 },
    [georgiaKey]: { price: 7 },
  });

  installDefaultProvinceAliases(observed.record);
  const firstPassScans = observed.scans();
  assert.ok(firstPassScans > 0);
  assert.equal(observed.record.wheat, observed.record[defaultKey]);
  assert.equal(Object.keys(observed.record).includes('wheat'), false);

  for (let index = 0; index < 1_000; index += 1) {
    installDefaultProvinceAliases(observed.record);
  }
  assert.equal(observed.scans(), firstPassScans + 1);
  assert.equal(observed.record[georgiaKey].price, 7);
});

test('inventory lookup performs legacy inventory migration once per inventory record', () => {
  const observed = countOwnKeyScans({
    wheat: { available: 3, frozen: 2 },
  });
  const player = { inventories: observed.record };

  const defaultInventory = inventoryForProvince(player, 'wheat', DEFAULT_PROVINCE_ID);
  const firstPassScans = observed.scans();
  assert.ok(firstPassScans > 0);
  assert.deepEqual(defaultInventory, { available: 3, frozen: 2, inTransit: 0 });

  for (let index = 0; index < 1_000; index += 1) {
    inventoryForProvince(player, 'wheat', GEORGIA);
  }
  assert.equal(observed.scans(), firstPassScans);
  assert.deepEqual(inventoryForProvince(player, 'wheat', GEORGIA), {
    available: 0,
    frozen: 0,
    inTransit: 0,
  });
});
