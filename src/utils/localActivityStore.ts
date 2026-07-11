import type {
  AssetEvent,
  AssetEventCategory,
  AssetFacilityChange,
  AssetInventoryChange,
  AssetProductionChange,
  AssetWarehouseChange,
  CommodityOrder,
  EconomyState,
  FacilityListing,
  ProductDefinition,
  ProductInventory,
  ProductionFacility,
  TradeRecord,
} from '../types';

const STORAGE_VERSION = 1;
const MAX_ASSET_EVENTS = 480;
const MAX_TRADES = 240;

export type LocalActivityAction =
  | 'refresh'
  | 'work'
  | 'upgradeWarehouse'
  | 'placeOrder'
  | 'cancelOrder'
  | 'buildFacility'
  | 'startFacility'
  | 'pauseFacility'
  | 'setProductionPlan'
  | 'listFacility'
  | 'cancelFacilityListing'
  | 'buyFacility'
  | 'renamePlayer'
  | 'resetPlayer';

export interface LocalActivityView {
  assetEvents: AssetEvent[];
  trades: TradeRecord[];
}

interface LocalMarketSnapshot {
  lastPrice: number;
}

interface LocalStateSnapshot {
  userId: number;
  credits: number;
  frozenCredits: number;
  inventories: Record<string, ProductInventory>;
  inventoryCapacity: number;
  warehouseLevel?: number;
  facilities: ProductionFacility[];
  orders: CommodityOrder[];
  facilityListings: FacilityListing[];
  products: ProductDefinition[];
  markets: Record<string, LocalMarketSnapshot>;
}

interface LocalActivityDocument extends LocalActivityView {
  version: number;
  snapshot?: LocalStateSnapshot;
}

interface SyncContext {
  action: LocalActivityAction;
  message?: string;
  createdAt?: number;
}

const ACTION_CATEGORY_MAP: Record<LocalActivityAction, AssetEventCategory> = {
  refresh: 'system',
  work: 'work',
  upgradeWarehouse: 'warehouse',
  placeOrder: 'order',
  cancelOrder: 'order',
  buildFacility: 'facility',
  startFacility: 'production',
  pauseFacility: 'production',
  setProductionPlan: 'production',
  listFacility: 'facility',
  cancelFacilityListing: 'facility',
  buyFacility: 'facility',
  renamePlayer: 'system',
  resetPlayer: 'system',
};

function storageKey(userId: number) {
  return `economy.local-activity.v${STORAGE_VERSION}.${userId}`;
}

function emptyDocument(): LocalActivityDocument {
  return { version: STORAGE_VERSION, assetEvents: [], trades: [] };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readDocument(userId: number): LocalActivityDocument {
  if (typeof window === 'undefined') return emptyDocument();
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return emptyDocument();
    const parsed = JSON.parse(raw) as Partial<LocalActivityDocument>;
    if (parsed.version !== STORAGE_VERSION) return emptyDocument();
    return {
      version: STORAGE_VERSION,
      assetEvents: Array.isArray(parsed.assetEvents) ? parsed.assetEvents.slice(0, MAX_ASSET_EVENTS) : [],
      trades: Array.isArray(parsed.trades) ? parsed.trades.slice(0, MAX_TRADES) : [],
      snapshot: parsed.snapshot,
    };
  } catch {
    return emptyDocument();
  }
}

function writeDocument(userId: number, document: LocalActivityDocument) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(document));
  } catch {
    // Local logs are optional and must never block authoritative game actions.
  }
}

function snapshotState(state: EconomyState): LocalStateSnapshot {
  return clone({
    userId: state.userId,
    credits: state.credits,
    frozenCredits: state.frozenCredits,
    inventories: state.inventories,
    inventoryCapacity: state.inventoryCapacity,
    warehouseLevel: state.warehouseLevel,
    facilities: state.facilities,
    orders: state.orders.filter((order) => order.ownerId === state.userId),
    facilityListings: state.facilityListings.filter((listing) => listing.ownerId === state.userId),
    products: state.products,
    markets: Object.fromEntries(
      Object.entries(state.markets).map(([productId, market]) => [productId, { lastPrice: market.lastPrice }]),
    ),
  });
}

