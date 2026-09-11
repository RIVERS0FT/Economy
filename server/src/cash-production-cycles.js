import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { productionAvailableCount } from './facility-production-availability.js';
import { projectFacilityStaffingRate } from '../../shared/production-settlement.js';
import { cashAdd, cashEconomyError, cashFee, cashMicros, cashMoney, cashProduct, cashQuantity, cashTimestamp } from './cash-economy-money.js';
import { cashDateKey, officialCashPrice, requireCashProduct, requireCashProvince } from './commodity-investment-prices.js';
import { cashInputTotal, commitCashMarketBookings, prepareCashMarketBookings, quoteCashOperatingInputs } from './cash-operating-market.js';

export const CASH_PRODUCTION_CYCLE_VERSION = 1;
const SIGNED = { signed: true };
const TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));

function typeAndRecipe(player, group) {
  if (!(player.facilityGroups ?? []).includes(group)) throw cashEconomyError('CASH_GROUP_INVALID', '工厂集群不属于当前玩家');
  requireCashProvince(group.provinceId);
  const type = TYPES.get(group.facilityTypeId);
  const recipe = type?.recipes?.find((entry) => entry.id === group.activeRecipeId);
  if (!type || !recipe) throw cashEconomyError('CASH_RECIPE_INVALID', '工厂或当前生产配方无效');
  return { type, recipe };
}

function operatingStats(player) {
  return { materialsPaid: 0, operatingPaid: 0, salesGross: 0, salesFees: 0, revenue: 0, profit: 0,
    ...(player.cashOperatingStats ?? {}) };
}

function safeStats(player) { return { ...(player.stats ?? {}) }; }
function addStatMoney(stats, key, amount) { stats[key] = cashAdd(stats[key] ?? 0, amount, key); }
function addStatQuantity(stats, key, quantity) { stats[key] = cashQuantity((stats[key] ?? 0) + quantity, key, { allowZero: true }); }

function capacityFor(world, player, group, at, duration) {
  const count = cashQuantity(productionAvailableCount(world, player, group), '可参与工厂数量');
  const rate = projectFacilityStaffingRate(group, at);
  if (!Number.isSafeInteger(rate) || rate < 0 || rate > 10_000) throw cashEconomyError('CASH_STAFFING_INVALID', '满员率基线无效');
  const carry = cashQuantity(group.staffingBatchCarryBps ?? 0, '产能余数', { allowZero: true });
  if (carry >= 10_000) throw cashEconomyError('CASH_STAFFING_INVALID', '产能余数无效');
  // One funded cycle locks its own end-of-cycle capacity. Later stops or expansion cannot recalculate it.
  const endRate = projectFacilityStaffingRate({ ...group, enabled: true, status: 'running', staffingRateBps: rate, staffingUpdatedAt: at }, at + duration);
  const numerator = BigInt(count) * BigInt(endRate) + BigInt(carry);
  const effectiveCount = cashQuantity(Number(numerator / 10_000n), '整数等效产能', { allowZero: true });
  return { count, rate, endRate, effectiveCount, nextCarry: Number(numerator % 10_000n) };
}

export function quoteCashProductionCycle(world, player, group, at) {
  cashTimestamp(at);
  const { type, recipe } = typeAndRecipe(player, group);
  const duration = cashQuantity(recipe.cycleMs, '生产周期');
  const completesAt = cashTimestamp(at + duration);
  const capacity = capacityFor(world, player, group, at, duration);
  const inputs = quoteCashOperatingInputs(world, group.provinceId, recipe.inputs, capacity.effectiveCount, at);
  const materialCost = cashInputTotal(inputs);
  const operatingCost = cashProduct(recipe.operatingCost, capacity.effectiveCount, '周期运营成本');
  const totalCost = cashAdd(materialCost, operatingCost, '周期总投入');
  const outputQuantity = cashQuantity(recipe.output.quantity * capacity.effectiveCount, '周期产量', { allowZero: true });
  const outputPrice = outputQuantity > 0 ? officialCashPrice(world, group.provinceId, recipe.output.productId, at).price : 0;
  const expectedGross = cashProduct(outputPrice, outputQuantity);
  const expectedNet = cashMoney(cashMicros(expectedGross) - cashFee(cashMicros(expectedGross)));
  const wageMultiplierBps = cashQuantity(world.populationEconomy?.policy?.productionWageMultiplierBps ?? 10_000, '生产工资系数');
  if (wageMultiplierBps < 5_000) throw cashEconomyError('CASH_WAGE_INVALID', '生产工资系数低于正式下限');
  const wage = cashMoney((cashMicros(operatingCost) * BigInt(wageMultiplierBps) + 5_000n) / 10_000n, '生产就业收入');
  return {
    version: CASH_PRODUCTION_CYCLE_VERSION, provinceId: group.provinceId, facilityTypeId: type.id,
    recipeId: recipe.id, complexity: type.complexity, startedAt: at, completesAt,
    physicalCount: capacity.count, effectiveCount: capacity.effectiveCount,
    staffingRateBps: capacity.rate, completionStaffingRateBps: capacity.endRate, nextCarryBps: capacity.nextCarry,
    priceDateKey: cashDateKey(at), inputs, materialCost, operatingCost, totalCost,
    output: { productId: recipe.output.productId, quantity: outputQuantity },
    wageMultiplierBps, wage,
    expectedRevenue: expectedNet, expectedProfit: cashMoney(cashMicros(expectedNet) - cashMicros(totalCost), '预计净利润', SIGNED),
  };
}

