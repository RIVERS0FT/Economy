import { create } from 'zustand';
import type {
  AuthUser,
  CommodityOrder,
  EconomyState,
  Factory,
  FactoryListing,
  LedgerCategory,
  LedgerEntry,
  TradeRecord,
} from '../types';

const STORAGE_PREFIX = 'riversoft-economy-v2';
const WORK_RESET_MS = 5 * 60 * 1000;
const WORK_COOLDOWNS = [3_000, 5_000, 8_000, 12_000];
const BUILD_COST = 60;
const BUILD_TIME_MS = 5 * 60 * 1000;
const MAX_OPEN_ORDERS = 10;

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function storageKey(userId: number) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function cloneState(state: EconomyState): EconomyState {
  return JSON.parse(JSON.stringify(state)) as EconomyState;
}

function addLedger(
  state: EconomyState,
  category: LedgerCategory,
  amount: number,
  description: string,
  createdAt = Date.now(),
) {
  const entry: LedgerEntry = {
    id: id('ledger'),
    category,
    amount,
    balanceAfter: state.credits,
    createdAt,
    description,
  };
  state.ledger = [entry, ...state.ledger].slice(0, 200);
}

function addTrade(state: EconomyState, trade: Omit<TradeRecord, 'id'>) {
  state.trades = [{ id: id('trade'), ...trade }, ...state.trades].slice(0, 120);
}

function seedOrders(now: number): CommodityOrder[] {
  return [
    {
      id: id('order'),
      side: 'buy',
      ownerType: 'population',
      ownerName: '城市居民消费池',
      price: 6,
      quantity: 12,
      remaining: 12,
      status: 'open',
      createdAt: now - 8_000,
    },
    {
      id: id('order'),
      side: 'buy',
      ownerType: 'market',
      ownerName: '远岸贸易社',
      price: 5,
      quantity: 20,
      remaining: 20,
      status: 'open',
      createdAt: now - 6_000,
    },
    {
      id: id('order'),
      side: 'sell',
      ownerType: 'market',
      ownerName: '北港制造',
      price: 8,
      quantity: 10,
      remaining: 10,
      status: 'open',
      createdAt: now - 5_000,
    },
    {
      id: id('order'),
      side: 'sell',
      ownerType: 'market',
      ownerName: '云岭实业',
      price: 9,
      quantity: 15,
      remaining: 15,
      status: 'open',
      createdAt: now - 4_000,
    },
  ];
}

function seedFactoryListings(now: number): FactoryListing[] {
  return [
    {
      id: id('factory-listing'),
      factoryId: 'market-factory-starter',
      ownerType: 'market',
      ownerName: '曙光制造公司',
      price: 86,
      createdAt: now - 30_000,
      factory: {
        name: '基础制造厂 A-17',
        level: 1,
        cycleMs: 30_000,
        outputPerCycle: 1,
        operatingCost: 1,
        internalCapacity: 20,
        lifetimeOutput: 37,
        systemValue: 80,
      },
    },
    {
      id: id('factory-listing'),
      factoryId: 'market-factory-efficient',
      ownerType: 'market',
      ownerName: '启明资产管理',
      price: 104,
      createdAt: now - 20_000,
      factory: {
        name: '基础制造厂 B-04',
        level: 2,
        cycleMs: 26_000,
        outputPerCycle: 1,
        operatingCost: 1,
        internalCapacity: 24,
        lifetimeOutput: 114,
        systemValue: 92,
      },
    },
  ];
}

