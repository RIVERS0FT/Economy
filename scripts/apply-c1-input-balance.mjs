import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const changed = new Set();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

function write(path, content) {
  const fullPath = join(root, path);
  const previous = readFileSync(fullPath, 'utf8');
  if (previous === content) return;
  writeFileSync(fullPath, content);
  changed.add(path);
}

function replaceRequired(path, from, to) {
  const source = read(path);
  if (!source.includes(from)) throw new Error(`${path} 缺少待替换内容: ${from.slice(0, 120)}`);
  write(path, source.replace(from, to));
}

function replaceOptional(path, from, to) {
  if (!existsSync(join(root, path))) return;
  const source = read(path);
  if (!source.includes(from)) return;
  write(path, source.split(from).join(to));
}

function textFiles(directory = root) {
  const files = [];
  for (const name of readdirSync(directory)) {
    if (name === '.git' || name === 'node_modules' || name === 'dist' || name === 'target') continue;
    const path = join(directory, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...textFiles(path));
    else if (/\.(?:js|mjs|ts|tsx|md|json|yml|yaml)$/.test(name)) files.push(path.slice(root.length + 1));
  }
  return files;
}

// 1. 正式目录：六种投入品价格、上游批量产量与固定利润成本。
const catalogPath = 'server/src/industry-catalog.js';
for (const [from, to] of [
  ["{ id: 'fertilizer', name: '化肥', category: 'intermediate', basePrice: 34 }", "{ id: 'fertilizer', name: '化肥', category: 'intermediate', basePrice: 6.76 }"],
  ["{ id: 'feed', name: '配合饲料', category: 'intermediate', basePrice: 10 }", "{ id: 'feed', name: '配合饲料', category: 'intermediate', basePrice: 5.8 }"],
  ["{ id: 'veterinary-medicine', name: '养殖药剂', category: 'intermediate', basePrice: 40 }", "{ id: 'veterinary-medicine', name: '养殖药剂', category: 'intermediate', basePrice: 14.1 }"],
  ["{ id: 'tools', name: '工具', category: 'industrial', basePrice: 60 }", "{ id: 'tools', name: '工具', category: 'industrial', basePrice: 12 }"],
  ["{ id: 'machinery', name: '机械', category: 'industrial', basePrice: 76 }", "{ id: 'machinery', name: '机械', category: 'industrial', basePrice: 15.55 }"],
  ["{ id: 'tractor', name: '拖拉机', category: 'industrial', basePrice: 120 }", "{ id: 'tractor', name: '拖拉机', category: 'industrial', basePrice: 15.35 }"],
  ["recipes: [{ id: 'feed-factory-default', name: '生产配合饲料', cycleMs: 60_000, operatingCost: 3.4, inputs: [{ productId: 'wheat', quantity: 2 }, { productId: 'sugarcane', quantity: 1 }], output: { productId: 'feed', quantity: 1 } }]", "recipes: [{ id: 'feed-factory-default', name: '生产配合饲料', cycleMs: 60_000, operatingCost: 5, inputs: [{ productId: 'wheat', quantity: 2 }, { productId: 'sugarcane', quantity: 1 }], output: { productId: 'feed', quantity: 2 } }]"],
  ["recipes: [{ id: 'fertilizer-factory-default', name: '生产化肥', cycleMs: 60_000, operatingCost: 10, inputs: [{ productId: 'crude-oil', quantity: 2 }], output: { productId: 'fertilizer', quantity: 1 } }]", "recipes: [{ id: 'fertilizer-factory-default', name: '生产化肥', cycleMs: 60_000, operatingCost: 16.56, inputs: [{ productId: 'crude-oil', quantity: 2 }], output: { productId: 'fertilizer', quantity: 6 } }]"],
  ["recipes: [{ id: 'veterinary-medicine-factory-default', name: '生产养殖药剂', cycleMs: 60_000, operatingCost: 10, inputs: [{ productId: 'fertilizer', quantity: 1 }, { productId: 'plastic', quantity: 1 }], output: { productId: 'veterinary-medicine', quantity: 2 } }]", "recipes: [{ id: 'veterinary-medicine-factory-default', name: '生产养殖药剂', cycleMs: 60_000, operatingCost: 13.64, inputs: [{ productId: 'fertilizer', quantity: 1 }, { productId: 'plastic', quantity: 1 }], output: { productId: 'veterinary-medicine', quantity: 4 } }]"],
  ["recipes: [{ id: 'tool-workshop-default', name: '生产工具', cycleMs: 60_000, operatingCost: 8, inputs: [{ productId: 'steel', quantity: 1 }, { productId: 'lumber', quantity: 1 }], output: { productId: 'tools', quantity: 1 } }]", "recipes: [{ id: 'tool-workshop-default', name: '生产工具', cycleMs: 60_000, operatingCost: 8, inputs: [{ productId: 'steel', quantity: 1 }, { productId: 'lumber', quantity: 1 }], output: { productId: 'tools', quantity: 5 } }]"],
  ["recipes: [{ id: 'machine-factory-default', name: '生产机械', cycleMs: 60_000, operatingCost: 10, inputs: [{ productId: 'steel', quantity: 2 }], output: { productId: 'machinery', quantity: 1 } }]", "recipes: [{ id: 'machine-factory-default', name: '生产机械', cycleMs: 60_000, operatingCost: 11.75, inputs: [{ productId: 'steel', quantity: 2 }], output: { productId: 'machinery', quantity: 5 } }]"],
  ["recipes: [{ id: 'tractor-factory-default', name: '生产拖拉机', cycleMs: 60_000, operatingCost: 7, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'steel', quantity: 1 }], output: { productId: 'tractor', quantity: 1 } }]", "recipes: [{ id: 'tractor-factory-default', name: '生产拖拉机', cycleMs: 60_000, operatingCost: 8.85, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'steel', quantity: 1 }], output: { productId: 'tractor', quantity: 4 } }]"],
]) replaceRequired(catalogPath, from, to);

