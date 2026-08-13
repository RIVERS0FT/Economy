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
        raise RuntimeError(f'{label}: expected 1 occurrence, found {count}')
    return text.replace(old, new, 1)


def replace_count(text, old, new, expected, label):
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f'{label}: expected {expected} occurrences, found {count}')
    return text.replace(old, new)

# --- Research catalog: production and operation research become separate nodes. ---
path = 'server/src/research-catalog.js'
text = read(path)

c2_operation = """  {
    id: 'tool-operation', name: '工具作业', stage: 'C2', rank: 2, cost: 300, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['tools'],
    description: '掌握在农业、采掘和初级加工中使用工业工具的作业能力，不提供工具制造能力。',
  },
  {
    id: 'feed-husbandry', name: '饲料饲养', stage: 'C2', rank: 2, cost: 200, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-livestock'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['feed'],
    description: '掌握使用配合饲料进行标准化养殖的作业能力，不提供饲料生产能力。',
  },
"""
text = replace_once(text, "  {\n    id: 'pulp-technology'", c2_operation + "  {\n    id: 'pulp-technology'", 'insert C2 operation technologies')

c3_operation = """  {
    id: 'fertilizer-application', name: '化肥施用', stage: 'C3', rank: 3, cost: 400, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['basic-crops'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['fertilizer'],
    description: '掌握在农场与果园中使用工业化肥的施用能力，不提供化肥生产能力。',
  },
  {
    id: 'veterinary-application', name: '药剂精养', stage: 'C3', rank: 3, cost: 450, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['feed-husbandry'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['veterinary-medicine'],
    description: '掌握在畜牧与渔业中使用养殖药剂的精养能力，不提供养殖药剂生产能力。',
  },
  {
    id: 'industrial-fuel-operation', name: '工业动力作业', stage: 'C3', rank: 3, cost: 450, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['industrial-fuel'],
    description: '掌握将工业燃料用于动力采伐和连续化加工的作业能力，不提供炼油能力。',
  },
  {
    id: 'industrial-chemical-operation', name: '工业化学作业', stage: 'C3', rank: 3, cost: 500, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['industrial-chemicals'],
    description: '掌握将工业化学品用于强化采矿与采油的作业能力，不提供炼化生产能力。',
  },
"""
text = replace_once(text, "  {\n    id: 'oil-refining'", c3_operation + "  {\n    id: 'oil-refining'", 'insert C3 operation technologies')

c4_operation = """  {
    id: 'machinery-operation', name: '机械化作业', stage: 'C4', rank: 4, cost: 700, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['tool-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['machinery'],
    description: '掌握在农业、养殖、采掘与加工中使用通用机械的作业能力，不提供机械制造能力。',
  },
  {
    id: 'tractor-operation', name: '拖拉机作业', stage: 'C4', rank: 4, cost: 800, durationMs: RESEARCH_DURATION_MS,
    prerequisiteTechnologyIds: ['machinery-operation'], unlockFacilityTypeIds: [], kind: 'operation', operationProductIds: ['tractor'],
    description: '掌握在农场与果园中使用拖拉机的农业作业能力，不提供拖拉机制造能力。',
  },
"""
text = replace_once(text, "  {\n    id: 'mechanical-engineering'", c4_operation + "  {\n    id: 'mechanical-engineering'", 'insert C4 operation technologies')

text = replace_once(
    text,
    "  ...technology,\n  prerequisiteTechnologyIds: Object.freeze([...technology.prerequisiteTechnologyIds]),\n  unlockFacilityTypeIds: Object.freeze([...technology.unlockFacilityTypeIds]),\n})));",
    "  ...technology,\n  kind: technology.kind || 'production',\n  prerequisiteTechnologyIds: Object.freeze([...technology.prerequisiteTechnologyIds]),\n  unlockFacilityTypeIds: Object.freeze([...technology.unlockFacilityTypeIds]),\n  operationProductIds: Object.freeze([...(technology.operationProductIds || [])]),\n})));",
    'freeze technology kind and operation products',
)
write(path, text)

# --- Production methods: every C1/C2 input-using method depends only on operation technologies. ---
path = 'server/src/production-methods.js'
text = read(path)
requirements = {
    '工具耕作': (['tool-operation'], 1),
    '化肥耕作': (['fertilizer-application'], 1),
    '拖拉机耕作': (['tractor-operation'], 1),
    '工具管护': (['tool-operation'], 1),
    '化肥管护': (['fertilizer-application'], 1),
    '拖拉机管护': (['tractor-operation'], 1),
    '饲料饲养': (['feed-husbandry'], 1),
    '饲料精养': (['feed-husbandry'], 1),
    '药剂精养': (['veterinary-application'], 2),
    '机械化养殖': (['machinery-operation'], 2),
    '锯具采伐': (['tool-operation'], 1),
    '动力采伐': (['tool-operation', 'industrial-fuel-operation'], 1),
    '机械化采伐': (['machinery-operation', 'industrial-fuel-operation'], 1),
    '钻具开采': (['tool-operation'], 1),
    '爆破开采': (['tool-operation', 'industrial-chemical-operation'], 1),
    '机械化采矿': (['machinery-operation', 'industrial-chemical-operation', 'industrial-fuel-operation'], 1),
    '化学辅助采油': (['industrial-chemical-operation'], 1),
    '机械增产钻采': (['machinery-operation', 'industrial-chemical-operation'], 1),
    '动力机械钻采': (['machinery-operation', 'industrial-chemical-operation', 'industrial-fuel-operation'], 1),
    '辊式加工': (['tool-operation'], 1),
    '机械加工': (['machinery-operation'], 1),
    '连续化加工': (['machinery-operation', 'industrial-fuel-operation'], 1),
    '锯具流水线': (['tool-operation'], 1),
    '机械制材': (['machinery-operation'], 1),
    '动力连续制材': (['machinery-operation', 'industrial-fuel-operation'], 1),
    '批量配料': (['tool-operation'], 1),
    '机械混配': (['machinery-operation'], 1),
    '动力连续混配': (['machinery-operation', 'industrial-fuel-operation'], 1),
}
for name, (ids, expected) in requirements.items():
    rendered = '[' + ', '.join(repr(item) for item in ids) + ']'
    pattern = re.compile(r"(dedicatedMethod\(\{[^\n]*name: '" + re.escape(name) + r"'[^\n]*requiredTechnologyIds: )\[[^\]]*\]")
    text, count = pattern.subn(lambda match: match.group(1) + rendered, text)
    if count != expected:
        raise RuntimeError(f'production method {name}: expected {expected} replacements, found {count}')
