export const CONFIGURED_POLLING_RATES = Object.freeze(['3', '5', '10']);
export const DEFAULT_CONFIGURED_POLLING_RATE = '5';
export const IDLE_POLLING_RATE = '15';
export const BACKGROUND_POLLING_RATE = '60';
export const POLLING_IDLE_AFTER_MS = 30_000;

export function isConfiguredPollingRate(value) {
  return CONFIGURED_POLLING_RATES.includes(String(value));
}

export function normalizeConfiguredPollingRate(value, fallback = DEFAULT_CONFIGURED_POLLING_RATE) {
  if (isConfiguredPollingRate(value)) return String(value);
  return isConfiguredPollingRate(fallback) ? String(fallback) : DEFAULT_CONFIGURED_POLLING_RATE;
}

export function effectivePollingRate({ configuredRate, hidden = false, idle = false } = {}) {
  if (hidden) return BACKGROUND_POLLING_RATE;
  if (idle) return IDLE_POLLING_RATE;
  return normalizeConfiguredPollingRate(configuredRate);
}
