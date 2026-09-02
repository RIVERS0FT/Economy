import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

const index = read('docs/README.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const warehouseDesign = read('docs/WAREHOUSE_EXPANSION_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const provinceEconomicPolicy = JSON.parse(read('shared/province-economic-level-policy.json'));
const provinceAccess = read('server/src/province-access.js');
const stateEconomicBaselines = read('server/src/state-economic-baselines.js');
const transport = read('server/src/transport.js');
const domain = read('server/src/domain.js');
const worldDeadlinePlanner = read('server/src/world-deadline-planner.js');
const storageV2 = read('server/src/world-storage-v2.js');
const actionRegistry = read('server/src/player-action-registry.js');
const stateSlices = read('server/shared/economy-state-slices.js');
const gameRoutes = read('server/src/game-routes.js');
const populationEconomy = read('server/src/population-economy.js');
const leaderboards = read('server/src/leaderboards.js');
const types = read('src/types.ts');
const gameApi = read('src/api/game.ts');
const viewModel = read('src/app/gameViewModel.ts');
const localPreview = read('src/app/LocalGamePreviewApp.tsx');
const provincePage = read('src/pages/ProvincePage.tsx');
const bankPage = read('src/pages/BankPage.tsx');
const contractPage = read('src/pages/ContractPage.tsx');
const warehousePanel = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
const transportPage = read('src/pages/TransportPage.tsx');
const routeDraft = read('src/components/shell/TransportRouteDraftContext.tsx');
const pageStack = read('src/navigation/playerPageStack.ts');
const navigation = read('src/config/navigation.ts');
const pageRouter = read('src/pages/PageRouter.tsx');
const gameShell = read('src/components/shell/GameShell.tsx');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const provinceMap = read('src/components/provinces/UsMainlandMap.tsx');
const provinceMapCss = read('src/styles/province-map.css');
const transportCss = read('src/styles/transport-page.css');
const scrollingPageSections = read('src/styles/scrolling-page-sections.css');
const main = read('src/main.tsx');
const provinceLogistics = read('src/utils/provinceLogistics.ts');
const provinceEconomicLevel = read('src/utils/provinceEconomicLevel.ts');
const provinceAccessTest = existsSync('server/test/province-access.test.js') ? read('server/test/province-access.test.js') : '';
const transportTest = existsSync('server/test/transport.test.js') ? read('server/test/transport.test.js') : '';

for (const owner of [
  '`PRODUCT_AND_GAMEPLAY_DESIGN.md`',
  '`WAREHOUSE_EXPANSION_DESIGN.md`',
  '`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`',
  '`UI_DESIGN_SYSTEM.md`',
  '`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`',
  '`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md`',
]) requireText(index, owner, `设计索引必须将州解锁与运输规则路由到 DESIGN owner：${owner}`);
requireText(productDesign, '新玩家首次进入游戏必须从 48 州中选择一块起始地块并永久绑定', '产品设计必须记录起始州选择。');
requireText(productDesign, '跨州商品只能通过付费运输在已解锁州之间流动', '产品设计必须记录付费运输边界。');
requireText(productDesign, '综合分数固定为 PCE `50%` + 平均周薪 `30%` + 常住人口 `20%`', '产品设计必须记录地区水平综合分数。');
requireText(productDesign, '1～5 级地区基础解锁费依次为 `1,500 / 2,500 / 4,000 / 6,000 / 9,000`', '产品设计必须锁定五档地区基础解锁费。');
requireText(productDesign, '每完整 `500 km` 增加 `300`', '产品设计必须锁定距离附加费。');
requireText(productDesign, '总费用最多 `20,000`', '产品设计必须锁定地区解锁费用上限。');

for (const text of [
  '固定 10 + 0.0002/单位/公里',
  '固定 50 + 0.0001/单位/公里',
  '固定 100 + 0.0006/单位/公里',
  '固定 100 + 0.02/公里',
  '固定 1,000 + 0.15/公里',
  '固定 500 + 0.05/公里',
  '一次性建线费',
  '60 秒 / 1,000 公里',
  '计入运输就业人口收入',
  '在途商品按起始州官方系统价计入玩家财富',
  '每名玩家最多保存 50 条运输路线',
  '站点数量不设上限',
  '非闭环默认 `one-way` 单程运输',
  '起始州-终点州',
  '`productId`、`quantity` 与 `autoDispatch` 不再属于路线',
  '路线创建后不得修改路径、行程类型或运输方式',
  '删除后重新建立必须重新支付建线费',
  '条件满足后立即自动发运',
  '每条路线同时最多一笔在途运输',
  '`manifest`',
  '`legPlan`',
  '正预期净价差',
  '不新增轮询器、后台扫描任务或离线定时器',
  '有运输在途时禁止删除路线',
]) requireText(warehouseDesign, text, `仓库设计缺少运输规则：${text}`);

for (const text of [
  '运输页只显示运输路线目录',
  '`transport-route`',
  '运输记录唯一显示在对应路线页面',
  '路线名称允许单独修改',
  '起始州-终点州',
  '创建前的路线只能通过唯一常驻战略地图编辑',
  '详情只读',
  '不得显示手动“发运”按钮',
  '按顺序点击已解锁州面追加站点',
]) requireText(pageDesign, text, `页面设计缺少运输页面规则：${text}`);

for (const text of [
  '在途运输标记',
  '同一 SVG 世界坐标系',
  '服务器权威时间',
  '正在运输的商品',
  'prefers-reduced-motion',
  '普通玩家页面的 `.page-card-scroll` 是页面主体纵向滚动容器',
  '细线分区',
  '公路、铁路、航空',
]) requireText(uiDesign, text, `UI 设计缺少运输地图/正文分区规则：${text}`);

for (const text of [
  'transportShipments',
  '`manifest`',
  '`legPlan`',
  '运输路线不保存商品、数量或自动发运开关',
  '正常世界推进',
]) requireText(serverDesign, text, `服务器设计缺少运输规则：${text}`);
requireText(orderBookDesign, '运输中的商品按起始州官方系统价计入玩家财富', '订单簿设计必须记录在途估值口径。');

if (provinceEconomicPolicy.version !== 1) failures.push('地区水平策略版本必须为 1。');
if (provinceEconomicPolicy.levelCount !== 5) failures.push('地区水平必须固定为五档。');
if (JSON.stringify(provinceEconomicPolicy.weights) !== JSON.stringify({ pceMillions: 0.5, averageWeeklyWage: 0.3, population: 0.2 })) failures.push('地区水平权重必须保持 PCE 50%、工资 30%、人口 20%。');
if (JSON.stringify(provinceEconomicPolicy.levelBaseCosts) !== JSON.stringify({ 1: 1500, 2: 2500, 3: 4000, 4: 6000, 5: 9000 })) failures.push('地区水平基础解锁费必须保持 1500/2500/4000/6000/9000。');
if (provinceEconomicPolicy.distanceStepKm !== 500 || provinceEconomicPolicy.distanceCostPerStep !== 300 || provinceEconomicPolicy.maxUnlockCost !== 20000) failures.push('地区解锁距离步长、附加费和上限必须保持 500km/300/20000。');
requireText(stateEconomicBaselines, "provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json'", '服务器经济基准必须读取共享地区水平策略。');
requireText(stateEconomicBaselines, 'stateEconomicLevelFor', '服务器经济基准必须导出地区水平。');
requireText(provinceAccess, 'stateEconomicLevelFor', '州访问模块必须使用服务器地区水平。');
requireText(provinceAccess, 'provinceUnlockBaseCostForLevel', '州访问模块必须按地区水平选择基础费用。');
requireText(provinceAccess, 'provinceUnlockCostBreakdown', '州访问模块必须提供权威费用拆分。');
requireText(provinceAccess, 'PROVINCE_UNLOCK_DISTANCE_STEP_KM', '州访问模块必须读取共享距离步长。');
requireText(provinceAccess, 'PROVINCE_UNLOCK_MAX_COST', '州访问模块必须读取共享费用上限。');
requireText(provinceAccess, 'applyChooseStartingProvince', '州访问模块必须提供起始州选择。');
requireText(provinceAccess, 'applyUnlockProvince', '州访问模块必须提供州解锁。');
requireText(provinceAccess, 'migrateProvinceAccess', '州访问模块必须提供老玩家迁移。');

for (const text of [
  'fixedCost: 10', 'fixedCost: 50', 'fixedCost: 100',
  'setupFixedCost: 100', 'setupFixedCost: 1000', 'setupFixedCost: 500',
  'setupCostPerKm: 0.02', 'setupCostPerKm: 0.15', 'setupCostPerKm: 0.05',
  'capacity: 100', 'capacity: 2000', 'capacity: 500',
  'timeFactor: 1.0', 'timeFactor: 2.0', 'timeFactor: 0.25',
  "creditPopulationEmployment(world, plan.cost, 'transportService')",
  "creditPopulationEmployment(world, setupCost, 'transportService')",
  'TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20',
  'TRANSPORT_MAX_ROUTES_PER_PLAYER = 50',
  'defaultTransportRouteName',
  'transportRouteSetupCost',
  'applyCreateTransportRoute',
  'applyUpdateTransportRoute',
  'applyRenameTransportRoute',
  'applyDeleteTransportRoute',
  'automaticManifestForRoute',
  'shipmentOpportunitySpread',
  'processAutomaticTransportRoutes',
  'migrateTransportWorld',
  'legPlan',
  'manifest',
  "message: '路线创建后不可修改，请删除后重新建立'",
]) requireText(transport, text, `运输模块缺少：${text}`);
forbidText(transport, 'applyDispatchTransportRoute', '运输模块不得恢复路线手动发运函数。');
forbidText(transport, "payload.operation === 'route-dispatch'", '运输模块不得恢复 route-dispatch 操作。');
forbidText(transport, 'autoDispatch: route.autoDispatch === true', '运输路线客户端状态不得恢复 autoDispatch。');
requireText(transport, "return { ok: false, message: '运输仅由已保存路线自动发运' }", '非路线管理运输动作必须明确拒绝手动发运。');
requireText(transport, "TRANSPORT_DEFAULT_TRIP_TYPE = 'one-way'", '运输模块必须默认单程。');
requireText(transport, 'remainingLoad', '运输模块必须按逐段剩余载荷计费。');

requireText(domain, "action === 'chooseStartingProvince'", '领域动作必须分发起始州选择。');
requireText(domain, "action === 'unlockProvince'", '领域动作必须分发州解锁。');
requireText(domain, "action === 'transportShip'", '领域动作必须分发运输。');
requireText(domain, 'processTransportWorld(world, now)', '世界推进必须结算运输并检查自动路线。');
requireText(domain, 'transportRoutes: transportRouteClientState(world, userId)', '客户端状态必须返回当前玩家路线。');
requireText(domain, 'provinceUnlockError(player, provinceId)', '商品下单必须校验州解锁。');
requireText(worldDeadlinePlanner, 'market: earlier(marketDeadline(world, normalizedNow), transportDeadline)', '运输截止时间必须进入会执行完整世界推进的调度域。');
requireText(storageV2, "'transportShipments'", '运输记录必须进入世界顶层 segment。');
requireText(storageV2, "case 'local-player':", '分段存储必须保留注册表驱动的局部玩家 Mutation Scope。');
requireText(storageV2, 'label: `local:${action}`', '局部玩家 Mutation Scope 必须保留动作标签。');
requireText(actionRegistry, "transportShip: defineAction({ rateLimitCategory: 'orders', mutationScope: 'local-player'", '运输动作必须在统一注册表声明局部玩家 Mutation Scope。');
requireText(actionRegistry, "chooseStartingProvince: defineAction({ mutationScope: 'local-player'", '起始州选择必须在统一注册表声明局部玩家 Mutation Scope。');
requireText(actionRegistry, "unlockProvince: defineAction({ mutationScope: 'local-player'", '州解锁必须在统一注册表声明局部玩家 Mutation Scope。');
requireText(stateSlices, "keys: Object.freeze(['transportRoutes'])", '运输路线必须显式归入 player.misc slice。');
requireText(stateSlices, "keys: Object.freeze(['transportShipments'])", '运输记录必须显式归入 market.misc slice。');
requireText(gameRoutes, "/api/game/provinces/starting", '游戏路由必须提供起始州选择。');
requireText(gameRoutes, "/api/game/provinces/unlock", '游戏路由必须提供州解锁。');
requireText(gameRoutes, "/api/game/transport", '游戏路由必须提供运输。');
requireText(populationEconomy, "source === 'transportService'", '人口经济必须支持运输就业来源。');
requireText(leaderboards, 'safeNonNegativeInteger(inventory?.inTransit)', '财富榜必须计入运输中库存。');

requireText(types, 'startingProvinceId: string;', '客户端类型必须声明起始州。');
requireText(types, 'unlockedProvinces: string[];', '客户端类型必须声明已解锁州。');
requireText(types, 'export interface TransportRoute', '客户端类型必须声明运输路线。');
requireText(types, 'transportRoutes?: TransportRoute[];', '客户端状态必须声明运输路线。');
requireText(types, 'routeId?: string;', '运输记录必须允许关联路线。');
requireText(types, 'name: string;', '运输路线客户端类型必须声明名称。');
requireText(types, 'manifest: TransportManifestItem[];', '运输记录客户端类型必须声明多商品货单。');
requireText(types, 'legPlan: TransportLegPlanEntry[];', '运输记录客户端类型必须声明逐段计划。');
requireText(types, 'transportShipments: TransportShipment[];', '客户端类型必须声明运输记录。');
requireText(types, 'inTransit: number;', '客户端类型必须声明在途库存。');
for (const [label, source] of [['game API', gameApi], ['view model', viewModel], ['local preview', localPreview]]) {
  forbidText(source, 'dispatchTransportRoute', `${label} 不得恢复手动路线发运入口。`);
}
forbidText(gameApi, "operation: 'route-dispatch'", '客户端 API 不得恢复 route-dispatch 请求。');
forbidText(gameApi, 'transportShip: (input:', '客户端 API 不得暴露直接运输动作。');
forbidText(viewModel, 'transportShip: (input:', '视图模型不得暴露直接运输动作。');
requireText(gameApi, 'renameTransportRoute', '客户端 API 必须提供独立路线改名动作。');
requireText(viewModel, 'renameTransportRoute', '视图模型必须提供独立路线改名动作。');
requireText(localPreview, 'renameTransportRoute', '本地预览必须与路线改名接口保持一致。');

requireText(provincePage, 'province-lock-content', '州页必须提供直接排列在正文的解锁内容。');
requireText(provincePage, 'provinceUnlockCostBreakdown', '州页必须使用共享解锁费用拆分。');
for (const text of ['label="地区水平"', 'label="地区基础费用"', 'label="距离费用"', 'label="解锁费用"']) requireText(provincePage, text, `州页解锁信息缺少：${text}`);
requireText(provincePage, 'model.unlockProvince(provinceId)', '州页解锁按钮必须调用解锁动作。');
requireText(provincePage, 'confirmedUnlockedProvinceIds', '州页必须在服务器确认后立即退出锁定视图。');
requireText(provincePage, "'正在解锁…'", '州页解锁按钮必须立即显示提交中状态。');
for (const text of ['WarehouseTransportPanel', 'warehouse-transport-panel', 'warehouse-transport-section', 'transportShip', 'transport-shipment-list']) {
  if (warehousePanel.includes(text)) failures.push(`仓库不得继续承载跨州运输：${text}`);
}
if (warehousePanel.includes('warehouse-product-card-in-transit')) failures.push('仓库商品卡不得显示在途数量；在途信息唯一归属运输功能。');

for (const text of [
  'data-transport-route-index="true"',
  "currentLocation?.type === 'transport-route'",
  "pushPage({ type: 'transport-route', routeId: route.id })",
  '路线名称',
  '保存名称',
  '当前运输',
  '运输记录',
  '等待发运',
  '一次性建线费',
  '路线创建后不可修改路径、行程或运输方式',
  'beginPicking()',
]) requireText(transportPage, text, `运输页缺少路线目录/详情规则：${text}`);
forbidText(transportPage, 'dispatchTransportRoute', '运输页不得恢复手动发运动作。');
forbidText(transportPage, 'ToggleField', '运输页不得恢复自动发运开关。');
forbidText(transportPage, 'IntegerInput', '运输路线不得恢复固定运输数量输入。');
forbidText(transportPage, 'SelectInput', '运输路线页不得恢复页面内路径/商品选择下拉。');
forbidText(transportPage, 'beginEditRoute(', '已保存路线不得恢复地图编辑入口。');
forbidText(transportPage, 'model.updateTransportRoute(', '运输页不得调用路线更新接口。');
requireText(routeDraft, 'mode: TransportModeId;', '地图路线草稿必须保留运输方式。');
forbidText(routeDraft, 'productId:', '路线草稿不得保存指定商品。');
forbidText(routeDraft, 'quantity:', '路线草稿不得保存固定运输数量。');
forbidText(routeDraft, 'autoDispatch:', '路线草稿不得保存自动发运开关。');

requireText(pageStack, "| { type: 'transport-route'; routeId: string }", '页面栈必须提供运输路线详情位置。');
requireText(pageStack, "if (location.type === 'transport-route') return 'transport';", '路线详情必须属于运输导航上下文。');
requireText(navigation, "{ id: 'transport', label: '运输' }", '一级导航必须包含运输。');
requireText(pageRouter, "transport: loadTransportPage", '页面路由必须预加载运输页。');
requireText(pageRouter, "case 'transport':", '页面路由必须渲染运输页。');
requireText(pageRouter, "transport: ['catalog', 'player.assets', 'player.misc', 'market.quotes', 'market.misc']", '运输页必须订阅库存、路线、州级市场报价和运输记录切片。');

requireText(gameShell, 'data-starting-province-overview="true"', '游戏外壳必须提供左侧起始州概览。');
requireText(gameShell, 'startingProvinceCandidateId', '游戏外壳必须把地图点击保存为临时起始州候选。');
requireText(gameShell, 'model.chooseStartingProvince(province.id)', '起始州必须在概览确认按钮中显式提交。');
requireText(gameShell, 'label="地区水平"', '起始州概览必须显示地区水平。');
for (const [label, visibleSource] of [['GameShell', gameShell], ['ProvincePage', provincePage], ['BankPage', bankPage], ['ContractPage', contractPage]]) forbidText(visibleSource, 'shortName', `${label} 玩家可见实现不得读取 shortName。`);
requireText(gameShell, "insetInlineStart: 'var(--strategic-panel-gap, 8px)'", '起始州概览必须锚定工作区左侧。');
if (gameShell.includes('starting-province-overlay') || gameShell.includes('starting-province-grid') || gameShell.includes('starting-province-option')) failures.push('不得恢复旧的起始州遮罩、按钮网格或州按钮列表。');

for (const text of [
  'shipmentOverlays',
  'data-active-transport-count',
  '正在运输',
  "routeDraft.updateDraft({ mode:",
  "routeDraft.updateDraft({ tripType:",
  'transportRouteSetupCost',
  '`saved-${route.mode}-${route.id}`',
  '`draft-${routeDraft.draft.mode}-route`',
  '一次性建线费',
]) requireText(strategicWorkspace, text, `战略地图运输集成缺少：${text}`);
requireText(strategicWorkspace, 'onPickStartingProvince', '战略地图必须提供起始州选点回调。');
requireText(strategicWorkspace, 'data-starting-province-picking', '战略地图必须标记起始州选择模式。');
requireText(strategicWorkspace, 'state.provinces.map((province) => province.id)', '起始州选择模式必须允许连续 48 州全部参与选点。');
for (const text of [
  'export interface ProvinceMapShipmentOverlay',
  'currentShipmentPosition',
  'className="province-map-shipment"',
  'shipment.cargo',
  'formatTransportDuration',
  'data-shipment-overlay-count',
]) requireText(provinceMap, text, `地图运输动画缺少：${text}`);
for (const text of ['.province-map-shipment', '.province-map-shipment-tooltip', '@media (prefers-reduced-motion: reduce)']) requireText(provinceMapCss, text, `地图运输样式缺少：${text}`);
for (const text of ['.transport-route-card', '.transport-route-name-editor', '.transport-shipment-list', '.transport-manifest-list']) requireText(transportCss, text, `运输页面样式缺少：${text}`);
for (const text of [
  ".page-card-scroll .ui-primary-surface",
  'border-radius: 0;',
  'border-top: 1px solid var(--color-divider);',
  ".province-map-route[data-route-id^='saved-road-']",
  ".province-map-route[data-route-id^='saved-rail-']",
  ".province-map-route[data-route-id^='saved-air-']",
  '.transport-map-picking-bar',
  'var(--mobile-below-status-top)',
  'var(--desktop-asset-bar-height, 64px)',
]) requireText(scrollingPageSections, text, `滚动正文/运输地图统一样式缺少：${text}`);
requireText(main, "import './styles/scrolling-page-sections.css';", '主样式入口必须加载滚动正文细线分区规则。');

requireText(provinceEconomicLevel, "provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json'", '客户端地区水平必须读取共享策略。');
requireText(provinceEconomicLevel, 'provinceEconomicLevelFor', '客户端必须提供地区水平计算。');
requireText(provinceLogistics, "provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json'", '客户端物流工具必须读取共享地区水平策略。');
requireText(provinceLogistics, 'provinceUnlockCostBreakdown', '客户端物流工具必须同步解锁费用拆分。');
requireText(provinceLogistics, 'PROVINCE_UNLOCK_DISTANCE_STEP_KM', '客户端物流工具必须同步距离步长。');
requireText(provinceLogistics, 'TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000', '客户端物流工具必须与服务器同步基准时间。');
requireText(provinceLogistics, 'TRANSPORT_MAX_ROUTES_PER_PLAYER = 50', '客户端物流工具必须同步路线数量上限。');
requireText(provinceLogistics, "TRANSPORT_DEFAULT_TRIP_TYPE: TransportTripType = 'one-way'", '客户端物流工具必须默认单程。');
for (const text of ['setupFixedCost: 100', 'setupFixedCost: 1000', 'setupFixedCost: 500', 'transportRouteSetupCost']) requireText(provinceLogistics, text, `客户端物流工具必须同步建线费：${text}`);

for (const name of [
  'new player chooses a permanent starting province before economic writes',
  'economic levels cover five tiers with monotonic base costs',
  'unlock cost follows economic level and distance and is deducted atomically',
  'world migration unlocks every state with existing assets',
]) if (!provinceAccessTest.includes(name)) failures.push(`州访问测试必须覆盖：${name}`);

for (const name of [
  'transport routes persist without current inventory and default to start-end names',
  'route creation requires the one-time setup cost and does not mutate state when funds are insufficient',
  'route path trip type and mode are immutable after creation while name remains editable',
  'profitable inventory automatically dispatches without a manual route action',
  'automatic cargo can combine products and fills transport capacity by expected unit spread',
  'routes wait silently until cargo and funds make an automatic shipment possible',
  'a route keeps at most one active shipment and starts the next trip after completion',
  'multi-stop manifests unload only the cargo assigned to each stop',
  'route deletion is blocked while its shipment is active and allowed after arrival',
  'deleting and recreating a route charges the one-time setup cost again',
  'legacy route goods and auto-dispatch fields migrate away while legacy shipments gain manifests and leg plans',
]) if (!transportTest.includes(name)) failures.push(`运输测试必须覆盖：${name}`);

if (failures.length > 0) {
  console.error('起始州、州解锁与跨州运输验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('起始州、州解锁与跨州运输验证通过：永久起始州、地区水平与距离解锁、路线建线费、创建后不可编辑、自动选货与自动发运、多商品货单、逐站交付、三种地图线型、状态栏安全编辑面板与细线正文分区均已锁定。');