write(path, text)

# --- World 29 research migration: grant old users equivalent operation access once, and preserve active-research expectations. ---
path = 'server/src/research.js'
text = read(path)
text = replace_once(text, 'export const RESEARCH_WORLD_VERSION = 28;', 'export const RESEARCH_WORLD_VERSION = 29;', 'research world version')
text = replace_once(
    text,
    "const TECHNOLOGY_ORDER = new Map(RESEARCH_TECHNOLOGY_CATALOG.map((technology, index) => [technology.id, index]));",
    "const TECHNOLOGY_ORDER = new Map(RESEARCH_TECHNOLOGY_CATALOG.map((technology, index) => [technology.id, index]));\nconst LEGACY_OPERATION_TECHNOLOGY_GRANTS = Object.freeze({\n  'tool-manufacturing': Object.freeze(['tool-operation']),\n  'fertilizer-engineering': Object.freeze(['fertilizer-application']),\n  'feed-processing': Object.freeze(['feed-husbandry']),\n  'veterinary-medicine': Object.freeze(['veterinary-application']),\n  'oil-refining': Object.freeze(['industrial-fuel-operation', 'industrial-chemical-operation']),\n  'mechanical-engineering': Object.freeze(['machinery-operation']),\n  'agricultural-machinery': Object.freeze(['tractor-operation']),\n});",
    'legacy operation grant map',
)
text = replace_once(
    text,
    "function grantTechnologyClosure(completed, technologyIds) {\n  for (const technologyId of researchTechnologyClosure(technologyIds)) completed.add(technologyId);\n}\nfunction productionMethodGroupForFacility(facility) {",
    "function grantTechnologyClosure(completed, technologyIds) {\n  for (const technologyId of researchTechnologyClosure(technologyIds)) completed.add(technologyId);\n}\nfunction grantLegacyOperationTechnologies(completed) {\n  for (const [productionTechnologyId, operationTechnologyIds] of Object.entries(LEGACY_OPERATION_TECHNOLOGY_GRANTS)) {\n    if (completed.has(productionTechnologyId)) grantTechnologyClosure(completed, operationTechnologyIds);\n  }\n}\nfunction activeResearchWithLegacyOperationGrants(previousActive) {\n  if (!previousActive || typeof previousActive !== 'object') return previousActive;\n  const additional = LEGACY_OPERATION_TECHNOLOGY_GRANTS[String(previousActive.technologyId || '')];\n  if (!additional) return previousActive;\n  return {\n    ...previousActive,\n    grantTechnologyIds: sortedTechnologyIds([\n      previousActive.technologyId,\n      ...(Array.isArray(previousActive.grantTechnologyIds) ? previousActive.grantTechnologyIds : []),\n      ...additional,\n    ]),\n  };\n}\nfunction productionMethodGroupForFacility(facility) {",
    'legacy operation helpers',
)
old_valid_active = """    return {
      technologyId: technology.id,
      technologyName: technology.name,
      targetComplexity: technology.stage,
      startedAt,
      completesAt: timing.completesAt,
      durationMs: timing.durationMs,
      cost,
      employmentReleased: Math.min(cost, Math.max(0, Math.floor(Number(previousActive.employmentReleased || 0)))),
    };"""
new_valid_active = """    const grantTechnologyIds = Array.isArray(previousActive.grantTechnologyIds)
      ? sortedTechnologyIds(previousActive.grantTechnologyIds).filter((technologyId) => !completed.has(technologyId))
      : [];
    return {
      technologyId: technology.id,
      technologyName: technology.name,
      targetComplexity: technology.stage,
      startedAt,
      completesAt: timing.completesAt,
      durationMs: timing.durationMs,
      cost,
      employmentReleased: Math.min(cost, Math.max(0, Math.floor(Number(previousActive.employmentReleased || 0)))),
      ...(grantTechnologyIds.length > 0 ? { grantTechnologyIds } : {}),
    };"""
