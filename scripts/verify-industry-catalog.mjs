import { auditRecipe } from './audit-economy-balance.mjs';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';
import { RESEARCH_TECHNOLOGY_CATALOG } from '../server/src/research-catalog.js';

const expectedProducts = [
  'wheat', 'rice', 'cotton', 'sugarcane', 'fruit', 'timber', 'ore', 'copper-ore', 'crude-oil',
  'meat', 'eggs', 'milk', 'fish', 'wool', 'flour', 'sugar', 'lumber', 'steel', 'copper',
  'plastic', 'industrial-fuel', 'industrial-chemicals', 'fertilizer', 'feed', 'veterinary-medicine',
  'textile', 'pulp', 'food', 'beverage', 'prepared-meal', 'paper', 'furniture', 'clothing', 'tools',
  'machinery', 'tractor', 'electronics', 'appliance',
];
const expectedFacilities = [
  'farm', 'orchard', 'ranch', 'fishery',
  'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'feed-factory',
  'pulp-mill', 'steelworks', 'textile-mill', 'food-factory', 'paper-mill',
  'refinery', 'fertilizer-factory', 'veterinary-medicine-factory', 'beverage-factory',
  'furniture-factory', 'garment-factory', 'tool-workshop', 'machine-factory', 'tractor-factory',
  'electronics-factory', 'appliance-factory',
];
const expectedPrices = {
  wheat: 1.2, rice: 1.2, cotton: 1.2, sugarcane: 1.2, fruit: 1.3, timber: 6, ore: 7,
  'copper-ore': 7, 'crude-oil': 9, meat: 2.4, eggs: 2.4, milk: 2.4, fish: 2.5, wool: 2.4,
  flour: 13, sugar: 13, lumber: 17, steel: 29, copper: 29, plastic: 30,
  'industrial-fuel': 4, 'industrial-chemicals': 5, fertilizer: 6.76, feed: 5.8,
  'veterinary-medicine': 14.1, textile: 20, pulp: 20, food: 15, beverage: 18,
  'prepared-meal': 18, paper: 15, furniture: 24, clothing: 55, tools: 12, machinery: 15.55,
  tractor: 15.35, electronics: 84, appliance: 92,
};
const expectedConstruction = {
  farm: { complexity: 'C1', buildCost: 50, buildInputs: [], systemValue: 65 },
  orchard: { complexity: 'C1', buildCost: 70, buildInputs: [], systemValue: 95 },
  ranch: { complexity: 'C1', buildCost: 58, buildInputs: [{ productId: 'timber', quantity: 3 }, { productId: 'ore', quantity: 2 }], systemValue: 120 },
  fishery: { complexity: 'C1', buildCost: 62, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 2 }], systemValue: 130 },
  'logging-camp': { complexity: 'C2', buildCost: 85, buildInputs: [{ productId: 'cotton', quantity: 6 }, { productId: 'ore', quantity: 4 }], systemValue: 160 },
  mine: { complexity: 'C2', buildCost: 109, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'cotton', quantity: 6 }], systemValue: 185 },
  'oil-field': { complexity: 'C2', buildCost: 121, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 4 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 235 },
  mill: { complexity: 'C2', buildCost: 98, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 195 },
  sawmill: { complexity: 'C2', buildCost: 112, buildInputs: [{ productId: 'timber', quantity: 5 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 225 },
  'feed-factory': { complexity: 'C2', buildCost: 108, buildInputs: [{ productId: 'timber', quantity: 4 }, { productId: 'ore', quantity: 3 }, { productId: 'copper-ore', quantity: 1 }], systemValue: 210 },
  'pulp-mill': { complexity: 'C3', buildCost: 110, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 1 }], systemValue: 250 },
  steelworks: { complexity: 'C3', buildCost: 137, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'ore', quantity: 5 }], systemValue: 315 },
  'textile-mill': { complexity: 'C3', buildCost: 111, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 2 }], systemValue: 290 },
  'food-factory': { complexity: 'C3', buildCost: 121, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 2 }], systemValue: 300 },
  'paper-mill': { complexity: 'C3', buildCost: 124, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 2 }], systemValue: 325 },
  refinery: { complexity: 'C4', buildCost: 104, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'copper', quantity: 1 }], systemValue: 390 },
  'fertilizer-factory': { complexity: 'C4', buildCost: 134, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'copper', quantity: 1 }], systemValue: 430 },
  'veterinary-medicine-factory': { complexity: 'C4', buildCost: 163, buildInputs: [{ productId: 'lumber', quantity: 3 }, { productId: 'steel', quantity: 4 }, { productId: 'plastic', quantity: 1 }], systemValue: 470 },
  'beverage-factory': { complexity: 'C4', buildCost: 96, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 3 }, { productId: 'copper', quantity: 1 }], systemValue: 365 },
  'furniture-factory': { complexity: 'C4', buildCost: 140, buildInputs: [{ productId: 'lumber', quantity: 6 }, { productId: 'steel', quantity: 2 }], systemValue: 390 },
  'garment-factory': { complexity: 'C4', buildCost: 165, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 3 }, { productId: 'plastic', quantity: 1 }], systemValue: 455 },
  'tool-workshop': { complexity: 'C4', buildCost: 136, buildInputs: [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 4 }], systemValue: 420 },
  'machine-factory': { complexity: 'C5', buildCost: 130, buildInputs: [{ productId: 'steel', quantity: 7 }, { productId: 'copper', quantity: 3 }, { productId: 'plastic', quantity: 2 }], systemValue: 625 },
  'tractor-factory': { complexity: 'C5', buildCost: 214, buildInputs: [{ productId: 'steel', quantity: 8 }, { productId: 'copper', quantity: 2 }, { productId: 'machinery', quantity: 1 }], systemValue: 680 },
  'electronics-factory': { complexity: 'C6', buildCost: 216, buildInputs: [{ productId: 'steel', quantity: 6 }, { productId: 'copper', quantity: 6 }, { productId: 'plastic', quantity: 4 }, { productId: 'machinery', quantity: 1 }], systemValue: 910 },
  'appliance-factory': { complexity: 'C7', buildCost: 468, buildInputs: [{ productId: 'steel', quantity: 8 }, { productId: 'plastic', quantity: 5 }, { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }], systemValue: 1235 },
};
const capitalTargets = { C1: [80, 75, 70, 65], C2: [70, 70, 67, 65], C3: [75, 80, 70, 75], C4: [80, 85, 75, 80], C5: [80, 85, 75, 80], C6: [80, 85, 75, 80], C7: [80, 85, 75, 80] };
const retiredMethodIds = new Set([
  'standard', 'rapid', 'economical', 'high-yield', 'assisted', 'intensive', 'mechanized',
]);
const expectedC1Plans = {
  farm: [[], [['tools', 1], 12], [['fertilizer', 2], 14], [['tractor', 1], 16]],
  orchard: [[], [['tools', 1], 11], [['fertilizer', 2], 13], [['tractor', 1], 15]],
  ranch: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
  fishery: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]],
};
const expectedC2FirstRoutePlans = {
  'logging-camp': [
    [[], 2, 9.88],
    [[['tools', 1]], 4, 9.43],
    [[['tools', 1], ['industrial-fuel', 1]], 5, 11.1],
    [[['machinery', 1], ['industrial-fuel', 2]], 7, 14.99],
  ],
  mine: [
    [[], 2, 11.53],
    [[['tools', 1]], 4, 13],
    [[['tools', 1], ['industrial-chemicals', 1]], 5, 14.61],
    [[['machinery', 1], ['industrial-chemicals', 1], ['industrial-fuel', 1]], 6, 13.7],
  ],
  'oil-field': [
    [[], 2, 14.83],
    [[['industrial-chemicals', 1]], 3, 18.49],
    [[['machinery', 1], ['industrial-chemicals', 1]], 5, 20.1],
    [[['machinery', 1], ['industrial-chemicals', 1], ['industrial-fuel', 1]], 6, 24.63],
  ],
  mill: [
    [[['wheat', 2]], 1, 8.83],
    [[['wheat', 4], ['tools', 1]], 2, 7.06],
    [[['wheat', 6], ['machinery', 1]], 3, 13.64],
    [[['wheat', 6], ['machinery', 1], ['industrial-fuel', 1]], 4, 22.19],
  ],
  sawmill: [
    [[['timber', 2]], 1, 2.93],
    [[['timber', 8], ['tools', 1]], 4, 4.47],
    [[['timber', 7], ['machinery', 1]], 4, 6.8],
    [[['timber', 8], ['machinery', 1], ['industrial-fuel', 1]], 5, 13.2],
  ],
  'feed-factory': [
    [[['wheat', 2], ['fruit', 1]], 2, 5.24],
    [[['wheat', 4], ['fruit', 2], ['tools', 1]], 5, 6.29],
    [[['wheat', 6], ['fruit', 3], ['machinery', 1]], 8, 15.64],
    [[['wheat', 8], ['fruit', 4], ['machinery', 1], ['industrial-fuel', 1]], 11, 24.54],
  ],
};

