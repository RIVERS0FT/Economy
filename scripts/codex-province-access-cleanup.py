from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one fragment, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def replace_count(path, old, new, expected):
    text = read(path)
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} fragments, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new))


def regex_once(path, pattern, replacement, flags=re.S):
    text = read(path)
    updated, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{path}: regex expected exactly one match: {pattern[:140]!r}')
    write(path, updated)


def forbid(path, *tokens):
    text = read(path)
    for token in tokens:
        if token in text:
            raise SystemExit(f'{path}: retired province access token remains: {token!r}')


# GameShell: delete the entire starting-province UI and all false-gated navigation branches.
path = 'src/components/shell/GameShell.tsx'
replace_once(path, "import stateEconomicBaselines from '../../../shared/us-state-economic-baselines.json';\n", '')
replace_once(path, "import { Button, DataList, DataRow, WidgetHeading } from '../ui/layout';\n", '')
replace_once(path, "import { formatCompactNumber, formatCurrency, formatNumber, formatRank } from '../../utils/formatters';", "import { formatCompactNumber, formatCurrency, formatRank } from '../../utils/formatters';")
replace_once(path, "import { provinceEconomicLevelFor } from '../../utils/provinceEconomicLevel';\n", '')
regex_once(path, r"const STATE_ECONOMIC_BASELINE_BY_PROVINCE_ID = new Map\(.*?\nexport function GameShell", "export function GameShell")
replace_once(path, "  const startingProvincePicking = false;\n  const [startingProvinceCandidateId, setStartingProvinceCandidateId] = useState<string | null>(null);\n", '')
replace_once(path, "  const openBank = useCallback(() => {\n    if (!startingProvincePicking) model.setTab('bank');\n  }, [model.setTab, startingProvincePicking]);", "  const openBank = useCallback(() => {\n    model.setTab('bank');\n  }, [model.setTab]);")
replace_once(path, "\n  useEffect(() => {\n    if (!startingProvincePicking) setStartingProvinceCandidateId(null);\n  }, [startingProvincePicking]);\n\n  useEffect(() => {\n    if (startingProvincePicking && model.tab !== 'map') model.setTab('map');\n  }, [model.setTab, model.tab, startingProvincePicking]);\n", '\n')
replace_once(path, "  const selectPlayerTab = useCallback((tab: TabId) => {\n    if (startingProvincePicking) return;", "  const selectPlayerTab = useCallback((tab: TabId) => {")
replace_once(path, "  }, [model.tab, pushPlayerPage, showMap, startingProvincePicking]);", "  }, [model.tab, pushPlayerPage, showMap]);")
replace_once(path, "        <StrategicMapStage\n          model={model}\n          lens={startingProvincePicking ? 'political' : mapLens}\n          startingProvinceCandidateId={startingProvinceCandidateId}\n          onPickStartingProvince={startingProvincePicking ? setStartingProvinceCandidateId : undefined}\n        />\n        {startingProvincePicking ? null : (\n          <StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />\n        )}", "        <StrategicMapStage model={model} lens={mapLens} />\n        <StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />")
replace_once(path, "        rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}${startingProvincePicking ? ' is-starting-province-picking' : ''}`}", "        rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}")
replace_once(path, "        sidebar={startingProvincePicking ? null : (\n          <DesktopSidebar\n            activeTab={model.tab}\n            badges={badges}\n            collapsed={sidebarCollapsed}\n            qqGroupUrl={qqGroupUrl}\n            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}\n            onSelect={selectPlayerTab}\n          />\n        )}", "        sidebar={(\n          <DesktopSidebar\n            activeTab={model.tab}\n            badges={badges}\n            collapsed={sidebarCollapsed}\n            qqGroupUrl={qqGroupUrl}\n            onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}\n            onSelect={selectPlayerTab}\n          />\n        )}")
replace_once(path, "                onClick: startingProvincePicking ? undefined : () => selectPlayerTab('settings'),", "                onClick: () => selectPlayerTab('settings'),")
replace_once(path, "                if (!startingProvincePicking) selectPlayerTab(tab);", "                selectPlayerTab(tab);")
replace_once(path, "            {startingProvincePicking ? null : (\n              <MobileBottomNavigation\n                activeTab={model.tab}\n                badges={badges}\n                onSelect={selectPlayerTab}\n                workspaceSheetOpen={mobileSheetOpen}\n                returning={mobileNavigationReturning}\n                onReturnAnimationEnd={() => setMobileNavigationReturning(false)}\n              />\n            )}", "            <MobileBottomNavigation\n              activeTab={model.tab}\n              badges={badges}\n              onSelect={selectPlayerTab}\n              workspaceSheetOpen={mobileSheetOpen}\n              returning={mobileNavigationReturning}\n              onReturnAnimationEnd={() => setMobileNavigationReturning(false)}\n            />")
replace_once(path, "            {startingProvincePicking ? (\n              <StartingProvinceOverview\n                model={model}\n                candidateProvinceId={startingProvinceCandidateId}\n              />\n            ) : (\n              <StrategicWorkspaceChrome\n                model={model}\n                tutorial={tutorial}\n                pendingItems={notificationCenter.pendingItems}\n              />\n            )}", "            <StrategicWorkspaceChrome\n              model={model}\n              tutorial={tutorial}\n              pendingItems={notificationCenter.pendingItems}\n            />")
replace_once(path, "            data-starting-province-picking={startingProvincePicking ? 'true' : 'false'}\n", '')
forbid(path, 'StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'chooseStartingProvince', 'data-starting-province-picking', '起始州概览', '选择起始州')

# Strategic workspace: map selection has only normal province navigation and transport route picking.
path = 'src/components/shell/StrategicWorkspace.tsx'
regex_once(path, r"export function StrategicMapStage\(\{\n  model,\n  lens,\n  startingProvinceCandidateId = null,\n  onPickStartingProvince,\n\}: \{\n  model: LoadedGameViewModel;\n  lens: ProvinceMapLens;\n  startingProvinceCandidateId\?: string \| null;\n  onPickStartingProvince\?: \(provinceId: string\) => void;\n\}\) \{", "export function StrategicMapStage({ model, lens }: {\n  model: LoadedGameViewModel;\n  lens: ProvinceMapLens;\n}) {")
replace_once(path, "  const startingProvincePicking = false;\n  const effectiveLens: ProvinceMapLens = startingProvincePicking ? 'political' : lens;\n", '')
replace_once(path, "  const openProvincePage = (provinceId: string) => {\n    if (startingProvincePicking) {\n      onPickStartingProvince?.(provinceId);\n      return;\n    }\n    setSelectedProvinceId(provinceId);\n    model.setTab('province');\n  };", "  const openProvincePage = (provinceId: string) => {\n    setSelectedProvinceId(provinceId);\n    model.setTab('province');\n  };")
replace_count(path, "    if (startingProvincePicking) return [];\n", '', 2)
replace_once(path, "  }, [draftStops, model.tab, routeDraft?.draft, routeDraft?.highlightedRouteId, startingProvincePicking, transportRoutes]);", "  }, [draftStops, model.tab, routeDraft?.draft, routeDraft?.highlightedRouteId, transportRoutes]);")
replace_once(path, "  }, [model.game.transportShipments, productById, provinceById, routeById, startingProvincePicking]);", "  }, [model.game.transportShipments, productById, provinceById, routeById]);")
replace_once(path, "  const routePicking: ProvinceMapRoutePicking | null = !startingProvincePicking && routeDraft?.picking", "  const routePicking: ProvinceMapRoutePicking | null = routeDraft?.picking")
replace_once(path, "      data-map-lens={effectiveLens}\n      data-starting-province-picking={startingProvincePicking ? 'true' : 'false'}\n      data-starting-province-candidate-id={startingProvinceCandidateId ?? ''}\n      data-transport-route-picking={!startingProvincePicking && routeDraft?.picking ? 'true' : 'false'}", "      data-map-lens={lens}\n      data-transport-route-picking={routeDraft?.picking ? 'true' : 'false'}")
replace_once(path, "        unlockedProvinceIds={state.provinces.map((province) => province.id)}\n        selectedProvinceId={startingProvincePicking ? startingProvinceCandidateId : model.tab === 'province' ? state.selectedProvinceId : null}\n        onSelectProvince={openProvincePage}\n        lens={effectiveLens}", "        selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}\n        onSelectProvince={openProvincePage}\n        lens={lens}")
replace_once(path, "      {!startingProvincePicking && routeDraft?.picking ? (", "      {routeDraft?.picking ? (")
forbid(path, 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'effectiveLens', 'unlockedProvinceIds', 'data-starting-province')

# Map component: remove the latent locked/unlocked access-state API entirely.
path = 'src/components/provinces/UsMainlandMap.tsx'
replace_once(path, "  locked: boolean;\n", '')
replace_once(path, "function datumFor(province: ProvinceDefinition, summary: ProvinceAssetSummary | undefined, lens: ProvinceMapLens, locked = false): ProvinceMapDatum {", "function datumFor(province: ProvinceDefinition, summary: ProvinceAssetSummary | undefined, lens: ProvinceMapLens): ProvinceMapDatum {")
regex_once(path, r"  const areaColor = locked\n    \? 'var\(--color-map-region-locked\)'\n    : lens === 'political'", "  const areaColor = lens === 'political'")
replace_once(path, "    locked,\n", '')
replace_once(path, "  unlockedProvinceIds,\n", '')
replace_once(path, "  unlockedProvinceIds?: string[];\n", '')
replace_once(path, "  const unlockedSet = useMemo(() => new Set(unlockedProvinceIds || []), [unlockedProvinceIds]);\n  const data = useMemo(() => provinces.map((province) => datumFor(province, summaries[province.id], lens, !unlockedSet.has(province.id))), [lens, provinces, summaries, unlockedSet]);", "  const data = useMemo(() => provinces.map((province) => datumFor(province, summaries[province.id], lens)), [lens, provinces, summaries]);")
replace_once(path, "      {hoveredDatum.locked ? <span className=\"province-map-tooltip__locked\">未解锁</span> : null}\n", '')
replace_once(path, "                    const routePickable = routePickingActive && !datum.locked;", "                    const routePickable = routePickingActive;")
replace_once(path, "                        data-locked={datum.locked ? 'true' : 'false'}\n", '')
replace_once(path, "                        aria-label={`${entry.provinceName}${datum.locked ? '，未解锁' : ''}`}", "                        aria-label={entry.provinceName}")
forbid(path, 'unlockedProvinceIds', 'locked: boolean', 'datum.locked', 'data-locked=', 'province-map-tooltip__locked', '--color-map-region-locked')

# Delete obsolete starting-province overlay/grid styling.
path = 'src/styles/game-shell-layout.css'
regex_once(path, r"\n\.starting-province-overlay \{.*\Z", "\n")
forbid(path, 'starting-province')

# Province page: restore normal JSX formatting and remove a migration-only verifier marker.
path = 'src/pages/ProvincePage.tsx'
replacement = """        {activeSection === 'market' ? (
          <Suspense fallback={<ProvinceSectionLoading />}>
            <EmbeddedMarketPage model={model} embedded readOnly={false} />
          </Suspense>
        ) : null}
        {activeSection === 'buildings' ? (
          <Suspense fallback={<ProvinceSectionLoading />}>
            <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
              <EmbeddedBuildingsPage
                model={model}
                embedded
                detailFacilityTypeId={facilityDetailTypeId ?? undefined}
                onDetailFacilityChange={handleFacilityDetailChange}
              />
            </FacilityRecipeProfitMarketsProvider>
          </Suspense>
        ) : null}
        {activeSection === 'warehouse' ? (
          <WarehouseInventoryPanel
            model={model}
            className="province-warehouse-section"
            onOpenProduct={openWarehouseProduct}
          />
        ) : null}
      </section>"""
regex_once(path, r"        \{activeSection === 'market' \? \(.*?        \) : null\}\n      </section>", replacement)
forbid(path, 'Retired static verifier marker', 'ProvinceUnlockPanel', 'province-unlock-button', '建筑功能未解锁', '仓库功能未解锁')

# Transport page uses the province catalog, not a legacy unlock set.
path = 'src/pages/TransportPage.tsx'
replace_once(path, "  const unlockedProvinceIds = useMemo(\n    () => new Set(game.provinces.map((province) => province.id)),\n    [game.provinces],\n  );\n", '')
replace_once(path, "  const canAddRoute = unlockedProvinceIds.size >= 2 && routes.length < TRANSPORT_MAX_ROUTES_PER_PLAYER;", "  const canAddRoute = game.provinces.length >= 2 && routes.length < TRANSPORT_MAX_ROUTES_PER_PLAYER;")
forbid(path, 'unlockedProvinceIds')

# Client model/API no longer expose retired province-access actions. Server compatibility tombstones remain.
path = 'src/api/game.ts'
replace_once(path, "  chooseStartingProvince: (provinceId: string) => postAction('/provinces/starting', { provinceId }),\n  unlockProvince: (provinceId: string) => postAction('/provinces/unlock', { provinceId }),\n", '')
forbid(path, 'chooseStartingProvince', 'unlockProvince', '/provinces/starting', '/provinces/unlock')

path = 'src/app/gameViewModel.ts'
replace_once(path, "  chooseStartingProvince: (provinceId: string) => Promise<ActionResult>;\n  unlockProvince: (provinceId: string) => Promise<ActionResult>;\n", '')
replace_once(path, "    chooseStartingProvince: (provinceId) => runAction('chooseStartingProvince', () => gameActions.chooseStartingProvince(provinceId)),\n    unlockProvince: (provinceId) => runAction('unlockProvince', () => gameActions.unlockProvince(provinceId)),\n", '')
forbid(path, 'chooseStartingProvince', 'unlockProvince')

path = 'src/app/LocalGamePreviewApp.tsx'
regex_once(path, r"  // The account-free preview is a navigation/catalog coverage harness, not an\n  // Mirror the formal rule: all 48 provinces are directly accessible; these fields are compatibility mirrors only\.\n  game\.startingProvinceChosen = true;\n  game\.unlockedProvinces = game\.provinces\.map\(\(province\) => province\.id\);\n", '')
replace_once(path, "    chooseStartingProvince: localOnlyAction,\n    unlockProvince: localOnlyAction,\n", '')
forbid(path, 'chooseStartingProvince', 'unlockProvince', 'startingProvinceChosen', 'unlockedProvinces')

# Authoritative page design: no dead selectable-start-state implementation and no locked province page model.
path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path)
if text.count('全部已解锁州') < 2:
    raise SystemExit('page design: expected global market/building legacy wording')
