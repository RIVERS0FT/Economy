import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type StableSelectionContextKey = string | number | null;

export interface StableSelectionOptions<Id extends string> {
  availableIds: readonly Id[];
  fallbackId: Id | '';
  contextKey?: StableSelectionContextKey;
}

export function resolveStableSelection<Id extends string>(
  currentId: Id | '',
  availableIds: ReadonlySet<Id>,
  fallbackId: Id | '',
): Id | '' {
  if (currentId && availableIds.has(currentId)) return currentId;
  if (fallbackId && availableIds.has(fallbackId)) return fallbackId;
  return '';
}

export function useStableSelection<Id extends string>({
  availableIds,
  fallbackId,
  contextKey = null,
}: StableSelectionOptions<Id>): readonly [Id | '', Dispatch<SetStateAction<Id | ''>>] {
  const availableIdSet = useMemo(() => new Set<Id>(availableIds), [availableIds]);
  const [selectedId, setSelectedId] = useState<Id | ''>(() => (
    resolveStableSelection('', availableIdSet, fallbackId)
  ));
  const previousContextKeyRef = useRef<StableSelectionContextKey>(contextKey);

  useEffect(() => {
    const contextChanged = !Object.is(previousContextKeyRef.current, contextKey);
    previousContextKeyRef.current = contextKey;
    setSelectedId((currentId) => resolveStableSelection(
      contextChanged ? '' : currentId,
      availableIdSet,
      fallbackId,
    ));
  }, [availableIdSet, contextKey, fallbackId]);

  return [selectedId, setSelectedId] as const;
}