function createInitialState(user: AuthUser): EconomyState {
  const now = Date.now();
  const companyBase = user.name?.trim() || user.email.split('@')[0] || '新企业';
  const state: EconomyState = {
    version: 2,
    userId: user.id,
    companyName: `${companyBase}企业`,
    credits: 100,
    frozenCredits: 0,
    inventory: 0,
    frozenInventory: 0,
    warehouseCapacity: 100,
    factorySlots: 1,
    factories: [],
    commodityName: '基础商品',
    orders: seedOrders(now),
    factoryListings: seedFactoryListings(now),
    trades: [],
    ledger: [],
    work: {
      cooldownUntil: 0,
      lastWorkedAt: 0,
      streak: 0,
      totalClicks: 0,
    },
    population: {
      population: 10_000,
      cycleMs: 60_000,
      nextDemandAt: now + 45_000,
      lastBudget: 72,
      lastQuantity: 12,
      lastPrice: 6,
      satisfaction: 0.72,
    },
    stats: {
      workIssued: 0,
      populationIssued: 0,
      systemSinks: 0,
      commodityVolume: 0,
      factoryVolume: 0,
    },
    marketPrice: 7,
    lastProcessedAt: now,
  };
  addLedger(state, 'system', 100, '新企业测试启动资金');
  return state;
}

function saveState(state: EconomyState) {
  localStorage.setItem(storageKey(state.userId), JSON.stringify(state));
}

function loadState(user: AuthUser): EconomyState {
  const raw = localStorage.getItem(storageKey(user.id));
  if (!raw) return createInitialState(user);
  try {
    const state = JSON.parse(raw) as EconomyState;
    if (state.version !== 2 || state.userId !== user.id) return createInitialState(user);
    return processState(state, Date.now());
  } catch {
    return createInitialState(user);
  }
}

function refreshExternalLiquidity(state: EconomyState, now: number) {
  const openMarketBuys = state.orders.filter((order) => order.status !== 'filled' && order.status !== 'cancelled' && order.ownerType === 'market' && order.side === 'buy');
  const openMarketSells = state.orders.filter((order) => order.status !== 'filled' && order.status !== 'cancelled' && order.ownerType === 'market' && order.side === 'sell');

  if (openMarketBuys.length < 1) {
    state.orders.push({
      id: id('order'),
      side: 'buy',
      ownerType: 'market',
      ownerName: '流动性采购商',
      price: Math.max(3, state.marketPrice - 2),
      quantity: 16,
      remaining: 16,
      status: 'open',
      createdAt: now,
    });
  }

  if (openMarketSells.length < 2) {
    state.orders.push({
      id: id('order'),
      side: 'sell',
      ownerType: 'market',
      ownerName: '流动性供应商',
      price: state.marketPrice + 1 + openMarketSells.length,
      quantity: 12,
      remaining: 12,
      status: 'open',
      createdAt: now,
    });
  }
}

function createPopulationDemand(state: EconomyState, now: number) {
  const cycle = Math.floor(now / state.population.cycleMs);
  const price = 6 + (cycle % 3);
  const quantity = 8 + (cycle % 5);
  const budget = price * quantity;

  state.orders.push({
    id: id('population-order'),
    side: 'buy',
    ownerType: 'population',
    ownerName: '城市居民消费池',
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  });
  state.population.lastPrice = price;
  state.population.lastQuantity = quantity;
  state.population.lastBudget = budget;
  state.population.satisfaction = Math.min(1, Math.max(0.35, state.population.satisfaction + ((cycle % 3) - 1) * 0.04));
  state.population.nextDemandAt = now + state.population.cycleMs;
}

function processFactories(state: EconomyState, now: number) {
  state.factories.forEach((factory) => {
    if (factory.status === 'constructing' && factory.constructionCompletesAt && now >= factory.constructionCompletesAt) {
      factory.status = 'ready';
      factory.builtAt = factory.constructionCompletesAt;
      delete factory.constructionCompletesAt;
      addLedger(state, 'system', 0, `${factory.name} 已完成施工，可启动生产`, now);
    }

    if (factory.status !== 'running' || !factory.cycleStartedAt) return;
    let completedCycles = Math.floor((now - factory.cycleStartedAt) / factory.cycleMs);
    if (completedCycles <= 0) return;

    while (completedCycles > 0) {
      if (factory.internalGoods + factory.outputPerCycle > factory.internalCapacity) {
        factory.status = 'full';
        factory.cycleStartedAt = now;
        break;
      }
      if (state.credits < factory.operatingCost) {
        factory.status = 'insufficient_funds';
        factory.cycleStartedAt = now;
        break;
      }

      state.credits -= factory.operatingCost;
      state.stats.systemSinks += factory.operatingCost;
      factory.internalGoods += factory.outputPerCycle;
      factory.lifetimeOutput += factory.outputPerCycle;
      factory.cycleStartedAt += factory.cycleMs;
      addLedger(state, 'factory_operation', -factory.operatingCost, `${factory.name} 完成生产周期并支付运营费`, factory.cycleStartedAt);
      completedCycles -= 1;
    }
  });
}

