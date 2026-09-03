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
const transportPolicy = read('shared/transport-policy.js');
const provinceAccess = read('server/src/province-access.js');
const stateEconomicBaselines = read('server/src/state-economic-baselines.js');
const transport = read('server/src/transport.js');
const domain = read('server/src/domain.js');
const worldDeadlinePlanner = read('server/src/world-deadline-planner.js');
const storageV2 = read('server/src/world-storage-v2.js');
const actionRegistry = read('server/src/player-action-registry.js');
const stateSlices = read('server/shared/economy-state-slices.js');
const statePartitions = read('server/src/state-partitions.js');
const gameRoutes = read('server/src/game-routes.js');
const populationEconomy = read('server/src/population-economy.js');
const leaderboards = read('server/src/leaderboards.js');
const types = read('src/types.ts');
const gameApi = read('src/api/game.ts');
const viewModel = read('src/app/gameViewModel.ts');
const localPreview = read('src/app/LocalGamePreviewApp.tsx');
const provincePage = read('src/pages/ProvincePage.tsx');
const warehousePanel = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
const transportPage = read('src/pages/TransportPage.tsx');
const transportCoordinator = read('src/transport/useOnlineTransport.ts');
const routeDraft = read('src/components/shell/TransportRouteDraftContext.tsx');
const pageStack = read('src/navigation/playerPageStack.ts');
const navigation = read('src/config/navigation.ts');
const pageRouter = read('src/pages/PageRouter.tsx');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const gameShell = read('src/components/shell/GameShell.tsx');
const provinceMap = read('src/components/provinces/UsMainlandMap.tsx');
const provinceMapCss = read('src/styles/province-map.css');
const transportCss = read('src/styles/transport-page.css');
const provinceLogistics = read('src/utils/provinceLogistics.ts');
const provinceEconomicLevel = read('src/utils/provinceEconomicLevel.ts');
const transportTest = existsSync('server/test/transport.test.js') ? read('server/test/transport.test.js') : '';

for (const owner of [
  '`PRODUCT_AND_GAMEPLAY_DESIGN.md`',
  '`WAREHOUSE_EXPANSION_DESIGN.md`',
  '`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`',
  '`UI_DESIGN_SYSTEM.md`',
  '`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`',
  '`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md`',
]) requireText(index, owner, `设计索引必须将州解锁与运输规则路由到 DESIGN owner：${owner}`);

requireText(productDesign, '连续 48 州从玩家首次建档起全部可直接经营，不存在起始州选择、地区解锁或解锁费用', '产品设计必须记录 48 州默认开放。');
requireText(pageDesign, '实现层不得保留仅靠固定 `false` 关闭的 `StartingProvinceOverview`', '页面设计必须禁止保留可重新启用的起始州死分支。');
requireText(pageDesign, '`UsMainlandMap` 不接受 `unlockedProvinceIds` 或 `locked` 访问状态', '页面设计必须禁止地图恢复锁定州访问状态。');
requireText(productDesign, '跨州商品只能通过付费运输在连续 48 州之间流动', '产品设计必须记录全州运输边界。');
requireText(productDesign, '综合分数固定为 PCE `50%` + 平均周薪 `30%` + 常住人口 `20%`', '产品设计必须记录地区水平综合分数。');

for (const text of [
  '起始州与目的州相同即为环线',
  '起始州与目的州不相同即固定为往返路线',
  '运输费和燃料仅按距离收取，一次性结算',
  '周期运输费 = 完整周期距离 × 运输方式 transportFeePerKm',
  '整周期燃料量 = 完整周期距离 × 运输方式 fuelPerKm',
  '服务器不再遍历全部商品和全部交付节点寻找“最优货物”',
  '车辆每到一个节点都进入 `docked` 停靠态',
  '玩家离线 10 分钟或 10 天，单次恢复都最多完成当前一段',
  '`transportRoutes` 与进行中／历史 `transportShipments` 均属于玩家私有运输状态',
  '每名玩家最多保存 50 条路线',
  '同时真正处于 `in-transit` 的运输最多 20 笔',
  '客户端状态版本保持 39，世界状态版本保持 32',
]) requireText(warehouseDesign, text, `仓库设计缺少节点循环运输规则：${text}`);

