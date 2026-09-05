export const CURRENT_CLIENT_STATE_VERSION = 41;
// Version 41 delivers source-backed inventory freezing and server-only cycle trading.
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 41;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
