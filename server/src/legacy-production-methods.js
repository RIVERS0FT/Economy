const LEGACY_METHOD_IDS = new Set([
  'standard', 'rapid', 'economical', 'high-yield',
  'assisted', 'intensive', 'mechanized',
]);

const CURRENT_METHOD_IDS_BY_FACILITY = Object.freeze({
  farm: ['open-field-rotation', 'tool-tillage', 'precision-fertilization', 'tractor-farming'],
  orchard: ['orchard-care', 'tool-pruning', 'precision-fertilization', 'tractor-orchard'],
  ranch: ['pasture-husbandry', 'formula-feeding', 'veterinary-care', 'mechanized-husbandry'],
  fishery: ['pond-aquaculture', 'formula-feeding', 'veterinary-care', 'recirculating-aquaculture'],
  'logging-camp': ['selective-logging', 'saw-assisted-logging', 'powered-logging', 'mechanized-logging'],
  mine: ['conventional-mining', 'drill-mining', 'blast-mining', 'mechanized-mining'],
  'oil-field': ['conventional-extraction', 'chemical-recovery', 'mechanical-recovery', 'powered-drilling'],
  mill: ['stone-milling', 'roller-milling', 'mechanical-processing', 'continuous-processing'],
  sawmill: ['band-sawing', 'saw-line', 'mechanical-sawmilling', 'continuous-sawmilling'],
  'feed-factory': ['batch-mixing', 'tool-assisted-mixing', 'mechanical-mixing', 'continuous-mixing'],
  'pulp-mill': ['mechanical-pulping', 'continuous-pulping', 'low-temperature-pulping', 'high-consistency-pulping'],
  steelworks: ['blast-furnace-smelting', 'oxygen-smelting', 'holding-smelting', 'continuous-casting'],
  'textile-mill': ['shuttle-weaving', 'automatic-weaving', 'low-tension-weaving', 'continuous-finishing'],
  'food-factory': ['batch-food-processing', 'continuous-cooking', 'low-temperature-processing', 'automated-packaging'],
  'paper-mill': ['fourdrinier-papermaking', 'accelerated-dewatering', 'low-temperature-drying', 'continuous-papermaking'],
  refinery: ['atmospheric-distillation', 'catalytic-cracking', 'low-pressure-refining', 'integrated-refining'],
  'fertilizer-factory': ['batch-synthesis', 'catalytic-synthesis', 'low-pressure-synthesis', 'continuous-granulation'],
  'veterinary-medicine-factory': ['batch-synthesis', 'aseptic-formulation', 'low-temperature-reaction', 'continuous-formulation'],
  'beverage-factory': ['batch-blending', 'aseptic-filling', 'cold-blending', 'continuous-filling'],
  'furniture-factory': ['craft-woodworking', 'mechanical-woodworking', 'precision-cutting', 'furniture-assembly-line'],
  'garment-factory': ['cut-and-sew', 'automatic-cutting', 'lean-sewing', 'garment-assembly-line'],
  'tool-workshop': ['forge-working', 'precision-machining', 'controlled-heat-treatment', 'automated-machining'],
  'machine-factory': ['machining-assembly', 'precision-machining', 'cellular-manufacturing', 'automated-assembly'],
  'tractor-factory': ['chassis-assembly', 'modular-assembly', 'cellular-manufacturing', 'automated-assembly'],
  'electronics-factory': ['board-assembly', 'precision-placement', 'low-temperature-soldering', 'cleanroom-production'],
  'appliance-factory': ['unit-assembly', 'modular-assembly', 'cellular-manufacturing', 'automated-assembly'],
});

const DEDICATED_FACILITY_IDS = new Set(Object.keys(CURRENT_METHOD_IDS_BY_FACILITY).slice(0, 10));
const DEDICATED_INDEX = Object.freeze({ standard: 0, assisted: 1, intensive: 2, mechanized: 3 });
const GENERIC_INDEX = Object.freeze({ standard: 0, rapid: 1, economical: 2, 'high-yield': 3 });

function legacyParts(recipeId) {
  const value = String(recipeId || '');
  const separator = value.lastIndexOf('--');
  if (separator < 0) return null;
  const methodId = value.slice(separator + 2);
  return LEGACY_METHOD_IDS.has(methodId)
    ? { baseRecipeId: value.slice(0, separator), methodId }
    : null;
}

export function isLegacyProductionMethodRecipeId(recipeId) {
  return Boolean(legacyParts(recipeId));
}

export function migrateLegacyProductionMethodRecipeId(facilityId, recipeId) {
  const parts = legacyParts(recipeId);
  const currentMethodIds = CURRENT_METHOD_IDS_BY_FACILITY[String(facilityId || '')];
  if (!parts || !currentMethodIds) return String(recipeId || '');
  const indexes = DEDICATED_FACILITY_IDS.has(String(facilityId || '')) ? DEDICATED_INDEX : GENERIC_INDEX;
  const index = indexes[parts.methodId];
  if (!Number.isInteger(index)) return String(recipeId || '');
  return index === 0 ? parts.baseRecipeId : `${parts.baseRecipeId}--${currentMethodIds[index]}`;
}