function processFactorySales(state: EconomyState, now: number) {
  const soldListings = state.factoryListings.filter(
    (listing) => listing.ownerType === 'player' && now - listing.createdAt >= 90_000 && listing.price <= listing.factory.systemValue * 1.2,
  );

  soldListings.forEach((listing) => {
    const factory = state.factories.find((item) => item.id === listing.factoryId);
    if (!factory) return;
    state.factories = state.factories.filter((item) => item.id !== factory.id);
    state.factoryListings = state.factoryListings.filter((item) => item.id !== listing.id);
    state.credits += listing.price;
    state.stats.factoryVolume += listing.price;
    addTrade(state, {
      type: 'factory',
      side: 'sell',
      quantity: 1,
      price: listing.price,
      total: listing.price,
      counterparty: '模拟市场买家',
      createdAt: now,
      description: `出售 ${factory.name}`,
    });
    addLedger(state, 'factory_sale', listing.price, `${factory.name} 已按挂牌价成交`, now);
  });
}

function processState(input: EconomyState, now: number): EconomyState {
  const state = cloneState(input);
  processFactories(state, now);
  processFactorySales(state, now);

  if (now >= state.population.nextDemandAt) {
    createPopulationDemand(state, now);
  }
  refreshExternalLiquidity(state, now);
  state.lastProcessedAt = now;
  return state;
}

function sortMatches(orders: CommodityOrder[], side: 'buy' | 'sell') {
  return [...orders].sort((a, b) => {
    if (a.price !== b.price) return side === 'buy' ? a.price - b.price : b.price - a.price;
    return a.createdAt - b.createdAt;
  });
}

function matchPlayerOrder(state: EconomyState, playerOrder: CommodityOrder, now: number) {
  const opposite = playerOrder.side === 'buy' ? 'sell' : 'buy';
  const candidates = sortMatches(
    state.orders.filter((order) => {
      if (order.id === playerOrder.id || order.side !== opposite || order.remaining <= 0) return false;
      if (order.ownerType === 'player' && order.ownerId === state.userId) return false;
      return playerOrder.side === 'buy' ? order.price <= playerOrder.price : order.price >= playerOrder.price;
    }),
    playerOrder.side,
  );

  for (const resting of candidates) {
    if (playerOrder.remaining <= 0) break;
    const quantity = Math.min(playerOrder.remaining, resting.remaining);
    const tradePrice = resting.price;
    const total = quantity * tradePrice;

    playerOrder.remaining -= quantity;
    resting.remaining -= quantity;
    resting.status = resting.remaining === 0 ? 'filled' : 'partial';
    playerOrder.status = playerOrder.remaining === 0 ? 'filled' : 'partial';
    state.marketPrice = tradePrice;
    state.stats.commodityVolume += quantity;

    if (playerOrder.side === 'buy') {
      state.frozenCredits -= quantity * playerOrder.price;
      state.credits += quantity * (playerOrder.price - tradePrice);
      state.inventory += quantity;
      addLedger(state, 'inventory', -total, `买入 ${quantity} 个${state.commodityName}，成交价 ${tradePrice}`, now);
    } else {
      state.frozenInventory -= quantity;
      state.credits += total;
      if (resting.ownerType === 'population') {
        state.stats.populationIssued += total;
        addLedger(state, 'population_income', total, `城市人口消费 ${quantity} 个${state.commodityName}`, now);
      } else {
        addLedger(state, 'market_trade', total, `卖出 ${quantity} 个${state.commodityName}，成交价 ${tradePrice}`, now);
      }
    }

    addTrade(state, {
      type: 'commodity',
      side: playerOrder.side,
      quantity,
      price: tradePrice,
      total,
      counterparty: resting.ownerName,
      createdAt: now,
      description: `${playerOrder.side === 'buy' ? '买入' : '卖出'} ${state.commodityName}`,
    });
  }
}

