import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);

function replaceRequired(path, from, to) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path} 缺少待替换内容: ${from.slice(0, 100)}`);
  write(path, content.replace(from, to));
}

function replaceRegexRequired(path, pattern, replacement) {
  const content = read(path);
  if (!pattern.test(content)) throw new Error(`${path} 缺少待替换正则: ${pattern}`);
  pattern.lastIndex = 0;
  write(path, content.replace(pattern, replacement));
}

function insertAfterRequired(path, marker, addition) {
  const content = read(path);
  if (!content.includes(marker)) throw new Error(`${path} 缺少插入锚点: ${marker}`);
  write(path, content.replace(marker, marker + addition));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

// 统一当前模型版本文字，历史“从模型 6 升级到模型 7”段落保持不变。
for (const path of ['README.md', ...walk('docs'), ...walk('scripts'), ...walk('server')]) {
  if (!/\.(?:md|mjs|js)$/.test(path)) continue;
  let content = read(path);
  content = content
    .replaceAll('市场需求模型版本：`7`', '市场需求模型版本：`8`')
    .replaceAll('市场需求模型版本：7', '市场需求模型版本：8')
    .replaceAll('市场需求模型 7', '市场需求模型 8')
    .replaceAll('MARKET_DEMAND_MODEL_VERSION = 7', 'MARKET_DEMAND_MODEL_VERSION = 8')
    .replaceAll('assert.equal(MARKET_DEMAND_MODEL_VERSION, 7)', 'assert.equal(MARKET_DEMAND_MODEL_VERSION, 8)')
    .replaceAll('world.marketDemand.modelVersion, 7', 'world.marketDemand.modelVersion, 8')
    .replaceAll('marketDemand.modelVersion = 7', 'marketDemand.modelVersion = 8')
    .replaceAll('market model 7', 'market model 8')
    .replaceAll('to model 7', 'to model 8')
    .replaceAll('模型 7 使用三类人口真实钱包', '模型 8 使用三类人口真实钱包');
  write(path, content);
}

replaceRequired(
  'server/src/market-demand/catalog.js',
  'export const PRODUCT_PRESSURE_MAX = 1.35;\n',
  'export const PRODUCT_PRESSURE_MAX = 1.35;\nexport const PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT = 0.08;\nexport const PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT = 0.10;\nexport const PRODUCT_PRESSURE_EVIDENCE_TARGET = 8;\n',
);
replaceRequired(
  'server/src/market-demand/catalog.js',
  'export const LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25;\n',
  'export const LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25;\nexport const LIQUIDITY_MIN_QUOTE_BUDGET_SHARE = 0.05;\n',
);

replaceRequired(
  'server/src/population-economy.js',
  "export const POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);\n",
  "export const POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);\nexport const POPULATION_STABILIZATION_BUDGET_SHARE = 0.12;\nexport const POPULATION_STABILIZATION_TARGET_CYCLES = 3;\nexport const POPULATION_STABILIZATION_DIRECT_SHARE = 0.85;\nconst INCOME_EMA_PREVIOUS_WEIGHT = 0.85;\nconst BUDGET_MAX_FALL = 0.12;\n",
);
replaceRequired(
  'server/src/population-economy.js',
  '    householdBudget: 0,\n    totalIncome: 0,\n',
  '    householdBudget: 0,\n    stabilizationBudget: 0,\n    lastStabilizationIssued: 0,\n    totalIncome: 0,\n',
);
replaceRequired(
  'server/src/population-economy.js',
  '      migrationIssued: 0,\n',
  '      migrationIssued: 0,\n      stabilizationIssued: 0,\n',
);
replaceRequired(
  'server/src/population-economy.js',
  "  for (const key of ['lastIncome', 'incomeEma', 'recentPeakIncome', 'noIncomeCycles', 'lastBudget', 'foodBudget', 'householdBudget', 'totalIncome', 'totalSpent']) {\n",
  "  for (const key of ['lastIncome', 'incomeEma', 'recentPeakIncome', 'noIncomeCycles', 'lastBudget', 'foodBudget', 'householdBudget', 'stabilizationBudget', 'lastStabilizationIssued', 'totalIncome', 'totalSpent']) {\n",
);
replaceRequired(
  'server/src/population-economy.js',
  '  model.incomeEma = Math.max(0, Math.round(model.incomeEma * 0.70 + income * 0.30));\n',
  '  model.incomeEma = Math.max(0, Math.round(model.incomeEma * INCOME_EMA_PREVIOUS_WEIGHT + income * (1 - INCOME_EMA_PREVIOUS_WEIGHT)));\n',
);
replaceRequired(
  'server/src/population-economy.js',
  'function modelSpendableBudget(modelId, model) {\n',
  'function modelSpendableBudget(modelId, model, stabilizationBudget = 0) {\n',
);
replaceRequired(
  'server/src/population-economy.js',
  '  const target = Math.min(model.credits, baseBudget + Math.floor(excessSavings * config.excessReleaseRate));\n',
  '  const target = Math.min(model.credits, Math.max(stabilizationBudget, baseBudget + Math.floor(excessSavings * config.excessReleaseRate)));\n',
);
replaceRequired(
  'server/src/population-economy.js',
  '  const minimum = Math.max(0, Math.ceil(model.lastBudget * 0.80));\n',
  '  const minimum = Math.max(0, Math.ceil(model.lastBudget * (1 - BUDGET_MAX_FALL)));\n',
);
replaceRegexRequired(
  'server/src/population-economy.js',
  /export function preparePopulationDemandCycle\(world, cycleId, now = Date\.now\(\)\) \{[\s\S]*?\n\}\n\nexport function populationClassShares/,
  `export function preparePopulationDemandCycle(world, cycleId, now = Date.now(), { totalBaseBudget = 5_700 } = {}) {
  const state = ensurePopulationEconomy(world, now);
  if (Number(state.demandCycle?.cycleId) === Number(cycleId)) return state.demandCycle;
  const groups = { food: {}, household: {} };
  const baseGroups = { food: {}, household: {} };
  const earnedGroups = { food: {}, household: {} };
  const stabilizationTotal = Math.max(0, Math.floor(nonNegativeInteger(totalBaseBudget) * POPULATION_STABILIZATION_BUDGET_SHARE));
  const stabilizationByModel = allocateInteger(stabilizationTotal, CONSTRUCTION_PROFILE);
  for (const modelId of POPULATION_MODEL_IDS) {
    const model = state.models[modelId];
    updateModelIncome(model);
    const stabilizationBudget = stabilizationByModel[modelId];
    const targetWallet = stabilizationBudget * POPULATION_STABILIZATION_TARGET_CYCLES;
    const walletTotal = model.credits + model.frozenCredits;
    const stabilizationIssued = Math.min(stabilizationBudget, Math.max(0, targetWallet - walletTotal));
    if (stabilizationIssued > 0) {
      model.credits += stabilizationIssued;
      state.stats.stabilizationIssued = nonNegativeInteger(state.stats.stabilizationIssued) + stabilizationIssued;
    }
    model.stabilizationBudget = stabilizationBudget;
    model.lastStabilizationIssued = stabilizationIssued;
    const spendable = modelSpendableBudget(modelId, model, stabilizationBudget);
    const baseSpendable = Math.min(spendable, stabilizationBudget);
    const earnedSpendable = spendable - baseSpendable;
    const shares = groupSharesFor(modelId, model.consumptionState);
    const foodBaseBudget = Math.floor(baseSpendable * shares.food);
    const householdBaseBudget = baseSpendable - foodBaseBudget;
    const foodEarnedBudget = Math.floor(earnedSpendable * shares.food);
    const householdEarnedBudget = earnedSpendable - foodEarnedBudget;
    const foodBudget = foodBaseBudget + foodEarnedBudget;
    const householdBudget = householdBaseBudget + householdEarnedBudget;
    model.lastBudget = spendable;
    model.foodBudget = foodBudget;
    model.householdBudget = householdBudget;
    groups.food[modelId] = foodBudget;
    groups.household[modelId] = householdBudget;
    baseGroups.food[modelId] = foodBaseBudget;
    baseGroups.household[modelId] = householdBaseBudget;
    earnedGroups.food[modelId] = foodEarnedBudget;
    earnedGroups.household[modelId] = householdEarnedBudget;
  }
  state.demandCycle = { cycleId: Number(cycleId), createdAt: now, groups, baseGroups, earnedGroups, stabilizationTotal };
  return state.demandCycle;
}

