from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    Path(path).write_text(content, encoding='utf-8')


def replace_once(text, old, new, path):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:100]!r}')
    return text.replace(old, new, 1)


def replace_between(text, start_marker, end_marker, replacement, path):
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    return text[:start] + replacement + text[end:]


# server/src/domain.js: dynamic demand authority, activity migration and world v13.
path = 'server/src/domain.js'
text = read(path)
text = replace_once(text, "const PRICE_BASE_REVERSION = 0.02;", """const PRICE_BASE_REVERSION = 0.02;
const ACTIVE_PLAYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEMAND_PLAYER_SCALE_MAX = 6;
const DEMAND_INVENTORY_BOOST_RATE = 0.10;
const DEMAND_INVENTORY_BOOST_MAX_SHARE = 0.40;
const DEMAND_BUDGET_SMOOTHING = 0.35;
const DEMAND_BUDGET_MAX_RISE = 0.20;
const DEMAND_BUDGET_MAX_FALL = 0.20;
const DEMAND_STOCK_TARGET_CYCLES = 3;""", path)
text = text.replace('baseBudget: 500,', 'baseBudget: 1_000,', 1)
text = text.replace('baseBudget: 480,', 'baseBudget: 900,', 1)
text = replace_once(text, """function marketFor(world, productId) {
  return balancedMarket.marketFor(world, productId);
}

function defaultDemandGroupState(group, now) {""", """function marketFor(world, productId) {
  return balancedMarket.marketFor(world, productId);
}

function normalizePlayerActivity(world, now) {
  world.players ||= {};
  const latestOrderAt = new Map();
  for (const order of world.orders || []) {
    if (order.ownerType !== 'player' || !Number.isFinite(Number(order.ownerId))) continue;
    const ownerId = String(order.ownerId);
    latestOrderAt.set(ownerId, Math.max(latestOrderAt.get(ownerId) || 0, Number(order.createdAt || 0)));
  }
  for (const [playerId, player] of Object.entries(world.players)) {
    if (Number.isFinite(Number(player.lastEconomicActivityAt)) && Number(player.lastEconomicActivityAt) > 0) continue;
    const tradeAt = (player.trades || []).reduce((latest, item) => Math.max(latest, Number(item.createdAt || 0)), 0);
    const ledgerAt = (player.ledger || []).reduce((latest, item) => Math.max(latest, Number(item.createdAt || 0)), 0);
    player.lastEconomicActivityAt = Math.max(
      Number(player.registeredAt || 0),
      Number(player.work?.lastWorkedAt || 0),
      latestOrderAt.get(playerId) || 0,
      tradeAt,
      ledgerAt,
      now,
    );
  }
}

function defaultDemandGroupState(group, now) {""", path)
text = replace_once(text, """    lastBudget: group.baseBudget,
    lastCommitted: 0,
    satisfaction: 0,
    lastAllocation: {},""", """    lastBudget: group.baseBudget,
    lastTargetBudget: 0,
    lastPlayerScaleBudget: group.baseBudget,
    lastInventoryBoost: 0,
    lastActivePlayerCount: 0,
    lastStockValue: 0,
    lastCommitted: 0,
    satisfaction: 0,
    lastAllocation: {},""", path)
text = replace_once(text, """function normalizeDemandWorld(world, now = Date.now()) {
  world.demandGroups ||= {};""", """function normalizeDemandWorld(world, now = Date.now()) {
  normalizePlayerActivity(world, now);
  world.demandGroups ||= {};""", path)
text = replace_once(text, """    if (!Number.isFinite(Number(state.nextDemandAt))) state.nextDemandAt = now + group.cycleMs;
    if (!Number.isFinite(Number(state.lastCycleId))) state.lastCycleId = Math.floor(now / group.cycleMs);
    if (!state.lastAllocation || typeof state.lastAllocation !== 'object') state.lastAllocation = {};
    normalizedGroups[group.id] = state;""", """    if (!Number.isFinite(Number(state.nextDemandAt))) state.nextDemandAt = now + group.cycleMs;
    if (!Number.isFinite(Number(state.lastCycleId))) state.lastCycleId = Math.floor(now / group.cycleMs);
    state.lastBudget = Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget)));
    state.lastTargetBudget = Math.max(0, Math.floor(Number(state.lastTargetBudget || 0)));
    state.lastPlayerScaleBudget = Math.max(0, Math.floor(Number(state.lastPlayerScaleBudget || group.baseBudget)));
    state.lastInventoryBoost = Math.max(0, Math.floor(Number(state.lastInventoryBoost || 0)));
    state.lastActivePlayerCount = Math.max(0, Math.floor(Number(state.lastActivePlayerCount || 0)));
    state.lastStockValue = Math.max(0, Number(state.lastStockValue || 0));
    if (!state.lastAllocation || typeof state.lastAllocation !== 'object') state.lastAllocation = {};
    normalizedGroups[group.id] = state;""", path)

