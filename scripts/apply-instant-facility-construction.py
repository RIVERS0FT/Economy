#!/usr/bin/env python3
from __future__ import annotations

import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BUILD_INPUTS = {
    'farm': [('timber', 2), ('ore', 1)],
    'orchard': [('timber', 3), ('ore', 1)],
    'ranch': [('timber', 3), ('ore', 2)],
    'fishery': [('timber', 4), ('ore', 2)],
    'logging-camp': [('timber', 3), ('ore', 3)],
    'mine': [('timber', 3), ('ore', 4)],
    'oil-field': [('timber', 4), ('ore', 4), ('copper-ore', 1)],
    'mill': [('timber', 4), ('ore', 3), ('copper-ore', 1)],
    'sawmill': [('timber', 5), ('ore', 3), ('copper-ore', 1)],
    'feed-factory': [('timber', 4), ('ore', 3), ('copper-ore', 1)],
    'pulp-mill': [('lumber', 3), ('steel', 1)],
    'steelworks': [('lumber', 4), ('ore', 5)],
    'textile-mill': [('lumber', 3), ('steel', 2)],
    'food-factory': [('lumber', 3), ('steel', 2)],
    'paper-mill': [('lumber', 4), ('steel', 2)],
    'refinery': [('lumber', 3), ('steel', 4), ('copper', 1)],
    'fertilizer-factory': [('lumber', 3), ('steel', 4), ('copper', 1)],
    'veterinary-medicine-factory': [('lumber', 3), ('steel', 4), ('plastic', 1)],
    'beverage-factory': [('lumber', 4), ('steel', 3), ('copper', 1)],
    'furniture-factory': [('lumber', 6), ('steel', 2)],
    'garment-factory': [('lumber', 4), ('steel', 3), ('plastic', 1)],
    'tool-workshop': [('lumber', 4), ('steel', 4)],
    'machine-factory': [('steel', 7), ('copper', 3), ('plastic', 2)],
    'tractor-factory': [('steel', 8), ('copper', 2), ('machinery', 1)],
    'electronics-factory': [('steel', 6), ('copper', 6), ('plastic', 4), ('machinery', 1)],
    'appliance-factory': [('steel', 8), ('plastic', 5), ('machinery', 1), ('electronics', 1)],
}


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')