function standardRecipes(facility) {
  const defaultMethodId = facility.productionMethodGroups.find((group) => group.id === 'operation')?.defaultMethodId;
  return facility.recipes.filter((recipe) => recipe.productionMethodId === defaultMethodId);
}

function currentVariantsForRoute(facility, routeId) {
  return facility.recipes.filter((recipe) => recipe.baseRecipeId === routeId);
}

function hasAtMostTwoDecimals(value) {
  return Math.abs(Number(value) - Math.round(Number(value) * 100) / 100) < 1e-9;
}

assert.equal(PRODUCT_CATALOG.length, 38, '商品目录必须为 38 项');
assert.equal(FACILITY_TYPE_CATALOG.length, 26, '工厂目录必须为 26 项');
assert.deepEqual(PRODUCT_CATALOG.map((item) => item.id), expectedProducts);
assert.deepEqual(FACILITY_TYPE_CATALOG.map((item) => item.id), expectedFacilities);
assert.equal(PRODUCT_CATALOG.every((product) => typeof product.name === 'string' && product.name.trim().length > 0), true, '商品显示名必须非空');
assert.equal(new Set(PRODUCT_CATALOG.map((product) => product.name)).size, PRODUCT_CATALOG.length, '商品显示名必须唯一');
const facilityComplexityRanks = FACILITY_TYPE_CATALOG.map((item) => Number(item.complexity.slice(1)));
assert.deepEqual(
  facilityComplexityRanks,
  [...facilityComplexityRanks].sort((left, right) => left - right),
  '工厂正式目录必须按复杂度 C1 至 C7 升序排列',
);
assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((item) => [item.id, item.basePrice])), expectedPrices);
assert.deepEqual(Object.fromEntries(FACILITY_TYPE_CATALOG.map((item) => [item.id, {
  complexity: item.complexity,
  buildCost: item.buildCost,
  buildInputs: item.buildInputs,
  systemValue: item.systemValue,
}])), expectedConstruction);