export function populationClassShares`,
);
replaceRequired(
  'server/src/population-economy.js',
  '      householdBudget: model.householdBudget,\n      totalIncome: model.totalIncome,\n',
  '      householdBudget: model.householdBudget,\n      stabilizationBudget: model.stabilizationBudget,\n      lastStabilizationIssued: model.lastStabilizationIssued,\n      totalIncome: model.totalIncome,\n',
);
replaceRequired(
  'server/src/population-economy.js',
  '      migration: nonNegativeInteger(state.stats.migrationIssued),\n      total: issuance.work + issuance.exchange + issuance.gift + issuance.legacyPopulation + nonNegativeInteger(state.stats.migrationIssued),\n',
  '      migration: nonNegativeInteger(state.stats.migrationIssued),\n      stabilization: nonNegativeInteger(state.stats.stabilizationIssued),\n      total: issuance.work + issuance.exchange + issuance.gift + issuance.legacyPopulation + nonNegativeInteger(state.stats.migrationIssued) + nonNegativeInteger(state.stats.stabilizationIssued),\n',
);

replaceRequired(
  'server/src/market-demand.js',
  '  PRODUCT_PRESSURE_MAX,\n  PRODUCT_PRESSURE_MIN,\n',
  '  PRODUCT_PRESSURE_MAX,\n  PRODUCT_PRESSURE_MIN,\n  PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT,\n  PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT,\n  PRODUCT_PRESSURE_EVIDENCE_TARGET,\n',
);
replaceRequired(
  'server/src/market-demand.js',
  '  POPULATION_MODEL_IDS,\n',
  '  POPULATION_MODEL_IDS,\n  POPULATION_STABILIZATION_DIRECT_SHARE,\n',
);
replaceRequired(
  'server/src/market-demand.js',
  '  const groupMap = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));\n',
  '  const groupMap = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));\n  const totalPopulationBaseBudget = MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + Number(group.baseBudget || 0), 0);\n',
);
replaceRequired(
  'server/src/market-demand.js',
  `      const activeImbalance = tradeStats.playerQuantity <= 0 ? 0 : tradeStats.playerNetActive / tradeStats.playerQuantity;
      const supplyRelief = Math.max(0, quote.coverage - 0.75);
      const target = clamp(
        PRODUCT_PRESSURE_MIN,
        PRODUCT_PRESSURE_MAX,
        1 + 0.55 * (group.targetSatisfaction - fillRatio) + 0.15 * activeImbalance - 0.20 * supplyRelief,
      );
