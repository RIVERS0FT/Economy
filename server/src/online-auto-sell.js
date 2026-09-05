import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
  commoditySystemPriceFor,
} from './domain.js';
import { factoryAutoTradeExecutionPolicyFor } from './factory-auto-operation.js';
import {
  buildingReservedQuantitiesForPlayer,
} from './building-input-reservations.js';
import { contractAvailableHoldForOnlineTrade } from './online-auto-trade-reservations.js';
import { inventoryForProvince, normalizeProvinceId } from './provinces.js';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

export const contractAvailableHoldForAutoSell = contractAvailableHoldForOnlineTrade;

function immediateTarget(world, player, productId, policy, provinceId) {
  const inventory = inventoryForProvince(player, productId, provinceId);
  const productionReserved = positiveInteger(
    buildingReservedQuantitiesForPlayer(world, player.userId, provinceId)[productId],
  );
  const contractHold = positiveInteger(contractAvailableHoldForOnlineTrade(world, player.userId, productId, provinceId));
  return Math.max(
    0,
    positiveInteger(inventory.available)
      - productionReserved
      - contractHold
      - positiveInteger(policy.minimumFreeInventory),
  );
}

export function applyOnlineAutoSell(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const provinceId = normalizeProvinceId(payload.provinceId);
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return { ok: false, message: '自动出售商品不存在' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const policy = factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.sell;
  if (!policy?.enabled) return { ok: false, message: '当前建筑策略无需自动出售该商品' };

  const officialPrice = commoditySystemPriceFor(world, productId, provinceId, now);
  if (officialPrice < policy.price) {
    return {
      ok: true,
      message: `今日系统价 ${officialPrice.toFixed(2)} 低于自动出售最低价 ${policy.price.toFixed(2)}，暂不出售`,
    };
  }

  const target = immediateTarget(world, player, productId, policy, provinceId);
  if (target < 1) {
    return {
      ok: true,
      message: '当前没有扣除生产预定、合同预定和最低自由库存后的可自动出售库存',
    };
  }

  const traded = applySettledCommodityOrder(world, user, {
    assetKind: 'commodity',
    assetId: productId,
    productId,
    provinceId,
    side: 'sell',
    quantity: target,
    price: policy.price,
    execution: 'online-auto-sell',
  }, now);
  if (!traded?.ok) return traded;
  return {
    ok: true,
    message: `已按今日系统价 ${officialPrice.toFixed(2)} 自动出售 ${target} 个${product.name}`,
  };
}
