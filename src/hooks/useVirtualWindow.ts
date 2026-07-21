import {
  type UIEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { findVisibleRange } from '../utils/virtualListRange';

export type VirtualKey = string | number;

interface VirtualLayoutItem {
  index: number;
  key: VirtualKey;
  start: number;
  size: number;
}

export interface VirtualWindowEntry<T> extends VirtualLayoutItem {
  item: T;
}

export interface UseVirtualWindowOptions<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => VirtualKey;
  estimateSize: number;
  viewportHeight: number;
  minViewportHeight: number;
  overscan: number;
  gap: number;
}

export function useVirtualWindow<T>({
  items,
  getKey,
  estimateSize,
  viewportHeight,
  minViewportHeight,
  overscan,
  gap,
}: UseVirtualWindowOptions<T>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(new Map<VirtualKey, HTMLDivElement>());
  const measuredSizesRef = useRef(new Map<VirtualKey, number>());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pendingScrollTopRef = useRef(0);
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
        const normalizedKey = element.dataset.virtualKeyType === 'number' ? Number(key) : key;
        updateMeasurement(normalizedKey, element.getBoundingClientRect().height);
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
  const { startIndex, endIndex } = findVisibleRange(layout.entries, scrollTop, displayHeight);
  const visibleEntries = layout.entries.slice(
    Math.max(0, startIndex - overscan),
    Math.min(layout.entries.length, endIndex + overscan),
  ).map((entry): VirtualWindowEntry<T> => ({ ...entry, item: items[entry.index] }));

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const maxScrollTop = Math.max(0, layout.totalSize - displayHeight);
    if (viewport.scrollTop > maxScrollTop) {
      viewport.scrollTop = maxScrollTop;
      setScrollTop(maxScrollTop);
    }
  }, [displayHeight, layout.totalSize]);

  const handleViewportScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    pendingScrollTopRef.current = event.currentTarget.scrollTop;
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      setScrollTop(pendingScrollTopRef.current);
    });
  }, []);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  return {
    viewportRef,
    displayHeight,
    totalSize: layout.totalSize,
    visibleEntries,
    setItemNode,
    handleViewportScroll,
  };
}
