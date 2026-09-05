import { useCallback, useState } from 'react';
import type { BuildingKindFilter } from '../components/buildings/BuildingTypeFilter';

// Presentation-only session state, scoped by player and directory. No persisted game data.
const selections = new Map<string, BuildingKindFilter>();

export function useBuildingTypeFilter(scope: string) {
  const [selection, setSelection] = useState(() => ({ scope, value: selections.get(scope) ?? 'all' as BuildingKindFilter }));
  const value = selection.scope === scope ? selection.value : selections.get(scope) ?? 'all';
  const setValue = useCallback((next: BuildingKindFilter) => {
    selections.set(scope, next);
    setSelection({ scope, value: next });
  }, [scope]);
  return [value, setValue] as const;
}
