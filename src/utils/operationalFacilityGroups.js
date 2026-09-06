/** A present regional array (including an empty one) supersedes the selected-region compatibility view. */
/** @param {import("../types").EconomyState} game */
export function operationalFacilityGroups(game) {
  const provinces = new Set((game.provinces ?? []).map((province) => province.id));
  const regional = game.provinceFacilityGroups ?? {};
  const groups = new Map();
  for (const group of game.facilityGroups ?? []) {
    if (provinces.has(group.provinceId) && !Object.prototype.hasOwnProperty.call(regional, group.provinceId)) {
      groups.set(`${group.provinceId}:${group.facilityTypeId}`, group);
    }
  }
  for (const [provinceId, entries] of Object.entries(regional)) {
    if (!provinces.has(provinceId)) continue;
    for (const group of entries) {
      if (group.provinceId === provinceId) groups.set(`${provinceId}:${group.facilityTypeId}`, group);
    }
  }
  return [...groups.values()].filter((group) => group.count > 0);
}