text = text.replace('全部已解锁州', '连续 48 州')
old = '起始州选择已永久退役。新玩家和旧兼容快照进入游戏后都直接使用正常战略地图镜头、镜头栏和州级导航；任何 `startingProvinceChosen` 兼容字段都不得重新触发选点模式、隐藏业务导航或阻止打开页面。地图上的连续 48 州全部是正常经营入口，点击州面只切换／打开经营上下文。'
new = '起始州选择已永久退役。新玩家、旧玩家和旧兼容快照进入游戏后都直接使用正常战略地图镜头、镜头栏和州级导航；`startingProvinceChosen`、`startingProvinceId` 与 `unlockedProvinces` 只允许作为服务器旧存档兼容数据存在，不得重新触发选点模式、隐藏业务导航、阻止打开页面或改变经营资格。地图上的连续 48 州全部是正常经营入口，点击州面只切换／打开经营上下文。实现层不得保留仅靠固定 `false` 关闭的 `StartingProvinceOverview`、`startingProvincePicking`、`startingProvinceCandidateId` 或 `onPickStartingProvince` 等可重新启用分支；`UsMainlandMap` 不接受 `unlockedProvinceIds` 或 `locked` 访问状态，州面只表达镜头、选择与经营数据。'
if text.count(old) != 1:
    raise SystemExit('page design: retired starting-province paragraph anchor mismatch')
