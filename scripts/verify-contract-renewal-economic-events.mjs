import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ECONOMIC_EVENT_EPOCH_MS,
  createEconomicCalendarClientState,
  economicEventClassShares,
} from '../server/src/economic-events.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contracts = read('server/src/contracts.js');
const runtimeStore = read('server/src/runtime-store.js');
const routes = read('server/src/game-routes.js');
const statePartitions = read('server/src/state-partitions.js');
const overview = read('src/pages/OverviewPage.tsx');
const contractPage = read('src/pages/ContractPage.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');

for (const token of [
  'proposeProductionContractRenewal',
  'acceptProductionContractRenewal',
  'renewedFromContractId',
  'renewedToContractId',
  'renewalProposal',
]) assert.ok(contracts.includes(token), `contracts.js missing ${token}`);
for (const token of ['/renewal\/(propose|accept|reject|revoke)', 'proposeProductionContractRenewal']) {
  assert.ok(routes.includes(token), `game-routes.js missing ${token}`);
}
assert.ok(runtimeStore.includes('createEconomicCalendarClientState(now)'), 'state snapshot must include economic calendar');
assert.ok(runtimeStore.includes('createStablePartitionClientState(snapshot.state)'), 'state snapshot must stabilize partition projections');
assert.ok(statePartitions.includes("'economicCalendar'"), 'economic calendar must stay in the existing market delivery partition');
assert.ok(statePartitions.includes("['leaderboard', 'leaderboards']"), 'ranked leaderboards must stay in the leaderboard delivery partition');
assert.ok(overview.includes('公开经济事件日历'), 'overview must own the public economic calendar');
assert.ok(overview.includes('未来 7 天'), 'overview must limit the visible calendar to seven days');
assert.ok(!read('src/pages/MarketPage.tsx').includes('公开经济事件日历'), 'market page must not own the economic calendar');
assert.ok(contractPage.includes('提出续签'), 'contract page must expose renewal controls');
assert.ok(pageDesign.includes('未来七天'), 'page design must define the seven-day overview calendar');
assert.ok(productDesign.includes('每类人口的周期总预算'), 'product design must preserve each population model budget');
assert.ok(productDesign.includes('直接／派生预算'), 'product design must preserve direct and derived budgets');

const now = ECONOMIC_EVENT_EPOCH_MS + 6 * 60 * 60 * 1000;
const calendar = createEconomicCalendarClientState(now);
assert.deepEqual(calendar, createEconomicCalendarClientState(now + 1));
assert.equal(calendar.version, 2);
assert.equal('visibleUntil' in calendar, false);
assert.ok(calendar.events.every((event) => event.endsAt > now && event.startsAt <= now + 7 * 24 * 60 * 60 * 1000));
const shares = economicEventClassShares('basic', 'food', {
  staples: 0.5,
  protein: 0.25,
  'fresh-drinks': 0.1,
  convenience: 0.15,
}, now);
assert.ok(Math.abs(Object.values(shares).reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
console.log('Contract renewal and economic event verification passed.');
