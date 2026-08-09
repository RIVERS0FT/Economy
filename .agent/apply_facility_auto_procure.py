from pathlib import Path

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    source = read(path)
    actual = source.count(old)
    if actual != count:
        raise RuntimeError(f'{path}: expected {count} occurrence(s), found {actual}: {old[:120]!r}')
    write(path, source.replace(old, new, count))


# Server: internal fill-or-kill commodity order support used only by the atomic build transaction.
replace(
    'server/src/domain.js',
    """  const total = multiplyMoneyByInteger(price, quantity);\n  if (total === null) return { ok: false, message: '订单总额超出系统可表示范围' };\n  if (findSelfCrossingOrder(world, {\n""",
    """  const total = multiplyMoneyByInteger(price, quantity);\n  if (total === null) return { ok: false, message: '订单总额超出系统可表示范围' };\n  const fillOrKill = payload.execution === 'fill-or-kill';\n  if (findSelfCrossingOrder(world, {\n""",
)
replace(
    'server/src/domain.js',
    """  world.orders ||= [];\n  if (countOpenOrdersForOwner(world, userId) >= core.ECONOMY_CONSTANTS.maxOpenOrders) {\n    return { ok: false, message: '未完成订单数量已达上限' };\n  }\n""",
    """  world.orders ||= [];\n  if (!fillOrKill && countOpenOrdersForOwner(world, userId) >= core.ECONOMY_CONSTANTS.maxOpenOrders) {\n    return { ok: false, message: '未完成订单数量已达上限' };\n  }\n""",
)
replace(
    'server/src/domain.js',
    """  balancedMarket.matchOrder(world, incoming, now);\n  if (incoming.status === 'filled') return { ok: true, message: '订单已全部成交' };\n  if (incoming.status === 'partial') return { ok: true, message: '订单已部分成交' };\n  return { ok: true, message: '订单已进入订单簿' };\n}\n\nexport function applyAction(world, user, action, payload = {}, now = Date.now()) {\n""",
    """  balancedMarket.matchOrder(world, incoming, now);\n  if (incoming.status === 'filled') return { ok: true, message: '订单已全部成交' };\n  if (fillOrKill) return { ok: false, message: '市场卖盘已变化，未能一次购齐' };\n  if (incoming.status === 'partial') return { ok: true, message: '订单已部分成交' };\n  return { ok: true, message: '订单已进入订单簿' };\n}\n\nexport function applyImmediateCommodityBuy(world, user, payload = {}, now = Date.now()) {\n  return applyCommodityOrder(world, user, {\n    ...payload,\n    assetKind: 'commodity',\n    side: 'buy',\n    execution: 'fill-or-kill',\n  }, now);\n}\n\nexport function applyAction(world, user, action, payload = {}, now = Date.now()) {\n""",
)