for (const text of [
  '运输页只显示运输路线目录',
  '`transport-route`',
  '运输记录唯一显示在对应路线页面',
  '路线名称允许单独修改',
  '创建前的路线只能通过唯一常驻战略地图编辑',
  '不得显示手动“发运”按钮',
  '起终点相同',
  '固定往返',
  '节点装卸',
  '周期运输费',
  '周期燃料费',
]) requireText(pageDesign, text, `页面设计缺少新运输页面规则：${text}`);

for (const text of [
  '在途运输标记',
  '同一 SVG 世界坐标系',
  '服务器权威时间',
  '正在运输的商品',
  'prefers-reduced-motion',
  '公路、铁路、航空',
]) requireText(uiDesign, text, `UI 设计缺少运输地图规则：${text}`);

for (const text of [
  '`cycle-start`',
  '`node-service`',
  '`docked`',
  '客户端负责节点装卸规划',
  '服务端只结算当前到期运输段',
  '`transportShipments` 与 `transportRoutes` 一并归入 `player.misc`',
]) requireText(serverDesign, text, `服务器设计缺少新运输权威边界：${text}`);
requireText(orderBookDesign, '运输中的商品按起始州官方系统价计入玩家财富', '订单簿设计必须记录在途估值口径。');

if (provinceEconomicPolicy.version !== 2) failures.push('地区水平策略版本必须为 2。');
if (provinceEconomicPolicy.levelCount !== 5) failures.push('地区水平必须固定为五档。');
if (JSON.stringify(provinceEconomicPolicy.weights) !== JSON.stringify({ pceMillions: 0.5, averageWeeklyWage: 0.3, population: 0.2 })) failures.push('地区水平权重必须保持 PCE 50%、工资 30%、人口 20%。');
for (const retiredField of ['levelBaseCosts', 'distanceStepKm', 'distanceCostPerStep', 'maxUnlockCost']) {
  if (Object.hasOwn(provinceEconomicPolicy, retiredField)) failures.push(`地区水平策略不得继续携带解锁字段：${retiredField}`);
}
requireText(stateEconomicBaselines, "provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json'", '服务器经济基准必须读取共享地区水平策略。');
forbidText(stateEconomicBaselines, 'for (const provinceId of player?.unlockedProvinces', '人口需求激活不得重新读取 legacy unlockedProvinces。');
requireText(stateEconomicBaselines, "const startingProvinceId = String(player?.startingProvinceId || '');", '人口需求必须保留兼容默认经营地区作为经济足迹。');
requireText(stateEconomicBaselines, 'for (const group of player?.facilityGroups || [])', '人口需求必须继续读取实际工厂经营足迹。');
for (const text of ['provinceDistanceKm', 'isProvinceUnlocked', 'provinceUnlockError', 'applyChooseStartingProvince', 'applyUnlockProvince', 'migrateProvinceAccess']) {
  requireText(provinceAccess, text, `州访问模块缺少：${text}`);
}
for (const text of ['provinceUnlockBaseCostForLevel', 'provinceUnlockCostBreakdown', 'PROVINCE_UNLOCK_']) {
  forbidText(provinceAccess, text, `州访问模块不得恢复地区解锁计价：${text}`);
}
requireText(provinceAccess, 'player.unlockedProvinces = PROVINCE_CATALOG.map((province) => province.id);', '兼容州访问字段必须归一为连续 48 州。');

for (const text of [
  "id: 'road'", "id: 'rail'", "id: 'air'",
  'setupFixedCost: 100', 'setupFixedCost: 1000', 'setupFixedCost: 500',
  'setupCostPerKm: 0.02', 'setupCostPerKm: 0.15', 'setupCostPerKm: 0.05',
  'transportFeePerKm: 0.02', 'transportFeePerKm: 0.17', 'transportFeePerKm: 0.27',
  'fuelPerKm: 0.01', 'fuelPerKm: 0.08', 'fuelPerKm: 0.13',
  'capacity: 100', 'capacity: 2000', 'capacity: 500',
  'timeFactor: 1.0', 'timeFactor: 2.0', 'timeFactor: 0.25',
]) requireText(transportPolicy, text, `共享运输策略缺少：${text}`);
forbidText(transportPolicy, 'unitCostPerKm', '共享运输策略不得恢复按货量计费。');
forbidText(transportPolicy, 'fixedCost:', '共享运输策略不得恢复每段固定运输费。');

