export const CURRENT_CLIENT_STATE_VERSION = 42;
// Version 42 requires commodity-fuel transport planning instead of cash-fuel forecasts.
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 42;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
