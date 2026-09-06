import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';
import { PRODUCT_CATALOG } from './product-catalog.js';
import { factoryAutoOperationPolicyFor } from './factory-auto-operation.js';
import { buildingFreezeSource, planInputTotals, reconcileBuildingInputFreezes } from './building-input-freezes.js';
import { freezeCommodity, frozenForSource } from './commodity-freezes.js';
import { applySettledCommodityOrder } from './domain.js';
import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';
import { internalMoneyToMicros, multiplyMoneyByInteger } from './money.js';
import { inventoryForProvince, normalizeProvinceId, provinceScopedKey } from './provinces.js';
import { allocateDailySupplyReservesForSupplier, consumePreparedDailySupply, quotePreparedDailySupply,
  recordDailyProductProduction } from './daily-supply-contracts.js';

function priceFor(world, provinceId, productId) {
  const price = world.markets?.[provinceScopedKey(provinceId, productId)]?.officialPrice;
  return typeof price === 'number' && Number.isFinite(price) && price >= 0.01 ? price : null;
}

function money(value) { return internalMoneyToMicros(value); }
function total(price, quantity) {
  const value = multiplyMoneyByInteger(price, quantity);
  return value === null ? null : money(value);
}

/** Authoritative next-batch margin. Existing stock has a cost; only ready contracts can lower it. */
export function quoteBuildingAutoProcurement(world, player, plan, batchIndex, now) {
  const batch = plan.batches[batchIndex];
  if (!batch || batch.effectiveCount < 1) return null;
  const operating = total(plan.operatingCost, batch.effectiveCount);
  if (operating === null) return null;
  const previous = planInputTotals(plan, batchIndex);
  const inputs = [];
  let inputCost = 0n;
  let marketCost = 0n;
  for (const item of batch.inputs) {
    const officialPrice = priceFor(world, plan.provinceId, item.productId);
    if (officialPrice === null) return null;
    const inventory = player.inventories?.[provinceScopedKey(plan.provinceId, item.productId)];
    const owned = frozenForSource(inventory, plan.kind, plan.sourceId);
    if (owned < (previous[item.productId] || 0)) return null;
    const existing = Math.min(item.quantity, owned - (previous[item.productId] || 0));
    const missing = item.quantity - existing;
    const quote = quotePreparedDailySupply(world, player.userId, plan.provinceId, item.productId, missing, officialPrice, now);
    const existingCost = total(officialPrice, existing);
    const market = total(officialPrice, quote.remaining);
    if (existingCost === null || market === null) return null;
    inputCost += existingCost + market;
    marketCost += market;
    for (const allocation of quote.allocations) {
      const cost = total(allocation.unitPrice, allocation.quantity);
      if (cost === null) return null;
      inputCost += cost;
    }
    inputs.push({ productId: item.productId, quantity: missing, marketQuantity: quote.remaining,
      allocations: quote.allocations });
  }
  let netProfit;
  if (plan.kind === 'commercial') {
    // Commercial settlement returns the official value, operating cost and fixed profit.
    let officialInputValue = 0n;
    for (const input of batch.inputs) {
      const value = total(priceFor(world, plan.provinceId, input.productId), input.quantity);
      if (value === null) return null;
      officialInputValue += value;
    }
    const fixedProfit = total(plan.type.profitPerCycle, batch.effectiveCount);
    if (fixedProfit === null) return null;
    netProfit = officialInputValue + fixedProfit - inputCost;
  } else {
    const outputPrice = priceFor(world, plan.provinceId, plan.recipe.output.productId);
    if (outputPrice === null) return null;
    const gross = multiplyMoneyByInteger(outputPrice, plan.recipe.output.quantity * batch.effectiveCount);
    if (gross === null) return null;
    const grossMicros = money(gross);
    const feeMicros = money(calculateCumulativeMarketSellFee(gross));
    if (grossMicros === null || feeMicros === null) return null;
    netProfit = grossMicros - feeMicros - inputCost - operating;
  }
  return { netProfitMicros: netProfit, marketCostMicros: marketCost, operatingCostMicros: operating, inputs };
}

function trade(world, player, provinceId, productId, side, quantity, now, executionPrefix = 'cycle-auto') {
  if (!quantity) return null;
  const result = applySettledCommodityOrder(world, { id: player.userId }, {
    provinceId, productId, side, quantity, assetKind: 'commodity',
  }, now);
  if (!result?.ok) throw new Error(result?.message || '自动经营交易失败');
  const record = world.orders?.at(-1);
  if (record?.ownerId === player.userId && record?.productId === productId) record.execution = `${executionPrefix}-${side}`;
  return result;
}

