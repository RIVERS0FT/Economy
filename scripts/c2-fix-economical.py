from pathlib import Path


def replace_required(path, old, new):
    p = Path(path)
    content = p.read_text(encoding='utf-8')
    if old not in content:
        if new in content:
            return
        raise SystemExit(f'{path}: required patch marker missing')
    p.write_text(content.replace(old, new, 1), encoding='utf-8')


path = 'server/src/production-methods.js'
old = """  const cycleMs = methodId === 'high-yield'\n    ? recipe.cycleMs\n    : alignedCycleMs(recipe.cycleMs, expectedProfitPerMinute, methodId);\n  const outputValueUnits = valueOfItemsUnits([output], prices);\n  const inputValueUnits = valueOfItemsUnits(inputs, prices);\n  const profitNumerator = moneyUnits(expectedProfitPerMinute, '参考分钟利润') * cycleMs;\n  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % 60_000 !== 0) {\n    throw new Error(`${baseRecipeId}/${methodId} 无法形成分币精确的参考利润`);\n  }\n  const operatingCostUnits = outputValueUnits - inputValueUnits - profitNumerator / 60_000;\n  if (!Number.isSafeInteger(operatingCostUnits) || operatingCostUnits < 0) {\n    throw new Error(`${baseRecipeId}/${methodId} 无法形成非负两位小数周期成本`);\n  }\n"""
new = """  let cycleMs = methodId === 'high-yield'\n    ? recipe.cycleMs\n    : alignedCycleMs(recipe.cycleMs, expectedProfitPerMinute, methodId);\n  const outputValueUnits = valueOfItemsUnits([output], prices);\n  const inputValueUnits = valueOfItemsUnits(inputs, prices);\n  const profitPerMinuteUnits = moneyUnits(expectedProfitPerMinute, '参考分钟利润');\n  let profitNumerator = profitPerMinuteUnits * cycleMs;\n  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % 60_000 !== 0) {\n    throw new Error(`${baseRecipeId}/${methodId} 无法形成分币精确的参考利润`);\n  }\n  let operatingCostUnits = outputValueUnits - inputValueUnits - profitNumerator / 60_000;\n  if (methodId === 'economical' && operatingCostUnits < 0) {\n    const baseOperatingCostUnits = moneyUnits(recipe.operatingCost, '基础周期成本');\n    for (let candidateCycleMs = cycleMs - 1_000; candidateCycleMs > recipe.cycleMs; candidateCycleMs -= 1_000) {\n      const candidateProfitNumerator = profitPerMinuteUnits * candidateCycleMs;\n      if (!Number.isSafeInteger(candidateProfitNumerator) || candidateProfitNumerator % 60_000 !== 0) continue;\n      const candidateOperatingCostUnits = outputValueUnits - inputValueUnits - candidateProfitNumerator / 60_000;\n      if (\n        Number.isSafeInteger(candidateOperatingCostUnits)\n        && candidateOperatingCostUnits >= 0\n        && candidateOperatingCostUnits < baseOperatingCostUnits\n      ) {\n        cycleMs = candidateCycleMs;\n        profitNumerator = candidateProfitNumerator;\n        operatingCostUnits = candidateOperatingCostUnits;\n        break;\n      }\n    }\n  }\n  if (!Number.isSafeInteger(operatingCostUnits) || operatingCostUnits < 0) {\n    throw new Error(`${baseRecipeId}/${methodId} 无法形成非负两位小数周期成本`);\n  }\n"""
replace_required(path, old, new)


path = 'server/test/production-methods.test.js'
p = Path(path)
content = p.read_text(encoding='utf-8')
old_test = """test('C4 refinery provides plastic, industrial fuel, and industrial chemicals at the C4 baseline', () => {\n  const refinery = FACILITY_TYPE_CATALOG.find((type) => type.id === 'refinery');\n  const routes = refinery.recipes.filter((recipe) => !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard');\n  assert.deepEqual(routes.map((recipe) => recipe.output.productId), ['plastic', 'industrial-fuel', 'industrial-chemicals']);\n  assert.equal(routes.every((recipe) => Math.abs(referenceProfitPerMinute(recipe) - 6) < 1e-9), true);\n});\n"""
new_test = """test('C4 refinery provides plastic, industrial fuel, and industrial chemicals at the C4 baseline', () => {\n  const refinery = FACILITY_TYPE_CATALOG.find((type) => type.id === 'refinery');\n  const routes = refinery.recipes.filter((recipe) => !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard');\n  assert.deepEqual(routes.map((recipe) => recipe.output.productId), ['plastic', 'industrial-fuel', 'industrial-chemicals']);\n  assert.equal(routes.every((recipe) => Math.abs(referenceProfitPerMinute(recipe) - 6) < 1e-9), true);\n\n  const fuelEconomical = variant(refinery, 'industrial-fuel-refining', 'economical');\n  assert.equal(fuelEconomical.cycleMs, 70_000);\n  assert.equal(fuelEconomical.operatingCost, 0);\n  assert.ok(Math.abs(referenceProfitPerMinute(fuelEconomical) - 6) < 1e-9);\n});\n"""
if old_test in content:
    content = content.replace(old_test, new_test, 1)
elif new_test not in content:
    raise SystemExit(f'{path}: refinery test marker missing')
p.write_text(content, encoding='utf-8')


path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
p = Path(path)
content = p.read_text(encoding='utf-8')
heading = '### C3-C7 节约生产可行周期回退'
section = """### C3-C7 节约生产可行周期回退\n\nC3～C7 的“节约生产”仍优先使用基础周期的 1.5 倍附近、满足整秒与分币精确利润的周期，并保持基础投入与产出数量不变。若该目标周期在固定参考分钟利润下会要求负现金周期成本，生成器必须从目标周期向基础周期逐秒回退，选择仍严格长于基础周期、现金成本非负且严格低于基础制度成本的最长可行周期；不得通过负成本、改变参考利润、增发商品或静默回到基础周期规避约束。当前工业燃料精炼路线的节约制度因此固定为 70 秒、现金成本 0，并继续保持 C4 每分钟参考利润 6。\n"""
if heading not in content:
    content = content.rstrip() + '\n\n' + section
    p.write_text(content, encoding='utf-8')
