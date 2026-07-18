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
  'server/src/facility-groups.js',
  'server/src/warehouse.js',
  'server/src/domain-core.js',
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
  'src/components/icons/ProductIcons.tsx',
  'src/styles/collectibles-auctions.css',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
].forEach(requireFile);

for (const text of [
  "const AIC_IIIF_BASE = 'https://www.artic.edu/iiif/2'",
  'assetKind',
  'assetAuctions',
  'escrowStatus',
  'reserveFacilityAuctionQuantity',
  'releaseFacilityAuctionQuantity',
  'transferFacilityAuctionQuantity',
  "auction.assetKind === 'commodity'",
  'createWarehouseUsage(world, bidder)',
  'previousBidder.frozenCredits',
  "action === 'createAuction'",
  "action === 'placeAuctionBid'",
  "action === 'cancelAuction'",
]) requireText('server/src/collectibles.js', text);

for (const text of [
  'auctionedQuantity',
  'reserveFacilityAuctionQuantity',
  'releaseFacilityAuctionQuantity',
  'transferFacilityAuctionQuantity',
  'auctionedCount',
  'frozenCount',
]) requireText('server/src/facility-groups.js', text);

for (const [path, text] of [
  ['server/src/warehouse.js', "auction?.assetKind !== 'commodity'"],
  ['server/src/warehouse.js', 'highestBidderId'],
  ['server/src/domain-core.js', "auction?.assetKind !== 'commodity'"],
  ['server/src/domain-core.js', 'highestBidderId'],
  ['server/src/storage.js', "'createAuction'"],
  ['server/src/storage.js', "'placeAuctionBid'"],
  ['server/src/storage.js', "'cancelAuction'"],
  ['server/src/app.js', "path === '/api/game/auctions'"],
  ['server/src/app.js', '/api\\/game\\/auctions'],
]) requireText(path, text);

for (const text of [
  'createAuction',
  'placeAuctionBid',
  'cancelAuction',
  "postAction('/auctions'",
]) requireText('src/api/game.ts', text);

for (const text of [
  'assetAuctions',
  "AuctionAssetKind = 'collectible' | 'commodity' | 'facility'",
  'escrowStatus',
]) requireText('src/collectibles/types.ts', text);

for (const text of [
  '发起资产拍卖',
  "(['collectible', 'commodity', 'facility'] as const)",
  'gameActions.createAuction',
  'gameActions.placeAuctionBid',
  'gameActions.cancelAuction',
  '<ProductIcon productId={auction.assetId} />',
  '<FactoryIcon />',
  'selectedQuantity',
  '最高出价资金都会冻结',
  '等待服务器结算',
]) requireText('src/pages/AuctionPage.tsx', text);

for (const text of [
  '商品拍卖冻结商品',
  '商品竞拍必须有足够仓库容量',
  '工厂拍卖冻结运行数量',
  '拍卖成交不得写入订单簿行情',
  '通用拍卖与藏品兼容别名',
]) requireText('server/test/collectibles-auctions.test.js', text);

for (const text of [
  '商品和工厂均可进入竞价拍卖',
  '拍卖成交价不得写入商品或工厂订单簿行情',
  '最高出价者的商品仓库预占',
]) requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', text);
for (const text of ['藏品、商品与工厂竞价拍卖', '当前玩家可拍卖资产类型']) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['拍卖冻结与订单簿冻结必须合并计算', '拍卖成交不属于订单簿成交']) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);
for (const text of ['商品拍卖最高出价预占', '进行中的商品拍卖']) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of ['currentOwnerId: payload', 'highestBid: payload.highestBid']) forbidText('server/src/app.js', text);
for (const text of ['market.lastPrice = auction.highestBid', 'recordFacilityPrice(world, auction']) forbidText('server/src/collectibles.js', text);

if (failures.length) {
  console.error(`资产拍卖验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('藏品、商品与工厂拍卖的资产冻结、竞价资金、仓库预占、自动结算、兼容接口和页面职责验证通过。');
