import { readFileSync, writeFileSync } from 'node:fs';

const path = 'tests/browser/runtime-harness.tsx';
let content = readFileSync(path, 'utf8');

const globalAnchor = `const auctionBidHistoryFetches: string[] = [];
Object.assign(window, { __auctionBidHistoryFetches: auctionBidHistoryFetches });`;
const globalReplacement = `const auctionBidHistoryFetches: string[] = [];
const productionRecipeRequests: string[] = [];
Object.assign(window, {
  __auctionBidHistoryFetches: auctionBidHistoryFetches,
  __productionRecipeRequests: productionRecipeRequests,
});`;
if (!content.includes(globalReplacement)) {
  if (!content.includes(globalAnchor)) throw new Error('runtime harness 缺少全局请求记录锚点');
  content = content.replace(globalAnchor, globalReplacement);
}

const scenarioAnchor = `    if (scenario === 'decimal-profit') {`;
const scenarioBlock = `    if (scenario === 'production-methods') {
      const baseType = next.game.facilityTypes[0];
      const baseRecipe = baseType.recipes[0];
      next.game.facilityTypes = [{
        ...baseType,
        productionMethodGroups: [{
          id: 'operation',
          name: '作业制度',
          defaultMethodId: 'standard',
          methods: [
            {
              id: 'standard', name: '标准生产', description: '保持标准生产参数。', tone: 'neutral',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: baseRecipe.id,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'standard',
                  cycleMs: baseRecipe.cycleMs,
                  operatingCost: baseRecipe.operatingCost,
                  inputs: baseRecipe.inputs,
                  output: baseRecipe.output,
                },
              },
            },
            {
              id: 'rapid', name: '高速生产', description: '缩短周期并提高成本。', tone: 'warning',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: \`${'${baseRecipe.id}'}--rapid\`,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'rapid',
                  cycleMs: 60_000,
                  operatingCost: 12,
                  inputs: baseRecipe.inputs,
                  output: baseRecipe.output,
                },
              },
            },
            {
              id: 'economical', name: '节约生产', description: '延长周期并降低成本。', tone: 'success',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: \`${'${baseRecipe.id}'}--economical\`,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'economical',
                  cycleMs: 180_000,
                  operatingCost: 4,
                  inputs: baseRecipe.inputs,
                  output: baseRecipe.output,
                },
              },
            },
            {
              id: 'high-yield', name: '高产生产', description: '增加投入与产出。', tone: 'accent',
              plansByRecipeId: {
                [baseRecipe.id]: {
                  recipeId: \`${'${baseRecipe.id}'}--high-yield\`,
                  baseRecipeId: baseRecipe.id,
                  productionMethodId: 'high-yield',
                  cycleMs: baseRecipe.cycleMs,
                  operatingCost: 16,
                  inputs: baseRecipe.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })),
                  output: { ...baseRecipe.output, quantity: baseRecipe.output.quantity * 2 },
                },
              },
            },
          ],
        }],
      }];
      next.game.facilityGroups = [{
        ...next.game.facilityGroups[0],
        pendingRecipeId: \`${'${baseRecipe.id}'}--rapid\`,
      }];
    }
${scenarioAnchor}`;
if (!content.includes("if (scenario === 'production-methods')")) {
  if (!content.includes(scenarioAnchor)) throw new Error('runtime harness 缺少生产场景锚点');
  content = content.replace(scenarioAnchor, scenarioBlock);
}

const actionAnchor = `      setFacilityRecipe: async () => ({ ok: true, message: '测试配方完成' }),`;
const actionReplacement = `      setFacilityRecipe: async (facilityTypeId: string, recipeId: string) => {
        productionRecipeRequests.push(\`${'${facilityTypeId}'}:${'${recipeId}'}\`);
        return { ok: true, message: '测试配方完成' };
      },`;
if (!content.includes('productionRecipeRequests.push')) {
  if (!content.includes(actionAnchor)) throw new Error('runtime harness 缺少配方动作锚点');
  content = content.replace(actionAnchor, actionReplacement);
}

writeFileSync(path, content.replace(/\r\n/g, '\n'));
console.log('生产方式浏览器场景已写入 runtime harness。');