text = replace_once(text, old_valid_active, new_valid_active, 'preserve grantTechnologyIds for active node research')
text = replace_once(
    text,
    'export function ensurePlayerResearch(world, player, now = Date.now()) {',
    'export function ensurePlayerResearch(world, player, now = Date.now(), migrationOptions = null) {',
    'ensurePlayerResearch migration options',
)
text = replace_once(
    text,
    "  for (const facilityTypeId of collectLegacyFacilityTypeIds(world, player)) {\n    const technology = researchTechnologyForFacility(facilityTypeId);\n    if (technology) grantTechnologyClosure(completed, [technology.id]);\n  }\n\n  const completedTechnologyIds = sortedTechnologyIds(completed);",
    "  for (const facilityTypeId of collectLegacyFacilityTypeIds(world, player)) {\n    const technology = researchTechnologyForFacility(facilityTypeId);\n    if (technology) grantTechnologyClosure(completed, [technology.id]);\n  }\n  if (migrationOptions?.grantLegacyOperationAccess) grantLegacyOperationTechnologies(completed);\n\n  const completedTechnologyIds = sortedTechnologyIds(completed);",
    'grant operation access during world 29 migration',
)
text = replace_once(
    text,
    '  const active = normalizeActiveResearch(previous?.active, completed);',
    "  const activeSource = migrationOptions?.grantLegacyOperationAccess\n    ? activeResearchWithLegacyOperationGrants(previous?.active)\n    : previous?.active;\n  const active = normalizeActiveResearch(activeSource, completed);",
    'active research migration source',
)
text = replace_once(
    text,
    "export function migrateResearchWorld(world, now = Date.now()) {\n  if (!world || typeof world !== 'object') return world;\n  for (const player of Object.values(world.players || {})) ensurePlayerResearch(world, player, now);\n  world.version = RESEARCH_WORLD_VERSION;\n  return world;\n}",
    "export function migrateResearchWorld(world, now = Date.now()) {\n  if (!world || typeof world !== 'object') return world;\n  const grantLegacyOperationAccess = Number(world.version || 0) < RESEARCH_WORLD_VERSION;\n  for (const player of Object.values(world.players || {})) {\n    ensurePlayerResearch(world, player, now, { grantLegacyOperationAccess });\n  }\n  world.version = RESEARCH_WORLD_VERSION;\n  return world;\n}",
    'world 29 migration gate',
)
write(path, text)

path = 'server/src/storage.js'
text = read(path)
text = replace_once(text, '    world.version = 28;\n    return world;', '    world.version = 29;\n    return world;', 'storage current world version')
write(path, text)

# --- Client technology metadata and research UI. ---
path = 'src/types.ts'
text = read(path)
text = replace_once(
    text,
    "  prerequisiteTechnologyIds: string[];\n  unlockFacilityTypeIds: string[];\n  description: string;",
    "  prerequisiteTechnologyIds: string[];\n  unlockFacilityTypeIds: string[];\n  kind?: 'production' | 'operation';\n  operationProductIds?: string[];\n  description: string;",
    'research technology client metadata',
)
write(path, text)

path = 'src/pages/ResearchPage.tsx'
text = read(path)
text = replace_once(text, "import { FacilityIcon } from '../components/icons/FacilityIcons';", "import { FacilityIcon } from '../components/icons/FacilityIcons';\nimport { ProductArtwork } from '../components/products/ProductArtwork';", 'research product artwork import')
text = replace_once(
    text,
    "  const progress = progressForResearchTechnology(technology, active, now, isMastered);\n  const shortfall = Math.max(0, technology.cost - model.game.credits);",
    "  const progress = progressForResearchTechnology(technology, active, now, isMastered);\n  const shortfall = Math.max(0, technology.cost - model.game.credits);",
    'keep detail presentation anchor',
)
# Summary artwork and type tag.
text = replace_once(
    text,
    "        artwork={facilities[0] ? <FacilityIcon facilityTypeId={facilities[0].id} /> : <span>{technology.stage}</span>}\n        title={<h3>{technology.name}</h3>}\n        meta={\n          <>\n            <span className=\"research-detail-summary-status\">",
    "        artwork={technology.kind === 'operation' && technology.operationProductIds?.[0]\n          ? <ProductArtwork productId={technology.operationProductIds[0]} />\n          : facilities[0] ? <FacilityIcon facilityTypeId={facilities[0].id} /> : <span>{technology.stage}</span>}\n        title={<h3>{technology.name}</h3>}\n        meta={\n          <>\n            <StatusTag tone=\"neutral\">{technology.kind === 'operation' ? '作业科技' : '生产科技'}</StatusTag>\n            <span className=\"research-detail-summary-status\">",
    'research summary operation artwork and tag',
)
# Insert derived operation methods before return.
text = replace_once(
    text,
    "  const {\n    active,\n    status,\n    isSelectedActive,",
    "  const operationMethodEntries = technology.kind === 'operation'\n    ? model.game.facilityTypes.flatMap((facility) => (facility.productionMethodGroups ?? []).flatMap((group) => (\n        group.methods\n          .filter((method) => method.requiredTechnologyIds?.includes(technology.id))\n          .map((method) => ({ facility, method }))\n      )))\n    : [];\n  const {\n    active,\n    status,\n    isSelectedActive,",
    'derive operation method unlocks',
)
# Dynamic unlock section.
old_unlock = """        <strong id={`research-unlocks-${technology.id}`}>解锁工厂</strong>
        {facilities.length > 0 ? (
          <div className="research-unlock-list">
            {facilities.map((facility) => (
              <div className="research-unlock-item" key={facility.id}>
                <span className="research-unlock-artwork" aria-hidden="true">
                  <FacilityIcon facilityTypeId={facility.id} />
                </span>
                <span>{facility.name}</span>
              </div>
            ))}
          </div>
        ) : <p className="ui-helper-text">该项目完成后授予阶段剩余科技，不直接对应单座工厂。</p>}"""