// 2. C1 四级制度产量。
const methodPath = 'server/src/production-methods.js';
for (const [from, to] of [
  ['outputQuantity: 51', 'outputQuantity: 12'],
  ['outputQuantity: 58', 'outputQuantity: 14'],
  ['outputQuantity: 102', 'outputQuantity: 16'],
  ['outputQuantity: 48', 'outputQuantity: 11'],
  ['outputQuantity: 55', 'outputQuantity: 13'],
  ['outputQuantity: 96', 'outputQuantity: 15'],
  ['outputQuantity: 6', 'outputQuantity: 4'],
  ['outputQuantity: 19', 'outputQuantity: 8'],
  ['outputQuantity: 35', 'outputQuantity: 9'],
  ['outputQuantity: 5', 'outputQuantity: 4'],
  ['outputQuantity: 18', 'outputQuantity: 8'],
  ['outputQuantity: 33', 'outputQuantity: 9'],
]) replaceRequired(methodPath, from, to);

// 3. 市场需求模型 18 与价格锚点迁移。
for (const path of textFiles()) {
  let source = read(path);
  let next = source
    .split('MARKET_DEMAND_MODEL_VERSION = 17').join('MARKET_DEMAND_MODEL_VERSION = 18')
    .split('市场需求模型版本：17').join('市场需求模型版本：18')
    .split('当前市场需求模型为 17').join('当前市场需求模型为 18')
    .split('market demand model 17').join('market demand model 18')
    .split('market model 17').join('market model 18')
    .split('MARKET_DEMAND_MODEL_VERSION, 17').join('MARKET_DEMAND_MODEL_VERSION, 18')
    .split('world.marketDemand.modelVersion, 17').join('world.marketDemand.modelVersion, 18')
    .split('migrated.marketDemand.modelVersion, 17').join('migrated.marketDemand.modelVersion, 18');
  if (next !== source) write(path, next);
}