text = text.replace(old, new, 1)
old = '不大于 `720px` 时镜头栏和地图 Tooltip 必须隐藏，普通经营状态触摸州面直接进入地区页，起始州选点模式则只更新候选；地图继续保持缩放和平移手势。'
new = '不大于 `720px` 时镜头栏和地图 Tooltip 必须隐藏，触摸州面直接进入地区页；地图继续保持缩放和平移手势。'
if text.count(old) != 1:
    raise SystemExit('page design: mobile starting-pick wording anchor mismatch')
text = text.replace(old, new, 1)
pattern = r"新玩家首次进入游戏必须先按 3\.1 的地图选点流程选择起始州（永久绑定、不可更换）；.*?至少 `44px` 触控高度。"
replacement = '起始州选择与地区解锁均已永久退役；新玩家、旧玩家和兼容快照都直接拥有连续 48 州的完整经营访问资格。州级页固定显示“概览｜市场｜建筑｜仓库”四个分区，概览、市场、建筑和仓库都按正常经营规则可用；不得根据 `startingProvinceChosen`、`startingProvinceId` 或 `unlockedProvinces` 切换锁定视图、只读市场、隐藏业务内容、计算解锁费用或禁用导航。页面不得恢复起始州确认、地区解锁面板、距离解锁费用、解锁按钮或“未解锁”提示。四个互斥切换按钮继续使用完整 `tablist`／`tab`／`tabpanel` 语义、方向键与 Home／End 键盘导航，并保持至少 `44px` 触控高度。'
text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit('page design: province page legacy unlock paragraph anchor mismatch')
write(path, text)
forbid(path, '新玩家首次进入游戏必须先按 3.1', '起始州选点模式则只更新候选', '全部已解锁州')

