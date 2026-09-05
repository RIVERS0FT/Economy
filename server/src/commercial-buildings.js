import { normalizeCommercialAutoOperationPolicy } from '../../shared/commercial-auto-operation.js';
import { multiplyMoneyByInteger, roundInternalMoney } from './money.js';
import { PRODUCT_CATALOG } from './product-catalog.js';
import {
  DEFAULT_PROVINCE_ID,
  inventoryForProvince,
  normalizeProvinceId,
  provinceScopedKey,
} from './provinces.js';

const COMMERCIAL_CYCLE_MS = 5 * 60 * 1000;
const MAX_BUILD_QUANTITY = 100;
const MAX_CATCH_UP_CYCLES = 10_000;

const rawCommercialTypes = [
  {
    id: 'convenience-store',
    name: '便利店',
    description: '消耗食品和饮料，提供基础社区零售服务。',
    buildCost: 120,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 1.5,
    profitPerCycle: 2.5,
    consumptionInputs: [
      { productId: 'food', quantity: 1 },
      { productId: 'beverage', quantity: 1 },
    ],
    systemValue: 120,
  },
  {
    id: 'fresh-market',
    name: '生鲜超市',
    description: '持续消耗水果、肉类和奶，形成农业与养殖业终端需求。',
    buildCost: 180,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 2,
    profitPerCycle: 3.2,
    consumptionInputs: [
      { productId: 'fruit', quantity: 2 },
      { productId: 'meat', quantity: 1 },
      { productId: 'milk', quantity: 1 },
    ],
    systemValue: 180,
  },
  {
    id: 'restaurant',
    name: '餐厅',
    description: '消耗预制餐和饮料，提供稳定餐饮服务利润。',
    buildCost: 250,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 3,
    profitPerCycle: 4.5,
    consumptionInputs: [
      { productId: 'prepared-meal', quantity: 2 },
      { productId: 'beverage', quantity: 1 },
    ],
    systemValue: 250,
  },
  {
    id: 'clothing-store',
    name: '服装店',
    description: '消费服装商品，将纺织产业的终端商品转化为稳定商业利润。',
    buildCost: 320,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 3.5,
    profitPerCycle: 5,
    consumptionInputs: [{ productId: 'clothing', quantity: 1 }],
    systemValue: 320,
  },
  {
    id: 'furniture-showroom',
    name: '家具商场',
    description: '消费家具商品，为木材加工产业提供稳定终端需求。',
    buildCost: 420,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 4,
    profitPerCycle: 6,
    consumptionInputs: [{ productId: 'furniture', quantity: 1 }],
    systemValue: 420,
  },
  {
    id: 'appliance-store',
    name: '家电卖场',
    description: '消费家电和电子产品，作为高级制造业的商业终端。',
    buildCost: 560,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 5,
    profitPerCycle: 8,
    consumptionInputs: [
      { productId: 'appliance', quantity: 1 },
      { productId: 'electronics', quantity: 1 },
    ],
    systemValue: 560,
  },
];

export const COMMERCIAL_BUILDING_TYPE_CATALOG = Object.freeze(rawCommercialTypes.map((type) => Object.freeze({
  ...type,
  consumptionInputs: Object.freeze(type.consumptionInputs.map((item) => Object.freeze({ ...item }))),
})));

const TYPE_BY_ID = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => [type.id, type]));
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function result(ok, message) {
  return { ok, message };
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return normalized >= 1 && normalized <= max ? normalized : null;
}

function normalizeNonNegativeMoney(value) {
  const normalized = roundInternalMoney(value);
  return normalized === null ? 0 : Math.max(0, normalized);
}

function typeFor(typeId) {
  return TYPE_BY_ID.get(String(typeId || '')) || null;
}

