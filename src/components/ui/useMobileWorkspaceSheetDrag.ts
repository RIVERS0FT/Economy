import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react';

const MOBILE_WORKSPACE_SHEET_AXIS_THRESHOLD = 8;
const MOBILE_WORKSPACE_SHEET_AXIS_DOMINANCE = 1.2;
const MOBILE_WORKSPACE_SHEET_MIN_FLING_DISTANCE = 40;
const MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY = 0.75;
export const MOBILE_WORKSPACE_SHEET_SETTLE_DURATION = 200;

interface MobileWorkspaceSheetDragSession {
  pointerId?: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  offset: number;
  source: 'header' | 'content';
  active: boolean;
}

export type MobileWorkspaceSheetRequestClose = (completion?: () => void) => void;

interface UseMobileWorkspaceSheetDragOptions {
  onClose: () => void;
  getScrollTop: (sheet: HTMLDivElement | null) => number;
  headerSelector: string;
  contentSelector: string;
  offsetProperty: string;
  onProgress?: (progress: number) => void;
}

function isReducedMotionPreferred() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobileWorkspaceViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="scrollbar"], .ui-scrollbar, [data-mobile-detail-sheet-no-drag], [data-facility-sheet-no-drag], [data-mobile-workspace-sheet-no-drag]',
    ),
  );
}

