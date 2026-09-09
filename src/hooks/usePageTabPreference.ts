import { useCallback, useEffect, useState } from 'react';

interface PageTabPreferenceStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface PageTabPreferenceOptions<T extends string> {
  userId: string | number;
  pageId: string;
  allowed: readonly T[];
  fallback: T;
  storage?: PageTabPreferenceStorage | null;
}

const PAGE_TAB_PREFERENCE_VERSION = 'v1';
const ALLOWED_VALUE_SEPARATOR = '\u001f';

export function pageTabPreferenceKey(userId: string | number, pageId: string) {
  return `economy.page-tab.${PAGE_TAB_PREFERENCE_VERSION}:${userId}:${pageId}`;
}

function browserStorage(): PageTabPreferenceStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadPageTabPreference<T extends string>({
  userId,
  pageId,
  allowed,
  fallback,
  storage = browserStorage(),
}: PageTabPreferenceOptions<T>): T {
  if (!storage) return fallback;
  try {
    const stored = storage.getItem(pageTabPreferenceKey(userId, pageId));
    return stored && allowed.includes(stored as T) ? stored as T : fallback;
  } catch {
    return fallback;
  }
}

export function savePageTabPreference<T extends string>({
  userId,
  pageId,
  allowed,
  fallback,
  storage = browserStorage(),
}: PageTabPreferenceOptions<T>, value: T) {
  const normalized = allowed.includes(value) ? value : fallback;
  if (!storage) return normalized;
  try {
    storage.setItem(pageTabPreferenceKey(userId, pageId), normalized);
  } catch {
    // Page preferences are best-effort and must never block navigation.
  }
  return normalized;
}

export function usePageTabPreference<T extends string>(options: PageTabPreferenceOptions<T>) {
  const { userId, pageId, allowed, fallback, storage } = options;
  const allowedKey = allowed.join(ALLOWED_VALUE_SEPARATOR);
  const [value, setValueState] = useState<T>(() => loadPageTabPreference(options));

  useEffect(() => {
    const stableAllowed = allowedKey.split(ALLOWED_VALUE_SEPARATOR) as T[];
    setValueState(loadPageTabPreference({ userId, pageId, allowed: stableAllowed, fallback, storage }));
  }, [userId, pageId, allowedKey, fallback, storage]);

  const setValue = useCallback((next: T) => {
    const stableAllowed = allowedKey.split(ALLOWED_VALUE_SEPARATOR) as T[];
    const normalized = savePageTabPreference({ userId, pageId, allowed: stableAllowed, fallback, storage }, next);
    setValueState(normalized);
  }, [userId, pageId, allowedKey, fallback, storage]);

  return [value, setValue] as const;
}