import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.replace(/\r\n/g, '\n'));
}

function replaceRequired(path, from, to) {
  const content = read(path);
  if (content.includes(to)) return;
  if (!content.includes(from)) throw new Error(`${path} 缺少待替换内容`);
  write(path, content.replace(from, to));
}

replaceRequired(
  'server/src/market-demand.js',
  '  const allRecipes = Object.freeze(facilities.flatMap((facility) => facility.recipes\n    .map((recipe) => Object.freeze({',
  "  const allRecipes = Object.freeze(facilities.flatMap((facility) => facility.recipes\n    .filter((recipe) => (recipe.productionMethodId || 'standard') === 'standard')\n    .map((recipe) => Object.freeze({",
);

replaceRequired(
  'server/src/domain.js',
  '  for (const facility of FACILITY_TYPE_CATALOG) {\n    for (const recipe of facility.recipes) {\n      productionDemandProductIds.add(recipe.output.productId);',
  "  for (const facility of FACILITY_TYPE_CATALOG) {\n    for (const recipe of facility.recipes) {\n      if ((recipe.productionMethodId || 'standard') !== 'standard') continue;\n      productionDemandProductIds.add(recipe.output.productId);",
);

let verifier = read('scripts/verify-production-methods.mjs');
if (!verifier.includes("const demandSource = readFileSync('server/src/market-demand.js', 'utf8');")) {
  verifier = verifier.replace(
    "const runtimeSource = readFileSync('server/src/facility-groups.js', 'utf8');",
    "const runtimeSource = readFileSync('server/src/facility-groups.js', 'utf8');\nconst demandSource = readFileSync('server/src/market-demand.js', 'utf8');\nconst domainSource = readFileSync('server/src/domain.js', 'utf8');",
  );
}
if (!verifier.includes('生产方式变体不得形成重复产业链边')) {
  verifier = verifier.replace(
    "assert.ok(runtimeSource.includes('applyPendingRecipe(group)'));",
    "assert.ok(runtimeSource.includes('applyPendingRecipe(group)'));\nassert.ok(\n  demandSource.includes(\".filter((recipe) => (recipe.productionMethodId || 'standard') === 'standard')\"),\n  '生产方式变体不得形成重复产业链边',\n);\nassert.ok(\n  domainSource.includes(\"if ((recipe.productionMethodId || 'standard') !== 'standard') continue;\"),\n  '需求元数据不得重复统计生产方式变体',\n);",
  );
}
write('scripts/verify-production-methods.mjs', verifier);

const industryPath = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md';
let industry = read(industryPath);
const industryAnchor = '- 服务器正式目录把“基础配方 × 生产方式”编译为不可变的生产方式配方变体。标准方式保留原配方 ID，其他方式使用稳定变体 ID；客户端不得自行计算周期、投入、产出或成本。';
const industryRule = '- 产业链需求、派生流动性、成本锚和价格双向传导只读取每条基础路线的标准生产变体；高速、节约和高产只是同一路线的运行计划，不得形成重复产业链边或重复需求预算。';
if (!industry.includes(industryRule)) {
  if (!industry.includes(industryAnchor)) throw new Error('产业设计缺少生产方式目录锚点');
  industry = industry.replace(industryAnchor, `${industryAnchor}\n${industryRule}`);
  write(industryPath, industry);
}

const serverPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
let server = read(serverPath);
const serverAnchor = '- 服务器必须在接受动作时验证变体属于目标工厂，在结算时只读取当前活动变体，禁止客户端上传自定义倍率或独立数值。';
const serverRule = '- 市场需求与价格传导构建产业图时必须过滤非标准生产变体，确保四种作业制度不会把一条正式配方扩张成四条需求边；该过滤由专项验证防回退。';
if (!server.includes(serverRule)) {
  if (!server.includes(serverAnchor)) throw new Error('服务器设计缺少生产方式结算锚点');
  server = server.replace(serverAnchor, `${serverAnchor}\n${serverRule}`);
  write(serverPath, server);
}

console.log('生产方式变体已从需求图和价格传导基础路线中去重。');