function productName(snapshot: LocalStateSnapshot, productId?: string) {
  return snapshot.products.find((product) => product.id === productId)?.name ?? productId ?? '商品';
}

function normalizeInventory(inventory?: ProductInventory): ProductInventory {
  return {
    available: Number(inventory?.available || 0),
    frozen: Number(inventory?.frozen || 0),
  };
}

function diffInventories(before: LocalStateSnapshot, after: LocalStateSnapshot): AssetInventoryChange[] {
  const productIds = new Set([
    ...Object.keys(before.inventories),
    ...Object.keys(after.inventories),
  ]);
  const changes: AssetInventoryChange[] = [];
  for (const productId of productIds) {
    const previous = normalizeInventory(before.inventories[productId]);
    const current = normalizeInventory(after.inventories[productId]);
    const availableDelta = current.available - previous.available;
    const frozenDelta = current.frozen - previous.frozen;
    if (!availableDelta && !frozenDelta) continue;
    changes.push({
      productId,
      availableDelta,
      frozenDelta,
      availableAfter: current.available,
      frozenAfter: current.frozen,
    });
  }
  return changes;
}

function diffWarehouse(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
): AssetWarehouseChange | undefined {
  const beforeLevel = Number(before.warehouseLevel);
  const afterLevel = Number(after.warehouseLevel);
  if (!Number.isFinite(beforeLevel) || !Number.isFinite(afterLevel)) return undefined;
  if (beforeLevel === afterLevel && before.inventoryCapacity === after.inventoryCapacity) return undefined;
  return {
    beforeLevel,
    afterLevel,
    beforeCapacity: before.inventoryCapacity,
    afterCapacity: after.inventoryCapacity,
    capacityDelta: after.inventoryCapacity - before.inventoryCapacity,
  };
}

function facilityAction(
  action: LocalActivityAction,
  previous: ProductionFacility | undefined,
  current: ProductionFacility | undefined,
): AssetFacilityChange['action'] {
  if (!previous && current) return action === 'buyFacility' ? 'acquired' : 'construction_started';
  if (previous && !current) return action === 'buyFacility' || action === 'refresh' ? 'sold' : 'removed';
  if (action === 'listFacility') return 'listed';
  if (action === 'cancelFacilityListing') return 'unlisted';
  if (action === 'setProductionPlan') return 'plan_updated';
  if (action === 'startFacility') return 'started';
  if (action === 'pauseFacility') return 'stopped';
  if (previous?.status === 'constructing' && current?.status === 'ready') return 'construction_completed';
  if (previous?.status !== current?.status) return 'status_changed';
  return 'updated';
}

function diffFacilities(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  action: LocalActivityAction,
): { facilityChanges: AssetFacilityChange[]; productionChanges: AssetProductionChange[] } {
  const previousById = new Map(before.facilities.map((facility) => [facility.id, facility]));
  const currentById = new Map(after.facilities.map((facility) => [facility.id, facility]));
  const facilityIds = new Set([...previousById.keys(), ...currentById.keys()]);
  const facilityChanges: AssetFacilityChange[] = [];
  const productionChanges: AssetProductionChange[] = [];

  for (const facilityId of facilityIds) {
    const previous = previousById.get(facilityId);
    const current = currentById.get(facilityId);
    const stateChanged = !previous || !current
      || previous.status !== current.status
      || previous.stopReason !== current.stopReason
      || previous.productionMode !== current.productionMode
      || previous.targetQuantity !== current.targetQuantity;
    if (stateChanged) {
      const reference = current ?? previous;
      facilityChanges.push({
        facilityId,
        facilityTypeId: reference?.facilityTypeId,
        facilityName: reference?.name,
        action: facilityAction(action, previous, current),
        beforeStatus: previous?.status,
        afterStatus: current?.status,
      });
    }

    if (!previous || !current) continue;
    const completedQuantityDelta = current.completedQuantity - previous.completedQuantity;
    if (completedQuantityDelta <= 0) continue;
    const completedCycles = current.outputPerCycle > 0
      ? Math.max(0, Math.floor(completedQuantityDelta / current.outputPerCycle))
      : 0;
    productionChanges.push({
      facilityId,
      facilityName: current.name,
      action: 'produced',
      inputProductId: current.inputProductId,
      inputQuantity: completedCycles * current.inputPerCycle,
      outputProductId: current.outputProductId,
      outputQuantity: completedQuantityDelta,
      completedQuantityDelta,
    });
  }

  return { facilityChanges, productionChanges };
}