# Static verifiers now prohibit retired client access-state code instead of requiring false-gated branches.
path = 'scripts/verify-local-game-preview.mjs'
regex_once(path, r"  const gameShell = read\('src/components/shell/GameShell\.tsx'\);\n  assert\.ok\(\n    gameShell\.includes\('const startingProvincePicking = false;'\),\n    '免登录与在线外壳都不得恢复起始州选择门禁',\n  \);", "  const gameShell = read('src/components/shell/GameShell.tsx');\n  for (const token of ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince']) {\n    assert.equal(gameShell.includes(token), false, `免登录与在线外壳不得保留已退役起始州分支: ${token}`);\n  }")

path = 'scripts/verify-player-avatar.mjs'
replace_once(path, "  \"onClick: startingProvincePicking ? undefined : () => selectPlayerTab('settings')\",", "  \"onClick: () => selectPlayerTab('settings')\",")

path = 'scripts/verify-game-three-layer.mjs'
replace_once(path, "  \"rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}${startingProvincePicking ? ' is-starting-province-picking' : ''}`}\",", "  \"rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}\",")
replace_once(path, "  '<StrategicMapStage',\n  \"lens={startingProvincePicking ? 'political' : mapLens}\",", "  '<StrategicMapStage model={model} lens={mapLens} />',")
replace_once(path, "forbidText('src/components/shell/GameShell.tsx', 'backdrop=');", "forbidText('src/components/shell/GameShell.tsx', 'backdrop=');\nfor (const text of ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'chooseStartingProvince']) forbidText('src/components/shell/GameShell.tsx', text);")