new_unlock = """        <strong id={`research-unlocks-${technology.id}`}>
          {technology.kind === 'operation' ? '解锁作业制度' : '解锁工厂'}
        </strong>
        {technology.kind === 'operation' ? (
          operationMethodEntries.length > 0 ? (
            <div className="research-unlock-list">
              {operationMethodEntries.map(({ facility, method }) => (
                <div className="research-unlock-item" key={`${facility.id}:${method.id}`}>
                  <span className="research-unlock-artwork" aria-hidden="true">
                    <FacilityIcon facilityTypeId={facility.id} />
                  </span>
                  <span>{facility.name} · {method.name}</span>
                </div>
              ))}
            </div>
          ) : <p className="ui-helper-text">当前工厂目录尚未返回该作业科技对应的制度。</p>
        ) : facilities.length > 0 ? (
          <div className="research-unlock-list">
            {facilities.map((facility) => (
              <div className="research-unlock-item" key={facility.id}>
                <span className="research-unlock-artwork" aria-hidden="true">
                  <FacilityIcon facilityTypeId={facility.id} />
                </span>
                <span>{facility.name}</span>
              </div>
            ))}
          </div>
        ) : <p className="ui-helper-text">该项目完成后授予阶段剩余科技，不直接对应单座工厂。</p>}"""
text = replace_once(text, old_unlock, new_unlock, 'dynamic research unlock section')
# Industry context supports operation materials.
old_context_start = """        <div className="research-industry-context__list">
          {facilities.map((facility) => {"""
new_context_start = """        <div className="research-industry-context__list">
          {technology.kind === 'operation' ? (technology.operationProductIds ?? []).map((productId) => {
            const product = model.game.products.find((candidate) => candidate.id === productId);
            const signal = marketDecisionSignal(model.game.markets[productId]);
            const inventory = model.game.inventories[productId]?.available ?? 0;
            return (
              <article className="research-industry-context__item" key={productId}>
                <header>
                  <span aria-hidden="true"><ProductArtwork productId={productId} /></span>
                  <strong>{product?.name ?? productId}</strong>
                  <StatusTag tone="neutral">生产资料</StatusTag>
                </header>
                <DataList className="compact">
                  <DataRow label="当前库存" value={formatNumber(inventory)} />
                  <DataRow
                    label="最近成交"
                    value={signal.price === null ? '暂无真实成交' : `${formatCurrency(signal.price)} ${marketTrendGlyph(signal.trend)}`}
                  />
                </DataList>
              </article>
            );
          }) : facilities.map((facility) => {"""
text = replace_once(text, old_context_start, new_context_start, 'operation industry context')
text = replace_once(
    text,
    "          {facilities.length === 0 ? <p className=\"ui-helper-text\">该科技没有直接解锁工厂，经营影响由后续科技节点体现。</p> : null}",
    "          {technology.kind !== 'operation' && facilities.length === 0 ? <p className=\"ui-helper-text\">该科技没有直接解锁工厂，经营影响由后续科技节点体现。</p> : null}",
    'operation empty facility message',
)
# Tree node artwork and aria distinguish operation tech.
text = replace_once(
    text,
    "                        const facility = technology.unlockFacilityTypeIds\n                          .map((facilityTypeId) => facilitiesById.get(facilityTypeId))\n                          .find(Boolean);",
    "                        const facility = technology.unlockFacilityTypeIds\n                          .map((facilityTypeId) => facilitiesById.get(facilityTypeId))\n                          .find(Boolean);\n                        const operationProductId = technology.kind === 'operation' ? technology.operationProductIds?.[0] : undefined;",
    'research node operation product',
)
text = replace_once(
    text,
    "                            aria-label={`${technology.name}，${statusLabels[status]}，${technology.stage} 科技`}",
    "                            aria-label={`${technology.name}，${statusLabels[status]}，${technology.stage} ${technology.kind === 'operation' ? '作业科技' : '生产科技'}`}",
    'research node aria type',
)
text = replace_once(
    text,
    "                              {facility ? <FacilityIcon facilityTypeId={facility.id} /> : <span>{technology.stage}</span>}",
    "                              {operationProductId\n                                ? <ProductArtwork productId={operationProductId} />\n                                : facility ? <FacilityIcon facilityTypeId={facility.id} /> : <span>{technology.stage}</span>}",
    'research node operation artwork',
)
write(path, text)