new_demand_block = r'''function activePlayerCount(world, now) {
  const cutoff = now - ACTIVE_PLAYER_WINDOW_MS;
  const count = Object.values(world.players || {}).filter((player) => (
    Number(player.lastEconomicActivityAt || 0) >= cutoff
  )).length;
  return Math.max(1, count);
}

function demandStockSnapshot(world, group) {
  const byProduct = Object.fromEntries(group.products.map((option) => {
    const product = productDefinition(option.productId);
    const priceState = world.priceTransmission.products[product.id];
    const referencePrice = Math.max(0.01, Number(priceState?.referencePrice || product.basePrice));
    const quantity = Object.values(world.players || {}).reduce((sum, player) => {
      const inventory = player.inventories?.[product.id] || {};
      return sum + Math.max(0, Number(inventory.available || 0)) + Math.max(0, Number(inventory.frozen || 0));
    }, 0);
    return [product.id, { quantity, referencePrice, value: quantity * referencePrice }];
  }));
  return {
    byProduct,
    totalValue: Object.values(byProduct).reduce((sum, item) => sum + item.value, 0),
  };
}

function dynamicDemandBudget(world, group, state, now, stockSnapshot) {
  const activePlayers = activePlayerCount(world, now);
  const playerScale = Math.min(DEMAND_PLAYER_SCALE_MAX, Math.max(1, 0.5 + 0.5 * Math.sqrt(activePlayers)));
  const playerScaleBudget = Math.max(1, Math.floor(group.baseBudget * playerScale));
  const inventoryBoost = Math.max(0, Math.floor(Math.min(
    playerScaleBudget * DEMAND_INVENTORY_BOOST_MAX_SHARE,
    stockSnapshot.totalValue * DEMAND_INVENTORY_BOOST_RATE,
  )));
  const targetBudget = playerScaleBudget + inventoryBoost;
  const previousBudget = Math.max(1, Math.floor(Number(state.lastBudget || group.baseBudget)));
  let budget = targetBudget;
  if (Number(state.lastTargetBudget || 0) > 0) {
    const smoothed = Math.round(previousBudget * (1 - DEMAND_BUDGET_SMOOTHING) + targetBudget * DEMAND_BUDGET_SMOOTHING);
    const minimum = Math.ceil(previousBudget * (1 - DEMAND_BUDGET_MAX_FALL));
    const maximum = Math.floor(previousBudget * (1 + DEMAND_BUDGET_MAX_RISE));
    budget = Math.max(minimum, Math.min(maximum, smoothed));
  }
  return { activePlayers, playerScale, playerScaleBudget, inventoryBoost, targetBudget, budget };
}

function createGroupedDemand(world, groupId, now) {
  const group = DEMAND_GROUPS.get(groupId);
  if (!group) return;
  normalizeDemandWorld(world, now);
  const state = world.demandGroups[group.id];
  const cycleId = Math.floor(now / group.cycleMs);
  if (Number(state.lastCycleId) === cycleId) {
    state.nextDemandAt = (cycleId + 1) * group.cycleMs;
    return;
  }

  expireDemandGroupOrders(world, group.id);
  const stockSnapshot = demandStockSnapshot(world, group);
  const dynamicBudget = dynamicDemandBudget(world, group, state, now, stockSnapshot);
  const cycleBudget = dynamicBudget.budget;
  const choices = group.products.map((option) => {
    const product = productDefinition(option.productId);
    const priceState = world.priceTransmission.products[product.id];
    const limitPrice = Math.max(1, Math.round(Number(priceState.referencePrice || product.basePrice)));
    const { quote, quoteQuantity } = demandQuote(world, product, group, option, limitPrice);
    const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));
    const priceIndex = quote / limitPrice;
    const stock = stockSnapshot.byProduct[product.id];
    const targetStockValue = Math.max(
      1,
      dynamicBudget.playerScaleBudget * option.baseBudgetWeight * DEMAND_STOCK_TARGET_CYCLES,
    );
    const stockRatio = stock.value / targetStockValue;
    const inventoryFactor = Math.max(0.7, Math.min(1.8, 0.7 + 0.3 * Math.sqrt(stockRatio)));
    const score = priceIndex <= group.maxQuoteIndex
      ? option.baseBudgetWeight * priceIndex ** -group.priceElasticity * inventoryFactor
      : 0;
    return {
      option,
      product,
      utilityPerUnit,
      quote,
      quoteQuantity,
      priceIndex,
      stock,
      targetStockValue,
      stockRatio,
      inventoryFactor,
      score,
      maxBudget: Math.floor(cycleBudget * option.maxBudgetShare),
      limitPrice,
      quantity: 0,
      committed: 0,
    };
  });

  const budgetTargets = allocateDemandBudgets(choices, cycleBudget);
  for (const choice of choices) {
    const target = budgetTargets.get(choice.product.id) || 0;
    choice.quantity = choice.score > 0 ? Math.floor(target / choice.limitPrice) : 0;
    choice.committed = choice.quantity * choice.limitPrice;
  }

  let remainingBudget = cycleBudget - choices.reduce((sum, choice) => sum + choice.committed, 0);
  const remainderOrder = [...choices].sort((left, right) => (
    left.priceIndex - right.priceIndex
    || right.score - left.score
    || left.product.id.localeCompare(right.product.id)
  ));
  let progressed = true;
  while (progressed && remainingBudget > 0) {
    progressed = false;
    for (const choice of remainderOrder) {
      if (choice.score <= 0 || remainingBudget < choice.limitPrice) continue;
      if (choice.committed + choice.limitPrice > choice.maxBudget) continue;
      choice.quantity += 1;
      choice.committed += choice.limitPrice;
      remainingBudget -= choice.limitPrice;
      progressed = true;
    }
  }

  let requestedUtility = 0;
  let filledUtility = 0;
  const allocation = {};
  for (const choice of choices) {
    const market = marketFor(world, choice.product.id);
    const requestedChoiceUtility = choice.quantity * choice.utilityPerUnit;
    requestedUtility += requestedChoiceUtility;
    allocation[choice.product.id] = {
      tier: choice.product.populationDemandTier,
      referencePrice: Number(world.priceTransmission.products[choice.product.id].referencePrice.toFixed(4)),
      quote: Number(choice.quote.toFixed(4)),
      quoteQuantity: choice.quoteQuantity,
      priceIndex: Number(choice.priceIndex.toFixed(4)),
      utilityPerUnit: choice.utilityPerUnit,
      stockQuantity: choice.stock.quantity,
      stockValue: Number(choice.stock.value.toFixed(4)),
      targetStockValue: Number(choice.targetStockValue.toFixed(4)),
      stockRatio: Number(choice.stockRatio.toFixed(4)),
      inventoryFactor: Number(choice.inventoryFactor.toFixed(4)),
      budget: choice.committed,
      quantity: choice.quantity,
      requestedUtility: requestedChoiceUtility,
      filledUtility: 0,
    };
    market.demand.lastPrice = choice.limitPrice;
    market.demand.lastQuantity = choice.quantity;
    market.demand.lastBudget = choice.committed;
    market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
    market.demand.satisfaction = 0;
    if (choice.quantity < 1) continue;
    const order = {
      id: `population-order-${randomUUID()}`,
      assetKind: 'commodity',
      assetId: choice.product.id,
      productId: choice.product.id,
      side: 'buy',
      ownerType: 'population',
      ownerName: group.ownerName,
      demandGroupId: group.id,
      demandTier: choice.product.populationDemandTier,
      demandCycleId: cycleId,
      price: choice.limitPrice,
      quantity: choice.quantity,
      remaining: choice.quantity,
      status: 'open',
      createdAt: now,
    };
    world.orders.push(order);
    balancedMarket.matchOrder(world, order, now);
    const filled = choice.quantity - order.remaining;
    const filledChoiceUtility = filled * choice.utilityPerUnit;
    filledUtility += filledChoiceUtility;
    allocation[choice.product.id].filledUtility = filledChoiceUtility;
    market.demand.satisfaction = choice.quantity === 0 ? 0 : filled / choice.quantity;
  }

  state.lastCycleId = cycleId;
  state.nextDemandAt = (cycleId + 1) * group.cycleMs;
  state.lastBudget = cycleBudget;
  state.lastTargetBudget = dynamicBudget.targetBudget;
  state.lastPlayerScaleBudget = dynamicBudget.playerScaleBudget;
  state.lastInventoryBoost = dynamicBudget.inventoryBoost;
  state.lastActivePlayerCount = dynamicBudget.activePlayers;
  state.lastStockValue = Number(stockSnapshot.totalValue.toFixed(4));
  state.lastCommitted = choices.reduce((sum, choice) => sum + choice.committed, 0);
  state.satisfaction = requestedUtility === 0 ? 0 : filledUtility / requestedUtility;
  state.lastAllocation = allocation;
}

'''
text = replace_between(text, 'function createGroupedDemand(world, groupId, now) {', 'function processPopulationDemand(world, now) {', new_demand_block, path)
text = text.replace('world.version = 12;', 'world.version = 13;')
text = text.replace('return previousVersion >= 12 && isValidPopulationOrder(order);', 'return previousVersion >= 13 && isValidPopulationOrder(order);')
text = replace_once(text, """  if (previousVersion < 12) {
    for (const group of DEMAND_GROUP_CATALOG) {
      const state = normalized.demandGroups[group.id];
      state.nextDemandAt = now;
      state.lastCycleId = Math.floor(now / group.cycleMs) - 1;
      state.lastCommitted = 0;
      state.satisfaction = 0;
      state.lastAllocation = {};
    }
  }
  normalized.version = 13;""", """  if (previousVersion < 13) {
    for (const group of DEMAND_GROUP_CATALOG) {
      const state = normalized.demandGroups[group.id];
      const previousBudget = Math.max(1, Math.floor(Number(state.lastBudget || group.baseBudget)));
      state.nextDemandAt = now;
      state.lastCycleId = Math.floor(now / group.cycleMs) - 1;
      state.lastBudget = previousBudget;
      state.lastTargetBudget = previousBudget;
      state.lastPlayerScaleBudget = previousBudget;
      state.lastInventoryBoost = 0;
      state.lastActivePlayerCount = 0;
      state.lastStockValue = 0;
      state.lastCommitted = 0;
      state.satisfaction = 0;
      state.lastAllocation = {};
    }
  }
  normalized.version = 13;""", path)