`,
  `      const activeImbalance = tradeStats.playerQuantity <= 0 ? 0 : tradeStats.playerNetActive / tradeStats.playerQuantity;
      const supplyRelief = Math.max(0, quote.coverage - 0.75);
      const evidenceQuantity = Math.max(0, Number(tradeStats.playerQuantity || 0) + Number(tradeStats.consumptionQuantity || 0));
      const evidenceConfidence = clamp(0, 1, evidenceQuantity / Math.max(PRODUCT_PRESSURE_EVIDENCE_TARGET, requested));
      const target = clamp(
        PRODUCT_PRESSURE_MIN,
        PRODUCT_PRESSURE_MAX,
        1 + 0.55 * (group.targetSatisfaction - fillRatio)
          + evidenceConfidence * (
            PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT * activeImbalance
            - PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT * supplyRelief
          ),
      );
`,
);
replaceRequired(
  'server/src/market-demand.js',
  '    const populationCycle = preparePopulationDemandCycle(world, cycleId, now);\n',
  '    const populationCycle = preparePopulationDemandCycle(world, cycleId, now, { totalBaseBudget: totalPopulationBaseBudget });\n',
);
replaceRequired(
  'server/src/market-demand.js',
  `      const directBudget = Math.floor(modelBudget * group.directBudgetShare);
      const derivedBudget = modelBudget - directBudget;
