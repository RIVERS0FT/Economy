import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
  commoditySystemPriceFor,
} from './domain.js';
import { factoryAutoTradeExecutionPolicyFor } from './factory-auto-operation.js';
import { productionReservedQuantitiesForPlayer } from './facility-groups.js';
import { internalMoneyToMicros } from './money.js';
import { contractAvailableHoldForOnlineTrade } from './online-auto-trade-reservations.js';
import { inventoryForProvince, normalizeProvinceId } from './provinces.js';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function desiredQuantity(world, player, productId, policy, provinceId) {
  const inventory = inventoryForProvince(player, productId, provinceId);
  const productionReserved = positiveInteger(
    productionReservedQuantitiesForPlayer(world, player.userId, provinceId)[productId],
  );
  const contractHold = positiveInteger(
    contractAvailableHoldForOnlineTrade(world, player.userId, productId, provinceId),
  );
  const requiredAvailable = Math.min(
    Number.MAX_SAFE_INTEGER,
    productionReserved + contractHold + positiveInteger(policy.targetFreeInventory),
  );
  return Math.max(0, requiredAvailable - positiveInteger(inventory.available));
}

function affordableQuantity(player, price, desired) {
  const priceMicros = internalMoneyToMicros(price);
  const creditsMicros = internalMoneyToMicros(Math.max(0, Number(player.credits || 0)));
  if (priceMicros === null || creditsMicros === null || priceMicros <= 0n) return 0;
  const affordable = creditsMicros / priceMicros;
  const capped = affordable > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(affordable);
  return Math.min(desired, Math.max(0, capped));
}

export function applyOnlineAutoBuy(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const provinceId = normalizeProvinceId(payload.provinceId);
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return { ok: false, message: '自动采购商品不存在' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const policy = factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.buy;
  if (!policy?.enabled) return { ok: false, message: '当前工厂策略无需自动采购该商品' };

  const officialPrice = commoditySystemPriceFor(world, productId, provinceId, now);
  if (officialPrice > policy.maxPrice) {
    return {
      ok: true,
      message: `今日系统价 ${officialPrice.toFixed(2)} 高于自动采购最高价 ${policy.maxPrice.toFixed(2)}，暂不采购`,
    };
  }

  const desired = desiredQuantity(world, player, productId, policy, provinceId);
  if (desired < 1) return { ok: true, message: '当前库存已达到自动采购目标' };
  const target = affordableQuantity(player, officialPrice, desired);
  if (target < 1) return { ok: true, message: '当前可用资金不足，未执行自动采购' };

  const traded = applySettledCommodityOrder(world, user, {
    assetKind: 'commodity',
    assetId: productId,
    productId,
    provinceId,
    side: 'buy',
    quantity: target,
    price: policy.maxPrice,
    execution: 'online-auto-buy',
  }, now);
  if (!traded?.ok) return traded;
  const fundingNote = target < desired ? '，当前采购数量受可用资金限制' : '';
  return {
    ok: true,
    message: `已按今日系统价 ${officialPrice.toFixed(2)} 自动采购 ${target} 个${product.name}${fundingNote}`,
  };
}
