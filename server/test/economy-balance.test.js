import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/industry-catalog.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from '../src/commercial-catalog.js';
import { auditRecipe, auditCommercial } from '../../scripts/audit-economy-balance.mjs';
import { calculateDailySystemPrice } from '../src/system-price-policy.js';
import { calculateNextGemShopRate } from '../src/gem-shop.js';
import { RESEARCH_TECHNOLOGY_CATALOG } from '../src/research-catalog.js';

const targets = { C1: [80, 75, 70, 65], C2: [70, 70, 67, 65], C3: [75, 80, 70, 75],
  C4: [80, 85, 75, 80], C5: [80, 85, 75, 80], C6: [80, 85, 75, 80], C7: [80, 85, 75, 80] };

test('all 160 industrial plans meet independent fee-inclusive capital targets at base prices', () => {
  let tested = 0;
  for (const type of FACILITY_TYPE_CATALOG) {
    const methods = type.productionMethodGroups[0].methods;
    for (const recipe of type.recipes) {
      const index = methods.findIndex(method => method.id === recipe.productionMethodId);
      const audit = auditRecipe(type, recipe);
      assert.ok(audit.netPerMinute > 0, recipe.id);
      assert.ok(Math.abs(audit.recoveryMinutes - targets[type.complexity][index]) < 1, recipe.id);
      assert.ok(Math.abs(recipe.operatingCost * 100 - Math.round(recipe.operatingCost * 100)) < 1e-8);
      assert.equal(Number.isSafeInteger(recipe.cycleMs / 1000), true);
      for (const item of [...recipe.inputs, recipe.output]) assert.equal(Number.isSafeInteger(item.quantity), true);
      tested += 1;
    }
  }
  assert.equal(tested, 160);
});

test('approved representative industrial costs and commercial absolute profits are anchored', () => {
  const cases = [['farm', 'wheat-crop', 0.97], ['farm', 'wheat-crop--tool-tillage', 1.91],
    ['farm', 'wheat-crop--tractor-farming', 3.21], ['logging-camp', 'logging-camp-default--mechanized-logging', 14.99],
    ['steelworks', 'steelworks-default', 5.11], ['machine-factory', 'machine-factory-default', 11.24],
    ['electronics-factory', 'electronics-factory-default', 13.60], ['appliance-factory', 'appliance-factory-default', 66.59]];
  for (const [typeId, recipeId, expected] of cases) {
    assert.equal(FACILITY_TYPE_CATALOG.find(t => t.id === typeId).recipes.find(r => r.id === recipeId).operatingCost, expected);
  }
  assert.deepEqual(COMMERCIAL_BUILDING_TYPE_CATALOG.map(t => t.profitPerCycle), [4, 4.2, 7.5, 9, 10, 19.2]);
  for (const type of COMMERCIAL_BUILDING_TYPE_CATALOG) {
    assert.equal(type.cycleMs, 300_000);
    assert.ok(Math.abs(auditCommercial(type).recoveryMinutes - 240) < 5);
  }
});

test('new research duration belongs to its stage, not a global six-hour timer', () => {
  const hours = { C1: 0, C2: 0.5, C3: 1, C4: 2, C5: 4, C6: 6, C7: 8 };
  for (const tech of RESEARCH_TECHNOLOGY_CATALOG) assert.equal(tech.durationMs, hours[tech.stage] * 3_600_000, tech.id);
});

test('price quantization is symmetric at the anchor and final cents obey the actual two-percent limit', () => {
  assert.equal(calculateDailySystemPrice({ basePrice: 1.2 }, 1.2, 16, 0).price, 1.2);
  assert.equal(calculateDailySystemPrice({ basePrice: 1.2 }, 1.14, 0, 100_000).price, 1.12);
  const up = calculateDailySystemPrice({ basePrice: 7 }, 7, 1_000_000, 0);
  const down = calculateDailySystemPrice({ basePrice: 7 }, 7, 0, 1_000_000);
  assert.deepEqual([up.price, down.price, up.changeBps, down.changeBps], [7.14, 6.86, 200, -200]);
  assert.equal(calculateDailySystemPrice({ basePrice: 7 }, 10, 0, 0).price, 10);
  assert.ok(calculateDailySystemPrice({ basePrice: 7 }, 10, 50, 50).price < 10);
  assert.ok(calculateDailySystemPrice({ basePrice: 7 }, 4, 50, 50).price > 4);
});

for (const days of [7, 30, 90]) {
  test(`${days}-day deterministic price paths retain bounds, ticks and zero-volume identity for every product`, () => {
    for (const product of PRODUCT_CATALOG) for (const direction of [-1, 0, 1]) {
      let price = product.basePrice;
      for (let day = 0; day < days; day += 1) {
        const buy = direction >= 0 ? 100_000 + day : 0;
        const sell = direction <= 0 ? 100_000 + day : 0;
        const next = calculateDailySystemPrice(product, price, buy, sell);
        const before = Math.round(price * 100), after = Math.round(next.price * 100);
        assert.ok(Math.abs(after - before) * 100 <= before * 2, product.id);
        assert.ok(after >= Math.ceil(product.basePrice * 50 - 1e-9) && after <= Math.round(product.basePrice * 300));
        assert.equal(calculateDailySystemPrice(product, next.price, 0, 0).price, next.price);
        price = next.price;
      }
    }
  });
}

test('gem quotes below five decisions return toward neutral without overshooting or large jumps', () => {
  for (const previousRate of [1, 19, 95, 99, 100, 101, 105, 1100, 9999, 10000]) {
    for (const acceptedCount of [0, 1, 4]) {
      const next = calculateNextGemShopRate({ previousRate, acceptedCount, yesterdayEffectiveGems: 1_000_000,
        recentEffectiveGems: [1] }).creditsPerGem;
      assert.ok(Math.abs(next - previousRate) <= Math.max(1, Math.floor(previousRate * 0.05)));
      assert.ok(next >= Math.min(previousRate, 100) && next <= Math.max(previousRate, 100));
    }
  }
  assert.equal(calculateNextGemShopRate({ previousRate: 101, rejectedCount: 4 }).creditsPerGem, 100);
});
