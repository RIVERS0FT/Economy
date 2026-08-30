import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}

const index = read('docs/README.md');
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
const warehouseDesign = read('docs/WAREHOUSE_EXPANSION_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const provinceAccess = read('server/src/province-access.js');
const transport = read('server/src/transport.js');
const domain = read('server/src/domain.js');
const storageV2 = read('server/src/world-storage-v2.js');
const actionRegistry = read('server/src/player-action-registry.js');
const stateSlices = read('server/shared/economy-state-slices.js');
const gameRoutes = read('server/src/game-routes.js');
const populationEconomy = read('server/src/population-economy.js');
const leaderboards = read('server/src/leaderboards.js');
const types = read('src/types.ts');
const viewModel = read('src/app/gameViewModel.ts');
const gameApi = read('src/api/game.ts');
const provincePage = read('src/pages/ProvincePage.tsx');
const warehousePanel = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
const transportPage = read('src/pages/TransportPage.tsx');
const navigation = read('src/config/navigation.ts');
const pageRouter = read('src/pages/PageRouter.tsx');
const gameShell = read('src/components/shell/GameShell.tsx');
const provinceLogistics = read('src/utils/provinceLogistics.ts');
const provinceAccessTest = existsSync('server/test/province-access.test.js') ? read('server/test/province-access.test.js') : '';
const transportTest = existsSync('server/test/transport.test.js') ? read('server/test/transport.test.js') : '';

requireText(index, '新玩家起始州永久绑定、其他州按货币费用解锁', '设计索引必须登记起始州与解锁规则。');
requireText(index, 'scripts/verify-provincial-unlock-transport.mjs', '设计索引必须登记州解锁运输验证脚本。');
requireText(productDesign, '新玩家首次进入游戏必须从 48 州中选择一块起始地块并永久绑定', '产品设计必须记录起始州选择。');
requireText(productDesign, '跨州商品只能通过付费运输在已解锁州之间流动', '产品设计必须记录付费运输边界。');
requireText(warehouseDesign, '跨州运输', '仓库设计必须记录跨州运输章节。');
requireText(warehouseDesign, '固定 10 + 0.0002/单位/公里', '仓库设计必须锁定公路成本。');
requireText(warehouseDesign, '固定 50 + 0.0001/单位/公里', '仓库设计必须锁定铁路成本。');
requireText(warehouseDesign, '固定 100 + 0.0006/单位/公里', '仓库设计必须锁定航空成本。');
requireText(warehouseDesign, '60 秒 / 1,000 公里', '仓库设计必须锁定运输基准时间。');
requireText(warehouseDesign, '计入运输就业人口收入', '仓库设计必须记录运费计入运输就业。');
requireText(warehouseDesign, '在途商品按起始州官方系统价计入玩家财富', '仓库设计必须记录在途估值口径。');
requireText(warehouseDesign, '每名玩家最多保存 50 条运输路线', '仓库设计必须记录路线数量上限。');
requireText(warehouseDesign, '站点数量不设上限', '仓库设计必须记录站点数量无上限。');
requireText(warehouseDesign, '非闭环默认 `round` 往返运输', '仓库设计必须记录非闭环默认往返。');
requireText(warehouseDesign, '整链一次发运、逐站交付', '仓库设计必须记录整链一次发运逐站交付。');
requireText(warehouseDesign, '空驶段只按该段固定成本计费', '仓库设计必须记录空驶段计费口径。');
requireText(warehouseDesign, '旧路线（无 `viaProvinceIds`、无 `tripType`）与历史在途记录（无 `stopPlan`）按原单段语义', '仓库设计必须记录旧数据兼容边界。');
requireText(warehouseDesign, '路线只允许手动发运', '仓库设计必须记录路线不自动循环。');
requireText(pageDesign, '新玩家首次进入游戏必须先选择起始州', '页面设计必须记录起始州选择流程。');
requireText(pageDesign, '未解锁州仍保留“概览｜市场｜建筑｜仓库”四个分区', '页面设计必须记录未解锁州仍可浏览概览和市场。');
requireText(pageDesign, '收到服务器精简确认后立即退出锁定视图', '页面设计必须记录州解锁确认后的瞬时退出锁定视图。');
requireText(pageDesign, '跨州运输路线、发运与运输记录唯一显示在独立 `TransportPage`', '页面设计必须记录独立运输入口归属。');
requireText(pageDesign, '路线只允许玩家手动发运', '页面设计必须锁定路线手动发运边界。');
requireText(pageDesign, '在地图上选择', '页面设计必须记录地图选州入口。');
requireText(pageDesign, '按顺序点击已解锁州面追加站点', '页面设计必须记录按顺序选州规则。');
requireText(pageDesign, '按首府坐标顺序连接的路线连线', '页面设计必须记录首府顺序连线可视化。');
requireText(serverDesign, 'transportShipments', '服务器设计必须记录运输记录存储。');
requireText(serverDesign, '`stopPlan` 注册“下一未交付站”', '服务器设计必须记录逐站到达调度。');
requireText(orderBookDesign, '运输中的商品按起始州官方系统价计入玩家财富', '订单簿设计必须记录在途估值口径。');

requireText(provinceAccess, 'PROVINCE_UNLOCK_BASE_COST = 1500', '州访问模块必须锁定基础解锁费用。');
requireText(provinceAccess, 'PROVINCE_UNLOCK_COST_PER_500_KM = 300', '州访问模块必须锁定距离费用。');
requireText(provinceAccess, 'PROVINCE_UNLOCK_MAX_COST = 20000', '州访问模块必须锁定费用上限。');
requireText(provinceAccess, 'applyChooseStartingProvince', '州访问模块必须提供起始州选择。');
requireText(provinceAccess, 'applyUnlockProvince', '州访问模块必须提供州解锁。');
requireText(provinceAccess, 'migrateProvinceAccess', '州访问模块必须提供老玩家迁移。');
requireText(transport, 'fixedCost: 10', '运输模块必须锁定公路成本。');
requireText(transport, 'fixedCost: 50', '运输模块必须锁定铁路成本。');
requireText(transport, 'fixedCost: 100', '运输模块必须锁定航空成本。');
requireText(transport, 'capacity: 100', '运输模块必须锁定公路运量。');
requireText(transport, 'capacity: 2000', '运输模块必须锁定铁路运量。');
requireText(transport, 'capacity: 500', '运输模块必须锁定航空运量。');
requireText(transport, 'timeFactor: 1.0', '运输模块必须锁定公路时间系数。');
requireText(transport, 'timeFactor: 2.0', '运输模块必须锁定铁路时间系数。');
requireText(transport, 'timeFactor: 0.25', '运输模块必须锁定航空时间系数。');
requireText(transport, "creditPopulationEmployment(world, cost, 'transportService')", '运输模块必须把运费计入运输就业。');
requireText(transport, 'TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20', '运输模块必须锁定在途并发上限。');
requireText(transport, 'TRANSPORT_MAX_ROUTES_PER_PLAYER = 50', '运输模块必须锁定路线数量上限。');
requireText(transport, 'applyCreateTransportRoute', '运输模块必须提供路线创建。');
requireText(transport, 'applyUpdateTransportRoute', '运输模块必须提供路线编辑。');
requireText(transport, 'applyDeleteTransportRoute', '运输模块必须提供路线删除。');
requireText(transport, 'applyDispatchTransportRoute', '运输模块必须提供按路线发运。');
requireText(transport, "payload.operation === 'route-dispatch'", '运输动作必须分发路线发运操作。');
requireText(domain, "action === 'chooseStartingProvince'", '领域动作必须分发起始州选择。');
requireText(domain, "action === 'unlockProvince'", '领域动作必须分发州解锁。');
requireText(domain, "action === 'transportShip'", '领域动作必须分发运输。');
requireText(domain, 'processTransportWorld(world, now)', '世界推进必须结算到达到期。');
requireText(domain, 'transportRoutes: transportRouteClientState(world, userId)', '客户端状态必须返回当前玩家路线。');
requireText(domain, 'provinceUnlockError(player, provinceId)', '商品下单必须校验州解锁。');
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
requireText(types, 'transportShipments: TransportShipment[];', '客户端类型必须声明运输记录。');
requireText(types, 'inTransit: number;', '客户端类型必须声明在途库存。');
requireText(viewModel, 'chooseStartingProvince', '视图模型必须提供起始州选择动作。');
requireText(viewModel, 'unlockProvince', '视图模型必须提供州解锁动作。');
requireText(viewModel, 'transportShip', '视图模型必须提供运输动作。');
for (const action of ['createTransportRoute', 'updateTransportRoute', 'deleteTransportRoute', 'dispatchTransportRoute']) {
  requireText(viewModel, action, `视图模型必须提供 ${action}。`);
  requireText(gameApi, action, `游戏 API 必须提供 ${action}。`);
}
requireText(gameApi, "/provinces/starting", '游戏 API 必须提供起始州选择端点。');
requireText(gameApi, "/provinces/unlock", '游戏 API 必须提供州解锁端点。');
requireText(gameApi, "/transport", '游戏 API 必须提供运输端点。');
requireText(provincePage, 'province-lock-content', '州页必须提供直接排列在正文的解锁内容。');
requireText(provincePage, 'model.unlockProvince(provinceId)', '州页解锁按钮必须调用解锁动作。');
requireText(provincePage, 'confirmedUnlockedProvinceIds', '州页必须在服务器确认后立即退出锁定视图。');
requireText(provincePage, "'正在解锁…'", '州页解锁按钮必须立即显示提交中状态。');
for (const text of ['WarehouseTransportPanel', 'warehouse-transport-panel', 'warehouse-transport-section', 'transportShip', 'transport-shipment-list']) {
  if (warehousePanel.includes(text)) failures.push(`仓库不得继续承载跨州运输：${text}`);
}
if (warehousePanel.includes('warehouse-product-card-in-transit')) failures.push('仓库商品卡不得显示在途数量；在途信息唯一归属运输页。');
for (const text of ['title="运输"', 'title="运输路线"', 'title="运输记录"', '增加路线', 'createTransportRoute', 'updateTransportRoute', 'deleteTransportRoute', 'dispatchTransportRoute']) {
  requireText(transportPage, text, `运输页缺少：${text}`);
}
for (const text of ['在地图上选择', '每站数量', '交付站数', '追加中间站', '往返运输（默认）', 'useTransportRouteDraft']) {
  requireText(transportPage, text, `运输页多站点编辑缺少：${text}`);
}
requireText(navigation, "{ id: 'transport', label: '运输' }", '一级导航必须包含运输。');
requireText(pageRouter, "transport: loadTransportPage", '页面路由必须预加载运输页。');
requireText(pageRouter, "case 'transport':", '页面路由必须渲染运输页。');
requireText(pageRouter, "transport: ['catalog', 'player.assets', 'player.misc', 'market.misc']", '运输页必须只订阅既有运输相关状态切片。');
requireText(gameShell, 'starting-province-overlay', '游戏外壳必须提供起始州选择浮层。');
requireText(provinceLogistics, 'PROVINCE_UNLOCK_BASE_COST = 1500', '客户端物流工具必须与服务器同步基础费用。');
requireText(provinceLogistics, 'PROVINCE_UNLOCK_COST_PER_500_KM = 300', '客户端物流工具必须与服务器同步距离费用。');
requireText(provinceLogistics, 'TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000', '客户端物流工具必须与服务器同步基准时间。');
requireText(provinceLogistics, 'TRANSPORT_MAX_ROUTES_PER_PLAYER = 50', '客户端物流工具必须同步路线数量上限。');

if (!provinceAccessTest.includes('new player chooses a permanent starting province before economic writes')) {
  failures.push('州访问测试必须覆盖起始州选择。');
}
if (!provinceAccessTest.includes('world migration unlocks every state with existing assets')) {
  failures.push('州访问测试必须覆盖老玩家迁移。');
}
if (!transportTest.includes('road transport moves goods into in-transit and charges the mode cost')) {
  failures.push('运输测试必须覆盖公路发货。');
}
if (!transportTest.includes('arrival processing moves goods into the destination warehouse')) {
  failures.push('运输测试必须覆盖到达结算。');
}
if (!transportTest.includes('locked destination rejects transport')) {
  failures.push('运输测试必须覆盖锁定州拒绝。');
}
if (!transportTest.includes('transport routes persist without requiring current inventory or funds')) {
  failures.push('运输测试必须覆盖路线配置与当前库存资金解耦。');
}
if (!transportTest.includes('dispatching and deleting a route leaves the shipment in transit')) {
  failures.push('运输测试必须覆盖删除路线不影响在途运输。');
}
if (!transportTest.includes('transport route limit is enforced')) {
  failures.push('运输测试必须覆盖路线数量上限。');
}
for (const name of [
  'multi-stop routes validate ordered stations without a station cap',
  'round-trip dispatch delivers every stop and charges empty return legs once',
  'closed loop dispatch returns to the starting state as one in-transit shipment',
  'staged arrivals settle each stop at its own deadline',
]) {
  if (!transportTest.includes(name)) failures.push(`运输测试必须覆盖多站点规则：${name}`);
}

if (failures.length > 0) {
  console.error('起始州、州解锁与跨州运输验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('起始州、州解锁与跨州运输验证通过：永久起始州、货币解锁、三种运输模式参数、运费计入运输就业、在途按起始州官方价估值、锁定州写拒绝、持久化手动路线、独立运输页与老玩家迁移均已锁定。');