write(path, text)

# Compatibility core and all world serializers must preserve v13.
path = 'server/src/domain-core.js'
text = read(path)
text = text.replace('baseBudget: 500,', 'baseBudget: 1_000,', 1)
text = text.replace('baseBudget: 480,', 'baseBudget: 900,', 1)
text = text.replace('version: 12,', 'version: 13,')
text = text.replace('world.version = 12;', 'world.version = 13;')
write(path, text)

for path in ['server/src/facility-groups.js', 'server/src/storage.js', 'server/src/asset-events.js']:
    text = read(path).replace('world.version = 12;', 'world.version = 13;')
    write(path, text)

# Successful economic writes refresh activity; reads and failed writes do not.
path = 'server/src/storage.js'
text = read(path)
text = replace_once(text, """const COLLECTIBLE_ACTIONS = new Set([
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
]);""", """const COLLECTIBLE_ACTIONS = new Set([
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
]);
const ECONOMIC_ACTIVITY_ACTIONS = new Set([
  'work', 'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe',
  'collectFacility', 'placeOrder', 'cancelOrder', 'listFacility',
  'cancelFacilityListing', 'buyFacility', 'upgradeWarehouse', 'redeemGift',
  'exchangeGems', 'createCollectibleAuction', 'placeCollectibleBid',
  'cancelCollectibleAuction', 'resetPlayer',
]);""", path)
text = replace_once(text, """      } else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now);
      }
      processFacilityGroupWorld(world, now);""", """      } else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now);
      }
      if (gameResult?.ok && ECONOMIC_ACTIVITY_ACTIONS.has(action)) {
        const activePlayer = world.players[String(user.id)];
        if (activePlayer) activePlayer.lastEconomicActivityAt = now;
      }
      processFacilityGroupWorld(world, now);""", path)
