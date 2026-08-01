import type {
  FacilityTypeDefinition,
  ProductDefinition,
  ProductMarketState,
} from '../types';
import { analyzeRecipeProfit } from './recipeProfitAnalysis';
import { formatCurrency } from './formatters';

export type FacilityProfitTone = 'positive' | 'negative' | 'neutral' | 'unavailable';

export interface FacilityProfitPresentation {
  profitPerMinute: number | null;
  staffingPercent: number;
  description: string;
  fallback: string;
  detail: string;
  visibleValue: string;
  accessibleValue: string;
  tone: FacilityProfitTone;
}

function scopeDescription(scopeLabel: string) {
  if (scopeLabel === '下一周期') return '下一周期预计';
  if (scopeLabel === '启动后') return '启动后预计';
  if (scopeLabel === '恢复后') return '恢复后预计';
  return '当前配方预计';
}

export function resolveFacilityProfitPresentation({
  type,
  scopeCount,
  scopeLabel,
  staffingRateBps,
  products,
  markets,
}: {
  type: FacilityTypeDefinition;
  scopeCount: number;
  scopeLabel: string;
  staffingRateBps: number;
  products: ProductDefinition[];
  markets: Record<string, ProductMarketState>;
}): FacilityProfitPresentation {
  const analysis = analyzeRecipeProfit({
    recipe: type,
    scopeCount: scopeCount > 0 ? 1 : 0,
    markets,
    buildCost: 0,
  });
  const normalizedStaffingRateBps = Math.max(0, Math.min(10_000, Math.floor(Number(staffingRateBps))));
  const staffingPercent = Math.round(normalizedStaffingRateBps / 100);
  const profitPerMinute = analysis.profitPerMinute === null
    ? null
    : analysis.profitPerMinute * normalizedStaffingRateBps / 10_000;
  const description = scopeDescription(scopeLabel);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const missingPriceNames = analysis.missingPriceProductIds.map((productId) => (
    productNames.get(productId) ?? productId
  ));
  const missingPriceLabel = missingPriceNames.join('、');
  const fallback = scopeCount < 1
    ? '暂无范围'
    : missingPriceNames.length > 0
      ? `缺少${missingPriceLabel}成交价`
      : '暂无成交数据';
  const detail = scopeCount < 1
    ? `${description}；没有可计算的工厂范围`
    : profitPerMinute === null
      ? missingPriceNames.length > 0
        ? `${description}；缺少${missingPriceLabel}的最近真实成交价，无法估算`
        : `${description}；缺少最近真实成交价，无法估算`
      : `${description}；按最近真实成交价和 ${staffingPercent}% 满员率线性估算，已扣除对应有效产能的单座原料成本与周期运营成本，不计玩家库存、挂单深度和交易手续费`;
  const tone: FacilityProfitTone = profitPerMinute === null
    ? 'unavailable'
    : profitPerMinute > 0
      ? 'positive'
      : profitPerMinute < 0
        ? 'negative'
        : 'neutral';
  const visibleValue = profitPerMinute === null ? '—' : formatCurrency(profitPerMinute);
  const accessibleValue = profitPerMinute === null
    ? fallback
    : profitPerMinute > 0
      ? `盈利 ${formatCurrency(profitPerMinute)}`
      : profitPerMinute < 0
        ? `亏损 ${formatCurrency(Math.abs(profitPerMinute))}`
        : '持平 0.00';

  return {
    profitPerMinute,
    staffingPercent,
    description,
    fallback,
    detail,
    visibleValue,
    accessibleValue,
    tone,
  };
}