path = 'scripts/verify-overview-content.mjs'
replace_once(path, "  \"rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}${startingProvincePicking ? ' is-starting-province-picking' : ''}`}\",", "  \"rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}\",")
replace_once(path, "  'pendingItems={notificationCenter.pendingItems}',\n]);", "  'pendingItems={notificationCenter.pendingItems}',\n]);\nforbidAll(paths.shell, ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince']);")

path = 'scripts/verify-provincial-economy.mjs'
replace_once(path, "  '<UsMainlandMap', 'summaries={state.summaries}', 'const openProvincePage = (provinceId: string) => {',\n  'setSelectedProvinceId(provinceId);', \"model.setTab('province');\",\n  'const startingProvincePicking = false;',\n  'selectedProvinceId={startingProvincePicking',\n  \": model.tab === 'province' ? state.selectedProvinceId : null}\",\n  'onSelectProvince={openProvincePage}', 'referenceNow={model.game.lastProcessedAt}',", "  '<UsMainlandMap', 'summaries={state.summaries}', 'const openProvincePage = (provinceId: string) => {',\n  'setSelectedProvinceId(provinceId);', \"model.setTab('province');\",\n  \"selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}\",\n  'onSelectProvince={openProvincePage}', 'referenceNow={model.game.lastProcessedAt}',")
replace_once(path, "  'const STRATEGIC_PAGE_PRESENTATION = {', \"province: 'building'\", '<ApplicationMapLayerPortal>',\n  '<StrategicMapStage', \"lens={startingProvincePicking ? 'political' : mapLens}\",\n  'startingProvinceCandidateId={startingProvinceCandidateId}',\n  'onPickStartingProvince={startingProvincePicking ? setStartingProvinceCandidateId : undefined}',\n  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',", "  'const STRATEGIC_PAGE_PRESENTATION = {', \"province: 'building'\", '<ApplicationMapLayerPortal>',\n  '<StrategicMapStage model={model} lens={mapLens} />',\n  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',")
replace_once(path, "  '<EmbeddedBuildingsPage model={model} embedded />',", "  '<EmbeddedBuildingsPage',")
replace_once(path, "for (const text of ['startingProvinceModal', 'starting-province-overlay']) assert.ok(!gameShell.includes(text), `玩家战略外壳不应保留旧起始州弹层: ${text}`);", "for (const text of ['startingProvinceModal', 'starting-province-overlay', 'StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'chooseStartingProvince']) assert.ok(!gameShell.includes(text), `玩家战略外壳不应保留起始州访问分支: ${text}`);\nfor (const text of ['startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'unlockedProvinceIds']) assert.ok(!strategicWorkspace.includes(text), `战略地图不应保留地区访问门禁: ${text}`);\nfor (const text of ['unlockedProvinceIds', 'locked: boolean', 'data-locked=', 'province-map-tooltip__locked', '--color-map-region-locked']) assert.ok(!mapComponent.includes(text), `地图组件不应保留地区访问状态: ${text}`);")

