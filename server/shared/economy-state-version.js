export const CURRENT_CLIENT_STATE_VERSION = 39;
// Version 39 is a breaking transport-state boundary: routes no longer carry fixed cargo or manual dispatch state, and shipments use authoritative manifest/legPlan data.
export const MIN_COMPATIBLE_CLIENT_STATE_VERSION = 39;

export function isCompatibleClientStateVersion(value) {
  return Number.isInteger(value)
    && value >= MIN_COMPATIBLE_CLIENT_STATE_VERSION
    && value <= CURRENT_CLIENT_STATE_VERSION;
}
