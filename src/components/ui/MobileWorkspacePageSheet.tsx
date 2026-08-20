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
 * mobile drawer DOM; this component must never create another sheet surface.
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
