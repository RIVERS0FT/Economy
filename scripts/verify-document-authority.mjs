import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';

const root = process.cwd();
const pathFor = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFor(path), 'utf8');
const failures = [];

const agentsPath = 'AGENTS.md';
if (!existsSync(pathFor(agentsPath))) {
  failures.push('缺少仓库协作入口: AGENTS.md');
} else {
  const agents = read(agentsPath);
  const lineCount = agents.split(/\r?\n/).length;
  const byteLength = Buffer.byteLength(agents, 'utf8');
  if (lineCount > 60) failures.push(`AGENTS.md 只能保留精简协作规则，当前 ${lineCount} 行，最多 60 行`);
  if (byteLength > 5 * 1024) failures.push(`AGENTS.md 只能保留精简协作规则，当前 ${byteLength} 字节，最多 5120 字节`);
  for (const text of [
    '# Economy 仓库协作规则',
    '`docs/README.md`',
    '只规定协作流程',
    '运行时常量以实现代码为准',
    '不得新建“补充说明”、V2/V3 或平行专题文档',
    '设计文档、实现、测试或验证脚本互相冲突时',
    'npm run build',
    '.github/workflows/deploy.yml',
  ]) {
    if (!agents.includes(text)) failures.push(`AGENTS.md 缺少协作规则: ${text}`);
  }
  for (const text of [
    '## 当前核心循环',
    '## 当前关键规则',
    '## 当前正式导航',
    '## 权威设计文档',
    '## 数据与部署',
    '## 统一微单位运算边界',
    '## 活跃周银行收益与周资金结算',
    '客户端状态版本：',
    '世界状态版本：',
    '市场需求模型版本：',
  ]) {
    if (agents.includes(text)) failures.push(`AGENTS.md 不得重新承载详细业务规则: ${text}`);
  }
}

