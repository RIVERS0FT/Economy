from pathlib import Path
import re

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 occurrence, got {count}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=0):
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    return next_text


# Transport client state schema: routes are corridors; shipments carry the actual cargo plan.
path = 'src/types.ts'
text = read(path)
text = sub_once(
    text,
    r"export interface TransportRoute \{.*?\n\}\n\nexport interface TransportShipment \{.*?\n\}\n",
    """export interface TransportManifestItem {\n  productId: string;\n  destinationProvinceId: string;\n  quantity: number;\n}\n\nexport interface TransportLegPlanEntry {\n  fromProvinceId: string;\n  toProvinceId: string;\n  departsAt: number;\n  arrivesAt: number;\n  remainingLoad: number;\n}\n\nexport interface TransportRoute {\n  id: string;\n  name: string;\n  sourceProvinceId: string;\n  destinationProvinceId: string;\n  viaProvinceIds?: string[];\n  tripType?: TransportTripType;\n  mode: TransportModeId;\n  createdAt: number;\n  updatedAt: number;\n}\n\nexport interface TransportShipment {\n  id: string;\n  routeId?: string;\n  routeName?: string;\n  sourceProvinceId: string;\n  destinationProvinceId: string;\n  viaProvinceIds?: string[];\n  tripType?: TransportTripType;\n  stopPlan: TransportStopPlanEntry[];\n  legPlan: TransportLegPlanEntry[];\n  manifest: TransportManifestItem[];\n  mode: TransportModeId;\n  cost: number;\n  departsAt: number;\n  arrivesAt: number;\n  status: TransportShipmentStatus;\n  createdAt: number;\n  arrivedAt?: number;\n}\n""",
    'transport state interfaces',
    re.S,
)
text = replace_once(text, 'export interface EconomyState {\n  version: 38;', 'export interface EconomyState {\n  version: 39;', 'EconomyState version')
write(path, text)

# Public client API no longer exposes manual shipping or compatibility-only product/quantity route fields.
path = 'src/api/game.ts'
text = read(path)
text = replace_once(
    text,
    """export interface TransportRouteInput {\n  sourceProvinceId: string;\n  destinationProvinceId: string;\n  viaProvinceIds?: string[];\n  tripType?: TransportTripType;\n  productId: string;\n  quantity: number;\n  mode: TransportModeId;\n}\n""",
    """export interface TransportRouteInput {\n  sourceProvinceId: string;\n  destinationProvinceId: string;\n  viaProvinceIds?: string[];\n  tripType?: TransportTripType;\n  mode: TransportModeId;\n}\n""",
    'TransportRouteInput',
)
text = replace_once(
    text,
    """  transportShip: (input: TransportRouteInput) => postAction('/transport', { ...input }),\n  createTransportRoute: (input: TransportRouteInput) => postAction('/transport', {\n    operation: 'route-create',\n    ...input,\n  }),\n  updateTransportRoute: (routeId: string, input: TransportRouteInput) => postAction('/transport', {\n    operation: 'route-update',\n    routeId,\n    ...input,\n  }),\n  deleteTransportRoute: (routeId: string) => postAction('/transport', {\n    operation: 'route-delete',\n    routeId,\n  }),\n  dispatchTransportRoute: (routeId: string) => postAction('/transport', {\n    operation: 'route-dispatch',\n    routeId,\n  }),\n""",
    """  createTransportRoute: (input: TransportRouteInput) => postAction('/transport', {\n    operation: 'route-create',\n    ...input,\n  }),\n  updateTransportRoute: (routeId: string, input: TransportRouteInput) => postAction('/transport', {\n    operation: 'route-update',\n    routeId,\n    ...input,\n  }),\n  renameTransportRoute: (routeId: string, name: string) => postAction('/transport', {\n    operation: 'route-rename',\n    routeId,\n    name,\n  }),\n  deleteTransportRoute: (routeId: string) => postAction('/transport', {\n    operation: 'route-delete',\n    routeId,\n  }),\n""",
    'transport game actions',
)
write(path, text)

# View model exposes only route management; transportShip remains only the server domain action name.
path = 'src/app/gameViewModel.ts'
text = read(path)
text = replace_once(text, '  type GameActionResult,\n', '  type GameActionResult,\n  type TransportRouteInput,\n', 'view model TransportRouteInput import')
text = text.replace('  TransportModeId,\n', '').replace('  TransportTripType,\n', '')
text = sub_once(
    text,
    r"  transportShip: \(input: \{.*?  dispatchTransportRoute: \(routeId: string\) => Promise<ActionResult>;\n",
    """  createTransportRoute: (input: TransportRouteInput) => Promise<ActionResult>;\n  updateTransportRoute: (routeId: string, input: TransportRouteInput) => Promise<ActionResult>;\n  renameTransportRoute: (routeId: string, name: string) => Promise<ActionResult>;\n  deleteTransportRoute: (routeId: string) => Promise<ActionResult>;\n""",
    'view model transport interface',
    re.S,
)
text = replace_once(
    text,
    """    transportShip: (input) => runAction('transportShip', () => gameActions.transportShip(input)),\n    createTransportRoute: (input) => runAction('transportShip', () => gameActions.createTransportRoute(input)),\n    updateTransportRoute: (routeId, input) => runAction('transportShip', () => gameActions.updateTransportRoute(routeId, input)),\n    deleteTransportRoute: (routeId) => runAction('transportShip', () => gameActions.deleteTransportRoute(routeId)),\n    dispatchTransportRoute: (routeId) => runAction('transportShip', () => gameActions.dispatchTransportRoute(routeId)),\n""",
    """    createTransportRoute: (input) => runAction('transportShip', () => gameActions.createTransportRoute(input)),\n    updateTransportRoute: (routeId, input) => runAction('transportShip', () => gameActions.updateTransportRoute(routeId, input)),\n    renameTransportRoute: (routeId, name) => runAction('transportShip', () => gameActions.renameTransportRoute(routeId, name)),\n    deleteTransportRoute: (routeId) => runAction('transportShip', () => gameActions.deleteTransportRoute(routeId)),\n""",
    'view model transport implementation',
)
write(path, text)

