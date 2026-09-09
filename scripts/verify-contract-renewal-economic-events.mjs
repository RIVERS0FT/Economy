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
const economicEvents = read('server/src/economic-events.js');
const publicProjects = read('server/src/public-projects.js');
const overview = read('src/pages/OverviewPage.tsx');
const provincePage = read('src/pages/ProvincePage.tsx');
const publicProjectPanel = read('src/components/projects/PublicProjectPanel.tsx');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const strategicOutliner = read('src/components/outliner/StrategicOutliner.tsx');
const contractRoute = read('src/pages/ContractPage.tsx');
const contractWorkspace = read('src/pages/ContractWorkspacePage.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const docsIndex = read('docs/README.md');
const auditStore = read('server/src/contract-audit-store.js');

for (const token of [
  'PRODUCTION_CONTRACT_SCHEMA_VERSION = 10',
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
assert.ok(runtimeStore.includes('createEconomicCalendarState(world, Number(user.id), now)'), 'state snapshot must include world-aware economic calendar');
assert.ok(runtimeStore.includes('createPublicProjectClientState'), 'state snapshot must project public projects through the calendar state');
assert.ok(runtimeStore.includes('createStablePartitionClientState(snapshot.state)'), 'state snapshot must stabilize partition projections');
assert.ok(statePartitions.includes("'economicCalendar'"), 'economic calendar and public projects must stay in the existing market delivery partition');
assert.ok(statePartitions.includes("['leaderboard', 'leaderboards']"), 'ranked leaderboards must stay in the leaderboard delivery partition');
assert.ok(!overview.includes('EconomicEventLogPanel') && !overview.includes('公开经济事件'), 'overview page content must not own the public economic event log');
assert.ok(strategicWorkspace.includes('<StrategicOutliner'), 'strategic shell must own the unified strategic outliner');
assert.ok(!strategicWorkspace.includes('strategic-economic-event-rail'), 'strategic shell must not restore the legacy event-only right rail');
assert.ok(strategicOutliner.includes('economicCalendar?.events'), 'strategic outliner must project public economic events from authoritative state');
assert.ok(strategicOutliner.includes('function CompactEventRow') && strategicOutliner.includes('<details') && strategicOutliner.includes('<summary>'), 'economic events must stay compact until expanded inside the outliner');
assert.ok(strategicOutliner.includes('currentEvents') && strategicOutliner.includes('completedEvents'), 'strategic outliner must separate current/upcoming events from recently completed events');
assert.ok(economicEvents.includes("id: `public-project-event:${String(project.id)}`"), 'public projects must reuse the existing economic-event outliner section instead of adding a fifth section');
assert.ok(economicEvents.includes('Number(event.announcedAt) <= normalizedNow'), 'regional events must not be delivered before their announcement time');
assert.ok(!read('src/pages/MarketPage.tsx').includes('公开经济事件'), 'market page must not own the economic event log');

for (const token of [
  '/api/game/public-projects/',
  'contributePublicProject',
  'claimPublicProjectReward',
]) assert.ok(routes.includes(token) || read('server/src/player-action-registry.js').includes(token), `public project action contract missing ${token}`);
assert.ok(publicProjects.includes('inventoryForProvince(player, productId, project.provinceId)'), 'public projects must debit the target-state inventory only');
assert.ok(publicProjects.includes('Number(inventory.available || 0) < accepted'), 'public projects must debit only available, non-frozen inventory');
assert.ok(publicProjects.includes('player.stats.publicProjectPoints'), 'public project rewards must use a separate contribution-points statistic');
assert.ok(!publicProjects.includes('player.credits ='), 'public project rewards must not issue ordinary currency');
assert.ok(publicProjects.includes('Number(project.announcedAt ?? project.startsAt) <= normalizedNow'), 'unannounced public projects must stay out of player state');
assert.ok(provincePage.includes('<RegionalEconomicEventBanner model={model} />') && provincePage.includes('<PublicProjectPanel model={model} />'), 'state overview must host regional events and public projects without adding navigation');
assert.ok(publicProjectPanel.includes('model.game.provinceInventories?.[project.provinceId]?.[goal.productId]'), 'project contribution UI must show only target-state inventory availability');
assert.ok(strategicWorkspace.includes('strategic-map-regional-events'), 'strategic map must expose announced regional event and project signals');

assert.ok(contractRoute.includes("import { ContractWorkspacePage } from './ContractWorkspacePage';") && contractRoute.includes('<ContractWorkspacePage model={model} />'), 'ContractPage must remain a thin route wrapper around the current workspace');
assert.ok(contractWorkspace.includes('function LegacyRenewalResolution'), 'current contract workspace must preserve existing legacy renewal resolution');
assert.ok(contractWorkspace.includes("contract.kind === 'supply' && contract.supplyMode !== 'daily' ? contract.renewalProposal : null"), 'renewal UI must be restricted to legacy non-daily supply contracts');
assert.ok(contractWorkspace.includes('同意续签') && contractWorkspace.includes('撤销同意'), 'legacy compatibility UI must expose bilateral renewal approval controls');
assert.ok(contractWorkspace.includes('采购方确认') && contractWorkspace.includes('供应方确认'), 'legacy compatibility UI must show both renewal approval states');
assert.ok(contractWorkspace.includes('该区域只处理已经存在的旧有限批次续签') && !contractWorkspace.includes('productionContractActions.proposeRenewal'), 'new daily contracts must not regain a renewal proposal entry');
assert.ok(contractWorkspace.includes('每日最大供应量') && contractWorkspace.includes('合同时间（天，可选）') && contractWorkspace.includes('开始延迟（天）'), 'new supply publication must expose daily regional terms');
assert.ok(!contractWorkspace.includes('总交付批次（可选）'), 'new daily supply publication must not restore legacy batch-count input');

assert.ok(pageDesign.includes('未来七天'), 'page design must define the seven-day public event calendar');
assert.ok(pageDesign.includes('战略追踪器'), 'page design must assign public economic events to the strategic outliner');
assert.ok(pageDesign.includes('大型公共项目'), 'page design must define public-project placement without a new top-level page');
assert.ok(productDesign.includes('每类人口的周期总预算'), 'product design must preserve each population model budget');
assert.ok(productDesign.includes('直接／派生预算'), 'product design must preserve direct and derived budgets');
assert.ok(productDesign.includes('地区动态事件'), 'product design must own regional event gameplay semantics');
assert.ok(productDesign.includes('大型公共项目'), 'product design must own public-project gameplay semantics');
assert.ok(serverDesign.includes('public-projects'), 'server design must record the authoritative public-project write contract');
assert.ok(serverDesign.includes('market.calendar'), 'server design must keep event/project delivery in the existing market calendar slice');
assert.ok(pageDesign.includes('提出续签条款不代表同意续签'), 'page design must require explicit bilateral renewal approval for legacy compatibility');
assert.ok(pageDesign.includes('新每日额度商品合同不使用续签'), 'page design must forbid renewal on new daily supply contracts');
assert.ok(docsIndex.includes('`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`') && docsIndex.includes('`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`'), 'design index must route legacy renewal UI and server semantics to their DESIGN owners');
for (const token of ['optionalTotalDeliveries', "contract.totalDeliveries === null ? 'completed' : 'terminated'", "return result(false, '长期合同无需续签')"]) {
  assert.ok(contracts.includes(token), `contracts.js missing long-term contract rule ${token}`);
}
assert.ok(pageDesign.includes('旧玩家商品合同协议中的 `totalDeliveries = null`') && pageDesign.includes('旧长期合同不会因完成批次数自动结束'), 'page design must preserve legacy long-term supply compatibility');
for (const token of ['renewal_approved', 'renewal_approval_revoked', 'renewal_confirmed']) assert.ok(auditStore.includes(token), `contract audit store missing ${token}`);

const now = ECONOMIC_EVENT_EPOCH_MS + 6 * 60 * 60 * 1000;
const calendar = createEconomicCalendarClientState(now);
assert.deepEqual(calendar, createEconomicCalendarClientState(now + 1));
assert.equal(calendar.version, 3);
assert.equal('visibleUntil' in calendar, false);
assert.ok(calendar.events.every((event) => event.scope === 'global'));
assert.ok(calendar.events.every((event) => event.endsAt > now && event.startsAt <= now + 7 * 24 * 60 * 60 * 1000));
const shares = economicEventClassShares('basic', 'food', {
  staples: 0.5,
  protein: 0.25,
  'fresh-drinks': 0.1,
  convenience: 0.15,
}, now);
assert.ok(Math.abs(Object.values(shares).reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
console.log('Legacy contract renewal compatibility, regional events and public projects verification passed.');
