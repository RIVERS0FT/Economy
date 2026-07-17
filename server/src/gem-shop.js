import { randomUUID } from 'node:crypto';
import { ECONOMY_CONSTANTS } from './domain.js';
import { ensureGemState } from './invitations.js';

export const GEM_SHOP_CREDITS_PER_GEM = 10;
export const GEM_SHOP_MIN_EXCHANGE_GEMS = 1;
export const GEM_SHOP_MAX_EXCHANGE_GEMS = 100;

function normalizeExchangeAmount(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) ? amount : null;
}

export function createGemShopSummary(player, totals = {}, recentExchanges = []) {
  ensureGemState(player);
  return {
    gems: player.gems,
    credits: Number(player.credits || 0),
    creditsPerGem: GEM_SHOP_CREDITS_PER_GEM,
    minExchangeGems: GEM_SHOP_MIN_EXCHANGE_GEMS,
    maxExchangeGems: GEM_SHOP_MAX_EXCHANGE_GEMS,
    maxExchangeableGems: Math.min(player.gems, GEM_SHOP_MAX_EXCHANGE_GEMS),
    totalGemsSpent: Number(totals.total_gems_spent || 0),
    totalCreditsReceived: Number(totals.total_credits_received || 0),
    recentExchanges: recentExchanges.map((row) => ({
      gemsSpent: Number(row.gems_spent),
      creditsReceived: Number(row.credits_received),
      createdAt: Number(row.created_at),
    })),
  };
}

export function exchangeGems(player, rawAmount, now = Date.now()) {
  ensureGemState(player);
  const gems = normalizeExchangeAmount(rawAmount);
  if (gems === null || gems < GEM_SHOP_MIN_EXCHANGE_GEMS || gems > GEM_SHOP_MAX_EXCHANGE_GEMS) {
    return { ok: false, message: `每次兑换宝石数量必须为 ${GEM_SHOP_MIN_EXCHANGE_GEMS}～${GEM_SHOP_MAX_EXCHANGE_GEMS} 的整数` };
  }
  if (player.gems < gems) return { ok: false, message: '宝石余额不足' };
  const creditsReceived = gems * GEM_SHOP_CREDITS_PER_GEM;
  if (!Number.isSafeInteger(creditsReceived) || !Number.isSafeInteger(Number(player.credits || 0) + creditsReceived)) {
    return { ok: false, message: '兑换金额超出安全范围' };
  }

  player.gems -= gems;
  player.credits = Number(player.credits || 0) + creditsReceived;
  player.ledger ||= [];
  player.ledger.unshift({
    id: `ledger-${randomUUID()}`,
    category: 'gem_shop_exchange',
    amount: creditsReceived,
    balanceAfter: player.credits,
    createdAt: now,
    description: `宝石商店兑换：消耗 ${gems} 宝石，获得 ${creditsReceived} 货币`,
  });
  player.ledger = player.ledger.slice(0, ECONOMY_CONSTANTS.maxLedgerPerPlayer);

  return {
    ok: true,
    message: `兑换成功：消耗 ${gems} 宝石，获得 ¤${creditsReceived}`,
    gemsSpent: gems,
    creditsReceived,
  };
}
