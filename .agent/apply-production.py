from pathlib import Path

path = Path('src/pages/ProductionPage.tsx')
text = path.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    if old not in text:
        raise SystemExit(f'missing production marker: {label}')
    text = text.replace(old, new, 1)


replace_once(
    "import type {\n  FacilityGroup,\n",
    "import type {\n  FacilityConstruction,\n  FacilityGroup,\n",
    'construction type import',
)
replace_once(
    "interface FacilityClusterEntry {\n  group: FacilityGroup;\n  type: FacilityTypeDefinition;\n}\n",
    "interface FacilityClusterEntry {\n  group: FacilityGroup;\n  type: FacilityTypeDefinition;\n  construction?: FacilityConstruction;\n  constructionOnly?: boolean;\n}\n",
    'cluster entry',
)
replace_once(
    "  inventories: Record<string, ProductInventory>;\n  now: number;\n  onToggle: (enabled: boolean) => void;\n  onRecipeChange: (recipeId: string) => void;\n  onOpenMarket: () => void;\n",
    "  inventories: Record<string, ProductInventory>;\n  now: number;\n  gems: number;\n  acceleratingConstruction: boolean;\n  onToggle: (enabled: boolean) => void;\n  onRecipeChange: (recipeId: string) => void;\n  onAccelerateConstruction: () => void;\n  onOpenMarket: () => void;\n",
    'shared props',
)
replace_once(
    "  const { group, type } = entry;\n\n  return (\n    <button\n",
    "  const { group, type, constructionOnly } = entry;\n\n  return (\n    <button\n",
    'selector destructure',
)
replace_once(
    "      data-status={group.status}\n      aria-label={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}`}\n",
    "      data-status={constructionOnly ? 'constructing' : group.status}\n      aria-label={constructionOnly ? `${type.name}，施工中` : `${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}`}\n",
    'selector state',
)
replace_once(
    "      <span className=\"facility-cluster-count\">{formatNumber(group.count)}</span>\n",
    "      <span className=\"facility-cluster-count\">{constructionOnly ? '施工中' : formatNumber(group.count)}</span>\n",
    'selector count',
)
replace_once(
    "}) {\n  const { group, type } = entry;\n\n  return (\n    <div className=\"facility-card-head facility-status-header\">\n",
    "}) {\n  const { group, type } = entry;\n\n  if (entry.constructionOnly) {\n    return (\n      <div className=\"facility-card-head facility-status-header\">\n        <div className=\"facility-card-title-row\">\n          <div className=\"facility-card-title-block facility-cluster-selector-heading\">\n            <h2 id={titleId}>{type.name}</h2>\n            <StatusTag tone=\"warning\">施工中</StatusTag>\n          </div>\n        </div>\n        <div className=\"facility-count-summary\"><span>完工后新增 <strong>1</strong> 座</span></div>\n      </div>\n    );\n  }\n\n  return (\n    <div className=\"facility-card-head facility-status-header\">\n",
    'construction header',
)
replace_once(
    "  );\n}\n\nfunction FacilityClusterDetailBody({\n",
    "  );\n}\n\nfunction FacilityConstructionAcceleration({\n  entry,\n  gems,\n  now,\n  acceleratingConstruction,\n  onAccelerateConstruction,\n}: Pick<FacilityClusterDetailSharedProps, 'entry' | 'gems' | 'now' | 'acceleratingConstruction' | 'onAccelerateConstruction'>) {\n  const construction = entry.construction;\n  if (!construction) return null;\n  const accelerationMs = construction.gemAccelerationMs ?? 30 * 60 * 1000;\n  const accelerationCost = construction.gemAccelerationCost ?? 1;\n  const remaining = Math.max(0, construction.completesAt - now);\n  const after = Math.max(0, remaining - accelerationMs);\n  return (\n    <div className=\"construction-status\" aria-live=\"polite\">\n      <strong>宝石加速</strong>\n      <span>当前剩余 {formatDuration(remaining)}；使用后{after > 0 ? `剩余 ${formatDuration(after)}` : '立即完工'}。</span>\n      <Button\n        block\n        disabled={remaining <= 0 || gems < accelerationCost || acceleratingConstruction}\n        onClick={onAccelerateConstruction}\n      >\n        {acceleratingConstruction ? '加速处理中…' : `${formatNumber(accelerationCost)} 宝石 · 加速 ${formatDuration(accelerationMs)}`}\n      </Button>\n      <small>每次固定减少 30m；剩余不足 30m 时直接完工，不退还部分宝石。</small>\n    </div>\n  );\n}\n\nfunction FacilityClusterDetailBody({\n",
    'acceleration component',
)
replace_once(
    "  inventories,\n  now,\n  onRecipeChange,\n}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {\n  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n",
    "  inventories,\n  now,\n  gems,\n  acceleratingConstruction,\n  onRecipeChange,\n  onAccelerateConstruction,\n}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {\n  const { group, type } = entry;\n  if (entry.constructionOnly) {\n    return (\n      <FacilityConstructionAcceleration\n        entry={entry}\n        gems={gems}\n        now={now}\n        acceleratingConstruction={acceleratingConstruction}\n        onAccelerateConstruction={onAccelerateConstruction}\n      />\n    );\n  }\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n",
    'detail body props',
)
replace_once(
    "        now={now}\n      />\n    </>\n",
    "        now={now}\n      />\n      <FacilityConstructionAcceleration\n        entry={entry}\n        gems={gems}\n        now={now}\n        acceleratingConstruction={acceleratingConstruction}\n        onAccelerateConstruction={onAccelerateConstruction}\n      />\n    </>\n",
    'detail acceleration render',
)
replace_once(
    "  inventories,\n  now,\n  onToggle,\n  onRecipeChange,\n  onOpenMarket,\n",
    "  inventories,\n  now,\n  gems,\n  acceleratingConstruction,\n  onToggle,\n  onRecipeChange,\n  onAccelerateConstruction,\n  onOpenMarket,\n",
    'detail content props',
)
replace_once(
    "        inventories={inventories}\n        now={now}\n        onRecipeChange={onRecipeChange}\n      />\n      <FacilityMarketAction onOpenMarket={onOpenMarket} />\n",
    "        inventories={inventories}\n        now={now}\n        gems={gems}\n        acceleratingConstruction={acceleratingConstruction}\n        onRecipeChange={onRecipeChange}\n        onAccelerateConstruction={onAccelerateConstruction}\n      />\n      {entry.constructionOnly ? null : <FacilityMarketAction onOpenMarket={onOpenMarket} />}\n",
    'detail content render',
)
replace_once(
    "  inventories,\n  now,\n  isOpen,\n",
    "  inventories,\n  now,\n  gems,\n  acceleratingConstruction,\n  isOpen,\n",
    'mobile props values',
)
replace_once(
    "  onToggle,\n  onRecipeChange,\n  onOpenMarket,\n}: Omit<FacilityClusterDetailSharedProps, 'entry'>",
    "  onToggle,\n  onRecipeChange,\n  onAccelerateConstruction,\n  onOpenMarket,\n}: Omit<FacilityClusterDetailSharedProps, 'entry'>",
    'mobile callbacks',
)
replace_once(
    "            inventories={inventories}\n            now={now}\n            onRecipeChange={onRecipeChange}\n          />\n",
    "            inventories={inventories}\n            now={now}\n            gems={gems}\n            acceleratingConstruction={acceleratingConstruction}\n            onRecipeChange={onRecipeChange}\n            onAccelerateConstruction={onAccelerateConstruction}\n          />\n",
    'mobile body render',
)
replace_once(
    "          <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />\n",
    "          {entry.constructionOnly ? null : <FacilityMarketAction onOpenMarket={() => requestClose(onOpenMarket)} />}\n",
    'mobile footer',
)
replace_once(
    "    buildFacility,\n    startFacility,\n",
    "    buildFacility,\n    accelerateFacilityConstruction,\n    startFacility,\n",
    'model action',
)
replace_once(
    "  const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('');\n  const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false);\n",
    "  const [selectedFacilityGroupId, setSelectedFacilityGroupId] = useState('');\n  const [isFacilityDetailOpen, setFacilityDetailOpen] = useState(false);\n  const [acceleratingConstruction, setAcceleratingConstruction] = useState(false);\n",
    'acceleration state',
)
replace_once(
    "    return game.facilityTypes.flatMap((type) => {\n      const group = groupsByTypeId.get(type.id);\n      return group && group.count > 0 ? [{ type, group }] : [];\n    });\n  }, [game.facilityGroups, game.facilityTypes]);\n",
    "    return game.facilityTypes.flatMap((type): FacilityClusterEntry[] => {\n      const group = groupsByTypeId.get(type.id);\n      const construction = game.facilityConstruction?.facilityTypeId === type.id\n        ? game.facilityConstruction\n        : undefined;\n      if (group && group.count > 0) return [{ type, group, construction }];\n      if (!construction) return [];\n      return [{\n        type,\n        construction,\n        constructionOnly: true,\n        group: {\n          facilityTypeId: type.id,\n          count: 0,\n          participatingCount: 0,\n          pendingJoinCount: 0,\n          listedCount: 0,\n          frozenCount: 0,\n          mortgagedCount: 0,\n          availableCount: 0,\n          nextCycleCount: 0,\n          enabled: false,\n          status: 'stopped',\n          statusReason: 'manual',\n          lifetimeOutput: 0,\n          activeRecipeId: type.defaultRecipeId,\n        },\n      }];\n    });\n  }, [game.facilityConstruction, game.facilityGroups, game.facilityTypes]);\n",
    'ordered entries',
)
replace_once(
    "    for (const { group } of orderedFacilityGroups) summary[group.status] += 1;\n",
    "    for (const entry of orderedFacilityGroups) {\n      if (!entry.constructionOnly) summary[entry.group.status] += 1;\n    }\n",
    'status counts',
)
replace_once(
    "  const openSelectedFacilityMarket = () => {\n    if (!selectedFacilityEntry) return;\n    selectMarketAsset('facility', selectedFacilityEntry.group.facilityTypeId);\n  };\n",
    "  const openSelectedFacilityMarket = () => {\n    if (!selectedFacilityEntry || selectedFacilityEntry.constructionOnly) return;\n    selectMarketAsset('facility', selectedFacilityEntry.group.facilityTypeId);\n  };\n  const accelerateSelectedConstruction = async () => {\n    if (!selectedFacilityEntry?.construction || acceleratingConstruction) return;\n    setAcceleratingConstruction(true);\n    try {\n      await showResult(accelerateFacilityConstruction());\n    } finally {\n      setAcceleratingConstruction(false);\n    }\n  };\n",
    'accelerate action',
)
replace_once(
    "                inventories={game.inventories}\n                now={now}\n                onToggle={toggleSelectedFacility}\n                onRecipeChange={changeSelectedFacilityRecipe}\n                onOpenMarket={openSelectedFacilityMarket}\n",
    "                inventories={game.inventories}\n                now={now}\n                gems={game.gems}\n                acceleratingConstruction={acceleratingConstruction}\n                onToggle={toggleSelectedFacility}\n                onRecipeChange={changeSelectedFacilityRecipe}\n                onAccelerateConstruction={() => void accelerateSelectedConstruction()}\n                onOpenMarket={openSelectedFacilityMarket}\n",
    'desktop detail props',
)
replace_once(
    "        inventories={game.inventories}\n        now={now}\n        isOpen={isFacilityDetailOpen}\n",
    "        inventories={game.inventories}\n        now={now}\n        gems={game.gems}\n        acceleratingConstruction={acceleratingConstruction}\n        isOpen={isFacilityDetailOpen}\n",
    'mobile top props',
)
replace_once(
    "        onToggle={toggleSelectedFacility}\n        onRecipeChange={changeSelectedFacilityRecipe}\n        onOpenMarket={openSelectedFacilityMarket}\n",
    "        onToggle={toggleSelectedFacility}\n        onRecipeChange={changeSelectedFacilityRecipe}\n        onAccelerateConstruction={() => void accelerateSelectedConstruction()}\n        onOpenMarket={openSelectedFacilityMarket}\n",
    'mobile callbacks props',
)

path.write_text(text)