interface GameStore {
  game: EconomyState | null;
  initialize: (user: AuthUser) => void;
  reloadFromStorage: (userId: number) => void;
  process: () => void;
  reset: (user: AuthUser) => void;
  work: () => { ok: boolean; message: string };
  buildFactory: () => { ok: boolean; message: string };
  startFactory: (factoryId: string) => void;
  pauseFactory: (factoryId: string) => void;
  collectFactory: (factoryId: string) => { ok: boolean; message: string };
  listFactory: (factoryId: string, price: number) => { ok: boolean; message: string };
  cancelFactoryListing: (listingId: string) => void;
  buyFactory: (listingId: string) => { ok: boolean; message: string };
  placeCommodityOrder: (side: 'buy' | 'sell', quantity: number, price: number) => { ok: boolean; message: string };
  cancelOrder: (orderId: string) => void;
  renameCompany: (name: string) => void;
}

function commit(set: (updater: (store: GameStore) => Partial<GameStore>) => void, updater: (state: EconomyState) => void) {
  set((store) => {
    if (!store.game) return {};
    const next = processState(store.game, Date.now());
    updater(next);
    saveState(next);
    return { game: next };
  });
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,

  initialize: (user) => {
    const game = loadState(user);
    saveState(game);
    set({ game });
  },

  reloadFromStorage: (userId) => {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return;
    try {
      const game = processState(JSON.parse(raw) as EconomyState, Date.now());
      set({ game });
    } catch {
      // Ignore malformed cross-tab updates.
    }
  },

  process: () => {
    const current = get().game;
    if (!current) return;
    const next = processState(current, Date.now());
    saveState(next);
    set({ game: next });
  },

  reset: (user) => {
    const game = createInitialState(user);
    saveState(game);
    set({ game });
  },

  work: () => {
    const game = get().game;
    if (!game) return { ok: false, message: '游戏状态尚未加载' };
    const now = Date.now();
    if (now < game.work.cooldownUntil) {
      return { ok: false, message: '工作冷却尚未结束' };
    }

    commit(set, (state) => {
      const rested = now - state.work.lastWorkedAt >= WORK_RESET_MS;
      state.work.streak = rested ? 1 : Math.min(4, state.work.streak + 1);
      const cooldown = WORK_COOLDOWNS[state.work.streak - 1];
      state.work.cooldownUntil = now + cooldown;
      state.work.lastWorkedAt = now;
      state.work.totalClicks += 1;
      state.credits += 1;
      state.stats.workIssued += 1;
      addLedger(state, 'work_income', 1, `完成工作，连续工作冷却 ${cooldown / 1000} 秒`, now);
    });
    return { ok: true, message: '工作完成，获得 1 货币' };
  },

  buildFactory: () => {
    const game = get().game;
    if (!game) return { ok: false, message: '游戏状态尚未加载' };
    if (game.factories.length >= game.factorySlots) return { ok: false, message: '工厂槽位不足' };
    if (game.factories.some((factory) => factory.status === 'constructing')) return { ok: false, message: '同时只能施工一座工厂' };
    if (game.credits < BUILD_COST) return { ok: false, message: '建造资金不足' };

    const now = Date.now();
    commit(set, (state) => {
      state.credits -= BUILD_COST;
      state.stats.systemSinks += BUILD_COST;
      state.factories.push({
        id: id('factory'),
        name: `基础制造厂 ${state.factories.length + 1}`,
        ownerId: state.userId,
        level: 1,
        status: 'constructing',
        builtAt: 0,
        constructionCompletesAt: now + BUILD_TIME_MS,
        cycleMs: 30_000,
        outputPerCycle: 1,
        operatingCost: 1,
        internalGoods: 0,
        internalCapacity: 20,
        lifetimeOutput: 0,
        systemValue: 80,
      });
      addLedger(state, 'factory_construction', -BUILD_COST, '支付基础工厂建造费用', now);
    });
    return { ok: true, message: '工厂开始施工，预计 5 分钟完成' };
  },

  startFactory: (factoryId) => {
    commit(set, (state) => {
      const factory = state.factories.find((item) => item.id === factoryId);
      if (!factory || factory.status === 'constructing' || factory.status === 'listed') return;
      if (factory.internalGoods >= factory.internalCapacity) {
        factory.status = 'full';
        return;
      }
      if (state.credits < factory.operatingCost) {
        factory.status = 'insufficient_funds';
        return;
      }
      factory.status = 'running';
      factory.cycleStartedAt = Date.now();
    });
  },

  pauseFactory: (factoryId) => {
    commit(set, (state) => {
      const factory = state.factories.find((item) => item.id === factoryId);
      if (!factory || factory.status !== 'running') return;
      factory.status = 'paused';
      delete factory.cycleStartedAt;
    });
  },

  collectFactory: (factoryId) => {
    const game = get().game;
    const factory = game?.factories.find((item) => item.id === factoryId);
    if (!game || !factory || factory.internalGoods <= 0) return { ok: false, message: '没有可领取的成品' };
    const freeCapacity = game.warehouseCapacity - game.inventory - game.frozenInventory;
    if (freeCapacity <= 0) return { ok: false, message: '企业仓库已满' };
    const amount = Math.min(factory.internalGoods, freeCapacity);

    commit(set, (state) => {
      const target = state.factories.find((item) => item.id === factoryId);
      if (!target) return;
      target.internalGoods -= amount;
      state.inventory += amount;
      if (target.status === 'full' && target.internalGoods < target.internalCapacity) target.status = 'paused';
      addLedger(state, 'inventory', 0, `从 ${target.name} 领取 ${amount} 个${state.commodityName}`);
    });
    return { ok: true, message: `已领取 ${amount} 个${game.commodityName}` };
  },

  listFactory: (factoryId, price) => {
    const game = get().game;
    const factory = game?.factories.find((item) => item.id === factoryId);
    if (!game || !factory) return { ok: false, message: '工厂不存在' };
    if (!['ready', 'paused', 'full', 'insufficient_funds'].includes(factory.status)) return { ok: false, message: '当前状态不能挂牌' };
    if (factory.internalGoods > 0) return { ok: false, message: '挂牌前必须领取全部内部成品' };
    if (price < factory.systemValue * 0.5 || price > factory.systemValue * 2) return { ok: false, message: '挂牌价必须在系统估值的 50%～200% 之间' };

    commit(set, (state) => {
      const target = state.factories.find((item) => item.id === factoryId);
      if (!target) return;
      const listingId = id('factory-listing');
      target.status = 'listed';
      target.listedOrderId = listingId;
      delete target.cycleStartedAt;
      state.factoryListings.push({
        id: listingId,
        factoryId: target.id,
        ownerType: 'player',
        ownerId: state.userId,
        ownerName: state.companyName,
        price: Math.floor(price),
        createdAt: Date.now(),
        factory: {
          name: target.name,
          level: target.level,
          cycleMs: target.cycleMs,
          outputPerCycle: target.outputPerCycle,
          operatingCost: target.operatingCost,
          internalCapacity: target.internalCapacity,
          lifetimeOutput: target.lifetimeOutput,
          systemValue: target.systemValue,
        },
      });
    });
    return { ok: true, message: '工厂已进入统一市场挂牌' };
  },

  cancelFactoryListing: (listingId) => {
    commit(set, (state) => {
      const listing = state.factoryListings.find((item) => item.id === listingId && item.ownerId === state.userId);
      if (!listing) return;
      const factory = state.factories.find((item) => item.id === listing.factoryId);
      if (factory) {
        factory.status = 'paused';
        delete factory.listedOrderId;
      }
      state.factoryListings = state.factoryListings.filter((item) => item.id !== listingId);
    });
  },

  buyFactory: (listingId) => {
    const game = get().game;
    const listing = game?.factoryListings.find((item) => item.id === listingId);
    if (!game || !listing || listing.ownerId === game.userId) return { ok: false, message: '无法购买该挂牌' };
    if (game.factories.length >= game.factorySlots) return { ok: false, message: '工厂槽位不足' };
    if (game.credits < listing.price) return { ok: false, message: '购买资金不足' };

    const now = Date.now();
    commit(set, (state) => {
      const target = state.factoryListings.find((item) => item.id === listingId);
      if (!target) return;
      state.credits -= target.price;
      state.stats.factoryVolume += target.price;
      state.factoryListings = state.factoryListings.filter((item) => item.id !== listingId);
      state.factories.push({
        id: id('factory'),
        name: target.factory.name,
        ownerId: state.userId,
        level: target.factory.level,
        status: 'ready',
        builtAt: now,
        cycleMs: target.factory.cycleMs,
        outputPerCycle: target.factory.outputPerCycle,
        operatingCost: target.factory.operatingCost,
        internalGoods: 0,
        internalCapacity: target.factory.internalCapacity,
        lifetimeOutput: target.factory.lifetimeOutput,
        systemValue: target.factory.systemValue,
      });
      addTrade(state, {
        type: 'factory',
        side: 'buy',
        quantity: 1,
        price: target.price,
        total: target.price,
        counterparty: target.ownerName,
        createdAt: now,
        description: `收购 ${target.factory.name}`,
      });
      addLedger(state, 'factory_trade', -target.price, `从 ${target.ownerName} 收购 ${target.factory.name}`, now);
    });
    return { ok: true, message: '工厂产权已即时交割' };
  },

  placeCommodityOrder: (side, quantityInput, priceInput) => {
    const game = get().game;
    if (!game) return { ok: false, message: '游戏状态尚未加载' };
    const quantity = Math.max(1, Math.floor(quantityInput));
    const price = Math.max(1, Math.floor(priceInput));
    const openCount = game.orders.filter((order) => order.ownerId === game.userId && ['open', 'partial'].includes(order.status)).length;
    if (openCount >= MAX_OPEN_ORDERS) return { ok: false, message: '最多只能有 10 笔未完成订单' };
    if (side === 'buy' && game.credits < quantity * price) return { ok: false, message: '可用资金不足' };
    if (side === 'sell' && game.inventory < quantity) return { ok: false, message: '可用库存不足' };

    const now = Date.now();
    commit(set, (state) => {
      if (side === 'buy') {
        state.credits -= quantity * price;
        state.frozenCredits += quantity * price;
      } else {
        state.inventory -= quantity;
        state.frozenInventory += quantity;
      }

      const order: CommodityOrder = {
        id: id('order'),
        side,
        ownerType: 'player',
        ownerId: state.userId,
        ownerName: state.companyName,
        price,
        quantity,
        remaining: quantity,
        status: 'open',
        createdAt: now,
      };
      state.orders.push(order);
      matchPlayerOrder(state, order, now);
    });
    return { ok: true, message: '订单已提交并按价格优先、时间优先撮合' };
  },

  cancelOrder: (orderId) => {
    commit(set, (state) => {
      const order = state.orders.find((item) => item.id === orderId && item.ownerId === state.userId);
      if (!order || !['open', 'partial'].includes(order.status)) return;
      if (order.side === 'buy') {
        const released = order.remaining * order.price;
        state.frozenCredits -= released;
        state.credits += released;
      } else {
        state.frozenInventory -= order.remaining;
        state.inventory += order.remaining;
      }
      order.status = 'cancelled';
    });
  },

  renameCompany: (name) => {
    const clean = name.trim().slice(0, 32);
    if (!clean) return;
    commit(set, (state) => {
      state.companyName = clean;
      state.orders.forEach((order) => {
        if (order.ownerId === state.userId) order.ownerName = clean;
      });
      state.factoryListings.forEach((listing) => {
        if (listing.ownerId === state.userId) listing.ownerName = clean;
      });
    });
  },
}));

export const economyConstants = {
  buildCost: BUILD_COST,
  buildTimeMs: BUILD_TIME_MS,
  maxOpenOrders: MAX_OPEN_ORDERS,
};
