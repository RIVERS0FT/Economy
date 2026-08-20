import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
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

interface MobileWorkspaceDetailController {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  viewportAriaLabel: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  hasFooter: boolean;
}

export interface MobileWorkspaceDetailRegistration {
  id: string;
  controllerRef: MutableRefObject<MobileWorkspaceDetailController>;
}

interface MobileWorkspaceSheetHostContextValue {
  isMobileViewport: boolean;
  activeDetailId: string | null;
  dialogLayer: HTMLElement | null;
  detailContentLayer: HTMLElement | null;
  detailFooterLayer: HTMLElement | null;
  registerDetail: (registration: MobileWorkspaceDetailRegistration) => void;
  unregisterDetail: (id: string) => void;
  refreshDetail: (id: string) => void;
  requestDetailClose: (id: string, completion?: () => void) => void;
}

const MobileWorkspaceSheetHostContext = createContext<MobileWorkspaceSheetHostContextValue | null>(null);

export function useMobileWorkspaceSheetHost() {
  return useContext(MobileWorkspaceSheetHostContext);
}

export interface MobileWorkspaceSheetHostProps {
  pageKey: string;
  onClosePage: () => void;
  requestCloseRef: MutableRefObject<MobileWorkspaceSheetRequestClose | null>;
  children: ReactNode;
}

function matchesMobileWorkspaceViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

