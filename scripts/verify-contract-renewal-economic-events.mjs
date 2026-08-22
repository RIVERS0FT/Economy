import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ECONOMIC_EVENT_EPOCH_MS,
  createEconomicCalendarClientState,
  economicEventClassShares,
} from '../server/src/economic-events.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const contracts = read('server/src/contracts.js');
const runtimeStore = `${read('server/src/runtime-store.js')}\n${read('server/src/runtime-store-core.js')}`;
const routes = read('server/src/game-routes.js');
const statePartitions = read('server/src/state-partitions.js');
const overview = read('src/pages/OverviewPage.tsx');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const strategicOutliner = read('src/components/outliner/StrategicOutliner.tsx');
const contractPage = read('src/pages/ContractPage.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const auditStore = read('server/src/contract-audit-store.js');
const rootReadme = read('README.md');

for (const token of [
  'PRODUCTION_CONTRACT_SCHEMA_VERSION = 9',
  'proposeProductionContractRenewal',
  'acceptProductionContractRenewal',
  'renewedFromContractId',
  'renewedToContractId',
  'renewalProposal',
  'buyerApprovedAt',
  'supplierApprovedAt',
  'confirmedAt',
]) assert.ok(contracts.includes(token), `contracts.js missing ${token}`);
for (const token of [String.raw`/renewal\/(propose|accept|reject|revoke)`, 'proposeProductionContractRenewal']) {
  assert.ok(routes.includes(token), `game-routes.js missing ${token}`);
}
assert.ok(runtimeStore.includes('createEconomicCalendarClientState(now)'), 'state snapshot must include economic calendar');
assert.ok(runtimeStore.includes('createStablePartitionClientState(snapshot.state)'), 'state snapshot must stabilize partition projections');
assert.ok(statePartitions.includes("'economicCalendar'"), 'economic calendar must stay in the existing market delivery partition');
assert.ok(statePartitions.includes("['leaderboard', 'leaderboards']"), 'ranked leaderboards must stay in the leaderboard delivery partition');
assert.ok(!overview.includes('EconomicEventLogPanel') && !overview.includes('公开经济事件'), 'overview page content must not own the public economic event log');
assert.ok(strategicWorkspace.includes('<StrategicOutliner'), 'strategic shell must own the unified strategic outliner');
assert.ok(!strategicWorkspace.includes('strategic-economic-event-rail'), 'strategic shell must not restore the legacy event-only right rail');
assert.ok(strategicOutliner.includes('economicCalendar?.events'), 'strategic outliner must project public economic events from authoritative state');
assert.ok(strategicOutliner.includes('function CompactEventRow') && strategicOutliner.includes('<details') && strategicOutliner.includes('<summary>'), 'economic events must stay compact until expanded inside the outliner');
assert.ok(strategicOutliner.includes('currentEvents') && strategicOutliner.includes('completedEvents'), 'strategic outliner must separate current/upcoming events from recently completed events');
assert.ok(!read('src/pages/MarketPage.tsx').includes('公开经济事件'), 'market page must not own the economic event log');
assert.ok(contractPage.includes('提出续签'), 'contract page must expose renewal controls');
assert.ok(contractPage.includes('同意续签') && contractPage.includes('撤销同意'), 'contract page must expose bilateral renewal approval controls');
assert.ok(contractPage.includes('采购方确认') && contractPage.includes('供应方确认'), 'contract page must show both renewal approval states');
assert.ok(pageDesign.includes('未来七天'), 'page design must define the seven-day public event calendar');
assert.ok(pageDesign.includes('战略追踪器'), 'page design must assign public economic events to the strategic outliner');
assert.ok(productDesign.includes('每类人口的周期总预算'), 'product design must preserve each population model budget');
assert.ok(productDesign.includes('直接／派生预算'), 'product design must preserve direct and derived budgets');
assert.ok(pageDesign.includes('提出续签条款不代表同意续签'), 'page design must require explicit bilateral renewal approval');
assert.ok(serverDesign.includes('单方同意不冻结任何续签资产'), 'server design must define single-party approval without escrow');
assert.ok(serverDesign.includes('旧 schema 7'), 'server design must preserve the legacy renewal migration rule');
assert.ok(rootReadme.includes('单方同意不冻结续签资产'), 'root README must summarize explicit bilateral renewal approval');
for (const token of ['optionalTotalDeliveries', "contract.totalDeliveries === null ? 'completed' : 'terminated'", "return result(false, '长期合同无需续签')"]) {
  assert.ok(contracts.includes(token), `contracts.js missing long-term contract rule ${token}`);
}
assert.ok(contractPage.includes('总交付批次（可选）') && contractPage.includes('留空表示长期合同'), 'contract page must expose optional long-term total deliveries');
assert.ok(contractPage.includes('长期合同 · 已履约'), 'contract page must avoid fake infinite progress');
assert.ok(pageDesign.includes('`totalDeliveries = null`') && pageDesign.includes('长期合同不会因完成批次数自动结束'), 'page design must own long-term supply contract semantics');
assert.ok(serverDesign.includes('`totalDeliveries` 允许为 2～100 的整数或 `null`') && serverDesign.includes('长期合同不接受续签'), 'server design must own long-term supply lifecycle');
assert.ok(serverDesign.includes('合同 schema 9 同时'), 'server design must keep the current supply contract schema baseline');
assert.ok(serverDesign.includes('世界 32 是当前持久化边界') && serverDesign.includes('当前客户端状态版本为 36'), 'server design must keep current world and client baselines');
assert.ok(serverDesign.includes('合同历史冷启动导入必须优先读取 V2 分段世界'), 'contract audit cold-start must prefer segmented V2 authority');
assert.ok(!serverDesign.includes('合同 schema 8 同时') && !serverDesign.includes('世界 26 是当前持久化边界。') && !serverDesign.includes('当前客户端状态版本为 30。'), 'server design must not retain stale contract/world/client baselines');
assert.ok(rootReadme.includes('可留空总批次形成长期合同'), 'root README must summarize long-term supply contracts');
for (const token of ['renewal_approved', 'renewal_approval_revoked', 'renewal_confirmed']) assert.ok(auditStore.includes(token), `contract audit store missing ${token}`);

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
console.log('Contract renewal and strategic economic event verification passed.');
