import { readFileSync, writeFileSync } from 'node:fs';

function patch(path, from, to) {
  let content = readFileSync(path, 'utf8');
  if (content.includes(to)) return;
  if (!content.includes(from)) throw new Error(`${path} 缺少兼容补丁锚点`);
  content = content.replace(from, to);
  writeFileSync(path, content.replace(/\r\n/g, '\n'));
}

patch(
  'server/src/facility-groups.js',
  '    facilityTypes: FACILITY_TYPE_CATALOG.map(({ internalCapacity: _internalCapacity, ...type }) => clone(type)),',
  `    facilityTypes: FACILITY_TYPE_CATALOG.map(({ internalCapacity: _internalCapacity, ...type }) => clone({
      ...type,
      recipes: recipesFor(type).filter(
        (recipe) => (recipe.productionMethodId || 'standard') === 'standard',
      ),
    })),`,
);

patch(
  'src/pages/production/ProductionFacilityDetail.tsx',
  `export function recipeVariantsForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  if (Array.isArray(type.recipes) && type.recipes.length > 0) return type.recipes;
  return [
    {
      id: type.defaultRecipeId || \`${'${type.id}'}-default\`,
      name: type.name,
      baseRecipeId: type.defaultRecipeId || \`${'${type.id}'}-default\`,
      productionMethodId: 'standard',
      cycleMs: type.cycleMs,
      operatingCost: type.operatingCost,
      inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
      output: type.output,
    },
  ];
}`,
  `export function recipeVariantsForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  const baseRecipes = Array.isArray(type.recipes) && type.recipes.length > 0
    ? type.recipes.filter((recipe) => (recipe.productionMethodId ?? 'standard') === 'standard')
    : [
      {
        id: type.defaultRecipeId || \`${'${type.id}'}-default\`,
        name: type.name,
        baseRecipeId: type.defaultRecipeId || \`${'${type.id}'}-default\`,
        productionMethodId: 'standard' as const,
        cycleMs: type.cycleMs,
        operatingCost: type.operatingCost,
        inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
        output: type.output,
      },
    ];
  const methodGroup = productionMethodGroupForType(type);
  if (!methodGroup) return baseRecipes;
  const variants = baseRecipes.flatMap((baseRecipe) => methodGroup.methods.flatMap((method) => {
    const plan = method.plansByRecipeId[baseRecipe.id];
    return plan ? [{
      id: plan.recipeId,
      name: baseRecipe.name,
      baseRecipeId: baseRecipe.id,
      productionMethodId: method.id,
      cycleMs: plan.cycleMs,
      operatingCost: plan.operatingCost,
      inputs: plan.inputs,
      input: plan.input,
      output: plan.output,
    }] : [];
  }));
  return variants.length > 0 ? variants : baseRecipes;
}`,
);

const serverDocPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
let serverDoc = readFileSync(serverDocPath, 'utf8');
const anchor = '- 该扩展只向客户端目录增加可选元数据，并保留标准配方原 ID，因此客户端状态版本保持 24、世界状态版本保持 21；旧世界缺少生产方式选择时自然使用标准生产。';
const rule = '- 普通玩家状态中的 `facilityTypes[].recipes` 继续只公开标准生产路线；新客户端从可选 `productionMethodGroups` 元数据合成方式变体，旧版本 24 客户端忽略新增元数据后仍只看到原有配方列表。';
if (!serverDoc.includes(rule)) {
  if (!serverDoc.includes(anchor)) throw new Error('服务器设计缺少状态版本兼容锚点');
  serverDoc = serverDoc.replace(anchor, `${anchor}\n${rule}`);
  writeFileSync(serverDocPath, serverDoc.replace(/\r\n/g, '\n'));
}

console.log('客户端状态继续只公开标准配方，生产方式变体由新客户端元数据合成。');
