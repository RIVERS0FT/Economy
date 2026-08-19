import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ScrollArea } from './ScrollArea';
import {
  WorkspaceFloatingLayerContext,
  useWorkspaceDialogLayer,
} from './WorkspaceFloatingLayer';
import {
  useMobileWorkspaceSheetDrag,
  type MobileWorkspaceSheetRequestClose,
} from './useMobileWorkspaceSheetDrag';

export type MobileDetailSheetRequestClose = MobileWorkspaceSheetRequestClose;

export interface MobileWorkspaceDetailSheetProps {
  isOpen: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  viewportAriaLabel: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode | ((requestClose: MobileDetailSheetRequestClose) => ReactNode);
}

export function MobileWorkspaceDetailSheet({
  isOpen,
  ariaLabel,
  ariaLabelledBy,
  viewportAriaLabel,
  returnFocusRef,
  onClose,
  children,
  footer,
}: MobileWorkspaceDetailSheetProps) {
  const dialogLayer = useWorkspaceDialogLayer();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const backdropPointerIdRef = useRef<number | undefined>(undefined);

  const closeFromSharedSheet = useCallback(() => {
    onCloseRef.current();
  }, []);

  const handleSheetProgress = useCallback((progress: number) => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    const backdropProgress = progress <= 0 ? 0 : Math.max(0.3, progress);
    backdrop.style.setProperty('--mobile-detail-sheet-backdrop-progress', String(backdropProgress));
  }, []);

  const {
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
  } = useMobileWorkspaceSheetDrag({
    onClose: closeFromSharedSheet,
    getScrollTop: () => scrollViewportRef.current?.scrollTop ?? 0,
    headerSelector: '.mobile-detail-sheet-header, .mobile-detail-sheet-drag-handle',
    contentSelector: '.mobile-detail-sheet-scroll',
    offsetProperty: '--mobile-detail-sheet-drag-offset',
    onProgress: handleSheetProgress,
  });

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

  useLayoutEffect(() => {
    if (!isOpen) return undefined;

    resetDragStyles();
    backdropPointerIdRef.current = undefined;

    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const pageScrollArea = pageScroll?.closest<HTMLElement>('.page-scroll-area');
    const previousPageOverflow = pageScroll?.style.overflowY ?? '';
    const previousPageScrollTop = pageScroll?.scrollTop ?? 0;
    const previousPageScrollbarSuppressed = pageScrollArea?.dataset.modalScrollbarSuppressed;
    const sheet = sheetRef.current;
    const viewportHeight = Math.max(1, window.visualViewport?.height ?? window.innerHeight);
    const sheetMaxHeight = Math.min(viewportHeight * 0.88, 760);
    sheet?.style.setProperty('--mobile-detail-sheet-max-height', `${Math.round(sheetMaxHeight)}px`);
    if (pageScroll) {
      pageScroll.style.overflowY = 'hidden';
      pageScroll.scrollTop = previousPageScrollTop;
    }
    if (pageScrollArea) pageScrollArea.dataset.modalScrollbarSuppressed = 'true';
    sheet?.focus({ preventScroll: true });

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
        sheetRef.current?.focus({ preventScroll: true });
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
      document.removeEventListener('keydown', handleKeyDown);
      sheet?.style.removeProperty('--mobile-detail-sheet-max-height');
      if (pageScroll) {
        pageScroll.style.overflowY = previousPageOverflow;
        pageScroll.scrollTop = previousPageScrollTop;
      }
      if (pageScrollArea) {
        if (previousPageScrollbarSuppressed === undefined) delete pageScrollArea.dataset.modalScrollbarSuppressed;
        else pageScrollArea.dataset.modalScrollbarSuppressed = previousPageScrollbarSuppressed;
      }
      requestAnimationFrame(() => returnFocusRef.current?.focus({ preventScroll: true }));
    };
  }, [isOpen, requestClose, resetDragStyles, returnFocusRef, sheetRef]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) requestClose();
    };
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, [isOpen, requestClose]);

  if (!isOpen || !dialogLayer) return null;

  const resolvedFooter = typeof footer === 'function' ? footer(requestClose) : footer;

  return createPortal(
    <WorkspaceFloatingLayerContext.Provider value={dialogLayer}>
      <div
        ref={backdropRef}
        className="mobile-detail-sheet-backdrop"
        onPointerDown={handleBackdropPointerDown}
        onPointerUp={handleBackdropPointerUp}
        onPointerCancel={handleBackdropPointerCancel}
      >
        <div
          ref={sheetRef}
          className="mobile-detail-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          tabIndex={-1}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={cancelDrag}
        >
          <div className="mobile-detail-sheet-header">
            <div className="mobile-detail-sheet-drag-handle" aria-hidden="true">
              <span className="mobile-detail-sheet-handle" />
            </div>
          </div>

          <ScrollArea
            axis="y"
            className="mobile-detail-sheet-scroll-area"
            viewportClassName="mobile-detail-sheet-scroll"
            viewportRef={scrollViewportRef}
            viewportRole="region"
            viewportAriaLabel={viewportAriaLabel}
            viewportTabIndex={0}
            scrollbarVisibility="adaptive"
          >
            {children}
          </ScrollArea>

          {resolvedFooter ? (
            <div className="mobile-detail-sheet-footer">
              {resolvedFooter}
            </div>
          ) : null}
        </div>
      </div>
    </WorkspaceFloatingLayerContext.Provider>,
    dialogLayer,
  );
}