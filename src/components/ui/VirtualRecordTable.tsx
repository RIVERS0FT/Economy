import type { ReactNode } from 'react';
import { useVirtualWindow, type VirtualKey } from '../../hooks/useVirtualWindow';
import { ScrollArea } from './ScrollArea';

export interface VirtualRecordTableProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => VirtualKey;
  header: ReactNode;
  renderRow: (item: T, index: number) => ReactNode;
  estimateSize: number;
  viewportHeight?: number;
  minViewportHeight?: number;
  overscan?: number;
  gap?: number;
  className?: string;
  tableClassName?: string;
  ariaLabel: string;
}

export function VirtualRecordTable<T>({
  items,
  getKey,
  header,
  renderRow,
  estimateSize,
  viewportHeight = 520,
  minViewportHeight = 96,
  overscan = 6,
  gap = 0,
  className = '',
  tableClassName = '',
  ariaLabel,
}: VirtualRecordTableProps<T>) {
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

  return (
    <ScrollArea
      axis="both"
      className={className}
      style={{ height: `calc(${displayHeight}px + var(--virtual-record-header-height, 42px))` }}
      viewportRef={viewportRef}
      viewportClassName={`virtual-record-table ${tableClassName}`.trim()}
      viewportRole="table"
      viewportAriaLabel={ariaLabel}
      viewportTabIndex={0}
      onViewportScroll={handleViewportScroll}
      scrollbarVisibility="adaptive"
    >
      <div className="virtual-record-header" role="row">
        {header}
      </div>
      <div className="virtual-record-canvas" role="rowgroup" style={{ height: totalSize }}>
        {visibleEntries.map((entry) => (
          <div
            key={entry.key}
            ref={(node) => setItemNode(entry.key, node)}
            className="virtual-record-item"
            data-virtual-key={String(entry.key)}
            data-virtual-key-type={typeof entry.key}
            style={{ transform: `translateY(${entry.start}px)` }}
          >
            {renderRow(entry.item, entry.index)}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
