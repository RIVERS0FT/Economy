import { useEffect, useState, type MutableRefObject, type ReactNode } from 'react';
import {
  useMobileWorkspaceSheetDrag,
  type MobileWorkspaceSheetRequestClose,
} from './useMobileWorkspaceSheetDrag';

export interface MobileWorkspacePageSheetProps {
  pageKey: string;
  onClose: () => void;
  requestCloseRef: MutableRefObject<MobileWorkspaceSheetRequestClose | null>;
  children: ReactNode;
}

function matchesMobileWorkspaceViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

export function MobileWorkspacePageSheet({
  pageKey,
  onClose,
  requestCloseRef,
  children,
}: MobileWorkspacePageSheetProps) {
  const [isMobileViewport, setIsMobileViewport] = useState(matchesMobileWorkspaceViewport);
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
    onClose,
    getScrollTop: (sheet) => sheet?.querySelector<HTMLElement>('.page-card-scroll')?.scrollTop ?? 0,
    headerSelector: '.mobile-workspace-page-sheet-drag-handle, .page-fixed-header',
    contentSelector: '.page-card-scroll',
    offsetProperty: '--mobile-workspace-page-sheet-drag-offset',
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const handleChange = (event: MediaQueryListEvent) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

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

  useEffect(() => {
    resetDragStyles();
  }, [pageKey, resetDragStyles]);

  if (!isMobileViewport) return <>{children}</>;

  return (
    <div
      ref={sheetRef}
      className="mobile-workspace-page-sheet"
      data-mobile-workspace-page-sheet="true"
      data-page-key={pageKey}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={cancelDrag}
    >
      <div className="mobile-workspace-page-sheet-drag-handle" aria-hidden="true">
        <span className="mobile-workspace-page-sheet-handle" />
      </div>
      <div className="mobile-workspace-page-sheet-content">
        {children}
      </div>
    </div>
  );
}

export type { MobileWorkspaceSheetRequestClose };
