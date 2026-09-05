from pathlib import Path
import re


def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    assert count == 1, f'{label}: expected 1, got {count}'
    p.write_text(text.replace(old, new, 1))

# Server: automatic operation itself authorizes selling every non-frozen local product.
path = Path('server/src/cycle-auto-operation.js')
text = path.read_text()
old = '''  let changed = false;
  if (player.provinceAutoSaleEnabled?.[provinceId] === true) {
    for (const product of PRODUCT_CATALOG) {
      const quantity = Number(player.inventories?.[provinceScopedKey(provinceId, product.id)]?.available || 0);
      if (quantity < 1 || priceFor(world, provinceId, product.id) === null) continue;
      trade(world, player, provinceId, product.id, 'sell', quantity, now);
      player.cycleAutoSaleCounts ||= {};
      const key = provinceScopedKey(provinceId, product.id);
      const cumulative = Number(player.cycleAutoSaleCounts[key] || 0) + quantity;
      if (!Number.isSafeInteger(cumulative)) throw new RangeError('累计自动出售数量超出系统范围');
      player.cycleAutoSaleCounts[key] = cumulative;
      changed = true;
    }
  }
'''
new = '''  let changed = false;
  for (const product of PRODUCT_CATALOG) {
    const quantity = Number(player.inventories?.[provinceScopedKey(provinceId, product.id)]?.available || 0);
    if (quantity < 1 || priceFor(world, provinceId, product.id) === null) continue;
    trade(world, player, provinceId, product.id, 'sell', quantity, now);
    player.cycleAutoSaleCounts ||= {};
    const key = provinceScopedKey(provinceId, product.id);
    const cumulative = Number(player.cycleAutoSaleCounts[key] || 0) + quantity;
    if (!Number.isSafeInteger(cumulative)) throw new RangeError('累计自动出售数量超出系统范围');
    player.cycleAutoSaleCounts[key] = cumulative;
    changed = true;
  }
'''
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1))

# Mutation scope must include all product markets in any region whose completed building can auto-operate.
path = Path('server/src/world-storage-v2.js')
text = path.read_text()
text = replace_once.__wrapped__ if False else text
old = "import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';\n"
new = old + "import { factoryAutoOperationPolicyFor } from './factory-auto-operation.js';\nimport { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = '  const regions = new Set();\n  const keys = new Set();\n'
new = '  const regions = new Set();\n  const autoSaleRegions = new Set();\n  const keys = new Set();\n'
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = '''    regions.add(provinceId);
    for (const item of [...(recipe.inputs || []), recipe.output]) keys.add(provinceScopedKey(provinceId, item.productId));
'''
new = '''    regions.add(provinceId);
    if (factoryAutoOperationPolicyFor(player, provinceId, group.facilityTypeId).enabled) autoSaleRegions.add(provinceId);
    for (const item of [...(recipe.inputs || []), recipe.output]) keys.add(provinceScopedKey(provinceId, item.productId));
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = '''    regions.add(provinceId);
    for (const item of type.consumptionInputs) keys.add(provinceScopedKey(provinceId, item.productId));
'''
new = '''    regions.add(provinceId);
    if (group.enabled && commercialAutoOperationPolicyFor(group).enabled) autoSaleRegions.add(provinceId);
    for (const item of type.consumptionInputs) keys.add(provinceScopedKey(provinceId, item.productId));
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = "    if (regions.has(provinceId) && player.provinceAutoSaleEnabled?.[provinceId] === true && (inventory.available > 0 || inventory.frozen > 0)\n"
new = "    if (autoSaleRegions.has(provinceId) && (inventory.available > 0 || inventory.frozen > 0)\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
path.write_text(text)

# Legacy separate sale action no longer has authority.
replace_once('server/src/factory-auto-operation.js', '''  if (payload.operation === 'province-auto-sale') {
    if (typeof payload.enabled !== 'boolean') return result(false, '地区自动出售设置无效');
    player.provinceAutoSaleEnabled ||= {};
    player.provinceAutoSaleEnabled[provinceId] = payload.enabled;
    return result(true, payload.enabled ? '将在周期完成时出售本地区全部非冻结商品' : '地区自动出售已关闭');
  }
''', '''  if (payload.operation === 'province-auto-sale') {
    return result(false, '地区自动出售已并入建筑自动经营，无需单独设置');
  }
''', 'retire regional sale action')