function orderChanged(before: LocalStateSnapshot, after: LocalStateSnapshot) {
  return JSON.stringify(before.orders) !== JSON.stringify(after.orders);
}

function listingChanged(before: LocalStateSnapshot, after: LocalStateSnapshot) {
  return JSON.stringify(before.facilityListings) !== JSON.stringify(after.facilityListings);
}

function deriveCommodityTrades(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  createdAt: number,
): TradeRecord[] {
  const previousById = new Map(before.orders.map((order) => [order.id, order]));
  const records: TradeRecord[] = [];
  for (const order of after.orders) {
    const previousRemaining = previousById.get(order.id)?.remaining ?? order.quantity;
    const executedQuantity = Math.max(0, previousRemaining - order.remaining);
    if (!executedQuantity) continue;
    const price = after.markets[order.productId]?.lastPrice ?? order.price;
    records.push({
      id: createId('local-trade'),
      type: 'commodity',
      productId: order.productId,
      side: order.side,
      quantity: executedQuantity,
      price,
      total: executedQuantity * price,
      counterparty: '市场成交',
      createdAt,
      description: `${order.side === 'buy' ? '买入' : '卖出'} ${productName(after, order.productId)}`,
    });
  }
  return records;
}

function deriveFacilityTrades(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  action: LocalActivityAction,
  createdAt: number,
): TradeRecord[] {
  const previousById = new Map(before.facilities.map((facility) => [facility.id, facility]));
  const currentById = new Map(after.facilities.map((facility) => [facility.id, facility]));
  const acquired = after.facilities.filter((facility) => !previousById.has(facility.id));
  const sold = before.facilities.filter((facility) => !currentById.has(facility.id));
  const records: TradeRecord[] = [];

  if (action === 'buyFacility' && acquired.length === 1) {
    const facility = acquired[0];
    const total = Math.max(0, before.credits - after.credits);
    records.push({
      id: createId('local-trade'),
      type: 'facility',
      side: 'buy',
      quantity: 1,
      price: total,
      total,
      counterparty: '设施市场',
      createdAt,
      description: `收购 ${facility.name}`,
    });
  }

  if (action === 'refresh' && sold.length === 1 && after.credits > before.credits) {
    const facility = sold[0];
    const total = after.credits - before.credits;
    records.push({
      id: createId('local-trade'),
      type: 'facility',
      side: 'sell',
      quantity: 1,
      price: total,
      total,
      counterparty: '设施市场',
      createdAt,
      description: `出售 ${facility.name}`,
    });
  }

  return records;
}

function inferCategory(
  action: LocalActivityAction,
  trades: TradeRecord[],
  inventoryChanges: AssetInventoryChange[],
  warehouseChange: AssetWarehouseChange | undefined,
  facilityChanges: AssetFacilityChange[],
  productionChanges: AssetProductionChange[],
): AssetEventCategory {
  if (trades.length) return 'trade';
  if (action !== 'refresh') return ACTION_CATEGORY_MAP[action];
  if (productionChanges.length) return 'production';
  if (facilityChanges.length) return 'facility';
  if (warehouseChange) return 'warehouse';
  if (inventoryChanges.length) return 'inventory';
  return 'system';
}