# --- Browser fixture and regression. ---
path = 'tests/browser/runtime-harness.tsx'
text = read(path)
fixture_c2 = """      {
            \"id\": \"tool-operation\",
            \"name\": \"工具作业\",
            \"stage\": \"C2\",
            \"rank\": 2,
            \"cost\": 300,
            \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"basic-crops\"],
            \"unlockFacilityTypeIds\": [],
            \"kind\": \"operation\",
            \"operationProductIds\": [\"tools\"],
            \"description\": \"掌握使用工业工具的作业能力，不提供工具制造能力。\"
      },
      {
            \"id\": \"feed-husbandry\",
            \"name\": \"饲料饲养\",
            \"stage\": \"C2\",
            \"rank\": 2,
            \"cost\": 200,
            \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"basic-livestock\"],
            \"unlockFacilityTypeIds\": [],
            \"kind\": \"operation\",
            \"operationProductIds\": [\"feed\"],
            \"description\": \"掌握使用配合饲料的作业能力，不提供饲料生产能力。\"
      },
"""
text = replace_once(text, '      {\n            "id": "pulp-technology"', fixture_c2 + '      {\n            "id": "pulp-technology"', 'browser C2 operation fixtures')
fixture_c3 = """      {
            \"id\": \"fertilizer-application\", \"name\": \"化肥施用\", \"stage\": \"C3\", \"rank\": 3, \"cost\": 400, \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"basic-crops\"], \"unlockFacilityTypeIds\": [], \"kind\": \"operation\", \"operationProductIds\": [\"fertilizer\"], \"description\": \"掌握化肥施用能力。\"
      },
      {
            \"id\": \"veterinary-application\", \"name\": \"药剂精养\", \"stage\": \"C3\", \"rank\": 3, \"cost\": 450, \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"feed-husbandry\"], \"unlockFacilityTypeIds\": [], \"kind\": \"operation\", \"operationProductIds\": [\"veterinary-medicine\"], \"description\": \"掌握养殖药剂使用能力。\"
      },
      {
            \"id\": \"industrial-fuel-operation\", \"name\": \"工业动力作业\", \"stage\": \"C3\", \"rank\": 3, \"cost\": 450, \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"tool-operation\"], \"unlockFacilityTypeIds\": [], \"kind\": \"operation\", \"operationProductIds\": [\"industrial-fuel\"], \"description\": \"掌握工业燃料作业能力。\"
      },
      {
            \"id\": \"industrial-chemical-operation\", \"name\": \"工业化学作业\", \"stage\": \"C3\", \"rank\": 3, \"cost\": 500, \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"tool-operation\"], \"unlockFacilityTypeIds\": [], \"kind\": \"operation\", \"operationProductIds\": [\"industrial-chemicals\"], \"description\": \"掌握工业化学品作业能力。\"
      },
"""
text = replace_once(text, '      {\n            "id": "oil-refining"', fixture_c3 + '      {\n            "id": "oil-refining"', 'browser C3 operation fixtures')
fixture_c4 = """      {
            \"id\": \"machinery-operation\", \"name\": \"机械化作业\", \"stage\": \"C4\", \"rank\": 4, \"cost\": 700, \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"tool-operation\"], \"unlockFacilityTypeIds\": [], \"kind\": \"operation\", \"operationProductIds\": [\"machinery\"], \"description\": \"掌握机械化作业能力。\"
      },
      {
            \"id\": \"tractor-operation\", \"name\": \"拖拉机作业\", \"stage\": \"C4\", \"rank\": 4, \"cost\": 800, \"durationMs\": 21600000,
            \"prerequisiteTechnologyIds\": [\"machinery-operation\"], \"unlockFacilityTypeIds\": [], \"kind\": \"operation\", \"operationProductIds\": [\"tractor\"], \"description\": \"掌握拖拉机农业作业能力。\"
      },
"""
text = replace_once(text, '      {\n            "id": "mechanical-engineering"', fixture_c4 + '      {\n            "id": "mechanical-engineering"', 'browser C4 operation fixtures')
write(path, text)

path = 'tests/browser/research-technology-tree.spec.ts'
text = read(path)
text = replace_once(text, "    await expect(page.locator('.research-technology-node')).toHaveCount(24);", "    await expect(page.locator('.research-technology-node')).toHaveCount(32);", 'browser technology count')
insert_test = """
  test('distinguishes operation research from production research', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const toolOperation = page.getByRole('button', { name: /工具作业，可研发，C2 作业科技/ });
    await toolOperation.click();
    const panel = page.locator('.research-action-panel');
    await expect(panel).toContainText('工具作业');
    await expect(panel).toContainText('作业科技');
    await expect(panel).toContainText('解锁作业制度');
    await expect(panel).toContainText('工具');
    await expect(panel).not.toContainText('工具作坊');

    const toolManufacturing = page.getByRole('button', { name: /工具制造，尚未开放，C4 生产科技/ });
    await toolManufacturing.click();
    await expect(panel).toContainText('生产科技');
    await expect(panel).toContainText('解锁工厂');
  });
"""
text = replace_once(text, "\n  test('preserves an explicit technology selection across refreshed snapshots'", insert_test + "\n  test('preserves an explicit technology selection across refreshed snapshots'", 'operation research browser test')
write(path, text)