export function useMobileWorkspaceSheetDrag({
  onClose,
  getScrollTop,
  headerSelector,
  contentSelector,
  offsetProperty,
  onProgress,
}: UseMobileWorkspaceSheetDragOptions) {
  const onCloseRef = useRef(onClose);
  const getScrollTopRef = useRef(getScrollTop);
  const onProgressRef = useRef(onProgress);
  onCloseRef.current = onClose;
  getScrollTopRef.current = getScrollTop;
  onProgressRef.current = onProgress;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<MobileWorkspaceSheetDragSession | null>(null);
  const dragFrameRef = useRef<number | undefined>(undefined);
  const settleTimerRef = useRef<number | undefined>(undefined);
  const closeCompletionRef = useRef<(() => void) | undefined>(undefined);
  const isClosingRef = useRef(false);
  const pendingOffsetRef = useRef(0);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== undefined) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = undefined;
    }
  }, []);

  const commitDragOffset = useCallback(() => {
    dragFrameRef.current = undefined;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const height = Math.max(1, sheet.getBoundingClientRect().height);
    const offset = Math.max(0, Math.min(pendingOffsetRef.current, height));
    const progress = Math.max(0, Math.min(1, 1 - offset / height));
    sheet.style.setProperty(offsetProperty, `${offset}px`);
    onProgressRef.current?.(progress);
  }, [offsetProperty]);

  const applyDragOffset = useCallback(
    (offset: number) => {
      pendingOffsetRef.current = offset;
      if (dragFrameRef.current === undefined) {
        dragFrameRef.current = window.requestAnimationFrame(commitDragOffset);
      }
    },
    [commitDragOffset],
  );

  const resetDragStyles = useCallback(() => {
    clearSettleTimer();
    pendingOffsetRef.current = 0;
    isClosingRef.current = false;
    closeCompletionRef.current = undefined;
    dragSessionRef.current = null;

    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.classList.remove('is-dragging', 'is-settling', 'is-closing');
    sheet.style.removeProperty(offsetProperty);
    delete sheet.dataset.dragSource;
    onProgressRef.current?.(1);
  }, [clearSettleTimer, offsetProperty]);

  const completeClose = useCallback(() => {
    settleTimerRef.current = undefined;
    const completion = closeCompletionRef.current;
    closeCompletionRef.current = undefined;
    dragSessionRef.current = null;
    pendingOffsetRef.current = 0;
    isClosingRef.current = false;
    onCloseRef.current();
    completion?.();
  }, []);

  const requestClose = useCallback<MobileWorkspaceSheetRequestClose>(
    (completion) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      closeCompletionRef.current = completion;
      dragSessionRef.current = null;
      clearSettleTimer();

      const sheet = sheetRef.current;
      if (!sheet || !isMobileWorkspaceViewport() || isReducedMotionPreferred()) {
        completeClose();
        return;
      }

      sheet.classList.remove('is-dragging');
      sheet.classList.add('is-settling', 'is-closing');
      applyDragOffset(sheet.getBoundingClientRect().height);
      onProgressRef.current?.(0);
      settleTimerRef.current = window.setTimeout(completeClose, MOBILE_WORKSPACE_SHEET_SETTLE_DURATION);
    },
    [applyDragOffset, clearSettleTimer, completeClose],
  );

  const settleDrag = useCallback(
    (close: boolean) => {
      const sheet = sheetRef.current;
      if (!sheet) {
        if (close) requestClose();
        return;
      }

      if (close) {
        requestClose();
        return;
      }

      clearSettleTimer();
      sheet.classList.remove('is-dragging');
      sheet.classList.add('is-settling');
      if (isReducedMotionPreferred()) {
        resetDragStyles();
        return;
      }
      applyDragOffset(0);
      onProgressRef.current?.(1);
      settleTimerRef.current = window.setTimeout(resetDragStyles, MOBILE_WORKSPACE_SHEET_SETTLE_DURATION);
    },
    [applyDragOffset, clearSettleTimer, requestClose, resetDragStyles],
  );

  const beginDrag = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null, pointerId?: number) => {
      if (!isMobileWorkspaceViewport() || isClosingRef.current || isInteractiveTarget(target)) return false;
      const targetElement = target instanceof Element ? target : null;
      const source = targetElement?.closest(headerSelector)
        ? 'header'
        : targetElement?.closest(contentSelector)
          ? 'content'
          : null;
      if (!source) return false;
      if (source === 'content' && getScrollTopRef.current(sheetRef.current) > 0) return false;

      clearSettleTimer();
      resetDragStyles();
      dragSessionRef.current = {
        pointerId,
        startX: clientX,
        startY: clientY,
        lastY: clientY,
        lastTime: performance.now(),
        velocity: 0,
        offset: 0,
        source,
        active: false,
      };
      return true;
    },
    [clearSettleTimer, contentSelector, headerSelector, resetDragStyles],
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number, preventDefault: () => void) => {
      const session = dragSessionRef.current;
      const sheet = sheetRef.current;
      if (!session || !sheet) return;
      if (session.source === 'content' && !session.active && getScrollTopRef.current(sheet) > 0) {
        dragSessionRef.current = null;
        return;
      }

      const deltaX = clientX - session.startX;
      const deltaY = clientY - session.startY;
      if (!session.active) {
        if (Math.hypot(deltaX, deltaY) < MOBILE_WORKSPACE_SHEET_AXIS_THRESHOLD) return;
        if (deltaY <= 0 || deltaY < Math.abs(deltaX) * MOBILE_WORKSPACE_SHEET_AXIS_DOMINANCE) {
          dragSessionRef.current = null;
          return;
        }
        session.active = true;
        sheet.classList.add('is-dragging');
        sheet.dataset.dragSource = session.source;
      }

      preventDefault();
      const currentTime = performance.now();
      const elapsed = Math.max(1, currentTime - session.lastTime);
      session.velocity = Math.max(0, (clientY - session.lastY) / elapsed);
      session.lastY = clientY;
      session.lastTime = currentTime;
      session.offset = Math.max(0, deltaY);
      applyDragOffset(session.offset);
    },
    [applyDragOffset],
  );

  const finishDrag = useCallback(
    (clientY?: number) => {
      const session = dragSessionRef.current;
      dragSessionRef.current = null;
      if (!session?.active) {
        resetDragStyles();
        return;
      }

      const finalY = clientY ?? session.lastY;
      const releaseElapsed = Math.max(1, performance.now() - session.lastTime);
      const releaseVelocity = Math.max(0, (finalY - session.lastY) / releaseElapsed);
      const velocity = Math.max(session.velocity, releaseVelocity);
      const sheetHeight = Math.max(1, sheetRef.current?.getBoundingClientRect().height ?? 1);
      const closeDistance = Math.max(96, Math.min(sheetHeight * 0.25, 160));
      const shouldClose =
        session.offset >= closeDistance ||
        (session.offset >= MOBILE_WORKSPACE_SHEET_MIN_FLING_DISTANCE
          && velocity >= MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY);
      settleDrag(shouldClose);
    },
    [resetDragStyles, settleDrag],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType === 'touch' || !event.isPrimary) return;
      if (!beginDrag(event.clientX, event.clientY, event.target, event.pointerId)) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* Ignore synthetic capture failures. */
      }
    },
    [beginDrag],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      updateDrag(event.clientX, event.clientY, () => event.preventDefault());
    },
    [updateDrag],
  );

  const handlePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const session = dragSessionRef.current;
      if (!session || session.pointerId !== event.pointerId) return;
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        /* Ignore capture cleanup failures. */
      }
      finishDrag(event.clientY);
    },
    [finishDrag],
  );

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      beginDrag(touch.clientX, touch.clientY, event.target);
    },
    [beginDrag],
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      if (event.touches.length !== 1 || !dragSessionRef.current) return;
      const touch = event.touches[0];
      updateDrag(touch.clientX, touch.clientY, () => event.preventDefault());
    },
    [updateDrag],
  );

  const handleTouchEnd = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      const touch = event.changedTouches[0];
      finishDrag(touch?.clientY);
    },
    [finishDrag],
  );

  const cancelDrag = useCallback(() => {
    dragSessionRef.current = null;
    settleDrag(false);
  }, [settleDrag]);

  useEffect(
    () => () => {
      clearSettleTimer();
      if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = undefined;
      dragSessionRef.current = null;
      closeCompletionRef.current = undefined;
    },
    [clearSettleTimer],
  );

  return {
    sheetRef,
    requestClose,
    resetDragStyles,
    handlePointerDown,
    handlePointerMove,
    handlePointerEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    cancelDrag,
  };
}
