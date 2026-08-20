import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  useMobileWorkspaceSheetHost,
  type MobileWorkspaceDetailRegistration,
  type MobileWorkspaceSheetRequestClose,
} from './MobileWorkspaceSheetHost';

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
  const host = useMobileWorkspaceSheetHost();
  const id = useId();
  const onCloseRef = useRef(onClose);
  const hasFooter = Boolean(footer);
  onCloseRef.current = onClose;
  const controllerRef = useRef({
    ariaLabel,
    ariaLabelledBy,
    viewportAriaLabel,
    returnFocusRef,
    onClose: () => onCloseRef.current(),
    hasFooter,
  });
  controllerRef.current.ariaLabel = ariaLabel;
  controllerRef.current.ariaLabelledBy = ariaLabelledBy;
  controllerRef.current.viewportAriaLabel = viewportAriaLabel;
  controllerRef.current.returnFocusRef = returnFocusRef;
  controllerRef.current.hasFooter = hasFooter;

  const registration = useMemo<MobileWorkspaceDetailRegistration>(() => ({
    id,
    controllerRef,
  }), [id]);

  const registerDetail = host?.registerDetail;
  const unregisterDetail = host?.unregisterDetail;
  const refreshDetail = host?.refreshDetail;
  const requestDetailClose = host?.requestDetailClose;
  const isMobileViewport = host?.isMobileViewport ?? false;

  useLayoutEffect(() => {
    if (!isOpen || !isMobileViewport || !registerDetail || !unregisterDetail) return undefined;
    registerDetail(registration);
    return () => unregisterDetail(id);
  }, [id, isMobileViewport, isOpen, registerDetail, registration, unregisterDetail]);

  useEffect(() => {
    if (!isOpen || !isMobileViewport || !refreshDetail) return;
    refreshDetail(id);
  }, [ariaLabel, ariaLabelledBy, hasFooter, id, isMobileViewport, isOpen, refreshDetail, returnFocusRef, viewportAriaLabel]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    if (!mediaQuery.matches) {
      onCloseRef.current();
      return undefined;
    }
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) onCloseRef.current();
    };
    mediaQuery.addEventListener('change', closeOnDesktop);
    return () => mediaQuery.removeEventListener('change', closeOnDesktop);
  }, [isOpen]);

  const requestClose = useMemo<MobileDetailSheetRequestClose>(() => (
    (completion) => requestDetailClose?.(id, completion)
  ), [id, requestDetailClose]);
  const resolvedFooter = typeof footer === 'function' ? footer(requestClose) : footer;

  if (
    !isOpen
    || !isMobileViewport
    || !host
    || host.activeDetailId !== id
    || !host.detailContentLayer
  ) return null;

  return (
    <>
      {createPortal(children, host.detailContentLayer)}
      {resolvedFooter && host.detailFooterLayer
        ? createPortal(resolvedFooter, host.detailFooterLayer)
        : null}
    </>
  );
}
