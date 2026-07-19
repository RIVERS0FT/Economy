const rawProducts = [
  { id: 'wheat', name: '小麦', category: 'raw', basePrice: 2 },
  { id: 'rice', name: '水稻', category: 'raw', basePrice: 2 },
  { id: 'cotton', name: '棉花', category: 'raw', basePrice: 2 },
  { id: 'sugarcane', name: '甘蔗', category: 'raw', basePrice: 2 },
  { id: 'fruit', name: '水果', category: 'raw', basePrice: 4 },
  { id: 'timber', name: '木材', category: 'raw', basePrice: 5 },
  { id: 'ore', name: '铁矿石', category: 'raw', basePrice: 6 },
  { id: 'copper-ore', name: '铜矿石', category: 'raw', basePrice: 6 },
  { id: 'crude-oil', name: '原油', category: 'raw', basePrice: 8 },
  { id: 'meat', name: '肉', category: 'consumer', basePrice: 6 },
  { id: 'eggs', name: '蛋', category: 'consumer', basePrice: 3 },
  { id: 'milk', name: '奶', category: 'consumer', basePrice: 3 },
  { id: 'fish', name: '鱼类', category: 'raw', basePrice: 6 },
  { id: 'wool', name: '毛', category: 'raw', basePrice: 6 },
  { id: 'flour', name: '面粉', category: 'intermediate', basePrice: 13 },
  { id: 'sugar', name: '砂糖', category: 'intermediate', basePrice: 13 },
  { id: 'lumber', name: '木板', category: 'intermediate', basePrice: 15 },
  { id: 'steel', name: '钢材', category: 'intermediate', basePrice: 24 },
  { id: 'copper', name: '铜材', category: 'intermediate', basePrice: 24 },
  { id: 'plastic', name: '塑料', category: 'intermediate', basePrice: 24 },
  { id: 'textile', name: '纺织品', category: 'intermediate', basePrice: 18 },
  { id: 'pulp', name: '纸浆', category: 'intermediate', basePrice: 16 },
  { id: 'food', name: '食品', category: 'consumer', basePrice: 15 },
  { id: 'beverage', name: '饮料', category: 'consumer', basePrice: 16 },
  { id: 'prepared-meal', name: '预制餐', category: 'consumer', basePrice: 18 },
  { id: 'paper', name: '纸品', category: 'consumer', basePrice: 13 },
  { id: 'furniture', name: '家具', category: 'consumer', basePrice: 20 },
  { id: 'clothing', name: '服装', category: 'consumer', basePrice: 48 },
  { id: 'machinery', name: '机械', category: 'industrial', basePrice: 60 },
  { id: 'electronics', name: '电子产品', category: 'industrial', basePrice: 64 },
  { id: 'appliance', name: '家电', category: 'industrial', basePrice: 68 },
];

export const PRODUCT_CATALOG = Object.freeze(rawProducts.map((product) => Object.freeze({ ...product })));

