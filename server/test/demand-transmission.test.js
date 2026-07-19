import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, processPriceTransmission } from '../src/domain.js';

const now = 1_700_000_000_000;
const cycle = 5 * 60 * 1000;
const realTrade = (world, productId, price, createdAt) => {
  world.markets[productId].priceHistory.push({ price, quantity: 100, createdAt, takerSide: 'buy' });
};

test('upstream cost changes propagate downstream one production edge per cycle', () => {
  const world = createWorld(now);
  realTrade(world, 'wheat', 10, now + cycle - 1);
  const baseFlour = world.priceTransmission.products.flour.referencePrice;
  const baseFood = world.priceTransmission.products.food.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.flour.referencePrice, baseFlour);
  assert.equal(world.priceTransmission.products.food.referencePrice, baseFood);

  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.flour.referencePrice > baseFlour);
  assert.equal(world.priceTransmission.products.food.referencePrice, baseFood);

  processPriceTransmission(world, now + cycle * 3 + 1);
  assert.ok(world.priceTransmission.products.food.referencePrice > baseFood);
});

test('downstream value changes propagate upstream one production edge per cycle', () => {
  const world = createWorld(now);
  world.markets.food.demand.satisfaction = 1;
  realTrade(world, 'food', 45, now + cycle - 1);
  const baseFlour = world.priceTransmission.products.flour.referencePrice;
  const baseWheat = world.priceTransmission.products.wheat.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.flour.referencePrice, baseFlour);
  assert.equal(world.priceTransmission.products.wheat.referencePrice, baseWheat);

  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.flour.referencePrice > baseFlour);
  assert.equal(world.priceTransmission.products.wheat.referencePrice, baseWheat);

  processPriceTransmission(world, now + cycle * 3 + 1);
  assert.ok(world.priceTransmission.products.wheat.referencePrice > baseWheat);
});

test('multi-input downstream value reaches both copper and plastic with lag', () => {
  const world = createWorld(now);
  world.markets.electronics.demand.satisfaction = 1;
  realTrade(world, 'electronics', 120, now + cycle - 1);
  const copperBase = world.priceTransmission.products.copper.referencePrice;
  const plasticBase = world.priceTransmission.products.plastic.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.copper.referencePrice, copperBase);
  assert.equal(world.priceTransmission.products.plastic.referencePrice, plasticBase);

  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.copper.downstreamValueAnchor > copperBase);
  assert.ok(world.priceTransmission.products.plastic.downstreamValueAnchor > plasticBase);
  assert.ok(world.priceTransmission.products.copper.referencePrice > copperBase);
  assert.ok(world.priceTransmission.products.plastic.referencePrice > plasticBase);
});

test('price transmission is damped and also carries price decreases', () => {
  const world = createWorld(now);
  realTrade(world, 'wheat', 1, now + cycle - 1);
  const wheatBase = world.priceTransmission.products.wheat.referencePrice;
  const flourBase = world.priceTransmission.products.flour.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.ok(world.priceTransmission.products.wheat.referencePrice < wheatBase);
  assert.ok(world.priceTransmission.products.wheat.referencePrice >= wheatBase * 0.94);
  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.flour.referencePrice < flourBase);
});


test('hybrid fruit prices respond to beverage value after one relation lag', () => {
  const world = createWorld(now);
  realTrade(world, 'beverage', 32, now + cycle - 1);
  const fruitBase = world.priceTransmission.products.fruit.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.fruit.referencePrice, fruitBase);
  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.fruit.downstreamValueAnchor > fruitBase);
  assert.ok(world.priceTransmission.products.fruit.referencePrice > fruitBase);
});

test('appliance value makes machinery an automatically derived chain product', () => {
  const world = createWorld(now);
  realTrade(world, 'appliance', 120, now + cycle - 1);
  const machineryBase = world.priceTransmission.products.machinery.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.machinery.referencePrice, machineryBase);
  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.machinery.downstreamValueAnchor > machineryBase);
  assert.ok(world.priceTransmission.products.machinery.referencePrice > machineryBase);
});