const domainPath = 'server/src/domain.js';
replaceRequired(
  domainPath,
  "const ORDER_BOOK_INTEGRITY_VERSION = 1;\nconst processedWorldAt = new WeakMap();",
  "const ORDER_BOOK_INTEGRITY_VERSION = 1;\nconst C1_INPUT_BALANCE_MODEL_VERSION = 18;\nconst C1_INPUT_BALANCE_PRODUCT_IDS = Object.freeze([\n  'tools',\n  'fertilizer',\n  'tractor',\n  'feed',\n  'veterinary-medicine',\n  'machinery',\n]);\nconst C1_INPUT_BALANCE_PRODUCT_ID_SET = new Set(C1_INPUT_BALANCE_PRODUCT_IDS);\nconst processedWorldAt = new WeakMap();",
);
replaceRequired(
  domainPath,
  "const expectedRelease = remaining * Math.max(1, Math.floor(Number(order.price || 1)));",
  "const expectedRelease = multiplyMoneyByInteger(Number(order.price || 0), remaining) || 0;",
);
replaceRequired(
  domainPath,
  "function reconcileCommodityOrderBook(world, now) {",
  `function migrateC1InputBalance(world) {
  for (const order of world.orders || []) {
    if (
      order.ownerType === 'player'
      && orderKind(order) === 'commodity'
      && C1_INPUT_BALANCE_PRODUCT_ID_SET.has(orderAssetId(order))
      && balancedMarket.isOpenOrder(order)
    ) cancelLegacyCommodityOrder(world, order);
  }

  const productMap = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
  for (const productId of C1_INPUT_BALANCE_PRODUCT_IDS) {
    const product = productMap.get(productId);
    const market = world.markets?.[productId];
    if (!product || !market) continue;
    market.lastPrice = product.basePrice;
    market.lastTradePrice = null;
    market.demand ||= {};
    Object.assign(market.demand, {
      lastPrice: product.basePrice,
      referencePrice: product.basePrice,
      observedPrice: product.basePrice,
      costAnchor: null,
      downstreamValueAnchor: null,
      demandPressureAnchor: product.basePrice,
      targetPrice: product.basePrice,
    });
    if (world.marketDemand?.priceTransmission?.products) {
      delete world.marketDemand.priceTransmission.products[productId];
    }
    if (world.priceTransmission?.products) delete world.priceTransmission.products[productId];
    if (world.marketDemand?.productPressure) world.marketDemand.productPressure[productId] = 1;
  }
  if (world.marketDemand && typeof world.marketDemand === 'object') world.marketDemand.relations = {};
}

function reconcileCommodityOrderBook(world, now) {`,
);
replaceRequired(
  domainPath,
  "const needsOrderBookRepair = Number(world.orderBookIntegrityVersion || 0) < ORDER_BOOK_INTEGRITY_VERSION;\n  const hadCompatibleMarketDemandModel = Number(world.marketDemand?.modelVersion || 0)\n    >= MARKET_DEMAND_PRESERVE_STATE_FROM_VERSION;",
  "const needsOrderBookRepair = Number(world.orderBookIntegrityVersion || 0) < ORDER_BOOK_INTEGRITY_VERSION;\n  const previousMarketDemandModelVersion = Number(world.marketDemand?.modelVersion || 0);\n  const needsC1InputBalanceMigration = previousMarketDemandModelVersion < C1_INPUT_BALANCE_MODEL_VERSION;\n  const hadCompatibleMarketDemandModel = previousMarketDemandModelVersion\n    >= MARKET_DEMAND_PRESERVE_STATE_FROM_VERSION\n    && !needsC1InputBalanceMigration;",
);
replaceRequired(
  domainPath,
  "balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);\n  if (!hadCompatibleDemandSystem) {",
  "balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);\n  if (needsC1InputBalanceMigration) migrateC1InputBalance(migrated);\n  if (!hadCompatibleDemandSystem) {",
);