const productIds = new Set(expectedProducts);
const cashOnlyFacilityIds = new Set(['farm', 'orchard']);
for (const product of PRODUCT_CATALOG) {
  assert.equal(hasAtMostTwoDecimals(product.basePrice), true, `${product.id} 初始参考价最多保留两位小数`);
  assert.ok(product.marketDemandGroupId === undefined || ['food', 'household'].includes(product.marketDemandGroupId), `${product.id} 市场需求组无效`);
}

for (const facility of FACILITY_TYPE_CATALOG) {
  assert.equal(Number.isInteger(facility.buildCost), true, `${facility.id} 建造费必须为整数`);
  assert.ok(Array.isArray(facility.buildInputs), `${facility.id} 必须声明 buildInputs 数组`);
  if (cashOnlyFacilityIds.has(facility.id)) assert.deepEqual(facility.buildInputs, [], `${facility.id} 必须使用空建造材料数组`);
  else assert.ok(facility.buildInputs.length > 0, `${facility.id} 必须声明至少一种建造材料`);

  let materialReferenceValue = 0;
  for (const item of facility.buildInputs) {
    assert.ok(productIds.has(item.productId), `${facility.id} 建造材料必须引用正式商品`);
    assert.equal(Number.isSafeInteger(item.quantity) && item.quantity > 0, true, `${facility.id} 建造材料数量必须为安全正整数`);
    assert.notEqual(item.productId, facility.output.productId, `${facility.id} 不得使用自身产出作为建造材料`);
    materialReferenceValue += expectedPrices[item.productId] * item.quantity;
  }
  assert.equal(
    facility.systemValue,
    Math.ceil(((facility.buildCost + materialReferenceValue) * 1.3) / 5) * 5,
    `${facility.id} 系统参考值必须按资金与材料参考总值的 130% 向上取整到 5`,
  );

  const routes = standardRecipes(facility);
  assert.ok(routes.some((recipe) => recipe.id === facility.defaultRecipeId));
  const defaultRecipe = routes.find((recipe) => recipe.id === facility.defaultRecipeId);
  assert.equal(facility.cycleMs, defaultRecipe.cycleMs);
  assert.equal(facility.operatingCost, defaultRecipe.operatingCost);

  const methodGroup = facility.productionMethodGroups.find((group) => group.id === 'operation');
  assert.ok(methodGroup, `${facility.id} 必须声明作业制度`);
  assert.equal(methodGroup.methods.length, 4, `${facility.id} 必须有四种具名作业制度`);
  assert.equal(methodGroup.defaultMethodId, methodGroup.methods[0].id, `${facility.id} 默认制度必须是第一项`);
  const isDedicated = facility.complexity === 'C1' || facility.complexity === 'C2';
  const methodIds = methodGroup.methods.map((method) => method.id);
  assert.equal(new Set(methodIds).size, 4, `${facility.id} 作业制度 ID 必须唯一`);
  assert.equal(methodIds.some((methodId) => retiredMethodIds.has(methodId)), false, `${facility.id} 不得泄漏旧制度 ID`);
  for (const method of methodGroup.methods) {
    assert.ok(Array.isArray(method.requiredTechnologyIds), `${facility.id}/${method.id} 必须声明研发依赖数组`);
    assert.match(method.iconId, /^[a-z][a-z0-9-]*$/, `${facility.id}/${method.id} 缺少语义图标`);
    if (isDedicated && method.id !== methodGroup.defaultMethodId) assert.ok(method.requiredTechnologyIds.length > 0, `${facility.id}/${method.id} 必须有研发门槛`);
    if (!isDedicated) assert.deepEqual(method.requiredTechnologyIds, [], `${facility.id}/${method.id} 具名制度不得新增隐式研发门槛`);
  }

  const currentRecipes = facility.recipes;
  assert.equal(currentRecipes.length, routes.length * methodIds.length);
  assert.equal(facility.recipes.some((recipe) => recipe.legacyProductionMethod), false);

  for (const route of routes) {
    const variants = currentVariantsForRoute(facility, route.id);
    assert.deepEqual(variants.map((recipe) => recipe.productionMethodId), methodIds);
    for (const recipe of variants) {
      assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
      assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true);
      assert.equal(hasAtMostTwoDecimals(recipe.operatingCost), true);
      assert.ok(recipe.operatingCost >= 0, `${facility.id}/${recipe.id} 周期成本不得为负数`);
      for (const input of recipe.inputs) {
        assert.ok(productIds.has(input.productId));
        assert.equal(Number.isInteger(input.quantity), true);
      }
      assert.ok(productIds.has(recipe.output.productId));
      assert.equal(Number.isInteger(recipe.output.quantity), true);
      const audit = auditRecipe(facility, recipe);
      const target = capitalTargets[facility.complexity][methodIds.indexOf(recipe.productionMethodId)];
      assert.ok(audit.netPerMinute > 0 && Math.abs(audit.recoveryMinutes - target) < 1, `${facility.id}/${recipe.id} 占款回收目标漂移`);
    }

    if (facility.complexity === 'C1') {
      assert.equal(variants.every((recipe) => recipe.cycleMs === route.cycleMs), true);
      assert.equal(variants.every((recipe) => recipe.operatingCost >= 0), true);
      assert.deepEqual(variants[0].inputs, []);
      assert.equal(variants[0].output.quantity, 1);
      for (let index = 1; index < variants.length; index += 1) {
        const [expectedInput, expectedOutput] = expectedC1Plans[facility.id][index];
        assert.deepEqual(variants[index].inputs.map((input) => [input.productId, input.quantity]), [expectedInput]);
        assert.equal(variants[index].output.quantity, expectedOutput);
      }
      continue;
    }
    if (facility.complexity === 'C2') continue;

    const rapid = variants[1];
    const economical = variants[2];
    const highYield = variants[3];
    assert.ok(rapid.cycleMs <= route.cycleMs && rapid.operatingCost >= route.operatingCost);
    assert.ok(economical.cycleMs >= route.cycleMs && economical.operatingCost <= route.operatingCost);
    assert.equal(highYield.cycleMs, route.cycleMs);
    assert.equal(highYield.output.quantity, route.output.quantity * 2);
    assert.deepEqual(highYield.inputs, route.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })));
  }
}

