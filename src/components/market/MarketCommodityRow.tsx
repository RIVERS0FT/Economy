import { CompactNumber } from '../ui/CompactNumber';
import { ChevronIcon } from '../icons/GameIcons';
import { ProductArtwork } from '../products/ProductArtwork';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import {
  EntityListHeader,
  nextEntityListSort,
  type EntityListSortDirection,
} from '../ui/EntityListHeader';
import { formatCurrency } from '../../utils/formatters';
import '../../styles/market-commodity-row.css';

export type MarketCommoditySortKey = 'catalog' | 'name' | 'price' | 'trend' | 'volume24h';
export type MarketSortDirection = EntityListSortDirection;

const MARKET_SORT_DEFAULT_DIRECTION: Record<MarketCommoditySortKey, MarketSortDirection> = {
  catalog: 'asc',
  name: 'asc',
  price: 'desc',
  trend: 'desc',
  volume24h: 'desc',
};

export interface MarketCommoditySortState {
  key: MarketCommoditySortKey;
  direction: MarketSortDirection;
}

export function nextMarketCommoditySort(
  clickedKey: Exclude<MarketCommoditySortKey, 'catalog'>,
  current: MarketCommoditySortState,
): MarketCommoditySortState {
  return nextEntityListSort(clickedKey, current, MARKET_SORT_DEFAULT_DIRECTION[clickedKey]);
}

export function compareMarketOptionalValue(
  left: number | undefined,
  right: number | undefined,
  direction: MarketSortDirection,
) {
  if (left === undefined && right === undefined) return 0;
  if (left === undefined) return 1;
  if (right === undefined) return -1;
  return direction === 'asc' ? left - right : right - left;
}

export interface MarketCommodityHeaderProps {
  entityLabel?: string;
  entitySortKey?: 'name';
  sortKey?: MarketCommoditySortKey;
  sortDirection?: MarketSortDirection;
  onSortChange?: (state: MarketCommoditySortState) => void;
}

export function MarketCommodityHeader({
  entityLabel = '商品',
  entitySortKey,
  sortKey = 'catalog',
  sortDirection = 'desc',
  onSortChange,
}: MarketCommodityHeaderProps) {
  const columns: Array<{ label: string; sortKey?: Exclude<MarketCommoditySortKey, 'catalog'> }> = [
    { label: entityLabel, sortKey: entitySortKey },
    { label: '今日价格', sortKey: 'price' },
    { label: '24h成交量', sortKey: 'volume24h' },
    { label: '24h价格变化', sortKey: 'trend' },
    { label: '' },
  ];
  return (
    <EntityListHeader
      className="market-commodity-row-header"
      columns={columns.map((column) => ({
        ...column,
        defaultDirection: column.sortKey ? MARKET_SORT_DEFAULT_DIRECTION[column.sortKey] : undefined,
      }))}
      sortState={{ key: sortKey, direction: sortDirection }}
      onSortChange={onSortChange}
    />
  );
}

export interface MarketCommodityRowProps {
  productId: string;
  productName: string;
  categoryLabel: string;
  regionName?: string;
  regionPrimary?: boolean;
  tradeVolume24h: number;
  marketPrice?: number;
  trend?: number;
  currentRegion?: boolean;
  ariaLabel: string;
  provinceId?: string;
  onPrefetch?: () => void;
  onClick: () => void;
}

export function MarketCommodityRow({
  productId,
  productName,
  categoryLabel,
  regionName,
  regionPrimary = false,
  tradeVolume24h,
  marketPrice,
  trend,
  currentRegion = false,
  ariaLabel,
  provinceId,
  onPrefetch,
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
      className="entity-list-row market-commodity-row"
      data-ui-interactive="surface"
      data-province-id={provinceId}
      data-current-region={currentRegion || undefined}
      aria-label={ariaLabel}
      onPointerEnter={onPrefetch}
      onPointerDown={onPrefetch}
      onFocus={onPrefetch}
      onClick={onClick}
    >
      <span className={`market-commodity-row__identity${regionPrimary ? ' market-commodity-row__identity--region' : ''}`}>
        {regionPrimary ? null : (
          <span className="market-commodity-row__artwork" aria-hidden="true">
            <ProductArtwork productId={productId} />
          </span>
        )}
        <span className="market-commodity-row__name">
          <strong>{regionPrimary && regionName ? regionName : productName}</strong>
          {regionPrimary ? null : <small title={secondary}>{secondary}</small>}
        </span>
      </span>
      <span className="market-commodity-row__metric">
        <strong>{typeof marketPrice === 'number'
          ? <CurrencyAmount>{formatCurrency(marketPrice)}</CurrencyAmount>
          : '—'}</strong>
      </span>
      <span className="market-commodity-row__metric">
        <strong><CompactNumber value={tradeVolume24h} /></strong>
      </span>
      <span className={`entity-list-value market-commodity-row__metric market-commodity-row__trend${trendClassName}${trend === undefined ? ' is-unavailable' : trend === 0 ? ' is-neutral' : ''}`}>
        <strong>{typeof trend === 'number'
          ? <CurrencyAmount sign={trend > 0 ? '+' : undefined}>{formatCurrency(trend)}</CurrencyAmount>
          : '—'}</strong>
      </span>
      <span className="market-commodity-row__chevron" aria-hidden="true">
        <ChevronIcon direction="right" />
      </span>
    </button>
  );
}