write('server/src/facility-auto-procure.js', r"""import {
  applyImmediateCommodityBuy,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from './domain.js';
import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  internalMoneyToMicros,
  microsToInternalMoney,
  multiplyMoneyByInteger,
  normalizePlayerMoneyInput,
} from './money.js';
import { createWarehouseUsage } from './warehouse.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function result(ok, message, extra = {}) {
  return { ok, message, ...extra };
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return Number.isSafeInteger(normalized) && normalized >= 1 && normalized <= max ? normalized : null;
}

function inventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function externalSellOrders(world, userId, productId) {
  return (world.orders || [])
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => (
      isOpenOrder(order)
      && orderKind(order) === 'commodity'
      && orderAssetId(order) === productId
      && order.side === 'sell'
      && !(order.ownerType === 'player' && Number(order.ownerId) === Number(userId))
    ))
    .sort((left, right) => (
      Number(left.order.price || 0) - Number(right.order.price || 0)
      || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
      || left.index - right.index
    ));
}

function quoteMaterial(world, userId, productId, quantity, priceCap) {
  const orders = externalSellOrders(world, userId, productId);
  const allAvailable = orders.reduce((sum, { order }) => sum + Math.max(0, Number(order.remaining || 0)), 0);
  const eligible = orders.filter(({ order }) => Number(order.price || 0) <= priceCap);
  const eligibleAvailable = eligible.reduce((sum, { order }) => sum + Math.max(0, Number(order.remaining || 0)), 0);
  if (eligibleAvailable < quantity) {
    return {
      ok: false,
      priceChanged: allAvailable >= quantity,
    };
  }

  let remaining = quantity;
  let totalMicros = 0n;
  const levels = [];
  for (const { order } of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(0, Number(order.remaining || 0)));
    if (!Number.isSafeInteger(take) || take <= 0) continue;
    const price = normalizePlayerMoneyInput(order.price, { min: 0.01 });
    if (typeof price !== 'number') return { ok: false, invalid: true };
    const lineTotal = multiplyMoneyByInteger(price, take);
    const lineMicros = internalMoneyToMicros(lineTotal);
    if (lineTotal === null || lineMicros === null) return { ok: false, invalid: true };
    totalMicros += lineMicros;
    const current = levels[levels.length - 1];
    if (current && current.price === price) current.quantity += take;
    else levels.push({ price, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) return { ok: false, invalid: true };
  return { ok: true, totalMicros, levels };
}

export function autoProcureFacilityBuildMaterials(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const player = world.players?.[String(userId)];
  const type = FACILITY_TYPES.get(String(payload.facilityTypeId || ''));
  if (!player) return result(false, '玩家状态不存在');
  if (!type) return result(false, '工厂类型不存在');
  const quantity = normalizePositiveInteger(payload.quantity ?? 1, 100);
  if (!quantity) return result(false, '建造数量必须为 1 到 100 的整数');
  if (!Array.isArray(type.buildInputs)) return result(false, '工厂建造材料目录无效');

  const missing = [];
  let missingQuantity = 0;
  for (const item of type.buildInputs) {
    const required = Number(item.quantity) * quantity;
    if (!Number.isSafeInteger(required) || required < 1) return result(false, '建造材料数量超出系统可表示范围');
    const productId = String(item.productId || '');
    const deficit = Math.max(0, required - Number(inventoryFor(player, productId).available || 0));
    if (deficit <= 0) continue;
    if (!Number.isSafeInteger(deficit) || !Number.isSafeInteger(missingQuantity + deficit)) {
      return result(false, '建造材料数量超出系统可表示范围');
    }
    missing.push({ productId, quantity: deficit });
    missingQuantity += deficit;
  }

  if (missing.length === 0) {
    return result(true, '建造材料库存充足，无需市场采购', {
      procurementTotal: 0,
      purchasedQuantity: 0,
    });
  }

  const maxProcurementTotal = normalizePlayerMoneyInput(payload.maxProcurementTotal, { min: 0.01 });
  if (typeof maxProcurementTotal !== 'number') return result(false, '一键采购总价保护无效，请刷新后重试');
  const maxProcurementMicros = internalMoneyToMicros(maxProcurementTotal);
  if (maxProcurementMicros === null) return result(false, '一键采购总价保护无效，请刷新后重试');
  const materialPriceCaps = payload.materialPriceCaps && typeof payload.materialPriceCaps === 'object'
    ? payload.materialPriceCaps
    : {};

  let expectedProcurementMicros = 0n;
  const plans = [];
  for (const item of missing) {
    const product = PRODUCTS.get(item.productId);
    const priceCap = normalizePlayerMoneyInput(materialPriceCaps[item.productId], { min: 0.01 });
    if (typeof priceCap !== 'number') {
      return result(false, `${product?.name || item.productId}采购价格保护无效，请刷新后重试`);
    }
    if (findSelfCrossingOrder(world, {
      ownerId: userId,
      assetKind: 'commodity',
      assetId: item.productId,
      side: 'buy',
      price: priceCap,
    })) return result(false, SELF_CROSS_MESSAGE);

    const quote = quoteMaterial(world, userId, item.productId, item.quantity, priceCap);
    if (!quote.ok) {
      if (quote.priceChanged) return result(false, `${product?.name || item.productId}市场价格已变化，请重新确认`);
      if (quote.invalid) return result(false, `${product?.name || item.productId}市场报价超出系统可表示范围`);
      return result(false, `${product?.name || item.productId}市场卖盘不足，无法一次购齐`);
    }
    expectedProcurementMicros += quote.totalMicros;
    plans.push({ productId: item.productId, levels: quote.levels });
  }

  if (expectedProcurementMicros > maxProcurementMicros) {
    return result(false, '市场价格已变化，预计采购总额超过确认上限，请重新确认');
  }

  const buildCost = multiplyMoneyByInteger(type.buildCost, quantity);
  const buildCostMicros = internalMoneyToMicros(buildCost);
  const creditsMicros = internalMoneyToMicros(player.credits);
  if (buildCost === null || buildCostMicros === null || creditsMicros === null) {
    return result(false, '建造与采购资金超出系统可表示范围');
  }
  if (creditsMicros < buildCostMicros + expectedProcurementMicros) {
    return result(false, '建造与采购总资金不足');
  }

  const warehouse = createWarehouseUsage(world, player);
  if (warehouse.warehouseAvailableCapacity < missingQuantity) {
    return result(false, `共享仓库空间不足，一键采购还需要 ${missingQuantity} 格临时交割空间`);
  }

  for (const plan of plans) {
    for (const level of plan.levels) {
      const purchase = applyImmediateCommodityBuy(world, user, {
        productId: plan.productId,
        quantity: level.quantity,
        price: level.price,
      }, now);
      if (!purchase?.ok) return result(false, purchase?.message || '市场卖盘已变化，未能一次购齐');
    }
  }

  const procurementTotal = microsToInternalMoney(expectedProcurementMicros);
  if (procurementTotal === null) return result(false, '一键采购总额超出系统可表示范围');
  return result(true, '建造材料已从统一市场一次购齐', {
    procurementTotal,
    purchasedQuantity: missingQuantity,
  });
}
""")

replace(
    'server/src/runtime-action-executor.js',
    """import { createEconomicActionBoundary, beginEconomicSavepoint } from './economic-mutation.js';\nimport { applyFacilityGroupAction } from './facility-groups.js';\n""",
    """import { createEconomicActionBoundary, beginEconomicSavepoint } from './economic-mutation.js';\nimport { autoProcureFacilityBuildMaterials } from './facility-auto-procure.js';\nimport { applyFacilityGroupAction } from './facility-groups.js';\n""",
)
replace(
    'server/src/runtime-action-executor.js',
    """    } else if (BANK_ACTIONS.has(action)) {\n      gameResult = applyBankAction(world, user, action, payload, now);\n    } else {\n      gameResult = applyFacilityGroupAction(world, user, action, payload, now);\n    }\n""",
    """    } else if (BANK_ACTIONS.has(action)) {\n      gameResult = applyBankAction(world, user, action, payload, now);\n    } else if (action === 'buildFacility' && payload.autoProcure === true) {\n      const procurement = autoProcureFacilityBuildMaterials(world, user, payload, now);\n      if (!procurement.ok) gameResult = procurement;\n      else {\n        gameResult = applyFacilityGroupAction(world, user, action, payload, now);\n        if (gameResult?.ok && procurement.purchasedQuantity > 0) {\n          gameResult.message = `${gameResult.message}；已一键购齐 ${procurement.purchasedQuantity} 件建造材料`;\n        }\n      }\n    } else {\n      gameResult = applyFacilityGroupAction(world, user, action, payload, now);\n    }\n""",
)

