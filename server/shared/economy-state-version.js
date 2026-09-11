export const CURRENT_CLIENT_STATE_VERSION = 45;
// Version 45 adds investment holdings, index quotes and explicit unknown asset valuation.
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 45;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