/** Starts exactly one genuinely funded cycle. It never pre-buys stock for future cycles. */
export function startCashProductionCycle(world, player, group, at, { manual = false } = {}) {
  cashTimestamp(at);
  typeAndRecipe(player, group);
  if (group.cashCycle) return { started: false, employment: null };
  if (!manual && !group.enabled) return { started: false, employment: null };
  const quote = quoteCashProductionCycle(world, player, group, at);
  if (!manual && quote.effectiveCount > 0 && cashMicros(quote.expectedProfit, undefined, SIGNED) <= 0n) {
    return { started: false, reason: 'unprofitable', employment: null };
  }
  if (cashMicros(player.credits, '可用资金') < cashMicros(quote.totalCost)) {
    return { started: false, reason: 'insufficient_funds', employment: null };
  }
  const credits = cashMoney(cashMicros(player.credits) - cashMicros(quote.totalCost));
  const sequence = cashQuantity((group.cashCycleSequence ?? 0) + 1, '生产周期序号');
  const cycle = { ...quote, sequence, id: `${group.provinceId}:${group.facilityTypeId}:${sequence}` };
  const stats = safeStats(player);
  const operating = operatingStats(player);
  operating.materialsPaid = cashAdd(operating.materialsPaid, quote.materialCost, '累计材料费用');
  operating.operatingPaid = cashAdd(operating.operatingPaid, quote.operatingCost, '累计运营费用');
  addStatMoney(stats, 'productionPayroll', quote.operatingCost);
  addStatMoney(stats, 'employmentPayments', quote.operatingCost);
  const goods = quote.inputs.reduce((sum, input) => cashQuantity(sum + input.quantity, '投入总量', { allowZero: true }), 0);
  addStatQuantity(stats, 'boughtGoods', goods);
  addStatQuantity(stats, 'commodityVolume', goods);
  const booking = prepareCashMarketBookings(world, quote.inputs.map((input) => ({
    provinceId: group.provinceId, productId: input.productId, side: 'buy', quantity: input.quantity,
    price: input.unitPrice, at, processedAt: at, execution: 'production-input',
  })));
  commitCashMarketBookings(world, booking);
  Object.assign(player, { credits, stats, cashOperatingStats: operating });
  Object.assign(group, {
    cashCycle: cycle, cashCycleSequence: sequence, enabled: true, status: 'running',
    participatingCount: quote.physicalCount, cycleStartedAt: at,
    staffingRateBps: quote.staffingRateBps, staffingUpdatedAt: at, staffingBatchCarryBps: quote.nextCarryBps,
  });
  delete group.statusReason;
  return { started: true, cycle: structuredClone(cycle),
    employment: { amount: quote.wage, source: 'production', complexity: quote.complexity, payerAmount: quote.operatingCost } };
}

export function assertCashProductionCycle(group) {
  const cycle = group.cashCycle;
  if (!cycle) return true;
  if (cycle.version !== CASH_PRODUCTION_CYCLE_VERSION || cycle.provinceId !== group.provinceId
    || cycle.facilityTypeId !== group.facilityTypeId
    || cycle.id !== `${group.provinceId}:${group.facilityTypeId}:${cycle.sequence}`
    || cycle.sequence !== group.cashCycleSequence || cycle.sequence <= (group.cashLastCompletedSequence ?? 0)) {
    throw cashEconomyError('CASH_CYCLE_INVALID', '生产周期身份或完成游标不一致');
  }
  requireCashProvince(cycle.provinceId); requireCashProduct(cycle.output?.productId);
  cashQuantity(cycle.sequence, '周期序号');
  cashTimestamp(cycle.startedAt); cashTimestamp(cycle.completesAt);
  if (cycle.completesAt <= cycle.startedAt) throw cashEconomyError('CASH_CYCLE_INVALID', '生产周期截止时间无效');
  cashQuantity(cycle.physicalCount, '参与数量'); cashQuantity(cycle.effectiveCount, '等效产能', { allowZero: true });
  cashQuantity(cycle.output.quantity, '产量', { allowZero: true });
  if (!Array.isArray(cycle.inputs)) throw cashEconomyError('CASH_CYCLE_INVALID', '已投入材料明细缺失');
  for (const input of cycle.inputs) {
    requireCashProduct(input.productId); cashQuantity(input.quantity, '已投入数量');
    if (cashProduct(input.unitPrice, input.quantity) !== input.total) throw cashEconomyError('CASH_CYCLE_INVALID', '已投入材料金额不一致');
  }
  if (cashInputTotal(cycle.inputs) !== cycle.materialCost
    || cashAdd(cycle.materialCost, cycle.operatingCost) !== cycle.totalCost) {
    throw cashEconomyError('CASH_CYCLE_INVALID', '已投入周期成本不守恒');
  }
  return true;
}

