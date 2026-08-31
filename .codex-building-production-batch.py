from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8', newline='\n')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one replacement anchor, got {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def insert_after(path, anchor, addition):
    text = read(path)
    count = text.count(anchor)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one insertion anchor, got {count}: {anchor[:120]!r}')
    write(path, text.replace(anchor, anchor + addition, 1))


# Client API: one authoritative request for all regional targets.
insert_after(
    'src/api/game.ts',
    "  setFacilityRecipe: (provinceId: string, facilityTypeId: string, recipeId: string) => (\n    postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/recipe`, { provinceId, recipeId })\n  ),\n",
    "  setFacilityRecipes: (targets: Array<{ provinceId: string; facilityTypeId: string; recipeId: string }>) => (\n    postAction('/facilities/recipes', { targets })\n  ),\n",
)

# View model: remove the sequential per-province loop that could partially apply.
replace_once(
    'src/app/gameViewModel.ts',
    "    setFacilityRecipes: (targets) => runAcknowledgedAction('setFacilityRecipe', async () => {\n      let latestResponse: GameActionResponse | null = null;\n      for (const target of targets) {\n        const response = await gameActions.setFacilityRecipe(\n          target.provinceId,\n          target.facilityTypeId,\n          target.recipeId,\n        );\n        latestResponse = response;\n        if (!response.result.ok) return response;\n      }\n      return latestResponse ?? {\n        result: { ok: true, message: '生产设置未变化' },\n        revision: revisionRef.current ?? 0,\n      };\n    }),\n",
    "    setFacilityRecipes: (targets) => runAcknowledgedAction(\n      'setFacilityRecipe',\n      () => gameActions.setFacilityRecipes(targets),\n    ),\n",
)

# Remove now-unused response type import from the view model.
replace_once(
    'src/app/gameViewModel.ts',
    "  type FacilityBuildProcurementOptions,\n  type GameActionResponse,\n  type GameActionResult,\n",
    "  type FacilityBuildProcurementOptions,\n  type GameActionResult,\n",
)

# Public route + action registry.
insert_after(
    'server/src/game-routes.js',
    "  if (method === 'POST' && path === '/api/game/facilities') return { action: 'buildFacility', category: 'general' };\n",
    "  if (method === 'POST' && path === '/api/game/facilities/recipes') return { action: 'setFacilityRecipes', category: 'general' };\n",
)
insert_after(
    'server/src/player-action-registry.js',
    "  setFacilityRecipe: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),\n",
    "  setFacilityRecipes: defineAction({ mutationScope: 'factory', domain: 'facility', latencyClass: 'market', economicActivity: true, rebuildFactoryPolicies: true }),\n",
)

# Research validation: every target must be authorized before facility mutations begin.
insert_after(
    'server/src/research.js',
    "  const player = world.players[String(user.id)];\n  if (Number(world.version || 0) < RESEARCH_WORLD_VERSION) processResearchWorld(world, now);\n  else processPlayerResearch(world, player, now);\n",
    "  if (action === 'setFacilityRecipes') {\n    const targets = Array.isArray(payload?.targets) ? payload.targets : [];\n    for (const target of targets) {\n      const facilityTypeId = String(target?.facilityTypeId || '');\n      if (!facilityTypeId) continue;\n      const facilityLocked = lockedResult(world, player, facilityTypeId, now);\n      if (facilityLocked) return facilityLocked;\n      const methodLocked = productionMethodLockedResult(\n        world,\n        player,\n        facilityTypeId,\n        target?.recipeId,\n        now,\n      );\n      if (methodLocked) return methodLocked;\n    }\n    return null;\n  }\n",
)