path = 'scripts/verify-game-shell-layout.mjs'
regex_once(path, r"check\('src/components/shell/GameShell\.tsx', \[.*?\n\]\);\nforbid\('src/components/shell/GameShell\.tsx', \[", """check('src/components/shell/GameShell.tsx', [
  'const STRATEGIC_PAGE_PRESENTATION = {',
  "province: 'building'",
  "transport: 'building'",
  "leaderboard: 'fullscreen'",
  "const [sidebarCollapsed, setSidebarCollapsed] = useState(true)",
  "const [mapLens, setMapLens] = useState<ProvinceMapLens>('assets')",
  '<ApplicationMapLayerPortal>',
  '<StrategicMapStage model={model} lens={mapLens} />',
  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',
  'sidebar={(',
  '<DesktopSidebar',
  '<StrategicWorkspaceChrome',
  'tutorial={tutorial}',
  'pendingItems={notificationCenter.pendingItems}',
  'data-strategic-presentation={pagePresentation}',
  'integratedPrimaryCard',
  'pageTransitionKey={playerPageLocationKey(pageLocation)}',
  'data-strategic-page-location={playerPageLocationKey(pageLocation)}',
  'playerId: model.user.id',
  'title: BRAND_NAME',
  'playerName,',
  "onClick: () => selectPlayerTab('settings')",
]);
forbid('src/components/shell/GameShell.tsx', [""")
replace_once(path, "  'showEventRail=',\n]);", "  'showEventRail=',\n  'StartingProvinceOverview',\n  'startingProvincePicking',\n  'startingProvinceCandidateId',\n  'onPickStartingProvince',\n  'chooseStartingProvince',\n  'data-starting-province-picking',\n]);")
regex_once(path, r"check\('src/components/shell/StrategicWorkspace\.tsx', \[.*?\n\]\);\nforbid\('src/components/shell/StrategicWorkspace\.tsx', \[", """check('src/components/shell/StrategicWorkspace.tsx', [
  'export function StrategicMapStage',
  '<UsMainlandMap',
  'const openProvincePage = (provinceId: string) => {',
  'setSelectedProvinceId(provinceId);',
  "model.setTab('province')",
  "selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}",
  'export function StrategicMapLensBar',
  'export function StrategicWorkspaceChrome',
  'aria-label="地图镜头"',
  '<StrategicOutliner',
  'pendingItems={pendingItems}',
]);
forbid('src/components/shell/StrategicWorkspace.tsx', [""")
replace_once(path, "  'EconomicEventLogPanel',\n]);", "  'EconomicEventLogPanel',\n  'startingProvincePicking',\n  'startingProvinceCandidateId',\n  'onPickStartingProvince',\n  'unlockedProvinceIds',\n  'data-starting-province',\n]);")
needle = "check('src/components/provinces/UsMainlandMap.tsx', [\n  'useWorkspaceTooltipLayer()', 'supportsTopLayerPopover()',\n  'showTopLayerPopover(tooltip)', 'hideTopLayerPopover(tooltip)',\n  \"popover={tooltipTopLayerActive ? 'manual' : undefined}\",\n  'data-top-layer={tooltipTopLayerActive',\n]);"
replacement = needle + "\nforbid('src/components/provinces/UsMainlandMap.tsx', ['unlockedProvinceIds', 'locked: boolean', 'data-locked=', 'province-map-tooltip__locked', '--color-map-region-locked']);"
replace_once(path, needle, replacement)
replace_once(path, "console.log('游戏与管理员共享外壳验证通过：固定状态栏、唯一共享页面滚动、跨页面常驻战略追踪器、起始州地图选点与左侧概览确认、研发统一 workspaceCard 与内部透明科技画布、根级 Dialog、共享 Tooltip 宿主与逐节点 Top Layer、48px 通知轨道、8px 战略栅格、主卡片侧栏覆盖、建筑式页面、根级地图镜头、镜头按钮图标文字同轴居中与安全浮层满足当前基线。');", "console.log('游戏与管理员共享外壳验证通过：固定状态栏、唯一共享页面滚动、跨页面常驻战略追踪器、连续 48 州直接经营、研发统一 workspaceCard 与内部透明科技画布、根级 Dialog、共享 Tooltip 宿主与逐节点 Top Layer、48px 通知轨道、8px 战略栅格、主卡片侧栏覆盖、建筑式页面、根级地图镜头、镜头按钮图标文字同轴居中与安全浮层满足当前基线。');")

