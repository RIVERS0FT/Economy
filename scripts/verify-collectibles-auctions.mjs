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
  'server/src/game-routes.js',
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
  'docs/README.md',
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
  ['server/src/game-routes.js', "path === '/api/game/auctions'"],
  ['server/src/game-routes.js', '/api\\/game\\/auctions'],
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
  'className="widget collectible-auction-create"',
  'className="widget collectible-auction-history"',
  'function parseAuctionQuantity(value: string)',
  "const [quantityInput, setQuantityInput] = useState('1')",
  'const [bundleQuantityDrafts, setBundleQuantityDrafts] = useState<Record<string, string>>({})',
  'const hasInvalidBundleQuantity = bundleItems.some',
  '&& !hasInvalidBundleQuantity',
  'onChange={(event) => setQuantityInput(event.target.value)}',
  'onChange={(event) => updateBundleQuantityDraft(item, event.target.value)}',
  'onBlur={() => commitBundleQuantityDraft(item)}',
  'aria-invalid={selectedQuantity === null',
  'aria-invalid={parsedQuantity === null',
  'clearBundleBuilder',
]) requireText('src/pages/AuctionPage.tsx', text);
for (const text of [
  'const [quantity, setQuantity] = useState(1)',
  'setQuantity(Number(event.target.value))',
  'updateBundleQuantity(item, Number(event.target.value))',
  'Math.floor(nextQuantity || 1)',
]) forbidText('src/pages/AuctionPage.tsx', text);

for (const text of [
  '.ui-segmented.asset-auction-kind-switch',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.collectible-auction-create > .widget-heading',
  '.widget.collectible-auction-create',
  'align-items: start;',
]) requireText('src/styles/collectibles-auctions.css', text);

for (const text of [
  '捆绑拍卖在任一项目无效时不冻结任何资产',
  '混合资产包整体冻结、预占仓库并原子成交',
  '冻结资产继续计入总资产并提供可用与冻结明细',
  '拍卖成交不得写入订单簿行情',
]) requireText('server/test/collectibles-auctions.test.js', text);

for (const [path, texts] of [
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['冻结只改变可用性，不改变所有权', '冻结资产价值']],
  ['docs/GIFT_CODE_AND_ADMIN_DESIGN.md', ['不可拆分的资产包', '最多 20 个规范化资产项目', '冻结资产继续计入卖方总资产']],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
    '资产包编辑器',
    '最近结束区域必须始终存在',
    '可支配资产',
    '固定为三等分单行布局',
    '资产包添加数量和资产包行数量必须把输入中的原始字符串作为编辑草稿',
    '不得在 `onChange` 阶段立即把空字符串强制回填为 `1`',
    '把资产包数量输入恢复为每次按键立即数字化并把空值强制回填为 `1`',
  ]],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['捆绑拍卖', '托管记录不得作为第二份资产余额']],
  ['docs/WAREHOUSE_EXPANSION_DESIGN.md', ['资产包中全部商品数量之和', '捆绑拍卖']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['同一资产包中的多种工厂', '总持有数量不变']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['items[]', '托管记录不得重复计价']],
  ['docs/UI_DESIGN_SYSTEM.md', ['资产包编辑器', '冻结资产明细']],
  ['docs/README.md', ['拍卖资产包数量输入的字符串草稿', '不得恢复空值立即回填为 `1` 的实现']],
]) for (const text of texts) requireText(path, text);

for (const text of ['currentOwnerId: payload', 'highestBid: payload.highestBid']) forbidText('server/src/app.js', text);
for (const text of ['market.lastPrice = auction.highestBid', 'recordFacilityPrice(world, auction']) forbidText('server/src/collectibles.js', text);
forbidText('src/pages/AuctionPage.tsx', 'actions={<StatusTag tone="warning">进行中');
forbidText('src/pages/AuctionPage.tsx', '<Panel><EmptyState>暂无进行中的资产拍卖');

if (failures.length) {
  console.error(`资产包拍卖验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('单项与捆绑资产包拍卖、可编辑数量草稿、冻结资产计价、仓库预占、原子结算、页面结构和权威文档验证通过。');
