export const CURRENT_CLIENT_STATE_VERSION = 16;
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 15;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
