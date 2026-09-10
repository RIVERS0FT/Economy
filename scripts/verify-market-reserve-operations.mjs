import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requiredFiles = [
  'server/src/market-reserve-operations.js',
  'server/src/market-liquidity.js',
  'server/src/balanced-market.js',
  'server/src/contracts.js',
  'server/src/daily-supply-contracts.js',
  'server/src/asset-auctions.js',
  'server/src/runtime-store.js',
  'server/src/runtime-store-core.js',
  'server/test/market-reserve-operations.test.js',
  'src/contracts/ContractNegotiationSection.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of requiredFiles) if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
for (const text of [
  'MARKET_RESERVE_OPERATION_RULE_VERSION = 2',
  'RESERVE_CONTRACT_ENTRY_RATIO = 0.65',
  'RESERVE_CONTRACT_ENTRY_CYCLES = 2',
  'RESERVE_AUCTION_ENTRY_RATIO = 1.60',
  'RESERVE_AUCTION_ENTRY_CYCLES = 3',
  'createMarketReserveDailyProcurementContract',
  'retireOpenLegacyReserveContracts',
  "contract?.supplyMode === 'daily'",
  'createMarketReserveAuction',
]) requireText('server/src/market-reserve-operations.js', text);
const reserveOperations = read('server/src/market-reserve-operations.js');
for (const retired of ['createMarketReserveProcurementContract', 'CONTRACT_DELIVERY_INTERVAL_MS', 'CONTRACT_FIRST_DELIVERY_DELAY_MS']) {
  if (reserveOperations.includes(retired)) failures.push(`server/src/market-reserve-operations.js 不得恢复旧批次储备发布路径: ${retired}`);
}
for (const text of ['liquidity-emergency-sell', 'referencePrice * (1.25 + 0.35 * shortageRate)', 'Math.ceil(reserve.targetInventory * 0.05)']) requireText('server/src/market-liquidity.js', text);
requireText('server/src/market-demand/catalog.js', 'LIQUIDITY_EMERGENCY_SIGNAL_WEIGHT = 0.25');
for (const text of [
  'createMarketReserveDailyProcurementContract',
  "publisherType:'market_reserve'",
  "supplyMode:'daily'",
  'marketReserveGroupFor',
  'buyerAccountFor',
  'marketReserveProductFor',
  '市场储备每日额度采购合同已签订并进入履约',
]) requireText('server/src/daily-supply-contracts.js', text);
for (const text of ["sellerType: 'market_reserve'", 'market-reserve-auction-', 'group.credits = addMoney(group.credits, net)']) requireText('server/src/asset-auctions.js', text);
const runtimeStore = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
if (!runtimeStore.includes('processMarketReserveOperations(world, now)')) failures.push('运行时存储缺少: processMarketReserveOperations(world, now)');
for (const text of ['isMarketReserveContract', 'market_reserve_contract_escrow', 'market_reserve_contract_bond', 'market_reserve_inventory', "publisherType: contract.publisherType === 'market_reserve'"]) requireText('server/src/contract-audit-store.js', text);
for (const path of ['server/src/contracts.js', 'server/src/daily-supply-contracts.js', 'server/src/asset-auctions.js', 'server/src/market-reserve-operations.js']) {
  const source = read(path);
  if (source.includes("world.players['0']") || source.includes('world.players[\"0\"]')) failures.push(`${path} 不得创建伪市场储备玩家`);
}
requireText('src/contracts/ContractNegotiationSection.tsx', "contract.supplyMode !== 'daily' || contract.fixedTerms");
for (const text of ['紧急储备卖单', '市场储备采购合同', '储备清仓拍卖', '新发布统一使用每日额度合同', '旧版公开储备采购合同']) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
for (const text of ['市场储备新发布的采购合同', 'createMarketReserveDailyProcurementContract', '规则切换前已经进入履约的市场储备旧合同']) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('market reserve daily contract verification passed');
