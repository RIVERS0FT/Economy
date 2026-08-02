import { createContext, useContext } from 'react';

// Ordinary floating UI stays inside the workspace safe zone; only approved
// full-viewport modal details use the dialog layer above signed-in Chrome.
export const WorkspaceFloatingLayerContext = createContext<HTMLElement | null>(null);
export const WorkspaceDialogLayerContext = createContext<HTMLElement | null>(null);

export function useWorkspaceFloatingLayer() {
  return useContext(WorkspaceFloatingLayerContext);
}

export function useWorkspaceDialogLayer() {
  return useContext(WorkspaceDialogLayerContext);
}
