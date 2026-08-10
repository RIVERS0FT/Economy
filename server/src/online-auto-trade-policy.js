import { PRODUCT_CATALOG } from './industry-catalog.js';
import { cancelManagedOnlineAutoBuyOrder } from './online-auto-buy-orders.js';
import {
  ensureOnlineAutoBuyPolicies,
  normalizeOnlineAutoBuyPolicy,
} from './online-auto-buy-policy.js';
import { cancelManagedOnlineAutoSellOrder } from './online-auto-sell-orders.js';
import {
  ensureOnlineAutoSellPolicies,
  normalizeOnlineAutoSellPolicy,
} from './online-auto-sell-policy.js';

const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));

function sameAutoSellPolicy(left, right) {
  return Boolean(
    left
    && right
    && left.enabled === right.enabled
    && Number(left.price) === Number(right.price)
    && Number(left.minimumFreeInventory) === Number(right.minimumFreeInventory),
  );
}

function sameAutoBuyPolicy(left, right) {
  return Boolean(
    left
    && right
    && left.enabled === right.enabled
    && Number(left.maxPrice) === Number(right.maxPrice)
    && Number(left.targetFreeInventory) === Number(right.targetFreeInventory),
  );
}

export function applyOnlineAutoTradePolicyAction(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家不存在' };

  const productId = String(payload.productId || payload.assetId || '');
  if (!PRODUCT_IDS.has(productId)) return { ok: false, message: '自动交易商品不存在' };

  const buyPolicy = normalizeOnlineAutoBuyPolicy(payload.buy);
  const sellPolicy = normalizeOnlineAutoSellPolicy(payload.sell);
  if (!buyPolicy || !sellPolicy) return { ok: false, message: '自动交易设置无效' };

  if (buyPolicy.enabled && sellPolicy.enabled) {
    if (buyPolicy.targetFreeInventory > sellPolicy.minimumFreeInventory) {
      return { ok: false, message: '自动采购目标自由库存不能高于自动出售最低自由库存' };
    }
    if (buyPolicy.maxPrice >= sellPolicy.price) {
      return { ok: false, message: '最高自动采购价格必须低于最低自动出售价格' };
    }
  }

  const buyPolicies = ensureOnlineAutoBuyPolicies(player);
  const sellPolicies = ensureOnlineAutoSellPolicies(player);
  const previousBuy = buyPolicies[productId] || null;
  const previousSell = sellPolicies[productId] || null;

  if (!sameAutoBuyPolicy(previousBuy, buyPolicy)) {
    cancelManagedOnlineAutoBuyOrder(world, user.id, productId);
  }
  if (!sameAutoSellPolicy(previousSell, sellPolicy)) {
    cancelManagedOnlineAutoSellOrder(world, user.id, productId);
  }

  buyPolicies[productId] = buyPolicy;
  sellPolicies[productId] = sellPolicy;
  player.onlineAutoBuyPolicies = buyPolicies;
  player.onlineAutoSellPolicies = sellPolicies;

  const enabled = [buyPolicy.enabled ? '自动采购' : '', sellPolicy.enabled ? '自动出售' : '']
    .filter(Boolean)
    .join('、');
  return {
    ok: true,
    message: enabled ? `${enabled}设置已保存` : '自动交易设置已保存并关闭',
  };
}
