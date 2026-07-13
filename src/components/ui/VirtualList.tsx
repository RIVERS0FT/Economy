import {
  type CSSProperties,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type VirtualKey = string | number;

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
  role?: string;
  itemRole?: string;
  empty?: ReactNode;
  style?: CSSProperties;
}

interface VirtualLayoutItem {
  index: number;
  key: VirtualKey;
  start: number;
  size: number;
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
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(new Map<VirtualKey, HTMLDivElement>());
  const measuredSizesRef = useRef(new Map<VirtualKey, number>());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [measurementVersion, setMeasurementVersion] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const keys = useMemo(() => items.map((item, index) => getKey(item, index)), [getKey, items]);

  useEffect(() => {
    const activeKeys = new Set(keys);
    let removed = false;
    measuredSizesRef.current.forEach((_size, key) => {
      if (!activeKeys.has(key)) {
        measuredSizesRef.current.delete(key);
        removed = true;
      }
    });
    if (removed) setMeasurementVersion((version) => version + 1);
  }, [keys]);

  const updateMeasurement = useCallback((key: VirtualKey, size: number) => {
    const roundedSize = Math.max(1, Math.ceil(size));
    const previous = measuredSizesRef.current.get(key);
    if (previous === roundedSize) return;
    measuredSizesRef.current.set(key, roundedSize);
    setMeasurementVersion((version) => version + 1);
  }, []);

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const element = entry.target as HTMLDivElement;
        const key = element.dataset.virtualKey;
        if (key === undefined) continue;
        const numericKey = element.dataset.virtualKeyType === 'number' ? Number(key) : key;
        updateMeasurement(numericKey, entry.getBoundingClientRect().height);
      }
    });
    resizeObserverRef.current = observer;
    nodesRef.current.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [updateMeasurement]);

  const setItemNode = useCallback((key: VirtualKey, node: HTMLDivElement | null) => {
    const previous = nodesRef.current.get(key);
    if (previous && previous !== node) resizeObserverRef.current?.unobserve(previous);
    if (!node) {
      nodesRef.current.delete(key);
      return;
    }
    nodesRef.current.set(key, node);
    resizeObserverRef.current?.observe(node);
    updateMeasurement(key, node.getBoundingClientRect().height);
  }, [updateMeasurement]);

  const layout = useMemo(() => {
    const entries: VirtualLayoutItem[] = [];
    let cursor = 0;
    for (let index = 0; index < items.length; index += 1) {
      const key = keys[index];
      const size = measuredSizesRef.current.get(key) ?? estimateSize;
      entries.push({ index, key, start: cursor, size });
      cursor += size + gap;
    }
    return {
      entries,
      totalSize: Math.max(0, cursor - (items.length > 0 ? gap : 0)),
    };
  }, [estimateSize, gap, items.length, keys, measurementVersion]);

  const displayHeight = Math.min(
    viewportHeight,
    Math.max(minViewportHeight, layout.totalSize || minViewportHeight),
  );
  const viewportBottom = scrollTop + displayHeight;

  let startIndex = 0;
  while (
    startIndex < layout.entries.length
    && layout.entries[startIndex].start + layout.entries[startIndex].size < scrollTop
  ) startIndex += 1;

  let endIndex = startIndex;
  while (endIndex < layout.entries.length && layout.entries[endIndex].start < viewportBottom) endIndex += 1;

  const visibleEntries = layout.entries.slice(
    Math.max(0, startIndex - overscan),
    Math.min(layout.entries.length, endIndex + overscan),
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScrollTop = Math.max(0, layout.totalSize - viewport.clientHeight);
    if (viewport.scrollTop > maxScrollTop) {
      viewport.scrollTop = maxScrollTop;
      setScrollTop(maxScrollTop);
    }
  }, [layout.totalSize]);

  if (items.length === 0) return <>{empty}</>;

  return (
    <div
      ref={viewportRef}
      className={`virtual-list ${className}`.trim()}
      style={{ ...style, height: displayHeight }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role={role}
      aria-label={ariaLabel}
      tabIndex={0}
    >
      <div className="virtual-list__canvas" style={{ height: layout.totalSize }}>
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
            {renderItem(items[entry.index], entry.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