# Client: one automatic-operation switch only.
Path('src/components/buildings/BuildingAutoOperationSection.tsx').write_text('''import type { ReactNode } from 'react';
import { SwitchControl } from '../ui/layout';
import '../../styles/factory-auto-operation.css';

export function BuildingAutoOperationSection({ label, enabled, disabled, onChange, message, children }: {
  label: ReactNode;
  enabled: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
  message?: string;
  children?: ReactNode;
}) {
  return (
    <section className="facility-auto-operation mobile-detail-section" aria-label="自动经营">
      <div className="facility-auto-operation__header">
        <strong>{label}</strong>
        <SwitchControl checked={enabled} aria-label={enabled ? '关闭自动经营' : '开启自动经营'}
          disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      </div>
      {children}
      {message ? <small className="facility-auto-operation__message" role="status">{message}</small> : null}
    </section>
  );
}
''')
replace_once('src/components/facilities/FacilityAutoOperationControls.tsx', '<BuildingAutoOperationSection provinceId={group.provinceId} label={<GameConcept concept="factory-auto-operation">自动经营</GameConcept>}', '<BuildingAutoOperationSection label={<GameConcept concept="factory-auto-operation">自动经营</GameConcept>}', 'factory auto section prop')
replace_once('src/components/commercial/CommercialBuildingDetail.tsx', '<BuildingAutoOperationSection provinceId={group.provinceId} label={<GameConcept concept="commercial-auto-operation">自动经营</GameConcept>}', '<BuildingAutoOperationSection label={<GameConcept concept="commercial-auto-operation">自动经营</GameConcept>}', 'commercial auto section prop')
replace_once('src/api/game.ts', '''export function saveProvinceAutoSalePolicy(provinceId: string, enabled: boolean) {
  return postAction('/orders', {
    provinceId,
    execution: 'factory-auto-operation-policy',
    operation: 'province-auto-sale',
    enabled,
  });
}

''', '', 'remove client regional sale API')
replace_once('src/styles/factory-auto-operation.css', '''
.province-auto-sale { display: grid; gap: var(--space-2); min-width: 0; }
.province-auto-sale small { line-height: var(--line-height-body); }
''', '\n', 'remove regional sale styles')

# Player-facing explanations: automatic operation is the only switch.
replace_once('src/game-guide/gameConcepts.ts', "description: '营业周期完成后，服务器按正利润和可用资金采购本州经营商品并立即冻结。地区自动出售开启时，同时出售本地区非冻结商品。首次缺货需要手动准备，关闭自动经营不取消已投入周期。',", "description: '开启后，营业周期完成时出售本地区全部非冻结商品，并按正利润和可用资金采购后续经营商品并冻结。首次缺货需要手动准备，关闭自动经营不取消已投入周期。',", 'commercial concept')
replace_once('src/game-guide/gameConcepts.ts', "description: '开启后仅在生产周期完成时，按扣除材料、运营成本和卖出手续费后的正利润采购原料并冻结。地区自动出售开启时出售本地区全部非冻结商品，不按基础价设置上下限。',", "description: '开启后，生产周期完成时出售本地区全部非冻结商品，并按扣除材料、运营成本和卖出手续费后的正利润采购原料并冻结。',", 'factory concept')
replace_once('src/game-guide/tutorialDefinition.ts', "description: '打开已有工厂详情，设置原料保障周期，并开启“出售本地区非冻结商品”。自动采购和出售仅在服务器确认周期完成时执行。',", "description: '打开已有工厂详情，设置原料保障周期并开启自动经营。自动采购和出售仅在服务器确认周期完成时执行。',", 'tutorial auto operation')
replace_once('src/game-guide/tutorialDefinition.ts', "description: '开启本地区非冻结商品出售，等待工厂周期完成后按今日官方价自动出售产成品。冻结商品不会出售。',", "description: '保持工厂自动经营开启，等待周期完成后按今日官方价自动出售本地区非冻结商品。冻结商品不会出售。',", 'tutorial auto sale')

