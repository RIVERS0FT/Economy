import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const absolute = (path) => resolve(root, path);
const read = (path) => readFileSync(absolute(path), 'utf8');
const requireFile = (path) => { if (!existsSync(absolute(path))) failures.push(`缺少文件: ${path}`); };
const forbidFile = (path) => { if (existsSync(absolute(path))) failures.push(`永久或临时文件不得存在: ${path}`); };
const requireText = (path, fragments) => {
  const source = read(path);
  for (const fragment of fragments) if (!source.includes(fragment)) failures.push(`${path} 缺少资产拍卖规则: ${fragment}`);
};
const forbidText = (path, fragments) => {
  const source = read(path);
  for (const fragment of fragments) if (source.includes(fragment)) failures.push(`${path} 不得恢复旧拍卖规则: ${fragment}`);
};
const requireOrder = (path, fragments) => {
  const source = read(path);
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    if (next === -1) { failures.push(`${path} 缺少顺序节点: ${fragment}`); return; }
    cursor = next;
  }
};
const filesUnder = (directory) => {
  const result = [];
  const visit = (path) => {
    for (const entry of readdirSync(absolute(path))) {
      const child = `${path}/${entry}`;
      if (statSync(absolute(child)).isDirectory()) visit(child); else result.push(child);
    }
  };
  visit(directory);
  return result;
};

