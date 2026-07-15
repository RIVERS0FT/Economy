import { existsSync, readFileSync } from 'node:fs';
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
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];

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
];

for (const path of canonicalDocs) {
  if (!existsSync(pathFor(path))) failures.push(`缺少权威文档: ${path}`);
}
for (const path of forbiddenLegacyDocs) {
  if (existsSync(pathFor(path))) failures.push(`旧文档不得重新创建: ${path}`);
}

if (existsSync(pathFor('README.md'))) {
  const rootReadme = read('README.md');
  for (const text of [
    '客户端状态版本：`12`',
    '世界状态版本：`8`',
    '概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜设置',
    '共享仓库允许无限扩容',
    '所有工厂集群统一使用服务器正式配方',
    '食品、小麦和水稻共享同一个人口饮食需求组',
    '每 5 分钟最多 330',
    '藏品是服务器记录归属的唯一资产实例',
    '不得通过新增“补充说明”、V2/V3 文件或平行专题文档覆盖现行规则',
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
  if (!content.includes('客户端状态版本：12')) failures.push(`${path} 客户端状态版本必须为 12`);
  if (!content.includes('世界状态版本：8')) failures.push(`${path} 世界状态版本必须为 8`);
}

if (existsSync(pathFor('docs/README.md'))) {
  const index = read('docs/README.md');
  for (const text of [
    '本目录只保留当前设计',
    '不得以“补充说明”“V2/V3”或新专题文档的形式继续并行存在',
    '新的功能规则必须合并进现有权威文档',
    '芝加哥艺术博物馆藏品导入、唯一归属、竞价拍卖',
    '`scripts/verify-document-authority.mjs`',
  ]) {
    if (!index.includes(text)) failures.push(`docs/README.md 缺少防回退规则: ${text}`);
  }
}

if (failures.length) {
  console.error(`文档权威性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('文档权威性验证通过：唯一文档结构、版本 12/8、饮食需求、八页导航和旧文件禁令均满足当前基线。');
