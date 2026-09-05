import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const forbidText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

const daily = read('server/src/daily-supply-contracts.js');
const sourcing = read('server/src/production-input-sourcing.js');
const cycleAuto = read('server/src/cycle-auto-operation.js');
const unified = read('server/src/unified-contracts.js');
const audit = read('server/src/contract-audit-store.js');
const runtime = read('server/src/runtime-store.js');
const reservations = read('server/src/online-auto-trade-reservations.js');
const types = read('src/contracts/types.ts');
const api = read('src/contracts/api.ts');
const navigation = read('src/contracts/navigation.ts');
const workspace = read('src/pages/ContractWorkspacePage.tsx');
const buildings = read('src/pages/BuildingsPage.tsx');
const productDetail = read('src/components/market/MarketAutoTradePanel.tsx');
const industry = read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md');
const warehouse = read('docs/WAREHOUSE_EXPANSION_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const docsIndex = read('docs/README.md');

for (const token of [
  "supplyMode: 'daily'",
  'dailyMaxQuantity',
  'durationDays',
  'startDelayDays',
  'provinceId',
  'dailyUsedQuantity',
  'dailyRemainingQuantity',
  'totalDeliveredQuantity',
  'CONTRACT_DAY_MS',
  'CONTRACT_DAY_OFFSET_MS',
  'minDailyProduction',
  'minContractPrice',
  'consumeDailySupplyForBuyer',
  'allocateDailySupplyReservesForSupplier',
]) requireText(daily, token, `每日商品合同运行层缺少：${token}`);

for (const token of [
  'commoditySystemPriceFor',
  'consumeDailySupplyForBuyer',
  'thawProductionGuarantee',
  'prepareProductionInputsForPlayer',
  'finalizeProductionOutputContracts',
  'runCycleAutoOperation',
]) requireText(sourcing, token, `生产输入择源/周期结算缺少：${token}`);
forbidText(sourcing, 'applyImmediateCommodityBuy', '生产结算前不得直接从官方市场自动采购。');
requireText(cycleAuto, "execution: 'cycle-auto-operation'", '官方市场自动采购必须只在建筑周期完成后的统一自动经营结算中执行。');

for (const token of [
  'termDays',
  'periodDays',
  'firstPeriodDelayDays',
  'CONTRACT_DAY_MS',
  'applyLegacyProductionContractAction',
]) requireText(unified, token, `统一合同门面缺少按天兼容：${token}`);

for (const token of ['prepareProductionInputsForPlayer', 'finalizeProductionOutputContracts', 'applyProductionContractAction']) {
  requireText(runtime, token, `运行时未接入合同生产链：${token}`);
}
requireText(reservations, 'dailySupplyContractAvailableHold', '供应合同可用保留兼容计算必须保持。');

for (const token of ['dailyMaxQuantity?: number', 'durationDays?: number | null', 'prioritySupply?: SupplyPriorityCondition', 'termDays?: number', 'periodDays?: number']) {
  requireText(types, token, `客户端合同类型缺少：${token}`);
}
for (const token of ['provinceId?: string', 'dailyMaxQuantity?: number', 'durationDays?: number | null', 'termDays?: number', 'periodDays?: number']) {
  requireText(api, token, `客户端合同 API 缺少按地区／天字段：${token}`);
}
requireText(navigation, 'provinceId?: string', '合同跳转意图必须允许携带地区。');
requireText(buildings, 'setContractMarketIntent(productId, model.selectedProvinceId)', '建筑经营诊断跳转合同必须携带当前地区。');

for (const token of ['每日最大供应量', '固定价格', '合同时间（天', '开始延迟（天）', '合同地区', '最低当日产量', '最低合同价格', '今日剩余额度']) {
  requireText(workspace, token, `合同工作区缺少：${token}`);
}
for (const token of ['首次交付（小时）', '交付周期（小时）', '贷款期限（小时）', '租金周期（小时）', '首次生效（小时）']) {
  forbidText(workspace, token, `新合同工作区不得恢复旧按小时合同字段：${token}`);
}
for (const token of ['首次交付（分钟）', '交付周期（分钟）', '贷款期限（分钟）', '租金周期（分钟）', '首次生效（分钟）']) {
  forbidText(workspace, token, `新合同工作区不得恢复旧按分钟合同字段：${token}`);
}

for (const token of ['合同简要', '采购合同', '供应合同', '今日采购额度', '最低采购合同价', '查看相关合同']) {
  requireText(productDetail, token, `地区商品详情合同摘要缺少：${token}`);
}
requireText(productDetail, 'setContractMarketIntent(product.id, model.selectedProvinceId)', '地区商品详情合同跳转必须携带 provinceId + productId。');

for (const [source, token, message] of [
  [industry, '有效采购合同固定价严格低于当日 `officialPrice` 时可以优先使用合同额度', '产业权威设计必须保留低价合同优先于自动市场采购。'],
  [industry, '最低当日产量 + 最低合同固定价', '产业权威设计必须锁定供应优先条件。'],
  [warehouse, '每日最大供应量', '仓库权威设计必须锁定每日额度合同。'],
  [warehouse, '合同简要', '仓库权威设计必须锁定商品详情合同摘要。'],
  [pageDesign, '领域、合作方向、地区和商品筛选', '页面权威设计必须锁定合同领域、合作方向、地区和商品筛选。'],
  [pageDesign, '`provinceId + productId`', '页面权威设计必须锁定合同跳转地区上下文。'],
  [productDesign, '固定 `unitPrice`、`dailyMaxQuantity`', '产品权威设计必须锁定新商品合同核心条款。'],
  [serverDesign, '`server/src/unified-contracts.js`', '服务器权威设计必须登记统一合同门面。'],
  [serverDesign, '客户端与 API 的合同时间统一以天表达', '服务器权威设计必须锁定合同时间单位。'],
]) requireText(source, token, message);
requireText(docsIndex, '`INDUSTRY_AND_PRODUCTION_DESIGN.md`', '设计索引必须路由产业合同规则。');
requireText(docsIndex, '`WAREHOUSE_EXPANSION_DESIGN.md`', '设计索引必须路由仓库与商品详情合同规则。');
requireText(docsIndex, '`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`', '设计索引必须路由合同页面规则。');
requireText(docsIndex, '`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`', '设计索引必须路由合同事务与 API 规则。');

for (const [source, token, message] of [
  [pageDesign, '玩家发布的采购／供应商品合同允许将总批次设置为 2～100 批', '页面权威设计不得把旧总批次模型继续描述为新发布规则。'],
  [pageDesign, '进行中合同卡先展示当前批次履约状态', '页面权威设计不得把旧当前批次卡片继续描述为新每日合同。'],
  [serverDesign, '承接时采购方冻结首批完整货款', '服务器权威设计不得把旧首批托管描述为每日合同当前规则。'],
  [serverDesign, '每批结算在一个事务中同时检查供应方冻结商品', '服务器权威设计不得把旧整批结算描述为每日合同当前规则。'],
  [serverDesign, '旧玩家长期商品合同迁移为默认地区的每日额度长期合同', '服务器权威设计不得声明实现不存在的强制旧长约迁移。'],
]) forbidText(source, token, message);
requireText(daily, 'CONTRACT_DAY_OFFSET_MS = 8 * 60 * 60 * 1000', '每日额度自然日必须与北京时间边界一致。');
requireText(daily, 'isDailySupplyContract(contract) ? normalizeDailyContract(contract, now) : contract', '旧商品合同迁移必须只规范已标记的每日合同。');
forbidText(daily, "contract?.totalDeliveries !== null", '每日合同迁移不得再用旧 totalDeliveries 是否为空判断并强制迁移旧长期合同。');
requireText(runtime, 'return executeRuntimeAction(this, user, requestMeta, now);', '无到期生产输入需求的普通动作必须保留既有单事务 fast path。');
requireText(audit, "supplyMode: contract.supplyMode === 'daily' ? 'daily' : null", '每日合同审计快照必须保留 daily 模式。');
requireText(audit, "totalDeliveredQuantity: contract.supplyMode === 'daily'", '每日合同审计快照必须保留累计真实交付数量。');
requireText(audit, "unit: 'quantity'", '每日合同历史完成事实必须按实际交付数量表达。');
requireText(audit, "if (contract?.supplyMode === 'daily') continue;", '每日合同不得进入旧下一批仓库预占审计计算。');

if (failures.length) {
  console.error(`地区化每日商品合同验证失败：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('地区化每日商品合同验证通过：按地区固定价、每日额度、合同时间按天；生产到期先使用正式合同，官方市场自动采购只在周期完成后执行。');
