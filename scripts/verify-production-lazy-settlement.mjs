import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const planner = read('server/src/world-deadline-planner.js');
const leaderboard = read('server/src/leaderboards.js');
const runtimeCore = read('server/src/runtime-store-core.js');
const runtimeStore = read('server/src/runtime-store.js');
const runtimeAction = read('server/src/runtime-action-executor.js');
const facilityGroups = read('server/src/facility-groups.js');
const routes = read('server/src/game-routes.js');
const api = read('src/api/game.ts');
const clientSettlement = read('src/utils/productionSettlement.ts');
const shared = read('shared/production-settlement.js');
const serverSettlement = read('server/src/production-settlement.js');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const docsIndex = read('docs/README.md');

assert.match(planner, /facility:\s*null/, '全局截止时间计划不得重新加入工厂周期截止时间');
assert.doesNotMatch(leaderboard, /processFacilityGroupWorld/, '排行榜处理不得再触发全服工厂补算');
assert.doesNotMatch(runtimeCore.match(/const ECONOMY_DEADLINE_DOMAINS[\s\S]*?\]\);/)?.[0] || '', /'facility'/, '运行时全局截止领域不得包含 facility');
assert.match(
  runtimeCore,
  /if \(dueDomains\.has\('market'\)\) \{\s*processWorld\(world, now, \{ migrate: false \}\);/,
  '移除排行榜工厂处理后，market 到期仍必须显式推进通用市场世界逻辑',
);
assert.match(runtimeStore, /PRODUCTION_COLD_START_YIELD_MS\s*=\s*1_000/, '正式服务冷启动必须先让出健康检查窗口');
assert.match(runtimeStore, /settleProductionForDueContractParticipants/, '合同兜底只能从运行时按到期参与者触发');
assert.match(shared, /function cappedArithmeticSum/, '客户端共享补算必须使用闭式 staffing 求和');
assert.match(shared, /maxProductionCyclesForResources/, '客户端必须计算最大合法生产周期');
assert.match(serverSettlement, /productionSettlementFits\(candidate, claimedCycles/, '服务端必须验证客户端声明本身合法');
assert.match(serverSettlement, /productionSettlementFits\(candidate, claimedCycles \+ 1/, '服务端必须用 n+1 非法证明客户端声明最大化');
assert.match(serverSettlement, /contract\.contractType === 'goods_supply'/, '到期供货合同兜底必须使用正式合同类型');
assert.match(runtimeAction, /applyProductionSettlementClaim/, '玩家动作必须能够原子附带生产结算声明');
assert.match(runtimeAction, /settleProductionForPlayerServerSide/, '旧客户端或过期提案只能对当前玩家兜底');
assert.match(runtimeAction, /action === 'settleProduction' \? 'setFacilityRecipe' : action/, '独立生产结算必须复用本地玩家 COW 范围而不是完整世界草稿');
assert.match(routes, /\/api\/game\/production\/settle/, '必须保留独立生产结算动作接口');
assert.match(clientSettlement, /createProductionSettlementClaim/, '浏览器必须从现有权威状态计算生产结算声明');
assert.match(api, /pendingProductionSettlement/, '普通玩家动作必须能够携带最近一次客户端生产提案');
assert.match(api, /PRODUCTION_SETTLEMENT_/, '过期或近似提案必须退回当前玩家服务器兜底而不是失败动作');
for (const privateField of [
  'productionWageCarryNumerator: _productionWageCarryNumerator',
  'productionEmploymentTotalMicros: _productionEmploymentTotalMicros',
  'productionEmploymentAllocatedMicros: _productionEmploymentAllocatedMicros',
]) assert.match(facilityGroups, new RegExp(privateField), `客户端投影必须剥离生产结算私有字段: ${privateField}`);
assert.match(serverDesign, /客户端计算生产结算提案/);
assert.match(serverDesign, /45 秒真实健康检查门槛保持不变/);
assert.match(industryDesign, /生产结果必须与结算批次大小无关/);
assert.match(industryDesign, /离线补算多个周期时必须逐周期使用各自的 `cycleDueAt` 对应语义/);
assert.match(docsIndex, /77\. 工厂持续生产采用按玩家懒结算/);

console.log('production lazy settlement architecture verified');
