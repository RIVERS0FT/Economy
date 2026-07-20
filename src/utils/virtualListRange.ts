export interface VirtualRangeItem {
  start: number;
  size: number;
}

export interface VisibleRange {
  startIndex: number;
  endIndex: number;
}

function firstItemEndingAfter(items: readonly VirtualRangeItem[], offset: number) {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const item = items[middle];
    if (item.start + item.size < offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

function firstItemStartingAtOrAfter(items: readonly VirtualRangeItem[], offset: number) {
  let low = 0;
  let high = items.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (items[middle].start < offset) low = middle + 1;
    else high = middle;
  }
  return low;
}

export function findVisibleRange(
  items: readonly VirtualRangeItem[],
  scrollTop: number,
  viewportHeight: number,
): VisibleRange {
  if (items.length === 0) return { startIndex: 0, endIndex: 0 };
  const normalizedTop = Math.max(0, scrollTop);
  const bottom = normalizedTop + Math.max(0, viewportHeight);
  const startIndex = firstItemEndingAfter(items, normalizedTop);
  const endIndex = Math.max(startIndex, firstItemStartingAtOrAfter(items, bottom));
  return { startIndex, endIndex };
}
