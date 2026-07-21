import type {
  AssetOrder,
  FacilityRecipeDefinition,
  OrderSide,
  ProductInventory,
} from '../types';

export interface OrderSweep {
  requestedQuantity: number;
  filledQuantity: number;
  total: number;
  averagePrice: number | null;
  fullyFilled: boolean;
}

export interface RecipeInputProfitLine {
  productId: string;
  requiredQuantity: number;
  inventoryQuantity: number;
  coveredByInventory: number;
  purchaseQuantity: number;
  shortagePurchase: OrderSweep;
  fullPurchase: OrderSweep;
  directSale: OrderSweep;
  directSaleFee: number;
  directSaleNet: number | null;
}

export interface RecipeProfitAnalysisResult {
  scopeCount: number;
  operatingCost: number;
  outputProductId: string;
  outputQuantity: number;
  outputSale: OrderSweep;
  outputSellFee: number;
  outputNetRevenue: number | null;
  inputs: RecipeInputProfitLine[];
  inventoryCoverageQuantity: number;
  requiredInputQuantity: number;
  shortagePurchaseCost: number | null;
  fullPurchaseCost: number | null;
  directInputSaleNet: number | null;
  cashProfit: number | null;
  fullPurchaseProfit: number | null;
  valueAddedProfit: number | null;
  profitPerMinute: number | null;
  paybackMinutes: number | null;
}

function normalizedQuantity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function orderProductId(order: AssetOrder) {
  return String(order.assetId || order.productId || '');
}

export function estimatePlayerSellFee(grossTotal: number) {
  const normalized = Math.max(0, Math.floor(Number(grossTotal) || 0));
  return normalized > 0 ? Math.max(1, Math.ceil(normalized / 100)) : 0;
}

export function sweepCommodityOrders(
  orders: AssetOrder[],
  productId: string,
  side: OrderSide,
  requestedQuantity: number,
): OrderSweep {
  const requested = normalizedQuantity(requestedQuantity);
  if (requested === 0) {
    return {
      requestedQuantity: 0,
      filledQuantity: 0,
      total: 0,
      averagePrice: null,
      fullyFilled: true,
    };
  }

  const candidates = orders
    .filter((order) => (
      order.assetKind === 'commodity'
      && orderProductId(order) === productId
      && order.side === side
      && !order.isOwn
      && ['open', 'partial'].includes(order.status)
      && normalizedQuantity(order.remaining) > 0
      && Number.isInteger(order.price)
      && order.price >= 1
    ))
    .sort((left, right) => (
      side === 'buy'
        ? right.price - left.price || left.createdAt - right.createdAt || left.id.localeCompare(right.id)
        : left.price - right.price || left.createdAt - right.createdAt || left.id.localeCompare(right.id)
    ));

  let remaining = requested;
  let total = 0;
  for (const order of candidates) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, normalizedQuantity(order.remaining));
    total += quantity * order.price;
    remaining -= quantity;
  }

  const filledQuantity = requested - remaining;
  return {
    requestedQuantity: requested,
    filledQuantity,
    total,
    averagePrice: filledQuantity > 0 ? total / filledQuantity : null,
    fullyFilled: remaining === 0,
  };
}

