from pathlib import Path


def edit(path, before, after, count=1):
    p = Path(path)
    text = p.read_text()
    assert text.count(before) == count, (path, before[:100], text.count(before), count)
    p.write_text(text.replace(before, after))


def prepend(path, text):
    p = Path(path)
    p.write_text(text + p.read_text())

prepend('src/types.ts', "import type { CommercialStateFields } from './types/commercial';\n")
edit('src/types.ts', 'export interface EconomyState {', 'export interface EconomyState extends CommercialStateFields {')
prepend('src/api/commercial.ts', "import type { CommercialAutoOperationPolicy } from '../types/commercial';\n")
edit('src/api/commercial.ts', "'build' | 'start' | 'stop'", "'build' | 'start' | 'stop' | 'auto-operation'")
edit('src/api/commercial.ts', '  quantity?: number;', '  quantity?: number;\n  policy?: CommercialAutoOperationPolicy;')

# Business settings and locked settlement detail, without changing the fixed-profit calculation.
prepend('server/src/commercial-buildings.js', "import { normalizeCommercialAutoOperationPolicy } from '../../shared/commercial-auto-operation.js';\n")
edit('server/src/commercial-buildings.js', '  group.enabled = group.enabled === true;', '''  group.enabled = group.enabled === true;
  if (group.autoOperationPolicy !== undefined) {
    const policy = normalizeCommercialAutoOperationPolicy(group.autoOperationPolicy);
    if (policy) group.autoOperationPolicy = policy;
    else delete group.autoOperationPolicy;
  }''')
# Optional fields remain absent for old in-flight cycles; never substitute new prices or counts.
edit('server/src/commercial-buildings.js', '  group.pendingRevenue = revenue;', '''  group.pendingRevenue = revenue;
  group.pendingOperatingCost = requirements.operatingCost;
  group.pendingInputValue = roundInternalMoney(inputValue);
  group.pendingInputs = requirements.inputs.map((input) => ({ ...input }));''')
p = Path('server/src/commercial-buildings.js')
s = p.read_text()
s = s.replace('    delete group.pendingGoodsConsumed;', '    delete group.pendingGoodsConsumed;\n    delete group.pendingOperatingCost;\n    delete group.pendingInputValue;\n    delete group.pendingInputs;')
s = s.replace('  delete group.pendingGoodsConsumed;\n}', '  delete group.pendingGoodsConsumed;\n  delete group.pendingOperatingCost;\n  delete group.pendingInputValue;\n  delete group.pendingInputs;\n}')
anchor = 'export function applyCommercialBuildingAction'
a = s.index(anchor)
s = s[:a] + '''function setCommercialAutoOperation(world, userId, payload, now) {
  const player = world.players?.[String(userId)];
  const type = typeFor(payload.commercialTypeId);
  const group = player && type ? groupFor(player, type.id, payload.provinceId, false, now) : null;
  if (!group || group.count < 1) return result(false, '商业建筑集群不存在');
  const policy = normalizeCommercialAutoOperationPolicy(payload.policy);
  if (!policy) return result(false, '自动经营策略无效');
  group.autoOperationPolicy = policy;
  return result(true, policy.enabled ? '商业自动经营策略已保存' : '商业自动经营已关闭');
}

''' + s[a:]
s = s.replace("  if (operation === 'stop') return stopCommercialBuilding(world, userId, payload, now);", "  if (operation === 'stop') return stopCommercialBuilding(world, userId, payload, now);\n  if (operation === 'auto-operation') return setCommercialAutoOperation(world, userId, payload, now);")
p.write_text(s)

