import { CompactNumber } from '../ui/CompactNumber';
import { ChevronIcon } from '../icons/GameIcons';
import { ProductArtwork } from '../products/ProductArtwork';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import '../../styles/entity-list-header.css';
import '../../styles/market-commodity-row.css';

export type MarketCommoditySortKey = 'catalog' | 'name' | 'price' | 'trend' | 'buy-volume' | 'sell-volume';
export type MarketSortDirection = 'asc' | 'desc';

const MARKET_SORT_DEFAULT_DIRECTION: Record<MarketCommoditySortKey, MarketSortDirection> = {
  catalog: 'asc',
  name: 'asc',
  price: 'desc',
  trend: 'desc',
  'buy-volume': 'desc',
  'sell-volume': 'desc',
};

export interface MarketCommoditySortState {
  key: MarketCommoditySortKey;
  direction: MarketSortDirection;
}

export function nextMarketCommoditySort(
  clickedKey: Exclude<MarketCommoditySortKey, 'catalog'>,
  current: MarketCommoditySortState,
): MarketCommoditySortState {
  if (current.key !== clickedKey) {
    return { key: clickedKey, direction: MARKET_SORT_DEFAULT_DIRECTION[clickedKey] };
  }
  if (current.direction === MARKET_SORT_DEFAULT_DIRECTION[clickedKey]) {
    return {
      key: clickedKey,
      direction: MARKET_SORT_DEFAULT_DIRECTION[clickedKey] === 'asc' ? 'desc' : 'asc',
    };
  }
  return { key: 'catalog', direction: MARKET_SORT_DEFAULT_DIRECTION.catalog };
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
    { label: '卖单量', sortKey: 'sell-volume' },
    { label: '买单量', sortKey: 'buy-volume' },
    { label: '市场价', sortKey: 'price' },
    { label: '24h', sortKey: 'trend' },
    { label: '' },
  ];
  return (
    <div className="entity-list-header market-commodity-row-header" role="row">
      {columns.map((column) => {
        const columnSortKey = column.sortKey;
        const isActive = columnSortKey !== undefined && sortKey === columnSortKey;
        const ariaSort = isActive
          ? sortDirection === 'asc' ? 'ascending' as const : 'descending' as const
          : 'none' as const;
        const content = columnSortKey === undefined || !onSortChange
          ? column.label
          : (
            <button
              type="button"
              className="market-commodity-row-header__sort"
              onClick={() => onSortChange(nextMarketCommoditySort(
                columnSortKey,
                { key: sortKey, direction: sortDirection },
              ))}
            >
              <span>{column.label}</span>
              <span className="market-commodity-row-header__indicator" aria-hidden="true">
                <ChevronIcon direction={isActive && sortDirection === 'asc' ? 'up' : 'down'} />
              </span>
            </button>
          );
        return (
          <span
            className="market-commodity-row-header__cell"
            key={column.label || 'chevron'}
            role="columnheader"
            aria-sort={columnSortKey === undefined ? undefined : ariaSort}
          >
            {content}
          </span>
        );
      })}
    </div>
  );
}

export interface MarketCommodityRowProps {
  productId: string;
  productName: string;
  categoryLabel: string;
  regionName?: string;
  regionPrimary?: boolean;
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
  regionPrimary = false,
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
    ? regionPrimary
      ? `${productName} · ${categoryLabel}${currentRegion ? ' · 当前经营州' : ''}`
      : `${categoryLabel} · ${regionName}${currentRegion ? ' · 当前经营州' : ''}`
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
            <strong>{regionPrimary && regionName ? regionName : productName}</strong>
            <small title={secondary}>{secondary}</small>
          </span>
        </span>
        <span className="market-commodity-row__metric">
          <strong>{<CompactNumber value={sellVolume} />}</strong>
        </span>
        <span className="market-commodity-row__metric">
          <strong>{<CompactNumber value={buyVolume} />}</strong>
        </span>
        <span className="market-commodity-row__metric">
          <strong>{typeof marketPrice === 'number'
            ? <CurrencyAmount>{formatCurrency(marketPrice)}</CurrencyAmount>
            : '—'}</strong>
        </span>
        <span className={`market-commodity-row__metric market-commodity-row__trend${trendClassName}`}>
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
