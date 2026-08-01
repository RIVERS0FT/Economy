import { readFileSync, writeFileSync } from 'node:fs';

const path = 'server/test/domain.test.js';
let content = readFileSync(path, 'utf8');

const helperAnchor = "  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));\n";
const helper = `${helperAnchor}  const standardRecipes = (facility) => facility.recipes.filter(\n    (recipe) => (recipe.productionMethodId || 'standard') === 'standard',\n  );\n`;
if (!content.includes('const standardRecipes = (facility) => facility.recipes.filter(')) {
  if (!content.includes(helperAnchor)) throw new Error('domain.test.js 缺少工厂目录断言锚点');
  content = content.replace(helperAnchor, helper);
}

const replacements = [
  [
    "facilities.get('farm').recipes.map((recipe) => recipe.output.productId)",
    "standardRecipes(facilities.get('farm')).map((recipe) => recipe.output.productId)",
  ],
  [
    "facilities.get('mill').recipes.map((recipe) => recipe.output.productId)",
    "standardRecipes(facilities.get('mill')).map((recipe) => recipe.output.productId)",
  ],
  [
    "facilities.get('food-factory').recipes.map((recipe) => recipe.output.productId)",
    "standardRecipes(facilities.get('food-factory')).map((recipe) => recipe.output.productId)",
  ],
  [
    "facilities.get('beverage-factory').recipes.map((recipe) => recipe.inputs)",
    "standardRecipes(facilities.get('beverage-factory')).map((recipe) => recipe.inputs)",
  ],
];
for (const [from, to] of replacements) {
  if (content.includes(to)) continue;
  if (!content.includes(from)) throw new Error(`domain.test.js 缺少待替换断言: ${from}`);
  content = content.replace(from, to);
}

writeFileSync(path, content.replace(/\r\n/g, '\n'));
console.log('领域目录测试已区分标准路线与生产方式变体。');