# Client quote utility: read current public order book without a second poll.
write('src/utils/facilityBuildProcurement.ts', r"""import type { AssetOrder } from '../types';
import { orderAssetId, orderKind } from './orderIdentity';

export interface FacilityBuildMaterialNeed {
  productId: string;
  quantity: number;
}

export interface FacilityBuildProcurementQuote {
  complete: boolean;
  estimatedTotal: number;
  missingQuantity: number;
  materialPriceCaps: Record<string, number>;
  unavailableProductIds: string[];
  selfCrossingProductIds: string[];
}

function priceCents(value: number) {
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 1 ? cents : null;
}

function openOrder(order: AssetOrder) {
  return order.status === 'open' || order.status === 'partial';
}

export function quoteFacilityBuildProcurement(
  orders: AssetOrder[],
  materialNeeds: FacilityBuildMaterialNeed[],
): FacilityBuildProcurementQuote {
  const needs = new Map<string, number>();
  for (const item of materialNeeds) {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (quantity <= 0) continue;
    needs.set(item.productId, (needs.get(item.productId) ?? 0) + quantity);
  }

  let totalCents = 0n;
  let missingQuantity = 0;
  const materialPriceCaps: Record<string, number> = {};
  const unavailableProductIds: string[] = [];
  const selfCrossingProductIds: string[] = [];

  for (const [productId, quantity] of needs) {
    missingQuantity += quantity;
    const asks = orders
      .map((order, index) => ({ order, index }))
      .filter(({ order }) => (
        openOrder(order)
        && orderKind(order) === 'commodity'
        && orderAssetId(order) === productId
        && order.side === 'sell'
        && !order.isOwn
      ))
      .sort((left, right) => (
        Number(left.order.price || 0) - Number(right.order.price || 0)
        || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
        || left.index - right.index
      ));

    let remaining = quantity;
    let capCents: number | null = null;
    for (const { order } of asks) {
      if (remaining <= 0) break;
      const cents = priceCents(order.price);
      if (cents === null) continue;
      const take = Math.min(remaining, Math.max(0, Math.floor(Number(order.remaining || 0))));
      if (take <= 0) continue;
      totalCents += BigInt(cents) * BigInt(take);
      capCents = cents;
      remaining -= take;
    }

    if (remaining > 0 || capCents === null) {
      unavailableProductIds.push(productId);
      continue;
    }
    materialPriceCaps[productId] = capCents / 100;

    const crossesOwnOrder = orders.some((order) => {
      if (!order.isOwn || !openOrder(order) || order.side !== 'sell') return false;
      if (orderKind(order) !== 'commodity' || orderAssetId(order) !== productId) return false;
      const cents = priceCents(order.price);
      return cents !== null && cents <= capCents;
    });
    if (crossesOwnOrder) selfCrossingProductIds.push(productId);
  }

  const numericTotalCents = Number(totalCents);
  const safeTotal = Number.isSafeInteger(numericTotalCents);
  return {
    complete: unavailableProductIds.length === 0 && safeTotal,
    estimatedTotal: safeTotal ? numericTotalCents / 100 : 0,
    missingQuantity,
    materialPriceCaps,
    unavailableProductIds,
    selfCrossingProductIds,
  };
}
""")

replace(
    'src/api/game.ts',
    """export interface GameActionResponse {\n  result: GameActionResult;\n  revision: number;\n}\n""",
    """export interface GameActionResponse {\n  result: GameActionResult;\n  revision: number;\n}\nexport interface FacilityBuildProcurementOptions {\n  autoProcure: true;\n  maxProcurementTotal: number;\n  materialPriceCaps: Record<string, number>;\n}\n""",
)
replace(
    'src/api/game.ts',
    """  buildFacility: (facilityTypeId: string, quantity = 1) => postAction('/facilities', { facilityTypeId, quantity }),\n""",
    """  buildFacility: (facilityTypeId: string, quantity = 1, procurement?: FacilityBuildProcurementOptions) => (\n    postAction('/facilities', { facilityTypeId, quantity, ...procurement })\n  ),\n""",
)

replace(
    'src/app/gameViewModel.ts',
    """  type GameActionResponse,\n  type GameActionResult,\n} from '../api/game';\n""",
    """  type FacilityBuildProcurementOptions,\n  type GameActionResponse,\n  type GameActionResult,\n} from '../api/game';\n""",
)
replace(
    'src/app/gameViewModel.ts',
    """  buildFacility: (facilityTypeId: string, quantity?: number) => Promise<ActionResult>;\n""",
    """  buildFacility: (facilityTypeId: string, quantity?: number, procurement?: FacilityBuildProcurementOptions) => Promise<ActionResult>;\n""",
)
replace(
    'src/app/gameViewModel.ts',
    """    buildFacility: (facilityTypeId, quantity = 1) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId, quantity)),\n""",
    """    buildFacility: (facilityTypeId, quantity = 1, procurement) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId, quantity, procurement)),\n""",
)

replace(
    'src/app/GameApp.tsx',
    """    buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1) => {\n      const result = await model.buildFacility(facilityTypeId, quantity);\n""",
    """    buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1, procurement) => {\n      const result = await model.buildFacility(facilityTypeId, quantity, procurement);\n""",
)

