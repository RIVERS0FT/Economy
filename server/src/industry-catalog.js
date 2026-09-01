import {
  createProductionMethodGroups,
  createProductionMethodRecipes,
} from './production-methods.js';
import {
  PRODUCT_CATALOG,
  resolveProductDisplayNames,
} from './product-catalog.js';

export { PRODUCT_CATALOG } from './product-catalog.js';

const rawFacilities = [
  {
    id: 'farm', name: '农场', category: 'raw', complexity: 'C1', buildCost: 50, buildTimeMs: 30_000,
    buildInputs: [],
    defaultRecipeId: 'wheat-crop', internalCapacity: 40, systemValue: 65,
    recipes: [
      { id: 'wheat-crop', nameTemplate: '种植{product:wheat}', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'wheat', quantity: 1 } },
      { id: 'rice-crop', nameTemplate: '种植{product:rice}', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'rice', quantity: 1 } },
      { id: 'cotton-crop', nameTemplate: '种植{product:cotton}', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'cotton', quantity: 1 } },
      { id: 'sugarcane-crop', nameTemplate: '种植{product:sugarcane}', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'sugarcane', quantity: 1 } },
    ],
  },
  {
    id: 'orchard', name: '果园', category: 'raw', complexity: 'C1', buildCost: 70, buildTimeMs: 40_000,
    buildInputs: [],
    defaultRecipeId: 'orchard-fruit', internalCapacity: 40, systemValue: 95,
    recipes: [{ id: 'orchard-fruit', nameTemplate: '种植{product:fruit}', cycleMs: 20_000, operatingCost: 1, inputs: [], output: { productId: 'fruit', quantity: 1 } }],
  },
  {
    id: 'ranch', name: '畜牧场', category: 'raw', complexity: 'C1', buildCost: 58, buildTimeMs: 50_000,
    buildInputs: [{ productId: 'timber', quantity: 3 }, { productId: 'ore', quantity: 2 }],
    defaultRecipeId: 'ranch-meat', internalCapacity: 40, systemValue: 120,
    recipes: [
      { id: 'ranch-meat', nameTemplate: '生产{product:meat}', cycleMs: 30_000, operatingCost: 2, inputs: [], output: { productId: 'meat', quantity: 1 } },
      { id: 'ranch-eggs', nameTemplate: '生产{product:eggs}', cycleMs: 30_000, operatingCost: 2, inputs: [], output: { productId: 'eggs', quantity: 1 } },
      { id: 'ranch-milk', nameTemplate: '生产{product:milk}', cycleMs: 30_000, operatingCost: 2, inputs: [], output: { productId: 'milk', quantity: 1 } },
      { id: 'ranch-wool', nameTemplate: '生产{product:wool}', cycleMs: 30_000, operatingCost: 2, inputs: [], output: { productId: 'wool', quantity: 1 } },
    ],
  },
  {
    id: 'fishery', name: '渔场', category: 'raw', complexity: 'C1', buildCost: 62, buildTimeMs: 60_000,
    buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 2 }],
    defaultRecipeId: 'fishery-fish', internalCapacity: 40, systemValue: 130,
    recipes: [{ id: 'fishery-fish', nameTemplate: '捕捞{product:fish}', cycleMs: 30_000, operatingCost: 2, inputs: [], output: { productId: 'fish', quantity: 1 } }],
  },
  {
    id: 'logging-camp', name: '伐木场', category: 'raw', complexity: 'C2', buildCost: 85, buildTimeMs: 5 * 60 * 1000,
    buildInputs: [{ productId: 'cotton', quantity: 6 }, { productId: 'ore', quantity: 4 }],
    defaultRecipeId: 'logging-camp-default', internalCapacity: 40, systemValue: 160,
    recipes: [{ id: 'logging-camp-default', nameTemplate: '采伐{product:timber}', cycleMs: 60_000, operatingCost: 9, inputs: [], output: { productId: 'timber', quantity: 2 } }],
  },
  {
    id: 'mine', name: '矿场', category: 'raw', complexity: 'C2', buildCost: 109, buildTimeMs: 6 * 60 * 1000,
    buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'cotton', quantity: 6 }],
    defaultRecipeId: 'mine-default', internalCapacity: 40, systemValue: 185,
    recipes: [
      { id: 'mine-default', nameTemplate: '开采{product:ore}', cycleMs: 60_000, operatingCost: 11, inputs: [], output: { productId: 'ore', quantity: 2 } },
      { id: 'copper-ore-mining', nameTemplate: '开采{product:copper-ore}', cycleMs: 60_000, operatingCost: 11, inputs: [], output: { productId: 'copper-ore', quantity: 2 } },
    ],
  },
  {
    id: 'oil-field', name: '油田', category: 'raw', complexity: 'C2', buildCost: 121, buildTimeMs: 10 * 60 * 1000,
    buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 4 }, { productId: 'copper-ore', quantity: 1 }],
    defaultRecipeId: 'oil-field-default', internalCapacity: 40, systemValue: 235,
    recipes: [{ id: 'oil-field-default', nameTemplate: '开采{product:crude-oil}', cycleMs: 60_000, operatingCost: 15, inputs: [], output: { productId: 'crude-oil', quantity: 2 } }],
  },
  {
    id: 'mill', name: '磨坊', category: 'processing', complexity: 'C2', buildCost: 98, buildTimeMs: 7 * 60 * 1000,
    buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }],
    defaultRecipeId: 'mill-default', internalCapacity: 30, systemValue: 195,
    recipes: [
      { id: 'mill-default', nameTemplate: '研磨{product:flour}', cycleMs: 40_000, operatingCost: 8.6, inputs: [{ productId: 'wheat', quantity: 2 }], output: { productId: 'flour', quantity: 1 } },
      { id: 'sugar-milling', nameTemplate: '加工{product:sugar}', cycleMs: 40_000, operatingCost: 8.6, inputs: [{ productId: 'sugarcane', quantity: 2 }], output: { productId: 'sugar', quantity: 1 } },
    ],
  },
  {
    id: 'sawmill', name: '锯木厂', category: 'processing', complexity: 'C2', buildCost: 112, buildTimeMs: 8 * 60 * 1000,
    buildInputs: [{ productId: 'timber', quantity: 5 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }],
    defaultRecipeId: 'sawmill-default', internalCapacity: 30, systemValue: 225,
    recipes: [{ id: 'sawmill-default', nameTemplate: '加工{product:lumber}', cycleMs: 40_000, operatingCost: 3, inputs: [{ productId: 'timber', quantity: 2 }], output: { productId: 'lumber', quantity: 1 } }],
  },
  {
    id: 'feed-factory', name: '饲料厂', category: 'processing', complexity: 'C2', buildCost: 108, buildTimeMs: 8 * 60 * 1000,
    buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }],
    defaultRecipeId: 'feed-factory-default', internalCapacity: 30, systemValue: 210,
    recipes: [{ id: 'feed-factory-default', nameTemplate: '生产{product:feed}', cycleMs: 60_000, operatingCost: 4.9, inputs: [{ productId: 'wheat', quantity: 2 }, { productId: 'fruit', quantity: 1 }], output: { productId: 'feed', quantity: 2 } }],
  },
  {
    id: 'pulp-mill', name: '纸浆厂', category: 'processing', complexity: 'C3', buildCost: 110, buildTimeMs: 30 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 1 }],
    defaultRecipeId: 'pulp-mill-default', internalCapacity: 25, systemValue: 250,
    recipes: [{ id: 'pulp-mill-default', nameTemplate: '生产{product:pulp}', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'timber', quantity: 2 }], output: { productId: 'pulp', quantity: 1 } }],
  },
  {
    id: 'steelworks', name: '冶炼厂', category: 'processing', complexity: 'C3', buildCost: 137, buildTimeMs: 40 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'ore', quantity: 5 }],
    defaultRecipeId: 'steelworks-default', internalCapacity: 25, systemValue: 315,
    recipes: [
      { id: 'steelworks-default', nameTemplate: '冶炼{product:steel}', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'ore', quantity: 3 }], output: { productId: 'steel', quantity: 1 } },
      { id: 'copper-smelting', nameTemplate: '冶炼{product:copper}', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'copper-ore', quantity: 3 }], output: { productId: 'copper', quantity: 1 } },
    ],
  },
  {
    id: 'textile-mill', name: '纺织厂', category: 'processing', complexity: 'C3', buildCost: 111, buildTimeMs: 35 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 2 }],
    defaultRecipeId: 'cotton-textile', internalCapacity: 25, systemValue: 290,
    recipes: [
      { id: 'cotton-textile', name: '棉纺', cycleMs: 40_000, operatingCost: 8.8, inputs: [{ productId: 'cotton', quantity: 6 }], output: { productId: 'textile', quantity: 1 } },
      { id: 'wool-textile', name: '毛纺', cycleMs: 40_000, operatingCost: 11.2, inputs: [{ productId: 'wool', quantity: 2 }], output: { productId: 'textile', quantity: 1 } },
    ],
  },
  {
    id: 'food-factory', name: '食品厂', category: 'consumer', complexity: 'C3', buildCost: 121, buildTimeMs: 45 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 2 }],
    defaultRecipeId: 'food-factory-default', internalCapacity: 45, systemValue: 300,
    recipes: [
      { id: 'food-factory-default', nameTemplate: '生产{product:food}', cycleMs: 50_000, operatingCost: 14, inputs: [{ productId: 'flour', quantity: 2 }], output: { productId: 'food', quantity: 3 } },
      { id: 'prepared-meal-production', nameTemplate: '生产{product:prepared-meal}', cycleMs: 60_000, operatingCost: 14.5, inputs: [{ productId: 'flour', quantity: 1 }, { productId: 'fish', quantity: 1 }], output: { productId: 'prepared-meal', quantity: 2 } },
    ],
  },
  {
    id: 'paper-mill', name: '造纸厂', category: 'consumer', complexity: 'C3', buildCost: 124, buildTimeMs: 60 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 2 }],
    defaultRecipeId: 'paper-mill-default', internalCapacity: 35, systemValue: 325,
    recipes: [{ id: 'paper-mill-default', nameTemplate: '生产{product:paper}', cycleMs: 60_000, operatingCost: 4, inputs: [{ productId: 'pulp', quantity: 1 }], output: { productId: 'paper', quantity: 2 } }],
  },
  {
    id: 'refinery', name: '炼油厂', category: 'processing', complexity: 'C4', buildCost: 104, buildTimeMs: 80 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'copper', quantity: 1 }],
    defaultRecipeId: 'refinery-default', internalCapacity: 25, systemValue: 390,
    recipes: [
      { id: 'refinery-default', nameTemplate: '生产{product:plastic}', cycleMs: 40_000, operatingCost: 8, inputs: [{ productId: 'crude-oil', quantity: 2 }], output: { productId: 'plastic', quantity: 1 } },
      { id: 'industrial-fuel-refining', nameTemplate: '生产{product:industrial-fuel}', cycleMs: 60_000, operatingCost: 1, inputs: [{ productId: 'crude-oil', quantity: 1 }], output: { productId: 'industrial-fuel', quantity: 4 } },
      { id: 'industrial-chemicals-refining', nameTemplate: '生产{product:industrial-chemicals}', cycleMs: 60_000, operatingCost: 6, inputs: [{ productId: 'crude-oil', quantity: 2 }], output: { productId: 'industrial-chemicals', quantity: 6 } },
    ],
  },
  {
    id: 'fertilizer-factory', name: '化肥厂', category: 'processing', complexity: 'C4', buildCost: 134, buildTimeMs: 85 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'copper', quantity: 1 }],
    defaultRecipeId: 'fertilizer-factory-default', internalCapacity: 25, systemValue: 430,
    recipes: [{ id: 'fertilizer-factory-default', nameTemplate: '生产{product:fertilizer}', cycleMs: 60_000, operatingCost: 16.56, inputs: [{ productId: 'crude-oil', quantity: 2 }], output: { productId: 'fertilizer', quantity: 6 } }],
  },
  {
    id: 'veterinary-medicine-factory', name: '养殖药剂厂', category: 'processing', complexity: 'C4', buildCost: 163, buildTimeMs: 95 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'plastic', quantity: 1 }],
    defaultRecipeId: 'veterinary-medicine-factory-default', internalCapacity: 25, systemValue: 470,
    recipes: [{ id: 'veterinary-medicine-factory-default', nameTemplate: '生产{product:veterinary-medicine}', cycleMs: 60_000, operatingCost: 13.64, inputs: [{ productId: 'fertilizer', quantity: 1 }, { productId: 'plastic', quantity: 1 }], output: { productId: 'veterinary-medicine', quantity: 4 } }],
  },
  {
    id: 'beverage-factory', name: '饮料厂', category: 'consumer', complexity: 'C4', buildCost: 96, buildTimeMs: 60 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 3 }, { productId: 'copper', quantity: 1 }],
    defaultRecipeId: 'milk-beverage', internalCapacity: 35, systemValue: 365,
    recipes: [
      { id: 'milk-beverage', nameTemplate: '生产乳制{product:beverage}', cycleMs: 60_000, operatingCost: 14.6, inputs: [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }], output: { productId: 'beverage', quantity: 2 } },
      { id: 'fruit-beverage', nameTemplate: '生产果汁{product:beverage}', cycleMs: 60_000, operatingCost: 14.4, inputs: [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }], output: { productId: 'beverage', quantity: 2 } },
    ],
  },
  {
    id: 'furniture-factory', name: '家具厂', category: 'consumer', complexity: 'C4', buildCost: 140, buildTimeMs: 70 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 6 }, { productId: 'steel', quantity: 2 }],
    defaultRecipeId: 'furniture-factory-default', internalCapacity: 35, systemValue: 390,
    recipes: [{ id: 'furniture-factory-default', nameTemplate: '生产{product:furniture}', cycleMs: 60_000, operatingCost: 8, inputs: [{ productId: 'lumber', quantity: 2 }], output: { productId: 'furniture', quantity: 2 } }],
  },
  {
    id: 'garment-factory', name: '制衣厂', category: 'consumer', complexity: 'C4', buildCost: 165, buildTimeMs: 90 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 3 }, { productId: 'plastic', quantity: 1 }],
    defaultRecipeId: 'garment-factory-default', internalCapacity: 30, systemValue: 455,
    recipes: [{ id: 'garment-factory-default', nameTemplate: '生产{product:clothing}', cycleMs: 60_000, operatingCost: 9, inputs: [{ productId: 'textile', quantity: 2 }], output: { productId: 'clothing', quantity: 1 } }],
  },
  {
    id: 'tool-workshop', name: '工具工坊', category: 'industrial', complexity: 'C4', buildCost: 136, buildTimeMs: 75 * 60 * 1000,
    buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 4 }],
    defaultRecipeId: 'tool-workshop-default', internalCapacity: 25, systemValue: 420,
    recipes: [{ id: 'tool-workshop-default', nameTemplate: '生产{product:tools}', cycleMs: 60_000, operatingCost: 8, inputs: [{ productId: 'steel', quantity: 1 }, { productId: 'lumber', quantity: 1 }], output: { productId: 'tools', quantity: 5 } }],
  },
  {
    id: 'machine-factory', name: '机械厂', category: 'industrial', complexity: 'C5', buildCost: 130, buildTimeMs: 100 * 60 * 1000,
    buildInputs: [{ productId: 'steel', quantity: 7 }, { productId: 'copper', quantity: 3 }, { productId: 'plastic', quantity: 2 }],
    defaultRecipeId: 'machine-factory-default', internalCapacity: 15, systemValue: 625,
    recipes: [{ id: 'machine-factory-default', nameTemplate: '生产{product:machinery}', cycleMs: 60_000, operatingCost: 11.75, inputs: [{ productId: 'steel', quantity: 2 }], output: { productId: 'machinery', quantity: 5 } }],
  },
  {
    id: 'tractor-factory', name: '拖拉机厂', category: 'industrial', complexity: 'C5', buildCost: 214, buildTimeMs: 105 * 60 * 1000,
    buildInputs: [{ productId: 'steel', quantity: 8 }, { productId: 'copper', quantity: 2 }, { productId: 'machinery', quantity: 1 }],
    defaultRecipeId: 'tractor-factory-default', internalCapacity: 15, systemValue: 680,
    recipes: [{ id: 'tractor-factory-default', nameTemplate: '生产{product:tractor}', cycleMs: 60_000, operatingCost: 8.85, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'steel', quantity: 1 }], output: { productId: 'tractor', quantity: 4 } }],
  },
  {
    id: 'electronics-factory', name: '电子厂', category: 'industrial', complexity: 'C6', buildCost: 216, buildTimeMs: 110 * 60 * 1000,
    buildInputs: [{ productId: 'steel', quantity: 6 }, { productId: 'copper', quantity: 6 }, { productId: 'plastic', quantity: 4 }, { productId: 'machinery', quantity: 1 }],
    defaultRecipeId: 'electronics-factory-default', internalCapacity: 15, systemValue: 910,
    recipes: [{ id: 'electronics-factory-default', nameTemplate: '生产{product:electronics}', cycleMs: 60_000, operatingCost: 15, inputs: [{ productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 }], output: { productId: 'electronics', quantity: 1 } }],
  },
  {
    id: 'appliance-factory', name: '家电厂', category: 'industrial', complexity: 'C7', buildCost: 468, buildTimeMs: 120 * 60 * 1000,
    buildInputs: [{ productId: 'steel', quantity: 8 }, { productId: 'plastic', quantity: 5 }, { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }],
    defaultRecipeId: 'appliance-factory-default', internalCapacity: 12, systemValue: 1235,
    recipes: [{ id: 'appliance-factory-default', nameTemplate: '生产{product:appliance}', cycleMs: 60_000, operatingCost: 72.45, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }], output: { productId: 'appliance', quantity: 2 } }],
  },
];

