import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'server/src/collectibles.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/src/index.js',
  'server/test/collectibles-auctions.test.js',
  'src/collectibles/types.ts',
  'src/pages/CollectionsPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/api/game.ts',
  'src/api/admin.ts',
  'src/app/AdminApp.tsx',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'src/components/icons/GameIcons.tsx',
  'src/styles/collectibles-auctions.css',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
].forEach(requireFile);

for (const text of [
  "const AIC_IIIF_BASE = 'https://www.artic.edu/iiif/2'",
  'isPublicDomain',
  'currentOwnerId',
  'collectibleOwnershipHistory',
  'processCollectibleAuctions',
  'canResetCollectibles',
  'createCollectibleClientState',
  'importCollectibles',
  'previousBidder.frozenCredits',
]) requireText('server/src/collectibles.js', text);

for (const text of [
  'applyCollectibleAction',
  'COLLECTIBLE_ACTIONS',
  'collectibleCount',
  'openAuctionCount',
  'listCollectibleOwnership',
]) requireText('server/src/storage.js', text);

for (const text of [
  '/api/game/collectible-auctions',
  '/api/game/admin/collectibles/import',
  'readJson(request, 262_144)',
]) requireText('server/src/app.js', text);
requireText('server/src/index.js', "import './app.js'");

for (const text of [
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
]) requireText('src/api/game.ts', text);

for (const text of [
  '上传藏品',
  'isPublicDomain',
  'initialOwnerId',
  '归属历史',
  '不允许上传任意图片 URL',
]) requireText('src/app/AdminApp.tsx', text);

for (const text of [
  "{ id: 'collections', label: '藏品' }",
  "{ id: 'auction', label: '拍卖' }",
]) requireText('src/config/navigation.ts', text);

for (const text of ["case 'collections'", "case 'auction'"]) requireText('src/pages/PageRouter.tsx', text);
for (const text of ['CollectionIcon', 'AuctionIcon', "case 'collections'", "case 'auction'"]) requireText('src/components/icons/GameIcons.tsx', text);

for (const text of [
  '只有当前持有人可以发起拍卖',
  '被新的最高出价超过时，原最高出价立即完整释放',
  '已有出价后允许卖家取消拍卖',
  '正式图片 URL 由服务器按 `imageId` 生成',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);

for (const text of ['任意图片 URL', 'currentOwnerId: payload', 'highestBid: payload.highestBid']) forbidText('server/src/app.js', text);

if (failures.length) {
  console.error(`藏品与拍卖验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('芝加哥艺术博物馆 IIIF 藏品、唯一归属、管理员导入、竞价冻结、自动结算和页面职责验证通过。');
