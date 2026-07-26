import type {
  AssetKind,
  EconomyState,
  OrderFill,
  OrderSide,
  TradeRecord,
} from '../types';

const STORAGE_VERSION = 6;
const MAX_TRADES = 240;
const documentCache = new Map<number, LocalActivityDocument>();
const pendingDocuments = new Map<number, LocalActivityDocument>();
let pendingWriteHandle: number | null = null;
let pendingWriteUsesIdleCallback = false;
let flushListenerInstalled = false;

export type LocalActivityAction =
  | 'refresh'
  | 'work'
  | 'checkIn'
  | 'upgradeWarehouse'
  | 'placeOrder'
  | 'cancelOrder'
  | 'buildFacility'
  | 'startFacility'
  | 'pauseFacility'
  | 'setFacilityRecipe'
  | 'listFacility'
  | 'cancelFacilityListing'
  | 'buyFacility'
  | 'renamePlayer'
  | 'redeemGift'
  | 'exchangeGems'
  | 'bankDeposit'
  | 'bankWithdraw'
  | 'bankBorrow'
  | 'bankRepay'
  | 'bankSetAutoRepay';

export interface LocalActivityView {
  trades: TradeRecord[];
}

interface LocalTradeOrderSnapshot {
  id: string;
  assetKind: AssetKind;
  assetId: string;
  productId?: string;
  facilityTypeId?: string;
  side: OrderSide;
  fills: OrderFill[];
}

interface LocalTradeCatalogItem {
  id: string;
  name: string;
}

interface LocalTradeSnapshot {
  userId: number;
  orders: LocalTradeOrderSnapshot[];
  products: LocalTradeCatalogItem[];
  facilityTypes: LocalTradeCatalogItem[];
}

interface LocalActivityDocument {
  version: number;
  trades: TradeRecord[];
  snapshot?: LocalTradeSnapshot;
}

interface SyncContext {
  action: LocalActivityAction;
  message?: string;
  createdAt?: number;
}

function storageKey(userId: number, version = STORAGE_VERSION) {
  return `economy.local-activity.v${version}.${userId}`;
}

function emptyDocument(): LocalActivityDocument {
  return { version: STORAGE_VERSION, trades: [] };
}

function clone<T>(value: T): T {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeTrades(trades: unknown[]): TradeRecord[] {
  return trades.slice(0, MAX_TRADES).map((raw) => {
    const trade = raw as Partial<TradeRecord>;
    return {
      id: String(trade.id || createId('local-trade')),
      type: trade.type === 'facility' ? 'facility' : 'commodity',
      productId: typeof trade.productId === 'string' ? trade.productId : undefined,
      facilityTypeId: typeof trade.facilityTypeId === 'string' ? trade.facilityTypeId : undefined,
      side: trade.side === 'sell' ? 'sell' : 'buy',
      quantity: Number(trade.quantity || 0),
      price: Number(trade.price || 0),
      total: Number(trade.total || 0),
      fee: Number(trade.fee || 0),
      netTotal: Number(trade.netTotal ?? trade.total ?? 0),
      createdAt: Number(trade.createdAt || 0),
      description: String(trade.description || '订单成交'),
    };
  });
}

function normalizeSnapshot(raw: unknown): LocalTradeSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const snapshot = raw as Partial<LocalTradeSnapshot>;
  if (!Number.isInteger(Number(snapshot.userId))
    || !Array.isArray(snapshot.orders)
    || !Array.isArray(snapshot.products)
    || !Array.isArray(snapshot.facilityTypes)) return undefined;
  return {
    userId: Number(snapshot.userId),
    orders: snapshot.orders.flatMap((rawOrder) => {
      if (!rawOrder || typeof rawOrder !== 'object') return [];
      const order = rawOrder as Partial<LocalTradeOrderSnapshot>;
      if (typeof order.id !== 'string'
        || !['commodity', 'facility'].includes(String(order.assetKind))
        || typeof order.assetId !== 'string'
        || !['buy', 'sell'].includes(String(order.side))) return [];
      return [{
        id: order.id,
        assetKind: order.assetKind as AssetKind,
        assetId: order.assetId,
        productId: typeof order.productId === 'string' ? order.productId : undefined,
        facilityTypeId: typeof order.facilityTypeId === 'string' ? order.facilityTypeId : undefined,
        side: order.side as OrderSide,
        fills: Array.isArray(order.fills) ? order.fills.map((fill) => ({
          id: String(fill.id || ''),
          quantity: Number(fill.quantity || 0),
          price: Number(fill.price || 0),
          total: Number(fill.total || 0),
          fee: Number(fill.fee || 0),
          netTotal: Number(fill.netTotal ?? fill.total ?? 0),
          createdAt: Number(fill.createdAt || 0),
        })).filter((fill) => fill.id) : [],
      }];
    }),
    products: snapshot.products.flatMap((item) => (
      item && typeof item.id === 'string' && typeof item.name === 'string'
        ? [{ id: item.id, name: item.name }]
        : []
    )),
    facilityTypes: snapshot.facilityTypes.flatMap((item) => (
      item && typeof item.id === 'string' && typeof item.name === 'string'
        ? [{ id: item.id, name: item.name }]
        : []
    )),
  };
}