const facilities = new Map(FACILITY_TYPE_CATALOG.map((item) => [item.id, item]));
for (const [facilityId, plans] of Object.entries(expectedC2FirstRoutePlans)) {
  const facility = facilities.get(facilityId);
  const route = standardRecipes(facility)[0];
  const variants = currentVariantsForRoute(facility, route.id);
  assert.deepEqual(variants.map((recipe) => [
    recipe.inputs.map((input) => [input.productId, input.quantity]),
    recipe.output.quantity,
    recipe.operatingCost,
  ]), plans, `${facilityId} C2 作业制度数值漂移`);
}

assert.deepEqual(standardRecipes(facilities.get('farm')).map((item) => item.id), ['wheat-crop', 'rice-crop', 'cotton-crop', 'sugarcane-crop']);
assert.equal(standardRecipes(facilities.get('orchard'))[0].output.productId, 'fruit');
assert.equal(standardRecipes(facilities.get('fishery'))[0].output.productId, 'fish');
assert.equal(facilities.get('mill').name, '磨坊');
assert.deepEqual(standardRecipes(facilities.get('mill')).map((item) => item.id), ['mill-default', 'sugar-milling']);
assert.equal(facilities.get('steelworks').name, '冶炼厂');
assert.equal(facilities.has('copper-smelter'), false, '不得新增铜冶炼厂');
assert.deepEqual(standardRecipes(facilities.get('food-factory')).map((item) => item.id), ['food-factory-default', 'prepared-meal-production']);
assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((item) => item.id), ['milk-beverage', 'fruit-beverage']);
const feedRecipe = standardRecipes(facilities.get('feed-factory'))[0];
assert.deepEqual(feedRecipe.inputs, [{ productId: 'wheat', quantity: 2 }, { productId: 'fruit', quantity: 1 }]);
assert.deepEqual(feedRecipe.output, { productId: 'feed', quantity: 2 });
assert.equal(feedRecipe.cycleMs, 60_000);
assert.equal(feedRecipe.operatingCost, 5.24);
assert.deepEqual(standardRecipes(facilities.get('mill')).map((item) => item.operatingCost), [8.83, 8.83]);
assert.deepEqual(standardRecipes(facilities.get('textile-mill')).map((item) => item.operatingCost), [10.33, 12.73]);
assert.equal(standardRecipes(facilities.get('food-factory'))[1].operatingCost, 16.23);
assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((item) => item.operatingCost), [15.96, 15.76]);
assert.equal(standardRecipes(facilities.get('furniture-factory'))[0].operatingCost, 8.7);
assert.deepEqual(standardRecipes(facilities.get('tool-workshop'))[0].inputs, [{ productId: 'steel', quantity: 1 }, { productId: 'lumber', quantity: 1 }]);
assert.deepEqual(standardRecipes(facilities.get('tool-workshop'))[0].output, { productId: 'tools', quantity: 5 });
assert.deepEqual(standardRecipes(facilities.get('electronics-factory'))[0].inputs, [{ productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 }]);
assert.deepEqual(standardRecipes(facilities.get('appliance-factory'))[0].inputs, [{ productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }]);

