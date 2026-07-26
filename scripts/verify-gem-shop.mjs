import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`); };

[
  'server/src/gem-shop.js',
  'server/src/gem-economy-store.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/src/game-routes.js',
  'server/src/facility-groups.js',
  'server/test/gem-shop.test.js',
  'server/test/gem-construction-acceleration.test.js',
  'src/pages/GemShopPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/api/invitations.ts',
  'src/components/icons/GemIcon.tsx',
  'src/styles/gem-shop.css',
  'src/styles/primary-surfaces.css',
  'tests/browser/gem-shop-layout.spec.ts',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'GEM_SHOP_CREDITS_PER_GEM = 100',
  'GEM_SHOP_LEGACY_CREDITS_PER_GEM = 10',
  'GEM_SHOP_MIN_CREDITS_PER_GEM = 1',
  'GEM_SHOP_MAX_CREDITS_PER_GEM = 10_000',
  'GEM_SHOP_MAX_DAILY_RATE_CHANGE = Math.floor(GEM_SHOP_MAX_CREDITS_PER_GEM * 0.1)',
  'calculateNextGemShopRate',
  'GEM_SHOP_MIN_EXCHANGE_GEMS = 1',
  'GEM_SHOP_MAX_EXCHANGE_GEMS = 100',
  'player.gems -= gems',
  'player.credits = Number(player.credits || 0) + creditsReceived',
  "category: 'gem_shop_exchange'",
]) requireText('server/src/gem-shop.js', text);
for (const text of [
  'economy_gem_shop_daily_rates',
  'economy_gem_shop_quote_decisions',
  'economy_facility_gem_actions',
  'recordConstructionAcceleration',
]) requireText('server/src/gem-economy-store.js', text);
for (const text of [
  'CREATE TABLE IF NOT EXISTS economy_gem_shop_exchanges',
  'request_key TEXT NOT NULL UNIQUE',
  "action === 'exchangeGems'",
  "action === 'rejectGemShopQuote'",
  "action === 'accelerateFacilityConstruction'",
  'getGemShopSummary',
]) requireText('server/src/storage.js', text);
for (const text of [
  'GEM_CONSTRUCTION_ACCELERATION_MS',
  'player.gems -= GEM_CONSTRUCTION_ACCELERATION_COST',
  'gemAccelerationMs',
]) requireText('server/src/facility-groups.js', text);
requireText('server/src/app.js', "path === '/api/game/gem-shop'");
requireText('server/src/game-routes.js', "path === '/api/game/gem-shop/exchange'");
requireText('server/src/game-routes.js', "path === '/api/game/gem-shop/quote/reject'");
requireText('server/src/game-routes.js', "path === '/api/game/facilities/construction/accelerate'");
requireText('src/config/navigation.ts', "{ id: 'gem-shop', label: '商店' }");

for (const text of [
  'title="商店"',
  '邀请好友获得宝石',
  'import { InvitationSettings }',
  '<InvitationSettings />',
  'gem-shop-main-column',
  'gem-shop-side-column',
  '今日终端报价',
  '1 宝石 =',
  '确认兑换',
  '放弃今日报价',
  '宝石不能用货币买回',
  '兑换记录',
]) requireText('src/pages/GemShopPage.tsx', text);
for (const text of ['宝石加速', '加速处理中', 'accelerateFacilityConstruction']) {
  requireText('src/pages/ProductionPage.tsx', text);
}
for (const text of ['邀请好友', '专属分享链接', '永久邀请码', '注册完成后不能补填或更换', '注册填写']) {
  requireText('src/components/InvitationSettings.tsx', text);
}
for (const text of ['填写好友邀请码', '确认填写', 'claimInvitation']) forbidText('src/components/InvitationSettings.tsx', text);

for (const text of [
  "className ? `game-icon ${className}` : 'game-icon'",
  'width="1em"',
  'height="1em"',
]) requireText('src/components/icons/GemIcon.tsx', text);
for (const text of [
  'align-items: start;',
  'width: 1.35rem;',
  'height: 1.35rem;',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.gem-shop-main-column',
  '.gem-shop-side-column',
  '.gem-shop-side-column { grid-column: 1; order: 2; }',
  '.gem-shop-main-column { grid-column: 1; order: 3; }',
  '@media (max-width: 960px)',
]) requireText('src/styles/gem-shop.css', text);
forbidText('src/styles/gem-shop.css', '.gem-shop-grid > .widget { padding: var(--space-3); }');
for (const text of ['--primary-surface-inset: var(--space-4);', '--primary-surface-inset: var(--space-3);', 'padding: var(--primary-surface-inset);']) {
  requireText('src/styles/primary-surfaces.css', text);
}
for (const text of [
  'view=gem-shop',
  '**/economy-api/game/invitations',
  'desktop shop keeps invitation and exchange in independent top-aligned stacks',
  'compact shop orders exchange before invitation without horizontal overflow',
  "name: '确认兑换'",
  "name: '邀请好友'",
  "name: '确认填写'",
  'balance.height).toBeLessThan(130)',
  'exchange.height).toBeLessThan(340)',
]) requireText('tests/browser/gem-shop-layout.spec.ts', text);
for (const text of ['初始报价为 **1 宝石 = 100 普通货币**', '范围 1～10000', '最大值 10000 的 10%', '不可撤销', '注册事务邀请归因']) {
  requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
}
for (const text of [
  '商店',
  '`gem-shop`',
  '`GemShopPage`',
  '`1440×900`',
  '专属分享链接',
  '两个互不共享网格行高的纵向栈',
  '当前余额／兑换货币／邀请好友／兑换记录',
  '邀请卡唯一归属商店',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', '排名统一通过 `formatRank` 显示为 `#N`');
forbidText('docs/LIQUID_GLASS_CHROME_DESIGN.md', '桌面继续使用“第 1 名”');
for (const text of [
  '/api/game/gem-shop',
  '/api/game/gem-shop/exchange',
  '/api/game/gem-shop/quote/reject',
  '/api/game/facilities/construction/accelerate',
  'economy_gem_shop_exchanges',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
for (const text of ['每次固定消耗 1 宝石，减少当前施工 30 分钟', '初始报价为 1 宝石兑换 100 普通货币', '每日绝对变化上限为最高报价 10000 的 10%', '不得增加宝石兑换工厂产量']) {
  requireText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', text);
}
for (const text of ['商店 `.gem-shop-grid > .widget` 的固定 padding', '新增一级卡片必须使用 `PagePanel`']) {
  requireText('docs/PRIMARY_SURFACE_INSET_DESIGN.md', text);
}

if (failures.length) {
  console.error(`商店与邀请布局验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('商店验证通过：每日终端报价、动态汇率、施工宝石加速、原子兑换与共享一级卡片规则均已锁定。');
