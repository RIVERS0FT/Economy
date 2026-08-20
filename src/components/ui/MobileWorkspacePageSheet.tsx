import type { MutableRefObject, ReactNode } from 'react';
import {
  MobileWorkspaceSheetHost,
  type MobileWorkspaceSheetRequestClose,
} from './MobileWorkspaceSheetHost';

export interface MobileWorkspacePageSheetProps {
  pageKey: string;
  onClose: () => void;
  requestCloseRef: MutableRefObject<MobileWorkspaceSheetRequestClose | null>;
  children: ReactNode;
}

/**
 * Compatibility adapter for GameShell. MobileWorkspaceSheetHost owns the only
 * root mobile drawer DOM, including the surface that may cover bottom Chrome;
 * this adapter must never create another sheet surface or pointer layer.
 */
export function MobileWorkspacePageSheet({
  pageKey,
  onClose,
  requestCloseRef,
  children,
}: MobileWorkspacePageSheetProps) {
  return (
    <MobileWorkspaceSheetHost
      pageKey={pageKey}
      onClosePage={onClose}
      requestCloseRef={requestCloseRef}
    >
      {children}
    </MobileWorkspaceSheetHost>
  );
}

export type { MobileWorkspaceSheetRequestClose };