for (const text of [
  'TRANSPORT_MODE_POLICY,',
  "from '../../shared/transport-policy.js'",
  'TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20',
  'TRANSPORT_MAX_ROUTES_PER_PLAYER = 50',
  'transportCycleDistanceKm',
  'transportCycleCost',
  'applyCreateTransportRoute',
  'applyStartTransportCycle',
  'applyServiceTransportNode',
  "payload.operation === 'cycle-start'",
  "payload.operation === 'node-service'",
  "shipment.status = 'docked'",
  'migrateTransportWorld',
  "creditPopulationEmployment(world, cycleCost.totalCost, 'transportService')",
  "message: '路线创建后不可修改，请删除后重新建立'",
]) requireText(transport, text, `运输模块缺少：${text}`);
for (const text of [
  'automaticManifestForRoute',
  'shipmentOpportunitySpread',
  'processAutomaticTransportRoutes',
  'getOrderBookSummary',
  'marketReferencePrice',
  'unitCostPerKm',
  "payload.operation === 'route-dispatch'",
]) forbidText(transport, text, `运输服务端不得恢复旧自动选货／货量计费：${text}`);

requireText(domain, "action === 'transportShip'", '领域动作必须分发运输。');
requireText(domain, 'processTransportWorld(world, now)', '世界推进必须结算当前运输段。');
requireText(worldDeadlinePlanner, 'market: earlier(marketDeadline(world, normalizedNow), transportDeadline)', '运输截止时间必须进入现有世界 deadline 域。');
requireText(storageV2, "'transportShipments'", '运输运行态必须继续进入现有世界顶层 segment。');
requireText(actionRegistry, "transportShip: defineAction({ rateLimitCategory: 'orders', mutationScope: 'local-player'", '运输动作必须保持局部玩家 Mutation Scope。');
requireText(gameRoutes, "/api/game/transport", '游戏路由必须提供运输动作。');
requireText(populationEconomy, "source === 'transportService'", '人口经济必须支持运输就业来源。');
requireText(leaderboards, 'safeNonNegativeInteger(inventory?.inTransit)', '财富榜必须计入运输中库存。');

requireText(stateSlices, "keys: Object.freeze(['transportRoutes', 'transportShipments'])", '路线和运行态必须共同归入 player.misc。');
forbidText(stateSlices, "keys: Object.freeze(['transportShipments'])", '运输运行态不得继续独占 market.misc。');
forbidText(statePartitions, "'transportShipments',", 'transportShipments 不得继续进入 MARKET_KEYS。');
requireText(pageRouter, "transport: ['catalog', 'player.assets', 'player.misc', 'market.quotes']", '运输页必须消费玩家私有运输切片与行情摘要。');