function freezeRecipe(recipe) {
  const inputs = Object.freeze((recipe.inputs || []).map((input) => Object.freeze({ ...input })));
  const { nameTemplate, ...recipeFields } = recipe;
  return Object.freeze({
    ...recipeFields,
    name: resolveProductDisplayNames(nameTemplate || recipe.name),
    inputs,
    input: inputs.length === 1 ? inputs[0] : null,
    output: Object.freeze({ ...recipe.output }),
  });
}

export const FACILITY_TYPE_CATALOG = Object.freeze(rawFacilities.map((facility) => {
  const baseRecipes = Object.freeze(facility.recipes.map(freezeRecipe));
  const productionMethodGroups = createProductionMethodGroups(
    { ...facility, recipes: baseRecipes },
    PRODUCT_CATALOG,
  );
  const recipes = createProductionMethodRecipes({ ...facility, recipes: baseRecipes }, productionMethodGroups);
  const defaultRecipe = recipes.find((recipe) => recipe.id === facility.defaultRecipeId) || recipes[0];
  return Object.freeze({
    ...facility,
    cycleMs: defaultRecipe.cycleMs,
    operatingCost: defaultRecipe.operatingCost,
    inputs: defaultRecipe.inputs,
    input: defaultRecipe.input,
    output: defaultRecipe.output,
    recipes,
    productionMethodGroups,
  });
}));
