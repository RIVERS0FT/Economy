from pathlib import Path


def patch(path, old, new, *, count=1):
    p = Path(path)
    content = p.read_text(encoding='utf-8')
    if old not in content:
        if new in content:
            return
        raise SystemExit(f'{path}: patch marker missing')
    p.write_text(content.replace(old, new, count), encoding='utf-8')


# Preserve the historical model-18 rebalance scenario, but migration now continues to current model 19.
patch(
    'server/test/c1-input-balance-migration.test.js',
    "test('model 18 cancels affected open orders, preserves quantities and resets current anchors once', () => {",
    "test('model 18 rebalance remains preserved when migrating through current model 19', () => {",
)
patch(
    'server/test/c1-input-balance-migration.test.js',
    '  assert.equal(world.marketDemand.modelVersion, 18);',
    '  assert.equal(world.marketDemand.modelVersion, 19);',
)


# The domain-wide catalog audit must understand the dedicated C2 profit ladder and ignore hidden legacy aliases.
path = Path('server/test/domain.test.js')
content = path.read_text(encoding='utf-8')
map_old = """  const expectedProfitByComplexity = { C2: 3, C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };\n  const expectedC1ProfitByFacility = { farm: 0.6, orchard: 0.9, ranch: 0.8, fishery: 1 };"""
map_new = """  const expectedProfitByComplexity = { C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };\n  const expectedC1ProfitByFacility = { farm: 0.6, orchard: 0.9, ranch: 0.8, fishery: 1 };\n  const expectedC2ProfitByMethod = { standard: 3, assisted: 6, intensive: 9, mechanized: 10.5 };"""
if map_old in content:
    content = content.replace(map_old, map_new, 1)
elif map_new not in content:
    raise SystemExit('server/test/domain.test.js: profit map marker missing')
block_old = """      if (facility.complexity !== 'C1' || recipe.productionMethodId === 'standard') {\n        const expectedProfit = facility.complexity === 'C1'\n          ? expectedC1ProfitByFacility[facility.id]\n          : expectedProfitByComplexity[facility.complexity];\n        assert.ok(Math.abs(profit - expectedProfit) < 1e-9, `${facility.id}/${recipe.id} 参考分钟利润不正确`);\n      }"""
block_new = """      if (recipe.legacyProductionMethod) continue;\n      if (facility.complexity === 'C1' && recipe.productionMethodId !== 'standard') continue;\n      const expectedProfit = facility.complexity === 'C1'\n        ? expectedC1ProfitByFacility[facility.id]\n        : facility.complexity === 'C2'\n          ? expectedC2ProfitByMethod[recipe.productionMethodId || 'standard']\n          : expectedProfitByComplexity[facility.complexity];\n      assert.ok(Number.isFinite(expectedProfit), `${facility.id}/${recipe.id} 缺少参考分钟利润规则`);\n      assert.ok(Math.abs(profit - expectedProfit) < 1e-9, `${facility.id}/${recipe.id} 参考分钟利润不正确`);"""
if block_old in content:
    content = content.replace(block_old, block_new, 1)
elif block_new not in content:
    raise SystemExit('server/test/domain.test.js: profit assertion marker missing')
content = content.replace('    assert.equal(persisted.version, 26);', '    assert.equal(persisted.version, 28);', 1)
path.write_text(content, encoding='utf-8')


# Order capacity is defined by the live catalog formula; do not freeze the former 620 constant.
path = Path('server/test/order-limits.test.js')
content = path.read_text(encoding='utf-8')
content = content.replace('  assert.equal(expectedLimit, 620);\n', '')
path.write_text(content, encoding='utf-8')


# Tool-workshop coverage follows the current 38-product / model-19 catalog.
path = Path('server/test/tool-workshop.test.js')
content = path.read_text(encoding='utf-8')
content = content.replace('assert.equal(PRODUCT_CATALOG.length, 36);', 'assert.equal(PRODUCT_CATALOG.length, 38);')
content = content.replace("test('市场需求模型 18 在固定耐用品预算内加入工具需求', () => {", "test('市场需求模型 19 在固定耐用品预算内保留工具需求', () => {")
content = content.replace('assert.equal(MARKET_DEMAND_MODEL_VERSION, 18);', 'assert.equal(MARKET_DEMAND_MODEL_VERSION, 19);')
path.write_text(content, encoding='utf-8')


# Keep validation output aligned with the authority it already enforces.
path = Path('scripts/verify-document-authority.mjs')
content = path.read_text(encoding='utf-8')
content = content.replace('版本 33/27', '版本 33/28')
content = content.replace('市场需求模型 18', '市场需求模型 19')
path.write_text(content, encoding='utf-8')
