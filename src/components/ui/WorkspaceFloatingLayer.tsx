import { createContext, useContext } from 'react';

export const WorkspaceFloatingLayerContext = createContext<HTMLElement | null>(null);

export function useWorkspaceFloatingLayer() {
  return useContext(WorkspaceFloatingLayerContext);
}
