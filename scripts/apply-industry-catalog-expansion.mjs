import { readFileSync, writeFileSync, rmSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`无法定位修改位置: ${label}`);
  return content.replace(pattern, replacement);
}

const productCatalog = `export const PRODUCT_CATALOG = Object.freeze([
  { id: 'grain', name: '粮食', category: 'raw', basePrice: 6 },
  { id: 'timber', name: '木材', category: 'raw', basePrice: 7 },
  { id: 'ore', name: '铁矿石', category: 'raw', basePrice: 8 },
  { id: 'crude-oil', name: '原油', category: 'raw', basePrice: 10 },
  { id: 'flour', name: '面粉', category: 'intermediate', basePrice: 13 },
  { id: 'lumber', name: '木板', category: 'intermediate', basePrice: 16 },
  { id: 'steel', name: '钢材', category: 'intermediate', basePrice: 20 },
  { id: 'plastic', name: '塑料', category: 'intermediate', basePrice: 30 },
  { id: 'food', name: '食品', category: 'consumer', basePrice: 18 },
  { id: 'furniture', name: '家具', category: 'consumer', basePrice: 38 },
  { id: 'machinery', name: '机械', category: 'industrial', basePrice: 45 },
  { id: 'electronics', name: '电子产品', category: 'industrial', basePrice: 72 },
]);`;

const facilityCatalog = `export const FACILITY_TYPE_CATALOG = Object.freeze([
  {
    id: 'farm',
    name: '农场',
    category: 'raw',
    buildCost: 60,
    buildTimeMs: 5 * 60 * 1000,
    cycleMs: 30_000,
    operatingCost: 1,
    input: null,
    output: { productId: 'grain', quantity: 2 },
    internalCapacity: 40,
    systemValue: 80,
  },
  {
    id: 'logging-camp',
    name: '伐木场',
    category: 'raw',
    buildCost: 65,
    buildTimeMs: 5 * 60 * 1000,
    cycleMs: 32_000,
    operatingCost: 1,
    input: null,
    output: { productId: 'timber', quantity: 2 },
    internalCapacity: 40,
    systemValue: 85,
  },
  {
    id: 'mine',
    name: '矿场',
    category: 'raw',
    buildCost: 70,
    buildTimeMs: 5 * 60 * 1000,
    cycleMs: 35_000,
    operatingCost: 1,
    input: null,
    output: { productId: 'ore', quantity: 2 },
    internalCapacity: 40,
    systemValue: 90,
  },
  {
    id: 'oil-field',
    name: '油田',
    category: 'raw',
    buildCost: 95,
    buildTimeMs: 7 * 60 * 1000,
    cycleMs: 42_000,
    operatingCost: 2,
    input: null,
    output: { productId: 'crude-oil', quantity: 2 },
    internalCapacity: 40,
    systemValue: 120,
  },
  {
    id: 'mill',
    name: '面粉厂',
    category: 'processing',
    buildCost: 100,
    buildTimeMs: 8 * 60 * 1000,
    cycleMs: 40_000,
    operatingCost: 2,
    input: { productId: 'grain', quantity: 2 },
    output: { productId: 'flour', quantity: 1 },
    internalCapacity: 30,
    systemValue: 130,
  },
  {
    id: 'sawmill',
    name: '锯木厂',
    category: 'processing',
    buildCost: 115,
    buildTimeMs: 8 * 60 * 1000,
    cycleMs: 45_000,
    operatingCost: 2,
    input: { productId: 'timber', quantity: 2 },
    output: { productId: 'lumber', quantity: 1 },
    internalCapacity: 30,
    systemValue: 150,
  },
  {
    id: 'steelworks',
    name: '钢铁厂',
    category: 'processing',
    buildCost: 140,
    buildTimeMs: 10 * 60 * 1000,
    cycleMs: 50_000,
    operatingCost: 3,
    input: { productId: 'ore', quantity: 3 },
    output: { productId: 'steel', quantity: 1 },
    internalCapacity: 25,
    systemValue: 180,
  },
  {
    id: 'refinery',
    name: '炼油厂',
    category: 'processing',
    buildCost: 185,
    buildTimeMs: 12 * 60 * 1000,
    cycleMs: 65_000,
    operatingCost: 4,
    input: { productId: 'crude-oil', quantity: 2 },
    output: { productId: 'plastic', quantity: 1 },
    internalCapacity: 25,
    systemValue: 240,
  },
  {
    id: 'food-factory',
    name: '食品厂',
    category: 'consumer',
    buildCost: 160,
    buildTimeMs: 10 * 60 * 1000,
    cycleMs: 45_000,
    operatingCost: 3,
    input: { productId: 'flour', quantity: 2 },
    output: { productId: 'food', quantity: 3 },
    internalCapacity: 45,
    systemValue: 210,
  },
  {
    id: 'furniture-factory',
    name: '家具厂',
    category: 'consumer',
    buildCost: 210,
    buildTimeMs: 12 * 60 * 1000,
    cycleMs: 60_000,
    operatingCost: 4,
    input: { productId: 'lumber', quantity: 2 },
    output: { productId: 'furniture', quantity: 2 },
    internalCapacity: 35,
    systemValue: 275,
  },
  {
    id: 'machine-factory',
    name: '机械厂',
    category: 'industrial',
    buildCost: 240,
    buildTimeMs: 15 * 60 * 1000,
    cycleMs: 90_000,
    operatingCost: 6,
    input: { productId: 'steel', quantity: 2 },
    output: { productId: 'machinery', quantity: 1 },
    internalCapacity: 15,
    systemValue: 320,
  },
  {
    id: 'electronics-factory',
    name: '电子工厂',
    category: 'industrial',
    buildCost: 320,
    buildTimeMs: 18 * 60 * 1000,
    cycleMs: 110_000,
    operatingCost: 8,
    input: { productId: 'plastic', quantity: 2 },
    output: { productId: 'electronics', quantity: 1 },
    internalCapacity: 15,
    systemValue: 420,
  },
]);`;