path = 'src/app/LocalGamePreviewApp.tsx'
text = read(path)
text = replace_once(
    text,
    """    transportShip: localOnlyAction,\n    createTransportRoute: localOnlyAction,\n    updateTransportRoute: localOnlyAction,\n    deleteTransportRoute: localOnlyAction,\n    dispatchTransportRoute: localOnlyAction,\n""",
    """    createTransportRoute: localOnlyAction,\n    updateTransportRoute: localOnlyAction,\n    renameTransportRoute: localOnlyAction,\n    deleteTransportRoute: localOnlyAction,\n""",
    'local preview transport actions',
)
write(path, text)

path = 'src/pages/TransportPage.tsx'
text = read(path)
text = replace_once(text, 'type TransportRouteView = TransportRoute & { name?: string };', 'type TransportRouteView = TransportRoute;', 'transport route view type')
text = sub_once(
    text,
    r"function shipmentManifest\(shipment: TransportShipmentView\): ManifestEntry\[] \{.*?\n\}\n\nexport function TransportPage",
    """function shipmentManifest(shipment: TransportShipmentView): ManifestEntry[] {\n  return Array.isArray(shipment.manifest) ? shipment.manifest : [];\n}\n\nexport function TransportPage""",
    'shipment manifest compatibility fallback',
    re.S,
)
text = replace_once(
    text,
    """  function mutationInput(route: RouteConfig) {\n    return {\n      sourceProvinceId: route.sourceProvinceId,\n      destinationProvinceId: route.destinationProvinceId,\n      viaProvinceIds: route.viaProvinceIds,\n      tripType: isTransportRouteClosed(route) ? 'one-way' as const : route.tripType ?? TRANSPORT_DEFAULT_TRIP_TYPE,\n      // Compatibility-only request fields. The server route schema no longer persists or reads them.\n      productId: '',\n      quantity: 1,\n      mode: route.mode,\n    };\n  }\n""",
    """  function mutationInput(route: RouteConfig) {\n    return {\n      sourceProvinceId: route.sourceProvinceId,\n      destinationProvinceId: route.destinationProvinceId,\n      viaProvinceIds: route.viaProvinceIds,\n      tripType: isTransportRouteClosed(route) ? 'one-way' as const : route.tripType ?? TRANSPORT_DEFAULT_TRIP_TYPE,\n      mode: route.mode,\n    };\n  }\n""",
    'route mutation input',
)
text = sub_once(
    text,
    r"    const renameInput = \{.*?    await runMutation\(`route-rename:\$\{route\.id\}`, \(\) => model\.updateTransportRoute\(route\.id, renameInput\)\);",
    "    await runMutation(`route-rename:${route.id}`, () => model.renameTransportRoute(route.id, name));",
    'route rename action',
    re.S,
)
write(path, text)

# Lock the client-facing API cleanup in the transport verifier.
path = 'scripts/verify-provincial-unlock-transport.mjs'
text = read(path)
text = replace_once(
    text,
    "const types = read('src/types.ts');\n",
    "const types = read('src/types.ts');\nconst gameApi = read('src/api/game.ts');\nconst viewModel = read('src/app/gameViewModel.ts');\nconst localPreview = read('src/app/LocalGamePreviewApp.tsx');\n",
    'transport verifier client sources',
)
text = replace_once(
    text,
    """requireText(types, 'routeId?: string;', '运输记录必须允许关联路线。');\nrequireText(types, 'transportShipments: TransportShipment[];', '客户端类型必须声明运输记录。');\nrequireText(types, 'inTransit: number;', '客户端类型必须声明在途库存。');\n""",
    """requireText(types, 'routeId?: string;', '运输记录必须允许关联路线。');\nrequireText(types, 'name: string;', '运输路线客户端类型必须声明名称。');\nrequireText(types, 'manifest: TransportManifestItem[];', '运输记录客户端类型必须声明多商品货单。');\nrequireText(types, 'legPlan: TransportLegPlanEntry[];', '运输记录客户端类型必须声明逐段计划。');\nrequireText(types, 'transportShipments: TransportShipment[];', '客户端类型必须声明运输记录。');\nrequireText(types, 'inTransit: number;', '客户端类型必须声明在途库存。');\nfor (const [label, source] of [['game API', gameApi], ['view model', viewModel], ['local preview', localPreview]]) {\n  forbidText(source, 'dispatchTransportRoute', `${label} 不得恢复手动路线发运入口。`);\n}\nforbidText(gameApi, "operation: 'route-dispatch'", '客户端 API 不得恢复 route-dispatch 请求。');\nforbidText(gameApi, 'transportShip: (input:', '客户端 API 不得暴露直接运输动作。');\nforbidText(viewModel, 'transportShip: (input:', '视图模型不得暴露直接运输动作。');\nrequireText(gameApi, 'renameTransportRoute', '客户端 API 必须提供独立路线改名动作。');\nrequireText(viewModel, 'renameTransportRoute', '视图模型必须提供独立路线改名动作。');\nrequireText(localPreview, 'renameTransportRoute', '本地预览必须与路线改名接口保持一致。');\n""",
    'transport verifier client protocol rules',
)
write(path, text)