function defaultDescription(
  action: LocalActivityAction,
  category: AssetEventCategory,
  trades: TradeRecord[],
) {
  if (trades.length === 1) return trades[0].description;
  if (trades.length > 1) return `${trades.length} 笔市场成交已同步`;
  if (action === 'upgradeWarehouse') return '共享仓库已扩容';
  if (action === 'refresh') {
    if (category === 'production') return '生产完成，产成品已直接进入共享仓库';
    if (category === 'facility') return '工厂状态已同步';
    if (category === 'warehouse') return '仓库等级与容量已同步';
    if (category === 'inventory') return '商品库存已同步';
    return '服务器资产状态已同步';
  }
  return '本地活动记录已更新';
}

function createLocalChanges(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  context: SyncContext,
): { event: AssetEvent | null; trades: TradeRecord[] } {
  const createdAt = context.createdAt ?? Date.now();
  const inventoryChanges = diffInventories(before, after);
  const warehouseChange = diffWarehouse(before, after);
  const { facilityChanges, productionChanges } = diffFacilities(before, after, context.action);
  const trades = [
    ...deriveCommodityTrades(before, after, createdAt),
    ...deriveFacilityTrades(before, after, context.action, createdAt),
  ];
  const cashDelta = after.credits - before.credits;
  const frozenCashDelta = after.frozenCredits - before.frozenCredits;
  const hasChanges = Boolean(
    cashDelta
    || frozenCashDelta
    || inventoryChanges.length
    || warehouseChange
    || facilityChanges.length
    || productionChanges.length
    || orderChanged(before, after)
    || listingChanged(before, after)
  );
  if (!hasChanges) return { event: null, trades };

  const category = inferCategory(
    context.action,
    trades,
    inventoryChanges,
    warehouseChange,
    facilityChanges,
    productionChanges,
  );
  const sourceType = trades.length
    ? 'trade'
    : context.action === 'placeOrder' || context.action === 'cancelOrder'
      ? 'order'
      : context.action === 'upgradeWarehouse'
        ? 'warehouse'
        : context.action.includes('Facility') || context.action === 'buildFacility'
          ? 'facility'
          : context.action === 'work'
            ? 'work'
            : category === 'production'
              ? 'production'
              : 'system';

  return {
    event: {
      id: createId('local-asset-event'),
      category,
      createdAt,
      description: context.message || defaultDescription(context.action, category, trades),
      cashDelta,
      availableCashAfter: after.credits,
      frozenCashDelta,
      frozenCashAfter: after.frozenCredits,
      inventoryChanges,
      warehouseChange,
      facilityChanges,
      productionChanges,
      sourceType,
      sourceId: trades[0]?.id,
      localOnly: true,
    },
    trades,
  };
}

function viewOf(document: LocalActivityDocument): LocalActivityView {
  return {
    assetEvents: document.assetEvents,
    trades: document.trades,
  };
}

export function loadLocalActivity(userId: number): LocalActivityView {
  return viewOf(readDocument(userId));
}

export function syncLocalActivity(
  userId: number,
  state: EconomyState,
  context: SyncContext,
): LocalActivityView {
  const document = readDocument(userId);
  const after = snapshotState(state);
  if (!document.snapshot || document.snapshot.userId !== state.userId) {
    document.snapshot = after;
    writeDocument(userId, document);
    return viewOf(document);
  }

  const { event, trades } = createLocalChanges(document.snapshot, after, context);
  if (event) document.assetEvents = [event, ...document.assetEvents].slice(0, MAX_ASSET_EVENTS);
  if (trades.length) document.trades = [...trades, ...document.trades].slice(0, MAX_TRADES);
  document.snapshot = after;
  writeDocument(userId, document);
  return viewOf(document);
}

export function clearLocalActivity(userId: number, state?: EconomyState): LocalActivityView {
  const document: LocalActivityDocument = {
    version: STORAGE_VERSION,
    assetEvents: [],
    trades: [],
    snapshot: state ? snapshotState(state) : undefined,
  };
  writeDocument(userId, document);
  return viewOf(document);
}