text = replace_once(text, """        apiStatus: 'ok',
      };""", """        apiStatus: 'ok',
        demandGroups: Object.fromEntries(Object.entries(world.demandGroups || {}).map(([groupId, group]) => [groupId, {
          lastBudget: Number(group.lastBudget || 0),
          lastTargetBudget: Number(group.lastTargetBudget || 0),
          lastPlayerScaleBudget: Number(group.lastPlayerScaleBudget || 0),
          lastInventoryBoost: Number(group.lastInventoryBoost || 0),
          lastActivePlayerCount: Number(group.lastActivePlayerCount || 0),
          lastStockValue: Number(group.lastStockValue || 0),
          lastCommitted: Number(group.lastCommitted || 0),
          satisfaction: Number(group.satisfaction || 0),
        }])),
      };""", path)
write(path, text)

# Server tests: dynamic scale, inventory response, migration, activity semantics.
path = 'server/test/domain.test.js'
text = read(path)
text = text.replace("test('population demand only creates food and household orders within fixed budgets'", "test('population demand only creates food and household orders within dynamic budgets'", 1)
text = text.replace('assert.ok(world.demandGroups.food.lastCommitted <= 500);', "assert.equal(world.demandGroups.food.lastBudget, 1_000);\n  assert.ok(world.demandGroups.food.lastCommitted <= world.demandGroups.food.lastBudget);", 1)
text = text.replace('assert.ok(world.demandGroups.household.lastCommitted <= 480);', "assert.equal(world.demandGroups.household.lastBudget, 900);\n  assert.ok(world.demandGroups.household.lastCommitted <= world.demandGroups.household.lastBudget);", 1)
insert_marker = "test('new worlds create population demand during the first authoritative state read', () => {"
new_tests = r'''test('population demand scales sublinearly with active players and stops at the configured cap', () => {
  const foodBudgetFor = (playerCount) => {
    const world = createWorld(now);
    for (let index = 1; index <= playerCount; index += 1) {
      ensurePlayer(world, { id: index, email: `player-${index}@example.com`, name: `Player ${index}` }, now);
    }
    prepareDemand(world, 'food');
    prepareDemand(world, 'household');
    processWorld(world, now + 1);
    return {
      food: world.demandGroups.food.lastBudget,
      household: world.demandGroups.household.lastBudget,
      active: world.demandGroups.food.lastActivePlayerCount,
    };
  };

  assert.deepEqual([1, 4, 9, 25, 121].map((count) => foodBudgetFor(count).food), [1_000, 1_500, 2_000, 3_000, 6_000]);
  assert.deepEqual([1, 4, 9, 25, 121].map((count) => foodBudgetFor(count).household), [900, 1_350, 1_800, 2_700, 5_400]);
  assert.equal(foodBudgetFor(144).active, 144);
  assert.equal(foodBudgetFor(144).food, 6_000);
});

test('inactive players stop scaling demand after seven days', () => {
  const world = createWorld(now);
  for (let index = 1; index <= 9; index += 1) {
    const player = ensurePlayer(world, { id: index, email: `inactive-${index}@example.com`, name: `Inactive ${index}` }, now);
    if (index > 1) player.lastEconomicActivityAt = now - 8 * 24 * 60 * 60 * 1000;
  }
  prepareDemand(world, 'food');
  processWorld(world, now + 1);
  assert.equal(world.demandGroups.food.lastActivePlayerCount, 1);
  assert.equal(world.demandGroups.food.lastBudget, 1_000);
});

test('population demand grows with stock value and favors stocked products without double counting frozen inventory', () => {
  const demandWithWheat = (available, frozen) => {
    const world = createWorld(now);
    const player = ensurePlayer(world, alice, now);
    player.inventories.wheat.available = available;
    player.inventories.wheat.frozen = frozen;
    prepareDemand(world, 'food');
    processWorld(world, now + 1);
    return world.demandGroups.food;
  };

  const empty = demandWithWheat(0, 0);
  const stocked = demandWithWheat(10_000, 0);
  const availableOnly = demandWithWheat(10, 0);
  const splitAvailableFrozen = demandWithWheat(5, 5);

  assert.equal(empty.lastBudget, 1_000);
  assert.equal(stocked.lastBudget, 1_400);
  assert.equal(stocked.lastInventoryBoost, 400);
  assert.equal(stocked.lastStockValue, 20_000);
  assert.ok(stocked.lastAllocation.wheat.budget > empty.lastAllocation.wheat.budget);
  assert.ok(empty.lastAllocation.wheat.quantity > 0);
  assert.equal(availableOnly.lastStockValue, splitAvailableFrozen.lastStockValue);
  assert.equal(availableOnly.lastBudget, splitAvailableFrozen.lastBudget);
});

test('state polling and failed actions do not refresh economic activity', () => {
  const store = new EconomyStore(':memory:');
  try {
    const first = store.getStateSnapshot(alice, undefined, now);
    const firstWorld = JSON.parse(String(store.selectWorld.get().state_json));
    const initialActivity = firstWorld.players[String(alice.id)].lastEconomicActivityAt;

    store.getStateSnapshot(alice, first.revision, now + 1_000);
    const afterPoll = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(afterPoll.players[String(alice.id)].lastEconomicActivityAt, initialActivity);

    const success = store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'activity-success', method: 'POST', path: '/api/game/work',
    }, now + 10_000);
    assert.equal(success.result.ok, true);
    const afterSuccess = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(afterSuccess.players[String(alice.id)].lastEconomicActivityAt, now + 10_000);

    const failure = store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'activity-failure', method: 'POST', path: '/api/game/work',
    }, now + 10_001);
    assert.equal(failure.result.ok, false);
    const afterFailure = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(afterFailure.players[String(alice.id)].lastEconomicActivityAt, now + 10_000);
  } finally {
    store.close();
  }
});

'''
text = replace_once(text, insert_marker, new_tests + insert_marker, path)
old_migration_start = "test('world version 11 migration immediately rebuilds current-cycle population demand', () => {"
new_migration = r'''test('world version 12 migration immediately rebuilds smoothed dynamic population demand', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.wheat.available = 2;
  world.version = 12;
  world.demandGroups.food.lastBudget = 500;
  world.demandGroups.household.lastBudget = 480;
  delete world.demandGroups.food.lastTargetBudget;
  delete world.demandGroups.household.lastTargetBudget;
  world.orders = [{
    id: 'player-wheat-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
    price: 99, quantity: 2, remaining: 2, status: 'open', createdAt: now,
  }];
  for (const group of Object.values(world.demandGroups)) {
    group.nextDemandAt = now + 5 * 60 * 1000;
    group.lastCycleId = Math.floor(now / group.cycleMs);
    group.lastCommitted = group.lastBudget;
  }

  processWorld(world, now + 1);

  assert.equal(world.version, 13);
  assert.ok(world.orders.some((order) => order.id === 'player-wheat-sell'));
  const populationOrders = world.orders.filter((order) => order.ownerType === 'population');
  assert.ok(populationOrders.length > 0);
  assert.ok(populationOrders.every((order) => order.demandCycleId === Math.floor((now + 1) / (5 * 60 * 1000))));
  assert.equal(world.demandGroups.food.lastBudget, 600);
  assert.equal(world.demandGroups.household.lastBudget, 576);
  assert.ok(world.demandGroups.food.nextDemandAt > now + 1);
  assert.ok(world.demandGroups.household.nextDemandAt > now + 1);
});

'''
text = replace_between(text, old_migration_start, "test('migration removes market and legacy population orders while preserving player orders', () => {", new_migration, path)
text = text.replace('assert.equal(persisted.version, 12);', 'assert.equal(persisted.version, 13);')
text = text.replace('assert.equal(world.version, 12);', 'assert.equal(world.version, 13);')
text = text.replace('assert.ok(persisted.demandGroups.food.lastCommitted <= 500);', 'assert.ok(persisted.demandGroups.food.lastCommitted <= persisted.demandGroups.food.lastBudget);')
text = text.replace('assert.ok(persisted.demandGroups.household.lastCommitted <= 480);', 'assert.ok(persisted.demandGroups.household.lastCommitted <= persisted.demandGroups.household.lastBudget);')
write(path, text)