const refineryRecipes = standardRecipes(facilities.get('refinery'));
assert.deepEqual(refineryRecipes.map((recipe) => recipe.id), ['refinery-default', 'industrial-fuel-refining', 'industrial-chemicals-refining']);
const fuelProduct = PRODUCT_CATALOG.find((product) => product.id === 'industrial-fuel');
const chemicalProduct = PRODUCT_CATALOG.find((product) => product.id === 'industrial-chemicals');
assert.equal(refineryRecipes[1].name, `生产${fuelProduct.name}`);
assert.equal(refineryRecipes[2].name, `生产${chemicalProduct.name}`);
assert.deepEqual(refineryRecipes[1].inputs, [{ productId: 'crude-oil', quantity: 1 }]);
assert.deepEqual(refineryRecipes[1].output, { productId: 'industrial-fuel', quantity: 4 });
assert.equal(refineryRecipes[1].cycleMs, 60_000);
assert.equal(refineryRecipes[1].operatingCost, 2.8);
assert.deepEqual(refineryRecipes[2].inputs, [{ productId: 'crude-oil', quantity: 2 }]);
assert.deepEqual(refineryRecipes[2].output, { productId: 'industrial-chemicals', quantity: 6 });
assert.equal(refineryRecipes[2].cycleMs, 60_000);
assert.equal(refineryRecipes[2].operatingCost, 7.32);

