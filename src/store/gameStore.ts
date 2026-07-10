import { create } from 'zustand';
import type {
  AuthUser,
  CommodityOrder,
  EconomyState,
  FacilityListing,
  LeaderboardEntry,
  LedgerCategory,
  LedgerEntry,
  PricePoint,
  ProductionFacility,
  TradeRecord,
} from '../types';

const STORAGE_PREFIX = 'riversoft-economy-v3';
const LEGACY_STORAGE_PREFIX = 'riversoft-economy-v2';
const WORK_RESET_MS = 5 * 60 * 1000;
const WORK_COOLDOWNS = [3_000, 5_000, 8_000, 12_000];
const BUILD_COST = 60;
const BUILD_TIME_MS = 5 * 60 * 1000;
const MAX_OPEN_ORDERS = 10;
const MAX_PRICE_POINTS = 48;

function id(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function storageKey(userId: number) {
  return `${STORAGE_PREFIX}:${userId}`;
}

function cloneState(state: EconomyState): EconomyState {
  return JSON.parse(JSON.stringify(state)) as EconomyState;
}

function totalAssets(state: EconomyState) {
  const facilityValue = state.facilities.reduce((sum, facility) => sum + facility.systemValue + facility.internalGoods * state.marketPrice, 0);
  return state.credits + state.frozenCredits + (state.inventory + state.frozenInventory) * state.marketPrice + facilityValue;
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
  state.ledger = [entry, ...state.ledger].slice(0, 240);
}

function addTrade(state: EconomyState, trade: Omit<TradeRecord, 'id'>) {
  state.trades = [{ id: id('trade'), ...trade }, ...state.trades].slice(0, 160);
}

function recordPrice(state: EconomyState, price: number, quantity: number, createdAt: number) {
  state.marketPrice = price;
  state.marketPriceHistory = [...state.marketPriceHistory, { price, quantity, createdAt }].slice(-MAX_PRICE_POINTS);
}

function seedPriceHistory(now: number): PricePoint[] {
  const prices = [6, 6, 7, 6, 7, 7, 8, 7, 7, 8, 8, 7, 7, 6, 7, 7, 8, 8, 7, 7, 7, 8, 7, 7];
  return prices.map((price, index) => ({
    price,
    quantity: 3 + (index % 5),
    createdAt: now - (prices.length - index) * 60_000,
  }));
}

function seedOrders(now: number): CommodityOrder[] {
  return [
    {
      id: id('order'),
      side: 'buy',
      ownerType: 'population',
      ownerName: '人口需求',
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
      ownerName: '玩家·远岸',
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
      ownerName: '玩家·北港',
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
      ownerName: '玩家·云岭',
      price: 9,
      quantity: 15,
      remaining: 15,
      status: 'open',
      createdAt: now - 4_000,
    },
  ];
}

function seedFacilityListings(now: number): FacilityListing[] {
  return [
    {
      id: id('facility-listing'),
      facilityId: 'market-facility-starter',
      ownerType: 'market',
      ownerName: '玩家·曙光',
      price: 86,
      createdAt: now - 30_000,
      facility: {
        name: '基础生产设施 A-17',
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
      id: id('facility-listing'),
      facilityId: 'market-facility-efficient',
      ownerType: 'market',
      ownerName: '玩家·启明',
      price: 104,
      createdAt: now - 20_000,
      facility: {
        name: '高效生产设施 B-04',
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

const leaderboardSeeds = [
  ['航标', 4_860, 1_520, 9, 420],
  ['青曜', 4_420, 1_180, 8, 305],
  ['北辰', 3_970, 940, 7, 260],
  ['灰塔', 3_540, 1_080, 6, -45],
  ['折光', 3_180, 720, 6, 188],
  ['潮汐', 2_760, 980, 5, 141],
  ['白榆', 2_430, 630, 5, 96],
  ['渡鸦', 2_080, 710, 4, 220],
  ['雾桥', 1_720, 540, 3, 74],
  ['星野', 1_380, 480, 3, 58],
  ['南栀', 1_040, 390, 2, 33],
  ['初雪', 760, 310, 1, 22],
] as const;

function refreshLeaderboard(state: EconomyState, now: number) {
  const currentAssets = totalAssets(state);
  const entries: Omit<LeaderboardEntry, 'rank'>[] = leaderboardSeeds.map(([playerName, assets, cash, facilities, weekly]) => ({
    playerName,
    totalAssets: assets,
    cashAssets: cash,
    facilityCount: facilities,
    weeklyChange: weekly,
    updatedAt: now,
  }));
  entries.push({
    playerName: state.playerName,
    totalAssets: currentAssets,
    cashAssets: state.credits + state.frozenCredits,
    facilityCount: state.facilities.length,
    weeklyChange: Math.round(currentAssets - 100),
    updatedAt: now,
    isCurrentPlayer: true,
  });
  state.leaderboard = entries
    .sort((a, b) => b.totalAssets - a.totalAssets || a.playerName.localeCompare(b.playerName, 'zh-CN'))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function createInitialState(user: AuthUser): EconomyState {
  const now = Date.now();
  const state: EconomyState = {
    version: 3,
    userId: user.id,
    playerName: user.name?.trim() || user.email.split('@')[0] || '新玩家',
    registeredAt: now,
    credits: 100,
    frozenCredits: 0,
    inventory: 0,
    frozenInventory: 0,
    inventoryCapacity: 100,
    facilitySlots: 1,
    facilities: [],
    commodityName: '基础商品',
    orders: seedOrders(now),
    facilityListings: seedFacilityListings(now),
    trades: [],
    ledger: [],
    work: {
      cooldownUntil: 0,
      lastWorkedAt: 0,
      streak: 0,
      totalClicks: 0,
    },
    demand: {
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
      facilityVolume: 0,
    },
    marketPrice: 7,
    marketPriceHistory: seedPriceHistory(now),
    leaderboard: [],
    lastProcessedAt: now,
  };
  addLedger(state, 'system', 100, '玩家测试启动资金');
  refreshLeaderboard(state, now);
  return state;
}

function migrateLegacyState(user: AuthUser, raw: string): EconomyState | null {
  try {
    const legacy: any = JSON.parse(raw);
    if (legacy.userId !== user.id) return null;
    const state = createInitialState(user);
    state.playerName = String(legacy.companyName || state.playerName).replace(/企业$/, '') || state.playerName;
    state.credits = Number(legacy.credits ?? state.credits);
    state.frozenCredits = Number(legacy.frozenCredits ?? 0);
    state.inventory = Number(legacy.inventory ?? 0);
    state.frozenInventory = Number(legacy.frozenInventory ?? 0);
    state.inventoryCapacity = Number(legacy.warehouseCapacity ?? 100);
    state.facilitySlots = Number(legacy.factorySlots ?? 1);
    state.facilities = Array.isArray(legacy.factories) ? legacy.factories : [];
    state.orders = Array.isArray(legacy.orders) ? legacy.orders : state.orders;
    state.facilityListings = (Array.isArray(legacy.factoryListings)
      ? legacy.factoryListings.map((listing: any) => ({
          ...listing,
          facilityId: listing.facilityId ?? listing.factoryId,
          facility: listing.facility ?? listing.factory,
        }))
      : state.facilityListings) as FacilityListing[];
    state.trades = (Array.isArray(legacy.trades)
      ? legacy.trades.map((trade: any) => ({ ...trade, type: trade.type === 'factory' ? 'facility' : trade.type }))
      : []) as TradeRecord[];
    state.ledger = (Array.isArray(legacy.ledger)
      ? legacy.ledger.map((entry: any) => ({
          ...entry,
          category: String(entry.category || '').replace('factory_', 'facility_'),
        }))
      : []) as LedgerEntry[];
    state.work = legacy.work ?? state.work;
    state.demand = legacy.population ?? state.demand;
    state.stats = {
      workIssued: Number(legacy.stats?.workIssued ?? 0),
      populationIssued: Number(legacy.stats?.populationIssued ?? 0),
      systemSinks: Number(legacy.stats?.systemSinks ?? 0),
      commodityVolume: Number(legacy.stats?.commodityVolume ?? 0),
      facilityVolume: Number(legacy.stats?.facilityVolume ?? legacy.stats?.factoryVolume ?? 0),
    };
    state.marketPrice = Number(legacy.marketPrice ?? 7);
    state.lastProcessedAt = Number(legacy.lastProcessedAt ?? Date.now());
    refreshLeaderboard(state, Date.now());
    return state;
  } catch {
    return null;
  }
}

function saveState(state: EconomyState) {
  localStorage.setItem(storageKey(state.userId), JSON.stringify(state));
}

function loadState(user: AuthUser): EconomyState {
  const raw = localStorage.getItem(storageKey(user.id));
  if (raw) {
    try {
      const state = JSON.parse(raw) as EconomyState;
      if (state.version === 3 && state.userId === user.id) return processState(state, Date.now());
    } catch {
      // Fall through to migration or a new state.
    }
  }
  const legacyRaw = localStorage.getItem(`${LEGACY_STORAGE_PREFIX}:${user.id}`);
  const migrated = legacyRaw ? migrateLegacyState(user, legacyRaw) : null;
  return migrated ? processState(migrated, Date.now()) : createInitialState(user);
}

function refreshExternalLiquidity(state: EconomyState, now: number) {
  const open = (order: CommodityOrder) => !['filled', 'cancelled'].includes(order.status);
  const marketBuys = state.orders.filter((order) => open(order) && order.ownerType === 'market' && order.side === 'buy');
  const marketSells = state.orders.filter((order) => open(order) && order.ownerType === 'market' && order.side === 'sell');

  if (marketBuys.length < 1) {
    state.orders.push({
      id: id('order'),
      side: 'buy',
      ownerType: 'market',
      ownerName: '玩家·流动采购',
      price: Math.max(3, state.marketPrice - 2),
      quantity: 16,
      remaining: 16,
      status: 'open',
      createdAt: now,
    });
  }

  if (marketSells.length < 2) {
    state.orders.push({
      id: id('order'),
      side: 'sell',
      ownerType: 'market',
      ownerName: '玩家·流动供给',
      price: state.marketPrice + 1 + marketSells.length,
      quantity: 12,
      remaining: 12,
      status: 'open',
      createdAt: now,
    });
  }
}

function createPopulationDemand(state: EconomyState, now: number) {
  const cycle = Math.floor(now / state.demand.cycleMs);
  const price = 6 + (cycle % 3);
  const quantity = 8 + (cycle % 5);
  const budget = price * quantity;

  state.orders.push({
    id: id('population-order'),
    side: 'buy',
    ownerType: 'population',
    ownerName: '人口需求',
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  });
  state.demand.lastPrice = price;
  state.demand.lastQuantity = quantity;
  state.demand.lastBudget = budget;
  state.demand.satisfaction = Math.min(1, Math.max(0.35, state.demand.satisfaction + ((cycle % 3) - 1) * 0.04));
  state.demand.nextDemandAt = now + state.demand.cycleMs;
}

function processFacilities(state: EconomyState, now: number) {
  state.facilities.forEach((facility) => {
    if (facility.status === 'constructing' && facility.constructionCompletesAt && now >= facility.constructionCompletesAt) {
      facility.status = 'ready';
      facility.builtAt = facility.constructionCompletesAt;
      delete facility.constructionCompletesAt;
      addLedger(state, 'system', 0, `${facility.name} 已完成施工，可启动生产`, now);
    }

    if (facility.status !== 'running' || !facility.cycleStartedAt) return;
    let completedCycles = Math.min(500, Math.floor((now - facility.cycleStartedAt) / facility.cycleMs));
    while (completedCycles > 0) {
      if (facility.internalGoods + facility.outputPerCycle > facility.internalCapacity) {
        facility.status = 'full';
        delete facility.cycleStartedAt;
        break;
      }
      if (state.credits < facility.operatingCost) {
        facility.status = 'insufficient_funds';
        delete facility.cycleStartedAt;
        break;
      }
      state.credits -= facility.operatingCost;
      state.stats.systemSinks += facility.operatingCost;
      facility.internalGoods += facility.outputPerCycle;
      facility.lifetimeOutput += facility.outputPerCycle;
      facility.cycleStartedAt += facility.cycleMs;
      addLedger(state, 'facility_operation', -facility.operatingCost, `${facility.name} 完成生产周期并支付运营费`, facility.cycleStartedAt);
      completedCycles -= 1;
    }
  });
}

function processFacilitySales(state: EconomyState, now: number) {
  const sold = state.facilityListings.filter(
    (listing) => listing.ownerType === 'player' && now - listing.createdAt >= 90_000 && listing.price <= listing.facility.systemValue * 1.2,
  );
  sold.forEach((listing) => {
    const facility = state.facilities.find((item) => item.id === listing.facilityId);
    if (!facility) return;
    state.facilities = state.facilities.filter((item) => item.id !== facility.id);
    state.facilityListings = state.facilityListings.filter((item) => item.id !== listing.id);
    state.credits += listing.price;
    state.stats.facilityVolume += listing.price;
    addTrade(state, {
      type: 'facility',
      side: 'sell',
      quantity: 1,
      price: listing.price,
      total: listing.price,
      counterparty: '模拟玩家',
      createdAt: now,
      description: `出售 ${facility.name}`,
    });
    addLedger(state, 'facility_sale', listing.price, `${facility.name} 已按挂牌价成交`, now);
  });
}

function processState(input: EconomyState, now: number): EconomyState {
  const state = cloneState(input);
  processFacilities(state, now);
  processFacilitySales(state, now);
  if (now >= state.demand.nextDemandAt) createPopulationDemand(state, now);
  refreshExternalLiquidity(state, now);
  refreshLeaderboard(state, now);
  state.lastProcessedAt = now;
  return state;
}

function sortMatches(orders: CommodityOrder[], playerSide: 'buy' | 'sell') {
  return [...orders].sort((a, b) => {
    if (a.price !== b.price) return playerSide === 'buy' ? a.price - b.price : b.price - a.price;
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
    state.stats.commodityVolume += quantity;
    recordPrice(state, tradePrice, quantity, now);

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
        addLedger(state, 'population_income', total, `人口需求消费 ${quantity} 个${state.commodityName}`, now);
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
  buildFacility: () => { ok: boolean; message: string };
  startFacility: (facilityId: string) => void;
  pauseFacility: (facilityId: string) => void;
  collectFacility: (facilityId: string) => { ok: boolean; message: string };
  listFacility: (facilityId: string, price: number) => { ok: boolean; message: string };
  cancelFacilityListing: (listingId: string) => void;
  buyFacility: (listingId: string) => { ok: boolean; message: string };
  placeCommodityOrder: (side: 'buy' | 'sell', quantity: number, price: number) => { ok: boolean; message: string };
  cancelOrder: (orderId: string) => void;
  renamePlayer: (name: string) => void;
}

function commit(set: (updater: (store: GameStore) => Partial<GameStore>) => void, updater: (state: EconomyState) => void) {
  set((store) => {
    if (!store.game) return {};
    const next = processState(store.game, Date.now());
    updater(next);
    refreshLeaderboard(next, Date.now());
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
    if (now < game.work.cooldownUntil) return { ok: false, message: '工作冷却尚未结束' };

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

  buildFacility: () => {
    const game = get().game;
    if (!game) return { ok: false, message: '游戏状态尚未加载' };
    if (game.facilities.length >= game.facilitySlots) return { ok: false, message: '生产设施槽位不足' };
    if (game.facilities.some((facility) => facility.status === 'constructing')) return { ok: false, message: '同时只能施工一座生产设施' };
    if (game.credits < BUILD_COST) return { ok: false, message: '建造资金不足' };

    const now = Date.now();
    commit(set, (state) => {
      state.credits -= BUILD_COST;
      state.stats.systemSinks += BUILD_COST;
      state.facilities.push({
        id: id('facility'),
        name: `基础生产设施 ${state.facilities.length + 1}`,
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
      addLedger(state, 'facility_construction', -BUILD_COST, '支付基础生产设施建造费用', now);
    });
    return { ok: true, message: '生产设施开始施工，预计 5 分钟完成' };
  },

  startFacility: (facilityId) => {
    commit(set, (state) => {
      const facility = state.facilities.find((item) => item.id === facilityId);
      if (!facility || facility.status === 'constructing' || facility.status === 'listed') return;
      if (facility.internalGoods >= facility.internalCapacity) {
        facility.status = 'full';
        return;
      }
      if (state.credits < facility.operatingCost) {
        facility.status = 'insufficient_funds';
        return;
      }
      facility.status = 'running';
      facility.cycleStartedAt = Date.now();
    });
  },

  pauseFacility: (facilityId) => {
    commit(set, (state) => {
      const facility = state.facilities.find((item) => item.id === facilityId);
      if (!facility || facility.status !== 'running') return;
      facility.status = 'paused';
      delete facility.cycleStartedAt;
    });
  },

  collectFacility: (facilityId) => {
    const game = get().game;
    const facility = game?.facilities.find((item) => item.id === facilityId);
    if (!game || !facility || facility.internalGoods <= 0) return { ok: false, message: '没有可领取的商品' };
    const freeCapacity = game.inventoryCapacity - game.inventory - game.frozenInventory;
    if (freeCapacity <= 0) return { ok: false, message: '玩家库存已满' };
    const amount = Math.min(facility.internalGoods, freeCapacity);

    commit(set, (state) => {
      const target = state.facilities.find((item) => item.id === facilityId);
      if (!target) return;
      target.internalGoods -= amount;
      state.inventory += amount;
      if (target.status === 'full' && target.internalGoods < target.internalCapacity) target.status = 'paused';
      addLedger(state, 'inventory', 0, `从 ${target.name} 领取 ${amount} 个${state.commodityName}`);
    });
    return { ok: true, message: `已领取 ${amount} 个${game.commodityName}` };
  },

  listFacility: (facilityId, price) => {
    const game = get().game;
    const facility = game?.facilities.find((item) => item.id === facilityId);
    if (!game || !facility) return { ok: false, message: '生产设施不存在' };
    if (!['ready', 'paused', 'full', 'insufficient_funds'].includes(facility.status)) return { ok: false, message: '当前状态不能挂牌' };
    if (facility.internalGoods > 0) return { ok: false, message: '挂牌前必须领取全部内部商品' };
    if (price < facility.systemValue * 0.5 || price > facility.systemValue * 2) return { ok: false, message: '挂牌价必须在系统估值的 50%～200% 之间' };

    commit(set, (state) => {
      const target = state.facilities.find((item) => item.id === facilityId);
      if (!target) return;
      const listingId = id('facility-listing');
      target.status = 'listed';
      target.listedOrderId = listingId;
      delete target.cycleStartedAt;
      state.facilityListings.push({
        id: listingId,
        facilityId: target.id,
        ownerType: 'player',
        ownerId: state.userId,
        ownerName: state.playerName,
        price: Math.floor(price),
        createdAt: Date.now(),
        facility: {
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
    return { ok: true, message: '生产设施已进入市场挂牌' };
  },

  cancelFacilityListing: (listingId) => {
    commit(set, (state) => {
      const listing = state.facilityListings.find((item) => item.id === listingId && item.ownerId === state.userId);
      if (!listing) return;
      const facility = state.facilities.find((item) => item.id === listing.facilityId);
      if (facility) {
        facility.status = 'paused';
        delete facility.listedOrderId;
      }
      state.facilityListings = state.facilityListings.filter((item) => item.id !== listingId);
    });
  },

  buyFacility: (listingId) => {
    const game = get().game;
    const listing = game?.facilityListings.find((item) => item.id === listingId);
    if (!game || !listing || listing.ownerId === game.userId) return { ok: false, message: '无法购买该挂牌' };
    if (game.facilities.length >= game.facilitySlots) return { ok: false, message: '生产设施槽位不足' };
    if (game.credits < listing.price) return { ok: false, message: '购买资金不足' };

    const now = Date.now();
    commit(set, (state) => {
      const target = state.facilityListings.find((item) => item.id === listingId);
      if (!target) return;
      state.credits -= target.price;
      state.stats.facilityVolume += target.price;
      state.facilityListings = state.facilityListings.filter((item) => item.id !== listingId);
      state.facilities.push({
        id: id('facility'),
        name: target.facility.name,
        ownerId: state.userId,
        level: target.facility.level,
        status: 'ready',
        builtAt: now,
        cycleMs: target.facility.cycleMs,
        outputPerCycle: target.facility.outputPerCycle,
        operatingCost: target.facility.operatingCost,
        internalGoods: 0,
        internalCapacity: target.facility.internalCapacity,
        lifetimeOutput: target.facility.lifetimeOutput,
        systemValue: target.facility.systemValue,
      });
      addTrade(state, {
        type: 'facility',
        side: 'buy',
        quantity: 1,
        price: target.price,
        total: target.price,
        counterparty: target.ownerName,
        createdAt: now,
        description: `收购 ${target.facility.name}`,
      });
      addLedger(state, 'facility_trade', -target.price, `从 ${target.ownerName} 收购 ${target.facility.name}`, now);
    });
    return { ok: true, message: '生产设施产权已即时交割' };
  },

  placeCommodityOrder: (side, quantityInput, priceInput) => {
    const game = get().game;
    if (!game) return { ok: false, message: '游戏状态尚未加载' };
    const quantity = Math.max(1, Math.floor(quantityInput));
    const price = Math.max(1, Math.floor(priceInput));
    const ownOpen = game.orders.filter((order) => order.ownerId === game.userId && ['open', 'partial'].includes(order.status));
    if (ownOpen.length >= MAX_OPEN_ORDERS) return { ok: false, message: '最多只能有 10 笔未完成订单' };
    if (side === 'buy' && game.credits < quantity * price) return { ok: false, message: '可用资金不足' };
    if (side === 'sell' && game.inventory < quantity) return { ok: false, message: '可用库存不足' };
    if (side === 'buy') {
      const pendingBuyQuantity = ownOpen.filter((order) => order.side === 'buy').reduce((sum, order) => sum + order.remaining, 0);
      if (game.inventory + pendingBuyQuantity + quantity > game.inventoryCapacity) return { ok: false, message: '玩家库存容量不足' };
    }

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
        ownerName: state.playerName,
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

  renamePlayer: (name) => {
    const clean = name.trim().slice(0, 32);
    if (!clean) return;
    commit(set, (state) => {
      state.playerName = clean;
      state.orders.forEach((order) => {
        if (order.ownerId === state.userId) order.ownerName = clean;
      });
      state.facilityListings.forEach((listing) => {
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