const rawFacilities = [
  {
    id: 'farm', name: '农场', category: 'raw', buildCost: 60, buildTimeMs: 5 * 60 * 1000,
    defaultRecipeId: 'wheat-crop', internalCapacity: 40, systemValue: 80,
    recipes: [
      { id: 'wheat-crop', name: '种植小麦', cycleMs: 120_000, operatingCost: 6, inputs: [], output: { productId: 'wheat', quantity: 4 } },
      { id: 'rice-crop', name: '种植水稻', cycleMs: 120_000, operatingCost: 6, inputs: [], output: { productId: 'rice', quantity: 4 } },
      { id: 'cotton-crop', name: '种植棉花', cycleMs: 120_000, operatingCost: 6, inputs: [], output: { productId: 'cotton', quantity: 4 } },
      { id: 'sugarcane-crop', name: '种植甘蔗', cycleMs: 120_000, operatingCost: 6, inputs: [], output: { productId: 'sugarcane', quantity: 4 } },
    ],
  },
  {
    id: 'orchard', name: '果园', category: 'raw', buildCost: 80, buildTimeMs: 6 * 60 * 1000,
    defaultRecipeId: 'orchard-fruit', internalCapacity: 40, systemValue: 105,
    recipes: [{ id: 'orchard-fruit', name: '种植水果', cycleMs: 120_000, operatingCost: 10, inputs: [], output: { productId: 'fruit', quantity: 3 } }],
  },
  {
    id: 'logging-camp', name: '伐木场', category: 'raw', buildCost: 65, buildTimeMs: 5 * 60 * 1000,
    defaultRecipeId: 'logging-camp-default', internalCapacity: 40, systemValue: 85,
    recipes: [{ id: 'logging-camp-default', name: '采伐木材', cycleMs: 60_000, operatingCost: 9, inputs: [], output: { productId: 'timber', quantity: 2 } }],
  },
  {
    id: 'mine', name: '矿场', category: 'raw', buildCost: 70, buildTimeMs: 5 * 60 * 1000,
    defaultRecipeId: 'mine-default', internalCapacity: 40, systemValue: 90,
    recipes: [
      { id: 'mine-default', name: '开采铁矿石', cycleMs: 60_000, operatingCost: 11, inputs: [], output: { productId: 'ore', quantity: 2 } },
      { id: 'copper-ore-mining', name: '开采铜矿石', cycleMs: 60_000, operatingCost: 11, inputs: [], output: { productId: 'copper-ore', quantity: 2 } },
    ],
  },
  {
    id: 'ranch', name: '畜牧场', category: 'raw', buildCost: 90, buildTimeMs: 7 * 60 * 1000,
    defaultRecipeId: 'ranch-meat', internalCapacity: 40, systemValue: 120,
    recipes: [
      { id: 'ranch-meat', name: '生产肉', cycleMs: 120_000, operatingCost: 16, inputs: [], output: { productId: 'meat', quantity: 3 } },
      { id: 'ranch-eggs', name: '生产蛋', cycleMs: 120_000, operatingCost: 16, inputs: [], output: { productId: 'eggs', quantity: 6 } },
      { id: 'ranch-milk', name: '生产奶', cycleMs: 120_000, operatingCost: 16, inputs: [], output: { productId: 'milk', quantity: 6 } },
      { id: 'ranch-wool', name: '生产毛', cycleMs: 120_000, operatingCost: 16, inputs: [], output: { productId: 'wool', quantity: 3 } },
    ],
  },
  {
    id: 'fishery', name: '渔场', category: 'raw', buildCost: 100, buildTimeMs: 7 * 60 * 1000,
    defaultRecipeId: 'fishery-fish', internalCapacity: 40, systemValue: 130,
    recipes: [{ id: 'fishery-fish', name: '捕捞鱼类', cycleMs: 120_000, operatingCost: 16, inputs: [], output: { productId: 'fish', quantity: 3 } }],
  },
  {
    id: 'oil-field', name: '油田', category: 'raw', buildCost: 95, buildTimeMs: 7 * 60 * 1000,
    defaultRecipeId: 'oil-field-default', internalCapacity: 40, systemValue: 120,
    recipes: [{ id: 'oil-field-default', name: '开采原油', cycleMs: 60_000, operatingCost: 15, inputs: [], output: { productId: 'crude-oil', quantity: 2 } }],
  },
  {
    id: 'mill', name: '磨坊', category: 'processing', buildCost: 100, buildTimeMs: 8 * 60 * 1000,
    defaultRecipeId: 'mill-default', internalCapacity: 30, systemValue: 130,
    recipes: [
      { id: 'mill-default', name: '研磨面粉', cycleMs: 40_000, operatingCost: 7, inputs: [{ productId: 'wheat', quantity: 2 }], output: { productId: 'flour', quantity: 1 } },
      { id: 'sugar-milling', name: '加工砂糖', cycleMs: 40_000, operatingCost: 7, inputs: [{ productId: 'sugarcane', quantity: 2 }], output: { productId: 'sugar', quantity: 1 } },
    ],
  },
  {
    id: 'sawmill', name: '锯木厂', category: 'processing', buildCost: 115, buildTimeMs: 8 * 60 * 1000,
    defaultRecipeId: 'sawmill-default', internalCapacity: 30, systemValue: 150,
    recipes: [{ id: 'sawmill-default', name: '加工木板', cycleMs: 40_000, operatingCost: 3, inputs: [{ productId: 'timber', quantity: 2 }], output: { productId: 'lumber', quantity: 1 } }],
  },
  {
    id: 'pulp-mill', name: '纸浆厂', category: 'processing', buildCost: 130, buildTimeMs: 9 * 60 * 1000,
    defaultRecipeId: 'pulp-mill-default', internalCapacity: 25, systemValue: 170,
    recipes: [{ id: 'pulp-mill-default', name: '生产纸浆', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'timber', quantity: 2 }], output: { productId: 'pulp', quantity: 1 } }],
  },
  {
    id: 'steelworks', name: '冶炼厂', category: 'processing', buildCost: 140, buildTimeMs: 10 * 60 * 1000,
    defaultRecipeId: 'steelworks-default', internalCapacity: 25, systemValue: 180,
    recipes: [
      { id: 'steelworks-default', name: '冶炼钢材', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'ore', quantity: 3 }], output: { productId: 'steel', quantity: 1 } },
      { id: 'copper-smelting', name: '冶炼铜材', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'copper-ore', quantity: 3 }], output: { productId: 'copper', quantity: 1 } },
    ],
  },
  {
    id: 'refinery', name: '炼油厂', category: 'processing', buildCost: 185, buildTimeMs: 12 * 60 * 1000,
    defaultRecipeId: 'refinery-default', internalCapacity: 25, systemValue: 240,
    recipes: [{ id: 'refinery-default', name: '生产塑料', cycleMs: 40_000, operatingCost: 6, inputs: [{ productId: 'crude-oil', quantity: 2 }], output: { productId: 'plastic', quantity: 1 } }],
  },
  {
    id: 'textile-mill', name: '纺织厂', category: 'processing', buildCost: 145, buildTimeMs: 10 * 60 * 1000,
    defaultRecipeId: 'cotton-textile', internalCapacity: 25, systemValue: 190,
    recipes: [
      { id: 'cotton-textile', name: '棉纺', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'cotton', quantity: 6 }], output: { productId: 'textile', quantity: 1 } },
      { id: 'wool-textile', name: '毛纺', cycleMs: 40_000, operatingCost: 4, inputs: [{ productId: 'wool', quantity: 2 }], output: { productId: 'textile', quantity: 1 } },
    ],
  },
  {
    id: 'food-factory', name: '食品厂', category: 'consumer', buildCost: 160, buildTimeMs: 10 * 60 * 1000,
    defaultRecipeId: 'food-factory-default', internalCapacity: 45, systemValue: 210,
    recipes: [
      { id: 'food-factory-default', name: '生产食品', cycleMs: 50_000, operatingCost: 14, inputs: [{ productId: 'flour', quantity: 2 }], output: { productId: 'food', quantity: 3 } },
      { id: 'prepared-meal-production', name: '生产预制餐', cycleMs: 60_000, operatingCost: 11, inputs: [{ productId: 'flour', quantity: 1 }, { productId: 'fish', quantity: 1 }], output: { productId: 'prepared-meal', quantity: 2 } },
    ],
  },
  {
    id: 'beverage-factory', name: '饮料厂', category: 'consumer', buildCost: 190, buildTimeMs: 12 * 60 * 1000,
    defaultRecipeId: 'milk-beverage', internalCapacity: 35, systemValue: 250,
    recipes: [
      { id: 'milk-beverage', name: '生产乳制饮料', cycleMs: 60_000, operatingCost: 10, inputs: [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }], output: { productId: 'beverage', quantity: 2 } },
      { id: 'fruit-beverage', name: '生产果汁饮料', cycleMs: 60_000, operatingCost: 5, inputs: [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }], output: { productId: 'beverage', quantity: 2 } },
    ],
  },
  {
    id: 'paper-mill', name: '造纸厂', category: 'consumer', buildCost: 180, buildTimeMs: 11 * 60 * 1000,
    defaultRecipeId: 'paper-mill-default', internalCapacity: 35, systemValue: 235,
    recipes: [{ id: 'paper-mill-default', name: '生产纸品', cycleMs: 60_000, operatingCost: 4, inputs: [{ productId: 'pulp', quantity: 1 }], output: { productId: 'paper', quantity: 2 } }],
  },
  {
    id: 'furniture-factory', name: '家具厂', category: 'consumer', buildCost: 210, buildTimeMs: 12 * 60 * 1000,
    defaultRecipeId: 'furniture-factory-default', internalCapacity: 35, systemValue: 275,
    recipes: [{ id: 'furniture-factory-default', name: '生产家具', cycleMs: 60_000, operatingCost: 4, inputs: [{ productId: 'lumber', quantity: 2 }], output: { productId: 'furniture', quantity: 2 } }],
  },
  {
    id: 'garment-factory', name: '制衣厂', category: 'consumer', buildCost: 225, buildTimeMs: 14 * 60 * 1000,
    defaultRecipeId: 'garment-factory-default', internalCapacity: 30, systemValue: 295,
    recipes: [{ id: 'garment-factory-default', name: '生产服装', cycleMs: 60_000, operatingCost: 6, inputs: [{ productId: 'textile', quantity: 2 }], output: { productId: 'clothing', quantity: 1 } }],
  },
  {
    id: 'machine-factory', name: '机械厂', category: 'industrial', buildCost: 240, buildTimeMs: 15 * 60 * 1000,
    defaultRecipeId: 'machine-factory-default', internalCapacity: 15, systemValue: 320,
    recipes: [{ id: 'machine-factory-default', name: '生产机械', cycleMs: 60_000, operatingCost: 6, inputs: [{ productId: 'steel', quantity: 2 }], output: { productId: 'machinery', quantity: 1 } }],
  },
  {
    id: 'electronics-factory', name: '电子工厂', category: 'industrial', buildCost: 320, buildTimeMs: 18 * 60 * 1000,
    defaultRecipeId: 'electronics-factory-default', internalCapacity: 15, systemValue: 420,
    recipes: [{ id: 'electronics-factory-default', name: '生产电子产品', cycleMs: 60_000, operatingCost: 10, inputs: [{ productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 }], output: { productId: 'electronics', quantity: 1 } }],
  },
  {
    id: 'appliance-factory', name: '家电厂', category: 'industrial', buildCost: 390, buildTimeMs: 20 * 60 * 1000,
    defaultRecipeId: 'appliance-factory-default', internalCapacity: 12, systemValue: 510,
    recipes: [{ id: 'appliance-factory-default', name: '生产家电', cycleMs: 60_000, operatingCost: 6, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }], output: { productId: 'appliance', quantity: 2 } }],
  },
];

function freezeRecipe(recipe) {
  const inputs = Object.freeze((recipe.inputs || []).map((input) => Object.freeze({ ...input })));
  return Object.freeze({
    ...recipe,
    inputs,
    input: inputs.length === 1 ? inputs[0] : null,
    output: Object.freeze({ ...recipe.output }),
  });
}

export const FACILITY_TYPE_CATALOG = Object.freeze(rawFacilities.map((facility) => {
  const recipes = Object.freeze(facility.recipes.map(freezeRecipe));
  const defaultRecipe = recipes.find((recipe) => recipe.id === facility.defaultRecipeId) || recipes[0];
  return Object.freeze({
    ...facility,
    cycleMs: defaultRecipe.cycleMs,
    operatingCost: defaultRecipe.operatingCost,
    inputs: defaultRecipe.inputs,
    input: defaultRecipe.input,
    output: defaultRecipe.output,
    recipes,
  });
}));