# Facility runtime: prevalidate the complete batch, then mutate. This is the atomic business boundary.
insert_after(
    'server/src/facility-groups.js',
    "const MAX_FACILITY_AUCTION_QUANTITY = 1_000_000;\n",
    "const MAX_FACILITY_RECIPE_BATCH_TARGETS = 64;\n",
)
insert_after(
    'server/src/facility-groups.js',
    "function setGroupRecipe(world, userId, payload, now) {\n",
    "",
)
# Insert batch function after setGroupRecipe by anchoring on the next function declaration.
replace_once(
    'server/src/facility-groups.js',
    "}\n\nfunction reduceRunningGroupForSellOrder(group, type, quantity, now = Date.now()) {\n",
    "}\n\nfunction setGroupRecipes(world, userId, payload, now) {\n  const player = getPlayer(world, userId);\n  const targets = Array.isArray(payload?.targets) ? payload.targets : [];\n  if (targets.length < 1 || targets.length > MAX_FACILITY_RECIPE_BATCH_TARGETS) {\n    return result(false, `批量生产配置必须包含 1 到 ${MAX_FACILITY_RECIPE_BATCH_TARGETS} 个地区目标`);\n  }\n\n  const seen = new Set();\n  const prepared = [];\n  for (const target of targets) {\n    const requestedProvinceId = String(target?.provinceId || '');\n    if (!requestedProvinceId) return result(false, '批量生产配置缺少地区');\n    const provinceId = normalizeProvinceId(requestedProvinceId);\n    const type = typeFor(target?.facilityTypeId);\n    if (!type) return result(false, '工厂类型不存在');\n    const key = `${provinceId}:${type.id}`;\n    if (seen.has(key)) return result(false, '批量生产配置包含重复地区工厂');\n    seen.add(key);\n\n    const accessError = provinceUnlockError(player, provinceId);\n    if (accessError) return result(false, accessError);\n    const group = groupFor(player, type.id, false, now, provinceId);\n    if (!group) return result(false, '工厂集群不存在');\n    const recipe = recipesFor(type).find((candidate) => candidate.id === target?.recipeId);\n    if (!recipe) return result(false, '生产配方不存在');\n    prepared.push({ provinceId, type, recipe });\n  }\n\n  for (const item of prepared) {\n    const applied = setGroupRecipe(world, userId, {\n      provinceId: item.provinceId,\n      facilityTypeId: item.type.id,\n      recipeId: item.recipe.id,\n    }, now);\n    if (!applied.ok) return applied;\n  }\n  return result(true, `已更新 ${prepared.length} 个地区的生产配置`);\n}\n\nfunction reduceRunningGroupForSellOrder(group, type, quantity, now = Date.now()) {\n",
)
insert_after(
    'server/src/facility-groups.js',
    "  else if (action === 'setFacilityRecipe') actionResult = setGroupRecipe(world, userId, payload, now);\n",
    "  else if (action === 'setFacilityRecipes') actionResult = setGroupRecipes(world, userId, payload, now);\n",
)

# Runtime executor: batch is economic activity and rebuilds auto-operation orders for every affected province.
replace_once(
    'server/src/runtime-action-executor.js',
    "  'setFacilityRecipe',\n]);\n",
    "  'setFacilityRecipe',\n  'setFacilityRecipes',\n]);\n",
)
replace_once(
    'server/src/runtime-action-executor.js',
    "  'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe',\n",
    "  'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe', 'setFacilityRecipes',\n",
)
replace_once(
    'server/src/runtime-action-executor.js',
    "    if (gameResult?.ok && FACTORY_AUTO_OPERATION_REBUILD_ACTIONS.has(action)) {\n      const rebuilt = rebuildFactoryAutoTradePoliciesForProvince(world, user.id, payload.provinceId);\n      if (!rebuilt.ok) gameResult = rebuilt;\n    }\n",
    "    if (gameResult?.ok && FACTORY_AUTO_OPERATION_REBUILD_ACTIONS.has(action)) {\n      const targetProvinceIds = action === 'setFacilityRecipes'\n        ? [...new Set((payload.targets || []).map((target) => target?.provinceId).filter(Boolean))]\n        : [payload.provinceId];\n      for (const provinceId of targetProvinceIds) {\n        const rebuilt = rebuildFactoryAutoTradePoliciesForProvince(world, user.id, provinceId);\n        if (!rebuilt.ok) {\n          gameResult = rebuilt;\n          break;\n        }\n      }\n    }\n",
)

