import { reconcileBuildingInputFreezes } from './building-input-freezes.js';
import { isDeepStrictEqual } from 'node:util';
import { applyAssetAuctionAction } from './asset-auctions.js';
import { applyBankAction, ensureBankWorld, ensurePlayerBankAccount } from './banking.js';
import { applyCommercialBuildingAction } from './commercial-buildings.js';
import { applyProductionContractAction, processProductionContracts } from './contracts.js';
import { applySettledCommodityOrder, cancelSettledCommodityOrder, ensurePlayer } from './domain.js';
import { assertEconomicStateInvariants, assertEconomicStateInvariantsScoped, beginEconomicSavepoint } from './economic-mutation.js';
import {
  autoProcureFacilityBuildMaterials,
  cancelFacilityBuildProcurementOrders,
  createFacilityBuildProcurementOrders,
} from './facility-auto-procure.js';
import {
  applyFactoryAutoOperationPolicyAction,
  rebuildFactoryAutoTradePoliciesForProvince,
} from './factory-auto-operation.js';
import { applyFacilityGroupAction, processFacilityGroupWorld } from './facility-groups.js';
import { ensureGemState } from './invitations.js';
import { normalizePlayerMoneyPayload } from './money.js';
import { measureRequestPhase, setRequestGauge } from './request-performance.js';
import { applyOnlineAutoBuy } from './online-auto-buy.js';
import { applyOnlineAutoSell } from './online-auto-sell.js';
import { applyOnlineAutoSellPolicyAction } from './online-auto-sell-policy.js';
import { applyOnlineAutoTradePolicyAction } from './online-auto-trade-policy.js';
import { isOpenOrder, orderKind } from './order-identity.js';
import { orderById } from './order-book-runtime.js';
import { applyPlayerProfileAction } from './player-profile.js';
import { requirePlayerActionMetadata } from './player-action-registry.js';
import { applyResearchAction, validateResearchAccess } from './research.js';
import { ensureWarehouse } from './warehouse.js';
import { createRuntimeMutationScope } from './world-storage-v2.js';
import {
  applyProductionSettlementClaim,
  settleProductionForPlayerServerSide,
} from './production-settlement.js';
import {
  activateWeeklyCashSettlement,
  collectPlayerWeeklyCashSettlement,
  ensurePlayerWeeklyCashSettlement,
  ensureWeeklyCashSettlementWorld,
  settlePlayerWeeklyCashOnLogin,
} from './weekly-cash-settlement.js';