/** Settles the one stored cycle; it cannot manufacture unrecorded offline cycles. */
export function settleCashProductionCycle(world, player, group, now) {
  cashTimestamp(now);
  if (!(player.facilityGroups ?? []).includes(group)) throw cashEconomyError('CASH_GROUP_INVALID', '工厂集群不属于当前玩家');
  assertCashProductionCycle(group);
  const cycle = group.cashCycle;
  if (!cycle || now < cycle.completesAt) return { settled: false, employment: null };
  const price = cycle.output.quantity > 0
    ? officialCashPrice(world, cycle.provinceId, cycle.output.productId, cycle.completesAt).price : 0;
  const gross = cashProduct(price, cycle.output.quantity);
  const operating = operatingStats(player);
  const nextGross = cashMicros(operating.salesGross) + cashMicros(gross);
  const nextFees = cashFee(nextGross);
  const fee = cashMoney(nextFees - cashMicros(operating.salesFees), '本周期销售费用');
  const revenue = cashMoney(cashMicros(gross) - cashMicros(fee), '本周期销售收入');
  const profit = cashMoney(cashMicros(revenue) - cashMicros(cycle.totalCost), '本周期净利润', SIGNED);
  const credits = cashMoney(cashMicros(player.credits) + cashMicros(revenue), '生产结算后资金');
  operating.salesGross = cashMoney(nextGross, '累计销售总额');
  operating.salesFees = cashMoney(nextFees, '累计销售费用');
  operating.revenue = cashAdd(operating.revenue, revenue, '累计销售收入');
  operating.profit = cashAdd(operating.profit, profit, '累计经营净利润', SIGNED);
  const stats = safeStats(player);
  addStatMoney(stats, 'marketServiceFees', fee); addStatMoney(stats, 'employmentPayments', fee);
  addStatQuantity(stats, 'producedGoods', cycle.output.quantity);
  addStatQuantity(stats, 'soldGoods', cycle.output.quantity);
  addStatQuantity(stats, 'commodityVolume', cycle.output.quantity);
  const lifetimeOutput = cashQuantity((group.lifetimeOutput ?? 0) + cycle.output.quantity, '累计产量', { allowZero: true });
  const booking = prepareCashMarketBookings(world, [{
    provinceId: cycle.provinceId, productId: cycle.output.productId, side: 'sell', quantity: cycle.output.quantity,
    price, netTotal: revenue, at: cycle.completesAt, processedAt: now, execution: 'production-output',
  }]);
  const rateAtCompletion = projectFacilityStaffingRate(group, cycle.completesAt);
  const rateNow = projectFacilityStaffingRate({ ...group, status: 'stopped', staffingRateBps: rateAtCompletion, staffingUpdatedAt: cycle.completesAt }, now);
  const settlement = { ...structuredClone(cycle), price, priceDateKey: cashDateKey(cycle.completesAt), gross, fee, revenue, profit, processedAt: now };
  commitCashMarketBookings(world, booking);
  Object.assign(player, { credits, stats, cashOperatingStats: operating });
  Object.assign(group, {
    cashCycle: null, cashLastCompletedSequence: cycle.sequence, lastCashCycle: settlement,
    lifetimeOutput, participatingCount: 0, status: 'stopped', statusReason: 'manual',
    staffingRateBps: rateNow, staffingUpdatedAt: now,
  });
  delete group.cycleStartedAt;
  return { settled: true, settlement: structuredClone(settlement),
    employment: { amount: fee, source: 'marketService', payerAmount: fee } };
}

export function cashProductionWorkInProgress(player) {
  let total = 0n;
  for (const group of player?.facilityGroups ?? []) {
    assertCashProductionCycle(group);
    if (group.cashCycle) total += cashMicros(group.cashCycle.totalCost);
  }
  return cashMoney(total, '已投入未完成生产成本');
}

/** Stop future operation; already paid inputs and the locked current cycle are not refunded. */
export function pauseCashProductionCycle(player, group, now) {
  cashTimestamp(now);
  if (!(player.facilityGroups ?? []).includes(group)) throw cashEconomyError('CASH_GROUP_INVALID', '工厂集群不属于当前玩家');
  const rate = projectFacilityStaffingRate(group, now);
  group.staffingRateBps = rate;
  group.staffingUpdatedAt = now;
  group.enabled = false;
  if (!group.cashCycle) { group.status = 'stopped'; group.statusReason = 'manual'; }
}
