export const CURRENT_CLIENT_STATE_VERSION = 40;
// Version 40 makes the commercial building catalog mandatory so a mixed old catalog can never render industrial construction without commercial construction.
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 40;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
