import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { buildFacilityOperatingDiagnosis } from '../src/utils/facilityOperatingDiagnostics.ts';
import { eventMarketFeedback, marketDecisionSignal } from '../src/utils/marketDecisionSignals.ts';

function read(path) { return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(path, text) { if (!read(path).includes(text)) throw new Error(`${path} 缺少: ${text}`); }
function forbidText(path, text) { if (read(path).includes(text)) throw new Error(`${path} 不应包含: ${text}`); }

const diagnosis = buildFacilityOperatingDiagnosis({
  recipe: {
    id: 'r',
    name: 'r',
    cycleMs: 60_000,
    operatingCost: 10,
    inputs: [{ productId: 'wheat', quantity: 2 }],
    output: { productId: 'flour', quantity: 1 },
  },
  productionCount: 2,
  inventories: { wheat: { available: 5, frozen: 0 } },
  credits: 100,
});
assert.equal(diagnosis.inputCycles, 1);
assert.equal(diagnosis.cashCycles, 5);
assert.equal(diagnosis.bottleneck.id, 'inputs');

const market = {
  productId: 'wheat',
  lastPrice: 12,
  lastTradePrice: 12,
  priceHistory: [
    { price: 99, quantity: 9, createdAt: 1 },
    { price: 10, quantity: 2, createdAt: 2, takerSide: 'buy' },
    { price: 11, quantity: 4, createdAt: 3, takerSide: 'buy' },
    { price: 12, quantity: 3, createdAt: 4, takerSide: 'sell' },
  ],
  demand: {
    cycleMs: 1,
    nextDemandAt: 1,
    lastBudget: 1,
    lastQuantity: 1,
    lastPrice: 1,
    satisfaction: 1,
  },
};
assert.equal(marketDecisionSignal(market).changeBps, 909);
const feedback = eventMarketFeedback({ wheat: market }, ['wheat'], 2, 4);
assert.equal(feedback.volume, 9);
assert.equal(feedback.tradeCount, 3);
assert.equal(feedback.averageChangeBps, 2000);
const summarizedFeedback = eventMarketFeedback({
  wheat: {
    ...market,
    priceHistory: undefined,
    eventTradeWindows: {
      'event-wheat': { tradeCount: 2, volume: 7, firstPrice: 10, lastPrice: 12 },
    },
  },
}, ['wheat'], 2, 4, 'event-wheat');
assert.equal(summarizedFeedback.volume, 7);
assert.equal(summarizedFeedback.tradeCount, 2);
assert.equal(summarizedFeedback.averageChangeBps, 2000);

for (const text of [
  'first_research_at',
  'first_bank_deposit_at',
  'gameplay_strategy_funnel_coverage_started_at',
  "completion_source = 'player'",
  'completion24h',
  'completion7d',
]) requireText('server/src/player-admin-statistics.js', text);
requireText('server/src/tutorial-store.js', "completion_source IN ('legacy', 'migration', 'player')");
requireText('src/components/facilities/FacilityOperatingDiagnostics.tsx', '不自动推荐最高利润产物');
requireText('src/pages/production/MobileFacilityDetailSheet.tsx', 'markets={markets}');
forbidText('src/pages/production/MobileFacilityDetailSheet.tsx', 'warehouseStoredQuantity');
forbidText('src/pages/ResearchPage.tsx', '产业经营视角');
requireText('src/pages/ResearchPage.tsx', 'className="research-investment mobile-detail-section"');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '科技详情不显示“产业经营视角”');
requireText('server/src/contract-audit-store.js', 'store.getContractPerformance');
requireText('src/contracts/api.ts', "getJson<{ performance: ContractPerformanceSummary }>('/contracts/performance')");
requireText('src/pages/ContractPage.tsx', '我的履约档案');
requireText('src/pages/ContractPage.tsx', '不生成星级、信用等级或主观评分');
requireText('server/src/contracts.js', 'MAX_NEGOTIATIONS_PER_CONTRACT = 3');
requireText('server/src/contracts.js', 'MAX_NEGOTIATION_REVISIONS = 5');
const negotiationContractSource = read('server/src/contracts.js');
assert.match(negotiationContractSource, /function cancelOpenContract[\s\S]*?contract\.negotiations = \[\];[\s\S]*?contract\.status = 'cancelled'/);
requireText('server/src/contracts.js', 'NEGOTIATION_TTL_MS = 24 * 60 * 60 * 1000');
requireText('server/src/contracts.js', 'proposeProductionContractNegotiation');
requireText('server/src/contracts.js', 'publicNegotiations');
requireText('server/src/contract-audit-store.js', 'negotiation_proposed');
requireText('server/src/contract-audit-store.js', 'negotiation_accepted');
requireText('src/contracts/ContractNegotiationSection.tsx', '议价阶段不冻结资产');
requireText('src/contracts/ContractNegotiationSection.tsx', 'baseTerms={baseTerms}');
requireText('src/contracts/ContractNegotiationSection.tsx', 'label="开始延迟（天）"');
requireText('src/contracts/navigation.ts', 'sessionStorage.removeItem');
requireText('src/components/facilities/FacilityOperatingDiagnostics.tsx', '查看相关合同');
forbidText('src/contracts/types.ts', 'proposerId: number;');
assert.equal(existsSync(new URL('../src/utils/leaderboardGoals.ts', import.meta.url)), false);
forbidText('src/pages/LeaderboardPage.tsx', 'personalLeaderboardGoal');
forbidText('src/pages/LeaderboardPage.tsx', 'leaderboard-personal-goal');
forbidText('src/styles/leaderboards.css', 'leaderboard-personal-goal');
requireText('src/pages/LeaderboardPage.tsx', 'leaderboard-personal-best');
requireText('server/src/leaderboards.js', 'leaderboardPersonalBests');
requireText('server/src/leaderboards.js', 'if (!state.partial)');
requireText('server/src/leaderboards.js', 'currentIsRecord: !state.partial');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '排行榜页面不得显示个人竞争分段、下一目标或“距离目标还差 N 名”提示');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '四榜个人最好成绩由服务器在完整周结算时写入玩家权威统计');
requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '排行榜只保留当前真实名次、当前成绩和服务器完整周结算的个人最好成绩');
forbidText('src/pages/LeaderboardPage.tsx', 'localStorage');
forbidText('src/pages/OverviewPage.tsx', 'EconomicEventLogPanel');
requireText('src/components/shell/StrategicWorkspace.tsx', '<StrategicOutliner');
requireText('src/components/outliner/StrategicOutliner.tsx', 'economicCalendar?.events');
requireText('src/components/outliner/StrategicOutliner.tsx', 'id="events"');
requireText('src/components/EconomicEventLogPanel.tsx', '事件窗口真实成交');
requireText('src/components/EconomicEventLogPanel.tsx', 'eventMarketFeedback(markets, event.productIds, event.startsAt, event.endsAt, event.id)');
requireText('server/src/economic-events.js', 'EVENT_RESULT_WINDOW_MS');
requireText('src/utils/marketDecisionSignals.ts', 'markets[productId]?.eventTradeWindows?.[eventId]');
forbidText('src/components/facilities/FacilityOperatingDiagnostics.tsx', '最佳配方');
forbidText('src/pages/ResearchPage.tsx', '最佳科技推荐');
forbidText('src/pages/ContractPage.tsx', 'creditScore');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '经营决策支持固定边界');
requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '工厂经营诊断');
forbidText('src/utils/facilityOperatingDiagnostics.ts', 'warehouseAvailableCapacity');
forbidText('src/utils/facilityOperatingDiagnostics.ts', 'warehouseStoredQuantity');
forbidText('src/utils/facilityOperatingDiagnostics.ts', 'warehouseCycles');
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '完整经营漏斗覆盖起点');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'completion_source');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '结构化议价');
requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '多人供应链议价');
requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '查看相关合同');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '议价线程');

console.log('Gameplay decision support verification passed.');