def replace_once(text: str, old: str, new: str, path: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected one occurrence, found {count}: {old[:160]!r}')
    return text.replace(old, new, 1)


def regex_once(text: str, pattern: str, replacement: str, path: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f'{path}: expected one regex match, found {count}: {pattern[:160]!r}')
    return updated


def js_inputs(items: list[tuple[str, int]]) -> str:
    return '[' + ', '.join(
        f"{{ productId: '{product_id}', quantity: {quantity} }}"
        for product_id, quantity in items
    ) + ']'


def patch_catalog() -> dict[str, dict[str, object]]:
    path = 'server/src/industry-catalog.js'
    text = read(path)
    prices = {
        match.group(1): float(match.group(2))
        for match in re.finditer(
            r"\{ id: '([^']+)', name: '[^']+', category: '[^']+', basePrice: ([0-9.]+) \}",
            text,
        )
    }
    facility_pattern = re.compile(
        r"(id: '([^']+)', name: '[^']+', category: '(?:raw|processing|consumer|industrial)', complexity: '(C[1-7])', buildCost: )([0-9.]+)(, buildTimeMs: [^,\n]+,)(\n)",
    )
    expected: dict[str, dict[str, object]] = {}

    def replace(match: re.Match[str]) -> str:
        prefix, facility_id, complexity, old_cost_raw, time_suffix, newline = match.groups()
        if facility_id not in BUILD_INPUTS:
            raise RuntimeError(f'{path}: missing build inputs for {facility_id}')
        old_cost = float(old_cost_raw)
        material_value = sum(prices[product_id] * quantity for product_id, quantity in BUILD_INPUTS[facility_id])
        cash_cost = round(old_cost - material_value)
        if cash_cost < 1:
            raise RuntimeError(f'{facility_id}: calculated cash cost is invalid: {cash_cost}')
        expected[facility_id] = {
            'complexity': complexity,
            'buildCost': cash_cost,
            'buildInputs': BUILD_INPUTS[facility_id],
        }
        return f"{prefix}{cash_cost}{time_suffix}{newline}    buildInputs: {js_inputs(BUILD_INPUTS[facility_id])},{newline}"

    text, count = facility_pattern.subn(replace, text)
    if count != len(BUILD_INPUTS):
        raise RuntimeError(f'{path}: patched {count} facilities, expected {len(BUILD_INPUTS)}')
    write(path, text)
    return expected


def patch_types() -> None:
    path = 'src/types.ts'
    text = read(path)
    text = replace_once(
        text,
        '  buildCost: number;\n  buildTimeMs: number;',
        '  buildCost: number;\n  buildInputs?: FacilityRecipeItem[];\n  /** @deprecated Instant construction returns 0 to compatible clients. */\n  buildTimeMs: number;',
        path,
    )
    text = replace_once(
        text,
        '  constructionPayroll: number;\n',
        '  constructionPayroll: number;\n  facilitiesConstructed?: number;\n  constructionMaterialsConsumed?: Record<string, number>;\n',
        path,
    )
    write(path, text)


def patch_facility_groups() -> None:
    path = 'server/src/facility-groups.js'
    text = read(path)
    text = replace_once(
        text,
        "import { creditPopulationEmployment, ensurePopulationEconomy, releaseConstructionEmployment } from './population-economy.js';",
        "import { creditPopulationEmployment, ensurePopulationEconomy } from './population-economy.js';",
        path,
    )
    text = text.replace("import { ensureGemState } from './invitations.js';\n", '')
    text = text.replace('export const GEM_CONSTRUCTION_ACCELERATION_MS = 30 * 60 * 1000;\n', '')
    text = text.replace('export const GEM_CONSTRUCTION_ACCELERATION_COST = 1;\n', '')
    text = replace_once(text, 'function migrateLegacyPlayer(player, now) {', 'function migrateLegacyPlayer(world, player, now) {', path)
    text = replace_once(
        text,
        '  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0);\n',
        '  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0);\n'
        '  player.stats.facilitiesConstructed = Number(player.stats.facilitiesConstructed || 0);\n'
        "  player.stats.constructionMaterialsConsumed = player.stats.constructionMaterialsConsumed && typeof player.stats.constructionMaterialsConsumed === 'object'\n"
        '    ? player.stats.constructionMaterialsConsumed\n'
        '    : {};\n',
        path,
    )
    old_construction = '''  if (player.facilityConstruction) {
    const constructionType = typeFor(player.facilityConstruction.facilityTypeId);
    if (constructionType && player.facilityConstruction.buildCost === undefined) {
      player.facilityConstruction.buildCost = constructionType.buildCost;
      player.facilityConstruction.employmentReleased = constructionType.buildCost;
    }
  }
'''
    new_construction = '''  let migratedConstructionTypeId = null;
  if (player.facilityConstruction) {
    const construction = player.facilityConstruction;
    const constructionType = typeFor(construction.facilityTypeId);
    if (constructionType) {
      const paidBuildCost = Math.max(0, Number(construction.buildCost ?? constructionType.buildCost) || 0);
      const employmentReleased = Math.max(0, Number(construction.employmentReleased || 0));
      const remainingEmployment = Math.max(0, paidBuildCost - employmentReleased);
      if (remainingEmployment > 0) creditPopulationEmployment(world, remainingEmployment, 'construction');
      addPurchasedGroup(world, player, constructionType.id, 1, now);
      player.stats.facilitiesConstructed += 1;
      migratedConstructionTypeId = constructionType.id;
    }
    delete player.facilityConstruction;
  }
'''
    text = replace_once(text, old_construction, new_construction, path)
    old_legacy = '''      if (facility.status === 'constructing') {
        if (!player.facilityConstruction) {
          player.facilityConstruction = {
            facilityTypeId: type.id,
            startedAt: Math.max(0, Number(facility.constructionCompletesAt || now) - type.buildTimeMs),
            completesAt: Number(facility.constructionCompletesAt || now),
            buildCost: type.buildCost,
            employmentReleased: type.buildCost,
          };
        }
        continue;
      }
'''
    new_legacy = '''      if (facility.status === 'constructing') {
        if (type.id !== migratedConstructionTypeId) {
          addPurchasedGroup(world, player, type.id, 1, now);
          player.stats.facilitiesConstructed += 1;
        }
        continue;
      }
'''
    text = replace_once(text, old_legacy, new_legacy, path)
    text = text.replace('for (const player of Object.values(world.players)) migrateLegacyPlayer(player, now);', 'for (const player of Object.values(world.players)) migrateLegacyPlayer(world, player, now);')
    text = regex_once(
        text,
        r"\nfunction finishConstruction\(world, player, now\) \{.*?\n\}\n",
        '\n',
        path,
        re.S,
    )
    text = text.replace('    finishConstruction(world, player, now);\n', '')
    text = regex_once(
        text,
        r"\nfunction buildFacilityGroup\(world, userId, payload, now\) \{.*?\n\}\n\nfunction accelerateFacilityConstruction\(world, userId, now\) \{.*?\n\}\n\nfunction startFacilityGroup",
        '''
function buildFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  if (!type) return result(false, '工厂类型不存在');
  const quantity = normalizePositiveInteger(payload.quantity ?? 1, 100);
  if (!quantity) return result(false, '建造数量必须为 1 到 100 的整数');
  const totalCost = multiplyMoneyByInteger(type.buildCost, quantity);
  if (totalCost === null) return result(false, '建造资金超出系统可表示范围');
  const buildInputs = [];
  for (const item of Array.isArray(type.buildInputs) ? type.buildInputs : []) {
    const required = Number(item.quantity) * quantity;
    if (!Number.isSafeInteger(required) || required < 1) return result(false, '建造材料数量超出系统可表示范围');
    buildInputs.push({ productId: String(item.productId || ''), quantity: required });
  }
  if (buildInputs.length === 0) return result(false, '工厂建造材料目录无效');
  if (player.credits < totalCost) return result(false, '建造资金不足');
  const missingInput = buildInputs.find((item) => inventoryFor(player, item.productId).available < item.quantity);
  if (missingInput) {
    const product = PRODUCT_CATALOG.find((item) => item.id === missingInput.productId);
    return result(false, `${product?.name || missingInput.productId}建造材料不足`);
  }

  player.credits -= totalCost;
  for (const item of buildInputs) inventoryFor(player, item.productId).available -= item.quantity;
  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0) + totalCost;
  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + totalCost;
  player.stats.facilitiesConstructed = Number(player.stats.facilitiesConstructed || 0) + quantity;
  player.stats.constructionMaterialsConsumed ||= {};
  for (const item of buildInputs) {
    player.stats.constructionMaterialsConsumed[item.productId] = Number(
      player.stats.constructionMaterialsConsumed[item.productId] || 0,
    ) + item.quantity;
  }
  creditPopulationEmployment(world, totalCost, 'construction');
  addPurchasedGroup(world, player, type.id, quantity, now);
  return result(true, `${quantity} 座${type.name}已建成并加入同类工厂集群`);
}

function startFacilityGroup''',
        path,
        re.S,
    )
    text = text.replace("  else if (action === 'accelerateFacilityConstruction') actionResult = accelerateFacilityConstruction(world, userId, now);\n", '')
    text = regex_once(
        text,
        r"\n    facilityConstruction: player\.facilityConstruction \? \{.*?\n    \} : undefined,",
        '',
        path,
        re.S,
    )
    text = replace_once(
        text,
        '      ...type,\n      recipes: recipesFor(type).filter(',
        '      ...type,\n      buildTimeMs: 0,\n      recipes: recipesFor(type).filter(',
        path,
    )
    write(path, text)


def patch_routes_and_api() -> None:
    path = 'server/src/game-routes.js'
    text = read(path)
    text = replace_once(
        text,
        "  if (method === 'POST' && path === '/api/game/facilities/construction/accelerate') return { action: 'accelerateFacilityConstruction', category: 'general' };",
        "  if (method === 'POST' && path === '/api/game/facilities/construction/accelerate') return { action: 'retiredFacilityConstructionAcceleration', category: 'general' };",
        path,
    )
    write(path, text)

    path = 'server/src/app.js'
    text = read(path)
    text = replace_once(
        text,
        "    const route = resolveAction(method, path);\n    if (!route) {",
        "    const route = resolveAction(method, path);\n"
        "    if (route?.action === 'retiredFacilityConstructionAcceleration') {\n"
        "      sendError(response, 410, '工厂建造已改为资金与材料即时完成，施工加速接口已退役');\n"
        "      return;\n"
        "    }\n"
        "    if (!route) {",
        path,
    )
    write(path, text)

    path = 'src/api/game.ts'
    text = read(path)
    text = replace_once(
        text,
        "  buildFacility: (facilityTypeId: string) => postAction('/facilities', { facilityTypeId }),",
        "  buildFacility: (facilityTypeId: string, quantity = 1) => postAction('/facilities', { facilityTypeId, quantity }),",
        path,
    )
    text = text.replace("  accelerateFacilityConstruction: () => postAction('/facilities/construction/accelerate'),\n", '')
    write(path, text)


def patch_view_model() -> None:
    path = 'src/app/gameViewModel.ts'
    text = read(path)
    text = replace_once(
        text,
        '  buildFacility: (facilityTypeId: string) => Promise<ActionResult>;\n',
        '  buildFacility: (facilityTypeId: string, quantity?: number) => Promise<ActionResult>;\n',
        path,
    )
    text = text.replace('  accelerateFacilityConstruction: () => Promise<ActionResult>;\n', '')
    text = replace_once(
        text,
        "    buildFacility: (facilityTypeId) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId)),",
        "    buildFacility: (facilityTypeId, quantity = 1) => runAction('buildFacility', () => gameActions.buildFacility(facilityTypeId, quantity)),",
        path,
    )
    text = text.replace("    accelerateFacilityConstruction: () => runAction('buildFacility', gameActions.accelerateFacilityConstruction),\n", '')
    write(path, text)


def patch_production_page() -> None:
    path = 'src/pages/ProductionPage.tsx'
    text = read(path)
    text = text.replace("import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';", "import { formatCurrency, formatNumber } from '../utils/formatters';")
    text = text.replace("import '../styles/production-gem-acceleration.css';\n", '')
    text = text.replace('    accelerateFacilityConstruction,\n', '')
    text = replace_once(
        text,
        '  const [acceleratingConstruction, setAcceleratingConstruction] = useState(false);',
        '  const [buildQuantity, setBuildQuantity] = useState(1);',
        path,
    )
    text = text.replace('  const hasConstruction = Boolean(game.facilityConstruction);\n', '')
    text = replace_once(
        text,
        '  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];\n',
        '''  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];
  const selectedBuildInputs = selectedType.buildInputs ?? [];
  const maxBuildable = Math.max(0, Math.min(
    100,
    Math.floor(game.credits / Math.max(1, selectedType.buildCost)),
    ...selectedBuildInputs.map((item) => Math.floor(
      (game.inventories[item.productId]?.available ?? 0) / Math.max(1, item.quantity),
    )),
  ));
''',
        path,
    )
    text = regex_once(
        text,
        r"\n  const constructionType = game\.facilityConstruction.*?\n  const constructionRemainingAfterAcceleration = Math\.max\(0, constructionRemaining - constructionAccelerationMs\);\n",
        '\n',
        path,
        re.S,
    )
    text = regex_once(
        text,
        r"\n  const accelerateSelectedConstruction = async \(\) => \{.*?\n  \};\n",
        '\n',
        path,
        re.S,
    )
    old_block = '''          <DataList>
            <DataRow
              label="建造费用"
              value={<CurrencyAmount>{formatCurrency(selectedType.buildCost)}</CurrencyAmount>}
              tone="danger"
            />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
          </DataList>
          {game.facilityConstruction ? (
            <div className="construction-status" aria-live="polite">
              <strong>
                {constructionType?.name ?? '工厂'}
                {constructionAwaitingConfirmation ? '确认完工中' : '施工中'}
              </strong>
              <span>
                {constructionAwaitingConfirmation
                  ? '正在同步服务器结算结果'
                  : `剩余 ${formatDuration(constructionRemaining)}`}
              </span>
              <div className="build-card-gem-acceleration">
                <strong>宝石加速</strong>
                <span>
                  {constructionAwaitingConfirmation
                    ? '等待服务器确认完工'
                    : constructionRemainingAfterAcceleration > 0
                      ? `使用后剩余 ${formatDuration(constructionRemainingAfterAcceleration)}`
                      : '使用后立即完工'}
                </span>
                <Button
                  block
                  disabled={
                    constructionAwaitingConfirmation ||
                    game.gems < constructionAccelerationCost ||
                    acceleratingConstruction
                  }
                  onClick={() => void accelerateSelectedConstruction()}
                >
                  {acceleratingConstruction
                    ? '加速处理中…'
                    : `${formatNumber(constructionAccelerationCost)} 宝石 · 加速 ${formatDuration(constructionAccelerationMs)}`}
                </Button>
                <small>每次固定减少 30m；剩余不足 30m 时直接完工，不退还部分宝石。</small>
              </div>
              <small>建成后直接加入运行中的同类集群，不重置当前进度，并按扩容比例同步稀释满员率。</small>
            </div>
          ) : null}
          <Button
            block
            onClick={() => void showResult(buildFacility(selectedType.id))}
            disabled={hasConstruction || game.credits < selectedType.buildCost}
          >
            {constructionAwaitingConfirmation
              ? '确认完工中…'
              : hasConstruction
                ? '已有工厂正在施工'
                : `建设${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">工厂按类型和数量保存；同一时间只能施工一座工厂。</small>'''
    new_block = '''          <SelectInput
            label="建造数量"
            value={String(buildQuantity)}
            onChange={(event) => setBuildQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
          >
            {[1, 5, 10, 25, 50, 100].map((quantity) => (
              <option value={quantity} key={quantity}>{quantity}</option>
            ))}
          </SelectInput>
          <DataList>
            <DataRow
              label="建造资金"
              value={<CurrencyAmount>{formatCurrency(selectedType.buildCost * buildQuantity)}</CurrencyAmount>}
              tone={game.credits >= selectedType.buildCost * buildQuantity ? 'neutral' : 'danger'}
            />
            {selectedBuildInputs.map((item) => {
              const product = game.products.find((candidate) => candidate.id === item.productId);
              const available = game.inventories[item.productId]?.available ?? 0;
              const required = item.quantity * buildQuantity;
              return (
                <DataRow
                  key={item.productId}
                  label={product?.name ?? item.productId}
                  value={`${formatNumber(required)} / 库存 ${formatNumber(available)}`}
                  tone={available >= required ? 'neutral' : 'danger'}
                />
              );
            })}
            <DataRow label="最多可建" value={`${formatNumber(maxBuildable)} 座`} />
          </DataList>
          <Button
            block
            onClick={() => void showResult(buildFacility(selectedType.id, buildQuantity))}
            disabled={buildQuantity > maxBuildable}
          >
            {buildQuantity === 1 ? `立即建造${selectedType.name}` : `立即建造 ${buildQuantity} 座${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">提交后立即扣除资金与建造材料，工厂直接加入同类集群；运行中的集群保持当前进度并重新计算满员率。</small>'''
    text = replace_once(text, old_block, new_block, path)
    write(path, text)


def patch_countdowns() -> None:
    path = 'src/utils/authoritativeCountdowns.ts'
    text = read(path).replace('  addDeadline(deadlines, game.facilityConstruction?.completesAt);\n', '')
    write(path, text)

    path = 'server/src/world-deadline-planner.js'
    text = read(path)
    text = regex_once(
        text,
        r"export function nextConstructionEmploymentAt\(construction\) \{.*?\n\}\n",
        "export function nextConstructionEmploymentAt() {\n  return null;\n}\n",
        path,
        re.S,
    )
    text = regex_once(
        text,
        r"\n    const construction = player\.facilityConstruction;\n    if \(construction\) \{.*?\n    \}\n",
        '\n',
        path,
        re.S,
    )
    write(path, text)


def patch_verifiers(expected: dict[str, dict[str, object]]) -> None:
    path = 'scripts/verify-industry-catalog.mjs'
    text = read(path)
    entries = []
    catalog_text = read('server/src/industry-catalog.js')
    system_values = {
        match.group(1): int(match.group(2))
        for match in re.finditer(r"id: '([^']+)', name: '[^']+'.*?systemValue: ([0-9]+)", catalog_text, re.S)
    }
    for facility_id, data in expected.items():
        entries.append(
            f"  '{facility_id}': {{ complexity: '{data['complexity']}', buildCost: {data['buildCost']}, "
            f"buildInputs: {js_inputs(data['buildInputs'])}, systemValue: {system_values[facility_id]} }},"
        )
    expected_block = 'const expectedConstruction = {\n' + '\n'.join(entries) + '\n};'
    text = regex_once(
        text,
        r"const expectedConstruction = \{.*?\n\};\nconst constructionTimeRanges = \{.*?\n\};",
        expected_block,
        path,
        re.S,
    )
    text = replace_once(
        text,
        '''assert.deepEqual(Object.fromEntries(FACILITY_TYPE_CATALOG.map((item) => [item.id, {
  complexity: item.complexity,
  buildCost: item.buildCost,
  buildTimeMs: item.buildTimeMs,
  systemValue: item.systemValue,
}])), expectedConstruction);''',
        '''assert.deepEqual(Object.fromEntries(FACILITY_TYPE_CATALOG.map((item) => [item.id, {
  complexity: item.complexity,
  buildCost: item.buildCost,
  buildInputs: item.buildInputs,
  systemValue: item.systemValue,
}])), expectedConstruction);''',
        path,
    )
    text = regex_once(
        text,
        r"  assert\.equal\(Number\.isInteger\(facility\.buildTimeMs / 1_000\), true, .*?\n  \);\n  assert\.equal\(\n    facility\.systemValue,\n    Math\.ceil\(\(facility\.buildCost \* 1\.3\) / 5\) \* 5,\n    .*?\n  \);",
        '''  assert.ok(Array.isArray(facility.buildInputs) && facility.buildInputs.length > 0, `${facility.id} 必须声明建造材料`);
  let materialReferenceValue = 0;
  for (const item of facility.buildInputs) {
    assert.ok(productIds.has(item.productId), `${facility.id} 建造材料必须引用正式商品`);
    assert.equal(Number.isSafeInteger(item.quantity) && item.quantity > 0, true, `${facility.id} 建造材料数量必须为安全正整数`);
    assert.notEqual(item.productId, facility.output.productId, `${facility.id} 不得使用自身产出作为建造材料`);
    materialReferenceValue += expectedPrices[item.productId] * item.quantity;
  }
  assert.equal(
    facility.systemValue,
    Math.ceil(((facility.buildCost + materialReferenceValue) * 1.3) / 5) * 5,
    `${facility.id} 系统参考值必须按资金与材料参考总值的 130% 向上取整到 5`,
  );''',
        path,
        re.S,
    )
    write(path, text)

    path = 'scripts/verify-authoritative-countdowns.mjs'
    text = read(path)
    text = text.replace("    'game.facilityConstruction?.completesAt',\n", '')
    text = regex_once(
        text,
        r"  for \(const text of \[\n    'constructionAwaitingConfirmation'.*?\n  \]\) requireText\(paths\.production, text\);",
        '''  for (const text of [
    'label="建造数量"',
    'label="建造资金"',
    'label="最多可建"',
    '立即扣除资金与建造材料',
  ]) requireText(paths.production, text);
  for (const text of ['constructionAwaitingConfirmation', '确认完工中', '施工时间', '宝石加速']) forbidText(paths.production, text);''',
        path,
        re.S,
    )
    text = text.replace("    '施工卡固定在归零后显示“确认完工中…”',\n", "    '工厂即时建设不注册权威倒计时',\n")
    text = text.replace('施工、生产周期、拍卖和排行榜到期采用串行每秒确认', '生产周期、拍卖和排行榜到期采用串行每秒确认；工厂即时建设不注册倒计时')
    write(path, text)

    write('scripts/verify-gem-shop.mjs', '''import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`); };

[
  'server/src/gem-shop.js',
  'server/src/gem-economy-store.js',
  'server/src/storage.js',
  'server/src/app.js',
  'server/src/game-routes.js',
  'server/src/facility-groups.js',
  'server/test/gem-shop.test.js',
  'server/test/research-gem-acceleration.test.js',
  'src/pages/GemShopPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/api/invitations.ts',
  'src/components/icons/GemIcon.tsx',
  'src/styles/gem-shop.css',
  'src/styles/primary-surfaces.css',
  'tests/browser/gem-shop-layout.spec.ts',
  'tests/browser/production-status-summary.spec.ts',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'GEM_SHOP_CREDITS_PER_GEM = 100',
  'GEM_SHOP_MIN_CREDITS_PER_GEM = 1',
  'GEM_SHOP_MAX_CREDITS_PER_GEM = 10_000',
  'calculateNextGemShopRate',
  'player.gems -= gems',
]) requireText('server/src/gem-shop.js', text);
for (const text of ['economy_gem_shop_daily_rates', 'economy_research_gem_actions', 'recordResearchAcceleration']) {
  requireText('server/src/gem-economy-store.js', text);
}
for (const text of ["action === 'exchangeGems'", "action === 'rejectGemShopQuote'", "action === 'accelerateResearch'"]) {
  requireText('server/src/storage.js', text);
}
for (const text of ['GEM_CONSTRUCTION_ACCELERATION_MS', 'gemAccelerationMs', 'accelerateFacilityConstruction']) {
  forbidText('server/src/facility-groups.js', text);
}
requireText('server/src/game-routes.js', "retiredFacilityConstructionAcceleration");
requireText('server/src/app.js', '施工加速接口已退役');
for (const text of ['label="建造数量"', 'label="建造资金"', '立即扣除资金与建造材料']) {
  requireText('src/pages/ProductionPage.tsx', text);
}
for (const text of ['宝石加速', '施工时间', 'constructionRemainingAfterAcceleration', 'accelerateFacilityConstruction']) {
  forbidText('src/pages/ProductionPage.tsx', text);
}
for (const text of ['instant construction shows credits and materials without gem acceleration', "not.toContainText('宝石加速')", "not.toContainText('施工中')"]) {
  requireText('tests/browser/production-status-summary.spec.ts', text);
}
for (const text of ['每次固定消耗 1 宝石，减少当前研发 30 分钟', '工厂施工加速接口返回 `410 Gone`', '不得增加宝石兑换工厂产量']) {
  requireText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', text);
}
forbidText('docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md', '每次固定消耗 1 宝石，减少当前施工 30 分钟');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '/api/game/facilities/construction/accelerate');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '410 Gone');

if (failures.length) {
  console.error(`商店与宝石验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('商店验证通过：每日终端报价和研发宝石加速保持有效，工厂施工加速已退役并由资金与材料即时建造取代。');
''')


def patch_browser_test() -> None:
    path = 'tests/browser/production-status-summary.spec.ts'
    text = read(path)
    text = regex_once(
        text,
        r"  test\('counts clusters and keeps gem acceleration only in the build card'.*?\n  \}\);",
        '''  test('instant construction shows credits and materials without gem acceleration', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const summary = page.locator('.page-heading-actions');
    await expect(summary).toContainText('运行 2');
    await expect(summary).toContainText('停止 1');
    await expect(summary).toContainText('异常 1');
    await expect(summary).not.toContainText('施工');

    const buildCard = page.locator('.production-build-card');
    await expect(buildCard).toContainText('建造数量');
    await expect(buildCard).toContainText('建造资金');
    await expect(buildCard).toContainText('最多可建');
    await expect(buildCard).not.toContainText('宝石加速');
    await expect(buildCard).not.toContainText('施工中');
    await expect(buildCard).not.toContainText('施工时间');

    await expect(page.locator('.facility-cluster-detail-card')).not.toContainText('宝石加速');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
    await expect(page.locator('.facility-cluster-selector-card[data-status="constructing"]')).toHaveCount(0);
  });''',
        path,
        re.S,
    )
    write(path, text)


def patch_tests() -> None:
    old = ROOT / 'server/test/gem-construction-acceleration.test.js'
    if old.exists():
        old.unlink()
    write('server/test/instant-facility-construction.test.js', '''import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';

const user = { id: 91, email: 'builder@example.com', name: '建设玩家', role: 'user' };

function prepareStore(now) {
  const store = new EconomyStore(':memory:');
  store.getState(user, now);
  const loaded = store.loadWorld(now + 1);
  const player = loaded.world.players[String(user.id)];
  player.credits = 100_000;
  for (const inventory of Object.values(player.inventories)) inventory.available = 10_000;
  store.saveWorld(loaded.revision, loaded.world, now + 1);
  return store;
}

test('construction atomically consumes credits and materials and completes immediately', () => {
  const now = 1_700_000_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(user, now + 2);
    const farm = FACILITY_TYPE_CATALOG.find((item) => item.id === 'farm');
    const request = {
      action: 'buildFacility', payload: { facilityTypeId: 'farm', quantity: 2 }, requestKey: 'instant-build-0001',
      method: 'POST', path: '/api/game/facilities',
    };
    const first = store.apply(user, request, now + 3);
    const repeated = store.apply(user, request, now + 4);
    assert.deepEqual(repeated, first, '幂等重试必须返回原结果');
    assert.equal(first.result.ok, true);

    const state = store.getState(user, now + 5);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 2);
    assert.equal(state.credits, before.credits - farm.buildCost * 2);
    for (const item of farm.buildInputs) {
      assert.equal(state.inventories[item.productId].available, before.inventories[item.productId].available - item.quantity * 2);
    }
    assert.equal(state.stats.facilitiesConstructed, 2);
  } finally {
    store.close();
  }
});

test('construction rolls back completely when one material is missing', () => {
  const now = 1_700_100_000_000;
  const store = prepareStore(now);
  try {
    const loaded = store.loadWorld(now + 2);
    loaded.world.players[String(user.id)].inventories.timber.available = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const before = store.getState(user, now + 3);
    const result = store.apply(user, {
      action: 'buildFacility', payload: { facilityTypeId: 'farm', quantity: 1 }, requestKey: 'instant-build-0002',
      method: 'POST', path: '/api/game/facilities',
    }, now + 4);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /建造材料不足/);
    const after = store.getState(user, now + 5);
    assert.equal(after.credits, before.credits);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'farm'), undefined);
  } finally {
    store.close();
  }
});

test('legacy construction migrates to one completed facility without charging materials again', () => {
  const now = 1_700_200_000_000;
  const store = prepareStore(now);
  try {
    const loaded = store.loadWorld(now + 2);
    const player = loaded.world.players[String(user.id)];
    player.facilityConstruction = {
      facilityTypeId: 'farm', startedAt: now, completesAt: now + 60_000,
      buildCost: 50, employmentReleased: 20,
    };
    const timberBefore = player.inventories.timber.available;
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const state = store.getState(user, now + 3);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 1);
    assert.equal(state.inventories.timber.available, timberBefore, '旧任务迁移不得再次收取材料');
  } finally {
    store.close();
  }
});
''')


def patch_docs(expected: dict[str, dict[str, object]]) -> None:
    path = 'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'
    text = read(path)
    text = text.replace('- 同一玩家同时只能施工一座工厂。', '- 工厂建设不创建施工任务、施工队列或工厂实例；资金和全部正式商品建造材料在一个幂等事务中扣除后立即增加集群数量。')
    text = text.replace('施工中的工厂不计入；', '即时建设成功前不存在可计入的工厂；')
    text = text.replace('建造费、施工时间和工厂系统参考值', '建造资金、建造材料和工厂系统参考值')
    text = text.replace('工厂复杂度只决定建造费总额、施工时间和建成后的运营岗位', '工厂复杂度只决定资金与材料的建设梯度和建成后的运营岗位')
    text = regex_once(
        text,
        r"### 2\.2 建造业就业\n\n.*?\n\n完整产业链：",
        '''### 2.2 建造业就业

所有工厂的现金建设资金固定按基础人口 60%、技术人口 30%、专业人口 10% 分配。玩家提交建设时，服务器在同一事务中校验并扣除全部现金与正式商品材料；成功后现金一次性进入人口建造业待结算收入，材料永久消耗，工厂立即加入同类集群。任一资金或材料不足时不得扣除任何资产。冻结库存、合同预留和订单冻结库存不得用于建设。

完整产业链：''',
        path,
        re.S,
    )
    table_rows = []
    catalog = read('server/src/industry-catalog.js')
    names = {m.group(1): m.group(2) for m in re.finditer(r"id: '([^']+)', name: '([^']+)', category: '(?:raw|processing|consumer|industrial)', complexity:", catalog)}
    values = {m.group(1): m.group(2) for m in re.finditer(r"id: '([^']+)', name: '[^']+'.*?systemValue: ([0-9]+)", catalog, re.S)}
    for facility_id, data in expected.items():
        materials = ' + '.join(f'{quantity} {product_id}' for product_id, quantity in data['buildInputs'])
        table_rows.append(f"| `{facility_id}` | {names[facility_id]} | {data['complexity']} | {data['buildCost']} | {materials} | {values[facility_id]} |")
    construction_section = '''### 2.3 即时建造参数

生产参数与建造参数继续分字段维护。正式目录为每座工厂声明现金 `buildCost` 与商品数组 `buildInputs`；不再使用施工时间决定可用性。客户端兼容字段 `buildTimeMs` 固定返回 `0`，不得据此恢复倒计时、施工任务或宝石施工加速。

系统参考值继续代表资金与材料的初始参考总造价：

```text
建设参考总值 = buildCost + Σ(buildInputs 数量 × 商品初始参考价)
系统参考值 = ceil(建设参考总值 × 130% ÷ 5) × 5
```

| ID | 工厂 | 复杂度 | 建造资金 | 建造材料 | 系统参考值 |
|---|---|---:|---:|---|---:|
''' + '\n'.join(table_rows) + '''

服务端允许单次建设 1～100 座并按数量安全相乘。资金和全部材料必须先完整校验，再原子扣除；成功后立即增加 `facilityGroups[].count`。运行中的同类集群保持当前周期起点，沿既有扩容规则即时增加参与数量并按扩容比例稀释满员率，不得获得已经过去的等效产能。

## 3.'''
    text = regex_once(text, r"### 2\.1 建造参数\n.*?\n## 3\.", construction_section, path, re.S)
    text = text.replace('页面标题与运行／停止／异常／施工汇总', '页面标题与运行／停止／异常汇总')
    text = text.replace('- 显示工厂类型、可选或固定配方名称、建造费用、施工时间、当前施工任务、建设按钮和单次施工规则。', '- 显示工厂类型、可选或固定配方名称、建造数量、建造资金、逐项建造材料、玩家当前可用库存、最多可建数量和即时建造按钮。')
    text = text.replace('建设复杂度、建造费、施工时间与系统参考值属于目录参数变更，不提升世界版本或客户端状态版本。已经开始施工的任务保留其持久化 `completesAt`，不得因目录更新时间被缩短、延长或重新扣费；新提交的施工任务使用更新后的正式参数。既有玩家工厂数量、订单、成交价和资产不得重写。', '即时建造上线时，既有 `facilityConstruction` 兼容任务立即转换为一座已建成工厂，释放尚未进入人口账户的剩余建造业就业收入，不再次扣除现金或材料，也不退还已经支付的现金和宝石。重复迁移不得再次增加工厂。')
    text = text.replace('删除工厂 `complexity`、把施工时间移出对应复杂度区间，或让高等级工业建设时间倒退；', '删除工厂 `complexity`、`buildCost` 或 `buildInputs`，允许空材料表、非法商品、非整数材料数量或自身产出作为建造材料；')
    text = text.replace('调整建造费却不按 130% 向上取整到 5 同步更新 `systemValue`；', '调整建造资金或材料却不按资金与材料参考总值的 130% 向上取整到 5 同步更新 `systemValue`；')
    text = re.sub(r'建造费 (\d+)、施工 [^、，；]+、系统参考值', r'建造资金 \1、即时材料建设、系统参考值', text)
    write(path, text)

    path = 'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md'
    text = read(path)
    text = text.replace('- 工厂建造费：建造业不区分复杂度，固定按基础人口 60%、技术人口 30%、专业人口 10% 分配，并按施工进度释放；', '- 工厂建设资金：建造业不区分复杂度，固定按基础人口 60%、技术人口 30%、专业人口 10% 分配，并在资金与全部材料原子扣除、工厂即时建成时一次性进入人口就业收入；')
    text = text.replace('施工中的工厂不计入', '即时建设成功前不存在可计入的工厂')
    text = regex_once(
        text,
        r"### 9\.4 工厂施工加速\n\n.*?\n\n## 10\.",
        '''### 9.4 工厂即时建设

建设新工厂只消耗服务器正式目录中的现金 `buildCost` 与正式商品 `buildInputs`。同一幂等事务必须先完整校验可用现金和全部可用材料，随后原子扣除、一次性转入人口建造业就业收入并立即增加同类工厂集群数量。任一条件不足时完全回滚。运行中的集群保持当前生产进度并按扩容规则稀释满员率。

工厂建设不再创建施工任务、完成时间或宝石加速入口。旧施工任务迁移时立即建成且不得再次收取材料；旧加速宝石不退还。

## 10.''',
        path,
        re.S,
    )
    write(path, text)

    path = 'docs/GEM_ACCELERATION_AND_DYNAMIC_EXCHANGE_DESIGN.md'
    text = read(path)
    text = text.replace('> 状态：宝石施工／研发加速与每日终端报价权威基线', '> 状态：宝石研发加速与每日终端报价权威基线')
    text = replace_once(
        text,
        '1. 商店每日终端报价中单向兑换普通货币；\n2. “建设新工厂”卡中以 1 宝石减少当前唯一施工任务 30 分钟；\n3. “研发新技术”中以 1 宝石减少当前唯一研发任务 30 分钟。',
        '1. 商店每日终端报价中单向兑换普通货币；\n2. “研发新技术”中以 1 宝石减少当前唯一研发任务 30 分钟。',
        path,
    )
    text = regex_once(
        text,
        r"## 2\. 施工加速\n\n.*?\n\n## 3\. 研发加速",
        '''## 2. 工厂施工加速退役

工厂建设已经改为资金与正式商品材料原子扣除后即时建成，不再产生施工任务、施工时间或完成截止时间。“建设新工厂”卡不得显示宝石加速。旧接口 `POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得扣除宝石或改变资产。

历史表 `economy_facility_gem_actions` 只保留既有审计记录，不再写入；旧施工任务迁移为已建成工厂时不退还已经使用的宝石，也不得再次收取建造材料。

## 3. 研发加速''',
        path,
        re.S,
    )
    text = text.replace('- `economy_facility_gem_actions`：施工加速扣费、缩短时间和立即完成审计；', '- `economy_facility_gem_actions`：历史施工加速只读审计，不再新增记录；')
    text = text.replace('- `POST /api/game/facilities/construction/accelerate`；', '- `POST /api/game/facilities/construction/accelerate`：固定返回 `410 Gone`；')
    text = text.replace('施工与研发加速字段均为兼容性可选字段', '研发加速字段为兼容性可选字段；客户端状态不再返回工厂施工任务')
    text = text.replace('浏览器本地完成施工或研发', '浏览器本地完成研发')
    text = text.replace('把宝石加速入口移回工厂详情', '恢复任何工厂施工宝石加速入口')
    write(path, text)

    path = 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md'
    text = read(path)
    text = '\n'.join(line for line in text.splitlines() if 'game.facilityConstruction' not in line)
    text = text.replace('施工卡固定在归零后显示“确认完工中…”', '工厂即时建设不注册权威倒计时')
    text += '\n\n## 工厂即时建设边界\n\n工厂建设没有施工截止时间、倒计时或到期确认状态，不得注册到 `authoritativeCountdownDeadlines` 或世界截止时间规划器。建设动作响应确认后，客户端通过权威状态刷新直接看到现金、材料库存和工厂集群数量变化。\n'
    write(path, text)

    path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
    text = read(path)
    text = text.replace('施工时间', '建造材料')
    text = text.replace('当前施工任务', '最多可建数量')
    text = text.replace('施工状态', '即时建造状态')
    text = text.replace('宝石施工加速', '工厂即时建设')
    text += '\n\n### 生产页即时建设卡\n\n建设卡固定显示工厂类型、建造数量、现金、逐项材料的需要量与可用库存、最多可建数量和即时建造按钮；不得显示施工时间、施工任务、完成倒计时、确认完工状态或宝石加速。\n'
    write(path, text)

    path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
    text = read(path)
    text = text.replace('宝石施工加速', '工厂施工加速历史审计')
    text = text.replace('施工完成时间', '旧施工兼容完成时间')
    text += '\n\n## 工厂即时建设事务\n\n`POST /api/game/facilities` 接受 `facilityTypeId` 与可选 `quantity`（1～100）。服务器必须在同一幂等写事务中校验科技准入、现金、全部 `buildInputs` 可用库存和安全乘法；任一失败时完全回滚。成功时扣除现金与材料、将现金记入人口建造业就业收入、增加材料消耗统计并立即扩充同类集群。`POST /api/game/facilities/construction/accelerate` 固定返回 `410 Gone`，不得进入经济写事务或写入新的施工宝石审计。\n'
    write(path, text)

    path = 'docs/README.md'
    text = read(path)
    text = text.replace('1 宝石减少施工 30 分钟、每日终端动态报价', '工厂施工加速退役、研发宝石加速、每日终端动态报价')
    text += '\n\n## 即时建设不可回退规则\n\n工厂建设以服务器正式目录的 `buildCost + buildInputs` 为唯一成本，在一个幂等事务中原子扣除后立即增加同类集群数量；不得恢复施工时间、施工任务、施工队列、施工倒计时或工厂宝石加速。规则变更必须同步更新产业、产品、页面、服务器、宝石与权威倒计时文档，以及目录、宝石、倒计时和服务器测试。\n'
    write(path, text)

    path = 'README.md'
    text = read(path)
    text += '\n\n### 工厂即时建设\n\n工厂通过现金与正式商品材料即时建成；服务端原子校验和扣除全部成本，运行中的同类集群保持生产进度并按扩容规则重新计算满员率。工厂施工时间和施工宝石加速已经退役。\n'
    write(path, text)


def remove_legacy_css() -> None:
    target = ROOT / 'src/styles/production-gem-acceleration.css'
    if target.exists():
        target.unlink()


def main() -> None:
    expected = patch_catalog()
    patch_types()
    patch_facility_groups()
    patch_routes_and_api()
    patch_view_model()
    patch_production_page()
    patch_countdowns()
    patch_verifiers(expected)
    patch_browser_test()
    patch_tests()
    patch_docs(expected)
    remove_legacy_css()
    print('instant facility construction patch applied')


if __name__ == '__main__':
    main()