// 4. 更新既有精确断言中的正式 C1 计划。
const c1PlanReplacements = [
  ["farm: [[], [['tools', 1], 51], [['fertilizer', 2], 58], [['tractor', 1], 102]]", "farm: [[], [['tools', 1], 12], [['fertilizer', 2], 14], [['tractor', 1], 16]]"],
  ["orchard: [[], [['tools', 1], 48], [['fertilizer', 2], 55], [['tractor', 1], 96]]", "orchard: [[], [['tools', 1], 11], [['fertilizer', 2], 13], [['tractor', 1], 15]]"],
  ["ranch: [[], [['feed', 1], 6], [['veterinary-medicine', 1], 19], [['machinery', 1], 35]]", "ranch: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]]"],
  ["fishery: [[], [['feed', 1], 5], [['veterinary-medicine', 1], 18], [['machinery', 1], 33]]", "fishery: [[], [['feed', 1], 4], [['veterinary-medicine', 1], 8], [['machinery', 1], 9]]"],
];
for (const path of ['scripts/verify-industry-catalog.mjs', 'scripts/verify-production-methods.mjs']) {
  for (const [from, to] of c1PlanReplacements) replaceRequired(path, from, to);
}
for (const path of ['server/test/production-methods.test.js', 'server/test/c1-fast-production.test.js']) {
  for (const [from, to] of [
    ["output: 51", "output: 12"], ["output: 58", "output: 14"], ["output: 102", "output: 16"],
    ["output: 48", "output: 11"], ["output: 55", "output: 13"], ["output: 96", "output: 15"],
    ["output: 6", "output: 4"], ["output: 19", "output: 8"], ["output: 35", "output: 9"],
    ["output: 5", "output: 4"], ["output: 18", "output: 8"], ["output: 33", "output: 9"],
    ["], 51, 1]", "], 12, 1]"], ["], 58, 1]", "], 14, 1]"], ["], 102, 1]", "], 16, 1]"],
    ["player.inventories.wheat.available, 204", "player.inventories.wheat.available, 48"],
    ["player.facilityGroups[0].lifetimeOutput, 204", "player.facilityGroups[0].lifetimeOutput, 48"],
  ]) replaceOptional(path, from, to);
}
for (const path of ['server/test/banking.test.js', 'scripts/verify-facility-groups.mjs']) {
  replaceOptional(path, 'output: 51', 'output: 12');
}

// 5. 更新精确价格断言和代表性上游配方断言。
const priceMapPaths = [
  'scripts/verify-industry-catalog.mjs',
  'server/test/domain.test.js',
  'server/test/fertilizer-factory.test.js',
  'server/test/tool-workshop.test.js',
  'server/test/market-demand-v6.test.js',
];
for (const path of priceMapPaths) {
  for (const [from, to] of [
    ['fertilizer: 34', 'fertilizer: 6.76'],
    ['feed: 10', 'feed: 5.8'],
    ["'veterinary-medicine': 40", "'veterinary-medicine': 14.1"],
    ['tools: 60', 'tools: 12'],
    ['machinery: 76', 'machinery: 15.55'],
    ['tractor: 120', 'tractor: 15.35'],
    ['basePrice: 34', 'basePrice: 6.76'],
    ['basePrice: 60', 'basePrice: 12'],
  ]) replaceOptional(path, from, to);
}
replaceOptional('server/test/fertilizer-factory.test.js', 'assert.equal(recipe.operatingCost, 10);', 'assert.equal(recipe.operatingCost, 16.56);');
replaceOptional('server/test/fertilizer-factory.test.js', "assert.equal((34 - 2 * 9 - 10) * 60_000 / recipe.cycleMs, 6);", "assert.equal((6.76 * 6 - 2 * 9 - 16.56) * 60_000 / recipe.cycleMs, 6);");
replaceOptional('server/test/fertilizer-factory.test.js', "output: { productId: 'fertilizer', quantity: 1 }", "output: { productId: 'fertilizer', quantity: 6 }");
replaceOptional('server/test/tool-workshop.test.js', "output, { productId: 'tools', quantity: 1 }", "output, { productId: 'tools', quantity: 5 }");
replaceOptional('server/test/tool-workshop.test.js', "(60 - 29 - 17 - 8)", "(12 * 5 - 29 - 17 - 8)");
replaceOptional('server/test/tool-workshop.test.js', "[['standard',60000,8,1],['rapid',30000,11,1],['economical',90000,5,1],['high-yield',60000,22,2]]", "[['standard',60000,8,5],['rapid',30000,11,5],['economical',90000,5,5],['high-yield',60000,22,10]]");

