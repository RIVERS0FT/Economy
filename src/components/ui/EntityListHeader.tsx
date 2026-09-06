import { SafeTooltip } from './SafeTooltip';
import { ChevronIcon } from '../icons/GameIcons';
import '../../styles/entity-list-header.css';

export type EntityListSortDirection = 'asc' | 'desc';

export interface EntityListSortState<SortKey extends string> {
  key: SortKey | 'catalog';
  direction: EntityListSortDirection;
}

export interface EntityListHeaderColumn<SortKey extends string> {
  key?: string;
  label: string;
  description?: string;
  sortKey?: SortKey;
  defaultDirection?: EntityListSortDirection;
}

interface EntityListHeaderProps<SortKey extends string> {
  className?: string;
  columns: Array<EntityListHeaderColumn<SortKey>>;
  sortState?: EntityListSortState<SortKey>;
  onSortChange?: (state: EntityListSortState<SortKey>) => void;
}

export function nextEntityListSort<SortKey extends string>(
  clickedKey: SortKey,
  current: EntityListSortState<SortKey>,
  defaultDirection: EntityListSortDirection,
): EntityListSortState<SortKey> {
  if (current.key !== clickedKey) return { key: clickedKey, direction: defaultDirection };
  if (current.direction === defaultDirection) {
    return { key: clickedKey, direction: defaultDirection === 'asc' ? 'desc' : 'asc' };
  }
  return { key: 'catalog', direction: 'asc' };
}

export function EntityListHeader<SortKey extends string>({
  className,
  columns,
  sortState,
  onSortChange,
}: EntityListHeaderProps<SortKey>) {
  return (
    <div className={`entity-list-header${className ? ` ${className}` : ''}`} role="row">
      {columns.map((column, index) => {
        const isSortable = column.sortKey !== undefined && sortState !== undefined && onSortChange !== undefined;
        const isActive = column.sortKey !== undefined && sortState?.key === column.sortKey;
        const ariaSort = column.sortKey === undefined
          ? undefined
          : isActive
            ? sortState?.direction === 'asc' ? 'ascending' as const : 'descending' as const
            : 'none' as const;
        const content = isSortable ? (
          <button
            type="button"
            className="entity-list-header__sort"
            onClick={() => onSortChange(nextEntityListSort(
              column.sortKey!,
              sortState,
              column.defaultDirection ?? 'asc',
            ))}
          >
            <span>{column.label}</span>
            <span className="entity-list-header__indicator" aria-hidden="true">
              <ChevronIcon direction={isActive && sortState.direction === 'asc' ? 'up' : 'down'} />
            </span>
          </button>
        ) : column.label;
        return (
          <span
            className="entity-list-header__cell"
            key={column.key ?? column.sortKey ?? column.label ?? `column-${index}`}
            role="columnheader"
            aria-sort={ariaSort}
          >
            {column.description ? <SafeTooltip content={column.description}>{content}</SafeTooltip> : content}
          </span>
        );
      })}
    </div>
  );
}
