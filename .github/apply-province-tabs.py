from pathlib import Path


def edit(path, before, after, count=1):
    p = Path(path)
    text = p.read_text()
    assert text.count(before) == count, (path, before[:90], text.count(before), count)
    p.write_text(text.replace(before, after))


p = Path('src/pages/ProvincePage.tsx')
s = p.read_text()
s = s.replace("  { id: 'buildings', label: '建筑' },", "  { id: 'commerce', label: '商业' },\n  { id: 'buildings', label: '工业' },")
s = s.replace("? location.section === 'commerce' ? 'buildings' : location.section", '? location.section')
s = s.replace("location?.type === 'regional-commercial' && location.host !== 'buildings'\n          ? 'buildings'", "location?.type === 'regional-commercial' && location.host !== 'buildings'\n          ? 'commerce'")
s = s.replace("const isCommercialDetail = activeSection === 'buildings'", "const isCommercialDetail = activeSection === 'commerce'")
a = s.index('  const handleCommercialDetailChange =')
b = s.index('  const openWarehouseProduct =', a)
s = s[:a] + s[a:b].replace("section: 'buildings'", "section: 'commerce'") + s[b:]
s = s.replace("{activeSection === 'buildings' ? (", "{activeSection === 'commerce' || activeSection === 'buildings' ? (")
s = s.replace('              <EmbeddedBuildingsPage\n                model={model}', '              <EmbeddedBuildingsPage\n                model={model}\n                kind={activeSection === \'commerce\' ? \'commercial\' : \'industrial\'}')
s = s.replace("label: '返回建筑列表', onClick: () => setFallbackCommercialDetailTypeId(null)", "label: '返回商业建筑列表', onClick: () => setFallbackCommercialDetailTypeId(null)")
s = s.replace("label: '返回建筑列表', onClick: () => setFallbackFacilityDetailTypeId(null)", "label: '返回工业建筑列表', onClick: () => setFallbackFacilityDetailTypeId(null)")
s = s.replace('  const location = pageNavigation?.currentLocation;', '''  const fallbackScope = JSON.stringify([model.game.userId, model.selectedProvinceId]);
  const [fallbackScopeKey, setFallbackScopeKey] = useState(fallbackScope);
  const fallbackMatchesProvince = fallbackScopeKey === fallbackScope;
  useEffect(() => {
    setFallbackScopeKey(fallbackScope);
    setFallbackSection('overview');
    setFallbackFacilityDetailTypeId(null);
    setFallbackCommercialDetailTypeId(null);
  }, [fallbackScope]);
  const location = pageNavigation?.currentLocation;''')
s = s.replace('    : fallbackSection;', "    : fallbackMatchesProvince ? fallbackSection : 'overview';")
s = s.replace('    : fallbackFacilityDetailTypeId;', '    : !pageNavigation && fallbackMatchesProvince ? fallbackFacilityDetailTypeId : null;')
s = s.replace('    : fallbackCommercialDetailTypeId;', '    : !pageNavigation && fallbackMatchesProvince ? fallbackCommercialDetailTypeId : null;')
p.write_text(s)
edit('src/styles/province-page.css', 'repeat(4, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))')

