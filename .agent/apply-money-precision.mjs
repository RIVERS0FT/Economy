import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const encoded = [0, 1, 2, 3]
  .map((index) => readFileSync(`.agent/chunk-${String(index).padStart(2, '0')}.txt`, 'utf8').trim())
  .join('');
let source = gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8');
source = source.replace("import { parseMoneyDraft } from './moneyDraft';\n\n", '');
source = source.replace(
  '  const normalized = parseMoneyDraft(String(value)) ?? 0;',
  "  const scaled = value * 100;\n  const tolerance = Number.EPSILON * Math.max(1, Math.abs(scaled)) * 8;\n  const normalized = Number.isFinite(value) ? Math.floor(scaled + tolerance) / 100 : 0;",
);
source = source.replace(
  "return seconds > 0 ? \\`\\${minutes}m \\${seconds}s\\` : \\`\\${minutes}m\\`;",
  "return seconds > 0 ? \\`\\${minutes}m \\${seconds.toString().padStart(2, '0')}s\\` : \\`\\${minutes}m\\`;",
);
const auctionAnchor = `replace('src/pages/AuctionPage.tsx',
  "min={1}\\n             max={1_000_000_000}\\n             error={parsedStartingBid === null ? '请输入 1～1000000000 的整数。' : undefined}",
  "min={0.01}\\n             max={1_000_000_000}\\n             error={parsedStartingBid === null ? '请输入不低于 0.01 的金额；超过两位小数会向下截断。' : undefined}");`;
const auctionReplacement = `replaceRegex('src/pages/AuctionPage.tsx',
  /min=\\{1\\}\\n(\\s+)max=\\{1_000_000_000\\}\\n\\1error=\\{parsedStartingBid === null \\? '请输入 1～1000000000 的整数。' : undefined\\}/,
  "min={0.01}\\n$1max={1_000_000_000}\\n$1error={parsedStartingBid === null ? '请输入不低于 0.01 的金额；超过两位小数会向下截断。' : undefined}");`;
