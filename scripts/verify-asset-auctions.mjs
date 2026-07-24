import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const root = process.cwd();
const failures = [];
const absolute = (path) => resolve(root, path);
const read = (path) => readFileSync(absolute(path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(absolute(path))) failures.push(`缺少文件: ${path}`);
};
const forbidFile = (path) => {
  if (existsSync(absolute(path))) failures.push(`永久删除的文件不得恢复: ${path}`);
};
const requireText = (path, fragments) => {
  const source = read(path);
  for (const fragment of fragments) {
    if (!source.includes(fragment)) failures.push(`${path} 缺少资产拍卖规则: ${fragment}`);
  }
};
const forbidText = (path, fragments) => {
  const source = read(path);
  for (const fragment of fragments) {
    if (source.includes(fragment)) failures.push(`${path} 不得恢复旧拍卖规则: ${fragment}`);
  }
};
const requireOrder = (path, fragments) => {
  const source = read(path);
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    if (next === -1) {
      failures.push(`${path} 缺少顺序节点: ${fragment}`);
      return;
    }
    cursor = next;
  }
};
const filesUnder = (directory) => {
  const result = [];
  const visit = (path) => {
    for (const entry of readdirSync(absolute(path))) {
      const child = `${path}/${entry}`;
      if (statSync(absolute(child)).isDirectory()) visit(child);
      else result.push(child);
    }
  };
  visit(directory);
  return result;
};

[
  'server/src/asset-auctions.js',
  'server/src/facility-groups.js',
  'server/src/warehouse.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/src/game-routes.js',
  'server/src/state-partitions.js',
  'server/test/asset-auctions.test.js',
  'src/auctions/types.ts',
  'src/pages/AuctionPage.tsx',
  'src/api/game.ts',
  'src/styles/asset-auctions.css',
  'src/styles/auction-card-layers.css',
  '.github/workflows/deploy.yml',
  'README.md',
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
  'server/src/collectibles.js',
  'server/test/collectibles-auctions.test.js',
  'src/collectibles',
  'src/pages/CollectionsPage.tsx',
  'src/styles/collectibles-auctions.css',
  '.github/workflows/apply-remove-collectibles.yml',
  '.github/workflows/export-source-for-agent.yml',
  '.agent',
].forEach(forbidFile);

requireText('server/src/asset-auctions.js', [
  'const MAX_AUCTION_ITEMS = 20;',
  "if (raw?.assetKind === 'commodity' || raw?.assetKind === 'facility' || raw?.assetKind === 'collectible')",
  "return item && item.assetKind !== 'collectible' ? item : null;",
  'function isCurrentAssetAuctionWorld(world)',
  'export function migrateAssetAuctionWorld(world, now = Date.now())',
  'const legacyAuctions = Array.isArray(world.collectibleAuctions)',
  'const currentAuctions = Array.isArray(world.assetAuctions)',
  'if (items.some((item) => item.assetKind === \'collectible\'))',
  'releaseBid(world, auction);',
  "items.filter((item) => item.assetKind !== 'collectible')",
  'delete world.collectibles;',
  'delete world.collectibleOwnershipHistory;',
  'delete world.collectibleAuctions;',
  'world.version = 15;',
  'createWarehouseUsage(world, bidder).warehouseAvailableCapacity < requiredCommodityCapacity',
  "if (action === 'createAuction')",
  "if (action === 'placeAuctionBid')",
  "if (action === 'cancelAuction')",
  'export function createAssetAuctionClientState(world, userId, now = Date.now())',
  'assetAuctions: world.assetAuctions',
]);
forbidText('server/src/asset-auctions.js', [
  'market.lastPrice = auction.highestBid',
  'lastTradePrice = auction.highestBid',
  'recordFacilityPrice(world, auction',
  'priceHistory.push',
]);
requireOrder('server/src/storage.js', [
  'migrateAssetAuctionWorld(world, now);',
  'migrateFacilityGroupWorld(world, now);',
]);
requireText('server/src/storage.js', [
  "from './asset-auctions.js'",
  "const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);",
  '...createAssetAuctionClientState(world, userId, now)',
  'gameResult = applyAssetAuctionAction(world, user, action, payload, now);',
]);
requireText('server/src/game-routes.js', [
  "path === '/api/game/auctions'",
  "action: 'createAuction'",
  "action: 'placeAuctionBid'",
  "action: 'cancelAuction'",
]);
requireText('server/src/state-partitions.js', [
  "const AUCTION_KEYS = new Set(['assetAuctions']);",
]);
requireText('server/src/warehouse.js', ['world?.assetAuctions']);
requireText('server/src/facility-groups.js', ['world.assetAuctions']);
requireText('server/src/app.js', [
  "path.startsWith('/api/game/admin/collectibles')",
  "sendError(response, 410, '藏品管理接口已永久移除')",
  "path === '/api/game/collectible-auctions'",
  "sendError(response, 410, '藏品拍卖接口已永久移除，请使用通用资产拍卖接口')",
]);

