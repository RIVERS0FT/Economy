import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  floorPlayerMoney,
  normalizePlayerMoneyInput,
  normalizeWorldMoneyPrecision,
  roundInternalMoney,
} from '../server/src/money.js';
import { calculateCumulativeMarketSellFee } from '../server/src/market-sell-fee.js';
import { parseMoneyDraft } from '../src/utils/moneyDraft.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

assert.equal(floorPlayerMoney(9.996), 9.99);
assert.equal(floorPlayerMoney(-9.996), -10);
assert.equal(normalizePlayerMoneyInput('12.345678'), 12.34);
assert.equal(normalizePlayerMoneyInput('0.009'), null);
assert.equal(roundInternalMoney(0.1234567), 0.123457);
assert.equal(calculateCumulativeMarketSellFee(9.99), 0.0999);
assert.equal(parseMoneyDraft('9.996'), 9.99);
assert.equal(parseMoneyDraft('-9.996'), -10);

const world = {
  players: { 1: { credits: 9.996, frozenCredits: 0, gems: 3.7, stats: {}, ledger: [], trades: [] } },
  orders: [], markets: {}, facilityMarkets: {}, assetAuctions: [], productionContracts: [], bank: {},
};
normalizeWorldMoneyPrecision(world);
assert.equal(world.players[1].credits, 9.99);
assert.equal(world.players[1].gems, 3);
assert.equal(world.moneyPrecision.roundingReserveMicros, 6000);

const formatter = read('src/utils/formatters.ts');
assert.match(formatter, /minimumFractionDigits:\s*2/);
assert.match(formatter, /maximumFractionDigits:\s*2/);
assert.doesNotMatch(formatter, /formatCurrency[\s\S]{0,120}formatNumber/);

const formControls = read('src/components/ui/FormControls.tsx');
assert.match(formControls, /export function MoneyInput/);
assert.match(formControls, /inputMode="decimal"/);
assert.match(formControls, /normalizeMoneyDraft/);

for (const path of ['src/pages/MarketPage.tsx', 'src/pages/BankPage.tsx', 'src/pages/AuctionPage.tsx', 'src/pages/ContractPage.tsx']) {
  assert.match(read(path), /MoneyInput/);
}
assert.doesNotMatch(read('src/pages/MarketPage.tsx'), /parseIntegerDraft\(priceDraft/);
assert.doesNotMatch(read('src/pages/AuctionPage.tsx'), /parseIntegerDraft\(startingBidInput/);
assert.doesNotMatch(read('src/pages/ContractPage.tsx'), /parseIntegerDraft\(unitPriceInput/);

assert.match(read('server/shared/economy-state-version.js'), /CURRENT_CLIENT_STATE_VERSION = 22/);
assert.match(read('server/shared/economy-state-version.js'), /MIN_COMPATIBLE_CLIENT_STATE_VERSION = 22/);
assert.match(read('server/src/market-demand/catalog.js'), /MARKET_DEMAND_MODEL_VERSION = 11/);
assert.match(read('server/src/storage.js'), /normalizeWorldMoneyPrecision/);
assert.match(read('server/src/storage.js'), /world\.version = 18/);
assert.match(read('server/src/banking.js'), /BANKING_VERSION = 2/);
assert.match(read('server/src/contracts.js'), /PRODUCTION_CONTRACT_SCHEMA_VERSION = 3/);
assert.match(read('server/src/population-economy.js'), /POPULATION_ECONOMY_VERSION = 5/);
assert.match(read('server/src/market-sell-fee.js'), /MARKET_SELL_FEE_VERSION = 3/);

const storage = read('server/src/storage.js');
assert.match(storage, /amount INTEGER NOT NULL/);
assert.match(storage, /gems_spent INTEGER NOT NULL/);
assert.match(read('README.md'), /9\.996 → 9\.99/);
assert.match(read('README.md'), /-9\.996 → -10\.00/);
assert.match(read('docs/README.md'), /普通货币精度与玩家结算属于跨模块强制规则/);

console.log('Money precision verification passed.');
