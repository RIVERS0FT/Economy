import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';

const root = process.cwd();
const pathFor = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFor(path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(pathFor(path))) failures.push(`缺少文档: ${path}`);
}

function requireAll(path, values, label = path) {
  if (!existsSync(pathFor(path))) return;
  const content = read(path);
  for (const value of values) {
    if (!content.includes(value)) failures.push(`${label} 缺少内容边界标记: ${value}`);
  }
}

function forbidAll(path, values, label = path) {
  if (!existsSync(pathFor(path))) return;
  const content = read(path);
  for (const value of values) {
    if (content.includes(value)) failures.push(`${label} 不得承载该详细规则或实现副本: ${value}`);
  }
}

function enforceSize(path, { maxLines, maxBytes }, label = path) {
  if (!existsSync(pathFor(path))) return;
  const content = read(path);
  const lines = content.split(/\r?\n/).length;
  const bytes = Buffer.byteLength(content, 'utf8');
  if (maxLines && lines > maxLines) failures.push(`${label} 过长：${lines} 行，最多 ${maxLines} 行`);
  if (maxBytes && bytes > maxBytes) failures.push(`${label} 过大：${bytes} 字节，最多 ${maxBytes} 字节`);
}

const designDocs = [
  'CI_EXECUTION_DESIGN.md',
  'PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  'INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'COMMERCIAL_BUILDINGS_DESIGN.md',
  'FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  'UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'WAREHOUSE_EXPANSION_DESIGN.md',
  'TRANSPORT_NETWORK_GEOMETRY_DESIGN.md',
  'STRATEGIC_MAP_RENDERING_DESIGN.md',
  'PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'MARKET_CHART_LAYOUT_DESIGN.md',
  'REGISTRATION_INVITE_FLOW_DESIGN.md',
  'UI_DESIGN_SYSTEM.md',
  'AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  'PRIMARY_SURFACE_INSET_DESIGN.md',
  'OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md',
  'PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
  'LIQUID_GLASS_CHROME_DESIGN.md',
  'SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'LOCAL_ACTIVITY_LOG_DESIGN.md',
  'GIFT_CODE_AND_ADMIN_DESIGN.md',
];

const requiredFiles = [
  'AGENTS.md',
  'README.md',
  'docs/README.md',
  ...designDocs.map((name) => `docs/${name}`),
];
for (const path of requiredFiles) requireFile(path);

const forbiddenLegacyDocs = [
  'GAME_DESIGN.md',
  'WEB_MULTIPLAYER_GAME_DESIGN.md',
  'CLICK_CURRENCY_ECONOMY_DESIGN.md',
  'POPULATION_CONSUMPTION_DESIGN.md',
  'FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'FACTORY_ASSET_MARKET_DESIGN.md',
  'MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'WAREHOUSE_AND_FACTORY_CARD_LAYOUT_DESIGN.md',
  'DESIGN_SYSTEM.md',
  'DEPLOYMENT.md',
  'DEPLOYMENT_PRIVILEGES.md',
  'SERVER_AUTHORITATIVE_API.md',
  'SERVER_CAPACITY_DESIGN.md',
  'CLIENT_COMPUTATION_DESIGN.md',
  'GAME_SHELL_LAYOUT_DESIGN.md',
  'OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md',
];
for (const name of forbiddenLegacyDocs) {
  if (existsSync(pathFor(`docs/${name}`))) failures.push(`旧文档不得重新创建: docs/${name}`);
}

if (existsSync(pathFor('docs'))) {
  const allowed = new Set(['README.md', ...designDocs]);
  for (const entry of readdirSync(pathFor('docs'))) {
    if (entry.endsWith('.md') && !allowed.has(entry)) failures.push(`未登记 Markdown 文档不得存在: docs/${entry}`);
  }
}

// AGENTS is the compact collaboration layer. It must describe the hierarchy without
// becoming another project README or design document.
enforceSize('AGENTS.md', { maxLines: 60, maxBytes: 6 * 1024 }, 'AGENTS.md');
requireAll('AGENTS.md', [
  '# Economy 仓库协作规则',
  '`docs/README.md`',
  '根 `README.md` 只负责公开项目入口',
  '`docs/README.md` 只负责设计文档索引',
  '目录级 `README.md`',
  '一个语义规则只能有一个 DESIGN owner',
  '运行时常量以实现代码或正式数据文件为准',
  '不得新建“补充说明”、V2/V3 或平行专题文档',
  '只保留当前最终规则',
  'npm run build',
  '.github/workflows/deploy.yml',
]);
forbidAll('AGENTS.md', [
  '客户端状态版本：',
  '世界状态版本：',
  '市场需求模型版本：',
  '## 项目简介',
  '## 核心能力',
  '1 宝石减少',
  '500 普通货币',
], 'AGENTS.md');