prepend('server/src/factory-auto-operation.js', "import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-buildings.js';\nimport { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';\n")
edit('server/src/factory-auto-operation.js', '  return Object.fromEntries(PRODUCT_CATALOG.map((product) => {', '''  for (const group of player?.commercialBuildingGroups || []) {
    if (!group.enabled || normalizeProvinceId(group.provinceId) !== selectedProvinceId) continue;
    const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((candidate) => candidate.id === group.commercialTypeId);
    const policy = commercialAutoOperationPolicyFor(group);
    const count = nonNegativeInteger(group.count);
    if (!type || !policy.enabled || count < 1) continue;
    for (const input of type.consumptionInputs) {
      const intent = ensureProductIntent(intents, input.productId);
      intent.extraProtected += input.quantity * count * Math.max(0, policy.inputCoverageCycles - 1);
      intent.buyEnabled = true;
      intent.buyPrice = Math.max(intent.buyPrice, priceFor(input.productId, 'balanced', 'buy'));
    }
  }

  return Object.fromEntries(PRODUCT_CATALOG.map((product) => {''')
edit('server/src/factory-auto-operation.js', "  const provinceIds = new Set((player?.facilityGroups || []).map((group) => normalizeProvinceId(group?.provinceId)));", "  const provinceIds = new Set([...(player?.facilityGroups || []), ...(player?.commercialBuildingGroups || [])].map((group) => normalizeProvinceId(group?.provinceId)));")
for path in ['server/src/online-auto-buy.js', 'server/src/online-auto-sell.js']:
    p = Path(path)
    s = p.read_text().replace('productionReservedQuantitiesForPlayer', 'buildingReservedQuantitiesForPlayer')
    s = s.replace("from './facility-groups.js'", "from './building-input-reservations.js'")
    s = s.replace('当前工厂策略无需', '当前建筑策略无需')
    p.write_text(s)

# Client target calculation uses the same sum of industrial + commercial one-cycle holds.
edit('src/auto-trade/useOnlineAutoTrade.ts', 'function productionReservations(game: EconomyState) {', 'function productionReservations(game: EconomyState, provinceId: string) {')
edit('src/auto-trade/useOnlineAutoTrade.ts', '  return reserved;\n}\n\nlet cachedProductionGroups', '''  for (const group of game.commercialBuildingGroups ?? []) {
    if (!group.enabled || group.provinceId !== provinceId) continue;
    const type = game.commercialBuildingTypes?.find((candidate) => candidate.id === group.commercialTypeId);
    if (!type) continue;
    for (const input of type.consumptionInputs) {
      reserved[input.productId] = (reserved[input.productId] ?? 0) + input.quantity * nonNegativeInteger(group.count);
    }
  }
  return reserved;
}

let cachedCommercialGroups: EconomyState['commercialBuildingGroups'];
let cachedCommercialTypes: EconomyState['commercialBuildingTypes'];
let cachedReservationProvinceId = '';
let cachedProductionGroups''')
edit('src/auto-trade/useOnlineAutoTrade.ts', 'function currentProductionReservations(game: EconomyState) {', 'function currentProductionReservations(game: EconomyState, provinceId: string) {')
edit('src/auto-trade/useOnlineAutoTrade.ts', '  if (cachedProductionGroups === game.facilityGroups && cachedProductionTypes === game.facilityTypes) {', '''  if (cachedProductionGroups === game.facilityGroups && cachedProductionTypes === game.facilityTypes
    && cachedCommercialGroups === game.commercialBuildingGroups && cachedCommercialTypes === game.commercialBuildingTypes
    && cachedReservationProvinceId === provinceId) {''')
edit('src/auto-trade/useOnlineAutoTrade.ts', '  cachedProductionReservations = productionReservations(game);', '''  cachedCommercialGroups = game.commercialBuildingGroups;
  cachedCommercialTypes = game.commercialBuildingTypes;
  cachedReservationProvinceId = provinceId;
  cachedProductionReservations = productionReservations(game, provinceId);''')
edit('src/auto-trade/useOnlineAutoTrade.ts', 'currentProductionReservations(game);', 'currentProductionReservations(game, model.selectedProvinceId);')
edit('src/auto-trade/useOnlineAutoTrade.ts', '      game.productionContracts,', '      game.productionContracts,\n      game.commercialBuildingGroups,\n      game.commercialBuildingTypes,\n      model.selectedProvinceId,')