# Authority design updates.
replace_once('docs/WAREHOUSE_EXPANSION_DESIGN.md', '''工厂详情在生产配置附近显示“自动经营”，并提供明确授权的地区自动出售开关。建筑本身只配置启用状态与原料保障周期：原料保障下拉与生产产物、作业制度位于同一行；自动经营与原料保障的玩法解释只通过点状下划线的 `GameConcept` 悬浮框展示，除地区全库存出售授权的风险说明外，不显示常驻说明、统一订单簿实现说明、经营模式、产成品处理或独立保存按钮；不得要求玩家为每种输入和输出商品逐一填写采购数量、目标库存或限价。
''', '''工厂与商业建筑详情只提供一个“自动经营”开关和对应的原料／商品保障周期。开启自动经营即同时授权该建筑在每次真实周期完成后出售本地区全部非冻结商品，并在符合正利润和资金条件时采购后续原料并冻结；关闭后该建筑不再触发自动买卖。原料保障下拉与生产产物、作业制度位于同一行；自动经营与保障周期的玩法解释只通过点状下划线的 `GameConcept` 悬浮框展示，不显示独立地区出售开关、常驻风险说明、统一订单簿实现说明、经营模式、产成品处理或独立保存按钮；不得要求玩家为每种输入和输出商品逐一填写采购数量、目标库存或限价。
''', 'warehouse UI rule')
replace_once('docs/WAREHOUSE_EXPANSION_DESIGN.md', '''地区自动出售是独立的明确授权：在建筑详情设置“出售本地区非冻结商品”，工业和商业详情共享同一地区值。新玩家与缺失旧配置默认关闭，不能因新建默认开启自动经营的建筑就清空整个地区。启用后，当该地区任一营业／生产意图与自动经营均开启的建筑完成周期时，出售当地全部 `available` 商品，包括剩余原料、手动买入、合同或奖励所得；不受原生产者利润、历史买入价或旧 `keep` 限制。关闭某一建筑自动经营不覆盖地区授权，但该建筑不再独立触发交易。
''', '''自动经营固定包含地区非冻结商品出售：当本地区任一营业／生产意图与自动经营均开启的建筑完成周期时，出售当地全部 `available` 商品，包括剩余原料、手动买入、合同或奖励所得；不受原生产者利润、历史买入价或旧 `keep` 限制。关闭某一建筑自动经营后，该建筑完成周期不再触发出售或采购；其他仍开启自动经营的建筑按各自完成周期继续触发。不存在地区级独立出售授权；旧 `provinceAutoSaleEnabled` 仅作为兼容存量字段保留，不参与交易判断。
''', 'warehouse automatic sale rule')
replace_once('docs/WAREHOUSE_EXPANSION_DESIGN.md', '服务器提交真实产出／营业收入后，依次执行有效合同准备、现有材料冻结、地区授权的全部非冻结商品出售，以及正利润完整批次采购并冻结；手续费和市场成交量只随真实交易入账。', '服务器提交真实产出／营业收入后，依次执行有效合同准备、现有材料冻结、本地区全部非冻结商品出售，以及正利润完整批次采购并冻结；手续费和市场成交量只随真实交易入账。', 'warehouse cycle order')
replace_once('docs/WAREHOUSE_EXPANSION_DESIGN.md', '生产原有逻辑保留只在下一次有授权的业务核对中从真实可用库存分配，不凭历史需求补发资产。新出售授权缺失时保持关闭，迁移绝不自动清仓。', '生产原有逻辑保留只在下一次有授权的业务核对中从真实可用库存分配，不凭历史需求补发资产。旧独立地区出售配置不改变资产，也不再参与交易判断；自动出售只随建筑自动经营状态生效。', 'warehouse migration rule')
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '只展示已实际冻结的商品与归属，不显示保障目标、保障缺口或第二套自由库存。保障周期下拉继续保留。建筑详情在既有自动经营区域提供共享的地区出售开关，明确说明会在自动经营建筑周期完成时出售本地区所有非冻结商品，包括手动买入与奖励；工厂和商业详情读取同一地区权威状态，请求失败不假装保存成功。', '只展示已实际冻结的商品与归属，不显示保障目标、保障缺口或第二套自由库存。保障周期下拉继续保留。建筑详情只显示自动经营开关和保障周期；开启自动经营本身即表示该建筑周期完成时出售本地区所有非冻结商品，包括手动买入与奖励，不再显示独立地区出售开关或常驻出售说明。', 'page auto operation UI')
replace_once('docs/UI_DESIGN_SYSTEM.md', '地区自动出售控件复用共享 `SwitchControl` 和建筑自动经营同一行标题布局；允许有一条明确的全地区非冻结库存出售风险说明，不能恢复逐商品限价、模式或自由库存字段。', '建筑自动经营只保留一个共享 `SwitchControl`，标题与开关保持同一行；不得再增加地区自动出售第二开关、常驻出售风险说明、逐商品限价、模式或自由库存字段。', 'UI auto operation rule')
replace_once('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '玩家动作可能顺带结算其到期生产，因此 Mutation Scope 必须从已加载的真实世界明确纳入该玩家活跃建筑、启用出售地区的真实商品市场、正式成交记录、必要资金域以及可参与已备妥采购或供货的合同参与者。', '玩家动作可能顺带结算其到期生产，因此 Mutation Scope 必须从已加载的真实世界明确纳入该玩家活跃建筑、自动经营可能完成周期的地区全部真实商品市场、正式成交记录、必要资金域以及可参与已备妥采购或供货的合同参与者。', 'server mutation scope rule')

# Domain tests: no separate flag is needed; disabled automatic operation must stop both sides.
path = Path('server/test/cycle-auto-operation.test.js')
text = path.read_text().replace("  player.provinceAutoSaleEnabled = { [provinceId]: true };\n", '')
old = '''test('region automatic sale is explicit opt-in; stock is not liquidated by a default-enabled building', () => {
  const { world, player, recipe } = setup('farm', { wheat: 2 });
  delete player.provinceAutoSaleEnabled;
  inventoryForProvince(player, 'fruit', provinceId).available = 9;
  settle(world, now + recipe.cycleMs);
  assert.equal(inventoryForProvince(player, 'fruit', provinceId).available, 9);
  assert.equal(orders(world).length, 0);
});
'''
new = '''test('automatic sale follows the building automatic-operation switch without a regional toggle', () => {
  const { world, player, recipe } = setup('farm', { wheat: 2 });
  inventoryForProvince(player, 'fruit', provinceId).available = 9;
  assert.equal(applyFactoryAutoOperationPolicyAction(world, user, { provinceId, facilityTypeId: 'farm',
    policy: { enabled: false, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } }, now).ok, true);
  settle(world, now + recipe.cycleMs);
  assert.equal(inventoryForProvince(player, 'fruit', provinceId).available, 9);
  assert.equal(orders(world).some((order) => order.side === 'sell' && order.productId === 'fruit'), false);
  assert.equal(applyFactoryAutoOperationPolicyAction(world, user, { provinceId, facilityTypeId: 'farm',
    policy: { enabled: true, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } }, now + recipe.cycleMs).ok, true);
  settle(world, now + recipe.cycleMs * 2);
  assert.equal(inventoryForProvince(player, 'fruit', provinceId).available, 0);
  assert.ok(orders(world).some((order) => order.side === 'sell' && order.productId === 'fruit' && order.quantity === 9));
});
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = '''test('automatic procurement cannot spend operating cash or manufacture goods when funds are insufficient', () => {
  const { world, player, recipe } = setup();
  player.credits = recipe.operatingCost;
  player.provinceAutoSaleEnabled[provinceId] = false;
  settle(world, now + recipe.cycleMs);
  assert.equal(player.credits, 0);
  assert.equal(orders(world).length, 0);
  assert.equal(inventoryForProvince(player, 'wheat', provinceId).frozen, 0);
});
'''
new = '''test('unfunded direct cycle maintenance cannot buy before any real sale proceeds exist', () => {
  const { world, player, group, recipe } = setup();
  player.credits = 0;
  for (const input of recipe.inputs) inventoryForProvince(player, input.productId, provinceId).available = 0;
  assert.equal(completeBuildingCycleAutoOperation(world, player, group, 'production', now + recipe.cycleMs, now + recipe.cycleMs), false);
  assert.equal(orders(world).some((order) => order.side === 'buy'), false);
  assert.equal(inventoryForProvince(player, 'wheat', provinceId).frozen, 0);
});
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
text = text.replace('    player.provinceAutoSaleEnabled = {};\n', '')
old = '''test('multi-input procurement preflights the whole batch and leaves operating cash intact', () => {
  const type = FACILITY_TYPE_CATALOG.find((entry) => (entry.recipes.find((r) => r.id === entry.defaultRecipeId) || entry.recipes[0]).inputs.length > 1);
  assert.ok(type);
  const { world, player, recipe } = setup(type.id, {});
  player.provinceAutoSaleEnabled = {};
  let inputs = 0;
  for (const item of recipe.inputs) {
    world.markets[provinceScopedKey(provinceId, item.productId)].officialPrice = 1;
    inputs += item.quantity;
  }
  world.markets[provinceScopedKey(provinceId, recipe.output.productId)].officialPrice = 100_000;
  player.credits = recipe.operatingCost * 2 + inputs - 0.01;
  settle(world, now + recipe.cycleMs);
  assert.ok(player.facilityGroups[0].lifetimeOutput > 0);
  assert.equal(orders(world).some((order) => order.side === 'buy'), false);
  for (const item of recipe.inputs) {
    const inventory = inventoryForProvince(player, item.productId, provinceId);
    assert.equal(inventory.available + inventory.frozen, 0, 'no partially bought material batch');
  }
  assert.ok(player.credits >= recipe.operatingCost);
});
'''
new = '''test('multi-input procurement preflights the whole batch when no sale proceeds exist', () => {
  const type = FACILITY_TYPE_CATALOG.find((entry) => (entry.recipes.find((r) => r.id === entry.defaultRecipeId) || entry.recipes[0]).inputs.length > 1);
  assert.ok(type);
  const { world, player, group, recipe } = setup(type.id, {});
  let inputs = 0;
  for (const item of recipe.inputs) {
    world.markets[provinceScopedKey(provinceId, item.productId)].officialPrice = 1;
    inventoryForProvince(player, item.productId, provinceId).available = 0;
    inputs += item.quantity;
  }
  world.markets[provinceScopedKey(provinceId, recipe.output.productId)].officialPrice = 100_000;
  player.credits = recipe.operatingCost + inputs - 0.01;
  const before = player.credits;
  completeBuildingCycleAutoOperation(world, player, group, 'production', now + recipe.cycleMs, now + recipe.cycleMs);
  assert.equal(orders(world).some((order) => order.side === 'buy'), false);
  for (const item of recipe.inputs) {
    const inventory = inventoryForProvince(player, item.productId, provinceId);
    assert.equal(inventory.available + inventory.frozen, 0, 'no partially bought material batch');
  }
  assert.equal(player.credits, before);
});
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
path.write_text(text)

# Commercial completion also sells unrelated free stock when automatic operation is on.
path = Path('server/test/commercial-auto-operation.test.js')
text = path.read_text()
old = "  inventoryForProvince(player, 'food', other).available = 77;\n"
new = old + "  inventoryForProvince(player, 'fruit', provinceId).available = 4;\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = "  assert.equal(inventoryForProvince(player, 'food', other).available, 77);\n"
new = old + "  assert.equal(inventoryForProvince(player, 'fruit', provinceId).available, 0);\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
path.write_text(text)

# Runtime mutation-scope regression now proves sale persistence without a separate region flag.
for file in ['server/test/cycle-auto-runtime.test.js', 'server/test/cycle-auto-horizon.test.js']:
    p = Path(file)
    t = p.read_text()
    t = t.replace(' player.provinceAutoSaleEnabled = { [region]: true };', '')
    t = t.replace('  player.provinceAutoSaleEnabled = { [provinceId]: true };\n', '')
    p.write_text(t)

# Legacy extra action is rejected and does not mutate player state.
path = Path('server/test/online-auto-sell-persistence.test.js')
text = path.read_text()
pattern = r"test\('regional automatic sale consent persists without trading and is shared across building kinds', \(\) => \{.*?\n\}\);\n"
replacement = '''test('legacy regional sale action is rejected because sale follows building automatic operation', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    const before = JSON.stringify(persistedPlayer(store));
    const rejected = store.apply(alice, request({ provinceId: DEFAULT_PROVINCE_ID,
      execution: 'factory-auto-operation-policy', operation: 'province-auto-sale', enabled: true,
    }, 'region-auto-sale-retired-12345678'), now + 1);
    assert.equal(rejected.result.ok, false);
    assert.match(rejected.result.message, /已并入建筑自动经营/);
    assert.equal(JSON.stringify(persistedPlayer(store)), before);
  } finally { store.close(); }
});
'''
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
assert count == 1, f'legacy persistence test: {count}'
path.write_text(text)

# Browser coverage: exactly one switch in the automatic-operation section.
path = Path('tests/browser/unified-buildings.spec.ts')
text = path.read_text()
old = '''async function assertOperationControlsAligned(detail: Locator) {
  // Both independent controls share the visual header; each must stay on its own aligned row.
  for (const selector of [
    '.facility-auto-operation > .facility-auto-operation__header',
    '.province-auto-sale > .facility-auto-operation__header',
  ]) {
    const header = detail.locator(selector);
    await expect(header).toHaveCount(1);
    const label = await header.locator(':scope > strong').boundingBox();
    const control = await header.locator('.ui-switch').boundingBox();
    expect(label).not.toBeNull(); expect(control).not.toBeNull();
    expect(Math.abs((label!.y + label!.height / 2) - (control!.y + control!.height / 2))).toBeLessThanOrEqual(2);
  }
}
'''
new = '''async function assertOperationControlsAligned(detail: Locator) {
  const header = detail.locator('.facility-auto-operation > .facility-auto-operation__header');
  await expect(header).toHaveCount(1);
  const label = await header.locator(':scope > strong').boundingBox();
  const control = await header.locator('.ui-switch').boundingBox();
  expect(label).not.toBeNull(); expect(control).not.toBeNull();
  expect(Math.abs((label!.y + label!.height / 2) - (control!.y + control!.height / 2))).toBeLessThanOrEqual(2);
  await expect(detail.locator('.province-auto-sale')).toHaveCount(0);
  await expect(detail.getByRole('checkbox', { name: /本地区自动出售/ })).toHaveCount(0);
}
'''
assert text.count(old) == 1
text = text.replace(old, new, 1)
text = text.replace("  const regionSale = page.getByRole('checkbox', { name: /^(开启|关闭)本地区自动出售$/ });\n", '')
text = text.replace('  await expect(regionSale).not.toBeChecked();\n', '')
text = text.replace('  await expect(regionSale).not.toBeChecked();\n', '')
text = text.replace('  await expect(regionSale).not.toBeChecked();\n', '')
text = text.replace("  await expect(page.getByRole('checkbox', { name: /^(开启|关闭)本地区自动出售$/ })).not.toBeChecked();\n", "  await expect(page.getByRole('checkbox', { name: /本地区自动出售/ })).toHaveCount(0);\n")
path.write_text(text)

path = Path('tests/browser/warehouse-auto-sell.spec.ts')
text = path.read_text()
needle = "    await expect(controls.locator('[data-game-concept=\"input-coverage\"]')).toHaveCount(1);\n"
addition = needle + "    await expect(controls.getByRole('checkbox', { name: /本地区自动出售/ })).toHaveCount(0);\n    await expect(controls.getByText('出售本地区非冻结商品', { exact: true })).toHaveCount(0);\n"
assert text.count(needle) == 1
path.write_text(text.replace(needle, addition, 1))

# Verifier protects the unified semantics and absence of the redundant UI/API.
path = Path('scripts/verify-online-auto-sell.mjs')
text = path.read_text()
text = text.replace("  'provinceAutoSaleEnabled', ", '')
old = "requireText('src/components/buildings/ProvinceAutoSaleControl.tsx', '出售本地区非冻结商品');\n"
new = "assert.ok(!existsSync('src/components/buildings/ProvinceAutoSaleControl.tsx'), '不得保留独立地区自动出售开关');\nforbidText('src/components/buildings/BuildingAutoOperationSection.tsx', 'ProvinceAutoSaleControl');\nforbidText('src/api/game.ts', 'saveProvinceAutoSalePolicy');\nforbidText('server/src/cycle-auto-operation.js', 'provinceAutoSaleEnabled');\nrequireText('server/src/world-storage-v2.js', 'autoSaleRegions');\nforbidText('server/src/world-storage-v2.js', 'player.provinceAutoSaleEnabled?.[provinceId]');\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = "console.log('周期自动经营检查通过：完成事件唯一触发，利润计费，来源冻结，地区出售显式启用，客户端只读。');"
new = "console.log('周期自动经营检查通过：完成事件唯一触发，自动经营自身包含地区非冻结出售，利润计费、来源冻结与客户端只读边界保持。');"
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1))
