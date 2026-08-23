import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`); };

[
  'README.md',
  'server/src/gem-shop.js',
  'server/src/gem-economy-store.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/src/game-routes.js',
  'server/src/facility-groups.js',
  'server/test/gem-shop.test.js',
  'server/test/research-gem-acceleration.test.js',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/pages/BuildingsPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/api/invitations.ts',
  'src/components/icons/GemIcon.tsx',
  'src/styles/gem-shop.css',
  'src/styles/primary-surfaces.css',
  'tests/browser/gem-shop-layout.spec.ts',
  'tests/browser/production-status-summary.spec.ts',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'GEM_SHOP_CREDITS_PER_GEM = 100',
  'GEM_SHOP_MIN_CREDITS_PER_GEM = 1',
  'GEM_SHOP_MAX_CREDITS_PER_GEM = 10_000',
  'calculateNextGemShopRate',
  'player.gems -= gems',
]) requireText('server/src/gem-shop.js', text);
for (const text of [
  'economy_gem_shop_daily_rates',
  'economy_facility_gem_actions',
  'economy_research_gem_actions',
  'recordResearchAcceleration',
]) {
  requireText('server/src/gem-economy-store.js', text);
}
for (const text of ['insertFacilityGemAction', 'recordConstructionAcceleration', 'INSERT INTO economy_facility_gem_actions']) {
  forbidText('server/src/gem-economy-store.js', text);
}
for (const text of ["action === 'exchangeGems'", "action === 'rejectGemShopQuote'", "action === 'accelerateResearch'"]) {
  requireText('server/src/storage.js', text);
}
forbidText('server/src/storage.js', 'accelerateFacilityConstruction');
for (const text of ['GEM_CONSTRUCTION_ACCELERATION_MS', 'gemAccelerationMs', 'accelerateFacilityConstruction']) {
  forbidText('server/src/facility-groups.js', text);
}
requireText('server/src/game-routes.js', "retiredFacilityConstructionAcceleration");
requireText('server/src/app.js', '施工加速接口已退役');
for (const text of [
  'label="建造数量"',
  'label="建造资金"',
  'label="建造材料"',
  'value="无需材料"',
  "'建造资金' : '资金与建造材料'",
]) {
  requireText('src/pages/BuildingsPage.tsx', text);
}
for (const text of ['宝石加速', '施工时间', 'constructionRemainingAfterAcceleration', 'accelerateFacilityConstruction']) {
  forbidText('src/pages/BuildingsPage.tsx', text);
}
for (const text of ['production title omits status counts while instant construction shows costs without gem acceleration', "not.toContainText('宝石加速')", "not.toContainText('施工中')"]) {
  requireText('tests/browser/production-status-summary.spec.ts', text);
}
for (const text of [
  '宝石只有两种正式使用方式',
  '每次固定消耗 1 宝石，减少当前研发 30 分钟',
  '正式运行时不得再准备 INSERT、暴露写方法或新增记录',
  '固定返回 `410 Gone`',
  '世界状态版本继续为 27',
  '不得增加宝石兑换工厂产量',
]) {
  requireText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', text);
}
forbidText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', '世界状态版本继续为 26');
forbidText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', '每次固定消耗 1 宝石，减少当前施工 30 分钟');
requireText('README.md', '当前研发支持 1 宝石减少 30 分钟的服务器权威加速，工厂建设即时完成且不产生施工加速');
forbidText('README.md', '施工与研发均支持 1 宝石减少 30 分钟');
requireText('docs/README.md', '研发宝石加速、工厂施工加速退役');
forbidText('docs/README.md', '直接货币发行、施工宝石加速、兑换幂等');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '/api/game/facilities/construction/accelerate');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '410 Gone');
for (const text of ['礼品码兑换', 'model.redeemGift', 'giftCode', 'gem-shop-gift-card', 'label="礼品兑换码"']) {
  requireText('src/pages/GemShopPage.tsx', text);
}
for (const text of ['WidgetHeading title="礼品兑换"', 'label="礼品兑换码"', 'redeemGift', 'gift-redemption-card']) {
  forbidText('src/pages/SettingsPage.tsx', text);
}
requireText('tests/browser/gem-shop-layout.spec.ts', '礼品码兑换');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '礼品码兑换唯一归属商店');
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '商店页提供独立礼品兑换卡');

if (failures.length) {
  console.error(`商店与宝石验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('商店验证通过：每日终端报价和研发宝石加速保持有效，工厂施工加速仅保留只读历史审计与 410 兼容墓碑。');