let domain = read('server/src/domain.js');
domain = replaceRequired(
  domain,
  /export const PRODUCT_CATALOG = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nexport const FACILITY_TYPE_CATALOG/,
  `${productCatalog}\n\nexport const FACILITY_TYPE_CATALOG`,
  '商品目录',
);
domain = replaceRequired(
  domain,
  /export const FACILITY_TYPE_CATALOG = Object\.freeze\(\[[\s\S]*?\n\]\);\n\nconst PRODUCTS/,
  `${facilityCatalog}\n\nconst PRODUCTS`,
  '工厂目录',
);
write('server/src/domain.js', domain);

let domainTest = read('server/test/domain.test.js');
domainTest = replaceRequired(
  domainTest,
  /import \{\n  applyAction,\n  createWorld,\n  ensurePlayer,\n  migrateWorld,\n\} from '\.\.\/src\/domain\.js';/,
  `import {\n  applyAction,\n  createWorld,\n  ensurePlayer,\n  FACILITY_TYPE_CATALOG,\n  migrateWorld,\n  processWorld,\n  PRODUCT_CATALOG,\n} from '../src/domain.js';`,
  '领域测试导入',
);
domainTest = domainTest
  .replace('assert.equal(state.products.length, 6);', 'assert.equal(state.products.length, 12);')
  .replace('assert.equal(state.facilityTypes.length, 6);', 'assert.equal(state.facilityTypes.length, 12);');
