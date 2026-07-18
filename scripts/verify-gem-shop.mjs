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
  'server/src/storage.js',
  'server/src/app.js',
  'server/src/game-routes.js',
  'server/test/gem-shop.test.js',
  'src/pages/GemShopPage.tsx',
  'src/components/icons/GemIcon.tsx',
  'src/styles/gem-shop.css',
  'tests/browser/gem-shop-layout.spec.ts',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'GEM_SHOP_CREDITS_PER_GEM = 10',
  'GEM_SHOP_MIN_EXCHANGE_GEMS = 1',
  'GEM_SHOP_MAX_EXCHANGE_GEMS = 100',
  'player.gems -= gems',
  'player.credits = Number(player.credits || 0) + creditsReceived',
  "category: 'gem_shop_exchange'",
]) requireText('server/src/gem-shop.js', text);
for (const text of [
  'CREATE TABLE IF NOT EXISTS economy_gem_shop_exchanges',
  'request_key TEXT NOT NULL UNIQUE',
  "action === 'exchangeGems'",
  'this.insertGemShopExchange.run',
  'getGemShopSummary',
]) requireText('server/src/storage.js', text);
requireText('server/src/app.js', "path === '/api/game/gem-shop'");
requireText('server/src/game-routes.js', "path === '/api/game/gem-shop/exchange'");
for (const text of [
  "{ id: 'gem-shop', label: '商店' }",
]) requireText('src/config/navigation.ts', text);
for (const text of [
  'title="商店"',
  '1 宝石 =',
  '确认兑换',
  '宝石不能用货币买回',
  '兑换记录',
]) requireText('src/pages/GemShopPage.tsx', text);
for (const text of [
  "className ? `game-icon ${className}` : 'game-icon'",
  'width="1em"',
  'height="1em"',
]) requireText('src/components/icons/GemIcon.tsx', text);
for (const text of ['align-items: start;', 'width: 1.35rem;', 'height: 1.35rem;', 'grid-template-columns: repeat(3, minmax(0, 1fr));', '.gem-shop-grid > .widget { padding: var(--space-3); }', '@media (max-width: 960px)']) requireText('src/styles/gem-shop.css', text);
for (const text of ['view=gem-shop', '.gem-shop-balance-row svg', "name: '确认兑换'", 'balance.height).toBeLessThan(130)', 'exchange.height).toBeLessThan(340)']) requireText('tests/browser/gem-shop-layout.spec.ts', text);
for (const text of ['固定汇率', '单向兑换', '不可撤销']) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of ['商店', '`gem-shop`', '`GemShopPage`', '`1440×900`', '宝石、可用资金和固定汇率三项', '快捷兑换使用紧凑按钮', '“兑换货币”和“兑换记录”']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', '排名在桌面与移动端统一通过 `formatRank`');
forbidText('docs/LIQUID_GLASS_CHROME_DESIGN.md', '桌面继续使用“第 1 名”');
for (const text of ['/api/game/gem-shop', '/api/game/gem-shop/exchange', 'economy_gem_shop_exchanges']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

if (failures.length) {
  console.error(`商店验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('商店验证通过：独立页面、服务器固定汇率、原子兑换、幂等和记录规则均已锁定。');
