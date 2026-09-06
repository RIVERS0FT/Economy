import { pathToFileURL } from 'node:url';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/industry-catalog.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from '../server/src/commercial-catalog.js';
import { calculateCumulativeMarketSellFee } from '../server/src/market-sell-fee.js';

const basePrices = new Map(PRODUCT_CATALOG.map(product => [product.id, product.basePrice]));
const value = (items, prices) => (items || []).reduce((sum, item) => sum + prices.get(item.productId) * item.quantity, 0);

/** Full staffing; market-valued construction and two complete cycles of working capital; research excluded.
 * This is capital recovery, not cash payback: stocked inputs and cash remain assets until consumed.
 * Pure audit only: never reads players, writes worlds, or provides guaranteed runtime income.
 */
export function auditRecipe(facility, recipe, prices = basePrices) {
  const inputs = value(recipe.inputs, prices);
  const gross = value([recipe.output], prices);
  const fee = calculateCumulativeMarketSellFee(gross);
  const netPerMinute = (gross - fee - inputs - recipe.operatingCost) * 60_000 / recipe.cycleMs;
  const capital = facility.buildCost + value(facility.buildInputs, prices) + 2 * (inputs + recipe.operatingCost);
  return { facilityId: facility.id, recipeId: recipe.id, complexity: facility.complexity,
    cycleMs: recipe.cycleMs, operatingCost: recipe.operatingCost, inputs, gross, fee,
    netPerMinute, capital, recoveryMinutes: netPerMinute > 0 ? capital / netPerMinute : null };
}

export function auditCommercial(type, prices = basePrices) {
  const capital = type.buildCost + 2 * (value(type.consumptionInputs, prices) + type.operatingCost);
  const netPerMinute = type.profitPerCycle * 60_000 / type.cycleMs;
  return { commercialTypeId: type.id, capital, netPerMinute, recoveryMinutes: capital / netPerMinute };
}

export function auditEconomyCatalog() {
  return { assumption: 'Base prices, full staffing, market input replacement, actual sell fees, two-cycle capital; no research amortization or reinvestment.',
    industrial: FACILITY_TYPE_CATALOG.flatMap(type => type.recipes.map(recipe => auditRecipe(type, recipe))),
    commercial: COMMERCIAL_BUILDING_TYPE_CATALOG.map(type => auditCommercial(type)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(JSON.stringify(auditEconomyCatalog(), null, 2));
}