const coreSource = readFileSync('server/src/domain-core.js', 'utf8');
const productCatalogSource = readFileSync('server/src/product-catalog.js', 'utf8');
const catalogSource = readFileSync('server/src/industry-catalog.js', 'utf8');
const methodSource = readFileSync('server/src/production-methods.js', 'utf8');
const researchSource = readFileSync('server/src/research-catalog.js', 'utf8');
const legacyMethodSource = readFileSync('server/src/legacy-production-methods.js', 'utf8');
assert.ok(coreSource.includes("from './industry-catalog.js'"), '核心领域必须读取单一产业目录');
assert.equal(coreSource.includes('export const PRODUCT_CATALOG = Object.freeze(['), false, 'domain-core.js 不得复制正式商品目录');
assert.ok(productCatalogSource.includes('export const PRODUCT_CATALOG'), '商品目录必须由独立模块提供');
assert.ok(productCatalogSource.includes('resolveProductDisplayNames'), '商品目录必须提供显示名模板解析器');
assert.ok(catalogSource.includes("from './product-catalog.js'"), '产业目录必须从单一商品目录读取显示名');
assert.ok(methodSource.includes("from './product-catalog.js'"), '生产制度必须从单一商品目录解析显示名');
assert.ok(researchSource.includes("from './product-catalog.js'"), '研发目录必须从单一商品目录解析显示名');
for (const [path, source] of [
  ['industry-catalog.js', catalogSource],
  ['production-methods.js', methodSource],
  ['research-catalog.js', researchSource],
]) {
  for (const product of [fuelProduct, chemicalProduct]) {
    assert.equal(source.includes(product.name), false, `${path} 不得复制 ${product.id} 的显示名`);
  }
}
assert.equal(FACILITY_TYPE_CATALOG.some((facility) => facility.recipes.some((recipe) => recipe.name.includes('{product:'))), false, '运行时配方名不得残留商品占位符');
assert.equal(FACILITY_TYPE_CATALOG.some((facility) => facility.productionMethodGroups.some((group) => (
  group.methods.some((method) => `${method.name}${method.description}`.includes('{product:'))
))), false, '运行时作业制度不得残留商品占位符');
assert.equal(RESEARCH_TECHNOLOGY_CATALOG.some((technology) => `${technology.name}${technology.description}`.includes('{product:')), false, '运行时研发目录不得残留商品占位符');
assert.equal(coreSource.includes('STARTER_CONSTRUCTION_MATERIALS'), false, '不得恢复新玩家建造材料包');
assert.equal(coreSource.includes('grantStarterConstructionMaterials'), false, '不得恢复建造材料补发逻辑');
assert.ok(catalogSource.includes("from './production-methods.js'"));
for (const text of [
  'FACILITY_METHOD_BLUEPRINTS',
  "id: 'selective-logging'",
  "id: 'mechanized-mining'",
  "id: 'continuous-processing'",
  "id: 'continuous-mixing'",
  'requiredTechnologyIds',
  'iconId',
]) assert.ok(methodSource.includes(text) || catalogSource.includes(text), `C2 目录缺少 ${text}`);
for (const text of ["id: 'industrial-fuel'", "id: 'industrial-chemicals'"]) {
  assert.ok(productCatalogSource.includes(text), `商品目录缺少 ${text}`);
}
assert.ok(legacyMethodSource.includes('migrateLegacyProductionMethodRecipeId'));
assert.ok(legacyMethodSource.includes('isLegacyProductionMethodRecipeId'));
assert.equal(catalogSource.includes('appendLegacyC2RecipeAliases'), false, '产业目录不得装配旧制度别名');