// Root README is a public entry and developer quick-start, not a business or
// deployment specification. Keep a size ceiling so detailed rules cannot silently
// accumulate there again.
enforceSize('README.md', { maxLines: 220, maxBytes: 14 * 1024 }, 'README.md');
requireAll('README.md', [
  '# Economy',
  'https://game.riversoft.top/economy/',
  'https://game.riversoft.top/economy/admin',
  '[docs/README.md](docs/README.md)',
  '[AGENTS.md](AGENTS.md)',
  '## 项目简介',
  '## 核心能力',
  '## 在线入口',
  '## 技术栈',
  '## 本地开发',
  'npm ci',
  'npm run build',
  'npm run test:browser',
  '## 项目结构',
  '## 文档边界',
  '一条语义规则只有一个 DESIGN owner',
  '.github/workflows/deploy.yml',
]);
forbidAll('README.md', [
  '客户端状态版本：',
  '世界状态版本：',
  '市场需求模型版本：',
  '## 工厂生产懒结算',
  '## 工厂即时建设',
  '1 宝石减少',
  '每日最大额度',
  '未使用额度不累计',
  'productionSettlement',
  'SAVE_EPOCH',
  'PRODUCTION_SETTLEMENT_',
  '/var/www/',
  'economy_facility_gem_actions',
  '每完整 `500 km`',
  '固定按基础人口',
], 'README.md');

// docs/README is a router. It may expose global compatibility metadata used to
// choose the correct design set, but it must not copy domain rules or implementation
// checklists from the DESIGN documents.
enforceSize('docs/README.md', { maxLines: 260, maxBytes: 24 * 1024 }, 'docs/README.md');
requireAll('docs/README.md', [
  '# Economy 设计文档索引',
  '本文件只负责**文档索引、内容边界和规则路由**',
  `客户端状态版本：${CURRENT_CLIENT_STATE_VERSION}`,
  '世界状态版本：32',
  '## 1. 文档层级',
  '根 `README.md`',
  '目录级 `README.md`',
  '## 2. DESIGN 内容边界',
  '**唯一职责**',
  '**明确不负责**',
  '## 3. 权威设计文档',
  '| 文档 | 唯一职责 | 明确不负责 |',
  '## 4. 规则路由',
  '## 5. 修改规则',
  '一个语义规则只能有一个权威 DESIGN',
  '专项 verifier 应直接检查对应 DESIGN 与实现',
  '`scripts/verify-document-authority.mjs` 只验证文档登记、层级边界',
  '未登记 Markdown、补充说明和版本化平行文档不得存在',
]);
for (const name of designDocs) {
  if (!read('docs/README.md').includes(`\`${name}\``)) failures.push(`docs/README.md 未登记权威 DESIGN: ${name}`);
}
forbidAll('docs/README.md', [
  '500 普通货币',
  '1 宝石减少',
  'FOK',
  '一种六位微单位运算精度',
  '固定按基础人口',
  '每完整 `500 km`',
  '128 × 128',
  'product-artwork.css',
  'src/assets/',
  'economy_facility_gem_actions',
  '登录态根视口的纵向 overscroll',
  'PRODUCTION_SETTLEMENT_',
  'X-Economy-Save-Epoch',
  '/var/www/',
], 'docs/README.md');

// DESIGN files remain the only rule authority. The index owns their routing, so
// every registered file must be a real design document rather than an empty marker.
for (const name of designDocs) {
  const path = `docs/${name}`;
  if (!existsSync(pathFor(path))) continue;
  const content = read(path);
  if (!content.startsWith('# ')) failures.push(`${path} 必须以一级标题开始`);
  if (Buffer.byteLength(content, 'utf8') < 200) failures.push(`${path} 内容异常过短，不能作为权威 DESIGN`);
}

// DESIGN_COMPRESSION_GUARD
let totalDesignBytes = 0;
const datedRollbackOwners = [];
const duplicatedFactoryRuleOwners = [];
for (const name of designDocs) {
  const path = `docs/${name}`;
  if (!existsSync(pathFor(path))) continue;
  const content = read(path);
  const bytes = Buffer.byteLength(content, 'utf8');
  totalDesignBytes += bytes;
  const maxDesignBytes = name === 'UI_DESIGN_SYSTEM.md' ? 130 * 1024 : 128 * 1024;
  if (bytes > maxDesignBytes) failures.push(`${path} 过大：${bytes} 字节，最多 ${maxDesignBytes / 1024} KiB`);
  if (/^>\s*\d{4}-\d{2}-\d{2}.*不可回退规则/m.test(content)) datedRollbackOwners.push(name);
  if (content.includes('工厂资产禁止通过市场订单簿直接买卖')) duplicatedFactoryRuleOwners.push(name);
}
if (totalDesignBytes > 820 * 1024) failures.push(`全部 DESIGN 过大：${totalDesignBytes} 字节，最多 820 KiB`);
if (datedRollbackOwners.length) failures.push(`DESIGN 不得保留日期式不可回退横幅: ${datedRollbackOwners.join(', ')}`);
if (duplicatedFactoryRuleOwners.length > 1) failures.push(`工厂订单簿禁售规则存在多个 DESIGN owner: ${duplicatedFactoryRuleOwners.join(', ')}`);

if (failures.length) {
  console.error(`文档权威性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('文档权威性验证通过：AGENTS、根 README、设计索引、权威 DESIGN、运行事实与防回退层级已分离，README 不再承载业务规则副本。');