export const CURRENT_CLIENT_STATE_VERSION = 44;
// Version 44 requires commercial popularity, star-profit, service and promotion catalog fields.
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 44;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