if (!domainTest.includes("expanded industry catalog exposes complete production chains")) {
  domainTest += `\n\ntest('expanded industry catalog exposes complete production chains', () => {\n  assert.equal(PRODUCT_CATALOG.length, 12);\n  assert.equal(FACILITY_TYPE_CATALOG.length, 12);\n\n  const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));\n  const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));\n  assert.equal(productIds.size, PRODUCT_CATALOG.length);\n  assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length);\n\n  for (const facility of FACILITY_TYPE_CATALOG) {\n    assert.equal(productIds.has(facility.output.productId), true);\n    if (facility.input) assert.equal(productIds.has(facility.input.productId), true);\n  }\n\n  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));\n  assert.deepEqual(facilities.get('logging-camp').output, { productId: 'timber', quantity: 2 });\n  assert.deepEqual(facilities.get('sawmill').input, { productId: 'timber', quantity: 2 });\n  assert.deepEqual(facilities.get('sawmill').output, { productId: 'lumber', quantity: 1 });\n  assert.deepEqual(facilities.get('oil-field').output, { productId: 'crude-oil', quantity: 2 });\n  assert.deepEqual(facilities.get('refinery').input, { productId: 'crude-oil', quantity: 2 });\n  assert.deepEqual(facilities.get('refinery').output, { productId: 'plastic', quantity: 1 });\n  assert.deepEqual(facilities.get('furniture-factory').input, { productId: 'lumber', quantity: 2 });\n  assert.deepEqual(facilities.get('furniture-factory').output, { productId: 'furniture', quantity: 2 });\n  assert.deepEqual(facilities.get('electronics-factory').input, { productId: 'plastic', quantity: 2 });\n  assert.deepEqual(facilities.get('electronics-factory').output, { productId: 'electronics', quantity: 1 });\n});\n\ntest('existing worlds receive new inventories, markets, and liquidity without resetting assets', () => {\n  const world = createWorld(now);\n  const player = ensurePlayer(world, alice, now);\n  player.credits = 777;\n  player.inventories.grain.available = 9;\n  const newProductIds = ['timber', 'crude-oil', 'lumber', 'plastic', 'furniture', 'electronics'];\n\n  for (const productId of newProductIds) {\n    delete player.inventories[productId];\n    delete world.markets[productId];\n  }\n  world.orders = world.orders.filter((order) => !newProductIds.includes(order.productId));\n\n  migrateWorld(world, now);\n  processWorld(world, now + 1);\n\n  assert.equal(player.credits, 777);\n  assert.equal(player.inventories.grain.available, 9);\n  for (const productId of newProductIds) {\n    assert.deepEqual(player.inventories[productId], { available: 0, frozen: 0 });\n    assert.equal(world.markets[productId].productId, productId);\n    assert.equal(world.orders.some((order) => order.productId === productId && order.side === 'buy' && order.ownerType === 'market'), true);\n    assert.equal(world.orders.some((order) => order.productId === productId && order.side === 'sell' && order.ownerType === 'market'), true);\n  }\n});\n`;
}
write('server/test/domain.test.js', domainTest);