export function MobileWorkspaceSheetHost({
  pageKey,
  onClosePage,
  requestCloseRef,
  children,
}: MobileWorkspaceSheetHostProps) {
  const dialogLayer = useWorkspaceDialogLayer();
  const [isMobileViewport, setIsMobileViewport] = useState(matchesMobileWorkspaceViewport);
  const [detailStack, setDetailStack] = useState<MobileWorkspaceDetailRegistration[]>([]);
  const [, setDetailRevision] = useState(0);
  const [detailContentLayer, setDetailContentLayer] = useState<HTMLElement | null>(null);
  const [detailFooterLayer, setDetailFooterLayer] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const detailViewRef = useRef<HTMLDivElement | null>(null);
  const detailScrollViewportRef = useRef<HTMLDivElement | null>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  const backdropPointerIdRef = useRef<number | undefined>(undefined);
  const onClosePageRef = useRef(onClosePage);
  const activeDetailRef = useRef<MobileWorkspaceDetailRegistration | null>(null);
  const pageReturnFocusRef = useRef<HTMLElement | null>(null);
  const previousDetailRef = useRef<MobileWorkspaceDetailRegistration | null>(null);
  onClosePageRef.current = onClosePage;

  const activeDetail = detailStack[detailStack.length - 1] ?? null;
  activeDetailRef.current = activeDetail;
  const activeDetailController = activeDetail?.controllerRef.current ?? null;

  const registerDetail = useCallback((registration: MobileWorkspaceDetailRegistration) => {
    setDetailStack((current) => {
      const index = current.findIndex((candidate) => candidate.id === registration.id);
      if (index < 0) return [...current, registration];
      if (current[index] === registration) return current;
      const next = current.slice();
      next[index] = registration;
      return next;
    });
  }, []);

  const unregisterDetail = useCallback((id: string) => {
    setDetailStack((current) => current.filter((candidate) => candidate.id !== id));
  }, []);

  const refreshDetail = useCallback((id: string) => {
    if (activeDetailRef.current?.id === id) setDetailRevision((current) => current + 1);
  }, []);

  const closeActiveSurface = useCallback(() => {
    const detail = activeDetailRef.current;
    if (detail) {
      detail.controllerRef.current.onClose();
      return;
    }
    onClosePageRef.current();
  }, []);

  const handleSheetProgress = useCallback((progress: number) => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    const resolvedProgress = activeDetailRef.current
      ? 1
      : progress <= 0 ? 0 : Math.max(0.3, progress);
    backdrop.style.setProperty('--mobile-detail-sheet-backdrop-progress', String(resolvedProgress));
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
    onClose: closeActiveSurface,
    getScrollTop: (surface) => surface?.querySelector<HTMLElement>(
      '.mobile-detail-sheet-scroll, .page-card-scroll',
    )?.scrollTop ?? 0,
    headerSelector: '.mobile-detail-sheet-drag-handle, .page-fixed-header',
    contentSelector: '.mobile-detail-sheet-scroll, .page-card-scroll',
    offsetProperty: '--mobile-detail-sheet-drag-offset',
    onProgress: handleSheetProgress,
  });

  const requestDetailClose = useCallback((id: string, completion?: () => void) => {
    if (activeDetailRef.current?.id !== id) return;
    requestClose(completion);
  }, [requestClose]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useLayoutEffect(() => {
    sheetRef.current = activeDetail ? detailViewRef.current : rootRef.current;
    resetDragStyles();
  }, [activeDetail?.id, pageKey, resetDragStyles, sheetRef]);

  useEffect(() => {
    if (!isMobileViewport) {
      if (requestCloseRef.current === requestClose) requestCloseRef.current = null;
      return undefined;
    }
    requestCloseRef.current = requestClose;
    return () => {
      if (requestCloseRef.current === requestClose) requestCloseRef.current = null;
    };
  }, [isMobileViewport, requestClose, requestCloseRef]);

  useLayoutEffect(() => {
    if (!isMobileViewport || !dialogLayer) return undefined;

    const root = rootRef.current;
    if (!root) return undefined;
    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const pageScrollArea = pageScroll?.closest<HTMLElement>('.page-scroll-area');
    const previousPageOverflow = pageScroll?.style.overflowY ?? '';
    const previousPageScrollTop = pageScroll?.scrollTop ?? 0;
    const previousPageScrollbarSuppressed = pageScrollArea?.dataset.modalScrollbarSuppressed;
    const activeElement = document.activeElement;
    pageReturnFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    const viewportHeight = Math.max(1, window.visualViewport?.height ?? window.innerHeight);
    const sheetHeight = Math.min(viewportHeight * 0.88, 760);
    root.style.setProperty('--mobile-detail-sheet-max-height', `${Math.round(sheetHeight)}px`);
    if (pageScroll) {
      pageScroll.style.overflowY = 'hidden';
      pageScroll.scrollTop = previousPageScrollTop;
    }
    if (pageScrollArea) pageScrollArea.dataset.modalScrollbarSuppressed = 'true';
    root.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const scope = activeDetailRef.current ? detailViewRef.current : rootRef.current;
      const focusable = Array.from(
        scope?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
      if (focusable.length === 0) {
        event.preventDefault();
        (scope ?? rootRef.current)?.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === scope || document.activeElement === rootRef.current) {
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
      root.style.removeProperty('--mobile-detail-sheet-max-height');
      if (pageScroll) {
        pageScroll.style.overflowY = previousPageOverflow;
        pageScroll.scrollTop = previousPageScrollTop;
      }
      if (pageScrollArea) {
        if (previousPageScrollbarSuppressed === undefined) delete pageScrollArea.dataset.modalScrollbarSuppressed;
        else pageScrollArea.dataset.modalScrollbarSuppressed = previousPageScrollbarSuppressed;
      }
      requestAnimationFrame(() => {
        const returnFocus = pageReturnFocusRef.current;
        if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      });
    };
  }, [dialogLayer, isMobileViewport, requestClose]);

  useLayoutEffect(() => {
    const previousDetail = previousDetailRef.current;
    previousDetailRef.current = activeDetail;
    if (activeDetail) {
      requestAnimationFrame(() => detailViewRef.current?.focus({ preventScroll: true }));
      return;
    }
    if (previousDetail) {
      requestAnimationFrame(() => previousDetail.controllerRef.current.returnFocusRef.current?.focus({ preventScroll: true }));
    }
  }, [activeDetail]);

  const handleBackdropPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) return;
    const isPrimaryMouseButton = event.pointerType !== 'mouse' || event.button === 0;
    backdropPointerIdRef.current =
      event.target === event.currentTarget && isPrimaryMouseButton ? event.pointerId : undefined;
  }, []);

  const handleBackdropPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const startedOnBackdrop = backdropPointerIdRef.current === event.pointerId;
    backdropPointerIdRef.current = undefined;
    if (!startedOnBackdrop || event.target !== event.currentTarget) return;
    requestClose();
  }, [requestClose]);

  const handleBackdropPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (backdropPointerIdRef.current === event.pointerId) backdropPointerIdRef.current = undefined;
  }, []);

  const contextValue = useMemo<MobileWorkspaceSheetHostContextValue>(() => ({
    isMobileViewport,
    activeDetailId: activeDetail?.id ?? null,
    dialogLayer,
    detailContentLayer,
    detailFooterLayer,
    registerDetail,
    unregisterDetail,
    refreshDetail,
    requestDetailClose,
  }), [
    activeDetail?.id,
    detailContentLayer,
    detailFooterLayer,
    dialogLayer,
    isMobileViewport,
    refreshDetail,
    registerDetail,
    requestDetailClose,
    unregisterDetail,
  ]);

  if (!isMobileViewport || !dialogLayer) {
    return (
      <MobileWorkspaceSheetHostContext.Provider value={contextValue}>
        {children}
      </MobileWorkspaceSheetHostContext.Provider>
    );
  }

  return (
    <MobileWorkspaceSheetHostContext.Provider value={contextValue}>
      {createPortal(
        <WorkspaceFloatingLayerContext.Provider value={dialogLayer}>
          <div
            ref={backdropRef}
            className="mobile-detail-sheet-backdrop"
            data-mobile-workspace-sheet-backdrop="true"
            onPointerDown={handleBackdropPointerDown}
            onPointerUp={handleBackdropPointerUp}
            onPointerCancel={handleBackdropPointerCancel}
          >
            <div
              ref={rootRef}
              className="mobile-detail-sheet mobile-workspace-sheet-host"
              data-mobile-workspace-sheet-host="true"
              data-page-key={pageKey}
              data-detail-active={activeDetail ? 'true' : 'false'}
              role="dialog"
              aria-modal="true"
              aria-label={activeDetailController?.ariaLabel ?? (activeDetailController?.ariaLabelledBy ? undefined : '游戏页面')}
              aria-labelledby={activeDetailController?.ariaLabelledBy}
              tabIndex={-1}
              onPointerDown={activeDetail ? undefined : handlePointerDown}
              onPointerMove={activeDetail ? undefined : handlePointerMove}
              onPointerUp={activeDetail ? undefined : handlePointerEnd}
              onPointerCancel={activeDetail ? undefined : handlePointerEnd}
              onTouchStart={activeDetail ? undefined : handleTouchStart}
              onTouchMove={activeDetail ? undefined : handleTouchMove}
              onTouchEnd={activeDetail ? undefined : handleTouchEnd}
              onTouchCancel={activeDetail ? undefined : cancelDrag}
            >
              <div
                className="mobile-workspace-sheet-page-layer"
                aria-hidden={activeDetail ? true : undefined}
                inert={Boolean(activeDetail)}
              >
                <div className="mobile-detail-sheet-header mobile-workspace-sheet-page-header">
                  <div className="mobile-detail-sheet-drag-handle" aria-hidden="true">
                    <span className="mobile-detail-sheet-handle" />
                  </div>
                </div>
                <div className="mobile-workspace-sheet-page-content">
                  {children}
                </div>
              </div>

              {activeDetail ? (
                <div
                  ref={detailViewRef}
                  className="mobile-workspace-sheet-detail-view"
                  data-mobile-workspace-sheet-detail-view="true"
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
                    viewportRef={detailScrollViewportRef}
                    viewportRole="region"
                    viewportAriaLabel={activeDetailController?.viewportAriaLabel ?? '详情内容'}
                    viewportTabIndex={0}
                    scrollbarVisibility="adaptive"
                  >
                    <div ref={setDetailContentLayer} className="mobile-workspace-sheet-detail-content-slot" />
                  </ScrollArea>

                  {activeDetailController?.hasFooter ? (
                    <div ref={setDetailFooterLayer} className="mobile-detail-sheet-footer" />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </WorkspaceFloatingLayerContext.Provider>,
        dialogLayer,
      )}
    </MobileWorkspaceSheetHostContext.Provider>
  );
}

export type { MobileWorkspaceSheetRequestClose };
