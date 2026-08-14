import { createMarketReserveAuction } from './asset-auctions.js';
import { createMarketReserveProcurementContract } from './contracts.js';
import { PRODUCT_CATALOG } from './industry-catalog.js';
import {
  MARKET_DEMAND_GROUP_CATALOG,
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
} from './market-demand/catalog.js';
import { ceilPlayerMoney } from './money.js';

export const MARKET_RESERVE_OPERATION_RULE_VERSION = 1;
export const RESERVE_CONTRACT_ENTRY_RATIO = 0.65;
export const RESERVE_CONTRACT_EXIT_RATIO = 0.90;
export const RESERVE_CONTRACT_ENTRY_CYCLES = 2;
export const RESERVE_AUCTION_ENTRY_RATIO = 1.60;
export const RESERVE_AUCTION_EXIT_RATIO = 1.25;
export const RESERVE_AUCTION_ENTRY_CYCLES = 3;
export const RESERVE_AUCTION_COOLDOWN_MS = 10 * 60 * 1000;

const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const CONTRACT_DELIVERY_INTERVAL_MS = 30 * 60 * 1000;
const CONTRACT_FIRST_DELIVERY_DELAY_MS = 10 * 60 * 1000;
const CONTRACT_OFFER_TTL_MS = 60 * 60 * 1000;
const AUCTION_DURATION_HOURS = 3;

function clamp(minimum, maximum, value) {
  return Math.max(minimum, Math.min(maximum, value));
}

function totalInventory(reserve) {
  return Math.max(0, Number(reserve?.inventory || 0))
    + Math.max(0, Number(reserve?.frozenInventory || 0));
}

function referencePriceFor(world, product) {
  return Math.max(0.01, Number(
    world.marketDemand?.priceTransmission?.products?.[product.id]?.referencePrice
      || world.markets?.[product.id]?.demand?.referencePrice
      || product.basePrice,
  ));
}

function activeReserveContracts(world) {
  return new Set((world.productionContracts || []).flatMap((contract) => (
    contract?.publisherType === 'market_reserve'
      && ['open', 'active'].includes(contract.status)
      && contract.marketReserveGroupId
      && contract.productId
      ? [`${contract.marketReserveGroupId}:${contract.productId}`]
      : []
  )));
}

function activeReserveAuctions(world) {
  return new Set((world.assetAuctions || []).flatMap((auction) => (
    auction?.sellerType === 'market_reserve'
      && auction.status === 'open'
      && auction.marketReserveGroupId
      && auction.productId
      ? [`${auction.marketReserveGroupId}:${auction.productId}`]
      : []
  )));
}

function updateShortageCounter(reserve, ratio) {
  const previous = Math.max(0, Math.floor(Number(reserve.shortageCycles || 0)));
  reserve.shortageCycles = ratio < RESERVE_CONTRACT_ENTRY_RATIO
    ? previous + 1
    : ratio >= RESERVE_CONTRACT_EXIT_RATIO
      ? 0
      : previous;
}

function updateSurplusCounter(reserve, ratio) {
  const previous = Math.max(0, Math.floor(Number(reserve.surplusCycles || 0)));
  reserve.surplusCycles = ratio > RESERVE_AUCTION_ENTRY_RATIO
    ? previous + 1
    : ratio <= RESERVE_AUCTION_EXIT_RATIO
      ? 0
      : previous;
}

function publishProcurementContract(world, group, groupState, product, reserve, now) {
  const total = totalInventory(reserve);
  const target = Math.max(1, Math.ceil(Number(reserve.targetInventory || 1)));
  const targetLevel = Math.ceil(target * RESERVE_CONTRACT_EXIT_RATIO);
  const deficit = Math.max(0, targetLevel - total);
  if (deficit < 1) return null;

  const reference = referencePriceFor(world, product);
  const shortageRate = clamp(0, 1, 1 - total / target);
  const minimum = Math.max(0.01, product.basePrice * PRICE_MIN_MULTIPLIER);
  const maximum = Math.max(minimum, product.basePrice * PRICE_MAX_MULTIPLIER);
  const unitPrice = ceilPlayerMoney(clamp(
    minimum,
    maximum,
    reference * (1.05 + 0.20 * shortageRate),
  ));
  if (!unitPrice) return null;

  const totalDeliveries = Math.min(4, Math.max(2, deficit));
  const plannedQuantity = Math.max(1, Math.ceil(deficit / totalDeliveries));
  const maxBatchBudget = Math.max(0, Number(groupState.credits || 0)) * 0.30;
  const maxQuantityByBudget = Math.floor(maxBatchBudget / unitPrice);
  const quantityPerDelivery = Math.min(plannedQuantity, maxQuantityByBudget);
  if (quantityPerDelivery < 1) return null;

  return createMarketReserveProcurementContract(world, {
    groupId: group.id,
    groupName: group.name,
    productId: product.id,
    quantityPerDelivery,
    unitPrice,
    deliveryIntervalMs: CONTRACT_DELIVERY_INTERVAL_MS,
    totalDeliveries,
    firstDeliveryDelayMs: CONTRACT_FIRST_DELIVERY_DELAY_MS,
    offerTtlMs: CONTRACT_OFFER_TTL_MS,
  }, now);
}

