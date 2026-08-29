import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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
const countdownDesign = read('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const docsIndex = read('docs/README.md');

assert.match(planner, /facility:\s*null/, '全局截止时间计划不得重新加入工厂周期截止时间');
assert.doesNotMatch(leaderboard, /processFacilityGroupWorld/, '排行榜处理不得再触发全服工厂补算');
assert.equal(
  existsSync(new URL('../server/src/leaderboards-core.js', import.meta.url)),
  false,
  '排行榜实现必须保持单文件，不得用拆分文件绕开现有架构验证',
);
assert.match(
  leaderboard,
  /function processWorldAt[\s\S]*?processWorld\(world, now, \{ migrate: false \}\);/,
  '排行榜周期推进必须在规则迁移之后显式推进通用市场与运输逻辑',
);
assert.match(
  leaderboard,
  /if \(!validLeaderboardState\(world\.leaderboardState\)\) \{\s*processWorld\(world, now, \{ migrate: false \}\);/,
  '首次排行榜初始化仍必须推进通用市场与运输逻辑',
);
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
assert.match(shared, /export function createProductionSettlementBasisId/, '生产结算必须用共享基线指纹区分过期提案与非法声明');
assert.match(serverSettlement, /createProductionSettlementBasisId\(basis\)/, '服务端生产基线必须生成共享指纹');
assert.match(serverSettlement, /claimedBasisId[\s\S]*?PRODUCTION_SETTLEMENT_STALE|claimedBasisId[\s\S]*?stale\(\)/, '指纹不一致必须在生产写入前判定为过期提案');
assert.match(serverSettlement, /productionSettlementFits\(candidate, claimedCycles/, '服务端必须验证客户端声明本身合法');
assert.match(serverSettlement, /productionSettlementFits\(candidate, claimedCycles \+ 1/, '服务端必须用 n+1 非法证明客户端声明最大化');
assert.match(serverSettlement, /All stale identity checks must finish before any production state is mutated/, '所有可恢复 stale 校验必须先于生产状态写入完成');
assert.match(serverSettlement, /group\.productionWageCarryNumerator === undefined/, '生产工资余数的合法 0 值不得被重新初始化');
assert.match(serverSettlement, /firstCycleCostMicros/, '旧周期工资系数只能作用于首个欠结算周期');
assert.match(serverSettlement, /contract\.contractType === 'goods_supply'/, '到期供货合同兜底必须使用正式合同类型');
assert.match(runtimeAction, /function settleProductionForAction/, '玩家动作必须统一处理客户端生产提案');
assert.match(runtimeAction, /error\?\.code !== 'PRODUCTION_SETTLEMENT_STALE'/, '只有明确过期的生产提案允许服务器同事务兜底');
assert.match(runtimeAction, /settleProductionForPlayerServerSide\(world, userId, now\)/, '过期提案只能对当前玩家执行服务器权威兜底');
assert.match(
  runtimeAction,
  /const mutationScopeAction = action === 'settleProduction'[\s\S]*?\? 'setFacilityRecipe'/,
  '独立生产结算必须继续映射到 setFacilityRecipe 的本地玩家 COW 范围',
);
assert.match(
  runtimeAction,
  /createRuntimeMutationScope\([\s\S]*?mutationScopeAction,/,
  '生产结算与其他玩家动作必须通过解析后的 mutationScopeAction 创建 COW 范围',
);
assert.match(routes, /\/api\/game\/production\/settle/, '必须保留独立生产结算动作接口');
assert.match(clientSettlement, /createProductionSettlementBasisId/, '浏览器生产提案必须携带与服务器同算法的基线指纹');
assert.match(clientSettlement, /createProductionSettlementClaim/, '浏览器必须从现有权威状态计算生产结算声明');
assert.match(clientSettlement, /productionSettlementStaffingRateBps/, '客户端必须使用服务器原始 staffing 基线而不是 UI 投影值');
assert.match(api, /pendingProductionSettlement/, '普通玩家动作必须能够携带最近一次客户端生产提案');
assert.doesNotMatch(
  api,
  /return request<GameActionResponse>\(path, \{ method: 'POST', body: JSON\.stringify\(body\) \}\);/,
  '生产提案被拒绝后客户端不得移除提案再自动发送第二次同一业务动作',
);
for (const privateField of [
  'productionWageCarryNumerator: _productionWageCarryNumerator',
  'productionEmploymentTotalMicros: _productionEmploymentTotalMicros',
  'productionEmploymentAllocatedMicros: _productionEmploymentAllocatedMicros',
]) assert.match(facilityGroups, new RegExp(privateField), `客户端投影必须剥离生产结算私有字段: ${privateField}`);
assert.match(serverDesign, /客户端计算生产结算提案/);
assert.match(countdownDesign, /生产结算基线指纹/);
assert.match(countdownDesign, /非法生产提案仍返回 409/);
assert.match(serverDesign, /45 秒真实健康检查门槛保持不变/);
assert.match(industryDesign, /生产结果必须与结算批次大小无关/);
assert.match(industryDesign, /离线补算多个周期时必须逐周期使用各自的 `cycleDueAt` 对应语义/);
assert.match(docsIndex, /77\. 工厂持续生产采用按玩家懒结算/);

console.log('production lazy settlement architecture verified');
