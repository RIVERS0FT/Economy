import type {
  AssetEvent,
  AssetEventCategory,
  AssetFacilityChange,
  AssetInventoryChange,
  AssetProductionChange,
  AssetWarehouseChange,
  CommodityOrder,
  EconomyState,
  FacilityConstruction,
  FacilityGroup,
  FacilityListing,
  ProductDefinition,
  ProductInventory,
  TradeRecord,
} from '../types';

const STORAGE_VERSION = 2;
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
  facilityGroups: FacilityGroup[];
  facilityConstruction?: FacilityConstruction;
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

function storageKey(userId: number, version = STORAGE_VERSION) {
  return `economy.local-activity.v${version}.${userId}`;
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

function parseDocument(raw: string | null): LocalActivityDocument | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalActivityDocument>;
    return {
      version: STORAGE_VERSION,
      assetEvents: Array.isArray(parsed.assetEvents) ? parsed.assetEvents.slice(0, MAX_ASSET_EVENTS) : [],
      trades: Array.isArray(parsed.trades) ? parsed.trades.slice(0, MAX_TRADES) : [],
      snapshot: parsed.version === STORAGE_VERSION ? parsed.snapshot : undefined,
    };
  } catch {
    return null;
  }
}

function readDocument(userId: number): LocalActivityDocument {
  if (typeof window === 'undefined') return emptyDocument();
  const current = parseDocument(window.localStorage.getItem(storageKey(userId)));
  if (current) return current;
  const legacy = parseDocument(window.localStorage.getItem(storageKey(userId, 1)));
  return legacy ?? emptyDocument();
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
    facilityGroups: state.facilityGroups,
    facilityConstruction: state.facilityConstruction,
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

function facilityName(typeId: string) {
  const names: Record<string, string> = {
    farm: '农场',
    mine: '矿场',
    mill: '面粉厂',
    steelworks: '钢铁厂',
    'food-factory': '食品厂',
    'machine-factory': '机械厂',
  };
  return names[typeId] ?? typeId;
}

function normalizeInventory(inventory?: ProductInventory): ProductInventory {
  return {
    available: Number(inventory?.available || 0),
    frozen: Number(inventory?.frozen || 0),
  };
}

function diffInventories(before: LocalStateSnapshot, after: LocalStateSnapshot): AssetInventoryChange[] {
  const productIds = new Set([...Object.keys(before.inventories), ...Object.keys(after.inventories)]);
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

function diffWarehouse(before: LocalStateSnapshot, after: LocalStateSnapshot): AssetWarehouseChange | undefined {
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
  previous: FacilityGroup | undefined,
  current: FacilityGroup | undefined,
): AssetFacilityChange['action'] {
  if (!previous && current) return action === 'buyFacility' ? 'acquired' : 'construction_completed';
  if (previous && !current) return action === 'refresh' ? 'sold' : 'removed';
  if (action === 'listFacility') return 'listed';
  if (action === 'cancelFacilityListing') return 'unlisted';
  if (action === 'setProductionPlan') return 'plan_updated';
  if (action === 'startFacility') return 'started';
  if (action === 'pauseFacility') return 'stopped';
  if (previous?.count !== current?.count) return (current?.count ?? 0) > (previous?.count ?? 0) ? 'acquired' : 'sold';
  if (previous?.status !== current?.status) return 'status_changed';
  return 'updated';
}

function diffFacilityGroups(
  before: LocalStateSnapshot,
  after: LocalStateSnapshot,
  action: LocalActivityAction,
): { facilityChanges: AssetFacilityChange[]; productionChanges: AssetProductionChange[] } {
  const previousByType = new Map(before.facilityGroups.map((group) => [group.facilityTypeId, group]));
  const currentByType = new Map(after.facilityGroups.map((group) => [group.facilityTypeId, group]));
  const typeIds = new Set([...previousByType.keys(), ...currentByType.keys()]);
  const facilityChanges: AssetFacilityChange[] = [];
  const productionChanges: AssetProductionChange[] = [];

  if (!before.facilityConstruction && after.facilityConstruction) {
    const typeId = after.facilityConstruction.facilityTypeId;
    const group = currentByType.get(typeId);
    facilityChanges.push({
      facilityTypeId: typeId,
      facilityName: facilityName(typeId),
      action: 'construction_started',
      beforeCount: group?.count ?? 0,
      afterCount: group?.count ?? 0,
      countDelta: 0,
    });
  }

  for (const typeId of typeIds) {
    const previous = previousByType.get(typeId);
    const current = currentByType.get(typeId);
    const beforeCount = previous?.count ?? 0;
    const afterCount = current?.count ?? 0;
    const stateChanged = !previous || !current
      || beforeCount !== afterCount
      || previous.status !== current.status
      || previous.stopReason !== current.stopReason
      || previous.productionMode !== current.productionMode
      || previous.targetQuantity !== current.targetQuantity
      || previous.listedCount !== current.listedCount;
    if (stateChanged) {
      facilityChanges.push({
        facilityTypeId: typeId,
        facilityName: facilityName(typeId),
        action: facilityAction(action, previous, current),
        beforeStatus: previous?.status,
        afterStatus: current?.status,
        beforeCount,
        afterCount,
        countDelta: afterCount - beforeCount,
      });
    }

    if (!previous || !current) continue;
    const completedQuantityDelta = current.completedQuantity - previous.completedQuantity;
    if (completedQuantityDelta <= 0) continue;
    const inventoryOutput = Object.entries(after.inventories).find(([productId]) => (
      (after.inventories[productId]?.available ?? 0) > (before.inventories[productId]?.available ?? 0)
    ));
    productionChanges.push({
      facilityTypeId: typeId,
      facilityName: facilityName(typeId),
      action: 'produced',
      outputProductId: inventoryOutput?.[0],
      outputQuantity: completedQuantityDelta,
      inputQuantity: 0,
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
  const previousByType = new Map(before.facilityGroups.map((group) => [group.facilityTypeId, group.count]));
  const currentByType = new Map(after.facilityGroups.map((group) => [group.facilityTypeId, group.count]));
  const records: TradeRecord[] = [];
  const typeIds = new Set([...previousByType.keys(), ...currentByType.keys()]);
  for (const typeId of typeIds) {
    const delta = (currentByType.get(typeId) ?? 0) - (previousByType.get(typeId) ?? 0);
    if (action === 'buyFacility' && delta > 0) {
      const total = Math.max(0, before.credits - after.credits);
      records.push({
        id: createId('local-trade'),
        type: 'facility',
        facilityTypeId: typeId,
        side: 'buy',
        quantity: delta,
        price: delta ? total / delta : 0,
        total,
        counterparty: '工厂数量市场',
        createdAt,
        description: `收购 ${delta} 座${facilityName(typeId)}`,
      });
    }
    if (action === 'refresh' && delta < 0 && after.credits > before.credits) {
      const quantity = Math.abs(delta);
      const total = after.credits - before.credits;
      records.push({
        id: createId('local-trade'),
        type: 'facility',
        facilityTypeId: typeId,
        side: 'sell',
        quantity,
        price: quantity ? total / quantity : 0,
        total,
        counterparty: '工厂数量市场',
        createdAt,
        description: `出售 ${quantity} 座${facilityName(typeId)}`,
      });
    }
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

function defaultDescription(action: LocalActivityAction, category: AssetEventCategory, trades: TradeRecord[]) {
  if (trades.length === 1) return trades[0].description;
  if (trades.length > 1) return `${trades.length} 笔市场成交已同步`;
  if (action === 'upgradeWarehouse') return '共享仓库已扩容';
  if (action === 'buildFacility') return '工厂开始施工';
  if (action === 'refresh') {
    if (category === 'production') return '工厂集群产出已进入共享仓库';
    if (category === 'facility') return '工厂集群状态已同步';
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
  const { facilityChanges, productionChanges } = diffFacilityGroups(before, after, context.action);
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
  return { assetEvents: document.assetEvents, trades: document.trades };
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