function parseCurrentDocument(raw: string | null): LocalActivityDocument | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalActivityDocument>;
    if (parsed.version !== STORAGE_VERSION) return null;
    return {
      version: STORAGE_VERSION,
      trades: Array.isArray(parsed.trades) ? normalizeTrades(parsed.trades) : [],
      snapshot: normalizeSnapshot(parsed.snapshot),
    };
  } catch {
    return null;
  }
}

function parseLegacyTrades(raw: string | null): TradeRecord[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { trades?: unknown[] };
    return Array.isArray(parsed.trades) ? normalizeTrades(parsed.trades) : [];
  } catch {
    return null;
  }
}

function readStorageItem(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persistDocument(userId: number, document: LocalActivityDocument) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(document));
    for (const legacyVersion of [5, 4, 3, 2, 1]) {
      window.localStorage.removeItem(storageKey(userId, legacyVersion));
    }
  } catch {
    // Local trade history is optional and must never block authoritative game actions.
  }
}

function flushPendingDocuments() {
  pendingWriteHandle = null;
  pendingWriteUsesIdleCallback = false;
  for (const [userId, document] of pendingDocuments) persistDocument(userId, document);
  pendingDocuments.clear();
}

function ensureFlushListener() {
  if (flushListenerInstalled || typeof window === 'undefined') return;
  flushListenerInstalled = true;
  window.addEventListener('pagehide', flushPendingDocuments);
}

function scheduleDocumentWrite(userId: number, document: LocalActivityDocument) {
  documentCache.set(userId, document);
  if (typeof window === 'undefined') return;
  ensureFlushListener();
  pendingDocuments.set(userId, document);
  if (pendingWriteHandle !== null) return;
  if (typeof window.requestIdleCallback === 'function') {
    pendingWriteUsesIdleCallback = true;
    pendingWriteHandle = window.requestIdleCallback(flushPendingDocuments, { timeout: 1_000 });
  } else {
    pendingWriteHandle = window.setTimeout(flushPendingDocuments, 0);
  }
}

function writeDocumentImmediately(userId: number, document: LocalActivityDocument) {
  documentCache.set(userId, document);
  pendingDocuments.delete(userId);
  if (pendingDocuments.size === 0 && pendingWriteHandle !== null && typeof window !== 'undefined') {
    if (pendingWriteUsesIdleCallback && typeof window.cancelIdleCallback === 'function') {
      window.cancelIdleCallback(pendingWriteHandle);
    } else {
      window.clearTimeout(pendingWriteHandle);
    }
    pendingWriteHandle = null;
    pendingWriteUsesIdleCallback = false;
  }
  persistDocument(userId, document);
}