# Segmented storage mutation scope must include auto-operation orders from all batch provinces.
insert_after(
    'server/src/world-storage-v2.js',
    "function ownedOrderIndexesInProvince(world, userId, provinceId, { openOnly = true } = {}) {\n",
    "",
)
replace_once(
    'server/src/world-storage-v2.js',
    "function factoryAutoOperationScope(world, userId, payload) {\n  const provinceId = normalizeProvinceId(payload?.provinceId);\n  const orderIndexes = ownedOrderIndexesInProvince(world, userId, provinceId);\n  const procurement = payload?.autoProcure === true ? procurementAssets(payload) : [];\n",
    "function factoryMutationProvinceIds(payload) {\n  const targets = Array.isArray(payload?.targets) ? payload.targets : [];\n  if (targets.length > 0) {\n    return [...new Set(targets.map((target) => normalizeProvinceId(target?.provinceId)))];\n  }\n  return [normalizeProvinceId(payload?.provinceId)];\n}\n\nfunction factoryAutoOperationScope(world, userId, payload) {\n  const orderIndexes = new Set();\n  for (const provinceId of factoryMutationProvinceIds(payload)) {\n    for (const index of ownedOrderIndexesInProvince(world, userId, provinceId)) orderIndexes.add(index);\n  }\n  const procurement = payload?.autoProcure === true ? procurementAssets(payload) : [];\n",
)

# Unit tests for success and failure atomicity at the facility domain boundary.
insert_after(
    'server/test/facility-groups.test.js',
    "function group(typeId, count, overrides = {}) {\n  return { facilityTypeId: typeId, count, participatingCount: 0, enabled: false, status: 'stopped', statusReason: 'manual', activeRecipeId: typeId === 'farm' ? 'wheat-crop' : `${typeId}-default`, lifetimeOutput: 0, ...overrides };\n}\n",
    "\nfunction unlockFacilityTestProvinces(player) {\n  player.startingProvinceChosen = true;\n  player.startingProvinceId = '110000';\n  player.unlockedProvinces = ['110000', '120000'];\n}\n",
)
insert_after(
    'server/test/facility-groups.test.js',
    "test('rejected factory direct sell leaves running participation unchanged', () => {\n",
    "",
)
# Append tests to avoid disrupting existing test anchors.
path = 'server/test/facility-groups.test.js'
text = read(path).rstrip() + "\n\n" + r"""test('batch recipe change applies every regional target in one facility action', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  unlockFacilityTestProvinces(player);
  player.facilityGroups = [
    group('farm', 1, { provinceId: '110000' }),
    group('farm', 1, { provinceId: '120000' }),
  ];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, alice, 'setFacilityRecipes', {
    targets: [
      { provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
      { provinceId: '120000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
    ],
  }, now + 1);

  assert.equal(response.ok, true);
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '110000').activeRecipeId, 'rice-crop');
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '120000').activeRecipeId, 'rice-crop');
});

test('batch recipe change rejects the whole request before mutating any regional target', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  unlockFacilityTestProvinces(player);
  player.facilityGroups = [
    group('farm', 1, { provinceId: '110000' }),
    group('farm', 1, { provinceId: '120000' }),
  ];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, alice, 'setFacilityRecipes', {
    targets: [
      { provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
      { provinceId: '120000', facilityTypeId: 'farm', recipeId: 'missing-recipe' },
    ],
  }, now + 1);

  assert.equal(response.ok, false);
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '110000').activeRecipeId, 'wheat-crop');
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '120000').activeRecipeId, 'wheat-crop');
});
"""
write(path, text)

