import { useCallback, useEffect, useState } from 'react';

export type StrategicOutlinerSectionId = 'tutorial' | 'activity' | 'pinned' | 'events';
export type StrategicOutlinerPinKind = 'province' | 'commodity' | 'facility' | 'auction' | 'contract';

export interface StrategicOutlinerPin {
  key: string;
  kind: StrategicOutlinerPinKind;
  id: string;
  provinceId?: string;
}

interface StoredStrategicOutlinerState {
  version: 1;
  collapsedSections: StrategicOutlinerSectionId[];
  pins: StrategicOutlinerPin[];
}

const STORAGE_VERSION = 1;
const MAX_PINS = 24;
const VALID_SECTIONS = new Set<StrategicOutlinerSectionId>(['tutorial', 'activity', 'pinned', 'events']);
const VALID_PIN_KINDS = new Set<StrategicOutlinerPinKind>([
  'province',
  'commodity',
  'facility',
  'auction',
  'contract',
]);

function storageKey(userId: number) {
  return `economy:strategic-outliner:v${STORAGE_VERSION}:${userId}`;
}

function normalizePin(value: unknown): StrategicOutlinerPin | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<StrategicOutlinerPin>;
  if (!VALID_PIN_KINDS.has(candidate.kind as StrategicOutlinerPinKind)) return null;
  if (typeof candidate.id !== 'string' || !candidate.id.trim()) return null;
  const provinceId = typeof candidate.provinceId === 'string' && candidate.provinceId.trim()
    ? candidate.provinceId.trim()
    : undefined;
  const kind = candidate.kind as StrategicOutlinerPinKind;
  const id = candidate.id.trim();
  const key = `${kind}:${provinceId ?? ''}:${id}`;
  return { key, kind, id, provinceId };
}

function loadState(userId: number): StoredStrategicOutlinerState {
  const fallback: StoredStrategicOutlinerState = {
    version: STORAGE_VERSION,
    collapsedSections: [],
    pins: [],
  };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredStrategicOutlinerState>;
    const collapsedSections = Array.isArray(parsed.collapsedSections)
      ? parsed.collapsedSections.filter((section): section is StrategicOutlinerSectionId => (
        typeof section === 'string' && VALID_SECTIONS.has(section as StrategicOutlinerSectionId)
      ))
      : [];
    const pins = Array.isArray(parsed.pins)
      ? parsed.pins.map(normalizePin).filter((pin): pin is StrategicOutlinerPin => Boolean(pin)).slice(0, MAX_PINS)
      : [];
    return {
      version: STORAGE_VERSION,
      collapsedSections: [...new Set(collapsedSections)],
      pins: [...new Map(pins.map((pin) => [pin.key, pin])).values()],
    };
  } catch {
    return fallback;
  }
}

export function createStrategicOutlinerPin(
  kind: StrategicOutlinerPinKind,
  id: string,
  provinceId?: string,
): StrategicOutlinerPin {
  const normalizedProvinceId = provinceId?.trim() || undefined;
  const normalizedId = id.trim();
  return {
    key: `${kind}:${normalizedProvinceId ?? ''}:${normalizedId}`,
    kind,
    id: normalizedId,
    provinceId: normalizedProvinceId,
  };
}

export function useStrategicOutliner(userId: number) {
  const [state, setState] = useState<StoredStrategicOutlinerState>(() => loadState(userId));

  useEffect(() => {
    setState(loadState(userId));
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
    } catch {
      // Outliner preferences are optional and must never block gameplay.
    }
  }, [state, userId]);

  const toggleSection = useCallback((section: StrategicOutlinerSectionId) => {
    setState((current) => {
      const next = new Set(current.collapsedSections);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return { ...current, collapsedSections: [...next] };
    });
  }, []);

  const togglePin = useCallback((pin: StrategicOutlinerPin) => {
    setState((current) => {
      const existingIndex = current.pins.findIndex((candidate) => candidate.key === pin.key);
      if (existingIndex >= 0) {
        return {
          ...current,
          pins: current.pins.filter((candidate) => candidate.key !== pin.key),
        };
      }
      return {
        ...current,
        pins: [...current.pins, pin].slice(-MAX_PINS),
      };
    });
  }, []);

  const removePin = useCallback((key: string) => {
    setState((current) => ({
      ...current,
      pins: current.pins.filter((pin) => pin.key !== key),
    }));
  }, []);

  return {
    collapsedSections: new Set(state.collapsedSections),
    toggleSection,
    pins: state.pins,
    togglePin,
    removePin,
    isPinned: (pin: StrategicOutlinerPin) => state.pins.some((candidate) => candidate.key === pin.key),
  };
}