# --- Server tests and verification. ---
path = 'server/test/research.test.js'
text = read(path)
text = replace_count(text, "assert.match(blockedTool.message, /工具制造/);", "assert.match(blockedTool.message, /工具作业/);", 1, 'tool operation error message')
text = replace_count(text, "player.research.completedTechnologyIds.push('tool-manufacturing');", "player.research.completedTechnologyIds.push('tool-operation');", 1, 'grant tool operation in access test')
text = replace_once(text, "  assert.match(blockedMechanized.message, /机械工程/);\n  assert.match(blockedMechanized.message, /石油炼化/);", "  assert.match(blockedMechanized.message, /机械化作业/);\n  assert.match(blockedMechanized.message, /工业动力作业/);", 'mechanized access messages')
text = replace_once(text, "  player.research.completedTechnologyIds.push('mechanical-engineering', 'oil-refining');", "  player.research.completedTechnologyIds.push('machinery-operation', 'industrial-fuel-operation');", 'mechanized operation grants')
text = replace_once(text, '  assert.equal(world.version, 28);', '  assert.equal(world.version, 29);', 'research migration version assertion')
new_tests = """

test('operation research is independent from production research for new players', () => {
  const { world, user, player } = createPlayer(9910);
  player.credits = 10_000;
  const started = applyResearchAction(world, user, 'startResearch', { technologyId: 'tool-operation' }, NOW);
  assert.equal(started.ok, true);
  processResearchWorld(world, NOW + RESEARCH_DURATION_MS);
  assert.equal(player.research.completedTechnologyIds.includes('tool-operation'), true);
  assert.equal(player.research.completedTechnologyIds.includes('tool-manufacturing'), false);
  assert.equal(hasResearchAccessForFacility(world, player, 'tool-workshop', NOW + RESEARCH_DURATION_MS), false);
});

test('world 29 grants equivalent operation access once without coupling future research', () => {
  const { world, player } = createPlayer(9911);
  world.version = 28;
  player.research.completedTechnologyIds = [
    'basic-crops', 'basic-livestock', 'tool-manufacturing', 'fertilizer-engineering', 'feed-processing',
    'veterinary-medicine', 'oil-refining', 'mechanical-engineering', 'agricultural-machinery',
  ];
  migrateResearchWorld(world, NOW + 1);
  assert.equal(world.version, 29);
  for (const technologyId of [
    'tool-operation', 'fertilizer-application', 'feed-husbandry', 'veterinary-application',
    'industrial-fuel-operation', 'industrial-chemical-operation', 'machinery-operation', 'tractor-operation',
  ]) assert.equal(player.research.completedTechnologyIds.includes(technologyId), true, technologyId);

  const { world: currentWorld, player: currentPlayer } = createPlayer(9912);
  currentWorld.version = 29;
  currentPlayer.research.completedTechnologyIds = ['basic-crops', 'basic-livestock', 'tool-manufacturing'];
  migrateResearchWorld(currentWorld, NOW + 2);
  assert.equal(currentPlayer.research.completedTechnologyIds.includes('tool-operation'), false);
});

test('world 29 preserves operation access promised by active legacy production research', () => {
  const { world, player } = createPlayer(9913);
  world.version = 28;
  player.research.active = {
    technologyId: 'tool-manufacturing',
    technologyName: '工具制造',
    targetComplexity: 'C4',
    startedAt: NOW,
    completesAt: NOW + RESEARCH_DURATION_MS,
    durationMs: RESEARCH_DURATION_MS,
    cost: 1_050,
    employmentReleased: 0,
  };
  migrateResearchWorld(world, NOW + 1);
  assert.deepEqual(player.research.active.grantTechnologyIds, ['tool-manufacturing', 'tool-operation']);
  processResearchWorld(world, NOW + RESEARCH_DURATION_MS);
  assert.equal(player.research.completedTechnologyIds.includes('tool-manufacturing'), true);
  assert.equal(player.research.completedTechnologyIds.includes('tool-operation'), true);
});
"""
text = text.rstrip() + new_tests + '\n'
write(path, text)

path = 'server/test/domain.test.js'
text = read(path)
text = text.replace('assert.equal(world.version, 28);', 'assert.equal(world.version, 29);')
write(path, text)

path = 'scripts/verify-research-progression.mjs'
text = read(path)
text = replace_once(text, 'assert.equal(RESEARCH_TECHNOLOGY_CATALOG.length, 24);', 'assert.equal(RESEARCH_TECHNOLOGY_CATALOG.length, 32);', 'research catalog count verifier')
text = replace_once(text, 'assert.equal(RESEARCH_LEVEL_CATALOG.reduce((sum, stage) => sum + stage.cost, 0), 27_900);', 'assert.equal(RESEARCH_LEVEL_CATALOG.reduce((sum, stage) => sum + stage.cost, 0), 31_700);', 'research cost verifier')
text = replace_once(
    text,
    "const technologyIds = new Set(RESEARCH_TECHNOLOGY_CATALOG.map((technology) => technology.id));",
    "const technologyIds = new Set(RESEARCH_TECHNOLOGY_CATALOG.map((technology) => technology.id));\nconst operationTechnologyIds = new Set([\n  'tool-operation', 'feed-husbandry', 'fertilizer-application', 'veterinary-application',\n  'industrial-fuel-operation', 'industrial-chemical-operation', 'machinery-operation', 'tractor-operation',\n]);\nassert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.kind === 'operation').length, 8);\nassert.equal(RESEARCH_TECHNOLOGY_CATALOG.filter((technology) => technology.kind === 'operation')\n  .every((technology) => operationTechnologyIds.has(technology.id) && technology.unlockFacilityTypeIds.length === 0), true);",
    'operation technology verifier',
)
text = replace_once(
    text,
    "  ['server/src/research-catalog.js', 'RESEARCH_DURATION_MS = 6 * 60 * 60_000'],",
    "  ['server/src/research-catalog.js', 'RESEARCH_DURATION_MS = 6 * 60 * 60_000'],\n  ['server/src/research-catalog.js', \"id: 'tool-operation'\"],\n  ['server/src/research-catalog.js', \"kind: 'operation'\"],\n  ['server/src/research.js', 'LEGACY_OPERATION_TECHNOLOGY_GRANTS'],",
    'operation research source checks',
)
write(path, text)