replace(
    'src/pages/ProductionPage.tsx',
    """import { formatCurrency, formatNumber } from '../utils/formatters';\n""",
    """import { quoteFacilityBuildProcurement } from '../utils/facilityBuildProcurement';\nimport { formatCurrency, formatNumber } from '../utils/formatters';\n""",
)
replace(
    'src/pages/ProductionPage.tsx',
    """  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];\n  const selectedBuildInputs = selectedType.buildInputs ?? [];\n  const maxBuildable = Math.max(0, Math.min(\n    100,\n    Math.floor(game.credits / Math.max(1, selectedType.buildCost)),\n    ...selectedBuildInputs.map((item) => Math.floor(\n      (game.inventories[item.productId]?.available ?? 0) / Math.max(1, item.quantity),\n    )),\n  ));\n""",
    """  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];\n  const selectedBuildInputs = selectedType.buildInputs ?? [];\n  const buildCashCost = selectedType.buildCost * buildQuantity;\n  const buildMaterialRequirements = selectedBuildInputs.map((item) => {\n    const available = game.inventories[item.productId]?.available ?? 0;\n    const required = item.quantity * buildQuantity;\n    return {\n      productId: item.productId,\n      available,\n      required,\n      missing: Math.max(0, required - available),\n    };\n  });\n  const missingBuildMaterials = buildMaterialRequirements\n    .filter((item) => item.missing > 0)\n    .map((item) => ({ productId: item.productId, quantity: item.missing }));\n  const procurementQuote = quoteFacilityBuildProcurement(game.orders, missingBuildMaterials);\n  const needsProcurement = procurementQuote.missingQuantity > 0;\n  const estimatedTotalSpend = buildCashCost + procurementQuote.estimatedTotal;\n  const inventoryBuildable = Math.max(0, Math.min(\n    100,\n    Math.floor(game.credits / Math.max(1, selectedType.buildCost)),\n    ...selectedBuildInputs.map((item) => Math.floor(\n      (game.inventories[item.productId]?.available ?? 0) / Math.max(1, item.quantity),\n    )),\n  ));\n  const productName = (productId: string) => (\n    game.products.find((candidate) => candidate.id === productId)?.name ?? productId\n  );\n  const buildDisabledReason = game.credits < buildCashCost\n    ? `建造资金不足，还需要 ${formatCurrency(buildCashCost - game.credits)}。`\n    : needsProcurement && !procurementQuote.complete\n      ? `${procurementQuote.unavailableProductIds.map(productName).join('、') || '建造材料'}市场卖盘不足，无法一次购齐。`\n      : needsProcurement && procurementQuote.selfCrossingProductIds.length > 0\n        ? `${procurementQuote.selfCrossingProductIds.map(productName).join('、')}存在自己的交叉卖单，请先撤单。`\n        : needsProcurement && game.warehouseAvailableCapacity < procurementQuote.missingQuantity\n          ? `共享仓库空间不足，一键采购需要 ${formatNumber(procurementQuote.missingQuantity)} 格临时交割空间。`\n          : needsProcurement && game.credits < estimatedTotalSpend\n            ? `建造与采购总资金不足，预计需要 ${formatCurrency(estimatedTotalSpend)}。`\n            : undefined;\n""",
)
replace(
    'src/pages/ProductionPage.tsx',
    """  const openProductContracts = (productId: string) => {\n    setContractMarketIntent(productId);\n    model.setTab('contracts');\n  };\n\n  return (\n""",
    """  const openProductContracts = (productId: string) => {\n    setContractMarketIntent(productId);\n    model.setTab('contracts');\n  };\n  const submitBuild = () => {\n    if (buildDisabledReason) return;\n    if (!needsProcurement) {\n      void showResult(buildFacility(selectedType.id, buildQuantity));\n      return;\n    }\n    void showResult(buildFacility(selectedType.id, buildQuantity, {\n      autoProcure: true,\n      maxProcurementTotal: procurementQuote.estimatedTotal,\n      materialPriceCaps: procurementQuote.materialPriceCaps,\n    }));\n  };\n\n  return (\n""",
)
replace(
    'src/pages/ProductionPage.tsx',
    """            {selectedBuildInputs.length === 0 ? (\n              <DataRow label=\"建造材料\" value=\"无需材料\" />\n            ) : selectedBuildInputs.map((item) => {\n              const product = game.products.find((candidate) => candidate.id === item.productId);\n              const available = game.inventories[item.productId]?.available ?? 0;\n              const required = item.quantity * buildQuantity;\n              return (\n                <DataRow\n                  key={item.productId}\n                  label={product?.name ?? item.productId}\n                  value={`${formatNumber(required)} / 库存 ${formatNumber(available)}`}\n                  tone={available >= required ? 'neutral' : 'danger'}\n                />\n              );\n            })}\n            <DataRow label=\"最多可建\" value={`${formatNumber(maxBuildable)} 座`} />\n          </DataList>\n          <Button\n            block\n            onClick={() => void showResult(buildFacility(selectedType.id, buildQuantity))}\n            disabled={buildQuantity > maxBuildable}\n          >\n            {buildQuantity === 1 ? `立即建造${selectedType.name}` : `立即建造 ${buildQuantity} 座${selectedType.name}`}\n          </Button>\n          <small className=\"ui-helper-text\">提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</small>\n""",
    """            {selectedBuildInputs.length === 0 ? (\n              <DataRow label=\"建造材料\" value=\"无需材料\" />\n            ) : buildMaterialRequirements.map((item) => (\n              <DataRow\n                key={item.productId}\n                label={productName(item.productId)}\n                value={item.missing > 0\n                  ? `${formatNumber(item.required)} / 库存 ${formatNumber(item.available)} · 缺 ${formatNumber(item.missing)}`\n                  : `${formatNumber(item.required)} / 库存 ${formatNumber(item.available)}`}\n                tone={item.missing > 0 ? 'danger' : 'neutral'}\n              />\n            ))}\n            <DataRow label=\"库存可直接建\" value={`${formatNumber(inventoryBuildable)} 座`} />\n            {needsProcurement ? (\n              <DataRow\n                label=\"预计采购\"\n                value={procurementQuote.complete\n                  ? <CurrencyAmount>{formatCurrency(procurementQuote.estimatedTotal)}</CurrencyAmount>\n                  : '卖盘不足'}\n                tone={procurementQuote.complete ? 'neutral' : 'danger'}\n              />\n            ) : null}\n            {needsProcurement && procurementQuote.complete ? (\n              <DataRow\n                label=\"预计总支出\"\n                value={<CurrencyAmount>{formatCurrency(estimatedTotalSpend)}</CurrencyAmount>}\n                tone={game.credits >= estimatedTotalSpend ? 'neutral' : 'danger'}\n              />\n            ) : null}\n          </DataList>\n          <Button\n            block\n            onClick={submitBuild}\n            disabled={Boolean(buildDisabledReason)}\n          >\n            {needsProcurement\n              ? buildQuantity === 1\n                ? `一键购齐并建造${selectedType.name}`\n                : `一键购齐并建造 ${buildQuantity} 座${selectedType.name}`\n              : buildQuantity === 1\n                ? `立即建造${selectedType.name}`\n                : `立即建造 ${buildQuantity} 座${selectedType.name}`}\n          </Button>\n          <small className=\"ui-helper-text\">\n            {buildDisabledReason ?? (needsProcurement\n              ? '提交时服务器按当前卖盘价格上限一次购齐缺料；任一材料不足或价格超限时整笔采购与建造全部回滚。'\n              : <>提交后立即扣除{selectedBuildInputs.length === 0 ? '建造资金' : '资金与建造材料'}，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</>)}\n          </small>\n""",
)