path = 'scripts/verify-provincial-unlock-transport.mjs'
old = """requireText(gameShell, 'const startingProvincePicking = false;', '应用外壳不得恢复起始州选点门禁。');
forbidText(gameShell, 'game.startingProvinceChosen === false', '应用外壳不得按旧起始州字段阻止正常导航。');
requireText(strategicWorkspace, 'const startingProvincePicking = false;', '战略地图不得恢复起始州选点门禁。');
forbidText(strategicWorkspace, 'model.game.startingProvinceChosen === false', '战略地图不得按旧起始州字段进入选点模式。');
requireText(strategicWorkspace, 'unlockedProvinceIds={state.provinces.map((province) => province.id)}', '战略地图必须将连续 48 州全部视为可访问。');"""
new = """for (const text of ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'chooseStartingProvince']) {
  forbidText(gameShell, text, `应用外壳不得保留起始州选择分支：${text}`);
}
for (const text of ['startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'unlockedProvinceIds']) {
  forbidText(strategicWorkspace, text, `战略地图不得保留地区访问门禁：${text}`);
}
for (const text of ['unlockedProvinceIds', 'locked: boolean', 'data-locked=', 'province-map-tooltip__locked', '--color-map-region-locked']) {
  forbidText(provinceMap, text, `地图组件不得保留地区访问状态：${text}`);
}
for (const text of ['chooseStartingProvince', 'unlockProvince', '/provinces/starting', '/provinces/unlock']) {
  forbidText(gameApi, text, `正式客户端 API 不得暴露已退役地区访问动作：${text}`);
  forbidText(viewModel, text, `正式客户端 ViewModel 不得暴露已退役地区访问动作：${text}`);
}
for (const text of ['chooseStartingProvince', 'unlockProvince', 'startingProvinceChosen', 'unlockedProvinces']) {
  forbidText(localPreview, text, `本地预览不得依赖已退役地区访问状态：${text}`);
}"""
replace_once(path, old, new)
replace_once(path, "requireText(productDesign, '连续 48 州从玩家首次建档起全部可直接经营，不存在起始州选择、地区解锁或解锁费用', '产品设计必须记录 48 州默认开放。');", "requireText(productDesign, '连续 48 州从玩家首次建档起全部可直接经营，不存在起始州选择、地区解锁或解锁费用', '产品设计必须记录 48 州默认开放。');\nrequireText(pageDesign, '实现层不得保留仅靠固定 `false` 关闭的 `StartingProvinceOverview`', '页面设计必须禁止保留可重新启用的起始州死分支。');\nrequireText(pageDesign, '`UsMainlandMap` 不接受 `unlockedProvinceIds` 或 `locked` 访问状态', '页面设计必须禁止地图恢复锁定州访问状态。');")

# Final source-level guard: no retired client access-state tokens remain anywhere under src.
for path in Path('src').rglob('*'):
    if not path.is_file() or path.suffix not in {'.ts', '.tsx', '.js', '.css'}:
        continue
    text = path.read_text(encoding='utf-8')
    for token in ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'unlockedProvinceIds', 'chooseStartingProvince', 'unlockProvince', 'province-map-tooltip__locked', 'data-starting-province-picking']:
        if token in text:
            raise SystemExit(f'{path}: retired client access token remains after cleanup: {token}')

print('Province access dead-code cleanup applied successfully.')