let css = read('src/styles/industry-system.css');
css = replaceRequired(
  css,
  /\.product-tabs \{\n  display: grid;\n  grid-template-columns: repeat\(6, minmax\(130px, 1fr\)\);/,
  `.product-tabs {\n  display: grid;\n  grid-auto-flow: column;\n  grid-auto-columns: minmax(130px, 1fr);`,
  '商品标签桌面布局',
);
css = css.replace(
  'grid-template-columns: repeat(6, minmax(0, 1fr));',
  'grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));',
);
css = replaceRequired(
  css,
  /  \.product-tabs \{\n    grid-template-columns: repeat\(6, 126px\);\n    scroll-snap-type: x proximity;\n  \}/,
  `  .product-tabs {\n    grid-auto-columns: 126px;\n    scroll-snap-type: x proximity;\n  }`,
  '商品标签移动布局',
);
write('src/styles/industry-system.css', css);

let readme = read('README.md');
if (!readme.includes('当前目录共 12 种商品和 12 种工厂类型')) {
  readme = readme.replace(
    '## 工厂类型集群',
    `## 扩展产业目录\n\n当前目录共 12 种商品和 12 种工厂类型。新增两条完整产业链：\n\n\`\`\`text\n木材 → 木板 → 家具\n原油 → 塑料 → 电子产品\n\`\`\`\n\n旧存档在加载时自动补齐新商品的零库存槽位、新市场价格历史和基础买卖流动性，不重置资金、原有库存、工厂数量、订单或仓库。市场、概览、资金和生产页面都必须按服务器目录动态渲染，不得把 6 种商品或 6 种工厂写死在客户端。\n\n## 工厂类型集群`,
  );
}
readme = readme.replace(
  '农场 × 8\n矿场 × 4\n面粉厂 × 3',
  '农场 × 8\n伐木场 × 5\n矿场 × 4\n油田 × 2\n面粉厂 × 3\n锯木厂 × 2',
);
write('README.md', readme);

let industry = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
industry = industry.replace('> 更新时间：2026-07-11', '> 更新时间：2026-07-12');
industry = replaceRequired(
  industry,
  /## 2\. 商品目录[\s\S]*?## 3\. 工厂目录/,
  `## 2. 商品目录\n\n| ID | 名称 | 分类 | 初始参考价 |\n|---|---|---|---:|\n| \`grain\` | 粮食 | 原料 | 6 |\n| \`timber\` | 木材 | 原料 | 7 |\n| \`ore\` | 铁矿石 | 原料 | 8 |\n| \`crude-oil\` | 原油 | 原料 | 10 |\n| \`flour\` | 面粉 | 中间产品 | 13 |\n| \`lumber\` | 木板 | 中间产品 | 16 |\n| \`steel\` | 钢材 | 中间产品 | 20 |\n| \`plastic\` | 塑料 | 中间产品 | 30 |\n| \`food\` | 食品 | 消费品 | 18 |\n| \`furniture\` | 家具 | 消费品 | 38 |\n| \`machinery\` | 机械 | 工业品 | 45 |\n| \`electronics\` | 电子产品 | 工业品 | 72 |\n\n正式目录固定由服务器提供，当前基线为 12 种商品。商品 ID 必须唯一，已有 ID 不得重命名或复用。扩展目录时，旧存档必须自动补齐零库存、市场价格历史和基础买卖流动性，不得重置既有资产。\n\n## 3. 工厂目录`,
  '商品目录表',
);
industry = replaceRequired(
  industry,
  /\| ID \| 工厂 \| 输入 \| 输出 \| 周期 \| 单座周期成本 \| 建造费 \| 施工时间 \| 单座系统估值 \|[\s\S]*?\n\n目录由服务器/,
  `| ID | 工厂 | 输入 | 输出 | 周期 | 单座周期成本 | 建造费 | 施工时间 | 单座系统估值 |\n|---|---|---|---|---:|---:|---:|---:|---:|\n| \`farm\` | 农场 | 无 | 2 粮食 | 30 秒 | 1 | 60 | 5 分钟 | 80 |\n| \`logging-camp\` | 伐木场 | 无 | 2 木材 | 32 秒 | 1 | 65 | 5 分钟 | 85 |\n| \`mine\` | 矿场 | 无 | 2 铁矿石 | 35 秒 | 1 | 70 | 5 分钟 | 90 |\n| \`oil-field\` | 油田 | 无 | 2 原油 | 42 秒 | 2 | 95 | 7 分钟 | 120 |\n| \`mill\` | 面粉厂 | 2 粮食 | 1 面粉 | 40 秒 | 2 | 100 | 8 分钟 | 130 |\n| \`sawmill\` | 锯木厂 | 2 木材 | 1 木板 | 45 秒 | 2 | 115 | 8 分钟 | 150 |\n| \`steelworks\` | 钢铁厂 | 3 铁矿石 | 1 钢材 | 50 秒 | 3 | 140 | 10 分钟 | 180 |\n| \`refinery\` | 炼油厂 | 2 原油 | 1 塑料 | 65 秒 | 4 | 185 | 12 分钟 | 240 |\n| \`food-factory\` | 食品厂 | 2 面粉 | 3 食品 | 45 秒 | 3 | 160 | 10 分钟 | 210 |\n| \`furniture-factory\` | 家具厂 | 2 木板 | 2 家具 | 60 秒 | 4 | 210 | 12 分钟 | 275 |\n| \`machine-factory\` | 机械厂 | 2 钢材 | 1 机械 | 90 秒 | 6 | 240 | 15 分钟 | 320 |\n| \`electronics-factory\` | 电子工厂 | 2 塑料 | 1 电子产品 | 110 秒 | 8 | 320 | 18 分钟 | 420 |\n\n当前基线为 12 种工厂类型。每种工厂输出必须引用正式商品目录；加工工厂的输入也必须引用正式商品目录。新增商品不得成为没有生产来源的孤立商品，新增加工或终端工厂不得引用不存在的原料。当前配方模型仍为“零种或一种输入、一种输出”。\n\n目录由服务器`,
  '工厂目录表',
);
industry = industry.replace(
  '12. 撤销挂牌和出售挂牌数量不得破坏当前周期。',
  '12. 撤销挂牌和出售挂牌数量不得破坏当前周期；\n13. 商品和工厂 ID 唯一，所有配方输入输出都能在商品目录中解析；\n14. 旧存档自动补齐新增商品库存、市场和基础流动性且不改变既有资产；\n15. 客户端目录页面按服务器返回数组动态渲染，不依赖固定 6 项。',
);
write('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', industry);

const pageRules = `\n\n## 商品与工厂目录扩展规则（2026-07-12）\n\n- 市场商品标签、概览行情、资金商品资产必须遍历服务器返回的 \`game.products\`，不得写死 6 个商品 ID、固定六项标签或固定商品名称。\n- 生产建设选择器必须遍历 \`game.facilityTypes\`；已持有集群继续遍历 \`game.facilityGroups\`，不得为新增工厂创建独立页面或复制生产逻辑。\n- 商品标签在桌面和移动端保持单行横向滚动；目录扩展不得把标签自动换成多行而挤压订单区。\n- 商品资产和概览行情可以按响应式列数换行，但列数表示布局断点，不得等同于目录项目总数。\n- 当前基线为 12 种商品和 12 种工厂；后续目录扩展必须同时更新产业设计、目录测试和防回退检查。\n`;
let pageDoc = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
if (!pageDoc.includes('商品与工厂目录扩展规则（2026-07-12）')) pageDoc += pageRules;
write('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', pageDoc);

const uiRules = `\n\n## 目录型横向导航（2026-07-12）\n\n商品市场标签属于可扩展目录导航：使用单行隐式网格列和横向滚动，项目最小宽度由控件可读性决定，不得使用 \`repeat(6, ...)\` 把当前目录数量写入样式。移动端保留滚动吸附。概览行情和商品资产网格允许按断点采用 3 列、2 列或 1 列，但不得因目录增加而截断项目。\n`;
let uiDoc = read('docs/UI_DESIGN_SYSTEM.md');
if (!uiDoc.includes('目录型横向导航（2026-07-12）')) uiDoc += uiRules;
write('docs/UI_DESIGN_SYSTEM.md', uiDoc);

const facilityRules = `\n\n## 15. 产业目录扩展边界（2026-07-12）\n\n商品与工厂目录扩展不改变工厂集群、下一周期加入、共享仓库、单输入配方或数量市场模型。当前目录为 12 种商品和 12 种工厂，新增木材—木板—家具与原油—塑料—电子产品两条产业链。客户端必须按服务器目录动态展示；旧世界在处理时自动补齐新增商品市场和玩家库存槽位。\n`;
let facilityDoc = read('docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md');
if (!facilityDoc.includes('产业目录扩展边界（2026-07-12）')) facilityDoc += facilityRules;
write('docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', facilityDoc);

const verifyScript = `import assert from 'node:assert/strict';\nimport { readFileSync } from 'node:fs';\nimport { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';\n\nconst productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));\nconst facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));\nconst expectedProducts = ['grain', 'timber', 'ore', 'crude-oil', 'flour', 'lumber', 'steel', 'plastic', 'food', 'furniture', 'machinery', 'electronics'];\nconst expectedFacilities = ['farm', 'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'steelworks', 'refinery', 'food-factory', 'furniture-factory', 'machine-factory', 'electronics-factory'];\n\nassert.equal(PRODUCT_CATALOG.length, 12, '商品目录必须包含 12 项');\nassert.equal(FACILITY_TYPE_CATALOG.length, 12, '工厂目录必须包含 12 项');\nassert.equal(productIds.size, PRODUCT_CATALOG.length, '商品 ID 必须唯一');\nassert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length, '工厂 ID 必须唯一');\nfor (const id of expectedProducts) assert.equal(productIds.has(id), true, \`缺少商品: \${id}\`);\nfor (const id of expectedFacilities) assert.equal(facilityIds.has(id), true, \`缺少工厂: \${id}\`);\nfor (const facility of FACILITY_TYPE_CATALOG) {\n  assert.equal(productIds.has(facility.output.productId), true, \`\${facility.id} 输出商品不存在\`);\n  if (facility.input) assert.equal(productIds.has(facility.input.productId), true, \`\${facility.id} 输入商品不存在\`);\n}\n\nconst css = readFileSync('src/styles/industry-system.css', 'utf8');\nassert.match(css, /\\.product-tabs \\{[\\s\\S]*grid-auto-flow: column;/);\nassert.match(css, /grid-auto-columns: minmax\\(130px, 1fr\\);/);\nassert.doesNotMatch(css, /grid-template-columns: repeat\\(6,/);\n\nconst tests = readFileSync('server/test/domain.test.js', 'utf8');\nassert.match(tests, /state\\.products\\.length, 12/);\nassert.match(tests, /state\\.facilityTypes\\.length, 12/);\nassert.match(tests, /existing worlds receive new inventories, markets, and liquidity/);\n\nfor (const [path, required] of [\n  ['README.md', ['当前目录共 12 种商品和 12 种工厂类型', '木材 → 木板 → 家具', '原油 → 塑料 → 电子产品']],\n  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['当前基线为 12 种商品', '当前基线为 12 种工厂类型', '旧存档自动补齐新增商品库存']],\n  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['商品与工厂目录扩展规则', '不得写死 6 个商品 ID']],\n  ['docs/UI_DESIGN_SYSTEM.md', ['目录型横向导航', '不得使用 \\`repeat(6, ...)\\`']],\n  ['docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', ['产业目录扩展边界', '木材—木板—家具']],\n]) {\n  const content = readFileSync(path, 'utf8');\n  for (const text of required) assert.equal(content.includes(text), true, \`\${path} 缺少: \${text}\`);\n}\n\nconsole.log('产业目录验证通过：12 种商品、12 种工厂、完整配方引用、旧存档补齐和动态目录布局均满足设计。');\n`;
write('scripts/verify-industry-catalog.mjs', verifyScript);

let packageJson = read('package.json');
if (!packageJson.includes('verify-industry-catalog.mjs')) {
  packageJson = packageJson.replace(
    'node scripts/verify-ui-architecture-runner.mjs && node scripts/verify-market-assets.mjs',
    'node scripts/verify-ui-architecture-runner.mjs && node scripts/verify-industry-catalog.mjs && node scripts/verify-market-assets.mjs',
  );
}
write('package.json', packageJson);

rmSync('scripts/apply-industry-catalog-expansion.mjs');
rmSync('.github/workflows/apply-industry-catalog-expansion.yml');
console.log('产业目录扩展已应用，临时维护文件已删除。');
