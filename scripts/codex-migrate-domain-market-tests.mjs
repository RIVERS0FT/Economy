import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const path = 'server/test/domain.test.js';
let source = readFileSync(path, 'utf8');

function replaceBetween(start, next, replacement) {
  const a = source.indexOf(start);
  if (a < 0) throw new Error(`missing start: ${start}`);
  const b = source.indexOf(next, a + start.length);
  if (b < 0) throw new Error(`missing next: ${next}`);
  source = `${source.slice(0, a)}${replacement.trimEnd()}\n\n${source.slice(b)}`;
}
function replaceOnce(oldText, newText) {
  if (!source.includes(oldText)) throw new Error(`missing replacement: ${oldText.slice(0, 80)}`);
  source = source.replace(oldText, newText);
}

replaceBetween(
  "test('different products never match in the same order book', () => {",
  "test('version 1 state migrates inventory and commodity orders without losing assets'",
  `test('different products settle independently at their daily official prices without a shared player order book', () => {
  const world = createWorld(now);
  deferDemand(world);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  buyer.inventories.ore.available = 0;
  buyer.inventories.wheat.available = 0;
  seller.inventories.ore.available = 10;
  seller.credits = 0;
  buyer.credits = 1_000;

  const orePrice = world.markets.ore.officialPrice;
  const wheatPrice = world.markets.wheat.officialPrice;
  const oreSell = applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 5, price: 6,
  }, now + 1);
  const wheatBuy = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 5, price: 9,
  }, now + 2);
  const oreBuy = applyAction(world, alice, 'placeOrder', {
    productId: 'ore', side: 'buy', quantity: 3, price: 9,
  }, now + 3);

  assert.equal(oreSell.ok, true);
  assert.equal(wheatBuy.ok, true);
  assert.equal(oreBuy.ok, true);
  assert.equal(oreSell.executedPrice, orePrice);
  assert.equal(wheatBuy.executedPrice, wheatPrice);
  assert.equal(oreBuy.executedPrice, orePrice);
  assert.equal(seller.inventories.ore.available, 5);
  assert.equal(seller.inventories.ore.frozen, 0);
  assert.equal(buyer.inventories.wheat.available, 5);
  assert.equal(buyer.inventories.ore.available, 3);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
}`,
);

replaceOnce(
  `  assert.equal(world.players['1'].inventories.wheat.available, 7);\n  assert.equal(world.players['1'].inventories.wheat.frozen, 2);\n  assert.equal(world.orders[0].productId, 'wheat');`,
  `  assert.equal(world.players['1'].inventories.wheat.available, 8);\n  assert.equal(world.players['1'].inventories.wheat.frozen, 1);\n  assert.equal(world.orders[0].productId, 'wheat');\n  assert.equal(world.orders[0].status, 'cancelled');`,
);
replaceOnce(
  `  assert.deepEqual(player.inventories.wheat, { available: 7, frozen: 3, inTransit: 0 });\n  assert.equal(Object.hasOwn(player.inventories, 'grain'), false);\n  assert.equal(world.orders[0].assetId, 'wheat');`,
  `  assert.deepEqual(player.inventories.wheat, { available: 10, frozen: 0, inTransit: 0 });\n  assert.equal(Object.hasOwn(player.inventories, 'grain'), false);\n  assert.equal(world.orders[0].assetId, 'wheat');\n  assert.equal(world.orders[0].status, 'cancelled');`,
);

replaceBetween(
  "test('market demand retains partially filled carried orders and publishes a cent-priced next curve', () => {",
  "test('population-funded market demand does not scale with active player count'",
  `test('market demand retains a partially filled internal carried order and publishes a cent-priced next curve', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  deferDemand(world, now + 10 * cycleMs);
  prepareDemand(world, 'food', now + 1);
  processWorld(world, now + 1);

  const firstCycleId = world.demandGroups.food.lastCycleId;
  const carried = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && order.demandCycleId === firstCycleId
    && order.status === 'open'
    && order.quantity > 1
  ));
  assert.ok(carried);
  carried.status = 'partial';
  carried.remaining = carried.quantity - 1;
  carried.fills = [{
    id: 'internal-partial-fill',
    quantity: 1,
    price: carried.price,
    total: carried.price,
    createdAt: now + 2,
    takerSide: 'sell',
  }];
  carried.lastFilledAt = now + 2;

  prepareDemand(world, 'food', now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);
  const nextCycleId = world.demandGroups.food.lastCycleId;
  assert.ok(nextCycleId > firstCycleId);
  assert.equal(world.orders.some((order) => (
    order.id === carried.id
    && (order.status === 'open' || order.status === 'partial')
  )), true);
  const nextOrder = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && order.demandCycleId === nextCycleId
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(nextOrder);
  assert.equal(nextOrder.price, Number(nextOrder.price.toFixed(2)));
}`,
);

replaceBetween(
  "test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {",
  "test('beverage production paths shift toward cheaper fruit inputs'",
  `test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {
  const world = createWorld(now);
  ensurePlayer(world, bob, now);
  world.priceTransmission.products.wheat.referencePrice = 6;
  world.priceTransmission.products.rice.referencePrice = 2;

  prepareDemand(world, 'food', now + 3);
  processWorld(world, now + 3);
  const shares = world.demandGroups.food.lastClassAllocation.basic.staples.shares;
  assert.ok(shares.rice > shares.wheat);
  assert.ok(world.demandGroups.food.lastBudget > 0);
}`,
);
replaceBetween(
  "test('complement gating prioritizes the bottleneck input for electronics', () => {",
  "test('downstream price signals move upstream only after relation lag cycles'",
  `test('complement gating prioritizes the bottleneck input for electronics', () => {
  const world = createWorld(now);
  ensurePlayer(world, bob, now);
  world.priceTransmission.products.plastic.referencePrice = 24;

  prepareDemand(world, 'household', now + 2);
  processWorld(world, now + 2);
  const allocation = world.demandGroups.household.lastAllocation;
  assert.ok(allocation.copper.requiredQuantity > allocation.plastic.requiredQuantity);
  const relations = world.demandGroups.household.lastDerivedRelations
    .filter((item) => item.outputProductId === 'electronics');
  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate
    > relations.find((item) => item.inputProductId === 'plastic').complementGate);
}`,
);

replaceOnce(
  `  assert.deepEqual(world.orders.map((order) => order.id), ['player-wheat-sell']);\n  assert.equal(player.inventories.wheat.available, 2);`,
  `  assert.deepEqual(world.orders.map((order) => order.id), ['player-wheat-sell']);\n  assert.equal(world.orders[0].status, 'cancelled');\n  assert.equal(player.inventories.wheat.available, 2);`,
);
replaceOnce(
  `  assert.deepEqual(world.orders.map((order) => order.id), ['player-order-v2']);\n  assert.equal(player.credits, 777);`,
  `  assert.deepEqual(world.orders.map((order) => order.id), ['player-order-v2']);\n  assert.equal(world.orders[0].status, 'cancelled');\n  assert.equal(player.credits, 777);`,
);
replaceOnce(
  `  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);\n  assert.equal(player.credits, 777);`,
  `  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);\n  assert.equal(world.orders[0].status, 'cancelled');\n  assert.equal(player.credits, 777);`,
);

replaceBetween(
  "test('commodity order fills preserve every exact player resting price without system liquidity', () => {",
  '',
  ''
);