`,
  `      const stabilizationBudget = Math.max(0, Math.floor(Number(populationCycle.baseGroups?.[group.id]?.[modelId] || 0)));
      const employmentBudget = Math.max(0, modelBudget - stabilizationBudget);
      const directBudget = Math.min(modelBudget,
        Math.floor(stabilizationBudget * POPULATION_STABILIZATION_DIRECT_SHARE)
          + Math.floor(employmentBudget * group.directBudgetShare));
      const derivedBudget = modelBudget - directBudget;
`,
);

replaceRequired(
  'server/src/market-liquidity.js',
  '  LIQUIDITY_MIN_SPREAD,\n',
  '  LIQUIDITY_MIN_SPREAD,\n  LIQUIDITY_MIN_QUOTE_BUDGET_SHARE,\n',
);
replaceRequired(
  'server/src/market-liquidity.js',
  `    const quoteBudget = Math.min(
      groupState.credits,
      Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget) * LIQUIDITY_QUOTE_BUDGET_SHARE)),
    );
`,
  `    const quoteBudget = Math.min(
      groupState.credits,
      Math.max(
        Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget) * LIQUIDITY_QUOTE_BUDGET_SHARE)),
        Math.max(0, Math.floor(Number(group.baseBudget || 0) * LIQUIDITY_MIN_QUOTE_BUDGET_SHARE)),
      ),
    );
`,
);

replaceRequired(
  'server/test/population-economy.test.js',
  '  populationModelState,\n',
  '  populationModelState,\n  preparePopulationDemandCycle,\n',
);
insertAfterRequired(
  'server/test/population-economy.test.js',
  `test('population buy orders use real escrow and refund price improvement and cancellation', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = populationModelState(world, 'basic');
  model.credits = 100;
  assert.equal(reservePopulationOrder(world, 'basic', 50), true);
  assert.equal(model.credits, 50);
  assert.equal(model.frozenCredits, 50);
  const order = { populationModelId: 'basic', price: 10, remaining: 5 };
  settlePopulationPurchase(world, order, 3, 8);
  assert.equal(model.credits, 56);
  assert.equal(model.frozenCredits, 20);
  assert.equal(model.totalSpent, 24);
  assert.equal(releasePopulationOrderFunds(world, order, 2), 20);
  assert.equal(model.credits, 76);
  assert.equal(model.frozenCredits, 0);
  assert.equal(model.credits + model.totalSpent, 100);
});
`,
  `