export function analyzeRecipeProfit({
  recipe,
  scopeCount,
  inventories,
  orders,
  buildCost,
}: {
  recipe: FacilityRecipeDefinition;
  scopeCount: number;
  inventories: Record<string, ProductInventory>;
  orders: AssetOrder[];
  buildCost: number;
}): RecipeProfitAnalysisResult {
  const count = normalizedQuantity(scopeCount);
  const operatingCost = normalizedQuantity(recipe.operatingCost) * count;
  const outputQuantity = normalizedQuantity(recipe.output.quantity) * count;
  const outputSale = sweepCommodityOrders(orders, recipe.output.productId, 'buy', outputQuantity);
  const outputSellFee = estimatePlayerSellFee(outputSale.total);
  const outputNetRevenue = outputQuantity > 0 && outputSale.fullyFilled
    ? outputSale.total - outputSellFee
    : null;

  const inputLines = (Array.isArray(recipe.inputs) ? recipe.inputs : []).map((input) => {
    const requiredQuantity = normalizedQuantity(input.quantity) * count;
    const inventoryQuantity = normalizedQuantity(inventories[input.productId]?.available ?? 0);
    const coveredByInventory = Math.min(requiredQuantity, inventoryQuantity);
    const purchaseQuantity = requiredQuantity - coveredByInventory;
    const shortagePurchase = sweepCommodityOrders(orders, input.productId, 'sell', purchaseQuantity);
    const fullPurchase = sweepCommodityOrders(orders, input.productId, 'sell', requiredQuantity);
    const directSale = sweepCommodityOrders(orders, input.productId, 'buy', requiredQuantity);
    const directSaleFee = estimatePlayerSellFee(directSale.total);
    return {
      productId: input.productId,
      requiredQuantity,
      inventoryQuantity,
      coveredByInventory,
      purchaseQuantity,
      shortagePurchase,
      fullPurchase,
      directSale,
      directSaleFee,
      directSaleNet: requiredQuantity === 0 || directSale.fullyFilled
        ? directSale.total - directSaleFee
        : null,
    };
  });

  const requiredInputQuantity = inputLines.reduce((sum, input) => sum + input.requiredQuantity, 0);
  const inventoryCoverageQuantity = inputLines.reduce((sum, input) => sum + input.coveredByInventory, 0);
  const shortagesReady = inputLines.every((input) => input.shortagePurchase.fullyFilled);
  const fullPurchasesReady = inputLines.every((input) => input.fullPurchase.fullyFilled);
  const directSalesReady = inputLines.every((input) => input.directSaleNet !== null);
  const shortagePurchaseCost = count > 0 && shortagesReady
    ? inputLines.reduce((sum, input) => sum + input.shortagePurchase.total, 0)
    : null;
  const fullPurchaseCost = count > 0 && fullPurchasesReady
    ? inputLines.reduce((sum, input) => sum + input.fullPurchase.total, 0)
    : null;
  const directInputSaleNet = count > 0 && directSalesReady
    ? inputLines.reduce((sum, input) => sum + Number(input.directSaleNet || 0), 0)
    : null;
  const cashProfit = outputNetRevenue !== null && shortagePurchaseCost !== null
    ? outputNetRevenue - operatingCost - shortagePurchaseCost
    : null;
  const fullPurchaseProfit = outputNetRevenue !== null && fullPurchaseCost !== null
    ? outputNetRevenue - operatingCost - fullPurchaseCost
    : null;
  const valueAddedProfit = outputNetRevenue !== null && directInputSaleNet !== null
    ? outputNetRevenue - operatingCost - directInputSaleNet
    : null;
  const comparisonProfit = inputLines.length > 0 ? valueAddedProfit : cashProfit;
  const profitPerMinute = comparisonProfit !== null && recipe.cycleMs > 0
    ? comparisonProfit * 60_000 / recipe.cycleMs
    : null;
  const normalizedBuildCost = Math.max(0, Number(buildCost) || 0) * count;
  const paybackMinutes = profitPerMinute !== null && profitPerMinute > 0
    ? normalizedBuildCost / profitPerMinute
    : null;

  return {
    scopeCount: count,
    operatingCost,
    outputProductId: recipe.output.productId,
    outputQuantity,
    outputSale,
    outputSellFee,
    outputNetRevenue,
    inputs: inputLines,
    inventoryCoverageQuantity,
    requiredInputQuantity,
    shortagePurchaseCost,
    fullPurchaseCost,
    directInputSaleNet,
    cashProfit,
    fullPurchaseProfit,
    valueAddedProfit,
    profitPerMinute,
    paybackMinutes,
  };
}
