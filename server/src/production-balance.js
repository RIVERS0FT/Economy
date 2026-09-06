import { productionOperatingCostForCycle } from '../../shared/production-settlement.js';
import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';

export const PRODUCTION_BALANCE_VERSION = 2;
export const PRODUCTION_CAPITAL_COVERAGE_CYCLES = 2;
export const PRODUCTION_CAPITAL_TARGET_MINUTES = Object.freeze({ C1: 80, C2: 70, C3: 75, C4: 80, C5: 80, C6: 80, C7: 80 });
const legacyCosts = new Map();

function cents(value) {
  const result = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(result) || result < 0 || Math.abs(result / 100 - Number(value)) > 1e-9) {
    throw new RangeError('生产目录金额必须是非负两位小数安全数值');
  }
  return result;
}

function itemValue(items, prices) {
  return (items || []).reduce((sum, item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 0 || !prices.has(item.productId)) {
      throw new RangeError('生产目录商品或数量无效');
    }
    return sum + BigInt(cents(prices.get(item.productId))) * BigInt(item.quantity);
  }, 0n);
}

export function productionCapitalTargetMinutes(facility, methodIndex) {
  const base = PRODUCTION_CAPITAL_TARGET_MINUTES[facility.complexity];
  if (!base || !Number.isInteger(methodIndex) || methodIndex < 0 || methodIndex > 3) {
    throw new RangeError('生产复杂度或制度序号无效');
  }
  if (facility.complexity === 'C1') return [80, 75, 70, 65][methodIndex];
  if (facility.complexity === 'C2') return [70, 70, 67, 65][methodIndex];
  // Faster turnover costs a premium; slower operation saves capital; double batches favor throughput.
  return base + [0, 5, -5, 0][methodIndex];
}

export function balanceProductionPlan(facility, plan, methodIndex) {
  const prices = new Map(facility.products.map(product => [product.id, product.basePrice]));
  const output = itemValue([plan.output], prices);
  const inputs = itemValue(plan.inputs, prices);
  const construction = BigInt(cents(facility.buildCost)) + itemValue(facility.buildInputs, prices);
  if (!Number.isSafeInteger(plan.cycleMs) || plan.cycleMs < 1000 || plan.cycleMs % 1000 !== 0) {
    throw new RangeError('生产周期必须为安全整秒');
  }
  const targetMs = BigInt(productionCapitalTargetMinutes(facility, methodIndex)) * 60_000n;
  const duration = BigInt(plan.cycleMs);
  const denominator = targetMs + BigInt(PRODUCTION_CAPITAL_COVERAGE_CYCLES) * duration;
  // Use the actual selling fee. Compute in micro-units, then round once to catalog cents.
  const grossMoney = Number(output) / 100;
  const feeMicros = BigInt(Math.round(calculateCumulativeMarketSellFee(grossMoney) * 1_000_000));
  const numerator = targetMs * (output * 10_000n - feeMicros)
    - denominator * inputs * 10_000n - duration * construction * 10_000n;
  const centsDenominator = denominator * 10_000n;
  if (numerator < 0n) throw new RangeError(`${plan.recipeId} 无法在非负成本下达到占款目标`);
  const cost = (numerator + centsDenominator / 2n) / centsDenominator;
  if (cost > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError('生产目录成本溢出');
  legacyCosts.set(`${facility.id}:${plan.recipeId}`, plan.operatingCost);
  return { ...plan, operatingCost: Number(cost) / 100 };
}

export function legacyProductionOperatingCost(facilityTypeId, recipeId) {
  const cost = legacyCosts.get(`${facilityTypeId}:${recipeId}`);
  if (cost === undefined) throw new Error('缺少旧周期目录成本');
  return cost;
}

export function productionCostBoundary(group, recipeId) {
  if (group?.productionLegacyRecipeId !== recipeId
    || !Number.isFinite(group?.productionCostChangeAt)
    || !Number.isFinite(group?.productionLegacyOperatingCost)
    || group.productionLegacyOperatingCost < 0) return {};
  return {
    costChangeAt: group.productionCostChangeAt,
    previousOperatingCostMicros: String(Math.round(group.productionLegacyOperatingCost * 1_000_000)),
  };
}

export function activeProductionRecipe(recipe, group) {
  if (!recipe) return recipe;
  const operatingCost = productionOperatingCostForCycle(group, recipe.id, recipe.operatingCost);
  return operatingCost === recipe.operatingCost ? recipe : { ...recipe, operatingCost };
}