function isInitialAutoOperationPlan(player, plan) {
  if (!plan?.group?.enabled || !plan?.policy?.enabled) return false;
  const cursorKey = `${plan.kind}:${plan.sourceId}`;
  if (Number(player.autoOperationCycleCursors?.[cursorKey] || 0) > 0) return false;
  if (plan.kind === 'commercial') {
    return !plan.group.cycleActive
      && plan.group.status !== 'running'
      && Number(plan.group.lifetimeRevenue || 0) <= 0;
  }
  return plan.group.status !== 'running'
    && Number(plan.group.lifetimeOutput || 0) <= 0;
}

function procureBuildingPlans(
  world,
  player,
  plans,
  now,
  { initialOnly = false, executionPrefix = 'cycle-auto' } = {},
) {
  // Do not spend the cash needed to run the first prepared cycle of other active buildings.
  const operatingReserve = plans.reduce((sum, plan) => sum + (total(plan.operatingCost, plan.batches[0]?.effectiveCount || 0) ?? 0n), 0n);
  const blocked = new Set();
  let changed = false;
  for (let batch = 0; batch < 5; batch += 1) {
    for (const plan of plans) {
      const key = `${plan.kind}:${plan.sourceId}`;
      if (!plan.policy.enabled || blocked.has(key) || !plan.batches[batch]) continue;
      if (initialOnly && !isInitialAutoOperationPlan(player, plan)) continue;
      if (plan.batches[batch].effectiveCount === 0) continue; // Staffing recovery needs no goods.
      const quote = quoteBuildingAutoProcurement(world, player, plan, batch, now);
      if (!quote || quote.netProfitMicros <= 0n
        || (money(player.credits) ?? 0n) < quote.marketCostMicros + operatingReserve) {
        blocked.add(key);
        continue;
      }
      // All inputs were priced and funded before any purchase; outer economic transaction is atomic.
      for (const input of quote.inputs) {
        if (!input.quantity) continue;
        for (const allocation of input.allocations) consumePreparedDailySupply(world, player.userId, allocation, now);
        trade(world, player, plan.provinceId, input.productId, 'buy', input.marketQuantity, now, executionPrefix);
        freezeCommodity(inventoryForProvince(player, input.productId, plan.provinceId), plan.kind, plan.sourceId, input.quantity);
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Purchase-only first-cycle bootstrap. It never writes a cycle cursor and never performs auto-sale.
 * Once a building has a running cycle or a completed-cycle cursor, normal completion-driven automation owns procurement.
 */
export function bootstrapBuildingAutoOperation(world, player, now, provinceId) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const plans = reconcileBuildingInputFreezes(world, player, now, selectedProvinceId);
  return procureBuildingPlans(world, player, plans, now, {
    initialOnly: true,
    executionPrefix: 'bootstrap-auto',
  });
}

export function recordCompletedIndustrialOutput(world, player, group, productId, output, now) {
  if (output > 0) {
    recordDailyProductProduction(player, group.provinceId, productId, output, now);
    allocateDailySupplyReservesForSupplier(world, player.userId, group.provinceId, productId, now, { process: false });
  }
  group.cycleRecordedLifetimeOutput = Number(group.lifetimeOutput || 0);
}

/** Called only after a real, committed-in-this-transaction cycle result, never by a client timer. */
export function completeBuildingCycleAutoOperation(world, player, group, kind, completedAt, now) {
  if (!Number.isFinite(completedAt) || completedAt <= 0 || completedAt > now) return false;
  const sourceId = buildingFreezeSource(group, kind);
  const cursorKey = `${kind}:${sourceId}`;
  if (Number(player.autoOperationCycleCursors?.[cursorKey] || 0) >= completedAt) return false;
  player.autoOperationCycleCursors ||= {};
  player.autoOperationCycleCursors[cursorKey] = completedAt;
  const provinceId = normalizeProvinceId(group.provinceId);
  // Freeze existing stock even for manually operated consumers, before any sale.
  const plans = reconcileBuildingInputFreezes(world, player, now, provinceId);
  const policy = kind === 'commercial' ? commercialAutoOperationPolicyFor(group)
    : factoryAutoOperationPolicyFor(player, provinceId, group.facilityTypeId);
  if (!group.enabled || !policy.enabled) return false;

  let changed = false;
  for (const product of PRODUCT_CATALOG) {
    const quantity = Number(player.inventories?.[provinceScopedKey(provinceId, product.id)]?.available || 0);
    if (quantity < 1 || priceFor(world, provinceId, product.id) === null) continue;
    trade(world, player, provinceId, product.id, 'sell', quantity, now);
    player.cycleAutoSaleCounts ||= {};
    const key = provinceScopedKey(provinceId, product.id);
    const cumulative = Number(player.cycleAutoSaleCounts[key] || 0) + quantity;
    if (!Number.isSafeInteger(cumulative)) throw new RangeError('累计自动出售数量超出系统范围');
    player.cycleAutoSaleCounts[key] = cumulative;
    changed = true;
  }

  return procureBuildingPlans(world, player, plans, now) || changed;
}
