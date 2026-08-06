#!/usr/bin/env python3
from pathlib import Path


def replace_once(text: str, old: str, new: str, path: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    return text.replace(old, new, 1)


path = Path('server/src/domain-core.js')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));\n",
    "const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));\n"
    "const STARTER_CONSTRUCTION_MATERIALS = Object.freeze({ timber: 4, ore: 2 });\n",
    str(path),
)
text = replace_once(
    text,
    '''function createInventories() {
  return Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, { available: 0, frozen: 0 }]));
}
''',
    '''function createInventories() {
  return Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, { available: 0, frozen: 0 }]));
}

function grantStarterConstructionMaterials(player) {
  for (const [productId, quantity] of Object.entries(STARTER_CONSTRUCTION_MATERIALS)) {
    inventoryFor(player, productId).available += quantity;
  }
  player.starterConstructionMaterialsGranted = true;
}
''',
    str(path),
)
text = replace_once(
    text,
    'function createPlayer(user, now) {\n  const player = {',
    'function createPlayer(user, now) {\n  const inventories = createInventories();\n  const player = {',
    str(path),
)
text = replace_once(text, '    inventories: createInventories(),', '    inventories,', str(path))
text = replace_once(
    text,
    "  addLedger(player, 'system', 500, '服务器发放玩家启动资金', now);",
    "  grantStarterConstructionMaterials(player);\n"
    "  addLedger(player, 'system', 500, '服务器发放玩家启动资金', now);",
    str(path),
)
text = replace_once(
    text,
    '    player.facilities = (player.facilities || []).map((facility) => migrateFacility(facility, player.userId));\n',
    '''    player.facilities = (player.facilities || []).map((facility) => migrateFacility(facility, player.userId));
    const hasFacilityAssets = player.facilities.length > 0
      || (player.facilityGroups || []).some((group) => Number(group.count || 0) > 0);
    if (!player.starterConstructionMaterialsGranted && !hasFacilityAssets && !player.facilityConstruction) {
      grantStarterConstructionMaterials(player);
    } else if (hasFacilityAssets || player.facilityConstruction) {
      player.starterConstructionMaterialsGranted = true;
    }
''',
    str(path),
)
path.write_text(text, encoding='utf-8')

path = Path('server/test/instant-facility-construction.test.js')
text = path.read_text(encoding='utf-8')
insert = '''
test('new players receive one starter construction material pack', () => {
  const now = 1_699_900_000_000;
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(user, now);
    assert.equal(state.inventories.timber.available, 4);
    assert.equal(state.inventories.ore.available, 2);
  } finally {
    store.close();
  }
});

'''
text = replace_once(text, "test('construction atomically consumes credits", insert + "test('construction atomically consumes credits", str(path))
path.write_text(text, encoding='utf-8')

path = Path('scripts/verify-industry-catalog.mjs')
text = path.read_text(encoding='utf-8')
text = replace_once(
    text,
    "    'C1 为 30 秒～1 分钟',\n    'C2 为 5～10 分钟',\n    'C3 为 30 分钟～1 小时',\n    'C4～C7 为 1～2 小时',",
    "    '正式目录为每座工厂声明现金 `buildCost` 与商品数组 `buildInputs`',\n"
    "    '客户端兼容字段 `buildTimeMs` 固定返回 `0`',\n"
    "    '资金和全部材料必须先完整校验，再原子扣除',\n"
    "    '首座工厂建造材料包',",
    str(path),
)
path.write_text(text, encoding='utf-8')

