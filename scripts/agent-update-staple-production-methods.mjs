import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-staple-crops-demand.mjs';
let content = readFileSync(path, 'utf8');
const from = `const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('beverage-factory').recipes.map((recipe) => recipe.inputs), [
  [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
  [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
]);`;
const to = `const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const standardRecipes = (facility) => facility.recipes.filter(
  (recipe) => (recipe.productionMethodId || 'standard') === 'standard',
);
assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((recipe) => recipe.inputs), [
  [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
  [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
]);`;
if (!content.includes(to)) {
  if (!content.includes(from)) throw new Error('主食需求验证中的饮料配方断言结构未知');
  content = content.replace(from, to);
  writeFileSync(path, content.replace(/\r\n/g, '\n'));
}
console.log('主食需求目录断言已只检查标准生产路线。');