test('stabilization budget refills wallet gaps with a capped three-cycle target', () => {
  const world = createWorld(now);
  const state = resetPopulation(world);
  for (const model of Object.values(state.models)) {
    model.incomeEma = 100;
    model.recentPeakIncome = 100;
    model.lastBudget = 100;
  }
  const cycle = preparePopulationDemandCycle(world, 1, now, { totalBaseBudget: 5_700 });
  const issued = Object.values(state.models).reduce((sum, model) => sum + model.lastStabilizationIssued, 0);
  const baseBudget = Object.values(cycle.baseGroups.food).reduce((sum, value) => sum + value, 0)
    + Object.values(cycle.baseGroups.household).reduce((sum, value) => sum + value, 0);
  assert.equal(issued, 684);
  assert.equal(baseBudget, 684);
  assert.equal(state.stats.stabilizationIssued, 684);
  assert.ok(Object.values(state.models).every((model) => model.incomeEma === 85));

  for (const model of Object.values(state.models)) {
    model.credits = model.stabilizationBudget * 3;
    model.frozenCredits = 0;
  }
  preparePopulationDemandCycle(world, 2, now + 300_000, { totalBaseBudget: 5_700 });
  assert.ok(Object.values(state.models).every((model) => model.lastStabilizationIssued === 0));
  assert.equal(state.stats.stabilizationIssued, 684);
});
`,
);

replaceRequired(
  'scripts/verify-staple-crops-demand.mjs',
  "  'LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25',\n",
  "  'LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25',\n  'LIQUIDITY_MIN_QUOTE_BUDGET_SHARE = 0.05',\n  'POPULATION_STABILIZATION_BUDGET_SHARE = 0.12',\n  'POPULATION_STABILIZATION_TARGET_CYCLES = 3',\n  'POPULATION_STABILIZATION_DIRECT_SHARE = 0.85',\n  'INCOME_EMA_PREVIOUS_WEIGHT = 0.85',\n  'BUDGET_MAX_FALL = 0.12',\n  'PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT = 0.08',\n  'PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT = 0.10',\n  'PRODUCT_PRESSURE_EVIDENCE_TARGET = 8',\n",
);
replaceRequired(
  'scripts/verify-staple-crops-demand.mjs',
  "  'population buy orders use real escrow and refund price improvement and cancellation',\n",
  "  'population buy orders use real escrow and refund price improvement and cancellation',\n  'stabilization budget refills wallet gaps with a capped three-cycle target',\n",
);
replaceRequired(
  'scripts/verify-staple-crops-demand.mjs',
  "['README.md', ['市场需求模型版本：`8`', '三类人口使用真实余额', '人口消费成交不再发行普通货币']],",
  "['README.md', ['市场需求模型版本：`8`', '三类人口使用真实余额', '稳定需求补充', '人口消费成交不再发行普通货币']],",
);
replaceRequired(
  'scripts/verify-staple-crops-demand.mjs',
  "['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型版本：8', '三类人口账户', '真实冻结资金', '不设置人口侧货币回收']],",
  "['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型版本：8', '三类人口账户', '真实冻结资金', '稳定需求补充', '三周期目标钱包']],",
);
replaceRequired(
  'scripts/verify-staple-crops-demand.mjs',
  "console.log('市场需求验证通过：模型 8 使用三类人口真实钱包、70/30 直接与派生需求、真实冻结资金、周期末服务结算和资产守恒市场储备。');",
  "console.log('市场需求验证通过：模型 8 使用三类人口真实钱包、受控稳定需求补充、85/15 基础需求、70/30 就业需求、证据置信度压力和最低储备买盘。');",
);

replaceRequired(
  'README.md',
  '- 三类人口使用真实余额和冻结资金；每类人口周期预算中 70% 用于最终消费的直接需求，30% 用于沿正式配方反向推导的派生流动性。人口订单成交只转移已有货币，部分成交退回价差，撤单释放剩余冻结资金，人口消费成交不再发行普通货币。',
  '- 三类人口使用真实余额和冻结资金；就业收入预算继续按 70% 直接需求／30% 派生流动性分配。模型 8 额外提供总基础预算 12% 的稳定需求补充，三周期目标钱包、每周期最多补一周期缺口，稳定预算按 85% 直接需求／15% 派生流动性分配。人口消费成交本身不发行普通货币。',
);
replaceRequired(
  'README.md',
  '- 市场储备每 5 分钟撤销并重挂双边商品订单；买单最多使用本组消费预算的 25% 且不得超过储备可用资金，卖单只能冻结真实储备库存，基础总价差为 8%、限制在 4%～24%，每项最多挂目标库存的 25%，并保留 20% 安全库存。储备报价必须避让当前系统盘口：买价严格低于最低系统卖价，卖价严格高于最高系统买价；无法在基础价 50%～300% 合法区间内避让时不挂对应方向。',
  '- 市场储备每 5 分钟撤销并重挂双边商品订单；买单额度取当期消费预算 25% 与本组基础预算 5% 的较大值，且不得超过储备可用资金；卖单只能冻结真实储备库存，基础总价差为 8%、限制在 4%～24%，每项最多挂目标库存的 25%，并保留 20% 安全库存。储备报价必须避让当前系统盘口。',
);
replaceRequired(
  'README.md',
  '- 市场需求模型 8 撤销旧的无资金消费订单并建立三类人口真实钱包；迁移启动资金只执行一次。双边市场储备继续使用既有真实资金与库存，玩家订单和玩家资产保持不变，世界版本为 14。',
  '- 市场需求模型 8 在三类人口真实钱包上增加受控稳定需求补充、最低储备买盘与低成交证据置信度；升级时撤销旧系统订单并释放冻结，保留既有储备资产、玩家订单和玩家资产，世界版本保持 14。',
);
replaceRequired(
  'README.md',
  '- 商店兑换继续按固定汇率直接发行普通货币，不使用有限准备金；礼品码和管理员发放也按各自规则记录发行。系统不设置人口侧货币回收、余额衰减、发行总量上限或自动通胀控制。',
  '- 商店兑换继续按固定汇率直接发行普通货币；礼品码和管理员发放也按各自规则记录发行。系统不设置人口侧货币回收、余额衰减或发行总量上限；稳定需求补充只按人口钱包缺口发行，并受三周期目标钱包与单周期上限约束。',
);
replaceRequired(
  'README.md',
  '展示三类人口钱包、就业来源、施工托管、生产复杂度工资和货币发行统计。',
  '展示三类人口钱包、就业来源、施工托管、生产复杂度工资、稳定需求补充和货币发行统计。',
);

replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '4. 管理员明确发放与版本迁移一次性发放。',
  '4. 管理员明确发放与版本迁移一次性发放；\n5. 模型 8 按人口钱包缺口执行的受控稳定需求补充。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '生产、建设、扩容、手续费、玩家交易、市场储备交易和人口消费都只转移已有普通货币。人口消费不得增加 `populationIssued`，卖方获得人口真实冻结资金；生产和服务就业使用 `income`／`transferred` 统计，不得记为 `issued`。',
  '生产、建设、扩容、手续费、玩家交易、市场储备交易和人口消费成交都只转移已有普通货币。稳定需求补充在周期预算计算前进入人口钱包，单独计入 `stabilizationIssued`，不得记为就业收入或人口消费发行；卖方仍获得人口真实冻结资金。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '系统不设置人口侧货币回收、人口税、公共服务扣款、余额衰减、储蓄过期、货币总量上限或自动通胀控制。持续货币扩张属于正式设计结果；服务器只负责区分发行和转移、保证整数安全、幂等与资金一致。历史 `populationIssued` 和 `systemSinks` 只保留旧世界审计，模型 7 上线后的上述行为不得继续增加它们。',
  '系统不设置人口侧货币回收、人口税、公共服务扣款、余额衰减、储蓄过期或货币总量上限。模型 8 的稳定需求补充不是价格指数目标或无限兜底：总基准为两组基础预算之和的 12%，按 60%／30%／10% 分给三类人口，目标钱包为三周期稳定预算，每周期最多补一个周期且冻结资金计入钱包覆盖；余额达到目标时不得发行。历史 `populationIssued` 和 `systemSinks` 只保留旧世界审计。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '预算只控制消费速度，不删除或回收余额。单周期预算最多上涨 15%、下降 20%。预算按该模型的食品／家庭比例分组后，每组固定拆分为 70% 直接最终需求与 30% 派生流动性。直接和派生订单都必须先从所属人口 `credits` 转入 `frozenCredits`；成交按 maker price 支出并退回限价差额，撤单或订单缩量释放未成交冻结资金。任何人口新增订单的已提交金额不得超过其真实可用余额。',
  '预算只控制消费速度，不删除或回收余额。收入 EMA 使用 85% 上周期与 15% 当前收入，单周期预算最多上涨 15%、下降 12%。稳定预算至少形成对应人口的预算底线并按 85% 直接最终需求／15% 派生流动性分配；其余就业收入驱动预算继续按 70%／30% 分配。直接和派生订单都必须先从所属人口 `credits` 转入 `frozenCredits`，任何新增订单不得超过真实可用余额。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '商品供需压力是有符号状态，目标限制在 0.75～1.35，并按 70% 上周期与 30% 当前目标平滑。缺货、玩家主动买入和低卖单覆盖率使压力上升；高成交满足率、充足公开卖单与玩家主动卖出使压力下降。玩家隐藏库存仍不得进入压力计算。',
  '商品供需压力是有符号状态，目标限制在 0.75～1.35，并按 70% 上周期与 30% 当前目标平滑。服务缺口继续直接进入压力；玩家主动买卖失衡与公开卖单覆盖只在最近真实成交数量形成证据置信度后生效，权重分别为 0.08 与 0.10，低成交市场不得因少量卖单重复放大通缩。玩家隐藏库存仍不得进入压力计算。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '派生流动性只使用每类人口在本组预算中的 30%。直接需求与派生需求当期新增买单之和不得超过该人口真实预算；新增商品、工厂、库存、玩家数量或成交活跃度不得自动创造消费资金。',
  '就业收入驱动预算的派生流动性使用 30%，稳定需求预算的派生流动性使用 15%。直接需求与派生需求当期新增买单之和不得超过该人口真实预算；新增商品、工厂、库存、玩家数量或成交活跃度不得自动创造稳定需求补充。',
);
replaceRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '- 本组储备买单总额最多为当期消费需求预算的 25%，且不得超过储备可用资金；资金只分配给目标库存缺口或近期玩家主动卖出流量明确的商品，库存充足且无卖出流量的商品不得占用基础权重；',
  '- 本组储备买单额度取当期消费需求预算的 25% 与本组基础预算的 5% 中较大者，且不得超过储备可用资金；资金只分配给目标库存缺口或近期玩家主动卖出流量明确的商品；',
);
insertAfterRequired(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  '6. 世界版本继续保持 13，客户端状态版本继续保持 15，同一模型版本迁移只能执行一次。\n\n## 6. 资产与财富榜',
  `