# Optional draft controls preserve standalone/global adapters while regional tabs own scoped drafts.
for path in ['src/pages/BuildingsPage.tsx', 'src/pages/CommercePage.tsx']:
    p = Path(path)
    s = "import type { BuildingConstructionDraft } from '../hooks/useBuildingConstructionDraft';\n" + p.read_text()
    s = s.replace('  renderPart,', '  renderPart,\n  constructionDraft,')
    s = s.replace("  renderPart?: 'build' | 'cards';", "  renderPart?: 'build' | 'cards';\n  constructionDraft?: BuildingConstructionDraft;")
    s = s.replace('  const [buildQuantity, setBuildQuantity] = useState(1);', '''  const [internalBuildQuantity, setInternalBuildQuantity] = useState(1);
  const buildQuantity = constructionDraft?.quantity ?? internalBuildQuantity;
  const setBuildQuantity = constructionDraft?.setQuantity ?? setInternalBuildQuantity;''')
    if path.endswith('/BuildingsPage.tsx'):
        s = s.replace('    selectedFacilityTypeId,\n    setSelectedFacilityTypeId,\n', '')
        s = s.replace('  const now = game.lastProcessedAt;', '''  const selectedFacilityTypeId = constructionDraft?.typeId ?? model.selectedFacilityTypeId;
  const setSelectedFacilityTypeId = constructionDraft?.setTypeId ?? model.setSelectedFacilityTypeId;
  const now = game.lastProcessedAt;''')
    else:
        s = s.replace("  const [selectedBuildTypeId, setSelectedBuildTypeId] = useState(types[0]?.id ?? '');", """  const [internalBuildTypeId, setInternalBuildTypeId] = useState(types[0]?.id ?? '');
  const selectedBuildTypeId = constructionDraft?.typeId ?? internalBuildTypeId;
  const setSelectedBuildTypeId = constructionDraft?.setTypeId ?? setInternalBuildTypeId;""")
        s = s.replace('  }, [selectedBuildTypeId, types]);', '  }, [selectedBuildTypeId, setSelectedBuildTypeId, types]);')
    p.write_text(s)

# Page information architecture remains the sole owner of tab and filter semantics.
p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
s = p.read_text()
s = s.replace('概览、市场、建筑和仓库四个当前州经营分区', '概览、市场、商业、工业和仓库五个当前州经营分区')
s = s.replace('实际建设与经营由地区统一建筑页及共享详情承载', '实际建设与经营由地区商业／工业分区及共享详情承载')
s = s.replace('`ProvincePage` 内的市场与建筑分区始终是地图所打开当前州的本地视图；统一建筑分区的技术 section ID 继续使用 `buildings`，旧 `commerce` 位置只兼容映射到建筑，不再形成可见分区。', '`ProvincePage` 内的市场、商业与工业分区始终是地图所打开当前州的本地视图；商业使用 `commerce`，工业继续使用 `buildings`，两者不再相互映射。')
s = s.replace('建筑与仓库直接显示本地经营内容', '商业、工业与仓库直接显示本地经营内容')
s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
s = s.replace('“工业”只替换地区 `buildings` 分区的玩家可见名称，建筑分区继续使用 `buildings`，旧商业分区兼容映射到建筑', '商业与工业分别使用 `commerce` 和 `buildings`，不保留合并“建筑”标签或地区建筑类别筛选')
a = s.index('一级建筑目录与地区建筑目录共用商品页同款折叠筛选')
b = s.index('\n\n两类卡片保持', a)
s = s[:a] + '''一级建筑目录保留商品页同款折叠筛选，默认全部，候选固定为“全部／商业建筑／工业建筑”。分类与排序只派生展示，不改变当前经营州、资产、经营状态或经济参数。无匹配项显示“没有符合当前筛选条件的建筑”，不得误报为未拥有任何建筑。

地区页由“商业”和“工业”标签直接决定建筑类别；各分区只显示本州对应类别的建设区和已拥有建筑网格，不渲染“全部／商业建筑／工业建筑”筛选，也不读取原地区分类筛选状态。无对应建筑时分别显示“当前地区尚未拥有商业建筑”或“当前地区尚未拥有工业建筑”，仍保留对应建设入口。切换标签不提交建设、营业、生产或采购动作。两类分区继续共用列表、卡片及详情组件，不为入口拆分复制页面实现。''' + s[b:]
s = s.replace('页面返回恢复原类型／地区列表，地区标题继续使用通用页面栈。', '页面返回恢复原类型／地区列表和滚动位置。地区商业详情返回 `commerce`，工业详情返回 `buildings`；从一级建筑页进入的详情继续返回一级建筑的地区列表，不跳转到地区分区。详情态隐藏标签与列表，点击地区名仍 push 地区概览，进入同州商品详情后也能返回原建筑详情。无导航上下文时的回退选择必须按玩家与地区隔离，不得让残留详情 ID 跨州或跨类别显示。')
s = s.replace('建设区按筛选显示工业或商业建设表单，两类使用各自类型和数量草稿，不因商品或筛选切换而互相改写。', '地区建设区由当前商业／工业标签决定。建设类型和数量草稿仅在当前会话按玩家、地区和建筑类别保存，切换标签、商品或详情再返回时恢复对应草稿；切换玩家或地区不得混用，不写服务器存档，也不自动提交动作。')
s = s.replace('建筑分类筛选状态只在当前会话按玩家与目录范围（全局或州）保存，页面栈跨宿主返回后恢复原筛选；切换州或玩家不得混用，不写服务器存档或影响经济执行。', '一级建筑分类筛选状态只在当前会话按玩家保存，页面栈跨宿主返回后恢复原筛选；地区标签不读取或写入该状态，不写服务器存档或影响经济执行。')
p.write_text(s)
edit('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md', '地区已拥有列表只保留一张混合网格，沿用本文的三列 4:5 规则。', '地区商业与工业分区分别显示本类别网格，共用本文的三列 4:5 规则；入口和类别归属唯一引用 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`。')
edit('docs/UI_DESIGN_SYSTEM.md', '`BuildingTypeFilter` 复用商品筛选', '`BuildingTypeFilter` 仅供一级建筑目录使用并复用商品筛选')
edit('docs/COMMERCIAL_BUILDINGS_DESIGN.md', '商业建筑进入一级和地区统一建筑页', '商业建筑进入一级建筑页与地区商业分区')

