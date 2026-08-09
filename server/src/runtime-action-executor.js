import { isDeepStrictEqual } from 'node:util';
import { applyAssetAuctionAction } from './asset-auctions.js';
import { applyBankAction, ensureBankWorld, ensurePlayerBankAccount } from './banking.js';
import { ensurePlayer } from './domain.js';
import { createEconomicActionBoundary, beginEconomicSavepoint } from './economic-mutation.js';
import { autoProcureFacilityBuildMaterials } from './facility-auto-procure.js';
import { applyFacilityGroupAction } from './facility-groups.js';
import { ensureGemState } from './invitations.js';
import { normalizePlayerMoneyPayload } from './money.js';
import { applyOnlineAutoSell } from './online-auto-sell.js';
import { applyResearchAction, validateResearchAccess } from './research.js';
import { ensureWarehouse, upgradeWarehouse } from './warehouse.js';
import {
  activateWeeklyCashSettlement,
  collectPlayerWeeklyCashSettlement,
  ensurePlayerWeeklyCashSettlement,
  ensureWeeklyCashSettlementWorld,
  settlePlayerWeeklyCashOnLogin,
} from './weekly-cash-settlement.js';

const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);
const BANK_ACTIONS = new Set(['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']);
const ECONOMIC_ACTIVITY_ACTIONS = new Set([
  'work', 'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe',
  'collectFacility', 'placeOrder', 'cancelOrder', 'listFacility',
  'cancelFacilityListing', 'buyFacility', 'upgradeWarehouse', 'redeemGift',
  'exchangeGems', 'createAuction', 'placeAuctionBid', 'cancelAuction',
  'bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay', 'startResearch', 'accelerateResearch',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActionAcknowledgement(result, revision) {
  return normalizeJson({
    result: {
      ok: result?.ok === true,
      message: String(result?.message || ''),
    },
    revision: Number(revision),
  });
}

function executeActionBody(store, world, user, action, payload, requestKey, now) {
  const boundary = createEconomicActionBoundary(world);
  const savepoint = beginEconomicSavepoint(store, 'economy_player_action');
  let gameResult;
  try {
    const researchAccess = validateResearchAccess(world, user, action, payload, now);
    if (researchAccess) {
      gameResult = researchAccess;
    } else if (action === 'startResearch' || action === 'accelerateResearch') {
      gameResult = applyResearchAction(world, user, action, payload, now);
    } else if (action === 'placeOrder' && payload.execution === 'online-auto-sell') {
      gameResult = applyOnlineAutoSell(world, user, payload, now);
    } else if (action === 'checkIn') {
      gameResult = store.checkInInTransaction(world.players[String(user.id)], requestKey, now);
    } else if (action === 'upgradeWarehouse') {
      gameResult = upgradeWarehouse(world.players[String(user.id)]);
    } else if (action === 'redeemGift') {
      gameResult = store.redeemGiftInTransaction(world, user, payload, now);
    } else if (action === 'exchangeGems') {
      gameResult = store.gemEconomy.exchange(world.players[String(user.id)], payload.gems, requestKey, now);
    } else if (action === 'rejectGemShopQuote') {
      gameResult = store.gemEconomy.rejectQuote(world.players[String(user.id)], requestKey, now);
    } else if (AUCTION_ACTIONS.has(action)) {
      gameResult = applyAssetAuctionAction(world, user, action, payload, now);
    } else if (BANK_ACTIONS.has(action)) {
      gameResult = applyBankAction(world, user, action, payload, now);
    } else if (action === 'buildFacility' && payload.autoProcure === true) {
      const procurement = autoProcureFacilityBuildMaterials(world, user, payload, now);
      if (!procurement.ok) gameResult = procurement;
      else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now);
        if (gameResult?.ok && procurement.purchasedQuantity > 0) {
          gameResult.message = `${gameResult.message}；已一键购齐 ${procurement.purchasedQuantity} 件建造材料`;
        }
      }
    } else {
      gameResult = applyFacilityGroupAction(world, user, action, payload, now);
    }

    if (gameResult?.ok) {
      boundary.assert();
      savepoint.release();
    } else {
      savepoint.rollback();
      boundary.rollback();
    }
  } catch (error) {
    try { savepoint.rollback(); } catch { /* outer transaction remains authoritative */ }
    boundary.rollback();
    throw error;
  }

  return {
    gameResult,
    playerBeforeAction: boundary.playerBefore(user.id),
  };
}

export function executeRuntimeAction(store, user, requestMeta, now = Date.now()) {
  const {
    action,
    requestKey,
    method,
    path,
  } = requestMeta;
  const payload = normalizePlayerMoneyPayload(action, requestMeta.payload);

  return store.transaction(() => {
    const cached = store.selectIdempotency.get(Number(user.id), requestKey);
    if (cached) {
      if (cached.request_method !== method || cached.request_path !== path) {
        const error = new Error('幂等键已被其他操作使用');
        error.statusCode = 409;
        throw error;
      }
      const cachedResponse = JSON.parse(String(cached.response_json));
      return createActionAcknowledgement(cachedResponse.result, cachedResponse.revision);
    }

    const { revision, stateJson, world } = store.loadWorld(now);
    const player = ensurePlayer(world, user, now);
    ensureWarehouse(player);
    ensureGemState(player);
    ensureBankWorld(world, now);
    ensurePlayerBankAccount(player, now);
    ensureWeeklyCashSettlementWorld(world, now);
    ensurePlayerWeeklyCashSettlement(player, now);
    store.processWorldIfDue(world, now, Number(user.id), {
      force: true,
      forceDomains: [],
      auditTrigger: 'action_preprocess',
    });
    settlePlayerWeeklyCashOnLogin(world, world.players[String(user.id)], now);

    const { gameResult, playerBeforeAction } = executeActionBody(
      store,
      world,
      user,
      action,
      payload,
      requestKey,
      now,
    );

    if (action === 'accelerateResearch' && gameResult?.ok) {
      store.gemEconomy.recordResearchAcceleration(user.id, requestKey, gameResult, now);
    }

    const activePlayer = world.players[String(user.id)];
    collectPlayerWeeklyCashSettlement(world, activePlayer, now);
    if (gameResult?.ok && ECONOMIC_ACTIVITY_ACTIONS.has(action)) {
      if (activePlayer && !isDeepStrictEqual(activePlayer, playerBeforeAction)) {
        activePlayer.lastEconomicActivityAt = now;
        const activated = activateWeeklyCashSettlement(world, activePlayer, now);
        if (activated) {
          gameResult.message = String(gameResult.message || '')
            + '；本周已激活，存款从下一个自然日按每日 1% 计息，周末按资金净额生成 10% 结算';
        }
      }
    }

    ensureWarehouse(world.players[String(user.id)]);
    ensureGemState(world.players[String(user.id)]);
    ensurePlayerBankAccount(world.players[String(user.id)], now);
    ensurePlayerWeeklyCashSettlement(world.players[String(user.id)], now);
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);
    const response = createActionAcknowledgement(gameResult, nextRevision);
    store.insertIdempotency.run(
      Number(user.id),
      requestKey,
      method,
      path,
      JSON.stringify(response),
      now,
    );
    store.cleanupExpiredIdempotency(now);
    return response;
  });
}