for (const text of ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'chooseStartingProvince']) {
  forbidText(gameShell, text, `应用外壳不得保留起始州选择分支：${text}`);
}
for (const text of ['startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'unlockedProvinceIds']) {
  forbidText(strategicWorkspace, text, `战略地图不得保留地区访问门禁：${text}`);
}
for (const text of ['unlockedProvinceIds', 'locked: boolean', 'data-locked=', 'province-map-tooltip__locked', '--color-map-region-locked']) {
  forbidText(provinceMap, text, `地图组件不得保留地区访问状态：${text}`);
}
for (const text of ['chooseStartingProvince', 'unlockProvince', '/provinces/starting', '/provinces/unlock']) {
  forbidText(gameApi, text, `正式客户端 API 不得暴露已退役地区访问动作：${text}`);
  forbidText(viewModel, text, `正式客户端 ViewModel 不得暴露已退役地区访问动作：${text}`);
}
for (const text of ['chooseStartingProvince', 'unlockProvince', 'startingProvinceChosen', 'unlockedProvinces']) {
  forbidText(localPreview, text, `本地预览不得依赖已退役地区访问状态：${text}`);
}
for (const text of ['ProvinceUnlockPanel', 'provinceUnlockCostBreakdown', 'model.unlockProvince(', 'province-unlock-button']) {
  forbidText(provincePage, text, `地区页不得恢复解锁 UI：${text}`);
}
for (const text of ['PROVINCE_UNLOCK_', 'provinceUnlockCostBreakdown']) {
  forbidText(provinceLogistics, text, `客户端运输工具不得恢复地区解锁计价：${text}`);
}

for (const text of [
  "TransportShipmentStatus = 'in-transit' | 'docked' | 'arrived'",
  'cycleDistanceKm?: number;',
  'cycleTransportFee?: number;',
  'cycleFuelCost?: number;',
  'currentVisitIndex?: number;',
  'transportShipments: TransportShipment[];',
  'inTransit: number;',
]) requireText(types, text, `客户端类型缺少：${text}`);
for (const text of ['startTransportCycle', 'serviceTransportNode', "operation: 'cycle-start'", "operation: 'node-service'"]) {
  requireText(gameApi, text, `客户端运输 API 缺少：${text}`);
}
for (const [label, source] of [['view model', viewModel], ['local preview', localPreview]]) {
  forbidText(source, 'dispatchTransportRoute', `${label} 不得恢复手动路线发运入口。`);
}

for (const text of [
  'subscribeStateAuthorityDependencies(',
  "['catalog', 'player.assets', 'player.misc', 'market.quotes']",
  'gameActions.startTransportCycle',
  'gameActions.serviceTransportNode',
  'routeHasFutureOpportunity',
  'planUnload',
  'planLoad',
]) requireText(transportCoordinator, text, `在线运输协调器缺少：${text}`);
forbidText(transportCoordinator, 'setInterval', '在线运输协调器不得新增轮询器。');

for (const text of [
  'data-transport-route-index="true"',
  "currentLocation?.type === 'transport-route'",
  '等待在线规划',
  '节点装卸',
  '周期距离',
  '周期运输费',
  '周期燃料费',
  '周期总费用',
  '客户端离线时车辆最多到达当前下一节点',
]) requireText(transportPage, text, `运输页缺少新周期/节点状态：${text}`);
forbidText(transportPage, 'dispatchTransportRoute', '运输页不得恢复手动发运动作。');
forbidText(transportPage, 'ToggleField', '运输页不得恢复自动发运开关。');
forbidText(transportPage, 'IntegerInput', '运输路线不得恢复固定运输数量输入。');

requireText(routeDraft, 'mode: TransportModeId;', '地图路线草稿必须保留运输方式。');
forbidText(routeDraft, 'productId:', '路线草稿不得保存指定商品。');
forbidText(routeDraft, 'quantity:', '路线草稿不得保存固定运输数量。');
forbidText(routeDraft, 'autoDispatch:', '路线草稿不得保存自动发运开关。');
for (const text of [
  '起终点不同则自动沿原路往返',
  'label="运输方式"',
  "tripType: closed ? 'one-way' : 'round'",
]) requireText(strategicWorkspace, text, `战略地图路线编辑缺少：${text}`);
forbidText(strategicWorkspace, 'label="行程"', '战略地图不得恢复玩家可选单程/往返控件。');

requireText(pageStack, "| { type: 'transport-route'; routeId: string }", '页面栈必须提供运输路线详情位置。');
requireText(navigation, "{ id: 'transport', label: '运输' }", '一级导航必须保留运输入口。');
for (const text of ['routeOverlays', 'shipmentOverlays', 'province-map-route-path', 'province-map-shipment']) {
  requireText(provinceMap, text, `美国地图缺少运输可视化：${text}`);
}
for (const text of ['.province-map-route-path', '.province-map-shipment']) requireText(provinceMapCss, text, `地图样式缺少：${text}`);
requireText(transportCss, '.transport-page-content', '运输页样式必须保留内容区。');

for (const text of [
  'TRANSPORT_MODE_POLICY',
  'transportCycleDistanceKm',
  'transportCycleCost',
  'return [...stops, ...stops.slice(0, -1).reverse()]',
]) requireText(provinceLogistics, text, `客户端运输计算缺少：${text}`);
forbidText(provinceLogistics, 'unitCostPerKm', '客户端不得恢复按货量运输费。');
requireText(provinceEconomicLevel, 'provinceEconomicLevelPolicy', '客户端地区水平必须读取共享策略。');

for (const text of [
  'cycle transport fee and fuel depend only on full-cycle distance',
  'offline/world processing only docks the current leg and never departs the next leg',
  'client node service unloads and loads atomically without another fee',
  'legacy in-transit shipment migrates without fuel backcharge and stops at its next node',
]) requireText(transportTest, text, `运输测试缺少：${text}`);

if (warehousePanel.includes('WarehouseTransportPanel')) failures.push('仓库不得继续承载跨州运输。');
if (warehousePanel.includes('warehouse-product-card-in-transit')) failures.push('仓库商品卡不得显示在途数量；在途信息唯一归属运输功能。');
forbidText(provincePage, 'model.unlockProvince(', '州页不得恢复地区解锁动作。');

if (failures.length) {
  console.error(`州级经济与节点循环运输验证失败：\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('州级经济与节点循环运输验证通过：路线形态、客户端装卸、距离计费、整周期燃料预付、单段离线到站与私有状态切片均已锁定。');
