interface FacilityEnabledIntent {
  enabled: boolean;
  sequence: number;
  acknowledged: boolean;
}

const facilityEnabledIntents = new Map<string, FacilityEnabledIntent>();
const listeners = new Map<string, Set<() => void>>();
let sequence = 0;

function facilityIntentKey(provinceId: string, facilityTypeId: string) {
  return `${provinceId}:${facilityTypeId}`;
}

function emit(key: string) {
  const current = listeners.get(key);
  if (!current) return;
  for (const listener of [...current]) listener();
}

export function setFacilityEnabledIntent(
  provinceId: string,
  facilityTypeId: string,
  enabled: boolean,
) {
  const key = facilityIntentKey(provinceId, facilityTypeId);
  const next = {
    enabled,
    sequence: ++sequence,
    acknowledged: false,
  };
  facilityEnabledIntents.set(key, next);
  emit(key);
  return next.sequence;
}

export function rejectFacilityEnabledIntent(
  provinceId: string,
  facilityTypeId: string,
  expectedSequence: number,
) {
  const key = facilityIntentKey(provinceId, facilityTypeId);
  if (facilityEnabledIntents.get(key)?.sequence !== expectedSequence) return;
  facilityEnabledIntents.delete(key);
  emit(key);
}

export function acknowledgeFacilityEnabledIntent(
  provinceId: string,
  facilityTypeId: string,
  expectedSequence: number,
  authorityApplied: boolean,
) {
  const key = facilityIntentKey(provinceId, facilityTypeId);
  const current = facilityEnabledIntents.get(key);
  if (!current || current.sequence !== expectedSequence) return;
  if (authorityApplied) {
    facilityEnabledIntents.delete(key);
  } else {
    facilityEnabledIntents.set(key, { ...current, acknowledged: true });
  }
  emit(key);
}

export function reconcileFacilityEnabledIntent(
  provinceId: string,
  facilityTypeId: string,
  authoritativeEnabled: boolean,
) {
  const key = facilityIntentKey(provinceId, facilityTypeId);
  const current = facilityEnabledIntents.get(key);
  if (!current || !current.acknowledged || current.enabled !== authoritativeEnabled) return;
  facilityEnabledIntents.delete(key);
  emit(key);
}

export function getFacilityEnabledIntent(
  provinceId: string,
  facilityTypeId: string,
): boolean | null {
  return facilityEnabledIntents.get(facilityIntentKey(provinceId, facilityTypeId))?.enabled ?? null;
}

export function subscribeFacilityEnabledIntent(
  provinceId: string,
  facilityTypeId: string,
  listener: () => void,
) {
  const key = facilityIntentKey(provinceId, facilityTypeId);
  let current = listeners.get(key);
  if (!current) {
    current = new Set();
    listeners.set(key, current);
  }
  current.add(listener);
  return () => {
    const existing = listeners.get(key);
    if (!existing) return;
    existing.delete(listener);
    if (existing.size === 0) listeners.delete(key);
  };
}

export function resetFacilityEnabledIntents() {
  const keys = [...facilityEnabledIntents.keys()];
  facilityEnabledIntents.clear();
  for (const key of keys) emit(key);
}