# Server regression tests.
replace(
    'server/test/instant-facility-construction.test.js',
    """const user = { id: 91, email: 'builder@example.com', name: '建设玩家', role: 'user' };\n\nfunction prepareStore(now) {\n""",
    """const user = { id: 91, email: 'builder@example.com', name: '建设玩家', role: 'user' };\nconst seller = { id: 92, email: 'supplier@example.com', name: '材料供应商', role: 'user' };\n\nfunction prepareStore(now) {\n""",
)
replace(
    'server/test/instant-facility-construction.test.js',
    """function prepareStore(now) {\n  const store = new EconomyStore(':memory:');\n  store.getState(user, now);\n  const loaded = store.loadWorld(now + 1);\n  const player = loaded.world.players[String(user.id)];\n  player.credits = 100_000;\n  for (const inventory of Object.values(player.inventories)) inventory.available = 10_000;\n  store.saveWorld(loaded.revision, loaded.world, now + 1);\n  return store;\n}\n\n\n""",
    """function prepareStore(now) {\n  const store = new EconomyStore(':memory:');\n  store.getState(user, now);\n  const loaded = store.loadWorld(now + 1);\n  const player = loaded.world.players[String(user.id)];\n  player.credits = 100_000;\n  for (const inventory of Object.values(player.inventories)) inventory.available = 10_000;\n  store.saveWorld(loaded.revision, loaded.world, now + 1);\n  return store;\n}\n\nfunction prepareProcurementStore(now, { warehouseFill = 0 } = {}) {\n  const store = new EconomyStore(':memory:');\n  store.getState(user, now);\n  store.getState(seller, now + 1);\n  const loaded = store.loadWorld(now + 2);\n  const buyer = loaded.world.players[String(user.id)];\n  const supplier = loaded.world.players[String(seller.id)];\n  buyer.credits = 100_000;\n  supplier.credits = 1_000;\n  for (const inventory of Object.values(buyer.inventories)) {\n    inventory.available = 0;\n    inventory.frozen = 0;\n  }\n  for (const inventory of Object.values(supplier.inventories)) {\n    inventory.available = 0;\n    inventory.frozen = 0;\n  }\n  buyer.inventoryCapacity = 500;\n  if (warehouseFill > 0) buyer.inventories.wheat.available = warehouseFill;\n  store.saveWorld(loaded.revision, loaded.world, now + 2);\n  return store;\n}\n\nfunction placeMaterialSell(store, productId, quantity, price, requestKey, now) {\n  const loaded = store.loadWorld(now);\n  loaded.world.players[String(seller.id)].inventories[productId].available = quantity;\n  store.saveWorld(loaded.revision, loaded.world, now);\n  return store.apply(seller, {\n    action: 'placeOrder',\n    payload: { assetKind: 'commodity', assetId: productId, productId, side: 'sell', quantity, price },\n    requestKey,\n    method: 'POST',\n    path: '/api/game/orders',\n  }, now + 1);\n}\n\n\n""",
)
replace(
    'server/test/instant-facility-construction.test.js',
    """test('legacy construction migrates to one completed facility without charging materials again', () => {\n""",
    r"""test('one-click construction buys every missing material from the real order book and stays idempotent', () => {
  const now = 1_700_150_000_000;
  const store = prepareProcurementStore(now);
  try {
    assert.equal(placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0001', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0002', now + 20).result.ok, true);
    const before = store.getState(user, now + 30);
    const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
    const request = {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch',
        quantity: 1,
        autoProcure: true,
        maxProcurementTotal: 32,
        materialPriceCaps: { timber: 6, ore: 7 },
      },
      requestKey: 'instant-build-procure-0001',
      method: 'POST',
      path: '/api/game/facilities',
    };
    const first = store.apply(user, request, now + 31);
    const repeated = store.apply(user, request, now + 32);
    assert.deepEqual(repeated, first, '一键采购建造的幂等重试不得重复采购或建厂');
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /一键购齐 5 件建造材料/);

    const after = store.getState(user, now + 33);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch')?.count, 1);
    assert.equal(after.credits, before.credits - ranch.buildCost - 32);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    const procurementOrders = after.orders.filter((order) => (
      order.isOwn && order.assetKind === 'commodity' && order.status === 'filled'
    ));
    assert.equal(procurementOrders.reduce((sum, order) => sum + order.quantity, 0), 5);
    assert.equal(after.markets.timber.lastTradePrice, 6);
    assert.equal(after.markets.ore.lastTradePrice, 7);
  } finally {
    store.close();
  }
});

test('one-click construction rolls back completely when market depth cannot fill every missing material', () => {
  const now = 1_700_160_000_000;
  const store = prepareProcurementStore(now);
  try {
    assert.equal(placeMaterialSell(store, 'timber', 2, 6, 'material-sell-0011', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0012', now + 20).result.ok, true);
    const beforeBuyer = store.getState(user, now + 30);
    const beforeSeller = store.getState(seller, now + 30);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 100, materialPriceCaps: { timber: 10, ore: 10 },
      },
      requestKey: 'instant-build-procure-0002', method: 'POST', path: '/api/game/facilities',
    }, now + 31);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /木材市场卖盘不足/);
    const afterBuyer = store.getState(user, now + 32);
    const afterSeller = store.getState(seller, now + 32);
    assert.equal(afterBuyer.credits, beforeBuyer.credits);
    assert.equal(afterBuyer.inventories.timber.available, 0);
    assert.equal(afterBuyer.inventories.ore.available, 0);
    assert.equal(afterBuyer.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(afterSeller.inventories.timber.frozen, beforeSeller.inventories.timber.frozen);
    assert.equal(afterSeller.inventories.ore.frozen, beforeSeller.inventories.ore.frozen);
  } finally {
    store.close();
  }
});

test('one-click construction rejects stale price protection without buying anything', () => {
  const now = 1_700_170_000_000;
  const store = prepareProcurementStore(now);
  try {
    assert.equal(placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0021', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0022', now + 20).result.ok, true);
    const before = store.getState(user, now + 30);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 32, materialPriceCaps: { timber: 5.99, ore: 7 },
      },
      requestKey: 'instant-build-procure-0003', method: 'POST', path: '/api/game/facilities',
    }, now + 31);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /木材市场价格已变化/);
    const after = store.getState(user, now + 32);
    assert.equal(after.credits, before.credits);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
  } finally {
    store.close();
  }
});

test('one-click construction still requires warehouse space for market delivery', () => {
  const now = 1_700_180_000_000;
  const store = prepareProcurementStore(now, { warehouseFill: 499 });
  try {
    assert.equal(placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0031', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0032', now + 20).result.ok, true);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 32, materialPriceCaps: { timber: 6, ore: 7 },
      },
      requestKey: 'instant-build-procure-0004', method: 'POST', path: '/api/game/facilities',
    }, now + 31);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /共享仓库空间不足/);
    const after = store.getState(user, now + 32);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(after.inventories.wheat.available, 499);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
  } finally {
    store.close();
  }
});

test('legacy construction migrates to one completed facility without charging materials again', () => {
""",
)