function readDocument(userId: number): LocalActivityDocument {
  const cached = documentCache.get(userId);
  if (cached) return cached;
  if (typeof window === 'undefined') return emptyDocument();

  const current = parseCurrentDocument(readStorageItem(storageKey(userId)));
  if (current) {
    documentCache.set(userId, current);
    return current;
  }

  for (const legacyVersion of [5, 4, 3, 2, 1]) {
    const trades = parseLegacyTrades(readStorageItem(storageKey(userId, legacyVersion)));
    if (trades !== null) {
      const migrated: LocalActivityDocument = {
        version: STORAGE_VERSION,
        trades,
        snapshot: undefined,
      };
      writeDocumentImmediately(userId, migrated);
      return migrated;
    }
  }

  const empty = emptyDocument();
  documentCache.set(userId, empty);
  return empty;
}

function snapshotState(state: EconomyState): LocalTradeSnapshot {
  return clone({
    userId: state.userId,
    orders: state.orders.filter((order) => order.isOwn).map((order) => ({
      id: order.id,
      assetKind: order.assetKind,
      assetId: order.assetId,
      productId: order.productId,
      facilityTypeId: order.facilityTypeId,
      side: order.side,
      fills: order.fills ?? [],
    })),
    products: state.products.map(({ id, name }) => ({ id, name })),
    facilityTypes: state.facilityTypes.map(({ id, name }) => ({ id, name })),
  });
}

function productName(snapshot: LocalTradeSnapshot, productId?: string) {
  return snapshot.products.find((product) => product.id === productId)?.name ?? productId ?? '商品';
}

function facilityName(snapshot: LocalTradeSnapshot, typeId: string) {
  return snapshot.facilityTypes.find((facility) => facility.id === typeId)?.name ?? typeId;
}

function deriveAssetTrades(
  before: LocalTradeSnapshot,
  after: LocalTradeSnapshot,
  createdAt: number,
): TradeRecord[] {
  const previousById = new Map(before.orders.map((order) => [order.id, order]));
  const records: TradeRecord[] = [];
  for (const order of after.orders) {
    const previousFillIds = new Set((previousById.get(order.id)?.fills ?? []).map((fill) => fill.id));
    const kind = order.assetKind === 'facility' || order.facilityTypeId ? 'facility' : 'commodity';
    const assetId = order.assetId ?? order.facilityTypeId ?? order.productId ?? 'wheat';
    const name = kind === 'facility' ? facilityName(after, assetId) : productName(after, assetId);
    for (const fill of order.fills ?? []) {
      if (previousFillIds.has(fill.id)) continue;
      records.push({
        id: `local-trade-${fill.id}`,
        type: kind,
        productId: kind === 'commodity' ? assetId : undefined,
        facilityTypeId: kind === 'facility' ? assetId : undefined,
        side: order.side,
        quantity: fill.quantity,
        price: fill.price,
        total: fill.total,
        fee: Number(fill.fee || 0),
        netTotal: Number(fill.netTotal ?? fill.total),
        createdAt: fill.createdAt || createdAt,
        description: `${order.side === 'buy' ? '买入' : '卖出'} ${name}`,
      });
    }
  }
  return records.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
}

function viewOf(document: LocalActivityDocument): LocalActivityView {
  return { trades: document.trades };
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
    scheduleDocumentWrite(userId, document);
    return viewOf(document);
  }

  const trades = deriveAssetTrades(document.snapshot, after, context.createdAt ?? Date.now());
  if (trades.length) document.trades = [...trades, ...document.trades].slice(0, MAX_TRADES);
  document.snapshot = after;
  if (trades.length) scheduleDocumentWrite(userId, document);
  else documentCache.set(userId, document);
  return viewOf(document);
}

export function clearLocalTrades(userId: number, state?: EconomyState): LocalActivityView {
  const document: LocalActivityDocument = {
    version: STORAGE_VERSION,
    trades: [],
    snapshot: state ? snapshotState(state) : undefined,
  };
  writeDocumentImmediately(userId, document);
  return viewOf(document);
}