// 6. 权威设计文档。
const industryPath = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md';
for (const [from, to] of [
  ['> 模型 17 需求覆盖规则：', '> 模型 18 C1 投入品平衡规则：'],
  ['| 化肥 (`fertilizer`) | 34 | 2 原油 → 1 化肥 | 60 秒 | 10 | 6 |', '| 化肥 (`fertilizer`) | 6.76 | 2 原油 → 6 化肥 | 60 秒 | 16.56 | 6 |'],
  ['| 配合饲料 (`feed`) | 10 | 2 小麦 + 1 甘蔗 → 1 配合饲料 | 60 秒 | 3.4 | 3 |', '| 配合饲料 (`feed`) | 5.8 | 2 小麦 + 1 甘蔗 → 2 配合饲料 | 60 秒 | 5 | 3 |'],
  ['| 养殖药剂 (`veterinary-medicine`) | 40 | 1 化肥 + 1 塑料 → 2 养殖药剂 | 60 秒 | 10 | 6 |', '| 养殖药剂 (`veterinary-medicine`) | 14.1 | 1 化肥 + 1 塑料 → 4 养殖药剂 | 60 秒 | 13.64 | 6 |'],
  ['| 工具 (`tools`) | 60 | 1 钢材 + 1 木板 → 1 工具 | 60 秒 | 8 | 6 |', '| 工具 (`tools`) | 12 | 1 钢材 + 1 木板 → 5 工具 | 60 秒 | 8 | 6 |'],
  ['| 机械 (`machinery`) | 76 | 2 钢材 → 1 机械 | 60 秒 | 10 | 8 |', '| 机械 (`machinery`) | 15.55 | 2 钢材 → 5 机械 | 60 秒 | 11.75 | 8 |'],
  ['| 拖拉机 (`tractor`) | 120 | 1 机械 + 1 钢材 → 1 拖拉机 | 60 秒 | 7 | 8 |', '| 拖拉机 (`tractor`) | 15.35 | 1 机械 + 1 钢材 → 4 拖拉机 | 60 秒 | 8.85 | 8 |'],
  ['| 农场 | 工具耕作 | 1 工具 | 51 | 20 秒 | 1 |', '| 农场 | 工具耕作 | 1 工具 | 12 | 20 秒 | 1 |'],
  ['| 农场 | 化肥耕作 | 2 化肥 | 58 | 20 秒 | 1 |', '| 农场 | 化肥耕作 | 2 化肥 | 14 | 20 秒 | 1 |'],
  ['| 农场 | 拖拉机耕作 | 1 拖拉机 | 102 | 20 秒 | 1 |', '| 农场 | 拖拉机耕作 | 1 拖拉机 | 16 | 20 秒 | 1 |'],
  ['| 果园 | 工具管护 | 1 工具 | 48 | 20 秒 | 1 |', '| 果园 | 工具管护 | 1 工具 | 11 | 20 秒 | 1 |'],
  ['| 果园 | 化肥管护 | 2 化肥 | 55 | 20 秒 | 1 |', '| 果园 | 化肥管护 | 2 化肥 | 13 | 20 秒 | 1 |'],
  ['| 果园 | 拖拉机管护 | 1 拖拉机 | 96 | 20 秒 | 1 |', '| 果园 | 拖拉机管护 | 1 拖拉机 | 15 | 20 秒 | 1 |'],
  ['| 畜牧场 | 饲料饲养 | 1 配合饲料 | 6 | 30 秒 | 2 |', '| 畜牧场 | 饲料饲养 | 1 配合饲料 | 4 | 30 秒 | 2 |'],
  ['| 畜牧场 | 药剂精养 | 1 养殖药剂 | 19 | 30 秒 | 2 |', '| 畜牧场 | 药剂精养 | 1 养殖药剂 | 8 | 30 秒 | 2 |'],
  ['| 畜牧场 | 机械化养殖 | 1 机械 | 35 | 30 秒 | 2 |', '| 畜牧场 | 机械化养殖 | 1 机械 | 9 | 30 秒 | 2 |'],
  ['| 渔场 | 饲料精养 | 1 配合饲料 | 5 | 30 秒 | 2 |', '| 渔场 | 饲料精养 | 1 配合饲料 | 4 | 30 秒 | 2 |'],
  ['| 渔场 | 药剂精养 | 1 养殖药剂 | 18 | 30 秒 | 2 |', '| 渔场 | 药剂精养 | 1 养殖药剂 | 8 | 30 秒 | 2 |'],
  ['| 渔场 | 机械化养殖 | 1 机械 | 33 | 30 秒 | 2 |', '| 渔场 | 机械化养殖 | 1 机械 | 9 | 30 秒 | 2 |'],
  ['固定消耗 2 原油并产出 1 化肥', '固定消耗 2 原油并产出 6 化肥'],
  ['初始参考价 34', '初始参考价 6.76'],
  ['支付 10 周期成本并产出 1 化肥', '支付 16.56 周期成本并产出 6 化肥'],
  ['同时消耗 1 钢材和 1 木板并产出 1 工具', '同时消耗 1 钢材和 1 木板并产出 5 工具'],
  ['每 60 秒消耗 2 小麦和 1 甘蔗、支付 3.4，产出 1 配合饲料', '每 60 秒消耗 2 小麦和 1 甘蔗、支付 5，产出 2 配合饲料'],
  ['每 60 秒消耗 1 化肥和 1 塑料、支付 10，产出 2 养殖药剂', '每 60 秒消耗 1 化肥和 1 塑料、支付 13.64，产出 4 养殖药剂'],
  ['每 60 秒消耗 1 机械和 1 钢材、支付 7，产出 1 拖拉机', '每 60 秒消耗 1 机械和 1 钢材、支付 8.85，产出 4 拖拉机'],
  ['- 使用小数商品价格、产量、输入量、周期秒数或周期成本；', '- 使用超过两位小数的商品价格或周期成本，或使用非整数产量、输入量和周期秒数；'],
]) replaceRequired(industryPath, from, to);
replaceRequired(
  industryPath,
  '生产设置下方不得再显示“周期 · 产出 · 成本”摘要',
  `C1 投入型制度的初始参考利润必须严格递增：工具／饲料制度为每分钟 3～5，化肥／药剂制度为每分钟 6～8，拖拉机／机械化制度为每分钟 8～10；同级四种 C1 工厂的最大利润差不得超过 2，且任一 C1 制度不得达到 C7 的每分钟 12。上游投入品工厂通过批量产出保持原复杂度参考利润，不得通过抬高上游利润补贴 C1。\n\n生产设置下方不得再显示“周期 · 产出 · 成本”摘要`,
);
replaceRequired(
  industryPath,
  '## 10. 迁移与版本',
  `## 10. 迁移与版本\n\n市场需求模型 18 重平衡工具、化肥、拖拉机、配合饲料、养殖药剂和机械。由模型 17 升级时，六种商品的玩家开放买卖订单必须取消并按剩余数量完整释放冻结资金或冻结库存；人口消费与市场储备开放订单统一释放并重建。六种商品当前市场价、最近成交价口径和价格传导锚点重置到新参考价，但真实历史成交点继续保留。玩家可用／冻结库存数量、合同预留、拍卖资产、工厂数量、资金、历史成交数量和累计统计不得按旧／新参考价换算或倍增；重复迁移不得再次撤单或改写资产。\n`,
);

