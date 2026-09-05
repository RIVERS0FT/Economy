import { useCallback, useState } from 'react';

interface ConstructionValues {
  typeId: string;
  quantity: number;
}

export interface BuildingConstructionDraft extends ConstructionValues {
  setTypeId: (typeId: string) => void;
  setQuantity: (quantity: number) => void;
}

// UI-only drafts survive tab/detail navigation, never enter the game save or submit actions.
const drafts = new Map<string, ConstructionValues>();
const EMPTY_DRAFT: ConstructionValues = { typeId: '', quantity: 1 };

export function useBuildingConstructionDraft(scope: string): BuildingConstructionDraft {
  const [selection, setSelection] = useState(() => ({ scope, value: drafts.get(scope) ?? EMPTY_DRAFT }));
  const value = selection.scope === scope ? selection.value : drafts.get(scope) ?? EMPTY_DRAFT;
  const update = useCallback((patch: Partial<ConstructionValues>) => {
    const next = { ...(drafts.get(scope) ?? EMPTY_DRAFT), ...patch };
    drafts.set(scope, next);
    setSelection({ scope, value: next });
  }, [scope]);
  const setTypeId = useCallback((typeId: string) => update({ typeId }), [update]);
  const setQuantity = useCallback((quantity: number) => {
    if (Number.isInteger(quantity) && quantity >= 1 && quantity <= 100) update({ quantity });
  }, [update]);
  return { ...value, setTypeId, setQuantity };
}
