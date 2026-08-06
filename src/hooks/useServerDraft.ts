import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type ServerDraftRevision = string | number;
export type ServerDraftResetKey = string | number | null;

export interface ServerDraftSnapshot<Value> {
  draft: Value;
  baseValue: Value;
  baseRevision: ServerDraftRevision;
  resetKey: ServerDraftResetKey;
  dirty: boolean;
  conflicted: boolean;
}

export interface ServerDraftOptions<Value> {
  serverValue: Value;
  serverRevision: ServerDraftRevision;
  resetKey: ServerDraftResetKey;
  isEqual?: (left: Value, right: Value) => boolean;
}

const objectIs = <Value,>(left: Value, right: Value) => Object.is(left, right);

function cleanServerDraft<Value>(
  serverValue: Value,
  serverRevision: ServerDraftRevision,
  resetKey: ServerDraftResetKey,
): ServerDraftSnapshot<Value> {
  return {
    draft: serverValue,
    baseValue: serverValue,
    baseRevision: serverRevision,
    resetKey,
    dirty: false,
    conflicted: false,
  };
}

export function reconcileServerDraft<Value>(
  current: ServerDraftSnapshot<Value>,
  {
    serverValue,
    serverRevision,
    resetKey,
    isEqual = objectIs,
  }: ServerDraftOptions<Value>,
): ServerDraftSnapshot<Value> {
  if (!Object.is(current.resetKey, resetKey)) {
    return cleanServerDraft(serverValue, serverRevision, resetKey);
  }
  if (current.dirty && isEqual(current.draft, serverValue)) {
    return cleanServerDraft(serverValue, serverRevision, resetKey);
  }
  if (!current.dirty) {
    if (
      isEqual(current.draft, serverValue)
      && isEqual(current.baseValue, serverValue)
      && Object.is(current.baseRevision, serverRevision)
    ) return current;
    return cleanServerDraft(serverValue, serverRevision, resetKey);
  }
  if (!isEqual(current.baseValue, serverValue)) {
    return current.conflicted ? current : { ...current, conflicted: true };
  }
  return current;
}

export function useServerDraft<Value>({
  serverValue,
  serverRevision,
  resetKey,
  isEqual = objectIs,
}: ServerDraftOptions<Value>) {
  const [snapshot, setSnapshot] = useState<ServerDraftSnapshot<Value>>(() => (
    cleanServerDraft(serverValue, serverRevision, resetKey)
  ));

  useEffect(() => {
    setSnapshot((current) => reconcileServerDraft(current, {
      serverValue,
      serverRevision,
      resetKey,
      isEqual,
    }));
  }, [isEqual, resetKey, serverRevision, serverValue]);

  const setDraft = useCallback<Dispatch<SetStateAction<Value>>>((value) => {
    setSnapshot((current) => {
      const nextDraft = typeof value === 'function'
        ? (value as (currentValue: Value) => Value)(current.draft)
        : value;
      if (isEqual(nextDraft, serverValue)) {
        return cleanServerDraft(serverValue, serverRevision, resetKey);
      }
      const dirty = !isEqual(nextDraft, current.baseValue);
      if (isEqual(nextDraft, current.draft) && dirty === current.dirty) return current;
      return {
        ...current,
        draft: nextDraft,
        dirty,
        conflicted: dirty ? current.conflicted : false,
      };
    });
  }, [isEqual, resetKey, serverRevision, serverValue]);

  const discardDraft = useCallback(() => {
    setSnapshot(cleanServerDraft(serverValue, serverRevision, resetKey));
  }, [resetKey, serverRevision, serverValue]);

  const commitConfirmed = useCallback((
    confirmedValue: Value = serverValue,
    confirmedRevision: ServerDraftRevision = serverRevision,
  ) => {
    setSnapshot(cleanServerDraft(confirmedValue, confirmedRevision, resetKey));
  }, [resetKey, serverRevision, serverValue]);

  return {
    draft: snapshot.draft,
    setDraft,
    dirty: snapshot.dirty,
    conflicted: snapshot.conflicted,
    baseRevision: snapshot.baseRevision,
    discardDraft,
    commitConfirmed,
  };
}
