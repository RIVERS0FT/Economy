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
  if (!content.includes(from)) throw new Error(`${path} 缺少待替换内容: ${from}`);
  write(path, content.replace(from, to));
}

function appendSection(path, marker, section) {
  const content = read(path);
  if (content.includes(marker)) return;
  write(path, `${content.trimEnd()}\n\n${section.trim()}\n`);
}

function updateDate(path) {
  const content = read(path);
  write(path, content.replace(/^> 更新时间：\d{4}-\d{2}-\d{2}$/m, '> 更新时间：2026-08-02'));
}

replaceRequired('src/types.ts', 'export interface EconomyState {\n  version: 25;', 'export interface EconomyState {\n  version: 24;');
replaceRequired(
  'server/src/production-methods.js',
  '  return Object.freeze(facility.recipes.flatMap((baseRecipe) => (\n    group.methods.map((method) => {\n      const plan = method.plansByRecipeId[baseRecipe.id];\n      return freezePlan({\n        ...plan,\n        name: baseRecipe.name,\n        baseRecipeId: baseRecipe.id,\n        productionMethodId: method.id,\n      });\n    })\n  )).filter((recipe) => baseRecipes.has(recipe.baseRecipeId)));',
  '  return Object.freeze(facility.recipes.flatMap((baseRecipe) => (\n    group.methods.map((method) => {\n      const plan = method.plansByRecipeId[baseRecipe.id];\n      return freezePlan({\n        ...plan,\n        name: baseRecipe.name,\n        baseRecipeId: baseRecipe.id,\n        productionMethodId: method.id,\n      });\n    })\n  )).filter((recipe) => baseRecipes.has(recipe.baseRecipeId)));',
);

const helper = read('server/src/production-methods.js');
const brokenFreeze = 'return Object.freeze(facility.recipes.flatMap((baseRecipe) => (\n    group.methods.map((method) => {\n      const plan = method.plansByRecipeId[baseRecipe.id];\n      return freezePlan({\n        ...plan,\n        name: baseRecipe.name,\n        baseRecipeId: baseRecipe.id,\n        productionMethodId: method.id,\n      });\n    })\n  )).filter((recipe) => baseRecipes.has(recipe.baseRecipeId)));';
if (!helper.includes(brokenFreeze)) {
  const old = 'return Object.freeze(facility.recipes.flatMap((baseRecipe) => (\n    group.methods.map((method) => {\n      const plan = method.plansByRecipeId[baseRecipe.id];\n      return freezePlan({\n        ...plan,\n        name: baseRecipe.name,\n        baseRecipeId: baseRecipe.id,\n        productionMethodId: method.id,\n      });\n    })\n  ))).filter((recipe) => baseRecipes.has(recipe.baseRecipeId));';
  if (!helper.includes(old)) throw new Error('production-methods.js 配方数组冻结结构未知');
  write('server/src/production-methods.js', helper.replace(old, brokenFreeze));
}

replaceRequired(
  'scripts/verify-unified-factory-recipes-grid.mjs',
  "  '<strong>生产配方</strong>',",
  "  '<strong>生产配置</strong>',",
);
replaceRequired(
  'scripts/verify-unified-factory-recipes-grid.mjs',
  "  'event.target.value !== recipeState.selectedRecipeId',",
  "  'productionRecipeVariantId',",
);

const packageJsonPath = 'package.json';
let packageJson = read(packageJsonPath);
if (!packageJson.includes('"verify:production-methods"')) {
  packageJson = packageJson.replace(
    '    "verify:recipe-profit-analysis": "node --experimental-strip-types scripts/verify-recipe-profit-analysis.mjs",',
    '    "verify:recipe-profit-analysis": "node --experimental-strip-types scripts/verify-recipe-profit-analysis.mjs",\n    "verify:production-methods": "node scripts/verify-production-methods.mjs",',
  );
}
if (!packageJson.includes('verify-industry-catalog.mjs && node scripts/verify-production-methods.mjs')) {
  packageJson = packageJson.replace(
    'node scripts/verify-industry-catalog.mjs && node scripts/verify-unified-factory-recipes-grid.mjs',
    'node scripts/verify-industry-catalog.mjs && node scripts/verify-production-methods.mjs && node scripts/verify-unified-factory-recipes-grid.mjs',
  );
}
write(packageJsonPath, packageJson);

const docsIndex = 'docs/README.md';
let docsIndexContent = read(docsIndex);
const oldIndustryResponsibility = '31 种商品、21 种工厂、整数经济数值、参考利润、周期成本工资、生产复杂度岗位结构、固定建造业岗位结构、持续生产、三态、自动恢复、工厂抵押生产资格，以及长期供货合同与生产／资产守恒审计边界';
const newIndustryResponsibility = '31 种商品、21 种工厂、整数经济数值、参考利润、周期成本工资、生产复杂度岗位结构、固定建造业岗位结构、持续生产、集群级生产方式、三态、自动恢复、工厂抵押生产资格，以及长期供货合同与生产／资产守恒审计边界';
if (!docsIndexContent.includes(newIndustryResponsibility)) {
  if (!docsIndexContent.includes(oldIndustryResponsibility)) throw new Error('docs/README.md 产业职责文本未知');
  docsIndexContent = docsIndexContent.replace(oldIndustryResponsibility, newIndustryResponsibility);
  write(docsIndex, docsIndexContent);
}

