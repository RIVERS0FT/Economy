import type {
  FacilityRecipeDefinition,
  ProductMarketState,
} from '../types';

export interface RecipeMarketPriceLine {
  productId: string;
  quantity: number;
  lastTradePrice: number | null;
  totalValue: number | null;
}

export interface RecipeProfitAnalysisResult {
  scopeCount: number;
  operatingCost: number;
  inputs: RecipeMarketPriceLine[];
  inputMarketCost: number | null;
  output: RecipeMarketPriceLine;
  outputMarketValue: number | null;
  cycleProfit: number | null;
  profitPerMinute: number | null;
  paybackMinutes: number | null;
  missingPriceProductIds: string[];
}

function normalizedQuantity(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

function lastTradePrice(markets: Record<string, ProductMarketState>, productId: string) {
  const value = markets[productId]?.lastTradePrice;
  return Number.isInteger(value) && Number(value) >= 1 ? Number(value) : null;
}

function marketPriceLine(
  markets: Record<string, ProductMarketState>,
  productId: string,
  quantity: number,
): RecipeMarketPriceLine {
  const normalized = normalizedQuantity(quantity);
  const price = normalized > 0 ? lastTradePrice(markets, productId) : null;
  return {
    productId,
    quantity: normalized,
    lastTradePrice: price,
    totalValue: normalized === 0 ? 0 : price === null ? null : normalized * price,
  };
}

export function analyzeRecipeProfit({
  recipe,
  scopeCount,
  markets,
  buildCost,
}: {
  recipe: FacilityRecipeDefinition;
  scopeCount: number;
  markets: Record<string, ProductMarketState>;
  buildCost: number;
}): RecipeProfitAnalysisResult {
  const count = normalizedQuantity(scopeCount);
  const operatingCost = normalizedQuantity(recipe.operatingCost) * count;
  const inputs = (Array.isArray(recipe.inputs) ? recipe.inputs : []).map((input) => (
    marketPriceLine(markets, input.productId, normalizedQuantity(input.quantity) * count)
  ));
  const output = marketPriceLine(
    markets,
    recipe.output.productId,
    normalizedQuantity(recipe.output.quantity) * count,
  );
  const missingPriceProductIds = Array.from(new Set([
    ...inputs
      .filter((input) => input.quantity > 0 && input.lastTradePrice === null)
      .map((input) => input.productId),
    ...(output.quantity > 0 && output.lastTradePrice === null ? [output.productId] : []),
  ]));
  const inputMarketCost = count > 0 && inputs.every((input) => input.totalValue !== null)
    ? inputs.reduce((sum, input) => sum + Number(input.totalValue || 0), 0)
    : count > 0 && inputs.length === 0
      ? 0
      : null;
  const outputMarketValue = count > 0 ? output.totalValue : null;
  const cycleProfit = outputMarketValue !== null && inputMarketCost !== null
    ? outputMarketValue - inputMarketCost - operatingCost
    : null;
  const profitPerMinute = cycleProfit !== null && recipe.cycleMs > 0
    ? cycleProfit * 60_000 / recipe.cycleMs
    : null;
  const normalizedBuildCost = Math.max(0, Number(buildCost) || 0) * count;
  const paybackMinutes = profitPerMinute !== null && profitPerMinute > 0
    ? normalizedBuildCost / profitPerMinute
    : null;

  return {
    scopeCount: count,
    operatingCost,
    inputs,
    inputMarketCost,
    output,
    outputMarketValue,
    cycleProfit,
    profitPerMinute,
    paybackMinutes,
    missingPriceProductIds,
  };
}