replaceRequired(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '模型 17 按实际人口计算稳定需求预算，并在订单创建前把受控钱包缺口补充进入人口真实钱包；直接与派生订单仍必须逐笔冻结真实资金，成交、价差退款和撤单释放规则不变，订单簿不得把补充金额当作成交发行。',
  '模型 18 延续实际人口稳定需求预算，并为 C1 六种投入品执行一次性价格边界迁移：开放玩家订单完整撤销并释放冻结资产，人口消费与市场储备订单释放后重建；存量库存、合同、拍卖和真实历史成交不得换算数量或重写。直接与派生订单仍必须逐笔冻结真实资金，成交、价差退款和撤单释放规则不变。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '> 市场需求模型版本：18',
  '> 市场需求模型版本：18\n\n> 模型 18 通过降低六种 C1 投入品的单位参考价并提高对应上游批量产出，形成基础、工具／饲料、化肥／药剂、拖拉机／机械化的递增利润梯度；迁移只重建相关开放订单和价格锚点，不换算玩家存量商品数量。',
);
replaceRequired(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '> 市场需求模型版本：18',
  '> 市场需求模型版本：18\n\n> 模型 18 迁移在世界加载事务内取消六种 C1 投入品的开放玩家订单、释放对应冻结资产、释放并重建人口与储备订单、重置当前价格传导锚点；真实历史成交和所有存量资产数量保持不变，迁移以旧模型版本判定并保持幂等。',
);

