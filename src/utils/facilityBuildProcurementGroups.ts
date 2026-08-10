import type { AssetOrder } from '../types';

export interface FacilityBuildProcurementOrderRef {
  orderId: string;
  productId: string;
  quantity: number;
  price: number;
}

export interface FacilityBuildProcurementGroup {
  id: string;
  facilityTypeId: string;
  quantity: number;
  createdAt: number;
  orders: FacilityBuildProcurementOrderRef[];
}

const STORAGE_VERSION = 1;

function storageKey(userId: number) {
  return `economy:facility-build-procurements:v${STORAGE_VERSION}:${userId}`;
}

function normalizePositiveInteger(value: unknown) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 1 ? normalized : null;
}

function normalizePrice(value: unknown) {
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 1 ? cents / 100 : null;
}

function normalizeGroup(value: unknown): FacilityBuildProcurementGroup | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<FacilityBuildProcurementGroup>;
  const id = typeof candidate.id === 'string' ? candidate.id : '';
  const facilityTypeId = typeof candidate.facilityTypeId === 'string' ? candidate.facilityTypeId : '';
  const quantity = normalizePositiveInteger(candidate.quantity);
  const createdAt = Math.max(0, Math.floor(Number(candidate.createdAt) || 0));
  if (!id || !facilityTypeId || quantity === null || createdAt <= 0 || !Array.isArray(candidate.orders)) return null;

  const orders = candidate.orders.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const order = item as Partial<FacilityBuildProcurementOrderRef>;
    const orderId = typeof order.orderId === 'string' ? order.orderId : '';
    const productId = typeof order.productId === 'string' ? order.productId : '';
    const orderQuantity = normalizePositiveInteger(order.quantity);
    const price = normalizePrice(order.price);
    return orderId && productId && orderQuantity !== null && price !== null
      ? [{ orderId, productId, quantity: orderQuantity, price }]
      : [];
  });
  if (orders.length === 0) return null;
  return { id, facilityTypeId, quantity, createdAt, orders };
}

export function loadFacilityBuildProcurementGroups(userId: number) {
  if (typeof window === 'undefined') return [] as FacilityBuildProcurementGroup[];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const group = normalizeGroup(item);
      return group ? [group] : [];
    });
  } catch {
    return [];
  }
}

export function saveFacilityBuildProcurementGroups(userId: number, groups: FacilityBuildProcurementGroup[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(groups));
  } catch {
    // Browser storage is a convenience for grouping only; market orders remain server-authoritative.
  }
}

export function activeFacilityBuildProcurementGroups(
  groups: FacilityBuildProcurementGroup[],
  orders: AssetOrder[],
) {
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  return groups.filter((group) => group.orders.some((reference) => {
    const order = ordersById.get(reference.orderId);
    return order?.isOwn && (order.status === 'open' || order.status === 'partial');
  }));
}