const canonicalDocs = [
  'README.md',
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/MARKET_CHART_LAYOUT_DESIGN.md',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
  'docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md',
  'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];

const canonicalDocsDirectoryEntries = new Set(
  canonicalDocs.filter((path) => path.startsWith('docs/')).map((path) => path.slice('docs/'.length)),
);

const versionedDocs = [
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];

const forbiddenLegacyDocs = [
  'docs/GAME_DESIGN.md',
  'docs/WEB_MULTIPLAYER_GAME_DESIGN.md',
  'docs/CLICK_CURRENCY_ECONOMY_DESIGN.md',
  'docs/POPULATION_CONSUMPTION_DESIGN.md',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'docs/FACTORY_ASSET_MARKET_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'docs/WAREHOUSE_AND_FACTORY_CARD_LAYOUT_DESIGN.md',
  'docs/DESIGN_SYSTEM.md',
  'docs/DEPLOYMENT.md',
  'docs/DEPLOYMENT_PRIVILEGES.md',
  'docs/SERVER_AUTHORITATIVE_API.md',
  'docs/SERVER_CAPACITY_DESIGN.md',
  'docs/CLIENT_COMPUTATION_DESIGN.md',
  'docs/GAME_SHELL_LAYOUT_DESIGN.md',
  'docs/OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md',
];

for (const path of canonicalDocs) if (!existsSync(pathFor(path))) failures.push(`缺少权威文档: ${path}`);
for (const path of forbiddenLegacyDocs) if (existsSync(pathFor(path))) failures.push(`旧文档不得重新创建: ${path}`);

if (existsSync(pathFor('docs'))) {
  for (const entry of readdirSync(pathFor('docs'))) {
    if (entry.endsWith('.md') && !canonicalDocsDirectoryEntries.has(entry)) {
      failures.push(`未登记 Markdown 文档不得存在: docs/${entry}`);
    }
  }
}

if (existsSync(pathFor('README.md'))) {
  const rootReadme = read('README.md');
  for (const text of [
    '# Economy',
    'https://game.riversoft.top/economy/',
    'https://game.riversoft.top/economy/admin',
    '[docs/README.md](docs/README.md)',
    '[AGENTS.md](AGENTS.md)',
    'Node.js 24.4.0',
    'npm ci',
    'npm run build',
    'npm run test:browser',
    '.github/workflows/deploy.yml',
    '本文件不复制会随产品迭代变化的详细口径',
    '当前研发支持 1 宝石减少 30 分钟的服务器权威加速，工厂建设即时完成且不产生施工加速',
  ]) {
    if (!rootReadme.includes(text)) failures.push(`README.md 缺少项目入口信息: ${text}`);
  }
  for (const text of [
    '## 当前核心循环',
    '## 当前关键规则',
    '## 当前正式导航',
    '## 权威设计文档',
    '## 数据与部署',
    '## 统一微单位运算边界',
    '## 活跃周银行收益与周资金结算',
    '## 生产与仓库布局 V3',
    '## 统一资产订单簿与玩家系统（',
    '## 扩展产业目录',
    '施工与研发均支持 1 宝石减少 30 分钟',
  ]) {
    if (rootReadme.includes(text)) failures.push(`README.md 不得重新承载旧规则或详细业务章节: ${text}`);
  }
}

for (const path of versionedDocs) {
  if (!existsSync(pathFor(path))) continue;
  const content = read(path);
  if (!content.includes(`客户端状态版本：${CURRENT_CLIENT_STATE_VERSION}`)) failures.push(`${path} 客户端状态版本必须为 ${CURRENT_CLIENT_STATE_VERSION}`);
  if (!content.includes('世界状态版本：29')) failures.push(`${path} 世界状态版本必须为 29`);
}

if (existsSync(pathFor('docs/README.md'))) {
  const index = read('docs/README.md');
  for (const text of [
    '本目录只保留当前设计',
    '不得以“补充说明”“V2/V3”或未登记专题文档的形式继续并行存在',
    '未列入下方权威文档表的 Markdown 文件不得存在',
    '新的功能规则必须合并进现有权威文档',
    '`scripts/verify-document-authority.mjs` 必须遍历 `docs/*.md`',
    '参考分钟利润必须由正式目录自动校验',
    '人口数量、工厂承载、迁入迁出、就业收入、三类人口真实钱包、生产复杂度岗位结构',
    '商店每日终端动态报价、全服同价、接受／拒绝决策、单向兑换、直接货币发行、研发宝石加速、工厂施工加速退役',
    '普通玩家成交记录不得暴露来源、去向或对手订单',
    '库存与资金守恒的双边市场储备',
    '长期生产合作合同的页面职责归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`',
    '`GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md`',
    '`FACILITY_CATALOG_PRESENTATION_DESIGN.md`',
    '`OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md`',
    '`PRODUCTION_PILL_ALIGNMENT_DESIGN.md`',
    '`REGISTRATION_INVITE_FLOW_DESIGN.md`',
    '`AUTHORITATIVE_COUNTDOWN_DESIGN.md`',
    '`PRIMARY_SURFACE_INSET_DESIGN.md`',
    '`MARKET_CHART_LAYOUT_DESIGN.md`',
    '市场近 24h 行情图的整数坐标、成交量绘图区最低可读高度、动态纵横比',
    '商品与工厂场景插画主视觉',
    '`product-artwork.css`',
    '`src/assets/product-icons/generated/128/`',
    '`scripts/generate-product-artwork-thumbnails.mjs`',
    '`scripts/verify-product-artwork.mjs`',
    '工厂场景插画主视觉',
    '`src/assets/facility-icons/generated/128/`',
    '`scripts/verify-facility-artwork.mjs`',
    '`128 × 128`',
    '不得重新创建 `GAME_SHELL_LAYOUT_DESIGN.md`、`OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md`',
    '服务器 26 种正式工厂 ID',
    '工厂即时建设不得注册施工完成或施工就业截止时间',
    '当前唯一研发任务允许 1 宝石减少 30 分钟',
    '历史 `economy_facility_gem_actions` 仅保留只读审计',
  ]) {
    if (!index.includes(text)) failures.push(`docs/README.md 缺少防回退规则: ${text}`);
  }
  for (const text of [
    '服务器 22 种正式工厂 ID',
    '直接货币发行、施工宝石加速、兑换幂等',
    '施工就业必须按下一整数释放边界调度',
    '不得恢复只读占位、研发点、宝石加速、并行队列',
  ]) {
    if (index.includes(text)) failures.push(`docs/README.md 不得保留旧规则: ${text}`);
  }
}

const startingFundsFiles = [
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'server/src/domain-core.js',
  'server/test/starting-funds.test.js',
];
for (const path of startingFundsFiles) {
  if (!existsSync(pathFor(path))) failures.push(`新玩家启动资金规则缺少文件: ${path}`);
}

if (startingFundsFiles.every((path) => existsSync(pathFor(path)))) {
  const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
  const domainCore = read('server/src/domain-core.js');
  const startingFundsTest = read('server/test/starting-funds.test.js');
  const createPlayerStart = domainCore.indexOf('function createPlayer');
  const createPlayerEnd = domainCore.indexOf('function migrateFacility', createPlayerStart);
  const createPlayerBlock = createPlayerStart >= 0 && createPlayerEnd > createPlayerStart
    ? domainCore.slice(createPlayerStart, createPlayerEnd)
    : '';

  for (const text of [
    '服务器一次性发放 **500 普通货币**作为启动资金',
    '不迁移、不补发，也不改写既有玩家余额',
  ]) {
    if (!productDesign.includes(text)) failures.push(`产品玩法设计缺少新玩家启动资金规则: ${text}`);
  }
  if (!createPlayerBlock.includes('credits: 500,')) failures.push('新玩家首次建档可用货币必须为 500');
  if (!createPlayerBlock.includes("addLedger(player, 'system', 500, '服务器发放玩家启动资金', now);")) {
    failures.push('新玩家启动资金账本必须与 500 可用货币保持一致');
  }
  if (createPlayerBlock.includes('credits: 100,')) failures.push('不得将新玩家初始货币恢复为 100');
  for (const text of [
    "test('new players receive 500 credits with a matching startup ledger entry'",
    "test('ensuring an existing player does not top up or rewrite their balance'",
  ]) {
    if (!startingFundsTest.includes(text)) failures.push(`新玩家启动资金回归测试缺少场景: ${text}`);
  }
}

if (failures.length) {
  console.error(`文档权威性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`文档权威性验证通过：精简协作入口与项目 README、登记文档清单、版本 ${CURRENT_CLIENT_STATE_VERSION}/29、500 新玩家启动资金、市场需求模型 19、固定银行收益与周资金结算、商品供货、玩家抵押借贷与工厂使用权租赁合同、商品／工厂资产拍卖、市场行情图可读性、真实人口钱包、就业资金流、统一订单簿、双边市场储备和十页导航与银行资产总览职责均满足当前基线。`);
