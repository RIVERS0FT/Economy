import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-recipe-profit-analysis.mjs';
const source = readFileSync(path, 'utf8');
const before = `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { analyzeRecipeProfit } from '../src/utils/recipeProfitAnalysis.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');`;
const after = `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as tsModule from 'typescript';

const ts = tsModule.default ?? tsModule;
const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const orderPriceSource = read('src/utils/defaultOrderPrice.ts');
const priceFunctionMatch = orderPriceSource.match(
  /export function isValidOrderPrice\\(price: number\\) \\{[\\s\\S]*?\\n\\}/,
);
assert.ok(priceFunctionMatch, '缺少统一两位小数订单价格校验');
const executablePriceSource = priceFunctionMatch[0]
  .replace('export ', '')
  .replace('price: number', 'price');
const isValidOrderPrice = new Function(
  executablePriceSource + '\\nreturn isValidOrderPrice;',
)();

const recipeSource = read('src/utils/recipeProfitAnalysis.ts')
  .replace(/import type \\{[\\s\\S]*?\\} from '\\.\\.\\/types';\\n/, '')
  .replace("import { isValidOrderPrice } from './defaultOrderPrice';\\n", '')
  .replaceAll('export interface', 'interface')
  .replace('export function analyzeRecipeProfit', 'function analyzeRecipeProfit');
const executableRecipeSource = ts.transpileModule(recipeSource, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.None,
  },
}).outputText;
const analyzeRecipeProfit = new Function(
  'isValidOrderPrice',
  executableRecipeSource + '\\nreturn analyzeRecipeProfit;',
)(isValidOrderPrice);`;

if (!source.includes(before)) throw new Error(`${path} 缺少直接 TypeScript 导入片段`);
writeFileSync(path, source.replace(before, after));
console.log('利润验证脚本已改为内存转译，继续复用正式价格校验。');