requireText('server/test/asset-auctions.test.js', [
  '商品拍卖冻结商品、为最高出价者预占仓库并在成交后转移数量',
  '商品竞拍必须有足够仓库容量，取消无出价拍卖释放商品',
  '工厂拍卖冻结运行数量，成交后转移工厂且不写入工厂行情',
  '商品与工厂资产包整体冻结并原子成交',
  '客户端只返回商品与工厂通用资产拍卖',
  '世界 15 迁移保留纯资产拍卖并整包取消含藏品的开放拍卖',
  '世界 15 迁移按稳定 ID 去重并优先保留 assetAuctions 记录',
  "assert.deepEqual(state, once, '迁移重复执行不得再次退款或改变拍卖');",
]);

requireText('src/auctions/types.ts', [
  "export type AuctionAssetKind = 'commodity' | 'facility';",
  'assetAuctions: AssetAuction[];',
  'assetAuctions: Array.isArray(state.assetAuctions) ? state.assetAuctions : [],',
]);
forbidText('src/auctions/types.ts', ['collectible', 'Collectible', 'collections']);
requireText('src/api/game.ts', [
  "import type { AuctionItem } from '../auctions/types';",
  "postAction('/auctions', { items, startingBid, durationHours })",
  'placeAuctionBid:',
  'cancelAuction:',
]);
requireText('src/pages/AuctionPage.tsx', [
  "const [assetKind, setAssetKind] = useState<AuctionAssetKind>('commodity');",
  "{(['commodity', 'facility'] as const).map((kind) => (",
  'aria-pressed={assetKind === kind}',
  '发布资产包拍卖',
  '加入资产包',
  'gameActions.createAuction(bundleItems, parsedStartingBid, parsedDurationHours)',
  'gameActions.placeAuctionBid(auction.id, amount)',
  'gameActions.cancelAuction(auction.id)',
  'function parseAuctionQuantity(value: string, maximum?: number)',
  "const [quantityInput, setQuantityInput] = useState('1')",
  'const [bundleQuantityDrafts, setBundleQuantityDrafts] = useState<Record<string, string>>({})',
  'onBlur={() => commitBundleQuantityDraft(item)}',
  'const placeholderCount = Math.max(0, MAX_AUCTION_ITEMS - items.length);',
  'className="asset-auction-icon-layer"',
  'className="asset-auction-summary-placeholder"',
  'label="整包起拍价"',
  '整包出价（最低',
]);
forbidText('src/pages/AuctionPage.tsx', [
  'collectible',
  'Collectible',
  '藏品',
  'artic.edu',
  'currentOwnerId',
  'const [quantity, setQuantity] = useState(1)',
  'setQuantity(Number(event.target.value))',
]);
requireText('src/styles/asset-auctions.css', [
  '.ui-segmented.asset-auction-kind-switch',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.asset-auction-builder',
  '.asset-auction-package-row',
]);
requireText('src/styles/auction-card-layers.css', [
  '.asset-auction-icon-layer',
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  '.asset-auction-summary-quantity',
  '.asset-auction-summary-placeholder',
  '.asset-auction-data-layer',
]);
forbidText('src/styles/auction-card-layers.css', ['overflow-x: auto;', '.asset-auction-summary-more']);