# Existing tests that intentionally exercise unrelated systems clear the starter pack; direct onboarding tests keep it.
path = Path('server/test/domain.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '  const buyer = ensurePlayer(world, alice, now);\n  seller.inventories.ore.available = 10;', '  const buyer = ensurePlayer(world, alice, now);\n  buyer.inventories.ore.available = 0;\n  seller.inventories.ore.available = 10;', str(path))
path.write_text(text, encoding='utf-8')

path = Path('server/test/fertilizer-factory.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text, "  assert.equal(facility.buildCost, 330);\n  assert.equal(facility.buildTimeMs, 85 * 60_000);\n  assert.equal(facility.systemValue, 430);", "  assert.equal(facility.buildCost, 134);\n  assert.deepEqual(facility.buildInputs, [\n    { productId: 'lumber', quantity: 3 },\n    { productId: 'steel', quantity: 4 },\n    { productId: 'copper', quantity: 1 },\n  ]);\n  assert.equal(facility.systemValue, 430);", str(path))
path.write_text(text, encoding='utf-8')

path = Path('server/test/tool-workshop.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text, "const f = FACILITY_TYPE_CATALOG.find((x) => x.id === 'tool-workshop'); assert.ok(f); assert.equal(f.complexity, 'C4'); assert.equal(f.buildCost, 320); assert.equal(f.buildTimeMs, 75 * 60_000); assert.equal(f.systemValue, 420);", "const f = FACILITY_TYPE_CATALOG.find((x) => x.id === 'tool-workshop'); assert.ok(f); assert.equal(f.complexity, 'C4'); assert.equal(f.buildCost, 136); assert.deepEqual(f.buildInputs, [{ productId: 'lumber', quantity: 4 }, { productId: 'steel', quantity: 4 }]); assert.equal(f.systemValue, 420);", str(path))
path.write_text(text, encoding='utf-8')

path = Path('server/test/unified-warehouse-reservations.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '  const buyer = ensurePlayer(world, buyerUser, now);\n  buyer.inventoryCapacity = 500;', '  const buyer = ensurePlayer(world, buyerUser, now);\n  buyer.inventories.timber.available = 0;\n  buyer.inventories.ore.available = 0;\n  buyer.inventoryCapacity = 500;', str(path))
path.write_text(text, encoding='utf-8')

path = Path('server/test/warehouse.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '  const player = ensurePlayer(world, alice, now);\n  player.credits = credits;', '  const player = ensurePlayer(world, alice, now);\n  player.inventories.timber.available = 0;\n  player.inventories.ore.available = 0;\n  player.credits = credits;', str(path))
text = replace_once(text, '    assert.equal(state.warehouseStoredQuantity, 0);', '    assert.equal(state.warehouseStoredQuantity, 6);', str(path))
text = replace_once(text, '    assert.equal(state.warehouseUsedCapacity, 0);', '    assert.equal(state.warehouseUsedCapacity, 6);', str(path))
text = replace_once(text, '    assert.equal(state.warehouseAvailableCapacity, 500);', '    assert.equal(state.warehouseAvailableCapacity, 494);', str(path))
path.write_text(text, encoding='utf-8')

path = Path('server/test/world-deadline-planner.test.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text, '''test('construction employment deadline is the next integer release boundary', () => {
  assert.equal(nextConstructionEmploymentAt({
    startedAt: 1_000,
    completesAt: 11_000,
    buildCost: 4,
    employmentReleased: 0,
  }), 3_500);
  assert.equal(nextConstructionEmploymentAt({
    startedAt: 1_000,
    completesAt: 11_000,
    buildCost: 4,
    employmentReleased: 3,
  }), 11_000);
});''', '''test('instant construction registers no employment deadline', () => {
  assert.equal(nextConstructionEmploymentAt(), null);
});''', str(path))
path.write_text(text, encoding='utf-8')

for filename, marker, addition in [
    ('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '服务端允许单次建设 1～100 座并按数量安全相乘。', '新玩家首次建档固定获得 4 木材与 2 铁矿石的首座工厂建造材料包；既有且没有任何已建工厂或施工承诺的玩家在迁移时最多补发一次。该材料包只解决首座 C1 工厂启动，不进入现金发行、人口就业收入或市场成交统计。\n\n'),
    ('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '新玩家首次创建 Economy 玩家档案时，服务器一次性发放 **500 普通货币**作为启动资金，并写入同额系统账本；该规则只作用于此后首次建档，不迁移、不补发，也不改写既有玩家余额。', '\n\n新玩家同时一次性获得 **4 木材与 2 铁矿石**作为首座 C1 工厂建造材料包。即时建设上线迁移时，仅对没有任何工厂资产或施工承诺且尚未领取过材料包的既有玩家补发一次；不得重复发放，也不得把材料包计为货币发行或就业收入。'),
    ('docs/README.md', '工厂建设以服务器正式目录的 `buildCost + buildInputs` 为唯一成本，', '新玩家首座工厂材料包固定为 4 木材与 2 铁矿石，既有空白玩家只迁移补发一次；'),
]:
    path = Path(filename)
    text = path.read_text(encoding='utf-8')
    if filename == 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md':
        text = replace_once(text, marker, addition + marker, filename)
    else:
        text = replace_once(text, marker, marker + addition, filename)
    path.write_text(text, encoding='utf-8')

print('starter construction materials patch applied')