# Existing source contracts are updated to protect the split, not removed.
p = Path('server/test/commercial-page-contract.test.js')
s = p.read_text()
s = s.replace('both building directories own filtering', 'global filtering and separate province building tabs')
s = s.replace("{ id: 'buildings', label: '建筑' }", "{ id: 'buildings', label: '工业' }")
s = s.replace('assert.equal(province.includes("{ id: \'commerce\', label: \'商业\' }"), false);', 'assert.ok(province.includes("{ id: \'commerce\', label: \'商业\' }"));')
s = s.replace(r'repeat\(4,', r'repeat\(5,')
s = s.replace('assert.match(regional, /<BuildingTypeFilter/);', "assert.equal(regional.includes('<BuildingTypeFilter'), false);\n  assert.equal(regional.includes('useBuildingTypeFilter'), false);\n  assert.match(regional, /data-building-kind=\{kind\}/);\n  assert.match(regional, /useBuildingConstructionDraft/);")
s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
p.write_text(s)

p = Path('scripts/verify-commercial-buildings.mjs')
s = p.read_text().replace("{ id: 'buildings', label: '建筑' }", "{ id: 'buildings', label: '工业' }")
s = s.replace("assert.equal(province.includes(\"{ id: 'commerce', label: '商业' }\"), false, '商业不再使用独立分区');", "assert.ok(province.includes(\"{ id: 'commerce', label: '商业' }\"), '商业必须使用独立地区分区');")
s = s.replace('repeat(4, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))').replace('地区四分区', '地区五分区')
s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
s = s.replace("for (const path of ['src/pages/GlobalBuildingsPage.tsx', 'src/pages/RegionalBuildingsPage.tsx']) {\n  assert.ok(read(path).includes('<BuildingTypeFilter'));", "assert.ok(read('src/pages/GlobalBuildingsPage.tsx').includes('<BuildingTypeFilter'));\nassert.equal(read('src/pages/RegionalBuildingsPage.tsx').includes('<BuildingTypeFilter'), false);\nassert.equal(read('src/pages/RegionalBuildingsPage.tsx').includes('useBuildingTypeFilter'), false);\nfor (const path of ['src/pages/GlobalBuildingsPage.tsx', 'src/pages/RegionalBuildingsPage.tsx']) {")
p.write_text(s)
for path in ['scripts/verify-provincial-economy.mjs', 'scripts/verify-page-content.mjs']:
    p = Path(path)
    s = p.read_text()
    s = s.replace("{ id: 'buildings', label: '建筑' }", "{ id: 'buildings', label: '工业' }")
    s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
    s = s.replace('`ProvincePage` 内的市场与建筑分区始终是地图所打开当前州的本地视图', '`ProvincePage` 内的市场、商业与工业分区始终是地图所打开当前州的本地视图')
    s = s.replace('建筑与仓库直接显示本地经营内容', '商业、工业与仓库直接显示本地经营内容')
    if path.endswith('verify-provincial-economy.mjs'):
        s = s.replace('repeat(4, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))')
    p.write_text(s)