// 7. 新增专项防回退和迁移测试。
const verifierPath = 'scripts/verify-c1-input-balance.mjs';
write(verifierPath, `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, MARKET_DEMAND_MODEL_VERSION, PRODUCT_CATALOG } from '../server/src/domain.js';

const prices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const expectedPrices = { tools: 12, fertilizer: 6.76, tractor: 15.35, feed: 5.8, 'veterinary-medicine': 14.1, machinery: 15.55 };
const expectedUpstream = {
  'tool-workshop': { output: 5, cost: 8, profit: 6 },
  'fertilizer-factory': { output: 6, cost: 16.56, profit: 6 },
  'tractor-factory': { output: 4, cost: 8.85, profit: 8 },
  'feed-factory': { output: 2, cost: 5, profit: 3 },
  'veterinary-medicine-factory': { output: 4, cost: 13.64, profit: 6 },
  'machine-factory': { output: 5, cost: 11.75, profit: 8 },
};
const bands = { assisted: [3, 5], intensive: [6, 8], mechanized: [8, 10] };
const c1Ids = ['farm', 'orchard', 'ranch', 'fishery'];

function profit(recipe) {
  const input = recipe.inputs.reduce((sum, item) => sum + prices.get(item.productId) * item.quantity, 0);
  return (prices.get(recipe.output.productId) * recipe.output.quantity - input - recipe.operatingCost) * 60_000 / recipe.cycleMs;
}

assert.equal(MARKET_DEMAND_MODEL_VERSION, 18);
for (const [productId, expected] of Object.entries(expectedPrices)) assert.equal(prices.get(productId), expected);
for (const [facilityId, expected] of Object.entries(expectedUpstream)) {
  const recipe = facilities.get(facilityId).recipes.find((item) => item.productionMethodId === 'standard');
  assert.equal(recipe.output.quantity, expected.output, facilityId);
  assert.equal(recipe.operatingCost, expected.cost, facilityId);
  assert.ok(Math.abs(profit(recipe) - expected.profit) < 1e-9, facilityId);
}
const profitsByMethod = { assisted: [], intensive: [], mechanized: [] };
for (const facilityId of c1Ids) {
  const facility = facilities.get(facilityId);
  const variants = facility.recipes.filter((recipe) => recipe.baseRecipeId === facility.defaultRecipeId);
  const quantities = variants.map((recipe) => recipe.output.quantity);
  assert.deepEqual(quantities, [...quantities].sort((a, b) => a - b), facilityId);
  assert.equal(new Set(quantities).size, quantities.length, facilityId);
  for (const methodId of Object.keys(bands)) {
    const recipe = variants.find((item) => item.productionMethodId === methodId);
    const value = profit(recipe);
    const [minimum, maximum] = bands[methodId];
    assert.ok(value >= minimum - 1e-9 && value <= maximum + 1e-9, facilityId + '/' + methodId + ': ' + value);
    assert.ok(value < 12, facilityId + '/' + methodId);
    profitsByMethod[methodId].push(value);
  }
}
for (const [methodId, values] of Object.entries(profitsByMethod)) {
  assert.ok(Math.max(...values) - Math.min(...values) <= 2 + 1e-9, methodId);
}
const domain = readFileSync('server/src/domain.js', 'utf8');
const design = readFileSync('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', 'utf8');
for (const text of ['C1_INPUT_BALANCE_MODEL_VERSION = 18', 'C1_INPUT_BALANCE_PRODUCT_IDS', 'migrateC1InputBalance', 'multiplyMoneyByInteger(Number(order.price || 0), remaining)']) assert.ok(domain.includes(text), text);
for (const text of ['市场需求模型 18 重平衡工具、化肥、拖拉机、配合饲料、养殖药剂和机械', '不得按旧／新参考价换算或倍增', '工具／饲料制度为每分钟 3～5', '化肥／药剂制度为每分钟 6～8', '拖拉机／机械化制度为每分钟 8～10']) assert.ok(design.includes(text), text);
console.log('C1 投入品平衡验证通过：六种价格与上游批量产出、三级利润区间、同级差距和模型 18 幂等迁移规则均已锁定。');
`);

