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
const gameRoutes = read('server/src/game-routes.js');
const populationEconomy = read('server/src/population-economy.js');
const leaderboards = read('server/src/leaderboards.js');
const types = read('src/types.ts');
const viewModel = read('src/app/gameViewModel.ts');
const gameApi = read('src/api/game.ts');
const provincePage = read('src/pages/ProvincePage.tsx');
const warehousePanel = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
const gameShell = read('src/components/shell/GameShell.tsx');
const provinceLogistics = read('src/utils/provinceLogistics.ts');
const provinceAccessTest = existsSync('server/test/province-access.test.js') ? read('server/test/province-access.test.js') : '';
const transportTest = existsSync('server/test/transport.test.js') ? read('server/test/transport.test.js') : '';

requireText(index, '新玩家起始州永久绑定、其他州按货币费用解锁', '设计索引必须登记起始州与解锁规则。');
requireText(index, 'scripts/verify-provincial-unlock-transport.mjs', '设计索引必须登记州解锁运输验证脚本。');
requireText(productDesign, '新玩家首次进入游戏必须从 48 州中选择一块起始地块并永久绑定', '产品设计必须记录起始州选择。');
requireText(productDesign, '跨州商品只能通过付费运输在已解锁州之间流动', '产品设计必须记录付费运输边界。');
requireText(warehouseDesign, '## 3. 跨州运输', '仓库设计必须记录跨州运输章节。');
requireText(warehouseDesign, '固定 10 + 0.0002/单位/公里', '仓库设计必须锁定公路成本。');
requireText(warehouseDesign, '固定 50 + 0.0001/单位/公里', '仓库设计必须锁定铁路成本。');
requireText(warehouseDesign, '固定 100 + 0.0006/单位/公里', '仓库设计必须锁定航空成本。');
requireText(warehouseDesign, '60 秒 / 1,000 公里', '仓库设计必须锁定运输基准时间。');
requireText(warehouseDesign, '计入运输就业人口收入', '仓库设计必须记录运费计入运输就业。');
requireText(warehouseDesign, '在途商品按起始州官方系统价计入玩家财富', '仓库设计必须记录在途估值口径。');
requireText(pageDesign, '新玩家首次进入游戏必须先选择起始州', '页面设计必须记录起始州选择流程。');
requireText(pageDesign, '未解锁州点击后只显示解锁面板', '页面设计必须记录解锁面板。');
requireText(pageDesign, '跨州运输发货与在途记录唯一显示在仓库分区', '页面设计必须记录运输入口归属。');
requireText(serverDesign, 'transportShipments', '服务器设计必须记录运输记录存储。');
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
requireText(domain, "action === 'chooseStartingProvince'", '领域动作必须分发起始州选择。');
requireText(domain, "action === 'unlockProvince'", '领域动作必须分发州解锁。');
requireText(domain, "action === 'transportShip'", '领域动作必须分发运输。');
requireText(domain, 'processTransportWorld(world, now)', '世界推进必须结算到达到期。');
requireText(domain, 'provinceUnlockError(player, provinceId)', '商品下单必须校验州解锁。');
requireText(storageV2, "'transportShipments'", '运输记录必须进入世界顶层 segment。');
requireText(gameRoutes, "/api/game/provinces/starting", '游戏路由必须提供起始州选择。');
requireText(gameRoutes, "/api/game/provinces/unlock", '游戏路由必须提供州解锁。');
requireText(gameRoutes, "/api/game/transport", '游戏路由必须提供运输。');
requireText(populationEconomy, "source === 'transportService'", '人口经济必须支持运输就业来源。');
requireText(leaderboards, 'safeNonNegativeInteger(inventory?.inTransit)', '财富榜必须计入运输中库存。');

requireText(types, 'startingProvinceId: string;', '客户端类型必须声明起始州。');
requireText(types, 'unlockedProvinces: string[];', '客户端类型必须声明已解锁州。');
requireText(types, 'transportShipments: TransportShipment[];', '客户端类型必须声明运输记录。');
requireText(types, 'inTransit: number;', '客户端类型必须声明在途库存。');
requireText(viewModel, 'chooseStartingProvince', '视图模型必须提供起始州选择动作。');
requireText(viewModel, 'unlockProvince', '视图模型必须提供州解锁动作。');
requireText(viewModel, 'transportShip', '视图模型必须提供运输动作。');
requireText(gameApi, "/provinces/starting", '游戏 API 必须提供起始州选择端点。');
requireText(gameApi, "/provinces/unlock", '游戏 API 必须提供州解锁端点。');
requireText(gameApi, "/transport", '游戏 API 必须提供运输端点。');
requireText(provincePage, 'province-lock-panel', '州页必须提供解锁面板。');
requireText(provincePage, 'unlockProvince(model.selectedProvinceId)', '州页解锁按钮必须调用解锁动作。');
requireText(warehousePanel, 'warehouse-transport-section', '仓库必须提供运输区。');
requireText(warehousePanel, 'transportShip', '仓库运输表单必须调用运输动作。');
requireText(warehousePanel, 'warehouse-transport-panel', '跨州运输必须使用独立一级卡片。');
requireText(warehousePanel, 'transport-shipment-list', '独立跨州运输卡必须显示进行中的运输记录。');
requireText(warehousePanel, "shipment.status === 'in-transit'", '跨州运输卡必须读取真实在途状态。');
if (warehousePanel.includes('warehouse-product-card-in-transit')) failures.push('仓库商品卡不得显示在途数量；在途信息唯一归属跨州运输卡。');
requireText(gameShell, 'starting-province-overlay', '游戏外壳必须提供起始州选择浮层。');
requireText(provinceLogistics, 'PROVINCE_UNLOCK_BASE_COST = 1500', '客户端物流工具必须与服务器同步基础费用。');
requireText(provinceLogistics, 'PROVINCE_UNLOCK_COST_PER_500_KM = 300', '客户端物流工具必须与服务器同步距离费用。');
requireText(provinceLogistics, 'TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000', '客户端物流工具必须与服务器同步基准时间。');

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

if (failures.length > 0) {
  console.error('起始州、州解锁与跨州运输验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('起始州、州解锁与跨州运输验证通过：永久起始州、货币解锁、三种运输模式参数、运费计入运输就业、在途按起始州官方价估值、锁定州写拒绝与老玩家迁移均已锁定。');