# Existing isolation verifier must keep the expanded build form signature exact.
replace(
    'scripts/verify-form-state-isolation.mjs',
    """  'buildFacility: (facilityTypeId: string, quantity?: number) => Promise<ActionResult>;',\n""",
    """  'buildFacility: (facilityTypeId: string, quantity?: number, procurement?: FacilityBuildProcurementOptions) => Promise<ActionResult>;',\n""",
)
replace(
    'scripts/verify-form-state-isolation.mjs',
    """  \"buildFacility: (facilityTypeId, quantity = 1) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId, quantity))\",\n""",
    """  \"buildFacility: (facilityTypeId, quantity = 1, procurement) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId, quantity, procurement))\",\n""",
)
replace(
    'scripts/verify-form-state-isolation.mjs',
    """  'buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1) => {',\n""",
    """  'buildFacility: async (facilityTypeId = model.selectedFacilityTypeId, quantity = 1, procurement) => {',\n""",
)
replace(
    'scripts/verify-form-state-isolation.mjs',
    """  'const result = await model.buildFacility(facilityTypeId, quantity);',\n""",
    """  'const result = await model.buildFacility(facilityTypeId, quantity, procurement);',\n""",
)

replace(
    'scripts/verify-authoritative-countdowns.mjs',
    """    'label=\"最多可建\"',\n""",
    """    'label=\"库存可直接建\"',\n""",
)

write('scripts/verify-facility-auto-procure.mjs', r"""import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const requireText = (relativePath, text) => {
  if (!read(relativePath).includes(text)) failures.push(`${relativePath} 缺少：${text}`);
};

for (const [file, texts] of Object.entries({
  'server/src/facility-auto-procure.js': [
    'autoProcureFacilityBuildMaterials',
    'materialPriceCaps',
    'maxProcurementTotal',
    'createWarehouseUsage(world, player)',
    'findSelfCrossingOrder',
    'applyImmediateCommodityBuy',
    '市场卖盘不足，无法一次购齐',
  ],
  'server/src/domain.js': [
    "payload.execution === 'fill-or-kill'",
    '!fillOrKill && countOpenOrdersForOwner',
    'export function applyImmediateCommodityBuy',
    '市场卖盘已变化，未能一次购齐',
  ],
  'server/src/runtime-action-executor.js': [
    "action === 'buildFacility' && payload.autoProcure === true",
    'autoProcureFacilityBuildMaterials(world, user, payload, now)',
    '已一键购齐 ${procurement.purchasedQuantity} 件建造材料',
  ],
  'src/api/game.ts': [
    'export interface FacilityBuildProcurementOptions',
    'maxProcurementTotal: number;',
    'materialPriceCaps: Record<string, number>;',
    "postAction('/facilities', { facilityTypeId, quantity, ...procurement })",
  ],
  'src/utils/facilityBuildProcurement.ts': [
    'quoteFacilityBuildProcurement',
    'selfCrossingProductIds',
    'materialPriceCaps',
  ],
  'src/pages/ProductionPage.tsx': [
    'quoteFacilityBuildProcurement(game.orders, missingBuildMaterials)',
    'label="库存可直接建"',
    'label="预计采购"',
    'label="预计总支出"',
    '一键购齐并建造',
    'autoProcure: true',
    'maxProcurementTotal: procurementQuote.estimatedTotal',
    'materialPriceCaps: procurementQuote.materialPriceCaps',
  ],
  'server/test/instant-facility-construction.test.js': [
    'buys every missing material from the real order book and stays idempotent',
    'rolls back completely when market depth cannot fill every missing material',
    'rejects stale price protection without buying anything',
    'still requires warehouse space for market delivery',
  ],
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md': ['一键购齐并建造', '全部采购与建设一起回滚'],
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md': ['建厂一键购料', 'Fill-or-Kill'],
  'docs/WAREHOUSE_EXPANSION_DESIGN.md': ['一键购齐建造材料', '临时交割空间'],
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md': ['库存可直接建', '一键购齐并建造'],
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md': ['facility-auto-procure.js', 'maxProcurementTotal', 'materialPriceCaps'],
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md': ['一键购齐并建造仍属于即时建设'],
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md': ['一键购齐并建造不会产生施工任务'],
  'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md': ['一键购齐并建造同样不注册施工截止时间'],
  'docs/README.md': ['缺料时允许在同一建造事务内执行真实统一订单簿 FOK 采购'],
  'README.md': ['缺料时可一键从真实统一订单簿购齐后建造'],
})) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`缺少文件：${file}`);
    continue;
  }
  for (const text of texts) requireText(file, text);
}

requireText('package.json', '"verify:facility-auto-procure": "node scripts/verify-facility-auto-procure.mjs"');
requireText('package.json', 'npm run verify:facility-auto-procure');

if (failures.length > 0) {
  for (const failure of failures) console.error(`facility auto-procure verification failed: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('facility one-click procurement verification passed');
}
""")

replace(
    'package.json',
    """    \"verify:form-state-isolation\": \"node scripts/verify-form-state-isolation.mjs\",\n""",
    """    \"verify:form-state-isolation\": \"node scripts/verify-form-state-isolation.mjs\",\n    \"verify:facility-auto-procure\": \"node scripts/verify-facility-auto-procure.mjs\",\n""",
)
replace(
    'package.json',
    """node scripts/verify-warehouse-expansion.mjs && npm run verify:research && node scripts/verify-facility-groups.mjs""",
    """node scripts/verify-warehouse-expansion.mjs && npm run verify:research && npm run verify:facility-auto-procure && node scripts/verify-facility-groups.mjs""",
)

# Authoritative documents. Keep existing ownership boundaries and only amend the current rules.
for path in [
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    'docs/README.md',
]:
    replace(path, '> 更新时间：2026-08-08', '> 更新时间：2026-08-09')
for path in [
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]:
    replace(path, '> 更新时间：2026-08-06', '> 更新时间：2026-08-09')
for path in [
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
    'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
]:
    replace(path, '> 更新时间：2026-08-07', '> 更新时间：2026-08-09')

