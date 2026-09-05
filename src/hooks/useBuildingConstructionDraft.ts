import { useCallback, useState } from 'react';

interface ConstructionSelection {
  typeId: string;
  quantity: number;
}

export interface BuildingConstructionDraft extends ConstructionSelection {
  setTypeId: (typeId: string) => void;
  setQuantity: (quantity: number) => void;
}

// Ephemeral presentation state only. Callers scope by player, save, province and kind.
const drafts = new Map<string, ConstructionSelection>();
const EMPTY_DRAFT: Readonly<ConstructionSelection> = Object.freeze({ typeId: '', quantity: 1 });

export function useBuildingConstructionDraft(scope: string): BuildingConstructionDraft {
  const [selection, setSelection] = useState(() => ({ scope, value: drafts.get(scope) ?? EMPTY_DRAFT }));
  const value = selection.scope === scope ? selection.value : drafts.get(scope) ?? EMPTY_DRAFT;
  const update = useCallback((patch: Partial<ConstructionSelection>) => {
    const previous = drafts.get(scope) ?? EMPTY_DRAFT;
    const next = { ...previous, ...patch };
    if (next.typeId === previous.typeId && next.quantity === previous.quantity) return;
    drafts.set(scope, next);
    setSelection({ scope, value: next });
  }, [scope]);
  const setTypeId = useCallback((typeId: string) => update({ typeId }), [update]);
  const setQuantity = useCallback((quantity: number) => {
    if (Number.isSafeInteger(quantity) && quantity > 0) update({ quantity });
  }, [update]);
  return { ...value, setTypeId, setQuantity };
}