# Existing anti-regression verifier now owns the new authoritative batch boundary too.
insert_after(
    'scripts/verify-production-methods.mjs',
    "const gameViewModelSource = readFileSync('src/app/gameViewModel.ts', 'utf8');\n",
    "const gameApiSource = readFileSync('src/api/game.ts', 'utf8');\nconst gameRoutesSource = readFileSync('server/src/game-routes.js', 'utf8');\nconst actionRegistrySource = readFileSync('server/src/player-action-registry.js', 'utf8');\nconst runtimeExecutorSource = readFileSync('server/src/runtime-action-executor.js', 'utf8');\nconst worldStorageSource = readFileSync('server/src/world-storage-v2.js', 'utf8');\n",
)
insert_after(
    'scripts/verify-production-methods.mjs',
    "for (const text of [\n  'const runAcknowledgedAction = useCallback(async (',\n  'void syncConfirmedAction(response, action).finally(finish);',\n  \"setFacilityRecipe: (facilityTypeId, recipeId) => runAcknowledgedAction(\",\n]) assert.ok(gameViewModelSource.includes(text), `生产配置确认同步缺少 ${text}`);\n",
    "for (const text of [\n  \"postAction('/facilities/recipes', { targets })\",\n  'setFacilityRecipes: (targets) => runAcknowledgedAction(',\n  '() => gameActions.setFacilityRecipes(targets),',\n]) {\n  assert.ok(gameApiSource.includes(text) || gameViewModelSource.includes(text), `跨地区生产配置原子入口缺少 ${text}`);\n}\nassert.equal(\n  gameViewModelSource.includes('for (const target of targets) {\\n        const response = await gameActions.setFacilityRecipe('),\n  false,\n  '跨地区生产配置不得恢复客户端逐州串行写入',\n);\nfor (const [source, text] of [\n  [gameRoutesSource, \"path === '/api/game/facilities/recipes'\"],\n  [actionRegistrySource, 'setFacilityRecipes: defineAction'],\n  [runtimeSource, 'function setGroupRecipes(world, userId, payload, now)'],\n  [runtimeSource, 'const prepared = [];'],\n  [researchSource, \"action === 'setFacilityRecipes'\"],\n  [runtimeExecutorSource, \"action === 'setFacilityRecipes'\"],\n  [worldStorageSource, 'function factoryMutationProvinceIds(payload)'],\n]) assert.ok(source.includes(text), `跨地区生产配置权威批量边界缺少 ${text}`);\n",
)

# Design authority: explicitly forbid client-side partial application.
replace_once(
    'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
    "快捷修改作用于当前玩家全部已解锁且实际持有该类型工厂的州，并继续逐州写入现有州级工厂集群的 `activeRecipeId`；不得创建全国工厂集群、全国级生产配置或第二套持久化状态。切换生产产物时尽量保留每州当前作业制度，组合不存在时该州回退 `standard`；切换作业制度时保留每州当前基础配方。客户端入口只循环当前研发已解锁且对所有目标州当前基础配方有效的方法，服务器现有逐州科技与配方校验继续是权威边界。",
    "快捷修改作用于当前玩家全部已解锁且实际持有该类型工厂的州，但必须通过单次 `/facilities/recipes` 权威批量动作提交全部地区目标；服务器必须在修改任何地区前完整校验全部目标的地区经营权限、工厂集群、正式配方和作业制度研发权限，任一目标失败时所有地区都保持原配置，不得由客户端循环调用逐州接口形成部分成功。成功后仍只写入各州现有工厂集群的 `activeRecipeId`；不得创建全国工厂集群、全国级生产配置或第二套持久化状态。切换生产产物时尽量保留每州当前作业制度，组合不存在时该州回退 `standard`；切换作业制度时保留每州当前基础配方。",
)
insert_after(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    "- 同一工厂集群连续快速切换时，客户端最多保留一个正在提交的配置动作和一个最新待提交目标；新的待提交目标覆盖尚未发出的旧目标，避免把每次中间选择都压入权威写队列。已经提交的动作不得取消或伪装失败，最终目标仍通过正式 `setFacilityRecipe` 幂等动作确认。\n",
    "- 一级建筑页跨地区快捷生产必须使用单次服务器 `setFacilityRecipes` 批量动作；客户端不得循环调用 `setFacilityRecipe`。服务器必须先校验整批地区、工厂集群、配方与研发权限，再一次性应用各地区 `activeRecipeId`；任一目标无效时整批失败且不得留下部分地区已切换的状态。地区建筑条目的快捷生产也复用同一批量动作但只提交当前一个地区目标。\n",
)

print('Applied authoritative atomic facility recipe batch action, tests, verifier, and design rules')