replace(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    """- 工厂建设不创建施工任务、施工队列或工厂实例；资金和该类型适用的正式商品建造材料在一个幂等事务中扣除后立即增加集群数量。农场与果园只扣建造资金，其他工厂继续扣除目录材料。\n""",
    """- 工厂建设不创建施工任务、施工队列或工厂实例；资金和该类型适用的正式商品建造材料在一个幂等事务中扣除后立即增加集群数量。农场与果园只扣建造资金，其他工厂继续扣除目录材料。\n- “一键购齐并建造”只补足当前库存缺少的正式 `buildInputs`：服务器必须在同一建造事务中按真实统一商品订单簿执行 Fill-or-Kill 采购，遵守价格优先、同价时间优先、maker price、玩家卖出手续费、自成交阻断和市场储备真实库存；客户端提交逐材料最高接受价与采购总额上限，任一材料无法在上限内一次购齐、资金或仓库不足、报价失效或随后建设失败时，全部采购与建设一起回滚，不留下未完成买单，也不得创建系统材料商店或绕过正常资产守恒。\n""",
)

replace(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    """- 所有写操作使用 `Idempotency-Key`。\n""",
    """- 所有写操作使用 `Idempotency-Key`。\n- 建厂一键购料属于现有商品订单簿的事务内 `Fill-or-Kill`（FOK）买入，不是系统商店：只采购建设所缺数量，按当前真实卖盘价格优先／同价时间优先逐档成交并继续使用 maker price、玩家卖出手续费、普通成交记录与市场储备真实库存。客户端必须提交逐材料价格上限与本次采购总额上限；服务器重新预扫盘口，价格下降按更低真实成交价执行，任一材料深度不足、价格超过上限、自成交、资金／仓库不足或最终建设失败时整个组合事务回滚。FOK 建材买单经过完整预检后必须在本事务全部成交并立即关闭，因此不占“同时未完成订单”数量上限，但其已完成订单与 fills 仍按普通真实交易保留。\n""",
)

replace(
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    """- 商品买单、商品拍卖最高出价和进行中采购合同的下一批商品预占容量；捆绑拍卖按资产包中全部商品数量之和预占，工厂买单和工厂拍卖不预占仓库。\n""",
    """- 商品买单、商品拍卖最高出价和进行中采购合同的下一批商品预占容量；捆绑拍卖按资产包中全部商品数量之和预占，工厂买单和工厂拍卖不预占仓库。\n- 一键购齐建造材料仍必须经过共享仓库交割：服务器在组合事务开始前确认当前 `warehouseAvailableCapacity` 足以容纳全部缺料数量，成交后商品先成为真实库存，再由同一事务的建造步骤消耗；即时消耗不得被解释为可以绕过仓库容量。\n""",
)
replace(
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    """部分成交后，已成交商品从预占转为实物库存；未成交部分继续预占。撤单释放剩余预占。\n""",
    """部分成交后，已成交商品从预占转为实物库存；未成交部分继续预占。撤单释放剩余预占。建厂一键采购不形成持续预占：提交前必须以全部缺料数量检查临时交割空间，事务内 FOK 全部成交后立即转为实物库存并由建设消耗；若空间不足则在任何成交前拒绝。\n""",
)

replace(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    """- 建设工厂类型和数量只属于生产页建设表单；目录变化时只在自身候选目录内合法化。建设动作必须显式提交表单当前选择的 `facilityTypeId` 与 `quantity`，所有教程、通知或页面包装层必须原样透传两者，不得通过默认值、可选参数或其他页面状态隐式回退。农场和果园的空 `buildInputs` 必须显示“无需材料”，最多可建数量只受资金与单次 100 座上限约束。\n""",
    """- 建设工厂类型、数量和一键采购报价只属于生产页建设表单；目录变化时只在自身候选目录内合法化。建设动作必须显式提交表单当前选择的 `facilityTypeId` 与 `quantity`，所有教程、通知或页面包装层必须原样透传两者以及可选采购保护参数，不得通过默认值、其他页面状态或刷新结果隐式回退。农场和果园的空 `buildInputs` 必须显示“无需材料”；其他工厂逐项显示需求、库存与缺口，并把原“最多可建”改为“库存可直接建”。存在缺料时复用当前五秒权威状态中已经返回的公开订单簿计算“预计采购／预计总支出”，不得新增报价轮询；只有全部缺料可在真实卖盘中购齐时显示可用的“一键购齐并建造”，提交 `autoProcure=true`、逐材料最高接受价和采购总额上限，服务器报价失效时拒绝并要求重新确认。\n""",
)

replace(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    """- `facility-groups.js`：工厂集群、统一周期、配方切换和工厂订单适配；\n""",
    """- `facility-groups.js`：工厂集群、统一周期、配方切换和工厂订单适配；\n- `facility-auto-procure.js`：即时建厂缺料预检、真实商品卖盘价格保护、仓库／资金校验和事务内 FOK 采购编排；\n""",
)
replace(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    """| POST | `/api/game/facilities` | 建设工厂 |\n""",
    """| POST | `/api/game/facilities` | 建设工厂；可选在同一事务内 FOK 购齐缺少的正式建造材料 |\n""",
)
replace(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    """`POST /api/game/facilities` 接受 `facilityTypeId` 与可选 `quantity`（1～100）。服务器必须在同一幂等写事务中校验科技准入、现金、全部 `buildInputs` 可用库存和安全乘法；任一失败时完全回滚。成功时扣除现金与材料、将现金记入人口建造业就业收入、增加材料消耗统计并立即扩充同类集群。`POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得进入经济写事务或写入新的施工宝石审计。\n""",
    """`POST /api/game/facilities` 接受 `facilityTypeId` 与可选 `quantity`（1～100）；省略 `autoProcure` 时保持原有“库存齐全才建设”行为。缺料时客户端可以提交 `autoProcure = true`、`materialPriceCaps: Record<productId, price>` 与 `maxProcurementTotal`。服务器必须在同一幂等写事务和经济回滚边界中先计算真实库存缺口，再按统一商品订单簿重新预扫非本人卖盘；只有全部缺口都能在逐材料价格上限内一次成交、当前仓库临时交割空间足够且“建造费 + 当前真实采购额”可支付时，才按价格档位执行内部 Fill-or-Kill 买入。价格下降按当前更低 maker price 成交，盘口深度、逐材料价格或采购总额任一超过客户端确认边界时拒绝。内部 FOK 买单因预检保证本事务关闭，可跳过普通玩家“同时未完成订单”数量上限，但不得跳过自成交检查、仓库、资金、手续费、成交记录、市场储备和订单簿撮合规则。全部买入完成后复用既有即时建设逻辑扣除材料与建造资金；采购、卖方结算、市场记录或建设任一步失败都通过同一 SQLite savepoint 与世界快照完全回滚，不留下部分材料、部分卖方结算或未完成订单。`POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得进入经济写事务或写入新的施工宝石审计。\n""",
)