requireText('.github/workflows/deploy.yml', [
  'Back up production database before world 15 migration',
  'sqlite3.connect(database)',
  'source.backup(destination)',
  "destination.execute('PRAGMA quick_check')",
  "economy-pre-world-v{target_world_version}-{timestamp}.sqlite",
  "backup_dir.glob('economy-pre-world-v15-*.sqlite')",
  'for stale in backups[10:]:',
  'database-backup.log',
]);

requireText('README.md', [
  '客户端状态版本：`17`',
  '世界状态版本：`15`',
  '通过不可拆分资产包拍卖交易商品和工厂',
  '商品和工厂可单独或混合组成最多 20 项的不可拆分资产包公开竞价',
  '世界 15 迁移前备份',
]);
requireText('docs/README.md', [
  '九个正式页面、商品／工厂资产拍卖',
  '商品与工厂单项或捆绑资产包竞价',
  '世界 15 必须保留纯商品／工厂拍卖并整包取消含已删除资产的旧拍卖',
  '`scripts/verify-asset-auctions.mjs`',
]);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '商品和工厂使用同一公开竞价、最高出价冻结和服务器自动结算模型',
  '`assetKind` 只允许 `commodity` 或 `facility`',
  '任何包含旧 `collectible` 项目的开放资产包必须整包取消',
  '使用 Python `sqlite3.Connection.backup()`',
  '通过 `PRAGMA quick_check` 后才允许上传新服务',
  '旧 `/api/game/collectible-auctions*` 与 `/api/game/admin/collectibles*` 路径只返回 `410 Gone`',
]);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '玩家导航固定为九项',
  '玩家可以在商品／工厂分段选择器间切换并连续加入资产',
  '商品和工厂类型选择器必须固定为二等分单行布局',
  '资产包添加数量和资产包行数量必须把输入中的原始字符串作为编辑草稿',
  '五列四行、共 20 个槽位',
  '捆绑拍卖必须按资产包全部商品合计预占仓库',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '`asset-auctions.js`：商品／工厂单项与捆绑资产拍卖',
  '世界 15 的资产拍卖迁移由 `asset-auctions.js` 在工厂集群规范化之前执行',
  '部署世界 15 前，`.github/workflows/deploy.yml` 必须在上传新服务前使用 Python `sqlite3.Connection.backup()`',
  '`economy-pre-world-v15-<UTC 时间>.sqlite`',
  '`410 Gone`',
]);
for (const [path, fragments] of [
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['冻结只改变可用性，不改变所有权', '托管记录不得作为第二份资产余额重复累加']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['拍卖与订单簿隔离', '拍卖成交不属于订单簿成交']],
  ['docs/WAREHOUSE_EXPANSION_DESIGN.md', ['资产包', '全部商品数量']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['工厂订单与拍卖冻结', '整包任一项目异常时不得部分转移工厂']],
  ['docs/UI_DESIGN_SYSTEM.md', ['拍卖页只允许商品和工厂', '商品必须使用 `ProductIcon`', '工厂必须使用 `FactoryIcon`']],
]) requireText(path, fragments);

for (const path of filesUnder('src')) {
  const source = read(path);
  for (const forbidden of ['collectible', 'Collectible', '藏品', 'artic.edu']) {
    if (source.includes(forbidden)) failures.push(`${relative(root, absolute(path))} 不得保留已删除艺术资产客户端实现: ${forbidden}`);
  }
}

const activeServerFiles = filesUnder('server/src').filter((path) => ![
  'server/src/asset-auctions.js',
  'server/src/app.js',
].includes(path));
for (const path of activeServerFiles) {
  const source = read(path);
  for (const forbidden of ['collectibleAuctions', 'collectibleOwnershipHistory', 'world.collectibles']) {
    if (source.includes(forbidden)) failures.push(`${path} 不得在活动服务器模块恢复旧艺术资产状态: ${forbidden}`);
  }
}

if (failures.length) {
  console.error(`商品／工厂资产拍卖验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('商品／工厂单项与捆绑资产拍卖、世界 15 整包取消迁移、数据库快照、410 墓碑、九页导航、数量草稿、冻结与仓库预占、原子结算及订单簿行情隔离验证通过。');