### 从模型 7 升级到模型 8

1. 删除全部旧系统商品订单并原额释放人口与储备冻结资金、冻结库存，保留全部玩家订单和玩家资产；
2. 不重新发行储备种子资金或种子库存，稳定需求补充只在新周期按真实钱包缺口执行；
3. 重置周期服务结算、类别分配和旧单积压，保留价格传导关系历史；
4. 启用总基础预算 12% 的稳定需求、三周期目标钱包、85%／15% 稳定预算、最低 5% 储备买盘和证据置信度压力；
5. 世界版本保持 14、客户端状态版本保持 16，同一模型版本迁移只能执行一次。`,
);

insertAfterRequired(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '- 工厂复杂度同时约束建设门槛和参考分钟利润；正式梯度固定为 C1=1、C2=3、C3=6、C4=6、C5=8、C6=10、C7=12。复杂度决定生产运营就业结构，但不得直接创造市场需求预算。\n',
  '- 模型 8 的稳定需求补充只由人口钱包覆盖缺口触发，不读取工厂数量、产量、库存价值或复杂度；生产周期成本仍只形成就业收入。\n',
);
insertAfterRequired(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  '> 市场需求模型版本：8\n',
  '\n模型 8 的稳定需求补充在订单创建前进入人口真实钱包；直接与派生订单仍必须逐笔冻结真实资金，成交、价差退款和撤单释放规则不变，订单簿不得把补充金额当作成交发行。\n',
);
insertAfterRequired(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '> 市场需求模型版本：8\n',
  '\n市场需求模型 8 在 `population-economy.js` 记录 `stabilizationIssued`，以三周期目标钱包和单周期上限补足人口钱包缺口；`market-demand.js` 使用 85/15 稳定预算与成交证据置信度，`market-liquidity.js` 保留基础预算 5% 的最低储备买盘。\n',
);
replaceRequired(
  'docs/README.md',
  '16. 消费需求订单、三类人口真实钱包、就业收入、真实冻结资金、周期末成交结算、三档需求曲线、双向供需压力、库存与资金守恒的双边市场储备、生产链双向滞后价格传导和迁移清理属于产品、产业、订单簿与服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。',
  '16. 消费需求订单、三类人口真实钱包、就业收入、受控稳定需求补充、真实冻结资金、周期末成交结算、三档需求曲线、证据置信度供需压力、最低储备买盘、库存与资金守恒的双边市场储备、生产链双向滞后价格传导和迁移清理属于产品、产业、订单簿与服务器权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。',
);

console.log('市场需求模型 8 修改已应用。');
