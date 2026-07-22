import {
  createPopulationEconomySummary,
  ensurePopulationEconomy,
  POPULATION_MODEL_IDS,
} from './population-economy.js';
import { MARKET_DEMAND_GROUP_CATALOG } from './market-demand/catalog.js';
import {
  calculatePopulationStabilizationBudgets,
  createPopulationPolicyFromPayload,
  createResetPopulationPolicy,
  ensurePopulationPolicyState,
  populationPolicyRefillCap,
  populationPolicySnapshot,
  populationPolicyWalletTarget,
  validatePopulationPolicyCapacity,
} from './population-policy.js';

export function populationBaseBudgetTotal() {
  return MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + Math.max(0, Math.floor(Number(group.baseBudget || 0))), 0);
}

function policyResult(state, beforePolicy, now) {
  return {
    beforePolicy,
    afterPolicy: populationPolicySnapshot(state, now),
  };
}

function safeAdd(left, right, message) {
  const result = Number(left) + Number(right);
  if (!Number.isSafeInteger(result) || result < 0) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
  return result;
}

export function applyPopulationPolicy(world, payload, { adminUserId, now = Date.now() } = {}) {
  const state = ensurePopulationEconomy(world, now);
  const beforePolicy = populationPolicySnapshot(state, now);
  const nextPolicy = createPopulationPolicyFromPayload(payload, { adminUserId, now });
  validatePopulationPolicyCapacity(populationBaseBudgetTotal(), nextPolicy);
  state.policy = nextPolicy;
  return policyResult(state, beforePolicy, now);
}

export function resetPopulationPolicy(world, _payload, { adminUserId, now = Date.now() } = {}) {
  const state = ensurePopulationEconomy(world, now);
  const beforePolicy = populationPolicySnapshot(state, now);
  state.policy = createResetPopulationPolicy({ adminUserId, now });
  return policyResult(state, beforePolicy, now);
}

export function topUpPopulationByPolicy(world, payload, { now = Date.now() } = {}) {
  const state = ensurePopulationEconomy(world, now);
  const { policy, policyCycle, currentCycleId } = ensurePopulationPolicyState(state, now);
  const targetModel = String(payload?.targetModel || 'all');
  if (targetModel !== 'all' && !POPULATION_MODEL_IDS.includes(targetModel)) {
    const error = new Error('人口调控目标无效');
    error.statusCode = 400;
    throw error;
  }
  const budgets = calculatePopulationStabilizationBudgets(populationBaseBudgetTotal(), policy);
  const targets = targetModel === 'all' ? POPULATION_MODEL_IDS : [targetModel];
  const issuedByModel = Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [id, 0]));
  for (const modelId of POPULATION_MODEL_IDS) state.models[modelId].lastAdminPopulationIssued = 0;
  for (const modelId of targets) {
    const model = state.models[modelId];
    const stabilizationBudget = budgets.byModel[modelId];
    const targetWallet = populationPolicyWalletTarget(stabilizationBudget, policy);
    const walletTotal = safeAdd(model.credits, model.frozenCredits, '人口钱包总额超出系统可表示范围');
    const refillCap = populationPolicyRefillCap(stabilizationBudget, policy);
    const remainingCap = Math.max(0, refillCap - Number(policyCycle.issuedByModel[modelId] || 0));
    const issued = Math.min(remainingCap, Math.max(0, targetWallet - walletTotal));
    if (issued <= 0) continue;
    model.credits = safeAdd(model.credits, issued, '人口可用资金超出系统可表示范围');
    model.lastAdminPopulationIssued = issued;
    state.stats.adminPopulationIssued = safeAdd(
      Number(state.stats.adminPopulationIssued || 0),
      issued,
      '累计管理员人口补充超出系统可表示范围',
    );
    policyCycle.issuedByModel[modelId] = safeAdd(
      policyCycle.issuedByModel[modelId],
      issued,
      '本周期人口补充超出系统可表示范围',
    );
    policyCycle.adminByModel[modelId] = safeAdd(
      policyCycle.adminByModel[modelId],
      issued,
      '本周期管理员人口补充超出系统可表示范围',
    );
    issuedByModel[modelId] = issued;
  }
  return {
    targetModel,
    currentCycleId,
    issuedByModel,
    issuedTotal: Object.values(issuedByModel).reduce((sum, value) => sum + value, 0),
    policy: populationPolicySnapshot(state, now),
  };
}

export function createPopulationAdminSummary(world, now = Date.now()) {
  return createPopulationEconomySummary(world, now, { totalBaseBudget: populationBaseBudgetTotal() });
}