[
  'server/src/asset-auctions.js',
  'server/src/auction-audit-store.js',
  'server/src/facility-groups.js',
  'server/src/warehouse.js',
  'server/src/storage.js',
  'server/src/runtime-store.js',
  'server/src/app.js',
  'server/src/game-routes.js',
  'server/src/state-partitions.js',
  'server/test/asset-auctions.test.js',
  'server/test/auction-fees-audit.test.js',
  'src/auctions/types.ts',
  'src/pages/AuctionPage.tsx',
  'src/components/ui/SafeTooltip.tsx',
  'src/api/game.ts',
  'src/styles/asset-auctions.css',
  'src/styles/auction-card-layers.css',
  'tests/browser/auction-bid-history.spec.ts',
  'tests/browser/auction-bid-layout.spec.ts',
  '.github/workflows/deploy.yml',
  'scripts/verify-production-deployment.sh',
  'scripts/manage-production-backups.py',
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

[
  'server/src/warehouse-reservations.js',
  'server/src/collectibles.js',
  'server/test/collectibles-auctions.test.js',
  'src/collectibles',
  'src/pages/CollectionsPage.tsx',
  'src/styles/collectibles-auctions.css',
  '.github/workflows/apply-remove-collectibles.yml',
  '.github/workflows/export-source-for-agent.yml',
  '.github/workflows/agent-source-export.yml',
  '.github/workflows/agent-apply-auction-patch.yml',
  '.agent',
].forEach(forbidFile);

requireText('server/src/asset-auctions.js', [
  'export const ASSET_AUCTION_RULE_VERSION = 2;',
  'export const AUCTION_LISTING_FEE_RATE_BPS = 20;',
  'export const AUCTION_LISTING_FEE_MINIMUM = 0.5;',
  'export const AUCTION_LISTING_FEE_MAXIMUM = 100;',
  'export const AUCTION_SELLER_FEE_BPS = 100;',
  'export const AUCTION_BUYER_FEE_BPS = 0;',
  'export const AUCTION_MINIMUM_INCREMENT_RATE_BPS = 200;',
  'export const AUCTION_EXTENSION_WINDOW_MS = 2 * 60 * 1_000;',
  'export const AUCTION_MAX_EXTENSION_MS = 30 * 60 * 1_000;',
  'export const AUCTION_RECENT_BID_LIMIT = 10;',
  'export function calculateAuctionListingFee(startingBid, reservePrice = null)',
  'export function calculateAuctionMinimumIncrement(startingBid)',
  'world.auctionFeeEscrowCredits',
  "listingFeeStatus: 'held'",
  "finalizeAuction(world, auction, now, 'ended', 'reserve_not_met')",
  'auction.extensionCount += 1;',
  'highestBidderLabel:',
  'bidCount:',
  'reserveMet,',
  'isOutbid,',
  'export function createAssetAuctionClientState(world, userId, now = Date.now())',
  'export function createAuctionBidHistoryFallback(auction, userId)',
  "eventType: 'previous_bid_released'",
  "eventType: 'seller_fee_charged'",
  "eventType: 'listing_fee_distributed'",
  "eventType: 'listing_fee_refunded'",
  "eventType: 'listing_fee_refund_deferred'",
  "auction.listingFeeStatus === 'held' ? addMoney(sum, auction.listingFee) : sum",
  'world.version = 21;',
]);
forbidText('server/src/asset-auctions.js', [
  'market.lastPrice = auction.highestBid',
  'lastTradePrice = auction.highestBid',
  'recordFacilityPrice(world, auction',
  'priceHistory.push',
  'applyMarketSellFee(',
  'calculateCumulativeMarketSellFee(',
  'highestBidderName:',
  '...auction,',
]);

requireText('server/src/auction-audit-store.js', [
  'economy_asset_auction_events',
  'AUCTION_AUDIT_BUFFER',
  'export function queueAuctionAuditEvent',
  'export function flushAuctionAuditEvents',
  'export function listRecentAuctionBidEvents',
  'LIMIT ?',
  'economy_asset_auction_events_no_update',
  'economy_asset_auction_events_no_delete',
]);
requireOrder('server/src/storage.js', ['migrateAssetAuctionWorld(world, now);', 'migrateFacilityGroupWorld(world, now);']);
requireText('server/src/storage.js', [
  "from './auction-audit-store.js'",
  'configureAuctionAuditStore(this);',
  'getAuctionBidHistory(user, auctionId, now = Date.now())',
  'listRecentAuctionBidEvents(this, auction.id, 10)',
]);
requireText('server/src/runtime-store-core.js', ['flushAuctionAuditEvents(this, world, revision, nextRevision);']);
requireText('server/src/world-storage-v2.js', ['AUTHORITATIVE_WORLD_VERSION = 32;']);
requireText('server/src/app.js', [
  'const auctionBidHistoryMatch = path.match',
  "method === 'GET' && auctionBidHistoryMatch",
  'history: store.getAuctionBidHistory',
]);
requireText('server/src/game-routes.js', [
  "path === '/api/game/auctions'",
  "action: 'createAuction'",
  "action: 'placeAuctionBid'",
  "action: 'cancelAuction'",
]);
requireText('server/src/state-partitions.js', ["const AUCTION_KEYS = new Set(['assetAuctions']);"]);
requireText('server/src/facility-groups.js', ['world.assetAuctions']);
forbidText('server/src/asset-auctions.js', ['warehouse-reservations.js', 'warehouseAvailableCapacity', 'warehouseReservedQuantity', 'warehouse_full']);

requireText('server/test/asset-auctions.test.js', [
  '发布费按较高计费基数计算并限制最低和最高金额',
  '发布资金不足时不扣费也不冻结资产',
  '未达隐藏保留价时退回最高报价和资产但不退发布费',
  '结束前两分钟出价自动延时且累计不超过三十分钟',
  '客户端拍卖字段白名单不暴露竞买 ID、姓名或出价数组',
]);
requireText('server/test/auction-fees-audit.test.js', [
  '发布费、出价和匿名最近十条在同一 SQLite 事务中审计',
  '发布幂等重试不会重复扣费或重复冻结资产',
]);

requireText('src/auctions/types.ts', [
  'export interface AuctionBidHistory',
  'highestBidderLabel: string | null;',
  'bidCount: number;',
  'latestBidAt: number | null;',
  'reserveMet: boolean;',
  'isOutbid?: boolean;',
]);
forbidText('src/auctions/types.ts', ['bidderId:', 'bidderName:', 'highestBidderId:', 'highestBidderName:', 'bids: AuctionBid[]']);
requireText('src/api/game.ts', [
  'export async function getAuctionBidHistory',
  'const payload = await request<{ history: AuctionBidHistory }>(',
  '`/auctions/${encodeURIComponent(auctionId)}/bids`,',
  'createAuction: (items: AuctionItem[], startingBid: number, reservePrice: number | null, durationHours: number)',
  "postAction('/auctions', { items, startingBid, reservePrice, durationHours })",
]);
requireText('src/pages/AuctionPage.tsx', [
  "import { SafeTooltip } from '../components/ui/SafeTooltip';",
  "const [reserveEnabled, setReserveEnabled] = useState(false);",
  'function auctionItemTooltipText(item: AuctionItemSummary)',
  'return `${item.name} ×${formatNumber(item.quantity)}`;',
  'calculateListingFee(parsedStartingBid, parsedReservePrice)',
  'calculateMinimumIncrement(parsedStartingBid)',
  '支付 ${formatCurrency(listingFeePreview)} 并发布',
  '结束前 2min 内有效出价会自动延时',
  '查看最近 10 条',
  '仅显示最近 10 条，共',
  'getAuctionBidHistory(auction.id)',
  'aria-expanded={expanded}',
  'asset-auction-workspace',
  'auctionAttentionPriority',
  '被超价',
  '新增',
  'className="asset-auction-bundle-tile"',
  'aria-label={auctionItemTooltipText(item)}',
  'className="asset-auction-item-tooltip-anchor asset-auction-item-tooltip-anchor--summary"',
  'content={tooltipText}',
  'tabIndex={0}',
  'data-ui-interactive="surface"',
]);
forbidText('src/pages/AuctionPage.tsx', [
  'highestBidderName',
  'highestBidderId',
  'bidderName',
  'bidderId',
  'closedAuctions',
  '最近结束',
  'title={`${item.name} ×${formatNumber(item.quantity)}`}',
  'asset-auction-item-tooltip-anchor--main',
]);
requireText('src/styles/asset-auctions.css', [
  '.asset-bid-form {',
  'grid-template-columns: minmax(0, 1fr) auto;',
  '.asset-bid-form .ui-button { width: auto; white-space: nowrap; }',
]);
requireText('src/styles/auction-card-layers.css', [
  '.asset-auction-item-tooltip-anchor {',
  'aspect-ratio: 1;',
  'align-items: stretch;',
  '.asset-auction-item-tooltip-anchor > .asset-auction-summary-icon {',
  '.asset-auction-summary-icon {',
  '--ui-interactive-active-transform: none;',
  '.asset-auction-bundle-tile {',
  'box-sizing: border-box;',
  'max-width: 256px;',
  'max-height: 256px;',
  'justify-self: center;',
  '.asset-auction-bundle-tile > .facility-icon.game-icon,',
  '.asset-auction-summary-icon > .facility-icon.game-icon {',
  'width: 100%;',
  'height: 100%;',
  'border-radius: 0;',
]);
forbidText('src/styles/auction-card-layers.css', [
  '.asset-auction-item-tooltip-anchor--main',
  '.asset-auction-item-tooltip-anchor > .asset-auction-bundle-tile,',
]);
requireText('tests/browser/auction-bid-history.spec.ts', [
  'auction bid history is collapsed, lazy, anonymous, and capped at ten rows',
  "toHaveCount(10)",
  'auction facility artwork fills the main and summary slots within a 256px tile',
  "icon.setAttribute('data-facility-icon', 'machine-factory');",
  'toBeLessThanOrEqual(256.5)',
  "expect(mainGeometry.backgroundSize).toBe('cover');",
  "expect(summaryGeometry.backgroundSize).toBe('cover');",
  'auction asset matrix tiles show name and quantity while the main visual remains static',
  'await expect(tooltip).toHaveCount(0);',
  "expect(await mainTile.getAttribute('tabindex')).toBeNull();",
  "node.closest('.safe-tooltip-anchor') === null",
  "await expect(tooltip).toHaveText('机械 ×5');",
  "expect(await summaryTile.getAttribute('title')).toBeNull();",
  "toHaveCount(1)",
  "page.locator('.asset-auction-summary-placeholder')",
]);
requireText('tests/browser/auction-bid-layout.spec.ts', [
  'auction bundle bid input and submit stay on one row',
  "{ name: 'desktop', width: 1280, height: 900 }",
  "{ name: 'mobile', width: 390, height: 844 }",
  "expect(geometry.display).toBe('grid');",
  'expect(geometry.verticalOverlap).toBeGreaterThan(0);',
  'expect(Math.abs(geometry.inputBottom - geometry.buttonBottom)).toBeLessThan(1);',
  'expect(geometry.inputRight).toBeLessThanOrEqual(geometry.buttonLeft);',
]);

requireText('.github/workflows/deploy.yml', [
  'backup before storage V2 migration',
  'backup-world --target-storage-schema-version 2',
  'Verify production host before publishing entry',
  'scripts/verify-production-deployment.sh',
]);
requireText('scripts/verify-production-deployment.sh', [
  'database-incremental',
  'ECONOMY_DATABASE_INCREMENTAL_VERIFIED',
]);
requireText('docs/README.md', ['客户端状态版本：40', '世界状态版本：32']);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '发布费计费基数为 `max(起拍价, 保留价)`',
  '卖方成交手续费为成交总价的精确 1%',
  '结束前 2 分钟出现有效最高出价',
  '最近 10 条匿名有效出价',
  '旧快照兼容结果',
]);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '发布费、最低加价、卖方 1% 成交手续费',
  '出价记录默认折叠',
  '固定只返回最近 10 条匿名记录',
  '被超价',
  '本次访问新增集合',
  '不得渲染最近结束或历史结算区域',
  '整包出价输入框与“提交出价／提高出价”按钮在桌面和移动宽度都必须保持同一横向操作行',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['`auction-audit-store.js`', '`economy_asset_auction_events`', 'GET | `/api/game/auctions/:auctionId/bids`']);
requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['工厂资产不得重新进入商品即时市场；工厂所有权转移继续只通过拍卖完成']);
requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['未达保留价']);
requireText('docs/UI_DESIGN_SYSTEM.md', [
  '出价历史使用原生按钮',
  '`aria-expanded`',
  '主视觉格子外边界不得超过 `256 × 256px`',
  '资产矩阵的非空格子必须复用 `SafeTooltip`',
  '格式固定为“名称 ×数量”',
  '主视觉只作静态展示',
]);
requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['拍卖服务费用与货币流', '世界级拍卖费用托管']);

for (const path of filesUnder('src')) {
  const source = read(path);
  for (const forbidden of ['collectible', 'Collectible', '藏品', 'artic.edu']) {
    if (source.includes(forbidden)) failures.push(`${relative(root, absolute(path))} 不得保留已删除艺术资产客户端实现: ${forbidden}`);
  }
}

if (failures.length) {
  console.error(`商品／工厂资产拍卖验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('资产包拍卖发布费、卖方手续费、保留价、最低加价、自动延时、匿名竞价、最近十条按需历史、整包出价同行操作、工厂插画铺满与 256px 主视觉上限、主视觉静态展示与资产矩阵名称数量安全悬浮、SQLite 审计、旧快照兼容、原子托管及订单簿隔离验证通过。');