# Exact authority wording used by the transport verifier.
path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path).replace('运输一级页只显示运输路线目录', '运输页只显示运输路线目录')
write(path, text)

# Client protocol 39 is a breaking boundary after main already adopted 38 for operation-method IDs.
path = 'server/shared/economy-state-version.js'
text = read(path)
text = replace_once(text, 'CURRENT_CLIENT_STATE_VERSION = 38', 'CURRENT_CLIENT_STATE_VERSION = 39', 'current client state version')
text = replace_once(text, 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 38', 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 39', 'minimum client state version')
write(path, text)

# All registered authority docs carry the current header version.
for doc_path in [
    'docs/README.md',
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    'docs/WAREHOUSE_EXPANSION_DESIGN.md',
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
    'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
]:
    content = read(doc_path)
    content = replace_once(content, '客户端状态版本：38', '客户端状态版本：39', f'{doc_path} header version')
    write(doc_path, content)

path = 'README.md'
text = read(path)
text = replace_once(text, '客户端状态 38、世界状态 32', '客户端状态 39、世界状态 32', 'README protocol version')
write(path, text)

path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '客户端状态版本 38 把 26 类工厂全部切换为具名作业制度并为每种制度增加 `iconId`。运输路线继续作为玩家可选状态保存。当前客户端只接受版本 38；',
    '客户端状态版本 38 把 26 类工厂全部切换为具名作业制度并为每种制度增加 `iconId`；客户端状态版本 39 将运输路线收敛为名称、路径、行程与运输方式配置，并把真实运输记录提升为多商品 `manifest` 与逐段 `legPlan`，同时移除客户端手动发运、固定商品和固定数量协议。当前客户端只接受版本 39；',
    'server design client version history',
)
write(path, text)

# Fixed-version regression scripts should follow the new current boundary while retaining historical prose.
for script in (ROOT / 'scripts').glob('*.mjs'):
    content = script.read_text(encoding='utf-8')
    updated = content
    updated = updated.replace('CURRENT_CLIENT_STATE_VERSION = 38', 'CURRENT_CLIENT_STATE_VERSION = 39')
    updated = updated.replace('MIN_COMPATIBLE_CLIENT_STATE_VERSION = 38', 'MIN_COMPATIBLE_CLIENT_STATE_VERSION = 39')
    updated = updated.replace('CURRENT_CLIENT_STATE_VERSION, 38', 'CURRENT_CLIENT_STATE_VERSION, 39')
    updated = updated.replace('MIN_COMPATIBLE_CLIENT_STATE_VERSION, 38', 'MIN_COMPATIBLE_CLIENT_STATE_VERSION, 39')
    updated = updated.replace("'客户端状态版本：38'", "'客户端状态版本：39'")
    updated = updated.replace('客户端版本 38', '客户端版本 39')
    if updated != content:
        script.write_text(updated, encoding='utf-8')

# Browser fixtures that represent the current state protocol must use 39.
for test_path in [
    'tests/browser/game-loading-lifecycle.spec.ts',
    'tests/browser/save-epoch-lifecycle.spec.ts',
]:
    content = read(test_path)
    if 'version: 38,' not in content:
        raise SystemExit(f'{test_path}: missing current version fixture')
    write(test_path, content.replace('version: 38,', 'version: 39,'))

# Fail the patch if old client transport entry points survived.
checks = {
    'src/api/game.ts': ['dispatchTransportRoute', "operation: 'route-dispatch'", 'transportShip: (input:'],
    'src/app/gameViewModel.ts': ['dispatchTransportRoute', 'transportShip: (input:'],
    'src/app/LocalGamePreviewApp.tsx': ['dispatchTransportRoute', 'transportShip: localOnlyAction'],
    'src/pages/TransportPage.tsx': ['Compatibility-only request fields', 'model.updateTransportRoute(route.id, renameInput)'],
}
for file_path, forbidden in checks.items():
    content = read(file_path)
    for token in forbidden:
        if token in content:
            raise SystemExit(f'{file_path}: stale transport protocol token: {token}')

print('transport protocol patch complete')
