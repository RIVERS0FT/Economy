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
const MOBILE_WORKSPACE_SHEET_SETTLE_FALLBACK_DELAY = 100;

interface MobileWorkspaceSheetDragSession {
  pointerId?: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  offset: number;
  height: number;
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
  const settleFrameRef = useRef<number | undefined>(undefined);
  const settleTimerRef = useRef<number | undefined>(undefined);
  const settleTransitionCleanupRef = useRef<(() => void) | undefined>(undefined);
  const closeCompletionRef = useRef<(() => void) | undefined>(undefined);
  const isClosingRef = useRef(false);
  const lockedSheetHeightRef = useRef<number | undefined>(undefined);
  const pendingOffsetRef = useRef(0);

  const clearDragFrame = useCallback(() => {
    if (dragFrameRef.current === undefined) return;
    window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = undefined;
  }, []);

  const clearSettleFrame = useCallback(() => {
    if (settleFrameRef.current === undefined) return;
    window.cancelAnimationFrame(settleFrameRef.current);
    settleFrameRef.current = undefined;
  }, []);

  const clearSettleWait = useCallback(() => {
    if (settleTimerRef.current !== undefined) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = undefined;
    }
    settleTransitionCleanupRef.current?.();
    settleTransitionCleanupRef.current = undefined;
  }, []);

  const commitDragOffset = useCallback(() => {
    dragFrameRef.current = undefined;
    const sheet = sheetRef.current;
    if (!sheet) return;
    const measuredHeight = Math.max(1, sheet.getBoundingClientRect().height);
    const height = lockedSheetHeightRef.current ?? measuredHeight;
    lockedSheetHeightRef.current = height;
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

  const flushDragOffset = useCallback(
    (offset: number) => {
      pendingOffsetRef.current = offset;
      clearDragFrame();
      commitDragOffset();
    },
    [clearDragFrame, commitDragOffset],
  );

  const resetDragStyles = useCallback(() => {
    clearSettleWait();
    clearSettleFrame();
    clearDragFrame();
    pendingOffsetRef.current = 0;
    lockedSheetHeightRef.current = undefined;
    isClosingRef.current = false;
    closeCompletionRef.current = undefined;
    dragSessionRef.current = null;

    const sheet = sheetRef.current;
    if (!sheet) return;
    sheet.classList.remove('is-dragging', 'is-settling', 'is-closing');
    sheet.style.removeProperty(offsetProperty);
    delete sheet.dataset.dragSource;
    onProgressRef.current?.(1);
  }, [clearDragFrame, clearSettleFrame, clearSettleWait, offsetProperty]);

  const completeClose = useCallback(() => {
    clearSettleWait();
    clearSettleFrame();
    clearDragFrame();
    const completion = closeCompletionRef.current;
    closeCompletionRef.current = undefined;
    dragSessionRef.current = null;
    pendingOffsetRef.current = 0;
    lockedSheetHeightRef.current = undefined;
    isClosingRef.current = false;
    onCloseRef.current();
    completion?.();
  }, [clearDragFrame, clearSettleFrame, clearSettleWait]);

  const waitForSettle = useCallback(
    (sheet: HTMLDivElement, completion: () => void) => {
      clearSettleWait();
      let finished = false;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (settleTimerRef.current !== undefined) {
          window.clearTimeout(settleTimerRef.current);
          settleTimerRef.current = undefined;
        }
        settleTransitionCleanupRef.current?.();
        settleTransitionCleanupRef.current = undefined;
        completion();
      };

      const handleTransitionEnd = (event: TransitionEvent) => {
        if (event.target !== sheet || event.propertyName !== 'transform') return;
        finish();
      };

      const cleanup = () => sheet.removeEventListener('transitionend', handleTransitionEnd);
      settleTransitionCleanupRef.current = cleanup;
      sheet.addEventListener('transitionend', handleTransitionEnd);
      settleTimerRef.current = window.setTimeout(
        finish,
        MOBILE_WORKSPACE_SHEET_SETTLE_DURATION + MOBILE_WORKSPACE_SHEET_SETTLE_FALLBACK_DELAY,
      );
    },
    [clearSettleWait],
  );

  const startSettle = useCallback(
    (targetOffset: number, closing: boolean, completion: () => void) => {
      const sheet = sheetRef.current;
      if (!sheet) {
        completion();
        return;
      }

      clearSettleWait();
      clearSettleFrame();
      clearDragFrame();
      // Entry animation belongs only to initial mount. Once this physical
      // surface has entered drag/settle, removing settle classes must never
      // make the CSS entry keyframes start again from the viewport bottom.
      sheet.dataset.entryAnimationComplete = 'true';
      sheet.classList.remove('is-dragging', 'is-closing');
      if (closing) sheet.classList.add('is-settling', 'is-closing');
      else sheet.classList.add('is-settling');

      if (isReducedMotionPreferred()) {
        flushDragOffset(targetOffset);
        completion();
        return;
      }

      // Commit the release position before enabling the target transform. This
      // prevents a queued touchmove RAF from being replaced by the settle target.
      void sheet.getBoundingClientRect().top;
      settleFrameRef.current = window.requestAnimationFrame(() => {
        settleFrameRef.current = undefined;
        flushDragOffset(targetOffset);
        waitForSettle(sheet, completion);
      });
    },
    [clearDragFrame, clearSettleFrame, clearSettleWait, flushDragOffset, waitForSettle],
  );

  const requestClose = useCallback<MobileWorkspaceSheetRequestClose>(
    (completion) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      closeCompletionRef.current = completion;
      dragSessionRef.current = null;

      const sheet = sheetRef.current;
      if (!sheet || !isMobileWorkspaceViewport()) {
        completeClose();
        return;
      }

      const height = lockedSheetHeightRef.current ?? Math.max(1, sheet.getBoundingClientRect().height);
      lockedSheetHeightRef.current = height;
      startSettle(height, true, completeClose);
    },
    [completeClose, startSettle],
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

      startSettle(0, false, resetDragStyles);
    },
    [requestClose, resetDragStyles, startSettle],
  );

  const beginDrag = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null, pointerId?: number) => {
      if (!isMobileWorkspaceViewport() || isClosingRef.current || isInteractiveTarget(target)) return false;
      const sheet = sheetRef.current;
      if (!sheet) return false;
      const targetElement = target instanceof Element ? target : null;
      const source = targetElement?.closest(headerSelector)
        ? 'header'
        : targetElement?.closest(contentSelector)
          ? 'content'
          : null;
      if (!source) return false;
      if (source === 'content' && getScrollTopRef.current(sheet) > 0) return false;

      resetDragStyles();
      const height = Math.max(1, sheet.getBoundingClientRect().height);
      lockedSheetHeightRef.current = height;
      dragSessionRef.current = {
        pointerId,
        startX: clientX,
        startY: clientY,
        lastY: clientY,
        lastTime: performance.now(),
        velocity: 0,
        offset: 0,
        height,
        source,
        active: false,
      };
      return true;
    },
    [contentSelector, headerSelector, resetDragStyles],
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
      if (!session?.active) {
        dragSessionRef.current = null;
        resetDragStyles();
        return;
      }

      const finalY = clientY ?? session.lastY;
      const releaseElapsed = Math.max(1, performance.now() - session.lastTime);
      const releaseVelocity = Math.max(0, (finalY - session.lastY) / releaseElapsed);
      const velocity = Math.max(session.velocity, releaseVelocity);
      session.offset = Math.max(0, finalY - session.startY);
      flushDragOffset(session.offset);

      const closeDistance = Math.max(96, Math.min(session.height * 0.25, 160));
      const shouldClose =
        session.offset >= closeDistance ||
        (session.offset >= MOBILE_WORKSPACE_SHEET_MIN_FLING_DISTANCE
          && velocity >= MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY);
      dragSessionRef.current = null;
      settleDrag(shouldClose);
    },
    [flushDragOffset, resetDragStyles, settleDrag],
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

  const handleTouchEnd = useCallback(() => {
    // The last accepted touchmove is authoritative. Some browser/compositor
    // paths can expose a changedTouches release coordinate outside the tracked
    // drag path, which must not teleport or misclassify the Sheet on release.
    finishDrag();
  }, [finishDrag]);

  const cancelDrag = useCallback(() => {
    const session = dragSessionRef.current;
    if (!session?.active) {
      dragSessionRef.current = null;
      resetDragStyles();
      return;
    }
    flushDragOffset(session.offset);
    dragSessionRef.current = null;
    settleDrag(false);
  }, [flushDragOffset, resetDragStyles, settleDrag]);

  useEffect(
    () => () => {
      clearSettleWait();
      clearSettleFrame();
      clearDragFrame();
      dragSessionRef.current = null;
      closeCompletionRef.current = undefined;
      lockedSheetHeightRef.current = undefined;
    },
    [clearDragFrame, clearSettleFrame, clearSettleWait],
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
