import { assertCommodityFreezeInvariant } from './commodity-freezes.js';
function cloneValue(value) {
  try {
    return structuredClone(value);
  } catch {
    return value;
  }
}

function restoreObject(target, snapshot) {
  for (const key of Reflect.ownKeys(target)) {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    if (!descriptor?.configurable) continue;
    delete target[key];
  }
  for (const [key, descriptor] of Reflect.ownKeys(snapshot).map((key) => [
    key,
    Object.getOwnPropertyDescriptor(snapshot, key),
  ])) {
    if (!descriptor) continue;
    Object.defineProperty(target, key, descriptor);
  }
}

function assertFiniteNonNegative(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`经济状态不变量失败：${label} 必须为非负有限数`);
  }
  return number;
}

function assertSafeQuantity(value, label) {
  const number = Number(value ?? 0);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`经济状态不变量失败：${label} 必须为非负安全整数`);
  }
  return number;
}

function assertPlayerEconomicState(userId, player) {
  assertFiniteNonNegative(player?.credits, `玩家 ${userId} 可用资金`);
  assertFiniteNonNegative(player?.frozenCredits, `玩家 ${userId} 冻结资金`);
  assertSafeQuantity(player?.gems, `玩家 ${userId} 宝石`);

  for (const [productId, inventory] of Object.entries(player?.inventories || {})) {
    assertSafeQuantity(inventory?.available, `玩家 ${userId} ${productId} 可用库存`);
    assertSafeQuantity(inventory?.frozen, `玩家 ${userId} ${productId} 冻结库存`);
    assertCommodityFreezeInvariant(inventory);
    assertSafeQuantity(inventory?.inTransit ?? 0, `玩家 ${userId} ${productId} 在途库存`);
  }

  for (const group of player?.facilityGroups || []) {
    const facilityId = String(group?.facilityTypeId || 'unknown');
    assertSafeQuantity(group?.count, `玩家 ${userId} ${facilityId} 工厂数量`);
    assertSafeQuantity(group?.participatingCount, `玩家 ${userId} ${facilityId} 参与生产数量`);
    if (group?.pendingJoinCount !== undefined) {
      assertSafeQuantity(group.pendingJoinCount, `玩家 ${userId} ${facilityId} 待加入数量`);
    }
  }

  const bank = player?.bankAccount;
  if (bank && typeof bank === 'object') {
    assertFiniteNonNegative(bank.depositCredits, `玩家 ${userId} 银行存款`);
    for (const loan of bank.loans || []) {
      assertFiniteNonNegative(loan?.principalRemaining ?? loan?.principalCredits, `玩家 ${userId} 贷款本金`);
      assertFiniteNonNegative(loan?.interestRemaining ?? 0, `玩家 ${userId} 贷款利息`);
    }
  }
}

export function assertEconomicStateInvariantsScoped(world, scope = {}) {
  if (!world || typeof world !== 'object') throw new Error('经济状态不变量失败：世界状态无效');
  if (scope.includeAuctionEscrow !== false) {
    assertFiniteNonNegative(world.auctionFeeEscrowCredits, '拍卖发布费托管');
  }
  const allPlayers = Boolean(scope.allPlayers || scope.playerIds === null);
  if (allPlayers) {
    for (const [userId, player] of Object.entries(world.players || {})) assertPlayerEconomicState(userId, player);
  } else {
    for (const id of scope.playerIds || []) {
      const player = world.players?.[String(id)];
      if (player) assertPlayerEconomicState(String(id), player);
    }
  }
  return true;
}

export function assertEconomicStateInvariants(world) {
  return assertEconomicStateInvariantsScoped(world, {
    allPlayers: true,
    playerIds: null,
    includeAuctionEscrow: true,
  });
}

export function createEconomicActionBoundary(world) {
  if (!world || typeof world !== 'object') throw new TypeError('经济动作边界需要有效世界状态');
  const enumerableSnapshot = structuredClone(world);
  const symbolDescriptors = new Map();
  for (const symbol of Object.getOwnPropertySymbols(world)) {
    const descriptor = Object.getOwnPropertyDescriptor(world, symbol);
    if (!descriptor) continue;
    symbolDescriptors.set(symbol, {
      ...descriptor,
      ...(Object.hasOwn(descriptor, 'value') ? { value: cloneValue(descriptor.value) } : {}),
    });
  }
  const snapshot = enumerableSnapshot;
  for (const [symbol, descriptor] of symbolDescriptors) Object.defineProperty(snapshot, symbol, descriptor);

  return {
    snapshot,
    playerBefore(userId) {
      return snapshot.players?.[String(userId)] || null;
    },
    rollback() {
      restoreObject(world, snapshot);
      return world;
    },
    assert() {
      return assertEconomicStateInvariants(world);
    },
  };
}

function savepointName(value) {
  const normalized = String(value || 'economy_action').replace(/[^a-zA-Z0-9_]/g, '_');
  return normalized || 'economy_action';
}

export function beginEconomicSavepoint(store, name = 'economy_action') {
  if (!store?.database || typeof store.database.exec !== 'function') {
    throw new TypeError('经济动作保存点需要 SQLite 存储');
  }
  const label = savepointName(name);
  let active = true;
  store.database.exec(`SAVEPOINT ${label}`);
  return {
    release() {
      if (!active) return;
      store.database.exec(`RELEASE SAVEPOINT ${label}`);
      active = false;
    },
    rollback() {
      if (!active) return;
      store.database.exec(`ROLLBACK TO SAVEPOINT ${label}`);
      store.database.exec(`RELEASE SAVEPOINT ${label}`);
      active = false;
    },
  };
}
