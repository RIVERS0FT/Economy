import type {
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { resolveFacilityProfitPresentation } from '../../utils/facilityProfitPresentation';
import { formatCurrency } from '../../utils/formatters';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { useFacilityRecipeProfitMarkets } from './FacilityRecipeProfitContext';
import '../../styles/facility-recipe-profit-analysis.css';

function amountTone(value: number | null) {
  if (value === null || value === 0) return '';
  return value > 0 ? ' is-positive' : ' is-negative';
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
  const presentation = resolveFacilityProfitPresentation({
    type,
    scopeCount,
    scopeLabel,
    staffingRateBps,
    products,
    markets,
  });
  const { profitPerMinute, staffingPercent, description, fallback, detail } = presentation;
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
