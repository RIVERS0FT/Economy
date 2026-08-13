import type { AssetKind, AssetOrder, OrderSide } from '../types';
import { orderAssetId, orderKind } from '../utils/orderIdentity';

interface CommodityPriceExtrema {
  ownBestBid: number | null;
  ownBestAsk: number | null;
  externalBestBid: number | null;
  externalBestAsk: number | null;
}

export interface ClientOrderIndex {
  source: EconomyOrders;
  orderById: ReadonlyMap<string, AssetOrder>;
  ownOpenOrders: readonly AssetOrder[];
  openOrdersByAsset: ReadonlyMap<string, readonly AssetOrder[]>;
  commodityPriceExtrema: ReadonlyMap<string, CommodityPriceExtrema>;
}

type EconomyOrders = readonly AssetOrder[];

const EMPTY_EXTREMA: CommodityPriceExtrema = Object.freeze({
  ownBestBid: null,
  ownBestAsk: null,
  externalBestBid: null,
  externalBestAsk: null,
});

let cachedOrders: EconomyOrders | null = null;
let cachedIndex: ClientOrderIndex | null = null;

function assetKey(kind: AssetKind, assetId: string) {
  return `${kind}:${assetId}`;
}

function isOpenOrder(order: AssetOrder) {
  return (order.status === 'open' || order.status === 'partial')
    && Number(order.remaining || 0) > 0;
}

function updateExtrema(
  extrema: CommodityPriceExtrema,
  order: AssetOrder,
) {
  const price = Number(order.price || 0);
  if (!Number.isFinite(price) || price <= 0) return;
  const own = order.isOwn === true;
  if (order.side === 'buy') {
    if (own) extrema.ownBestBid = extrema.ownBestBid === null ? price : Math.max(extrema.ownBestBid, price);
    else extrema.externalBestBid = extrema.externalBestBid === null ? price : Math.max(extrema.externalBestBid, price);
  } else if (own) {
    extrema.ownBestAsk = extrema.ownBestAsk === null ? price : Math.min(extrema.ownBestAsk, price);
  } else {
    extrema.externalBestAsk = extrema.externalBestAsk === null ? price : Math.min(extrema.externalBestAsk, price);
  }
}

function buildClientOrderIndex(orders: EconomyOrders): ClientOrderIndex {
  const orderById = new Map<string, AssetOrder>();
  const ownOpenOrders: AssetOrder[] = [];
  const openOrdersByAssetMutable = new Map<string, AssetOrder[]>();
  const commodityPriceExtremaMutable = new Map<string, CommodityPriceExtrema>();

  for (const order of orders) {
    if (order.id) orderById.set(order.id, order);
    if (!isOpenOrder(order)) continue;
    const kind = orderKind(order);
    const id = orderAssetId(order);
    const key = assetKey(kind, id);
    const assetOrders = openOrdersByAssetMutable.get(key);
    if (assetOrders) assetOrders.push(order);
    else openOrdersByAssetMutable.set(key, [order]);
    if (order.isOwn === true) ownOpenOrders.push(order);
    if (kind !== 'commodity') continue;
    let extrema = commodityPriceExtremaMutable.get(id);
    if (!extrema) {
      extrema = {
        ownBestBid: null,
        ownBestAsk: null,
        externalBestBid: null,
        externalBestAsk: null,
      };
      commodityPriceExtremaMutable.set(id, extrema);
    }
    updateExtrema(extrema, order);
  }

  const openOrdersByAsset = new Map<string, readonly AssetOrder[]>();
  for (const [key, assetOrders] of openOrdersByAssetMutable) {
    openOrdersByAsset.set(key, Object.freeze(assetOrders));
  }
  const commodityPriceExtrema = new Map<string, CommodityPriceExtrema>();
  for (const [productId, extrema] of commodityPriceExtremaMutable) {
    commodityPriceExtrema.set(productId, Object.freeze({ ...extrema }));
  }

  return Object.freeze({
    source: orders,
    orderById,
    ownOpenOrders: Object.freeze(ownOpenOrders),
    openOrdersByAsset,
    commodityPriceExtrema,
  });
}

export function getClientOrderIndex(orders: EconomyOrders): ClientOrderIndex {
  if (cachedOrders === orders && cachedIndex) return cachedIndex;
  cachedOrders = orders;
  cachedIndex = buildClientOrderIndex(orders);
  return cachedIndex;
}

export function openOrdersForAsset(
  index: ClientOrderIndex,
  kind: AssetKind,
  assetId: string,
): AssetOrder[] {
  return [...(index.openOrdersByAsset.get(assetKey(kind, assetId)) ?? [])];
}

export function managedCommodityOrder(
  index: ClientOrderIndex,
  orderId: string | undefined,
  productId: string,
  side: OrderSide,
): AssetOrder | null {
  if (!orderId) return null;
  const order = index.orderById.get(orderId);
  return order
    && order.isOwn === true
    && orderKind(order) === 'commodity'
    && orderAssetId(order) === productId
    && order.side === side
    && isOpenOrder(order)
    ? order
    : null;
}

export function hasCrossingCommodityOrder(
  index: ClientOrderIndex,
  productId: string,
  side: OrderSide,
  own: boolean,
  price: number,
) {
  const extrema = index.commodityPriceExtrema.get(productId) ?? EMPTY_EXTREMA;
  if (side === 'sell') {
    const bestAsk = own ? extrema.ownBestAsk : extrema.externalBestAsk;
    return bestAsk !== null && bestAsk <= price;
  }
  const bestBid = own ? extrema.ownBestBid : extrema.externalBestBid;
  return bestBid !== null && bestBid >= price;
}