const migrationTestPath = 'server/test/c1-input-balance-migration.test.js';
write(migrationTestPath, `import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer, migrateWorld } from '../src/domain.js';

const now = 1_786_000_000_000;
const alice = { id: 91, name: '平衡迁移玩家' };

test('model 18 cancels affected open orders, preserves quantities and resets current anchors once', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  world.marketDemand.modelVersion = 17;
  player.credits = 100;
  player.frozenCredits = 41;
  player.inventories.tools.available = 7;
  player.inventories.tools.frozen = 3;
  player.inventories.wheat.available = 9;
  const history = [{ price: 60, quantity: 2, createdAt: now - 1_000, takerSide: 'buy' }];
  world.markets.tools.lastPrice = 60;
  world.markets.tools.lastTradePrice = 60;
  world.markets.tools.priceHistory = structuredClone(history);
  world.orders.push(
    { id: 'affected-buy', assetKind: 'commodity', assetId: 'fertilizer', productId: 'fertilizer', side: 'buy', ownerType: 'player', ownerId: alice.id, price: 20, quantity: 2, remaining: 2, status: 'open', fills: [], createdAt: now },
    { id: 'affected-sell', assetKind: 'commodity', assetId: 'tools', productId: 'tools', side: 'sell', ownerType: 'player', ownerId: alice.id, price: 12, quantity: 3, remaining: 3, status: 'open', fills: [], createdAt: now },
    { id: 'unaffected-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: alice.id, price: 1, quantity: 1, remaining: 1, status: 'open', fills: [], createdAt: now },
  );

  migrateWorld(world, now + 1);

  assert.equal(world.marketDemand.modelVersion, 18);
  assert.equal(world.orders.find((order) => order.id === 'affected-buy').status, 'cancelled');
  assert.equal(world.orders.find((order) => order.id === 'affected-sell').status, 'cancelled');
  assert.equal(world.orders.find((order) => order.id === 'unaffected-buy').status, 'open');
  assert.equal(player.credits, 140);
  assert.equal(player.frozenCredits, 1);
  assert.deepEqual(player.inventories.tools, { available: 10, frozen: 0 });
  assert.equal(player.inventories.wheat.available, 9);
  assert.equal(world.markets.tools.lastPrice, 12);
  assert.equal(world.markets.tools.lastTradePrice, null);
  assert.deepEqual(world.markets.tools.priceHistory, history);
  assert.equal(world.marketDemand.priceTransmission.products.tools.referencePrice, 12);

  const snapshot = structuredClone({ credits: player.credits, frozenCredits: player.frozenCredits, tools: player.inventories.tools, orders: world.orders, history: world.markets.tools.priceHistory });
  migrateWorld(world, now + 2);
  assert.deepEqual({ credits: player.credits, frozenCredits: player.frozenCredits, tools: player.inventories.tools, orders: world.orders, history: world.markets.tools.priceHistory }, snapshot);
});
`);

replaceRequired(
  'package.json',
  'node scripts/verify-production-methods.mjs && node scripts/verify-unified-factory-recipes-grid.mjs',
  'node scripts/verify-production-methods.mjs && node scripts/verify-c1-input-balance.mjs && node scripts/verify-unified-factory-recipes-grid.mjs',
);

console.log(`已修改 ${changed.size} 个文件：\n${[...changed].sort().join('\n')}`);