appendSection('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '## 工厂生产方式', `
## 工厂生产方式

- 生产配方决定工厂生产什么，生产方式决定同一配方如何生产；两者都属于同类型工厂集群的共享配置，不属于单座工厂资产。
- 首期每种工厂固定提供一个“作业制度”组，组内为标准生产、高速生产、节约生产和高产生产，且同一时刻只能选择一种。
- 标准生产保持正式基础配方；高速生产缩短周期并提高周期成本；节约生产延长周期并降低周期成本；高产生产保持周期、成倍增加正式投入和产出并重新计算整数周期成本。
- 四种方式在商品初始参考价下必须精确保持工厂复杂度对应的参考分钟利润，市场真实价格变化后才形成速度、现金流、原料消耗和仓库压力之间的不同选择；不得加入无代价的永久最优方式。
- 服务器正式目录把“基础配方 × 生产方式”编译为不可变的生产方式配方变体。标准方式保留原配方 ID，其他方式使用稳定变体 ID；客户端不得自行计算周期、投入、产出或成本。
- 所有变体的周期必须为整秒，投入、产出与周期成本必须为安全整数，周期成本不得为负；目录验证必须覆盖所有工厂、所有基础配方和全部四种方式。
- 运行中的集群修改基础配方或生产方式时，不重置当前进度，不改变当前周期锁定计划。生产方式与配方必须在同一个周期边界原子切换；停止或异常状态下可以立即采用新配置并重新检查运行条件。
- 新建、买入和解冻工厂沿用买方同类集群的当前配置；卖出、拍卖和抵押不携带卖方的生产方式状态。不得新增单座工厂生产方式状态、装备槽、工厂实例升级或可转移配置。
- 生产工资、原料扣除、仓库检查、累计产量和统计全部读取服务器解析后的当前变体；任一条件不满足时仍必须保持资金、原料和库存的原子性。
`);

appendSection('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '## 生产页作业制度', `
## 生产页作业制度

- 生产页工厂详情把基础配方与作业制度放在同一个“生产配置”区。基础配方使用统一选择控件，作业制度使用四张互斥选择卡。
- 选择卡必须显示方式名称以及该基础配方对应的周期、单周期产出和周期成本；页面效果预览、真实价格利润和生产公式必须读取服务器返回的变体数值。
- 运行中改变任一配置时显示“下一周期切换”为目标基础配方与生产方式，当前周期内容保持不变；一次操作必须提交完整目标变体，不得先后发送两个会形成中间状态的请求。
- 桌面详情和移动底部详情必须共用同一生产配置组件、相同选择状态与相同下一周期语义。
`);

appendSection('docs/UI_DESIGN_SYSTEM.md', '## 生产方式选择卡', `
## 生产方式选择卡

- 生产方式选择卡使用语义化 \`radiogroup\` 与 \`radio\`，四种方式互斥；选中态必须同时具有边框、背景和 \`aria-checked\`，不得仅依赖颜色表达。
- 桌面和宽详情默认两列，窄屏改为单列；卡片文本必须允许在中文界面下保持可读，数值使用等宽数字，并关闭浏览器原生蓝色 tap highlight。
- 鼠标、触摸与键盘均可选择方式；必须保留 \`:focus-visible\` 焦点，减少动态偏好下关闭过渡动画。
- 卡片颜色只表达标准、速度、节约和高产的提示语气，不代表收益保证；真实利润仍以生产公式和最近真实成交价为准。
`);

appendSection('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '## 生产方式配方变体', `
## 生产方式配方变体

- 服务器 \`industry-catalog.js\` 是生产方式数值的唯一正式来源，并通过 \`production-methods.js\` 把每个基础配方编译为标准、高速、节约和高产四个生产方式配方变体。
- 生产方式不新增世界状态字段、不新增动作路由，也不改变工厂资产结构；现有 \`setFacilityRecipe\` 动作接收目标变体 ID，继续复用 \`activeRecipeId\`／\`pendingRecipeId\` 和周期边界切换事务。
- 该扩展只向客户端目录增加可选元数据，并保留标准配方原 ID，因此客户端状态版本保持 24、世界状态版本保持 21；旧世界缺少生产方式选择时自然使用标准生产。
- 服务器必须在接受动作时验证变体属于目标工厂，在结算时只读取当前活动变体，禁止客户端上传自定义倍率或独立数值。
`);

for (const path of [
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/README.md',
]) updateDate(path);

console.log('生产方式文档、版本兼容和防回退入口已整理。');