# Static regression check is replaced with the v13 dynamic model contract.
write('scripts/verify-staple-crops-demand.mjs', r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMAND_GROUP_CATALOG, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 22);
const foodIds = ['wheat', 'rice', 'flour', 'food', 'meat', 'eggs', 'milk'];
const householdIds = ['timber', 'cotton', 'wool', 'copper-ore', 'crude-oil', 'lumber', 'textile', 'copper', 'plastic', 'furniture', 'clothing', 'electronics'];
for (const id of foodIds) assert.equal(products.get(id)?.populationDemandGroupId, 'food', id);
for (const id of householdIds) assert.equal(products.get(id)?.populationDemandGroupId, 'household', id);
for (const id of ['ore', 'steel', 'machinery']) assert.equal(products.get(id)?.populationDemandGroupId, undefined, id);

const food = DEMAND_GROUP_CATALOG.find((group) => group.id === 'food');
const household = DEMAND_GROUP_CATALOG.find((group) => group.id === 'household');
assert.equal(food.ownerName, '饮食需求');
assert.equal(food.baseBudget, 1_000);
assert.deepEqual(food.products.map((item) => item.productId), foodIds);
assert.equal(household.ownerName, '家庭用品需求');
assert.equal(household.baseBudget, 900);
assert.deepEqual(household.products.map((item) => item.productId), householdIds);