if (!source.includes(auctionAnchor)) throw new Error('Auction patch anchor missing from generated source');
source = source.replace(auctionAnchor, auctionReplacement);
const cleanupAnchor = '// Remove temporary workflow and patch source from the resulting commit.';
const metadataCleanup = [
  "replaceAll('README.md', '客户端状态版本：`19`', '客户端状态版本：`20`');",
  "replaceAll('README.md', '世界状态版本：`16`', '世界状态版本：`17`');",
  "replaceAll('README.md', '市场需求模型版本：`10`', '市场需求模型版本：`11`');",
  "replaceAll('README.md', '市场需求模型 10', '市场需求模型 11');",
  "replaceAll('README.md', '模型 10', '模型 11');",
  "replaceAll('src/utils/defaultOrderPrice.ts', 'Number.isFinite(price) && Number.isInteger(price) && price >= 1', 'Number.isFinite(price) && price >= 0.01 && Math.abs(price * 100 - Math.round(price * 100)) < 1e-8');",
  "replaceAll('.github/workflows/deploy.yml', 'Back up production database before world 16 migration', 'Back up production database before world 17 migration');",
  "replaceAll('.github/workflows/deploy.yml', 'target_world_version = 16', 'target_world_version = 17');",
  "replaceAll('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '市场需求模型版本：10', '市场需求模型版本：11');",
  "replaceAll('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '模型 10', '模型 11');",
  "replaceAll('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '市场需求模型版本：10', '市场需求模型版本：11');",
  "replaceAll('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', '模型 10', '模型 11');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '当前客户端只接受版本 19', '当前客户端只接受版本 20');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '世界版本 16', '世界版本 17');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '客户端状态版本 19', '客户端状态版本 20');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '人口经济内部版本固定为 4', '人口经济内部版本固定为 5');",
  "replaceAll('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '市场需求模型 10', '市场需求模型 11');",
  "replaceAll('scripts/verify-banking.mjs', '世界版本 16', '世界版本 17');",
  "replaceAll('scripts/verify-banking.mjs', '客户端状态版本 19', '客户端状态版本 20');",
  "replaceAll('scripts/verify-banking.mjs', 'version: 19', 'version: 20');",
  "replaceAll('scripts/verify-daily-check-in.mjs', 'const staleVersion = String(17);', 'const staleVersion = String(19);');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'MARKET_DEMAND_MODEL_VERSION, 10', 'MARKET_DEMAND_MODEL_VERSION, 11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'MARKET_DEMAND_MODEL_VERSION = 10', 'MARKET_DEMAND_MODEL_VERSION = 11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'POPULATION_ECONOMY_VERSION = 4', 'POPULATION_ECONOMY_VERSION = 5');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', 'world.version = 16', 'world.version = 17');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '市场需求模型版本：`10`', '市场需求模型版本：`11`');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '市场需求模型版本：10', '市场需求模型版本：11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '人口经济内部版本固定为 4', '人口经济内部版本固定为 5');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '市场需求模型 10', '市场需求模型 11');",
  "replaceAll('scripts/verify-staple-crops-demand.mjs', '模型 10 使用真实人口钱包', '模型 11 使用真实人口钱包');",
  "replaceAll('scripts/verify-market-assets.mjs', 'world.version = 16', 'world.version = 17');",
  "replaceAll('scripts/verify-market-assets.mjs', 'Number.isFinite(price) && Number.isInteger(price) && price >= 1', 'Number.isFinite(price) && price >= 0.01 && Math.abs(price * 100 - Math.round(price * 100)) < 1e-8');",
  "replaceAll('scripts/verify-market-sell-fee.mjs', 'Math.floor(normalizedGross * MARKET_SELL_FEE_RATE_BPS / BASIS_POINTS)', 'MARKET_SELL_FEE_VERSION = 3');",
  "replaceAll('scripts/verify-facility-groups.mjs', 'world.version = 16', 'world.version = 17');",
  "replaceAll('scripts/verify-asset-auctions.mjs', 'world.version = 16;', 'world.version = 17;');",
  "replaceAll('scripts/verify-asset-auctions.mjs', 'Back up production database before world 16 migration', 'Back up production database before world 17 migration');",
  "replaceAll('scripts/verify-asset-auctions.mjs', '客户端状态版本：`19`', '客户端状态版本：`20`');",
  "replaceAll('scripts/verify-asset-auctions.mjs', '世界状态版本：`16`', '世界状态版本：`17`');",

  "replaceAll('server/test/all-products-demand.test.js', 'model 10', 'model 11');",
  "replaceAll('server/test/all-products-demand.test.js', 'MODEL_VERSION, 10', 'MODEL_VERSION, 11');",
  "replaceAll('server/test/all-products-demand.test.js', 'modelVersion, 10', 'modelVersion, 11');",
  "replaceAll('server/test/asset-auctions.test.js', 'assert.equal(state.version, 16);', 'assert.equal(state.version, 17);');",
  "replaceAll('server/test/domain.test.js', 'assert.equal(persisted.version, 16);', 'assert.equal(persisted.version, 17);');",
  "replaceAll('server/test/market-action-latency.test.js', 'assert.equal(seller.credits, 10);', 'assert.equal(seller.credits, 9.9);');",
  "replaceAll('server/test/market-liquidity.test.js', 'model 10', 'model 11');",
  "replaceAll('server/test/market-liquidity.test.js', 'MARKET_DEMAND_MODEL_VERSION, 10', 'MARKET_DEMAND_MODEL_VERSION, 11');",
  "replaceAll('server/test/market-liquidity.test.js', 'modelVersion, 10', 'modelVersion, 11');",
  "replaceAll('server/test/market-liquidity.test.js', 'assert.equal(world.players[String(alice.id)].credits, 100 + buyOrder.price);', 'assert.equal(world.players[String(alice.id)].credits, 100.99);');",
  "replaceAll('server/test/money-precision.test.js', 'roundingReserveMicros, 25000', 'roundingReserveMicros, 24000');",
  "replaceAll('server/test/order-book-integrity.test.js', 'assert.equal(seller.credits, 110);', 'assert.equal(seller.credits, 109.9);');",
  "replaceAll('server/test/order-book-integrity.test.js', 'assert.equal(seller.stats.marketServiceFees, 0);', 'assert.equal(seller.stats.marketServiceFees, 0.1);');",
  "replaceAll('server/test/order-matching.test.js', 'assert.equal(priceTenOlder.fills[0].fee, 0);', 'assert.equal(priceTenOlder.fills[0].fee, 0.1);');",
  "replaceAll('server/test/population-admin-control.test.js', 'version 4', 'version 5');",
  "replaceAll('server/test/population-admin-control.test.js', 'state.modelVersion, 4', 'state.modelVersion, 5');",
  "replaceAll('server/test/population-economy.test.js', \"import { createWorld } from '../src/domain.js';\", \"import { createWorld } from '../src/domain.js';\\nimport { roundInternalMoney } from '../src/money.js';\");",
  "replaceAll('server/test/population-economy.test.js', 'assert.equal(normal.foodBudget, Math.floor(normalBase * 0.78) + Math.floor((normal.lastBudget - normalBase) * 0.78));', 'assert.equal(normal.foodBudget, roundInternalMoney(normal.lastBudget * 0.78));');",
  "replaceAll('server/test/population-economy.test.js', 'assert.equal(lavish.foodBudget, Math.floor(lavishBase * 0.65) + Math.floor((lavish.lastBudget - lavishBase) * 0.65));', 'assert.equal(lavish.foodBudget, roundInternalMoney(lavish.lastBudget * 0.65));');",
  "replaceAll('server/test/population-economy.test.js', 'state.modelVersion, 4', 'state.modelVersion, 5');",
  "replaceAll('server/test/population-economy.test.js', 'version 3 cautious state migrates to strained', 'version 3 cautious state migrates to version 5 strained');",
  "replaceAll('server/test/banking.test.js', 'world.bank.interestPoolMicros, 2_000_000', 'world.bank.interestPoolMicros, 2_100_000');",
  "replaceAll('server/test/banking.test.js', 'world.populationEconomy.stats.bankingIncome, 1', 'world.populationEconomy.stats.bankingIncome, 0.6');",
  "replaceAll('server/test/banking.test.js', 'world.bank.interestPoolMicros, 1_000_000', 'world.bank.interestPoolMicros, 1_100_000');",
  "replaceAll('server/test/banking.test.js', 'deposit interest carry preserves fractional entitlement until it becomes a whole credit', 'deposit interest pays cent-level fractional credits without hidden player carry');",
  "replaceAll('server/test/banking.test.js', 'assert.equal(account.depositCredits, 200);\\n  assert.equal(account.depositInterestCarryMicros, 500_000);', 'assert.equal(account.depositCredits, 200.5);\\n  assert.equal(account.depositInterestCarryMicros, 0);');",

  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(calculateCumulativeMarketSellFee(1), 0);', 'assert.equal(calculateCumulativeMarketSellFee(1), 0.01);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(calculateCumulativeMarketSellFee(101), 1);', 'assert.equal(calculateCumulativeMarketSellFee(101), 1.01);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.deepEqual(next, { fee: 0, netTotal: 1 });', 'assert.deepEqual(next, { fee: 0.01, netTotal: 0.99 });');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(order.marketSellFeeCharged, 0);', 'assert.equal(order.marketSellFeeCharged, 0.01);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.deepEqual(order.fills.map((fill) => fill.fee), [0, 0, 1, 0]);', 'assert.deepEqual(order.fills.map((fill) => fill.fee), [0.3, 0.3, 0.4, 0.01]);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.deepEqual(order.fills.map((fill) => fill.netTotal), [30, 30, 39, 1]);', 'assert.deepEqual(order.fills.map((fill) => fill.netTotal), [29.7, 29.7, 39.6, 0.99]);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(order.marketSellFeeCharged, 1);', 'assert.equal(order.marketSellFeeCharged, 1.01);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(seller.credits, 100);', 'assert.equal(seller.credits, 99.99);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(seller.stats.marketServiceFees, 1);', 'assert.equal(seller.stats.marketServiceFees, 1.01);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(seller.stats.employmentPayments, 1);', 'assert.equal(seller.stats.employmentPayments, 1.01);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(seller.credits, 159);', 'assert.equal(seller.credits, 158.4);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(internal.fills[0].fee, 1);', 'assert.equal(internal.fills[0].fee, 1.6);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(internal.fills[0].netTotal, 159);', 'assert.equal(internal.fills[0].netTotal, 158.4);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(publicOrder.fills[0].fee, 1);', 'assert.equal(publicOrder.fills[0].fee, 1.6);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(publicOrder.fills[0].netTotal, 159);', 'assert.equal(publicOrder.fills[0].netTotal, 158.4);');",
  "replaceAll('server/test/market-sell-fee.test.js', 'assert.equal(seller.credits, 158.4);\\n  assert.equal(seller.stats.systemSinks, 0);\\n  assert.equal(seller.stats.marketServiceFees, 1.01);', 'assert.equal(seller.credits, 158.4);\\n  assert.equal(seller.stats.systemSinks, 0);\\n  assert.equal(seller.stats.marketServiceFees, 1.6);');",

  "replaceAll('scripts/verify-document-authority.mjs', \"'世界状态版本：`16`'\", \"'世界状态版本：`17`'\");",
  "replaceAll('scripts/verify-document-authority.mjs', \"'市场需求模型版本：`10`'\", \"'市场需求模型版本：`11`'\");",
  "replaceAll('scripts/verify-document-authority.mjs', \"content.includes('世界状态版本：16')\", \"content.includes('世界状态版本：17')\");",
  "replaceAll('scripts/verify-document-authority.mjs', '世界状态版本必须为 16', '世界状态版本必须为 17');",
  "replaceAll('scripts/verify-document-authority.mjs', '/16、市场需求模型 10', '/17、市场需求模型 11');",
  "for (const relative of walk('docs', (name) => name.endsWith('.md'))) {",
  "  replaceRegex(relative, /^(> (?:客户端状态版本|世界状态版本|市场需求模型版本)：(?:20|17|11))[ \\t]+$/gm, '$1', { required: false });",
  "}",
  "",
].join('\n');
if (!source.includes(cleanupAnchor)) throw new Error('Cleanup anchor missing from generated source');
source = source.replace(cleanupAnchor, `${metadataCleanup}\n${cleanupAnchor}`);
const generated = '.agent/generated-money-patch.mjs';
writeFileSync(generated, source);
await import(pathToFileURL(generated).href);
