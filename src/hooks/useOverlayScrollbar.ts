import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';

export type ScrollAxis = 'x' | 'y' | 'both';
export type HorizontalScrollbarVisibility = 'always' | 'activity';

interface UseOverlayScrollbarOptions {
  rootRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  horizontalTrackRef: RefObject<HTMLElement | null>;
  horizontalThumbRef: RefObject<HTMLElement | null>;
  verticalTrackRef: RefObject<HTMLElement | null>;
  verticalThumbRef: RefObject<HTMLElement | null>;
  axis: ScrollAxis;
  horizontalVisibility: HorizontalScrollbarVisibility;
  verticalAutoHide: boolean;
  idleDelay: number;
  verticalPriority: boolean;
}

const MIN_THUMB_SIZE = 28;
const AXIS_DOMINANCE_RATIO = 1.25;

function supportsAxis(axis: ScrollAxis, target: 'x' | 'y') {
  return axis === 'both' || axis === target;
}

function setBooleanData(element: HTMLElement, name: string, value: boolean) {
  if (value) element.dataset[name] = 'true';
  else delete element.dataset[name];
}

function canScrollInDirection(position: number, maximum: number, delta: number) {
  if (delta < 0) return position > 0;
  if (delta > 0) return position < maximum;
  return false;
}

const SCROLLABLE_OVERFLOW_VALUES = new Set(['auto', 'scroll', 'overlay']);

function elementCanScrollInDirection(element: HTMLElement, targetAxis: 'x' | 'y', delta: number) {
  const style = window.getComputedStyle(element);
  const overflow = targetAxis === 'x' ? style.overflowX : style.overflowY;
  if (!SCROLLABLE_OVERFLOW_VALUES.has(overflow)) return false;
  const maximum = targetAxis === 'x'
    ? Math.max(0, element.scrollWidth - element.clientWidth)
    : Math.max(0, element.scrollHeight - element.clientHeight);
  const position = targetAxis === 'x' ? element.scrollLeft : element.scrollTop;
  return maximum > 1 && canScrollInDirection(position, maximum, delta);
}

function descendantCanScrollInDirection(
  target: EventTarget | null,
  viewport: HTMLElement,
  targetAxis: 'x' | 'y',
  delta: number,
) {
  let element = target instanceof Element ? target : null;
  while (element && element !== viewport) {
    if (element instanceof HTMLElement && elementCanScrollInDirection(element, targetAxis, delta)) {
      return true;
    }
    element = element.parentElement;
  }
  return false;
}

