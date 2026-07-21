import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { getInputModality, useInputModality } from '../utils/inputModality';

export type ScrollAxis = 'x' | 'y' | 'both';
export type ScrollbarVisibility = 'adaptive' | 'always' | 'hidden';

type TargetAxis = 'x' | 'y';

interface UseOverlayScrollbarOptions {
  rootRef: RefObject<HTMLElement | null>;
  viewportRef: RefObject<HTMLElement | null>;
  horizontalTrackRef: RefObject<HTMLElement | null>;
  horizontalThumbRef: RefObject<HTMLElement | null>;
  verticalTrackRef: RefObject<HTMLElement | null>;
  verticalThumbRef: RefObject<HTMLElement | null>;
  axis: ScrollAxis;
  scrollbarVisibility: ScrollbarVisibility;
  mouseIdleDelay: number;
  touchVerticalIdleDelay: number;
  verticalPriority: boolean;
}

const MIN_THUMB_SIZE = 44;
const AXIS_DOMINANCE_RATIO = 1.25;

function supportsAxis(axis: ScrollAxis, target: TargetAxis) {
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

function elementCanScrollInDirection(element: HTMLElement, targetAxis: TargetAxis, delta: number) {
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
  targetAxis: TargetAxis,
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

function axisSuffix(targetAxis: TargetAxis) {
  return targetAxis === 'x' ? 'X' : 'Y';
}

export function useOverlayScrollbar({
  rootRef,
  viewportRef,
  horizontalTrackRef,
  horizontalThumbRef,
  verticalTrackRef,
  verticalThumbRef,
  axis,
  scrollbarVisibility,
  mouseIdleDelay,
  touchVerticalIdleDelay,
  verticalPriority,
}: UseOverlayScrollbarOptions) {
  const inputModality = useInputModality();
  const horizontalHideTimerRef = useRef<number | undefined>(undefined);
  const verticalHideTimerRef = useRef<number | undefined>(undefined);
  const frameRef = useRef<number | undefined>(undefined);
  const dragFrameRef = useRef<number | undefined>(undefined);
  const pendingDragRef = useRef<{ axis: TargetAxis; value: number } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const previousPositionRef = useRef({ left: 0, top: 0 });

  const clearAxisHideTimer = useCallback((targetAxis: TargetAxis) => {
    const timerRef = targetAxis === 'x' ? horizontalHideTimerRef : verticalHideTimerRef;
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const hideAxis = useCallback((targetAxis: TargetAxis) => {
    const root = rootRef.current;
    if (!root) return;
    const suffix = axisSuffix(targetAxis);
    const modality = getInputModality();
    if (
      root.dataset[`scrollbarDragging${suffix}`] === 'true'
      || root.dataset[`scrollbarTrackPressing${suffix}`] === 'true'
      || (modality === 'mouse' && root.dataset.scrollbarHover === 'true')
    ) return;
    delete root.dataset[`scrollbarActive${suffix}`];
    const timerRef = targetAxis === 'x' ? horizontalHideTimerRef : verticalHideTimerRef;
    timerRef.current = undefined;
  }, [rootRef]);

  const scheduleHideAxis = useCallback((targetAxis: TargetAxis) => {
    clearAxisHideTimer(targetAxis);
    if (scrollbarVisibility !== 'adaptive') return;
    if (targetAxis === 'x' && getInputModality() === 'touch') return;
    const delay = getInputModality() === 'touch' && targetAxis === 'y'
      ? touchVerticalIdleDelay
      : mouseIdleDelay;
    const timerRef = targetAxis === 'x' ? horizontalHideTimerRef : verticalHideTimerRef;
    timerRef.current = window.setTimeout(() => hideAxis(targetAxis), delay);
  }, [clearAxisHideTimer, hideAxis, mouseIdleDelay, scrollbarVisibility, touchVerticalIdleDelay]);

  const revealAxis = useCallback((targetAxis: TargetAxis) => {
    const root = rootRef.current;
    if (!root || scrollbarVisibility === 'hidden') return;
    const suffix = axisSuffix(targetAxis);
    if (root.dataset[`scrollable${suffix}`] !== 'true') return;
    if (targetAxis === 'x' && getInputModality() === 'touch') {
      delete root.dataset.scrollbarActiveX;
      clearAxisHideTimer('x');
      return;
    }
    root.dataset[`scrollbarActive${suffix}`] = 'true';
    clearAxisHideTimer(targetAxis);
    if (scrollbarVisibility === 'adaptive') scheduleHideAxis(targetAxis);
  }, [clearAxisHideTimer, rootRef, scheduleHideAxis, scrollbarVisibility]);

  const clearAxisState = useCallback((targetAxis: TargetAxis) => {
    const root = rootRef.current;
    if (!root) return;
    const suffix = axisSuffix(targetAxis);
    clearAxisHideTimer(targetAxis);
    delete root.dataset[`scrollbarActive${suffix}`];
    delete root.dataset[`scrollbarDragging${suffix}`];
    delete root.dataset[`scrollbarTrackPressing${suffix}`];
  }, [clearAxisHideTimer, rootRef]);

  const syncMetrics = useCallback(() => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    if (!root || !viewport) return;

    const horizontalTrack = horizontalTrackRef.current;
    const verticalTrack = verticalTrackRef.current;
    const horizontalThumb = horizontalThumbRef.current;
    const verticalThumb = verticalThumbRef.current;
    const modality = getInputModality();

    const scrollableX = supportsAxis(axis, 'x') && viewport.scrollWidth > viewport.clientWidth + 1;
    const scrollableY = supportsAxis(axis, 'y') && viewport.scrollHeight > viewport.clientHeight + 1;
    setBooleanData(root, 'scrollableX', scrollableX);
    setBooleanData(root, 'scrollableY', scrollableY);

    if (!scrollableX || scrollbarVisibility === 'hidden' || modality === 'touch') {
      clearAxisState('x');
    } else if (scrollbarVisibility === 'always') {
      root.dataset.scrollbarActiveX = 'true';
    }

    if (!scrollableY || scrollbarVisibility === 'hidden') {
      clearAxisState('y');
    } else if (scrollbarVisibility === 'always') {
      root.dataset.scrollbarActiveY = 'true';
    }

    if (horizontalThumb) {
      horizontalThumb.setAttribute('aria-hidden', String(!scrollableX || scrollbarVisibility === 'hidden' || modality === 'touch'));
    }
    if (verticalThumb) {
      verticalThumb.setAttribute('aria-hidden', String(!scrollableY || scrollbarVisibility === 'hidden'));
    }

    if (scrollableX && horizontalTrack && horizontalThumb && horizontalTrack.clientWidth > 0) {
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

    if (scrollableY && verticalTrack && verticalThumb && verticalTrack.clientHeight > 0) {
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
  }, [
    axis,
    clearAxisState,
    horizontalThumbRef,
    horizontalTrackRef,
    rootRef,
    scrollbarVisibility,
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
      if (next.top !== previous.top) revealAxis('y');
      if (next.left !== previous.left && getInputModality() !== 'touch') revealAxis('x');
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

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || getInputModality() !== 'mouse') return;
      root.dataset.scrollbarHover = 'true';
      revealAxis('x');
      revealAxis('y');
    };

    const handlePointerLeave = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      delete root.dataset.scrollbarHover;
      scheduleHideAxis('x');
      scheduleHideAxis('y');
    };

    const handleFocusIn = () => {
      root.dataset.scrollbarKeyboardFocus = 'true';
      revealAxis('x');
      revealAxis('y');
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
      delete root.dataset.scrollbarKeyboardFocus;
      scheduleHideAxis('x');
      scheduleHideAxis('y');
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    root.addEventListener('pointerenter', handlePointerEnter);
    root.addEventListener('pointerleave', handlePointerLeave);
    root.addEventListener('focusin', handleFocusIn);
    root.addEventListener('focusout', handleFocusOut);

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleSync);
    observer?.observe(root);
    observer?.observe(viewport);
    Array.from(viewport.children).forEach((child) => observer?.observe(child));
    window.addEventListener('resize', scheduleSync);

    if (inputModality === 'touch') clearAxisState('x');
    if (inputModality === 'mouse' && root.matches(':hover')) {
      root.dataset.scrollbarHover = 'true';
      revealAxis('x');
      revealAxis('y');
    }
    scheduleSync();

    return () => {
      viewport.removeEventListener('scroll', handleScroll);
      viewport.removeEventListener('wheel', handleWheel);
      root.removeEventListener('pointerenter', handlePointerEnter);
      root.removeEventListener('pointerleave', handlePointerLeave);
      root.removeEventListener('focusin', handleFocusIn);
      root.removeEventListener('focusout', handleFocusOut);
      observer?.disconnect();
      window.removeEventListener('resize', scheduleSync);
      clearAxisHideTimer('x');
      clearAxisHideTimer('y');
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      if (frameRef.current !== undefined) window.cancelAnimationFrame(frameRef.current);
      if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
      frameRef.current = undefined;
      dragFrameRef.current = undefined;
      pendingDragRef.current = null;
      delete root.dataset.scrollbarActiveX;
      delete root.dataset.scrollbarActiveY;
      delete root.dataset.scrollbarDraggingX;
      delete root.dataset.scrollbarDraggingY;
      delete root.dataset.scrollbarTrackPressingX;
      delete root.dataset.scrollbarTrackPressingY;
      delete root.dataset.scrollbarHover;
      delete root.dataset.scrollbarKeyboardFocus;
    };
  }, [
    axis,
    clearAxisHideTimer,
    clearAxisState,
    inputModality,
    revealAxis,
    rootRef,
    scheduleHideAxis,
    scheduleSync,
    verticalPriority,
    viewportRef,
  ]);

  const startThumbDrag = useCallback((targetAxis: TargetAxis, event: ReactPointerEvent<HTMLElement>) => {
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const track = targetAxis === 'x' ? horizontalTrackRef.current : verticalTrackRef.current;
    const thumb = targetAxis === 'x' ? horizontalThumbRef.current : verticalThumbRef.current;
    if (!root || !viewport || !track || !thumb || scrollbarVisibility === 'hidden') return;
    if (targetAxis === 'x' && getInputModality() === 'touch') return;

    event.preventDefault();
    event.stopPropagation();
    dragCleanupRef.current?.();

    const pointerId = event.pointerId;
    const dragTarget = event.currentTarget;
    try { dragTarget.setPointerCapture(pointerId); } catch { /* Synthetic pointer events may not own capture. */ }

    const startPointer = targetAxis === 'x' ? event.clientX : event.clientY;
    const startScroll = targetAxis === 'x' ? viewport.scrollLeft : viewport.scrollTop;
    const trackSize = targetAxis === 'x' ? track.clientWidth : track.clientHeight;
    const thumbSize = targetAxis === 'x' ? thumb.clientWidth : thumb.clientHeight;
    const maximum = targetAxis === 'x'
      ? Math.max(0, viewport.scrollWidth - viewport.clientWidth)
      : Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const travel = Math.max(1, trackSize - thumbSize);
    const ratio = maximum / travel;
    const suffix = axisSuffix(targetAxis);

    clearAxisHideTimer(targetAxis);
    root.dataset[`scrollbarDragging${suffix}`] = 'true';
    root.dataset[`scrollbarActive${suffix}`] = 'true';

    const commitPendingDrag = () => {
      dragFrameRef.current = undefined;
      const pending = pendingDragRef.current;
      if (!pending || pending.axis !== targetAxis) return;
      pendingDragRef.current = null;
      if (targetAxis === 'x') viewport.scrollLeft = pending.value;
      else viewport.scrollTop = pending.value;
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      moveEvent.preventDefault();
      const currentPointer = targetAxis === 'x' ? moveEvent.clientX : moveEvent.clientY;
      pendingDragRef.current = {
        axis: targetAxis,
        value: startScroll + (currentPointer - startPointer) * ratio,
      };
      if (dragFrameRef.current === undefined) {
        dragFrameRef.current = window.requestAnimationFrame(commitPendingDrag);
      }
    };

    const cleanup = () => {
      if (dragFrameRef.current !== undefined) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = undefined;
      }
      const pending = pendingDragRef.current;
      if (pending?.axis === targetAxis) {
        if (targetAxis === 'x') viewport.scrollLeft = pending.value;
        else viewport.scrollTop = pending.value;
        pendingDragRef.current = null;
      }
      delete root.dataset[`scrollbarDragging${suffix}`];
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      try {
        if (dragTarget.hasPointerCapture(pointerId)) dragTarget.releasePointerCapture(pointerId);
      } catch { /* Ignore capture cleanup for synthetic events. */ }
      dragCleanupRef.current = null;
      revealAxis(targetAxis);
      scheduleSync();
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      cleanup();
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [
    clearAxisHideTimer,
    horizontalThumbRef,
    horizontalTrackRef,
    revealAxis,
    rootRef,
    scheduleSync,
    scrollbarVisibility,
    verticalThumbRef,
    verticalTrackRef,
    viewportRef,
  ]);

  const handleTrackPointerDown = useCallback((targetAxis: TargetAxis, event: ReactPointerEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || scrollbarVisibility === 'hidden') return;
    if (targetAxis === 'x' && getInputModality() === 'touch') return;
    const root = rootRef.current;
    const viewport = viewportRef.current;
    const thumb = targetAxis === 'x' ? horizontalThumbRef.current : verticalThumbRef.current;
    if (!root || !viewport || !thumb) return;

    event.preventDefault();
    event.stopPropagation();
    const suffix = axisSuffix(targetAxis);
    root.dataset[`scrollbarTrackPressing${suffix}`] = 'true';
    revealAxis(targetAxis);

    const thumbRect = thumb.getBoundingClientRect();
    const pointer = targetAxis === 'x' ? event.clientX : event.clientY;
    const thumbStart = targetAxis === 'x' ? thumbRect.left : thumbRect.top;
    const thumbEnd = targetAxis === 'x' ? thumbRect.right : thumbRect.bottom;
    const direction = pointer < thumbStart ? -1 : pointer > thumbEnd ? 1 : 0;
    if (direction !== 0) {
      if (targetAxis === 'x') viewport.scrollLeft += direction * viewport.clientWidth * 0.8;
      else viewport.scrollTop += direction * viewport.clientHeight * 0.8;
    }

    window.requestAnimationFrame(() => {
      delete root.dataset[`scrollbarTrackPressing${suffix}`];
      revealAxis(targetAxis);
      scheduleSync();
    });
  }, [
    horizontalThumbRef,
    revealAxis,
    rootRef,
    scheduleSync,
    scrollbarVisibility,
    verticalThumbRef,
    viewportRef,
  ]);

  const handleThumbKeyDown = useCallback((targetAxis: TargetAxis, event: ReactKeyboardEvent<HTMLElement>) => {
    const viewport = viewportRef.current;
    if (!viewport || scrollbarVisibility === 'hidden') return;
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
    revealAxis(targetAxis);
    if (horizontal) viewport.scrollLeft = next;
    else viewport.scrollTop = next;
  }, [revealAxis, scrollbarVisibility, viewportRef]);

  return {
    scheduleSync,
    startThumbDrag,
    handleTrackPointerDown,
    handleThumbKeyDown,
  };
}
