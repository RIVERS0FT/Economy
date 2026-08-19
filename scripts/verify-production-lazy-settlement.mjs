import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const planner = read('server/src/world-deadline-planner.js');
const leaderboard = read('server/src/leaderboards.js');
const runtimeCore = read('server/src/runtime-store-core.js');
const runtimeAction = read('server/src/runtime-action-executor.js');
const app = read('server/src/app.js');
const routes = read('server/src/game-routes.js');
const api = read('src/api/game.ts');
const shared = read('shared/production-settlement.js');
const serverSettlement = read('server/src/production-settlement.js');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const industryDesign = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const docsIndex = read('docs/README.md');

assert.match(planner, /facility:\s*null/, '全局截止时间计划不得重新加入工厂周期截止时间');
assert.doesNotMatch(leaderboard, /processFacilityGroupWorld/, '排行榜处理不得再触发全服工厂补算');
assert.doesNotMatch(runtimeCore.match(/const ECONOMY_DEADLINE_DOMAINS[\s\S]*?\]\);/)?.[0] || '', /'facility'/, '调度到期领域不得包含 facility');
assert.match(shared, /function cappedArithmeticSum/, '客户端共享补算必须使用闭式 staffing 求和');
assert.match(shared, /maxProductionCyclesForResources/, '客户端必须计算最大合法生产周期');
assert.match(serverSettlement, /claimedCycles !== maximum/, '服务端必须验证客户端声明等于最大合法周期');
assert.match(serverSettlement, /basisDigest/, '服务端必须校验生产权威基线');
assert.match(runtimeAction, /applyProductionSettlementClaim/, '玩家动作必须能够原子附带生产结算声明');
assert.match(routes, /\/api\/game\/production\/settle/, '必须保留独立生产结算动作接口');
assert.match(app, /\/api\/game\/production\/basis/, '必须提供只读生产结算基线接口');
assert.match(api, /createProductionSettlementClaim/, '浏览器必须从权威基线计算生产结算声明');
assert.match(serverDesign, /客户端计算生产结算提案/);
assert.match(industryDesign, /生产结果必须与结算批次大小无关/);
assert.match(docsIndex, /按玩家懒结算/);

console.log('production lazy settlement architecture verified');