replace(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    """新玩家不再获得首座工厂建造材料包。农场与果园按正式产业目录只消耗建造资金，其余工厂继续按目录同时消耗资金与正式商品建造材料；即时建设、批量数量和原子扣除规则以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。既有玩家历史库存不因材料包退役而回收或改写。\n""",
    """新玩家不再获得首座工厂建造材料包。农场与果园按正式产业目录只消耗建造资金，其余工厂继续按目录同时消耗资金与正式商品建造材料；即时建设、批量数量和原子扣除规则以 `INDUSTRY_AND_PRODUCTION_DESIGN.md` 为准。缺料时的“一键购齐并建造”仍属于即时建设，只把真实统一订单簿中成交的正式商品补入玩家库存后在同一事务消耗，不发行商品、不提供系统固定价材料，也不改变工厂成本。既有玩家历史库存不因材料包退役而回收或改写。\n""",
)

replace(
    'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
    """工厂建设已经改为资金与正式商品材料原子扣除后即时建成，不再产生施工任务、施工时间或完成截止时间。“建设新工厂”卡不得显示宝石加速。旧接口 `POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得扣除宝石或改变资产。\n""",
    """工厂建设已经改为资金与正式商品材料原子扣除后即时建成，不再产生施工任务、施工时间或完成截止时间。“建设新工厂”卡不得显示宝石加速。缺料时“一键购齐并建造不会产生施工任务”，只是同一即时建设事务内先按真实订单簿购齐材料；不得以该入口恢复宝石施工加速或宝石购买建材。旧接口 `POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得扣除宝石或改变资产。\n""",
)

replace(
    'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
    """工厂即时建设不注册权威倒计时；建设按钮只在当前建设写请求处理中或资源条件不满足时禁用，服务器动作成功后通过正式状态同步直接反映现金、材料库存和工厂集群数量变化，不得等待或恢复 `facilityConstruction`。研发卡在归零后显示“确认研发完成中…”并保持冲突操作禁用，直到服务器把对应科技加入已完成集合并删除 `research.active`。即使某次普通轮询、动作后状态补拉或代理连接未返回，8 秒超时也必须释放请求协调状态，使下一次权威确认能够继续执行。\n""",
    """工厂即时建设不注册权威倒计时；“一键购齐并建造同样不注册施工截止时间”，市场采购与材料消耗必须在一次建设写事务内立即完成或整体失败。建设按钮只在当前建设写请求处理中或资源条件不满足时禁用，服务器动作成功后通过正式状态同步直接反映现金、材料库存和工厂集群数量变化，不得等待或恢复 `facilityConstruction`。研发卡在归零后显示“确认研发完成中…”并保持冲突操作禁用，直到服务器把对应科技加入已完成集合并删除 `research.active`。即使某次普通轮询、动作后状态补拉或代理连接未返回，8 秒超时也必须释放请求协调状态，使下一次权威确认能够继续执行。\n""",
)

replace(
    'docs/README.md',
    """工厂建设以服务器正式目录的 `buildCost + buildInputs` 为唯一成本；在一个幂等事务中原子扣除资金和材料、一次性记入建造业就业收入并立即增加同类集群数量。农场和果园当前按正式目录不消耗建造材料，其他工厂使用各自正式 `buildInputs`；不得恢复施工时间、施工任务、施工队列、施工倒计时或工厂宝石加速。历史 `economy_facility_gem_actions` 仅保留只读审计，不得恢复 INSERT 写路径；旧 `POST /api/game/facilities/construction/accelerate` 必须继续在进入经济事务前返回 `410 Gone`。规则变更必须同步更新产业、产品、页面、服务器、宝石与权威倒计时文档，以及目录、宝石、倒计时和服务器测试。\n""",
    """工厂建设以服务器正式目录的 `buildCost + buildInputs` 为唯一成本；在一个幂等事务中原子扣除资金和材料、一次性记入建造业就业收入并立即增加同类集群数量。农场和果园当前按正式目录不消耗建造材料，其他工厂使用各自正式 `buildInputs`；缺料时允许在同一建造事务内执行真实统一订单簿 FOK 采购，但必须保留逐材料价格保护、采购总额保护、自成交阻断、卖方手续费、仓库临时交割与全事务回滚，不得创建系统材料商店、持续建材买单或绕过市场资产守恒。不得恢复施工时间、施工任务、施工队列、施工倒计时或工厂宝石加速。历史 `economy_facility_gem_actions` 仅保留只读审计，不得恢复 INSERT 写路径；旧 `POST /api/game/facilities/construction/accelerate` 必须继续在进入经济事务前返回 `410 Gone`。规则变更必须同步更新产业、产品、订单簿、仓库、页面、服务器、宝石与权威倒计时文档，以及一键采购、目录、宝石、倒计时和服务器测试。\n""",
)

replace(
    'README.md',
    """工厂即时建成；农场与果园只支付现金，其他工厂支付现金与正式商品材料。服务端按所选 1～100 座数量原子校验和扣除全部成本，运行中的同类集群保持生产进度并按扩容规则重新计算满员率。工厂施工时间和施工宝石加速已经退役。\n""",
    """工厂即时建成；农场与果园只支付现金，其他工厂支付现金与正式商品材料。缺料时可一键从真实统一订单簿购齐后建造：客户端锁定逐材料最高接受价与预计采购总额，服务端在同一事务按 FOK 成交并继续执行仓库、资金、自成交、手续费和 maker price 规则，任一步失败则采购与建造全部回滚。服务端按所选 1～100 座数量原子校验和扣除全部成本，运行中的同类集群保持生产进度并按扩容规则重新计算满员率；不会建立系统材料商店或施工任务。工厂施工时间和施工宝石加速已经退役。\n""",
)

print('facility one-click procurement patch applied')
