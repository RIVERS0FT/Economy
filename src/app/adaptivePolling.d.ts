export const CONFIGURED_POLLING_RATES: readonly ['3', '5', '10'];
export const DEFAULT_CONFIGURED_POLLING_RATE: '5';
export const IDLE_POLLING_RATE: '15';
export const BACKGROUND_POLLING_RATE: '60';
export const POLLING_IDLE_AFTER_MS: 30000;

export function isConfiguredPollingRate(value: unknown): value is '3' | '5' | '10';
export function normalizeConfiguredPollingRate(
  value: unknown,
  fallback?: string,
): '3' | '5' | '10';
export function effectivePollingRate(options?: {
  configuredRate?: string;
  hidden?: boolean;
  idle?: boolean;
}): '3' | '5' | '10' | '15' | '60';