for path in ['tests/browser/all-pages-preview.spec.ts', 'tests/browser/province-map.spec.ts', 'tests/browser/province-locked-access.spec.ts']:
    p = Path(path)
    s = p.read_text().replace("getByRole('tab', { name: '建筑', exact: true })", "getByRole('tab', { name: '工业', exact: true })")
    s = s.replace("getByRole('tab', { name: '商业', exact: true })).toHaveCount(0)", "getByRole('tab', { name: '商业', exact: true })).toBeVisible()")
    s = s.replace("provinceTabs.getByRole('tab')).toHaveCount(4)", "provinceTabs.getByRole('tab')).toHaveCount(5)")
    p.write_text(s)

p = Path('tests/browser/unified-buildings.spec.ts')
s = p.read_text().replace("getByRole('tab', { name: '建筑', exact: true })", "getByRole('tab', { name: '商业', exact: true })")
a = s.index('  test(`regional directory')
b = s.index("\ntest('global commerce", a)
part = s[a:b]
part = part.replace("getByRole('tab')).toHaveCount(4)", "getByRole('tab')).toHaveCount(5)")
part = part.replace("getByRole('tab', { name: '商业', exact: true })).toHaveCount(0)", "getByRole('tab', { name: '商业', exact: true })).toBeVisible()")
part = part.replace(".facility-cluster-selector-card')).toHaveCount(7)", ".facility-cluster-selector-card')).toHaveCount(6)")
part = part.replace("    await filter(page, '商业建筑');", "    await expect(page.locator('.building-type-filter')).toHaveCount(0);")
part = part.replace("    await filter(page, '工业建筑');", "    await expect(page.getByRole('tab', { name: '商业', exact: true })).toHaveAttribute('aria-selected', 'true');\n    await page.getByRole('tab', { name: '工业', exact: true }).click();")
part = part.replace("    await expect(detail).toHaveAttribute('data-building-kind', 'industrial');", "    await expect(detail).toHaveAttribute('data-building-kind', 'industrial');\n    await expect(page.getByRole('tablist')).toHaveCount(0);")
s = s[:a] + part + s[b:]
s = s.replace("await openRegional(page, 'empty'); await filter(page, '商业建筑');", "await openRegional(page, 'empty');")
s = s.replace("getByText('没有符合当前筛选条件的建筑。')", "getByText('当前地区尚未拥有商业建筑。')")
p.write_text(s)

# Expose deterministic context switches only in the existing browser harness.
p = Path('tests/browser/runtime-harness.tsx')
s = p.read_text()
a = s.index('function CommerceHarness(')
b = s.index('\nconst runtimeView =', a)
part = s[a:b]
part = part.replace("  const [provinceId, setProvinceId] = useState('110000');", "  const [provinceId, setProvinceId] = useState('110000');\n  const [fixtureUserId, setFixtureUserId] = useState(77901);")
part = part.replace('  Object.assign(window, {\n    __updateCommercialGroup:', '  Object.assign(window, {\n    __setBuildingProvince: setProvinceId,\n    __setBuildingUser: setFixtureUserId,\n    __updateCommercialGroup:')
part = part.replace('game: { ...base.game, credits: 10_000,', 'game: { ...base.game, userId: fixtureUserId, credits: 10_000,')
part = part.replace('  return <GameShell model={model}>', "  if (new URLSearchParams(window.location.search).get('navigation') === 'none') {\n    return <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider>;\n  }\n  return <GameShell model={model}>")
s = s[:a] + part + s[b:]
p.write_text(s)
