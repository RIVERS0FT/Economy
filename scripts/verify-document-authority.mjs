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
    '客户端状态版本：`17`',
    '世界状态版本：`15`',
    '市场需求模型版本：`10`',
    '概览｜市场｜生产｜资产｜拍卖｜合同｜排行｜商店｜设置',
    '共享仓库允许无限扩容',
    '所有工厂集群统一使用服务器正式配方',
    '长期生产合作合同只涉及商品与普通货币',
    '合同交付不写入统一订单簿行情、商品估值或交易榜',
    '三类人口使用真实余额',
    '固定按基础人口 60%／技术人口 30%／专业人口 10%',
    '每次有效点击继续直接发行新普通货币',
    '商店兑换继续按固定汇率直接发行普通货币',
    '不设置人口侧货币回收',
    '人口消费成交不再发行普通货币',
    '市场页面不得增加人口经济区域',
    '管理员“人口”分区提供只读人口经济区域',
    '70% 用于最终消费的直接需求，30% 用于沿正式配方反向推导的派生流动性',
    '市场储备每 5 分钟撤销并重挂双边商品订单',
    '可成交订单必须立即按 maker price 撮合',
    '最高系统买价严格低于最低系统卖价',
    '商品和工厂可单独或混合组成最多 20 项的不可拆分资产包公开竞价',
    '不得通过新增“补充说明”、V2/V3 文件或平行专题文档覆盖现行规则',
    '商品初始参考价、生产数量、周期秒数和周期成本全部保持整数',
  ]) {
    if (!rootReadme.includes(text)) failures.push(`README.md 缺少当前规则: ${text}`);
  }
  for (const text of ['## 生产与仓库布局 V3', '## 统一资产订单簿与玩家系统（', '## 扩展产业目录']) {
    if (rootReadme.includes(text)) failures.push(`README.md 不得恢复追加式旧章节: ${text}`);
  }
}

for (const path of versionedDocs) {
  if (!existsSync(pathFor(path))) continue;
  const content = read(path);
  if (!content.includes('客户端状态版本：17')) failures.push(`${path} 客户端状态版本必须为 17`);
  if (!content.includes('世界状态版本：15')) failures.push(`${path} 世界状态版本必须为 15`);
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
    '人口就业收入、三类人口真实钱包、生产复杂度岗位结构、固定建造业岗位结构',
    '商店固定汇率、单向兑换、直接货币发行、兑换幂等与独立页面',
    '普通玩家成交记录不得暴露来源、去向或对手订单',
    '库存与资金守恒的双边市场储备',
    '长期生产合作合同的页面职责归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`',
    '`FACILITY_CATALOG_PRESENTATION_DESIGN.md`',
    '`OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md`',
    '`PRODUCTION_PILL_ALIGNMENT_DESIGN.md`',
    '`REGISTRATION_INVITE_FLOW_DESIGN.md`',
    '`AUTHORITATIVE_COUNTDOWN_DESIGN.md`',
    '`PRIMARY_SURFACE_INSET_DESIGN.md`',
    '商品插画主视觉',
    '`product-artwork.css`',
    '`src/assets/product-icons/generated/128/`',
    '`scripts/generate-product-artwork-thumbnails.mjs`',
    '`scripts/verify-product-artwork.mjs`',
    '`128 × 128`',
    '不得重新创建 `GAME_SHELL_LAYOUT_DESIGN.md`、`OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md`',
  ]) {
    if (!index.includes(text)) failures.push(`docs/README.md 缺少防回退规则: ${text}`);
  }
}

if (failures.length) {
  console.error(`文档权威性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('文档权威性验证通过：登记文档清单、版本 17/15、市场需求模型 10、长期生产合同、商品／工厂资产拍卖、真实人口钱包、就业资金流、统一订单簿、双边市场储备和九页导航职责均满足当前基线。');