# Shared industrial/commercial presentation. Existing industrial settlement DOM is preserved.
p = Path('src/components/facilities/FacilityProductionFormula.tsx')
s = p.read_text()
s = s.replace("import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';\n", '')
s = s.replace("import { CreditsIcon, CycleIcon, WarehouseIcon } from '../icons/GameIcons';\n", '')
s = s.replace("import { ProductArtwork } from '../products/ProductArtwork';\n", '')
s = "import { BuildingSettlementPanel } from '../buildings/BuildingSettlementPanel';\nimport { BuildingSettlementProducts as RecipeItems } from '../buildings/BuildingSettlementProducts';\n" + s
a = s.index('function RecipeItems(')
b = s.index('function progressDescription(', a)
s = s[:a] + s[b:]
a = s.index('  return (', s.index('export function FacilityProductionFormula'))
s = s[:a] + '''  return (
    <BuildingSettlementPanel title={<GameConcept concept="production-settlement" />} status={group.status} description={description}
      inputLabel={<GameConcept concept="production-input" />} outputLabel={<GameConcept concept="production-output" />}
      inputs={inputs.length > 0 ? <RecipeItems items={inputs} productNames={productNames} inventories={inventories}
        multiplier={scope.count} groupClassName="facility-formula-input-group" itemClassName="facility-formula-input-item"
        onOpenProductMarket={onOpenProductMarket} /> : <span className="facility-formula-empty">无</span>}
      outputs={<RecipeItems items={outputs} productNames={productNames} inventories={inventories}
        multiplier={scope.count} groupClassName="facility-formula-output-group" itemClassName="facility-formula-output-item"
        onOpenProductMarket={onOpenProductMarket} />}
      cycleMs={type.cycleMs} operatingCost={type.operatingCost * scope.count}
      progress={<FacilityGroupProgress group={group} type={type} now={now} />}
    />
  );
}
'''
p.write_text(s)

p = Path('src/components/facilities/FacilityAutoOperationControls.tsx')
s = p.read_text().replace("import { SwitchControl } from '../ui/layout';", "import { BuildingAutoOperationSection } from '../buildings/BuildingAutoOperationSection';")
a = s.index('  return (\n    <section')
s = s[:a] + '''  return (
    <BuildingAutoOperationSection label={<GameConcept concept="factory-auto-operation">自动经营</GameConcept>}
      enabled={draft.enabled} disabled={group.count < 1 || saving}
      onChange={(enabled) => updatePolicy({ ...draft, enabled })} message={message}>
      {children({ policy: draft, saving, updatePolicy })}
    </BuildingAutoOperationSection>
  );
}
'''
p.write_text(s)

# Additional contextual help uses the existing dotted-underline popover component.
edit('src/game-guide/gameConcepts.ts', "  'factory-auto-operation': {", '''  'commercial-auto-operation': {
    label: '自动经营',
    description: '营业开启时，按本州商业建筑数量和商品保障周期派生自动采购。沿用正式市场的当日官方价与价格阈值，不跨州取货，不出售商品。关闭自动经营不停止已开启的营业，也不取消已投入周期。',
  },
  'commercial-input-coverage': {
    label: '商品保障',
    description: '按下一周期全部商业建筑的消费需求，保障 1、2、3 或 5 个营业周期的本州库存。与工业原料和合同保留合并计算，不重复采购或形成额外冻结。',
  },
  'commercial-settlement': {
    label: '经营结算',
    description: '服务器在周期开始时锁定已投入商品、商品价值、运营成本和固定利润；完成后返还商品价值与运营成本并发放固定利润。运行中显示锁定值，未运行时仅显示下一周期预估。',
  },
  'factory-auto-operation': {''')

# Small domain-specific styles; all page, card, filter, controls and settlement geometry stays shared.
p = Path('src/styles/commercial-buildings.css')
s = p.read_text()
a = s.index('.commercial-consumption-list {')
s = s[:a] + '''.building-construction-sections {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.commercial-settlement .facility-formula-item-group[data-shortage='true'] .facility-formula-inventory {
  color: var(--color-danger);
}

.commercial-settlement-revenue .facility-formula-output-item {
  min-width: 0;
  overflow-wrap: anywhere;
}
'''
p.write_text(s)
