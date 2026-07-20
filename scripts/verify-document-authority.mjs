import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const pathFor = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFor(path), 'utf8');
const failures = [];

const canonicalDocs = [
  'README.md',
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
  'docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md',
  'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];

const canonicalDocsDirectoryEntries = new Set(
  canonicalDocs
    .filter((path) => path.startsWith('docs/'))
    .map((path) => path.slice('docs/'.length)),
);

const versionedDocs = [
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
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

for (const path of canonicalDocs) {
  if (!existsSync(pathFor(path))) failures.push(`缺少权威文档: ${path}`);
}
for (const path of forbiddenLegacyDocs) {
  if (existsSync(pathFor(path))) failures.push(`旧文档不得重新创建: ${path}`);
}

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
    '客户端状态版本：`15`',
    '世界状态版本：`13`',
    '市场需求模型版本：`4`',
    '概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜商店｜设置',
    '共享仓库允许无限扩容',
    '所有工厂集群统一使用服务器正式配方',
    '商品订单只允许玩家订单、消费需求订单和市场储备订单',
    '`food` 食品市场与 `household` 家庭消费市场',
    '食品市场基础预算为 3,000／5 分钟',
    '家庭消费市场基础预算为 2,700／5 分钟',
    '玩家库存数量和库存价值不得扩大市场需求总预算',
    '旧消费买单按剩余数量保留 50%',
    '新周期使用新预算发布更高价买单',
    '70% 用于最终消费的直接需求，30% 用于沿正式配方反向推导的派生流动性',
    '市场储备每 5 分钟撤销并重挂双边商品订单',
    '真实资金和库存同时生成商品买单与卖单',
    '迁移只执行一次储备资金和商品种子初始化',
    '藏品是服务器记录归属的唯一资产实例',
    '不得通过新增“补充说明”、V2/V3 文件或平行专题文档覆盖现行规则',
    '过长文档优先通过合并重复表格',
    '商品初始参考价、生产数量、周期秒数和周期成本全部保持整数',
  ]) {
    if (!rootReadme.includes(text)) failures.push(`README.md 缺少当前规则: ${text}`);
  }
  for (const text of [
    '## 生产与仓库布局 V3',
    '## 统一资产订单簿与玩家系统（',
    '## 扩展产业目录',
  ]) {
    if (rootReadme.includes(text)) failures.push(`README.md 不得恢复追加式旧章节: ${text}`);
  }
}

for (const path of versionedDocs) {
  if (!existsSync(pathFor(path))) continue;
  const content = read(path);
  if (!content.includes('客户端状态版本：15')) failures.push(`${path} 客户端状态版本必须为 15`);
  if (!content.includes('世界状态版本：13')) failures.push(`${path} 世界状态版本必须为 13`);
}

if (existsSync(pathFor('docs/README.md'))) {
  const index = read('docs/README.md');
  for (const text of [
    '本目录只保留当前设计',
    '不得以“补充说明”“V2/V3”或未登记专题文档的形式继续并行存在',
    '未列入下方权威文档表的 Markdown 文件不得存在',
    '新的功能规则必须合并进现有权威文档',
    '芝加哥艺术博物馆藏品导入、唯一归属、竞价拍卖',
    '`scripts/verify-document-authority.mjs` 必须遍历 `docs/*.md`',
    '过长文档优先通过删除重复表格',
    '参考分钟利润必须由正式目录自动校验',
    '商店固定汇率、单向兑换、兑换幂等与独立页面',
    '普通玩家成交记录不得暴露来源、去向或对手订单',
    '库存与资金守恒的双边市场储备',
    '`FACILITY_CATALOG_PRESENTATION_DESIGN.md`',
    '`OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md`',
    '`PRODUCTION_PILL_ALIGNMENT_DESIGN.md`',
    '`REGISTRATION_INVITE_FLOW_DESIGN.md`',
    '`PRIMARY_SURFACE_INSET_DESIGN.md`',
    '一级卡片外层内边距',
    '不得重新创建 `GAME_SHELL_LAYOUT_DESIGN.md`、`OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md`',
  ]) {
    if (!index.includes(text)) failures.push(`docs/README.md 缺少防回退规则: ${text}`);
  }
}

if (failures.length) {
  console.error(`文档权威性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('文档权威性验证通过：登记文档清单、未知 Markdown 拒绝、版本 15/13、市场需求模型 4、双边市场储备、九页导航、商店、整数经济基线、一级卡片外层内边距、外壳与滚动条归属、单一职责专题、文档整理规则和旧文件禁令均满足当前基线。');