function publishSurplusAuction(world, group, groupState, product, reserve, now) {
  if (now < Math.max(0, Number(reserve.lastAuctionSettledAt || 0)) + RESERVE_AUCTION_COOLDOWN_MS) return null;
  const total = totalInventory(reserve);
  const target = Math.max(1, Math.ceil(Number(reserve.targetInventory || 1)));
  const disposalFloor = Math.ceil(target * RESERVE_AUCTION_EXIT_RATIO);
  const disposable = Math.max(0, total - disposalFloor);
  const lotCap = Math.max(1, Math.floor(target * 0.25));
  const quantity = Math.min(
    Math.max(0, Math.floor(Number(reserve.inventory || 0))),
    disposable,
    lotCap,
  );
  if (quantity < 1) return null;

  const reference = referencePriceFor(world, product);
  const startingBid = ceilPlayerMoney(reference * quantity * 0.85);
  const reservePrice = ceilPlayerMoney(reference * quantity * 0.95);
  if (!startingBid || !reservePrice) return null;
  return createMarketReserveAuction(world, {
    groupId: group.id,
    groupName: group.name,
    productId: product.id,
    quantity,
    startingBid,
    reservePrice: Math.max(startingBid, reservePrice),
    durationHours: AUCTION_DURATION_HOURS,
  }, now, { migrate: false });
}

export function processMarketReserveOperations(world, now = Date.now()) {
  const liquidity = world.marketDemand?.liquidity;
  if (!liquidity?.groups) return false;
  world.marketDemand.reserveOperations ||= {
    ruleVersion: MARKET_RESERVE_OPERATION_RULE_VERSION,
    groupCycles: {},
  };
  world.marketDemand.reserveOperations.ruleVersion = MARKET_RESERVE_OPERATION_RULE_VERSION;
  world.marketDemand.reserveOperations.groupCycles ||= {};

  const contracts = activeReserveContracts(world);
  const auctions = activeReserveAuctions(world);
  let changed = false;

  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    const demandCycleId = Number(world.marketDemand?.groups?.[group.id]?.lastCycleId);
    if (!Number.isFinite(demandCycleId)) continue;
    const previousCycleId = Number(world.marketDemand.reserveOperations.groupCycles[group.id]);
    if (Number.isFinite(previousCycleId) && previousCycleId === demandCycleId) continue;
    world.marketDemand.reserveOperations.groupCycles[group.id] = demandCycleId;

    const groupState = liquidity.groups[group.id];
    if (!groupState?.reserves) continue;
    for (const [productId, reserve] of Object.entries(groupState.reserves)) {
      const product = PRODUCTS.get(productId);
      if (!product) continue;
      const target = Math.max(1, Math.ceil(Number(reserve.targetInventory || 1)));
      const ratio = totalInventory(reserve) / target;
      updateShortageCounter(reserve, ratio);
      updateSurplusCounter(reserve, ratio);
      const key = `${group.id}:${productId}`;

      if (reserve.shortageCycles >= RESERVE_CONTRACT_ENTRY_CYCLES && !contracts.has(key)) {
        const contract = publishProcurementContract(world, group, groupState, product, reserve, now);
        if (contract) {
          contracts.add(key);
          changed = true;
        }
      }

      if (reserve.surplusCycles >= RESERVE_AUCTION_ENTRY_CYCLES && !auctions.has(key)) {
        const auction = publishSurplusAuction(world, group, groupState, product, reserve, now);
        if (auction) {
          auctions.add(key);
          changed = true;
        }
      }
    }
  }
  return changed;
}
