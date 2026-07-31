import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import {
  calculateRateMoney,
  floorPlayerMoney,
  internalMoneyToMicros,
  multiplyMoneyByInteger,
  normalizePlayerMoneyInput,
  normalizeWorldMoneyPrecision,
  roundInternalMoney,
} from '../server/src/money.js';
import { calculateCumulativeMarketSellFee } from '../server/src/market-sell-fee.js';
import { formatCurrency } from '../src/utils/formatters.ts';
import { parseMoneyDraft } from '../src/utils/moneyDraft.ts';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

assert.equal(floorPlayerMoney(9.996), 9.99);
assert.equal(normalizePlayerMoneyInput('12.34'), 12.34);
assert.equal(normalizePlayerMoneyInput('12.340'), null);
assert.equal(normalizePlayerMoneyInput('12.345678'), null);
assert.equal(roundInternalMoney(0.1234567), 0.123457);
assert.equal(internalMoneyToMicros(0.123456), 123456n);
assert.equal(multiplyMoneyByInteger(9.99, 3), 29.97);
assert.equal(calculateRateMoney(9.99, 100, 10_000), 0.0999);
assert.equal(calculateCumulativeMarketSellFee(9.99), 0.0999);
assert.equal(parseMoneyDraft('9.99'), 9.99);
assert.equal(parseMoneyDraft('9.996'), null);
assert.equal(formatCurrency(9.996), '10.00');
assert.equal(formatCurrency(0.000001), '<0.01');

const world = {
  players: { 1: { credits: 9.9960014, frozenCredits: 0, gems: 3.7, stats: {}, ledger: [], trades: [] } },
  orders: [], markets: {}, facilityMarkets: {}, assetAuctions: [], productionContracts: [], bank: {},
};
normalizeWorldMoneyPrecision(world);
assert.equal(world.players[1].credits, 9.996001);
assert.equal(world.players[1].gems, 3);
assert.equal(world.moneyPrecision.version, 3);
assert.equal(world.moneyPrecision.roundingReserveMicros, 0);

const money = read('server/src/money.js');
assert.match(money, /MONEY_SCALE = 1_000_000/);
assert.match(money, /ORDER_PRICE_TICK_MICROS = 10_000/);
assert.match(money, /exactOrderPriceMicros/);
assert.match(money, /multiplyMoneyRatio/);
assert.doesNotMatch(money, /PLAYER_MONEY_SCALE|INTERNAL_MONEY_SCALE|addRoundingReserve/);

const formatter = read('src/utils/formatters.ts');
assert.match(formatter, /minimumFractionDigits:\s*2/);
assert.match(formatter, /maximumFractionDigits:\s*2/);
assert.match(formatter, /formatExactCurrency/);
assert.match(formatter, /'<0\.01'/);

const formControls = read('src/components/ui/FormControls.tsx');
assert.match(formControls, /export function MoneyInput/);
assert.match(formControls, /inputMode="decimal"/);
assert.match(formControls, /normalizeMoneyDraft/);

for (const path of ['src/pages/MarketPage.tsx', 'src/pages/BankPage.tsx', 'src/pages/AuctionPage.tsx', 'src/pages/ContractPage.tsx']) {
  assert.match(read(path), /MoneyInput/);
}

assert.match(read('server/shared/economy-state-version.js'), /CURRENT_CLIENT_STATE_VERSION = 24/);
assert.match(read('server/shared/economy-state-version.js'), /MIN_COMPATIBLE_CLIENT_STATE_VERSION = 24/);
assert.match(read('server/src/market-demand/catalog.js'), /MARKET_DEMAND_MODEL_VERSION = 12/);
assert.match(read('server/src/storage.js'), /normalizeWorldMoneyPrecision/);
assert.match(read('server/src/storage.js'), /world\.version = 21/);
assert.match(read('server/src/population-economy.js'), /POPULATION_ECONOMY_VERSION = 6/);
assert.match(read('server/src/market-sell-fee.js'), /MARKET_SELL_FEE_VERSION = 4/);

const banking = read('server/src/banking.js');
assert.match(banking, /BANKING_VERSION = 3/);
assert.match(banking, /BANK_DAILY_INTEREST_RATE_BPS = 100/);
assert.match(banking, /safePositiveMoney\(payload\.amount, safeNonNegativeMoney\(player\.credits\)\)/);
assert.match(banking, /calculateRateMoney\(eligible, BANK_DAILY_INTEREST_RATE_BPS/);
assert.match(banking, /microsToInternalMoney\(fundedByPoolMicros\)/);
assert.doesNotMatch(banking, /Math\.floor\(shareMicros \/ 10_000\) \* 10_000/);

const contracts = read('server/src/contracts.js');
assert.match(contracts, /PRODUCTION_CONTRACT_SCHEMA_VERSION = 4/);
assert.match(contracts, /multiplyMoneyByInteger\(contract\.unitPrice, contract\.quantityPerDelivery\)/);
assert.doesNotMatch(contracts, /floorPlayerMoney/);

const audit = read('server/src/contract-audit-store.js');
assert.match(audit, /CONTRACT_AUDIT_MONEY_PRECISION_VERSION = 2/);
assert.match(audit, /money_precision_version INTEGER NOT NULL DEFAULT 2/);
assert.match(audit, /storedMoney\(item\.quantity\)/);
assert.match(audit, /restoredMoney\(row\.gross_total/);

assert.match(read('server/src/market-sell-fee.js'), /calculateRateMoney/);
assert.match(read('docs/README.md'), /一种六位微单位运算精度/);
assert.match(read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'), /单一微单位货币核心/);
assert.match(read('docs/UI_DESIGN_SYSTEM.md'), /普通金额统一显示两位/);

const stalePrecisionRule = /第三位及以后不拒绝|始终结算到 0\.01|进入玩家账本前再次结算到两位|尾差进入服务器精度准备金/;
for (const file of readdirSync(new URL('../docs/', import.meta.url))) {
  if (!file.endsWith('.md')) continue;
  assert.doesNotMatch(read(`docs/${file}`), stalePrecisionRule, `${file} contains a superseded money precision rule`);
}

console.log('Money precision verification passed.');