const domain = read('server/src/domain.js');
for (const text of [
  'ACTIVE_PLAYER_WINDOW_MS', 'DEMAND_PLAYER_SCALE_MAX', 'DEMAND_INVENTORY_BOOST_RATE',
  'dynamicDemandBudget', 'demandStockSnapshot', 'lastEconomicActivityAt',
  'lastTargetBudget', 'lastPlayerScaleBudget', 'lastInventoryBoost',
  'lastActivePlayerCount', 'lastStockValue', 'inventoryFactor',
  'available || 0', 'frozen || 0', 'previousVersion >= 13', 'previousVersion < 13',
  'processPriceTransmission', 'costAnchor', 'downstreamValueAnchor',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);
assert.equal(domain.includes('allocateDemandBudgets(choices, group.baseBudget)'), false);
assert.equal(domain.includes('maxBudget: Math.floor(group.baseBudget * option.maxBudgetShare)'), false);

const storage = read('server/src/storage.js');
for (const text of ['ECONOMIC_ACTIVITY_ACTIONS', 'gameResult?.ok', 'activePlayer.lastEconomicActivityAt = now', 'demandGroups: Object.fromEntries']) {
  assert.ok(storage.includes(text), 'storage.js 缺少: ' + text);
}
const assetEvents = read('server/src/asset-events.js');
assert.ok(assetEvents.includes('world.version = 13;'), '日志清理器必须保留世界版本 13');
assert.equal(assetEvents.includes('world.version = 12;'), false, '日志清理器不得把世界版本降回 12');

const tests = read('server/test/domain.test.js');
for (const text of [
  'population demand scales sublinearly with active players and stops at the configured cap',
  'inactive players stop scaling demand after seven days',
  'population demand grows with stock value and favors stocked products without double counting frozen inventory',
  'state polling and failed actions do not refresh economic activity',
  'world version 12 migration immediately rebuilds smoothed dynamic population demand',
]) assert.ok(tests.includes(text), '测试缺少: ' + text);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);
for (const [path, texts] of [
  ['README.md', ['饮食需求基础预算为 1,000', '家庭用品需求基础预算为 900', '近 7 天经济活跃玩家', '库存追加预算']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['平方根增长', '库存追加预算', '单周期最多上涨 20%', 'lastEconomicActivityAt']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['库存分配系数', '可用与冻结库存只统计一次']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['活跃玩家数量', '库存价值', '动态预算']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['世界版本 12 升级到 13', '读取状态不得更新', 'lastEconomicActivityAt']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}
console.log('人口需求验证通过：基础预算提高，并按近 7 天活跃玩家、全服库存、平滑与单周期上限动态调整。');
''')

# Current docs all carry world version 13; only authority docs get rule text changes.
for doc in [Path('README.md'), *Path('docs').glob('*.md')]:
    content = doc.read_text(encoding='utf-8')
    content = content.replace('世界状态版本：`12`', '世界状态版本：`13`')
    content = content.replace('世界状态版本：12', '世界状态版本：13')
    doc.write_text(content, encoding='utf-8')

path = 'README.md'
text = read(path)
text = replace_once(text,
    '- 饮食需求每 5 分钟最多 500 货币预算，家庭用品需求每 5 分钟最多 480 货币预算；预算随参考价换算为数量，价格上涨不会扩大系统货币发行。',
    '- 饮食需求基础预算为 1,000／5 分钟，家庭用品需求基础预算为 900／5 分钟；预算按近 7 天经济活跃玩家平方根增长，最多 6 倍，并按全服可用与冻结库存价值增加最多 40% 的库存追加预算。', path)
text = replace_once(text,
    '- 新世界首次状态处理和需求模型升级迁移必须立即生成当前周期人口买单，不得在删除旧订单后等待下一个 5 分钟周期；当期预算仍只能发行一次。',
    '- 新世界首次状态处理和世界版本 12→13 的需求模型升级必须立即生成当前周期人口买单；动态预算按 65% 旧值与 35% 目标值平滑，单周期涨跌不超过 20%，未使用预算不结转且当期只能发行一次。', path)
write(path, text)

path = 'docs/README.md'
text = read(path).replace('> 更新时间：2026-07-17', '> 更新时间：2026-07-18')
text = text.replace('人口需求订单来源、固定预算、生产链双向滞后价格传导和迁移清理属于产品、产业与订单簿权威规则', '人口需求订单来源、活跃玩家与库存动态预算、生产链双向滞后价格传导和迁移清理属于产品、产业与订单簿权威规则')
write(path, text)

path = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md'
text = read(path).replace('> 更新时间：2026-07-17', '> 更新时间：2026-07-18')
old = '''当前需求周期为 5 分钟。人口需求固定分为：

- `food`：显示名称“饮食需求”，每周期最多 500 货币预算；包括小麦、水稻、面粉、食品、肉、蛋和奶。
- `household`：显示名称“家庭用品需求”，每周期最多 480 货币预算；包括木材、棉花、毛、铜矿石、原油、木板、纺织品、铜材、塑料、家具、服装和电子产品。
- 铁矿石、钢材和机械不生成人口订单，只由玩家交易与产业用途形成需求。

两个需求组各自共享固定预算；本次提高预算只扩大每周期可成交数量，不改变需求品类、五分钟周期、弹性、价格上限或预算不结转规则。人口订单数量按“分配预算 ÷ 人口参考价”取整；价格上涨只减少可购买数量，不扩大预算。未使用预算不结转。

新世界首次权威状态处理，以及从世界版本 11 升级到 12 后的首次状态处理，必须删除旧周期人口订单并立即生成当前周期人口需求买单，不得等待首个 5 分钟周期结束。迁移生成仍只允许每组使用一次固定周期预算；后续按整周期推进，已成交或已耗尽的当期需求不得重复补发。'''
new = '''当前需求周期为 5 分钟。人口需求固定分为：

- `food`：显示名称“饮食需求”，基础预算 1,000 货币；包括小麦、水稻、面粉、食品、肉、蛋和奶。
- `household`：显示名称“家庭用品需求”，基础预算 900 货币；包括木材、棉花、毛、铜矿石、原油、木板、纺织品、铜材、塑料、家具、服装和电子产品。
- 铁矿石、钢材和机械不生成人口订单，只由玩家交易与产业用途形成需求。

有效玩家只统计近 7 天发生成功经济写操作的玩家。新玩家首次建档视为活跃；普通状态轮询、失败操作和后台生产结算不得刷新 `lastEconomicActivityAt`。玩家规模系数采用 `clamp(0.5 + 0.5 × sqrt(有效玩家数), 1, 6)` 的平方根增长，避免注册账号线性制造货币。

每个需求组在周期开始时对全服该组商品做一次库存快照。商品库存等于所有玩家 `available + frozen`，挂牌冻结库存不得再按卖单重复统计。玩家规模预算等于基础预算乘玩家规模系数；库存追加预算等于 `min(玩家规模预算 × 40%, 需求组库存价值 × 10%)`。库存为空时仍保留完整玩家规模预算，库存增加时扩大消费，库存追加达到 40% 后不再继续增长。

品类分配继续受报价、价格弹性和 `maxBudgetShare` 限制，并乘以库存分配系数 `clamp(0.7 + 0.3 × sqrt(库存价值 ÷ 三周期目标库存价值), 0.7, 1.8)`。零库存商品仍保留 70% 基础分数，积压商品最多获得 1.8 倍分数；价格上涨仍只降低购买数量，不会绕过动态总预算上限。

目标预算按 65% 上周期预算与 35% 本周期目标预算平滑，单周期最多上涨 20%、下降 20%。新世界第一周期直接使用目标预算；世界版本 12 升级到 13 时删除旧人口订单并从旧预算平滑过渡，同时在同一事务立即生成当前周期人口买单。未使用预算不结转，已成交或已耗尽的当期需求不得重复补发。需求状态必须保存目标预算、玩家规模预算、库存追加、活跃玩家数、库存价值、承诺预算、满足率和逐商品分配，以便管理员审计。'''
text = replace_once(text, old, new, path)
write(path, text)

path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
text = read(path).replace('> 更新时间：2026-07-17', '> 更新时间：2026-07-18')
text = replace_once(text,
    '小麦、水稻、面粉、食品、肉、蛋和奶属于饮食需求；木材、棉花、毛、铜矿石、原油、木板、纺织品、铜材、塑料、家具、服装和电子产品属于家庭用品需求。价格沿正式配方双向、逐边、滞后传导，详细规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为准。商品 ID 必须唯一，已有 ID 不得重命名或复用。',
    '小麦、水稻、面粉、食品、肉、蛋和奶属于饮食需求；木材、棉花、毛、铜矿石、原油、木板、纺织品、铜材、塑料、家具、服装和电子产品属于家庭用品需求。需求组总预算随近 7 天活跃玩家和组内库存价值变化，商品预算再乘库存分配系数；可用与冻结库存只统计一次，挂牌冻结数量不得重复计入。价格沿正式配方双向、逐边、滞后传导，详细规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为准。商品 ID 必须唯一，已有 ID 不得重命名或复用。', path)
write(path, text)

path = 'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md'
text = read(path)
text = replace_once(text,
    '人口买单使用 `demandGroupId`、`demandTier` 和 `demandCycleId` 标记需求组、产业层级与周期，但仍遵守同一价格优先、同价时间优先规则。预算与双向价格传导以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为唯一权威来源。',
    '人口买单使用 `demandGroupId`、`demandTier` 和 `demandCycleId` 标记需求组、产业层级与周期，但仍遵守同一价格优先、同价时间优先规则。人口总预算按近 7 天活跃玩家数量与全服库存价值动态计算，商品分配同时考虑报价和库存压力；预算、平滑上限与双向价格传导以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为唯一权威来源。', path)
text = replace_once(text,
    '- 新世界首次状态处理与需求模型升级迁移必须在同一事务立即生成当前周期人口买单；不得删除旧订单后把订单簿留空到下一周期，也不得因补发重复使用当期预算。',
    '- 新世界首次状态处理与世界版本 12→13 的动态预算迁移必须在同一事务立即生成当前周期人口买单；不得删除旧订单后把订单簿留空到下一周期，也不得因补发重复使用当期预算。', path)
write(path, text)

path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
text = read(path).replace('> 更新时间：2026-07-17', '> 更新时间：2026-07-18')
text = text.replace('- SQLite 世界版本固定为 12。', '- SQLite 世界版本固定为 13。')
text = replace_once(text,
    '- 世界版本 11 升级到 12 时删除旧人口订单，保留玩家订单及冻结资产，并以饮食 500、家庭用品 480 的新预算把两类人口需求标记为当前事务立即执行；不得留下一个需求周期的空窗。所有日志清理、兼容结构清理和序列化辅助函数只能保留或提升当前世界版本，不得把世界版本写回旧值，否则会重复执行迁移、重复生成需求并持续推进修订号。',
    '- 世界版本 12 升级到 13 时删除旧人口订单，保留玩家订单及冻结资产，补齐玩家 `lastEconomicActivityAt` 和需求动态统计字段，并把两类人口需求标记为当前事务立即执行；旧 500／480 预算按单周期最多 20% 的上限向新目标过渡，不得留下一个需求周期的空窗。所有日志清理、兼容结构清理和序列化辅助函数只能保留或提升当前世界版本，不得把世界版本写回旧值，否则会重复执行迁移、重复生成需求并持续推进修订号。', path)
text = replace_once(text,
    '`GET /api/game/state` 返回单调递增的世界 `revision`。首次不带修订号，后续使用 `?revision=N`；未变化时只返回 `{ revision, unchanged: true }`。空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、增加修订号或写回相同的 `state_json`。管理员世界概况同样属于只读入口；只有处理生产或拍卖后序列化结果实际变化时才允许保存并增加修订号。',
    '`GET /api/game/state` 返回单调递增的世界 `revision`。首次不带修订号，后续使用 `?revision=N`；未变化时只返回 `{ revision, unchanged: true }`。空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`、`lastEconomicActivityAt`、增加修订号或写回相同的 `state_json`。只有成功经济写操作可以刷新玩家活跃时间，失败操作、轮询和后台生产不得刷新。管理员世界概况同时返回各需求组的目标预算、玩家规模预算、库存追加、活跃玩家数、库存价值、承诺预算与满足率；该入口仍属于只读，只有处理生产或拍卖后序列化结果实际变化时才允许保存并增加修订号。', path)
write(path, text)

# Authority and related static checks follow world v13 and dynamic wording.
path = 'scripts/verify-document-authority.mjs'
text = read(path)
text = text.replace("'世界状态版本：`12`'", "'世界状态版本：`13`'")
text = text.replace("'饮食需求每 5 分钟最多 500'", "'饮食需求基础预算为 1,000'")
text = text.replace("'家庭用品需求每 5 分钟最多 480'", "'家庭用品需求基础预算为 900'")
text = text.replace("content.includes('世界状态版本：12')", "content.includes('世界状态版本：13')")
text = text.replace('世界状态版本必须为 12', '世界状态版本必须为 13')
text = text.replace('版本 15/12', '版本 15/13')
text = text.replace('人口需求 500／480', '动态人口需求')
write(path, text)

for path in Path('scripts').glob('*.mjs'):
    text = path.read_text(encoding='utf-8').replace("'world.version = 12'", "'world.version = 13'")
    path.write_text(text, encoding='utf-8')

# Verify no authoritative source still serializes v12 or advertises the old fixed budgets.
for path in ['server/src/domain.js', 'server/src/domain-core.js', 'server/src/facility-groups.js', 'server/src/storage.js', 'server/src/asset-events.js']:
    content = read(path)
    if 'world.version = 12;' in content or 'version: 12,' in content:
        raise RuntimeError(f'{path}: stale world version 12 serializer')
if '饮食需求每 5 分钟最多 500' in read('README.md'):
    raise RuntimeError('README.md still advertises fixed 500 budget')
