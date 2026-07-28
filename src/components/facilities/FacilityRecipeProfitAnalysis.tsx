import type {
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { analyzeRecipeProfit } from '../../utils/recipeProfitAnalysis';
import { formatCurrency } from '../../utils/formatters';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { useFacilityRecipeProfitMarkets } from './FacilityRecipeProfitContext';
import '../../styles/facility-recipe-profit-analysis.css';

function amountTone(value: number | null) {
  if (value === null || value === 0) return '';
  return value > 0 ? ' is-positive' : ' is-negative';
}

function scopeDescription(scopeLabel: string) {
  if (scopeLabel === '下一周期') return '下一周期预计';
  if (scopeLabel === '启动后') return '启动后预计';
  if (scopeLabel === '恢复后') return '恢复后预计';
  return '当前配方预计';
}

export function FacilityRecipeProfitAnalysis({
  type,
  scopeCount,
  scopeLabel,
  staffingRateBps,
  products,
  inventories: _inventories,
}: {
  type: FacilityTypeDefinition;
  scopeCount: number;
  scopeLabel: string;
  staffingRateBps: number;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
}) {
  void _inventories;
  const markets = useFacilityRecipeProfitMarkets();
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
  const sign = profitPerMinute === null
    ? undefined
    : profitPerMinute > 0
      ? '+'
      : profitPerMinute < 0
        ? '−'
        : undefined;

  return (
    <section
      className={`facility-average-profit${amountTone(profitPerMinute)}`}
      aria-label={`${type.name}单厂平均利润每分钟`}
      title={detail}
    >
      <div className="facility-average-profit__copy">
        <strong>单厂平均利润／分钟</strong>
        <small>{description} · 最近真实成交价 · 满员率 {staffingPercent}%</small>
      </div>
      <div className="facility-average-profit__value">
        {profitPerMinute === null ? (
          <strong>{fallback}</strong>
        ) : (
          <CurrencyAmount sign={sign}>{formatCurrency(Math.abs(profitPerMinute))}</CurrencyAmount>
        )}
      </div>
    </section>
  );
}