function officialPriceFor(world, productId, provinceId) {
  const market = world.markets?.[provinceScopedKey(provinceId, productId)];
  const price = Number(market?.officialPrice ?? market?.lastPrice ?? PRODUCT_BY_ID.get(productId)?.basePrice ?? 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function normalizeGroup(group, now = Date.now()) {
  if (!group || typeof group !== 'object') return null;
  const type = typeFor(group.commercialTypeId);
  if (!type) return null;
  group.commercialTypeId = type.id;
  group.provinceId = normalizeProvinceId(group.provinceId || DEFAULT_PROVINCE_ID);
  group.count = Math.max(0, Math.floor(Number(group.count || 0)));
  group.participatingCount = Math.max(0, Math.min(group.count, Math.floor(Number(group.participatingCount || 0))));
  group.enabled = group.enabled === true;
  if (group.autoOperationPolicy !== undefined) {
    const policy = normalizeCommercialAutoOperationPolicy(group.autoOperationPolicy);
    if (policy) group.autoOperationPolicy = policy;
    else delete group.autoOperationPolicy;
  }
  group.status = ['running', 'stopped', 'error'].includes(group.status)
    ? group.status
    : group.enabled ? 'error' : 'stopped';
  group.statusReason = ['manual', 'insufficient_funds', 'insufficient_input'].includes(group.statusReason)
    ? group.statusReason
    : group.status === 'stopped' ? 'manual' : undefined;
  group.lifetimeRevenue = normalizeNonNegativeMoney(group.lifetimeRevenue);
  group.lifetimeProfit = normalizeNonNegativeMoney(group.lifetimeProfit);
  group.lifetimeGoodsConsumed = Math.max(0, Math.floor(Number(group.lifetimeGoodsConsumed || 0)));
  group.pendingRevenue = normalizeNonNegativeMoney(group.pendingRevenue);
  group.pendingProfit = normalizeNonNegativeMoney(group.pendingProfit);
  group.pendingGoodsConsumed = Math.max(0, Math.floor(Number(group.pendingGoodsConsumed || 0)));
  if (group.pendingRevenue > 0) {
    group.cycleStartedAt = Math.max(0, Number(group.cycleStartedAt || now));
    group.cycleCompletesAt = Math.max(group.cycleStartedAt, Number(group.cycleCompletesAt || (group.cycleStartedAt + type.cycleMs)));
    group.status = 'running';
    delete group.statusReason;
  } else {
    delete group.cycleStartedAt;
    delete group.cycleCompletesAt;
    delete group.pendingRevenue;
    delete group.pendingProfit;
    delete group.pendingGoodsConsumed;
    delete group.pendingOperatingCost;
    delete group.pendingInputValue;
    delete group.pendingInputs;
    group.participatingCount = 0;
    if (!group.enabled) {
      group.status = 'stopped';
      group.statusReason = 'manual';
    }
  }
  return group.count > 0 ? group : null;
}

export function ensureCommercialPlayer(player, now = Date.now()) {
  player.commercialBuildingGroups = (player.commercialBuildingGroups || [])
    .map((group) => normalizeGroup(group, now))
    .filter(Boolean);
  player.stats ||= {};
  player.stats.commercialGrossRevenueIssued = normalizeNonNegativeMoney(player.stats.commercialGrossRevenueIssued);
  player.stats.commercialProfitIssued = normalizeNonNegativeMoney(player.stats.commercialProfitIssued);
  player.stats.commercialOperatingCosts = normalizeNonNegativeMoney(player.stats.commercialOperatingCosts);
  player.stats.commercialGoodsConsumed = Math.max(0, Math.floor(Number(player.stats.commercialGoodsConsumed || 0)));
  player.stats.commercialBuildingsConstructed = Math.max(0, Math.floor(Number(player.stats.commercialBuildingsConstructed || 0)));
  return player;
}

export function migrateCommercialWorld(world, now = Date.now()) {
  for (const player of Object.values(world.players || {})) ensureCommercialPlayer(player, now);
  return world;
}

function groupFor(player, commercialTypeId, provinceId, create = false, now = Date.now()) {
  ensureCommercialPlayer(player, now);
  const normalizedProvinceId = normalizeProvinceId(provinceId);
  let group = player.commercialBuildingGroups.find((candidate) => (
    candidate.commercialTypeId === commercialTypeId && candidate.provinceId === normalizedProvinceId
  ));
  if (!group && create) {
    group = {
      commercialTypeId,
      provinceId: normalizedProvinceId,
      count: 0,
      participatingCount: 0,
      enabled: false,
      status: 'stopped',
      statusReason: 'manual',
      lifetimeRevenue: 0,
      lifetimeProfit: 0,
      lifetimeGoodsConsumed: 0,
    };
    player.commercialBuildingGroups.push(group);
  }
  return group || null;
}

function cycleRequirements(type, participatingCount) {
  const inputs = type.consumptionInputs.map((item) => ({
    productId: item.productId,
    quantity: item.quantity * participatingCount,
  }));
  const operatingCost = multiplyMoneyByInteger(type.operatingCost, participatingCount);
  const profit = multiplyMoneyByInteger(type.profitPerCycle, participatingCount);
  return {
    inputs,
    operatingCost: operatingCost ?? Number.POSITIVE_INFINITY,
    profit: profit ?? Number.POSITIVE_INFINITY,
  };
}

function setBlocked(group, reason) {
  group.status = 'error';
  group.statusReason = reason;
  group.participatingCount = 0;
}

function startCycle(world, player, group, type, startedAt) {
  if (!group.enabled || group.count < 1 || group.pendingRevenue > 0) return false;
  const participatingCount = group.count;
  const requirements = cycleRequirements(type, participatingCount);
  if (requirements.operatingCost > player.credits) {
    setBlocked(group, 'insufficient_funds');
    return false;
  }
  for (const input of requirements.inputs) {
    if (inventoryForProvince(player, input.productId, group.provinceId).available < input.quantity) {
      setBlocked(group, 'insufficient_input');
      return false;
    }
  }

  const inputValue = requirements.inputs.reduce((sum, input) => (
    sum + input.quantity * officialPriceFor(world, input.productId, group.provinceId)
  ), 0);
  const revenue = roundInternalMoney(inputValue + requirements.operatingCost + requirements.profit);
  if (revenue === null || !Number.isFinite(revenue)) {
    setBlocked(group, 'insufficient_funds');
    return false;
  }

  player.credits = roundInternalMoney(player.credits - requirements.operatingCost) ?? 0;
  player.stats.systemSinks = normalizeNonNegativeMoney(Number(player.stats.systemSinks || 0) + requirements.operatingCost);
  player.stats.commercialOperatingCosts = normalizeNonNegativeMoney(
    Number(player.stats.commercialOperatingCosts || 0) + requirements.operatingCost,
  );
  let goodsConsumed = 0;
  for (const input of requirements.inputs) {
    const inventory = inventoryForProvince(player, input.productId, group.provinceId);
    inventory.available -= input.quantity;
    goodsConsumed += input.quantity;
  }

  group.participatingCount = participatingCount;
  group.status = 'running';
  delete group.statusReason;
  group.cycleStartedAt = startedAt;
  group.cycleCompletesAt = startedAt + type.cycleMs;
  group.pendingRevenue = revenue;
  group.pendingOperatingCost = requirements.operatingCost;
  group.pendingInputValue = roundInternalMoney(inputValue);
  group.pendingInputs = requirements.inputs.map((input) => ({ ...input }));
  group.pendingProfit = requirements.profit;
  group.pendingGoodsConsumed = goodsConsumed;
  return true;
}

function settleCycle(player, group) {
  const revenue = normalizeNonNegativeMoney(group.pendingRevenue);
  const profit = normalizeNonNegativeMoney(group.pendingProfit);
  const goodsConsumed = Math.max(0, Math.floor(Number(group.pendingGoodsConsumed || 0)));
  player.credits = roundInternalMoney(Number(player.credits || 0) + revenue) ?? Number(player.credits || 0);
  player.stats.commercialGrossRevenueIssued = normalizeNonNegativeMoney(
    Number(player.stats.commercialGrossRevenueIssued || 0) + revenue,
  );
  player.stats.commercialProfitIssued = normalizeNonNegativeMoney(
    Number(player.stats.commercialProfitIssued || 0) + profit,
  );
  player.stats.commercialGoodsConsumed = Math.max(0, Math.floor(Number(player.stats.commercialGoodsConsumed || 0) + goodsConsumed));
  group.lifetimeRevenue = normalizeNonNegativeMoney(Number(group.lifetimeRevenue || 0) + revenue);
  group.lifetimeProfit = normalizeNonNegativeMoney(Number(group.lifetimeProfit || 0) + profit);
  group.lifetimeGoodsConsumed = Math.max(0, Math.floor(Number(group.lifetimeGoodsConsumed || 0) + goodsConsumed));
  group.participatingCount = 0;
  delete group.cycleStartedAt;
  delete group.cycleCompletesAt;
  delete group.pendingRevenue;
  delete group.pendingProfit;
  delete group.pendingGoodsConsumed;
  delete group.pendingOperatingCost;
  delete group.pendingInputValue;
  delete group.pendingInputs;
}

function processGroup(world, player, group, now) {
  const type = typeFor(group.commercialTypeId);
  if (!type) return;
  let cycles = 0;
  while (group.pendingRevenue > 0 && Number(group.cycleCompletesAt || Number.POSITIVE_INFINITY) <= now) {
    const completedAt = Number(group.cycleCompletesAt);
    settleCycle(player, group);
    cycles += 1;
    if (!group.enabled || cycles >= MAX_CATCH_UP_CYCLES) break;
    if (!startCycle(world, player, group, type, completedAt)) break;
  }
  if (group.pendingRevenue > 0) return;
  if (!group.enabled) {
    group.status = 'stopped';
    group.statusReason = 'manual';
    group.participatingCount = 0;
    return;
  }
  if (cycles < MAX_CATCH_UP_CYCLES) startCycle(world, player, group, type, now);
}

export function processCommercialWorld(world, now = Date.now()) {
  for (const player of Object.values(world.players || {})) {
    ensureCommercialPlayer(player, now);
    for (const group of player.commercialBuildingGroups) processGroup(world, player, group, now);
  }
  return world;
}

function buildCommercialBuilding(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  if (!player) return result(false, '玩家不存在');
  const type = typeFor(payload.commercialTypeId);
  if (!type) return result(false, '商业建筑类型不存在');
  const quantity = normalizePositiveInteger(payload.quantity ?? 1, MAX_BUILD_QUANTITY);
  if (!quantity) return result(false, `建造数量必须为 1 到 ${MAX_BUILD_QUANTITY} 的整数`);
  const totalCost = multiplyMoneyByInteger(type.buildCost, quantity);
  if (totalCost === null) return result(false, '建造资金超出系统可表示范围');
  if (player.credits < totalCost) return result(false, '建造资金不足');
  const provinceId = normalizeProvinceId(payload.provinceId);
  player.credits = roundInternalMoney(player.credits - totalCost) ?? 0;
  player.stats.systemSinks = normalizeNonNegativeMoney(Number(player.stats.systemSinks || 0) + totalCost);
  player.stats.commercialBuildingsConstructed = Math.max(
    0,
    Math.floor(Number(player.stats.commercialBuildingsConstructed || 0) + quantity),
  );
  const group = groupFor(player, type.id, provinceId, true, now);
  group.count += quantity;
  return result(true, `${quantity} 座${type.name}已建成，默认保持停止营业`);
}

function startCommercialBuilding(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!player || !type || !group || group.count < 1) return result(false, '商业建筑集群不存在');
  group.enabled = true;
  if (group.pendingRevenue > 0) return result(true, `${type.name}已保持营业，当前周期继续进行`);
  if (startCycle(world, player, group, type, now)) {
    return result(true, `${type.name}已开始营业，${group.participatingCount} 座建筑参与当前周期`);
  }
  return result(
    true,
    `${type.name}已开启自动营业，当前${group.statusReason === 'insufficient_funds' ? '运营资金不足' : '消费商品不足'}，条件满足后将自动恢复`,
  );
}

function stopCommercialBuilding(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!player || !type || !group) return result(false, '商业建筑集群不存在');
  group.enabled = false;
  if (group.pendingRevenue > 0) {
    return result(true, `${type.name}已关闭自动续营，当前已投入周期结算后停止`);
  }
  group.status = 'stopped';
  group.statusReason = 'manual';
  group.participatingCount = 0;
  return result(true, `${type.name}已停止营业`);
}

function setCommercialAutoOperation(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!group || group.count < 1) return result(false, '商业建筑集群不存在');
  const policy = normalizeCommercialAutoOperationPolicy(payload.policy);
  if (!policy) return result(false, '自动经营策略无效');
  group.autoOperationPolicy = policy;
  return result(true, policy.enabled ? '商业自动经营策略已保存' : '商业自动经营已关闭');
}

export function applyCommercialBuildingAction(world, user, payload = {}, now = Date.now()) {
  const operation = String(payload.operation || '');
  const userId = Number(user.id);
  ensureCommercialPlayer(world.players?.[String(userId)] || {}, now);
  if (operation === 'build') return buildCommercialBuilding(world, userId, payload, now);
  if (operation === 'start') return startCommercialBuilding(world, userId, payload, now);
  if (operation === 'stop') return stopCommercialBuilding(world, userId, payload, now);
  if (operation === 'auto-operation') return setCommercialAutoOperation(world, userId, payload, now);
  return result(false, '不支持的商业建筑操作');
}
