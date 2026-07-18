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
  'server/src/storage.js',
  'server/src/app.js',
  'server/test/collectibles-auctions.test.js',
  'src/collectibles/types.ts',
  'src/pages/CollectionsPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/api/game.ts',
  'src/types.ts',
  'src/components/icons/GameIcons.tsx',
  'src/components/icons/ProductIcons.tsx',
  'src/styles/collectibles-auctions.css',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

for (const text of [
  "const AIC_IIIF_BASE = 'https://www.artic.edu/iiif/2'",
  'MAX_AUCTION_ITEMS',
  'normalizeRequestedItems',
  'auction.items',
  'itemSummaries',
  'isBundle',
  'validateFacilityAuctionQuantity',
  'requiredCommodityCapacity',
  'createWarehouseUsage(world, bidder)',
  'previousBidder.frozenCredits',
  "action === 'createAuction'",
  "action === 'placeAuctionBid'",
  "action === 'cancelAuction'",
  'auctionTotalPrice',
]) requireText('server/src/collectibles.js', text);

for (const text of [
  'auctionItems',
  'auctionedQuantity',
  'validateFacilityAuctionQuantity',
  'reserveFacilityAuctionQuantity',
  'releaseFacilityAuctionQuantity',
  'transferFacilityAuctionQuantity',
  'availableAssetValue',
  'frozenAssetValue',
  'frozenFacilityValue',
]) requireText('server/src/facility-groups.js', text);

for (const text of ['auctionItems', 'auctionCommodityQuantity', 'highestBidderId']) requireText('server/src/warehouse.js', text);
for (const [path, text] of [
  ['server/src/storage.js', "'createAuction'"],
  ['server/src/storage.js', "'placeAuctionBid'"],
  ['server/src/storage.js', "'cancelAuction'"],
  ['server/src/app.js', "path === '/api/game/auctions'"],
  ['server/src/app.js', '/api\\/game\\/auctions'],
]) requireText(path, text);

for (const text of ['createAuction', 'AuctionItem[]', "postAction('/auctions'", 'items']) requireText('src/api/game.ts', text);
for (const text of ['AuctionItem', 'itemSummaries', 'itemCount', 'isBundle', 'auctionTotalPrice']) requireText('src/collectibles/types.ts', text);
for (const text of ['frozenAssetValue', 'availableAssetValue', '冻结资产仍归当前玩家所有']) requireText('src/pages/AssetsPage.tsx', text);
for (const text of ['availableCashValue', 'frozenCashValue', 'frozenCommodityValue', 'frozenFacilityValue']) requireText('src/types.ts', text);

for (const text of [
  '发布资产包拍卖',
  '加入资产包',
  'gameActions.createAuction(bundleItems',
  'gameActions.placeAuctionBid',
  'gameActions.cancelAuction',
  '不可拆分资产包',
  'aria-pressed={assetKind === kind}',
  '暂无最近结束的拍卖',
  '冻结资产仍归卖方所有并计入总资产',
]) requireText('src/pages/AuctionPage.tsx', text);

for (const text of [
  '捆绑拍卖在任一项目无效时不冻结任何资产',
  '混合资产包整体冻结、预占仓库并原子成交',
  '冻结资产继续计入总资产并提供可用与冻结明细',
  '拍卖成交不得写入订单簿行情',
]) requireText('server/test/collectibles-auctions.test.js', text);

for (const [path, texts] of [
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['冻结只改变可用性，不改变所有权', '冻结资产价值']],
  ['docs/GIFT_CODE_AND_ADMIN_DESIGN.md', ['不可拆分的资产包', '最多 20 个规范化资产项目', '冻结资产继续计入卖方总资产']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['资产包编辑器', '最近结束区域必须始终存在', '可支配资产']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['捆绑拍卖', '托管记录不得作为第二份资产余额']],
  ['docs/WAREHOUSE_EXPANSION_DESIGN.md', ['资产包中全部商品数量之和', '捆绑拍卖']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['同一资产包中的多种工厂', '总持有数量不变']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['items[]', '托管记录不得重复计价']],
  ['docs/UI_DESIGN_SYSTEM.md', ['资产包编辑器', '冻结资产明细']],
]) for (const text of texts) requireText(path, text);

for (const text of ['currentOwnerId: payload', 'highestBid: payload.highestBid']) forbidText('server/src/app.js', text);
for (const text of ['market.lastPrice = auction.highestBid', 'recordFacilityPrice(world, auction']) forbidText('server/src/collectibles.js', text);
forbidText('src/pages/AuctionPage.tsx', 'actions={<StatusTag tone="warning">进行中');
forbidText('src/pages/AuctionPage.tsx', '<Panel><EmptyState>暂无进行中的资产拍卖');

if (failures.length) {
  console.error(`资产包拍卖验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('单项与捆绑资产包拍卖、冻结资产计价、仓库预占、原子结算、页面结构和权威文档验证通过。');
