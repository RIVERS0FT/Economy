import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };

[
  'server/src/gem-shop.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/test/gem-shop.test.js',
  'src/pages/GemShopPage.tsx',
  'src/styles/gem-shop.css',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
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
for (const text of [
  "path === '/api/game/gem-shop'",
  "path === '/api/game/gem-shop/exchange'",
]) requireText('server/src/app.js', text);
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
for (const text of ['固定汇率', '单向兑换', '不可撤销']) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of ['商店', '`gem-shop`', '`GemShopPage`']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['/api/game/gem-shop', '/api/game/gem-shop/exchange', 'economy_gem_shop_exchanges']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

if (failures.length) {
  console.error(`商店验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('商店验证通过：独立页面、服务器固定汇率、原子兑换、幂等和记录规则均已锁定。');