assert.equal(existsSync('src/assets/product-icons/industrial-fuel.png'), true, 'industrial-fuel 缺少商品插画源文件');
assert.equal(existsSync('src/assets/product-icons/industrial-chemicals.png'), true, 'industrial-chemicals 缺少商品插画源文件');
const artworkStyle = readFileSync('src/styles/product-artwork.css', 'utf8');
const artworkGenerator = readFileSync('scripts/generate-product-artwork-thumbnails.mjs', 'utf8');
for (const id of ['industrial-fuel', 'industrial-chemicals']) {
  assert.ok(artworkStyle.includes(`[data-product-icon='${id}']`), `${id} 缺少商品插画映射`);
  assert.ok(artworkGenerator.includes(`'${id}'`), `${id} 缩略图生成清单缺失`);
}

for (const [path, texts] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '当前基线为 38 种商品和 26 种工厂类型',
    '基础价满员占款回收目标',
    '扣除真实卖出手续费',
    '化学品 (`industrial-chemicals`)',
    '`server/src/product-catalog.js` 是商品玩家可见名称的唯一运行时来源',
    '26 类工厂全部使用正式目录声明的产业语义制度',
    '不同工厂允许复用同一制度 ID',
    '非默认作业制度必须校验 `requiredTechnologyIds`',
    '旧制度 ID 只允许存在于迁移模块',
    '每周期整件消耗',
    '不累计折旧',
    '生产方式与配方必须在同一次配置动作中原子切换',
  ]],
]) {
  const content = readFileSync(path, 'utf8');
  for (const text of texts) assert.ok(content.includes(text), `${path} 缺少: ${text}`);
}

console.log('产业目录验证通过：38 种商品、26 种工厂、全工厂具名作业制度、炼油工业耗材和按制度区分的扣费占款回收目标。');

const fertilizerFacility = facilities.get('fertilizer-factory');
assert.ok(fertilizerFacility, '化肥厂必须存在于正式目录');
assert.equal(fertilizerFacility.name, '化肥厂');
assert.deepEqual(standardRecipes(fertilizerFacility)[0].inputs, [{ productId: 'crude-oil', quantity: 2 }]);
assert.deepEqual(standardRecipes(fertilizerFacility)[0].output, { productId: 'fertilizer', quantity: 6 });
assert.equal(standardRecipes(fertilizerFacility)[0].cycleMs, 60_000);
assert.equal(standardRecipes(fertilizerFacility)[0].operatingCost, 17.15);