path = 'scripts/verify-production-methods.mjs'
text = read(path)
text = replace_once(
    text,
    "const dedicatedMethodIds = ['standard', 'assisted', 'intensive', 'mechanized'];",
    "const dedicatedMethodIds = ['standard', 'assisted', 'intensive', 'mechanized'];\nconst operationTechnologyIds = new Set([\n  'tool-operation', 'feed-husbandry', 'fertilizer-application', 'veterinary-application',\n  'industrial-fuel-operation', 'industrial-chemical-operation', 'machinery-operation', 'tractor-operation',\n]);",
    'production verifier operation tech set',
)
text = replace_once(
    text,
    "    if (dedicated && method.id !== 'standard') assert.ok(method.requiredTechnologyIds.length > 0);",
    "    if (dedicated && method.id !== 'standard') {\n      assert.ok(method.requiredTechnologyIds.length > 0);\n      assert.equal(method.requiredTechnologyIds.every((technologyId) => operationTechnologyIds.has(technologyId)), true,\n        `${facility.id}/${method.id} 高级制度只能依赖作业科技`);\n    }",
    'production verifier operation-only dependencies',
)
text = replace_once(
    text,
    "  '该旧作业制度已退役',",
    "  '该旧作业制度已退役',\n  'LEGACY_OPERATION_TECHNOLOGY_GRANTS',",
    'production verifier migration marker',
)
write(path, text)

path = 'scripts/verify-research-page.mjs'
text = read(path)
text = replace_once(text, "  'unlockFacilityTypeIds',", "  'unlockFacilityTypeIds',\n  \"id: 'tool-operation'\",\n  \"kind: 'operation'\",\n  'operationProductIds',", 'research page verifier catalog fields')
text = replace_once(text, "  '按产业链选择科技节点',", "  '按产业链选择科技节点',\n  \"technology.kind === 'operation' ? '作业科技' : '生产科技'\",\n  \"technology.kind === 'operation' ? '解锁作业制度' : '解锁工厂'\",", 'research page verifier operation UI')
text = replace_once(text, "  'opens technology details in the shared mobile sheet',", "  'opens technology details in the shared mobile sheet',\n  'distinguishes operation research from production research',", 'research browser verifier')
write(path, text)

# --- Authority docs and version 29. ---
versioned_docs = [
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
]
for path in versioned_docs:
    text = read(path)
    text = replace_once(text, '世界状态版本：28', '世界状态版本：29', f'{path} world version header')
    write(path, text)

path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
text = read(path)
text = replace_once(
    text,
    '科技树固定为 24 个节点，其中“基础种植”和“基础养殖”在新玩家建档时初始掌握，其余 22 个节点按真实产业链设置前置关系。',
    '科技树固定为 32 个节点，其中“基础种植”和“基础养殖”在新玩家建档时初始掌握，其余 30 个节点按真实产业链设置前置关系；其中 8 个节点是独立“作业科技”，只解锁生产资料的使用能力。',
    'industry technology count',
)
industry_rule = """

生产科技与作业科技必须分离。生产科技只负责生产端工厂与商品制造能力，例如“工具制造”只解锁工具作坊、“机械工程”只解锁机械工厂、“石油炼化”只解锁炼油厂及其正式配方；作业科技只负责需求端对生产资料的使用能力，不得反向授予对应生产工厂。玩家可以只研发作业科技并从市场采购生产资料，也可以只研发生产科技并向其他玩家供应。C1/C2 任何消耗额外生产资料的非基础作业制度，其 `requiredTechnologyIds` 只能引用作业科技，不得引用生产该商品的工厂科技。

8 个作业科技固定为：C2“工具作业”(`tool-operation`，前置基础种植，费用 300)、“饲料饲养”(`feed-husbandry`，前置基础养殖，费用 200)；C3“化肥施用”(`fertilizer-application`，费用 400)、“药剂精养”(`veterinary-application`，前置饲料饲养，费用 450)、“工业动力作业”(`industrial-fuel-operation`，前置工具作业，费用 450)、“工业化学作业”(`industrial-chemical-operation`，前置工具作业，费用 500)；C4“机械化作业”(`machinery-operation`，前置工具作业，费用 700)、“拖拉机作业”(`tractor-operation`，前置机械化作业，费用 800)。全部非初始科技继续使用统一 6h 基础研发时间。
"""
text = replace_once(text, '现有玩家迁移不得失去资产或承诺：', industry_rule + '\n现有玩家迁移不得失去资产或承诺：', 'industry operation separation rules')
text = replace_once(
    text,
    '制度研发门槛固定为：伐木场／矿场辅助档需要“工具制造”，强化档需要“工具制造 + 石油炼化”，机械化档需要“机械工程 + 石油炼化”；油田辅助档需要“石油炼化”，强化和机械化档需要“机械工程 + 石油炼化”；磨坊／锯木厂／饲料厂辅助档需要“工具制造”，强化档需要“机械工程”，机械化档需要“机械工程 + 石油炼化”。非基础作业制度必须校验 `requiredTechnologyIds`，缺少任一科技时服务器拒绝切换。',
    '制度研发门槛固定改为作业科技：伐木场辅助档需要“工具作业”，强化档需要“工具作业 + 工业动力作业”，机械化档需要“机械化作业 + 工业动力作业”；矿场辅助档需要“工具作业”，强化档需要“工具作业 + 工业化学作业”，机械化档需要“机械化作业 + 工业化学作业 + 工业动力作业”；油田辅助档需要“工业化学作业”，强化档需要“机械化作业 + 工业化学作业”，机械化档需要“机械化作业 + 工业化学作业 + 工业动力作业”；磨坊／锯木厂／饲料厂辅助档需要“工具作业”，强化档需要“机械化作业”，机械化档需要“机械化作业 + 工业动力作业”。C1 同样使用工具作业、化肥施用、拖拉机作业、饲料饲养、药剂精养和机械化作业，不再以对应生产科技作为制度门槛。非基础作业制度必须校验 `requiredTechnologyIds`，缺少任一作业科技时服务器拒绝切换。',
    'industry dedicated method research requirements',
)
text = replace_once(
    text,
    '世界版本 28／市场需求模型 19 增加工业燃料与工业化学品、C2 专属作业制度和制度研发门槛。',
    '世界版本 29 将生产资料的“生产科技”和“作业科技”彻底分离。世界 28 玩家按已完成生产科技一次性补授等价作业科技，正在进行中的旧生产科技通过 `grantTechnologyIds` 保留启动研发时承诺的等价作业能力；世界升级完成后，新研发生产科技不得自动授予作业科技，反向也不得授予。\n\n世界版本 28／市场需求模型 19 增加工业燃料与工业化学品、C2 专属作业制度和制度研发门槛。',
    'industry world 29 migration',
)
write(path, text)

