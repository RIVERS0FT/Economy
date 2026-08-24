import { ProductArtwork } from '../products/ProductArtwork';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import '../../styles/market-commodity-row.css';

export interface MarketCommodityRowProps {
  productId: string;
  productName: string;
  categoryLabel: string;
  regionName?: string;
  sellVolume: number;
  buyVolume: number;
  marketPrice?: number;
  trend?: number;
  currentRegion?: boolean;
  ariaLabel: string;
  provinceId?: string;
  onClick: () => void;
}

export function MarketCommodityRow({
  productId,
  productName,
  categoryLabel,
  regionName,
  sellVolume,
  buyVolume,
  marketPrice,
  trend,
  currentRegion = false,
  ariaLabel,
  provinceId,
  onClick,
}: MarketCommodityRowProps) {
  const secondary = regionName
    ? `${categoryLabel} · ${regionName}${currentRegion ? ' · 当前经营州' : ''}`
    : categoryLabel;
  const trendClassName = trend === undefined
    ? ''
    : trend > 0
      ? ' is-positive'
      : trend < 0
        ? ' is-negative'
        : '';

  return (
    <button
      type="button"
      className="market-commodity-row"
      data-ui-interactive="surface"
      data-province-id={provinceId}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <span className="market-commodity-row__identity">
        <span className="market-commodity-row__artwork" aria-hidden="true">
          <ProductArtwork productId={productId} />
        </span>
        <span className="market-commodity-row__name">
          <strong>{productName}</strong>
          <small title={secondary}>{secondary}</small>
        </span>
      </span>
      <span className="market-commodity-row__metric">
        <small>卖单量</small>
        <strong>{formatNumber(sellVolume)}</strong>
      </span>
      <span className="market-commodity-row__metric">
        <small>买单量</small>
        <strong>{formatNumber(buyVolume)}</strong>
      </span>
      <span className="market-commodity-row__metric">
        <small>市场价</small>
        <strong>{typeof marketPrice === 'number'
          ? <CurrencyAmount>{formatCurrency(marketPrice)}</CurrencyAmount>
          : '—'}</strong>
      </span>
      <span className={`market-commodity-row__metric market-commodity-row__trend${trendClassName}`}>
        <small>24h</small>
        <strong>{typeof trend === 'number'
          ? <CurrencyAmount sign={trend > 0 ? '+' : undefined}>{formatCurrency(trend)}</CurrencyAmount>
          : '—'}</strong>
      </span>
      <span className="market-commodity-row__chevron" aria-hidden="true">›</span>
    </button>
  );
}
