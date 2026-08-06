from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    if source.count(old) != 1:
        raise RuntimeError(f'{label} not found exactly once')
    target.write_text(source.replace(old, new), encoding='utf-8', newline='\n')


old_gem_shop = "for (const text of ['label=\"建造数量\"', 'label=\"建造资金\"', '立即扣除资金与建造材料']) {\n  requireText('src/pages/ProductionPage.tsx', text);\n}"
new_gem_shop = "for (const text of [\n  'label=\"建造数量\"',\n  'label=\"建造资金\"',\n  'label=\"建造材料\"',\n  'value=\"无需材料\"',\n  \"'建造资金' : '资金与建造材料'\",\n]) {\n  requireText('src/pages/ProductionPage.tsx', text);\n}"
replace_once(
    'scripts/verify-gem-shop.mjs',
    old_gem_shop,
    new_gem_shop,
    'verify-gem-shop construction presentation guard',
)

old_countdown = "  for (const text of [\n    'label=\"建造数量\"',\n    'label=\"建造资金\"',\n    'label=\"最多可建\"',\n    '立即扣除资金与建造材料',\n  ]) requireText(paths.production, text);"
new_countdown = "  for (const text of [\n    'label=\"建造数量\"',\n    'label=\"建造资金\"',\n    'label=\"建造材料\"',\n    'value=\"无需材料\"',\n    'label=\"最多可建\"',\n    \"'建造资金' : '资金与建造材料'\",\n  ]) requireText(paths.production, text);"
replace_once(
    'scripts/verify-authoritative-countdowns.mjs',
    old_countdown,
    new_countdown,
    'verify-authoritative-countdowns construction presentation guard',
)

old_warehouse = "    assert.equal(state.warehouseStoredQuantity, 6);\n    assert.equal(state.warehouseReservedQuantity, 0);\n    assert.equal(state.warehouseUsedCapacity, 6);\n    assert.equal(state.warehouseAvailableCapacity, 494);"
new_warehouse = "    assert.equal(state.warehouseStoredQuantity, 0);\n    assert.equal(state.warehouseReservedQuantity, 0);\n    assert.equal(state.warehouseUsedCapacity, 0);\n    assert.equal(state.warehouseAvailableCapacity, 500);"
replace_once(
    'server/test/warehouse.test.js',
    old_warehouse,
    new_warehouse,
    'warehouse default usage after starter material retirement',
)

print('dependent construction presentation guards and warehouse baseline updated')
