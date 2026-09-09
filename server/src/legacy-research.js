// Published identities and eras are only retained for migration of paid progress and access.
export const LEGACY_RESEARCH_NODES = Object.freeze([
  Object.freeze({ id: 'basic-crops', rank: 1, technologyId: 'basic-crops' }),
  Object.freeze({ id: 'basic-livestock', rank: 1, technologyId: 'basic-livestock' }),
  Object.freeze({ id: 'forestry-development', rank: 2, technologyId: 'resource-survey' }),
  Object.freeze({ id: 'mineral-exploration', rank: 2, technologyId: 'resource-survey' }),
  Object.freeze({ id: 'petroleum-exploration', rank: 2, technologyId: 'resource-survey' }),
  Object.freeze({ id: 'grain-processing', rank: 2, technologyId: 'scientific-agriculture' }),
  Object.freeze({ id: 'wood-processing', rank: 2, technologyId: 'wood-industry' }),
  Object.freeze({ id: 'feed-processing', rank: 2, technologyId: 'scientific-agriculture' }),
  Object.freeze({ id: 'tool-operation', rank: 2, technologyId: 'powered-production' }),
  Object.freeze({ id: 'feed-husbandry', rank: 2, technologyId: 'scientific-agriculture' }),
  Object.freeze({ id: 'pulp-technology', rank: 3, technologyId: 'wood-industry' }),
  Object.freeze({ id: 'metallurgy', rank: 3, technologyId: 'metallurgical-engineering' }),
  Object.freeze({ id: 'textile-technology', rank: 3, technologyId: 'textile-industry' }),
  Object.freeze({ id: 'food-industry', rank: 3, technologyId: 'food-processing' }),
  Object.freeze({ id: 'papermaking', rank: 3, technologyId: 'wood-industry' }),
  Object.freeze({ id: 'fertilizer-application', rank: 3, technologyId: 'applied-chemistry' }),
  Object.freeze({ id: 'veterinary-application', rank: 3, technologyId: 'applied-chemistry' }),
  Object.freeze({ id: 'industrial-fuel-operation', rank: 3, technologyId: 'powered-production' }),
  Object.freeze({ id: 'industrial-chemical-operation', rank: 3, technologyId: 'applied-chemistry' }),
  Object.freeze({ id: 'oil-refining', rank: 4, technologyId: 'chemical-engineering' }),
  Object.freeze({ id: 'fertilizer-engineering', rank: 4, technologyId: 'chemical-engineering' }),
  Object.freeze({ id: 'veterinary-medicine', rank: 4, technologyId: 'chemical-engineering' }),
  Object.freeze({ id: 'beverage-industry', rank: 4, technologyId: 'food-processing' }),
  Object.freeze({ id: 'furniture-manufacturing', rank: 4, technologyId: 'wood-industry' }),
  Object.freeze({ id: 'garment-manufacturing', rank: 4, technologyId: 'textile-industry' }),
  Object.freeze({ id: 'tool-manufacturing', rank: 4, technologyId: 'metallurgical-engineering' }),
  Object.freeze({ id: 'machinery-operation', rank: 4, technologyId: 'mechanized-production' }),
  Object.freeze({ id: 'tractor-operation', rank: 4, technologyId: 'mechanized-production' }),
  Object.freeze({ id: 'mechanical-engineering', rank: 5, technologyId: 'machine-engineering' }),
  Object.freeze({ id: 'agricultural-machinery', rank: 5, technologyId: 'machine-engineering' }),
  Object.freeze({ id: 'electronics-engineering', rank: 6, technologyId: 'electronic-engineering' }),
  Object.freeze({ id: 'appliance-engineering', rank: 7, technologyId: 'electrical-integration' }),
]);
const byId = new Map(LEGACY_RESEARCH_NODES.map((entry) => [entry.id, entry.technologyId]));
export function migrateResearchTechnologyId(id) { return byId.get(String(id)) || String(id); }

// Catalogs before v3 promised all of these capabilities in one paid node.
const SPLIT_TECHNOLOGY_GRANTS = Object.freeze({
  'resource-survey': ['resource-survey', 'petroleum-survey'],
  'wood-industry': ['wood-industry', 'pulp-paper-industry'],
  'chemical-engineering': ['chemical-engineering', 'agrochemical-engineering'],
  'powered-production': ['powered-production', 'powered-forestry', 'industrial-tools', 'processing-tools'],
  'applied-chemistry': ['applied-chemistry', 'veterinary-science', 'extraction-chemistry'],
  'mechanized-production': ['mechanized-production', 'mechanized-livestock', 'mechanized-extraction',
    'mechanized-petroleum', 'mechanized-milling', 'mechanized-sawmilling', 'mechanized-feed'],
});
export function migrateResearchTechnologyIds(id) {
  const mapped = migrateResearchTechnologyId(id);
  return SPLIT_TECHNOLOGY_GRANTS[mapped] || [mapped];
}