const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);
const BANK_ACTIONS = new Set(['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']);
const FACTORY_AUTO_OPERATION_REBUILD_ACTIONS = new Set([
  'buildFacility',
  'startFacility',
  'pauseFacility',
  'setFacilityRecipe',
  'setFacilityRecipes',
]);
const CONTRACT_ACTIONS = new Set([
  'createProductionContract',
  'acceptProductionContract',
  'proposeProductionContractNegotiation',
  'counterProductionContractNegotiation',
  'acceptProductionContractNegotiation',
  'rejectProductionContractNegotiation',
  'revokeProductionContractNegotiation',
  'cancelProductionContract',
  'prepareProductionContract',
  'fundProductionContract',
  'setProductionContractAutoReserve',
  'setProductionContractAutoFund',
  'proposeProductionContractRenewal',
  'acceptProductionContractRenewal',
  'rejectProductionContractRenewal',
  'revokeProductionContractRenewal',
  'requestProductionContractTermination',
  'terminateProductionContractNow',
  'repayPlayerLoan',
  'setPlayerLoanAutoRepay',
  'fundFacilityLease',
  'setFacilityLeaseAutoFund',
]);
const ECONOMIC_ACTIVITY_ACTIONS = new Set([
  'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe', 'setFacilityRecipes',
  'commercialBuilding',
  'collectFacility', 'placeOrder', 'cancelOrder', 'redeemGift',
  'exchangeGems', 'createAuction', 'placeAuctionBid', 'cancelAuction',
  'bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay', 'startResearch', 'accelerateResearch',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActionAcknowledgement(result, revision) {
  const acknowledgementResult = {
    ok: result?.ok === true,
    message: String(result?.message || ''),
  };
  if (result?.procurementGroup) {
    acknowledgementResult.procurementGroup = normalizeJson(result.procurementGroup);
  }
  return normalizeJson({
    result: acknowledgementResult,
    revision: Number(revision),
  });
}

function cancelRuntimeCommodityOrder(world, user, orderId, now, { processWorld = true } = {}) {
  const candidate = orderById(world, orderId);
  if (
    !candidate
    || Number(candidate.ownerId) !== Number(user.id)
    || orderKind(candidate) !== 'commodity'
    || !isOpenOrder(candidate)
  ) return null;

  if (processWorld) processFacilityGroupWorld(world, now, { migrate: false });
  return cancelSettledCommodityOrder(world, user, orderId)
    ? { ok: true, message: '订单已撤销，冻结资产已释放' }
    : { ok: false, message: '未找到可撤销订单' };
}

function executeActionBody(store, world, user, action, payload, requestKey, now, mutationScope) {
  const playerBeforeAction = measureRequestPhase('playerSnapshotMs', () => (
    structuredClone(world.players?.[String(user.id)] ?? null)
  ));
  const contractsBeforeAction = CONTRACT_ACTIONS.has(action)
    ? structuredClone(world.productionContracts || [])
    : null;
  const savepoint = beginEconomicSavepoint(store, 'economy_player_action');
  let gameResult;
  try {
    if (CONTRACT_ACTIONS.has(action)) {
      gameResult = applyProductionContractAction(world, user, action, payload, now);
    } else {
      const isFacilityBuildProcurement = action === 'placeOrder'
        && payload.execution === 'facility-build-procurement';
      const researchAction = isFacilityBuildProcurement ? 'buildFacility' : action;
      const researchAccess = action === 'settleProduction'
        ? null
        : validateResearchAccess(world, user, researchAction, payload, now);
      if (action === 'settleProduction') {
        gameResult = { ok: true, message: '生产结算已由服务器校验并入账' };
      } else if (researchAccess) {
        gameResult = researchAccess;
      } else if (action === 'startResearch' || action === 'accelerateResearch') {
        gameResult = applyResearchAction(world, user, action, payload, now);
      } else if (action === 'commercialBuilding') {
        gameResult = applyCommercialBuildingAction(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.execution === 'facility-build-procurement') {
        gameResult = createFacilityBuildProcurementOrders(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.execution === 'facility-build-procurement-cancel') {
        gameResult = cancelFacilityBuildProcurementOrders(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.execution === 'online-auto-sell-policy') {
        gameResult = applyOnlineAutoSellPolicyAction(world, user, payload);
      } else if (action === 'placeOrder' && payload.execution === 'online-auto-trade-policy') {
        gameResult = applyOnlineAutoTradePolicyAction(world, user, payload);
      } else if (action === 'placeOrder' && payload.execution === 'factory-auto-operation-policy') {
        gameResult = applyFactoryAutoOperationPolicyAction(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.execution === 'online-auto-buy') {
        gameResult = applyOnlineAutoBuy(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.execution === 'online-auto-sell') {
        gameResult = applyOnlineAutoSell(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.assetKind !== 'facility') {
        gameResult = applySettledCommodityOrder(world, user, payload, now);
      } else if (action === 'placeOrder' && payload.assetKind === 'facility') {
        gameResult = { ok: false, message: '工厂资产仅允许通过拍卖交易' };
      } else if (action === 'renamePlayer') {
        gameResult = applyPlayerProfileAction(world, user, payload);
      } else if (action === 'checkIn') {
        gameResult = store.checkInInTransaction(world.players[String(user.id)], requestKey, now);
      } else if (action === 'redeemGift') {
        gameResult = store.redeemGiftInTransaction(world, user, payload, now);
      } else if (action === 'exchangeGems') {
        gameResult = store.gemEconomy.exchange(world.players[String(user.id)], payload.gems, requestKey, now);
      } else if (action === 'rejectGemShopQuote') {
        gameResult = store.gemEconomy.rejectQuote(world.players[String(user.id)], requestKey, now);
      } else if (AUCTION_ACTIONS.has(action)) {
        gameResult = applyAssetAuctionAction(world, user, action, payload, now, {
          migrate: false,
          process: !store.scheduledProcessing,
        });
      } else if (BANK_ACTIONS.has(action)) {
        gameResult = applyBankAction(world, user, action, payload, now, {
          processWorld: !store.scheduledProcessing,
        });
      } else if (action === 'cancelOrder') {
        gameResult = cancelRuntimeCommodityOrder(world, user, payload.orderId, now, {
          processWorld: !store.scheduledProcessing,
        }) ?? applyFacilityGroupAction(world, user, action, payload, now, {
          migrate: false,
          process: !store.scheduledProcessing,
        });
      } else if (action === 'buildFacility' && payload.autoProcure === true) {
        const procurement = autoProcureFacilityBuildMaterials(world, user, payload, now);
        if (!procurement.ok) gameResult = procurement;
        else {
          gameResult = applyFacilityGroupAction(world, user, action, payload, now, {
            migrate: false,
            process: !store.scheduledProcessing,
          });
          if (gameResult?.ok && procurement.purchasedQuantity > 0) {
            gameResult.message = `${gameResult.message}；已一键购齐 ${procurement.purchasedQuantity} 件建造材料`;
          }
        }
      } else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now, {
          migrate: false,
          process: !store.scheduledProcessing,
        });
      }
    }

    if (gameResult?.ok && FACTORY_AUTO_OPERATION_REBUILD_ACTIONS.has(action)) {
      const targetProvinceIds = action === 'setFacilityRecipes'
        ? [...new Set((payload.targets || []).map((target) => target?.provinceId).filter(Boolean))]
        : [payload.provinceId];
      for (const provinceId of targetProvinceIds) {
        const rebuilt = rebuildFactoryAutoTradePoliciesForProvince(world, user.id, provinceId, now);
        if (!rebuilt.ok) {
          gameResult = rebuilt;
          break;
        }
      }
    }

    if (gameResult?.ok) {
      reconcileBuildingInputFreezes(world, world.players[String(user.id)], now);
      measureRequestPhase('economicInvariantMs', () => assertEconomicStateInvariantsScoped(world, mutationScope));
      savepoint.release();
    } else {
      savepoint.rollback();
    }
  } catch (error) {
    try { savepoint.rollback(); } catch { /* outer transaction remains authoritative */ }
    throw error;
  }

  return {
    gameResult,
    playerBeforeAction,
    contractsBeforeAction,
  };
}

function settleProductionForAction(world, userId, claim, now) {
  if (!claim) return settleProductionForPlayerServerSide(world, userId, now);
  try {
    return applyProductionSettlementClaim(world, userId, claim, now);
  } catch (error) {
    if (error?.code !== 'PRODUCTION_SETTLEMENT_STALE') throw error;
    return settleProductionForPlayerServerSide(world, userId, now);
  }
}

export function executeRuntimeAction(store, user, requestMeta, now = Date.now()) {
  const {
    action,
    requestKey,
    method,
    path,
  } = requestMeta;
  const actionMetadata = requirePlayerActionMetadata(action);
  setRequestGauge('interactiveActionBudgetMs', actionMetadata.latencyBudgetMs);
  setRequestGauge('interactiveActionRegistered', 1);
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

    if (!store.worldCache?.world) store.loadWorld(now);
    const mutationScope = createRuntimeMutationScope(
      store.worldCache?.world,
      user.id,
      action,
      payload,
      { scheduledProcessing: store.scheduledProcessing },
    );
    const { revision, stateJson, world } = store.loadWorld(now, mutationScope);
    const player = ensurePlayer(world, user, now, { migrate: false });
    ensureWarehouse(player);
    ensureGemState(player);
    ensureBankWorld(world, now, { normalizePlayers: !store.scheduledProcessing });
    ensurePlayerBankAccount(player, now);
    ensureWeeklyCashSettlementWorld(world, now, { normalizePlayers: !store.scheduledProcessing });
    ensurePlayerWeeklyCashSettlement(player, now);
    const contractsBeforeCycles = structuredClone(world.productionContracts || []);
    settleProductionForAction(
      world,
      Number(user.id),
      payload?.productionSettlement,
      now,
    );
    store.captureContractAuditTransition(contractsBeforeCycles, world, {
      actorUserId: Number(user.id), triggerType: 'production_output_reserve', action, requestKey, now,
    });
    if (!store.scheduledProcessing) {
      store.processWorldIfDue(world, now, Number(user.id), {
        force: false,
        forceDomains: [],
        auditTrigger: 'action_preprocess',
      });
    }
    settlePlayerWeeklyCashOnLogin(world, world.players[String(user.id)], now, {
      processWorld: !store.scheduledProcessing,
    });

    const { gameResult, playerBeforeAction, contractsBeforeAction } = executeActionBody(
      store,
      world,
      user,
      action,
      payload,
      requestKey,
      now,
      mutationScope,
    );

    if (!gameResult?.ok) {
      const response = createActionAcknowledgement(gameResult, revision);
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
    }

    if (action === 'accelerateResearch') {
      store.gemEconomy.recordResearchAcceleration(user.id, requestKey, gameResult, now);
    }

    const activePlayer = world.players[String(user.id)];
    const playerChanged = Boolean(activePlayer && !isDeepStrictEqual(activePlayer, playerBeforeAction));
    const contractChanged = Boolean(
      contractsBeforeAction
      && !isDeepStrictEqual(world.productionContracts || [], contractsBeforeAction),
    );
    const isPolicySave = action === 'placeOrder'
      && (
        payload.execution === 'online-auto-sell-policy'
        || payload.execution === 'online-auto-trade-policy'
        || payload.execution === 'factory-auto-operation-policy'
      );
    if ((ECONOMIC_ACTIVITY_ACTIONS.has(action) || CONTRACT_ACTIONS.has(action)) && !isPolicySave) {
      if (activePlayer && (playerChanged || contractChanged)) {
        activePlayer.lastEconomicActivityAt = now;
        const activated = activateWeeklyCashSettlement(world, activePlayer, now, {
          processWorld: !store.scheduledProcessing,
        });
        if (activated) {
          gameResult.message = String(gameResult.message || '')
            + '；本周已激活，存款从下一个自然日按每日 1% 计息，周末按资金净额生成 10% 结算';
        }
      }
    }

    if (contractsBeforeAction) {
      store.captureContractAuditTransition(contractsBeforeAction, world, {
        actorUserId: Number(user.id),
        triggerType: 'player_action',
        action,
        requestKey,
        now,
      });
      const beforePostActionContracts = structuredClone(world.productionContracts || []);
      processProductionContracts(world, now);
      store.captureContractAuditTransition(beforePostActionContracts, world, {
        actorUserId: Number(user.id),
        triggerType: 'action_postprocess',
        action,
        requestKey,
        now,
      });
      measureRequestPhase('economicInvariantMs', () => assertEconomicStateInvariants(world));
    }

    collectPlayerWeeklyCashSettlement(world, activePlayer, now);
    ensureWarehouse(world.players[String(user.id)]);
    ensureGemState(world.players[String(user.id)]);
    ensurePlayerBankAccount(world.players[String(user.id)], now);
    ensurePlayerWeeklyCashSettlement(world.players[String(user.id)], now);
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson, mutationScope);
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