export function useOverlayScrollbar({
  rootRef,
  viewportRef,
  horizontalTrackRef,
  horizontalThumbRef,
  verticalTrackRef,
  verticalThumbRef,
  axis,
  horizontalVisibility,
  verticalAutoHide,
  idleDelay,
  verticalPriority,
}: UseOverlayScrollbarOptions) {
  const hideTimerRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const previousPositionRef = useRef({ left: 0, top: 0 });

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = undefined;
    }
  }, []);

  const hideVertical = useCallback(() => {
    const root = rootRef.current;
    if (!root || root.dataset.scrollbarDraggingY === 'true') return;
    delete root.dataset.scrollbarActiveY;
    hideTimerRef.current = undefined;
  }, [rootRef]);

  const revealVertical = useCallback(() => {
    const root = rootRef.current;
    if (!root || root.dataset.scrollableY !== 'true') return;
    root.dataset.scrollbarActiveY = 'true';
    clearHideTimer();
    if (verticalAutoHide) hideTimerRef.current = window.setTimeout(hideVertical, idleDelay);
  }, [clearHideTimer, hideVertical, idleDelay, rootRef, verticalAutoHide]);

  const syncMetrics = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;

    const horizontalTrack = horizontalTrackRef.current;
    const verticalTrack = verticalTrackRef.current;
    const horizontalThumb = horizontalThumbRef.current;
    const verticalThumb = verticalThumbRef.current;

    const scrollableX = supportsAxis(axis, 'x') && viewport.scrollWidth > viewport.clientWidth + 1;
    const scrollableY = supportsAxis(axis, 'y') && viewport.scrollHeight > viewport.clientHeight + 1;
    setBooleanData(root, 'scrollableX', scrollableX);
    setBooleanData(root, 'scrollableY', scrollableY);

    if (!scrollableY) {
      clearHideTimer();
      delete root.dataset.scrollbarActiveY;
      delete root.dataset.scrollbarDraggingY;
    } else if (!verticalAutoHide) {
      root.dataset.scrollbarActiveY = 'true';
    }

    if (scrollableX && horizontalTrack && horizontalThumb) {
      const trackSize = horizontalTrack.clientWidth;
      const maximum = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const thumbSize = Math.min(trackSize, Math.max(MIN_THUMB_SIZE, trackSize * viewport.clientWidth / viewport.scrollWidth));
      const travel = Math.max(0, trackSize - thumbSize);
      const offset = maximum > 0 ? travel * viewport.scrollLeft / maximum : 0;
      horizontalThumb.style.width = `${thumbSize}px`;
      horizontalThumb.style.transform = `translate3d(${offset}px, 0, 0)`;
      horizontalThumb.setAttribute('aria-valuemin', '0');
      horizontalThumb.setAttribute('aria-valuemax', String(Math.round(maximum)));
      horizontalThumb.setAttribute('aria-valuenow', String(Math.round(viewport.scrollLeft)));
    }

    if (scrollableY && verticalTrack && verticalThumb) {
      const trackSize = verticalTrack.clientHeight;
      const maximum = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const thumbSize = Math.min(trackSize, Math.max(MIN_THUMB_SIZE, trackSize * viewport.clientHeight / viewport.scrollHeight));
      const travel = Math.max(0, trackSize - thumbSize);
      const offset = maximum > 0 ? travel * viewport.scrollTop / maximum : 0;
      verticalThumb.style.height = `${thumbSize}px`;
      verticalThumb.style.transform = `translate3d(0, ${offset}px, 0)`;
      verticalThumb.setAttribute('aria-valuemin', '0');
      verticalThumb.setAttribute('aria-valuemax', String(Math.round(maximum)));
      verticalThumb.setAttribute('aria-valuenow', String(Math.round(viewport.scrollTop)));
    }

    if (horizontalVisibility === 'always' && scrollableX) root.dataset.scrollbarActiveX = 'true';
    else if (!scrollableX) delete root.dataset.scrollbarActiveX;
  }, [
    axis,
    clearHideTimer,
    horizontalThumbRef,
    horizontalTrackRef,
    horizontalVisibility,
    rootRef,
    verticalAutoHide,
    verticalThumbRef,
    verticalTrackRef,
    viewportRef,
  ]);

  const scheduleSync = useCallback(() => {
    if (frameRef.current !== undefined) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = undefined;
      syncMetrics();
    });
  }, [syncMetrics]);

  useEffect(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return undefined;

    previousPositionRef.current = { left: viewport.scrollLeft, top: viewport.scrollTop };
    const handleScroll = () => {
      const previous = previousPositionRef.current;
      const next = { left: viewport.scrollLeft, top: viewport.scrollTop };
      if (next.top !== previous.top) revealVertical();
      if (next.left !== previous.left && horizontalVisibility === 'activity') {
        root.dataset.scrollbarActiveX = 'true';
      }
      previousPositionRef.current = next;
      scheduleSync();
    };

    const handleWheel = (event: WheelEvent) => {
      const maximumX = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const maximumY = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const horizontalIntent = event.shiftKey
        || Math.abs(event.deltaX) > Math.abs(event.deltaY) * AXIS_DOMINANCE_RATIO;

      if (horizontalIntent && supportsAxis(axis, 'x') && maximumX > 0) {
        const delta = event.shiftKey ? event.deltaY : event.deltaX;
        if (descendantCanScrollInDirection(event.target, viewport, 'x', delta)) return;
        if (canScrollInDirection(viewport.scrollLeft, maximumX, delta)) {
          event.preventDefault();
          event.stopPropagation();
          viewport.scrollLeft += delta;
        }
        return;
      }

      if (
        verticalPriority
        && supportsAxis(axis, 'y')
        && Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ) {
        if (descendantCanScrollInDirection(event.target, viewport, 'y', event.deltaY)) return;
        if (maximumY > 0 && canScrollInDirection(viewport.scrollTop, maximumY, event.deltaY)) {
          event.preventDefault();
          event.stopPropagation();
          viewport.scrollTop += event.deltaY;
        }
      }
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    viewport.addEventListener('wheel', handleWheel, { passive: false });

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleSync);
    observer?.observe(root);
    observer?.observe(viewport);
    Array.from(viewport.children).forEach((child) => observer?.observe(child));
    window.addEventListener('resize', scheduleSync);
    scheduleSync();

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      viewport.removeEventListener('wheel', handleWheel);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleSync);
      clearHideTimer();
      if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
      delete root.dataset.scrollbarActiveX;
      delete root.dataset.scrollbarActiveY;
      delete root.dataset.scrollbarDraggingX;
      delete root.dataset.scrollbarDraggingY;
    };
  }, [
    axis,
    clearHideTimer,
    horizontalVisibility,
    revealVertical,
    rootRef,
    scheduleSync,
    verticalPriority,
    viewportRef,
  ]);

  const startThumbDrag = useCallback((targetAxis: 'x' | 'y', event: ReactPointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const track = targetAxis === 'x' ? horizontalTrackRef.current : verticalTrackRef.current;
    const thumb = targetAxis === 'x' ? horizontalThumbRef.current : verticalThumbRef.current;
    if (!root || !viewport || !track || !thumb) return;

    event.preventDefault();
    event.stopPropagation();
    const startPointer = targetAxis === 'x' ? event.clientX : event.clientY;
    const startScroll = targetAxis === 'x' ? viewport.scrollLeft : viewport.scrollTop;
    const trackSize = targetAxis === 'x' ? track.clientWidth : track.clientHeight;
    const thumbSize = targetAxis === 'x' ? thumb.clientWidth : thumb.clientHeight;
    const maximum = targetAxis === 'x'
      ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const travel = Math.max(1, trackSize - thumbSize);
    const ratio = maximum / travel;

    root.dataset[targetAxis === 'x' ? 'scrollbarDraggingX' : 'scrollbarDraggingY'] = 'true';
    if (targetAxis === 'x') root.dataset.scrollbarActiveX = 'true';
    else revealVertical();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentPointer = targetAxis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      const next = startScroll + (currentPointer - startPointer) * ratio;
      if (targetAxis === 'x') viewport.scrollLeft = next;
      else viewport.scrollTop = next;
    };
    const handlePointerUp = () => {
      delete root.dataset[targetAxis === 'x' ? 'scrollbarDraggingX' : 'scrollbarDraggingY'];
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      if (targetAxis === 'y') revealVertical();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  }, [
    horizontalThumbRef,
    horizontalTrackRef,
    revealVertical,
    rootRef,
    verticalThumbRef,
    verticalTrackRef,
    viewportRef,
  ]);

  const handleTrackPointerDown = useCallback((targetAxis: 'x' | 'y', event: ReactPointerEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    if (targetAxis === 'x') {
      const direction = event.clientX < rect.left + rect.width / 2 ? -1 : 1;
      viewport.scrollLeft += direction * viewport.clientWidth * 0.8;
    } else {
      const direction = event.clientY < rect.top + rect.height / 2 ? -1 : 1;
      revealVertical();
      viewport.scrollTop += direction * viewport.clientHeight * 0.8;
    }
  }, [revealVertical, viewportRef]);

  const handleThumbKeyDown = useCallback((targetAxis: 'x' | 'y', event: ReactKeyboardEvent<HTMLElement>) => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const horizontal = targetAxis === 'x';
    const line = 40;
    const page = (horizontal ? viewport.clientWidth : viewport.clientHeight) * 0.8;
    const maximum = horizontal
      ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    let next: number | undefined;
    const current = horizontal ? viewport.scrollLeft : viewport.scrollTop;

    if ((horizontal && event.key === 'ArrowLeft') || (!horizontal && event.key === 'ArrowUp')) next = current - line;
    if ((horizontal && event.key === 'ArrowRight') || (!horizontal && event.key === 'ArrowDown')) next = current + line;
    if (event.key === 'PageUp') next = current - page;
    if (event.key === 'PageDown') next = current + page;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = maximum;
    if (next === undefined) return;

    event.preventDefault();
    if (horizontal) viewport.scrollLeft = next;
    else {
      revealVertical();
      viewport.scrollTop = next;
    }
  }, [revealVertical, viewportRef]);

  return {
    scheduleSync,
    startThumbDrag,
    handleTrackPointerDown,
    handleThumbKeyDown,
  };
}
