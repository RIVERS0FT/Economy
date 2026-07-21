import type { AriaRole, CSSProperties, ReactNode } from 'react';
import { useVirtualWindow, type VirtualKey } from '../../hooks/useVirtualWindow';
import { ScrollArea } from './ScrollArea';

export interface VirtualListProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => VirtualKey;
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize: number;
  viewportHeight?: number;
  minViewportHeight?: number;
  overscan?: number;
  gap?: number;
  className?: string;
  ariaLabel?: string;
  role?: AriaRole;
  itemRole?: AriaRole;
  empty?: ReactNode;
  style?: CSSProperties;
}

export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize,
  viewportHeight = 640,
  minViewportHeight = 96,
  overscan = 4,
  gap = 8,
  className = '',
  ariaLabel,
  role = 'list',
  itemRole = 'listitem',
  empty = null,
  style,
}: VirtualListProps<T>) {
  const {
    viewportRef,
    displayHeight,
    totalSize,
    visibleEntries,
    setItemNode,
    handleViewportScroll,
  } = useVirtualWindow({
    items,
    getKey,
    estimateSize,
    viewportHeight,
    minViewportHeight,
    overscan,
    gap,
  });

  if (items.length === 0) return <>{empty}</>;

  return (
    <ScrollArea
      axis="y"
      className="virtual-list-scroll-area"
      style={{ height: displayHeight }}
      viewportRef={viewportRef}
      viewportClassName={`virtual-list ${className}`.trim()}
      viewportStyle={{ ...style, height: '100%' }}
      viewportRole={role}
      viewportAriaLabel={ariaLabel}
      viewportTabIndex={0}
      onViewportScroll={handleViewportScroll}
      scrollbarVisibility="adaptive"
    >
      <div className="virtual-list__canvas" style={{ height: totalSize }}>
        {visibleEntries.map((entry) => (
          <div
            key={entry.key}
            ref={(node) => setItemNode(entry.key, node)}
            className="virtual-list__item"
            data-virtual-key={String(entry.key)}
            data-virtual-key-type={typeof entry.key}
            role={itemRole}
            aria-setsize={items.length}
            aria-posinset={entry.index + 1}
            style={{ transform: `translateY(${entry.start}px)` }}
          >
            {renderItem(entry.item, entry.index)}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
