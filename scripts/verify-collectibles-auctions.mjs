import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };
const requireOrder = (path, texts) => {
  const source = read(path);
  let cursor = -1;
  for (const text of texts) {
    const next = source.indexOf(text, cursor + 1);
    if (next === -1) {
      failures.push(`${path} 缺少顺序节点: ${text}`);
      return;
    }
    if (next < cursor) {
      failures.push(`${path} 顺序错误: ${texts.join(' → ')}`);
      return;
    }
    cursor = next;
  }
};

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
  'src/styles/auction-card-layers.css',
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
  'className="asset-auction-card-heading"',
  'function AuctionAssetSummary({ auction }',
  'className="asset-auction-icon-layer"',
  'className="asset-auction-summary-icon"',
  'className="asset-auction-summary-quantity"',
  'className="asset-auction-summary-placeholder"',
  'const placeholderCount = Math.max(0, MAX_AUCTION_ITEMS - items.length);',
  '{items.map((item) => (',
  'Array.from({ length: placeholderCount }',
  'asset-auction-data-layer',
  'function auctionCardTitle(auction: AssetAuction)',
  'return items.length === 1 ? items[0].name : auctionTitle(auction);',
  'title={auctionCardTitle(auction)}',
  "import '../styles/auction-card-layers.css';",
  'className="asset-auction-more-count"',
  'asset-auction-primary-metrics',
  'aria-pressed={assetKind === kind}',
  '暂无最近结束的拍卖',
  '冻结资产仍归卖方所有并计入总资产',
  'className="widget collectible-auction-create"',
  'className="widget collectible-auction-history"',
  'function parseAuctionQuantity(value: string, maximum?: number)',
  "const [quantityInput, setQuantityInput] = useState('1')",
  'const [bundleQuantityDrafts, setBundleQuantityDrafts] = useState<Record<string, string>>({})',
  'const hasInvalidBundleQuantity = bundleItems.some',
  '&& !hasInvalidBundleQuantity',
  'onValueChange={setQuantityInput}',
  'error={selectedQuantity === null',
  'onChange={(event) => updateBundleQuantityDraft(item, event.target.value)}',
  'onBlur={() => commitBundleQuantityDraft(item)}',
  'aria-invalid={parsedQuantity === null',
  'clearBundleBuilder',
  "import { IntegerInput, SelectInput } from '../components/ui/FormControls'",
]) requireText('src/pages/AuctionPage.tsx', text);
requireOrder('src/pages/AuctionPage.tsx', [
  '<AuctionAssetVisual auction={auction} />',
  'className="asset-auction-card-heading"',
  '<AuctionAssetSummary auction={auction} />',
  'asset-auction-data-layer',
]);
for (const text of [
  'const [quantity, setQuantity] = useState(1)',
  'setQuantity(Number(event.target.value))',
  'updateBundleQuantity(item, Number(event.target.value))',
  'Math.floor(nextQuantity || 1)',
  '· 整包竞价',
  'className="asset-auction-item-list"',
  '<dt>资产项目</dt>',
  '<dt>出价次数</dt>',
  '<dt>卖家</dt>',
  'className="asset-auction-tile-quantity"',
  'className="asset-auction-summary-more"',
]) forbidText('src/pages/AuctionPage.tsx', text);

for (const text of [
  '.ui-segmented.asset-auction-kind-switch',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '.collectible-auction-create > .widget-heading',
  '.widget.collectible-auction-create',
  'align-items: start;',
  '.asset-auction-card-heading',
  '.asset-auction-more-count',
  'background: var(--color-success-strong);',
  'white-space: nowrap;',
]) requireText('src/styles/collectibles-auctions.css', text);
for (const text of [
  '.asset-auction-item-list',
  '.asset-auction-bundle-visual > strong',
]) forbidText('src/styles/collectibles-auctions.css', text);

for (const text of [
  '.asset-auction-icon-layer',
  'grid-template-columns: repeat(5, minmax(0, 48px));',
  'grid-auto-flow: row;',
  '.asset-auction-summary-icon',
  'position: relative;',
  '.asset-auction-summary-quantity',
  'right: 3px;',
  'bottom: 3px;',
  '.asset-auction-summary-placeholder',
  'border: 1px dashed rgba(255, 255, 255, .1);',
  'pointer-events: none;',
  'grid-template-columns: repeat(5, minmax(0, 44px));',
  '.asset-auction-data-layer',
  'border-top: 1px solid var(--color-border-subtle);',
]) requireText('src/styles/auction-card-layers.css', text);
for (const text of [
  'overflow-x: auto;',
  '.asset-auction-summary-more',
]) forbidText('src/styles/auction-card-layers.css', text);

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
    '必须保留标题上方的顶部大型资产主视觉',
    '五列四行资产矩阵',
    '大图标不得显示 `×N` 数量胶囊',
    '绿色 `+N`',
    '固定为五列四行、共 20 个槽位',
    '完整展示全部规范化项目',
    '不可交互、对辅助技术隐藏的低对比度空卡片补齐',
    '资产矩阵不得使用 `+N`',
    '不得改成四列五行',
    '数据层只能展示“当前总价”和“最高出价者”',
    '单项拍卖标题只显示资产名称',
    '在大图标恢复 `×N` 数量胶囊',
    '让标题下方资产矩阵少于 20 个槽位',
    '不得重复展示“不可拆分资产包 · 整包竞价”说明',
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
console.log('单项与捆绑资产包拍卖、可编辑数量草稿、顶部无数量主视觉、完整五列四行资产矩阵、空槽位补齐、数据层、冻结资产计价、仓库预占、原子结算和权威设计验证通过。');
