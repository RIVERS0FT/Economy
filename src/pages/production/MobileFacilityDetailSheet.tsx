import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type TouchEvent as ReactTouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ScrollArea } from '../../components/ui/ScrollArea';
import { useWorkspaceFloatingLayer } from '../../components/ui/WorkspaceFloatingLayer';
import {
  FACILITY_SHEET_AXIS_DOMINANCE,
  FACILITY_SHEET_AXIS_THRESHOLD,
  FACILITY_SHEET_CLOSE_VELOCITY,
  FACILITY_SHEET_MIN_FLING_DISTANCE,
  FACILITY_SHEET_SETTLE_DURATION,
  FacilityClusterDetailBody,
  FacilityClusterDetailHeader,
  FacilityMarketAction,
  type FacilityClusterDetailSharedProps,
  type FacilityClusterEntry,
  type FacilitySheetDragSession,
  isFacilitySheetInteractiveTarget,
  isReducedMotionPreferred,
} from './ProductionFacilityDetail';

export function MobileFacilityDetailSheet({
  entry,
  products,
  inventories,
  now,
  isOpen,
  returnFocusRef,
  onClose,
  onToggle,
  onRecipeChange,
  onOpenMarket,
}: Omit<FacilityClusterDetailSharedProps, 'entry'> & {
  entry: FacilityClusterEntry | undefined;
  isOpen: boolean;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const floatingLayer = useWorkspaceFloatingLayer();
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const dragSessionRef = useRef<FacilitySheetDragSession | null>(null);
  const dragFrameRef = useRef<number | undefined>(undefined);
  const settleTimerRef = useRef<number | undefined>(undefined);
  const closeCompletionRef = useRef<(() => void) | undefined>(undefined);
  const backdropPointerIdRef = useRef<number | undefined>(undefined);
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
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    const height = Math.max(1, sheet.getBoundingClientRect().height);
    const offset = Math.max(0, Math.min(pendingOffsetRef.current, height));
    const backdropProgress = Math.max(0.3, 1 - (offset / height) * 0.7);
    sheet.style.setProperty('--facility-sheet-drag-offset', `${offset}px`);
    backdrop.style.setProperty('--facility-sheet-backdrop-progress', String(backdropProgress));
  }, []);

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
    pendingOffsetRef.current = 0;
    isClosingRef.current = false;
    backdropPointerIdRef.current = undefined;

    const sheet = sheetRef.current;
    const backdrop = backdropRef.current;
    if (!sheet || !backdrop) return;
    sheet.classList.remove('is-dragging', 'is-settling', 'is-closing');
    sheet.style.removeProperty('--facility-sheet-drag-offset');
    backdrop.style.removeProperty('--facility-sheet-backdrop-progress');
    delete sheet.dataset.dragSource;
  }, []);

  const completeClose = useCallback(() => {
    settleTimerRef.current = undefined;
    const completion = closeCompletionRef.current;
    closeCompletionRef.current = undefined;
    dragSessionRef.current = null;
    backdropPointerIdRef.current = undefined;
    pendingOffsetRef.current = 0;
    isClosingRef.current = false;
    onClose();
    completion?.();
  }, [onClose]);

  const requestClose = useCallback(
    (completion?: () => void) => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      closeCompletionRef.current = completion;
      dragSessionRef.current = null;
      clearSettleTimer();

      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (!sheet || !backdrop || isReducedMotionPreferred()) {
        completeClose();
        return;
      }

      sheet.classList.remove('is-dragging');
      sheet.classList.add('is-settling', 'is-closing');
      applyDragOffset(sheet.getBoundingClientRect().height);
      backdrop.style.setProperty('--facility-sheet-backdrop-progress', '0');
      settleTimerRef.current = window.setTimeout(completeClose, FACILITY_SHEET_SETTLE_DURATION);
    },
    [applyDragOffset, clearSettleTimer, completeClose],
  );

  const settleDrag = useCallback(
    (close: boolean) => {
      const sheet = sheetRef.current;
      const backdrop = backdropRef.current;
      if (!sheet || !backdrop) {
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
      backdrop.style.setProperty('--facility-sheet-backdrop-progress', '1');
      settleTimerRef.current = window.setTimeout(resetDragStyles, FACILITY_SHEET_SETTLE_DURATION);
    },
    [applyDragOffset, clearSettleTimer, requestClose, resetDragStyles],
  );

  const beginDrag = useCallback(
    (clientX: number, clientY: number, target: EventTarget | null, pointerId?: number) => {
      if (isClosingRef.current || isFacilitySheetInteractiveTarget(target)) return false;
      const targetElement = target instanceof Element ? target : null;
      const source = targetElement?.closest('.facility-detail-sheet-header, .facility-detail-sheet-drag-handle')
        ? 'header'
        : targetElement?.closest('.facility-detail-sheet-scroll')
          ? 'content'
          : null;
      if (!source) return false;
      if (source === 'content' && (scrollViewportRef.current?.scrollTop ?? 0) > 0) return false;

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
    [clearSettleTimer, resetDragStyles],
  );

  const updateDrag = useCallback(
    (clientX: number, clientY: number, preventDefault: () => void) => {
      const session = dragSessionRef.current;
      const sheet = sheetRef.current;
      if (!session || !sheet) return;
      if (session.source === 'content' && !session.active && (scrollViewportRef.current?.scrollTop ?? 0) > 0) {
        dragSessionRef.current = null;
        return;
      }

      const deltaX = clientX - session.startX;
      const deltaY = clientY - session.startY;
      if (!session.active) {
        if (Math.hypot(deltaX, deltaY) < FACILITY_SHEET_AXIS_THRESHOLD) return;
        if (deltaY <= 0 || deltaY < Math.abs(deltaX) * FACILITY_SHEET_AXIS_DOMINANCE) {
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
        (session.offset >= FACILITY_SHEET_MIN_FLING_DISTANCE && velocity >= FACILITY_SHEET_CLOSE_VELOCITY);
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
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
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

  const handleBackdropPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    const isPrimaryMouseButton = event.pointerType !== 'mouse' || event.button === 0;
    backdropPointerIdRef.current =
      event.target === event.currentTarget && isPrimaryMouseButton ? event.pointerId : undefined;
  }, []);

  const handleBackdropPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const startedOnBackdrop = backdropPointerIdRef.current === event.pointerId;
      backdropPointerIdRef.current = undefined;
      if (!startedOnBackdrop || event.target !== event.currentTarget) return;
      requestClose();
    },
    [requestClose],
  );

  const handleBackdropPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (backdropPointerIdRef.current === event.pointerId) backdropPointerIdRef.current = undefined;
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    clearSettleTimer();
    resetDragStyles();
    closeCompletionRef.current = undefined;
    dragSessionRef.current = null;

    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const pageScrollArea = pageScroll?.closest<HTMLElement>('.page-scroll-area');
    const previousBodyOverflow = document.body.style.overflow;
    const previousPageOverflow = pageScroll?.style.overflowY ?? '';
    const previousPageScrollbarSuppressed = pageScrollArea?.dataset.modalScrollbarSuppressed;
    document.body.style.overflow = 'hidden';
    if (pageScroll) pageScroll.style.overflowY = 'hidden';
    if (pageScrollArea) pageScrollArea.dataset.modalScrollbarSuppressed = 'true';

    const focusFrame = window.requestAnimationFrame(() => sheetRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        sheetRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        sheetRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === sheetRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      if (pageScroll) pageScroll.style.overflowY = previousPageOverflow;
      if (pageScrollArea) {
        if (previousPageScrollbarSuppressed === undefined) delete pageScrollArea.dataset.modalScrollbarSuppressed;
        else pageScrollArea.dataset.modalScrollbarSuppressed = previousPageScrollbarSuppressed;
      }
      requestAnimationFrame(() => returnFocusRef.current?.focus());
    };
  }, [clearSettleTimer, isOpen, requestClose, resetDragStyles, returnFocusRef]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) onClose();
    };
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, [isOpen, onClose]);

  useEffect(
    () => () => {
      clearSettleTimer();
      if (dragFrameRef.current !== undefined) window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = undefined;
      dragSessionRef.current = null;
      closeCompletionRef.current = undefined;
      resetDragStyles();
    },
    [clearSettleTimer, resetDragStyles],
  );

  if (!isOpen || !entry || !floatingLayer) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="facility-detail-sheet-backdrop"
      onPointerDown={handleBackdropPointerDown}
      onPointerUp={handleBackdropPointerUp}
      onPointerCancel={handleBackdropPointerCancel}
    >
      <div
        ref={sheetRef}
        className="facility-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-facility-detail-title"
        tabIndex={-1}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          dragSessionRef.current = null;
          settleDrag(false);
        }}
      >
        <div className="facility-detail-sheet-header">
          <div className="facility-detail-sheet-drag-handle" aria-hidden="true">
            <span className="facility-detail-sheet-handle" />
          </div>
          <FacilityClusterDetailHeader
            entry={entry}
            onToggle={onToggle}
            titleId="mobile-facility-detail-title"
          />
        </div>

        <ScrollArea
          axis="y"
          className="facility-detail-sheet-scroll-area"
          viewportClassName="facility-detail-sheet-scroll"
          viewportRef={scrollViewportRef}
          viewportRole="region"
          viewportAriaLabel={`${entry.type.name}工厂详情内容`}
          viewportTabIndex={0}
          scrollbarVisibility="adaptive"
        >
          <FacilityClusterDetailBody
            entry={entry}
            products={products}
            inventories={inventories}
            now={now}
            onRecipeChange={onRecipeChange}
          />
        </ScrollArea>

        <div className="facility-detail-sheet-footer">
          <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />
        </div>
      </div>
    </div>,
    floatingLayer,
  );
}