path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path)
text = replace_once(text, '科技目录固定为 24 个节点：', '科技目录固定为 32 个节点：', 'page technology count')
text = replace_once(
    text,
    '完成科技只获得其声明工厂的建设、购买、竞拍、启动、配置和租入运营资格，不提供产量、周期、成本、配方、作业制度或仓库加成。',
    '生产科技完成后只获得其声明工厂的建设、购买、竞拍、启动、配置和租入运营资格；作业科技完成后只获得对应生产资料在 C1/C2 作业制度中的使用资格。两类科技互不自动授予，不直接修改产量、周期、成本、配方或仓库；实际高级制度数值仍由服务器正式生产目录决定。',
    'page production/operation research boundary',
)
text = replace_once(
    text,
    '科技详情固定增加“产业经营视角”：对该科技直接解锁的工厂展示玩家当前持有数量、正式默认配方的主要投入与产出、相关商品可用库存以及最近统一订单簿真实成交价和方向。',
    '科技详情固定增加“产业经营视角”：生产科技对直接解锁的工厂展示玩家当前持有数量、正式默认配方的主要投入与产出、相关商品可用库存以及最近统一订单簿真实成交价和方向；作业科技改为展示对应生产资料的商品图标、库存、最近真实成交价，并列出由正式生产方式目录反向派生的“解锁作业制度”，不得维护第二套制度清单。',
    'page research detail operation context',
)
write(path, text)

path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
text = read(path)
server_migration = """

世界 29 研发迁移把生产资料的生产能力与使用能力拆开。只在 `world.version < 29` 时按已完成的旧生产科技一次性授予等价作业科技：工具制造→工具作业、化肥工程→化肥施用、饲料加工→饲料饲养、养殖药剂→药剂精养、石油炼化→工业动力作业+工业化学作业、机械工程→机械化作业、农业机械→拖拉机作业。迁移前已经开始的上述生产科技必须在同一活动研发的 `grantTechnologyIds` 中补入对应作业科技；迁移完成后生产科技和作业科技必须独立研发，服务器 `setFacilityRecipe` 只按正式制度声明的作业科技进行权限校验。
"""
marker = '## '
pos = text.find(marker, text.find('completedTechnologyIds'))
if pos == -1:
    text = text.rstrip() + server_migration + '\n'
else:
    text = text[:pos] + server_migration + '\n' + text[pos:]
write(path, text)

path = 'docs/README.md'
text = read(path)
text = replace_once(
    text,
    'C1 与 C2 工厂专属作业制度、工业燃料／工业化学品，以及配套工具、化肥、饲料、养殖药剂、机械、拖拉机产业支线',
    'C1 与 C2 工厂专属作业制度、生产科技／作业科技分离、工业燃料／工业化学品，以及配套工具、化肥、饲料、养殖药剂、机械、拖拉机产业支线',
    'docs index industry responsibility',
)
write(path, text)

path = 'scripts/verify-document-authority.mjs'
text = read(path)
text = replace_once(text, "  if (!content.includes('世界状态版本：28')) failures.push(`${path} 世界状态版本必须为 28`);", "  if (!content.includes('世界状态版本：29')) failures.push(`${path} 世界状态版本必须为 29`);", 'document authority world version')
text = text.replace('版本 ${CURRENT_CLIENT_STATE_VERSION}/27', '版本 ${CURRENT_CLIENT_STATE_VERSION}/29')
write(path, text)

# Guard against the exact design regression this change removes.
method_source = read('server/src/production-methods.js')
for forbidden in ['tool-manufacturing', 'fertilizer-engineering', 'feed-processing', 'veterinary-medicine', 'oil-refining', 'mechanical-engineering', 'agricultural-machinery']:
    if re.search(r'requiredTechnologyIds: \[[^\]]*' + re.escape(forbidden), method_source):
        raise RuntimeError(f'advanced production method still depends on production technology: {forbidden}')

print('operation research separation patch applied')
