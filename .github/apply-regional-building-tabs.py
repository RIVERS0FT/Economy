from pathlib import Path


def edit(path, before, after, expected=1):
    p = Path(path)
    text = p.read_text()
    assert text.count(before) == expected, (path, before[:120], text.count(before), expected)
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
s = s.replace('              <EmbeddedBuildingsPage\n                model={model}', "              <EmbeddedBuildingsPage\n                kind={activeSection === 'commerce' ? 'commercial' : 'industrial'}\n                model={model}")
s = s.replace("? { label: '返回建筑列表', onClick: () => setFallbackCommercialDetailTypeId(null) }", "? { label: '返回商业建筑列表', onClick: () => handleCommercialDetailChange(null) }")
s = s.replace("? { label: '返回建筑列表', onClick: () => setFallbackFacilityDetailTypeId(null) }", "? { label: '返回工业建筑列表', onClick: () => handleFacilityDetailChange(null) }")
s = s.replace('export function ProvincePage({ model }', 'function ProvincePageContent({ model }')
s += '''

export function ProvincePage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const scope = `${model.game.userId}:${model.game.saveEpoch ?? 0}:${model.selectedProvinceId}`;
  return <ProvincePageContent key={scope} model={model} />;
}
'''
p.write_text(s)
edit('src/styles/province-page.css', 'repeat(4, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))')

# Optional construction controllers isolate regional forms without changing other page hosts.
for path in ['src/pages/BuildingsPage.tsx', 'src/pages/CommercePage.tsx']:
    p = Path(path)
    s = "import type { BuildingConstructionDraft } from '../hooks/useBuildingConstructionDraft';\n" + p.read_text()
    s = s.replace('  renderPart,', '  renderPart,\n  constructionDraft,')
    s = s.replace("  renderPart?: 'build' | 'cards';", "  renderPart?: 'build' | 'cards';\n  constructionDraft?: BuildingConstructionDraft;")
    s = s.replace('  const [buildQuantity, setBuildQuantity] = useState(1);', '''  const [localBuildQuantity, setLocalBuildQuantity] = useState(1);
  const buildQuantity = constructionDraft?.quantity ?? localBuildQuantity;
  const setBuildQuantity = constructionDraft?.setQuantity ?? setLocalBuildQuantity;''')
    if path.endswith('/BuildingsPage.tsx'):
        s = s.replace('    selectedFacilityTypeId,\n    setSelectedFacilityTypeId,', '    selectedFacilityTypeId: modelSelectedFacilityTypeId,\n    setSelectedFacilityTypeId: setModelSelectedFacilityTypeId,')
        s = s.replace('  const now = game.lastProcessedAt;', '''  const selectedFacilityTypeId = constructionDraft?.typeId ?? modelSelectedFacilityTypeId;
  const setSelectedFacilityTypeId = constructionDraft?.setTypeId ?? setModelSelectedFacilityTypeId;
  const now = game.lastProcessedAt;''')
    else:
        s = s.replace("  const [selectedBuildTypeId, setSelectedBuildTypeId] = useState(types[0]?.id ?? '');", "  const [localBuildTypeId, setLocalBuildTypeId] = useState(types[0]?.id ?? '');\n  const selectedBuildTypeId = constructionDraft?.typeId ?? localBuildTypeId;\n  const setSelectedBuildTypeId = constructionDraft?.setTypeId ?? setLocalBuildTypeId;")
        s = s.replace('  }, [selectedBuildTypeId, types]);', '  }, [selectedBuildTypeId, setSelectedBuildTypeId, types]);')
    p.write_text(s)

# Update only the current rules at their existing owners, not business algorithms.
p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
s = p.read_text()
s = s.replace('概览、市场、建筑和仓库四个当前州经营分区', '概览、市场、商业、工业和仓库五个当前州经营分区')
s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
s = s.replace('实际建设与经营由地区统一建筑页及共享详情承载', '实际建设与经营由地区商业／工业分区及共享详情承载')
s = s.replace('`ProvincePage` 内的市场与建筑分区始终是地图所打开当前州的本地视图；统一建筑分区的技术 section ID 继续使用 `buildings`，旧 `commerce` 位置只兼容映射到建筑，不再形成可见分区。', '`ProvincePage` 内的市场、商业与工业分区始终是地图所打开当前州的本地视图；商业与工业分别使用 `commerce` 与 `buildings` 技术 section ID，不改变已有位置标识，也不在地区页提供建筑分类筛选。')
s = s.replace('建筑与仓库直接显示本地经营内容', '商业、工业与仓库直接显示本地经营内容')
a = s.index('一级建筑目录与地区建筑目录共用商品页同款折叠筛选')
b = s.index('\n\n两类卡片保持', a)
s = s[:a] + '''一级建筑目录保留商品页同款折叠筛选，默认全部，候选固定为“全部／商业建筑／工业建筑”。分类与排序只派生展示，不改变当前经营州、资产、经营状态或经济参数；无匹配项显示“没有符合当前筛选条件的建筑”。一级类型汇总、地区钻取及工业快捷生产配置不因地区分区调整而改变。

地区页固定使用“概览｜市场｜商业｜工业｜仓库”五个标签，不显示“建筑”标签，也不显示或读取地区建筑分类筛选。商业只承载当前州商业建设区与商业卡片，工业只承载当前州工业建设区与工业卡片；两者复用接收固定建筑类别的 `RegionalBuildingsPage`，不得根据残留的另一类详情 ID 打开错误详情。无持有建筑时分别显示“当前地区尚未拥有商业建筑。”或“当前地区尚未拥有工业建筑。”，同时保留本类别建设入口。标签切换只改变展示，不执行建设、启停或采购。''' + s[b:]
s = s.replace('建设区按筛选显示工业或商业建设表单，两类使用各自类型和数量草稿，不因商品或筛选切换而互相改写。', '地区建设区按当前商业／工业标签显示对应表单；类型与数量草稿只在当前会话按玩家、存档、地区和建筑类别隔离保存，切换标签或从详情返回恢复本类别草稿，切换地区或玩家不得串用，不写服务器存档。')
s = s.replace('建筑分类筛选状态只在当前会话按玩家与目录范围（全局或州）保存，页面栈跨宿主返回后恢复原筛选；切换州或玩家不得混用，不写服务器存档或影响经济执行。', '建筑分类筛选只属于一级建筑目录，在当前会话按玩家保存并在跨宿主返回时恢复；地区不再创建、读取或恢复建筑分类筛选。')
s += '\n地区商业详情返回 `commerce`，地区工业详情返回 `buildings`；从一级建筑页进入的详情仍返回其类型地区列表。详情态隐藏地区标签和列表；进入同州商品详情或点击标题地区名进入概览后，返回恢复原建筑详情。无页面栈时沿用同样类别归属；玩家、存档或地区改变时清除旧本地详情选择，不得让旧类别 ID 串入新的地区标签。\n'
p.write_text(s)
p = Path('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md')
s = p.read_text().replace('地区已拥有列表只保留一张混合网格，沿用本文的三列 4:5 规则。', '地区商业与工业分区分别展示对应类别网格，两者沿用本文同一套三列 4:5 规则，不因入口拆分复制几何。')
p.write_text(s)
p = Path('docs/UI_DESIGN_SYSTEM.md')
s = p.read_text().replace('`BuildingTypeFilter` 复用商品筛选', '`BuildingTypeFilter` 仅供一级建筑目录使用，复用商品筛选')
p.write_text(s)

# Adapt current source contracts to fixed regional categories; keep global filtering assertions.
p = Path('scripts/verify-commercial-buildings.mjs')
s = p.read_text()
s = s.replace("const buildingsIndex = province.indexOf(\"{ id: 'buildings', label: '建筑' }\");", "const commercialIndex = province.indexOf(\"{ id: 'commerce', label: '商业' }\");\nconst buildingsIndex = province.indexOf(\"{ id: 'buildings', label: '工业' }\");")
s = s.replace("assert.ok(marketIndex >= 0 && buildingsIndex > marketIndex, '地区导航必须保持市场 / 建筑顺序');", "assert.ok(marketIndex >= 0 && commercialIndex > marketIndex && buildingsIndex > commercialIndex, '地区导航必须保持市场 / 商业 / 工业顺序');")
s = s.replace("assert.equal(province.includes(\"{ id: 'commerce', label: '商业' }\"), false, '商业不再使用独立分区');", "assert.equal(province.includes(\"{ id: 'buildings', label: '建筑' }\"), false, '地区不得恢复混合建筑标签');")
s = s.replace('repeat(4, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))').replace('地区四分区', '地区五分区')
s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
s = s.replace("  assert.ok(read(path).includes('<BuildingTypeFilter'));", "  assert.equal(read(path).includes('<BuildingTypeFilter'), path.includes('GlobalBuildingsPage'));\n  if (path.includes('RegionalBuildingsPage')) assert.equal(read(path).includes('useBuildingTypeFilter'), false);")
p.write_text(s)
p = Path('server/test/commercial-page-contract.test.js')
s = p.read_text().replace('both building directories own filtering', 'only the global directory owns filtering and regional tabs fix the kind')
s = s.replace("{ id: 'buildings', label: '建筑' }", "{ id: 'buildings', label: '工业' }")
s = s.replace('assert.equal(province.includes("{ id: \'commerce\', label: \'商业\' }"), false);', 'assert.equal(province.includes("{ id: \'commerce\', label: \'商业\' }"), true);')
s = s.replace(r'repeat\(4,', r'repeat\(5,')
s = s.replace('assert.match(regional, /<BuildingTypeFilter/);', 'assert.doesNotMatch(regional, /<BuildingTypeFilter|useBuildingTypeFilter/);\n  assert.match(regional, /kind: BuildingKind/);')
s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
p.write_text(s)
for path in ['scripts/verify-provincial-economy.mjs', 'scripts/verify-page-content.mjs']:
    p = Path(path)
    s = p.read_text().replace("{ id: 'buildings', label: '建筑' }", "{ id: 'buildings', label: '工业' }")
    s = s.replace('概览｜市场｜建筑｜仓库', '概览｜市场｜商业｜工业｜仓库')
    s = s.replace('repeat(4, minmax(0, 1fr))', 'repeat(5, minmax(0, 1fr))')
    s = s.replace('`ProvincePage` 内的市场与建筑分区始终是地图所打开当前州的本地视图', '`ProvincePage` 内的市场、商业与工业分区始终是地图所打开当前州的本地视图')
    s = s.replace('建筑与仓库直接显示本地经营内容', '商业、工业与仓库直接显示本地经营内容')
    p.write_text(s)

# Retain global-filter and commercial-operation tests; regional setup now selects the tab.
p = Path('tests/browser/unified-buildings.spec.ts')
s = p.read_text()
s = s.replace("getByRole('tab', { name: '建筑', exact: true })", "getByRole('tab', { name: '商业', exact: true })")
s = s.replace("await expect(page.getByRole('tab')).toHaveCount(4);", "await expect(page.getByRole('tab')).toHaveText(['概览', '市场', '商业', '工业', '仓库']);")
s = s.replace("await expect(page.getByRole('tab', { name: '商业', exact: true })).toHaveCount(0);", "await expect(page.locator('.building-type-filter')).toHaveCount(0);")
s = s.replace("await expect(page.locator('.unified-building-list > .facility-cluster-selector-card')).toHaveCount(7);", "await expect(page.locator('.unified-building-list > .facility-cluster-selector-card')).toHaveCount(6);")
a = s.index('  test(`regional directory')
b = s.index("test('global commerce", a)
fragment = s[a:b].replace("    await filter(page, '商业建筑');", "    await expect(page.locator('.unified-regional-buildings')).toHaveAttribute('data-building-kind', 'commercial');")
fragment = fragment.replace("    await filter(page, '工业建筑');", "    await expect(page.getByRole('tab', { name: '商业', exact: true })).toHaveAttribute('aria-selected', 'true');\n    await page.getByRole('tab', { name: '工业', exact: true }).click();\n    await expect(page.locator('.unified-building-list > .facility-cluster-selector-card')).toHaveCount(1);\n    await expect(page.locator('.commercial-build-card, .building-type-filter')).toHaveCount(0);")
fragment = fragment.replace('    await assertNoOverflow(page);\n  });', "    await assertNoOverflow(page);\n    await page.locator('.page-navigation-button--back').click();\n    await expect(page.getByRole('tab', { name: '工业', exact: true })).toHaveAttribute('aria-selected', 'true');\n  });")
s = s[:a] + fragment + s[b:]
s = s.replace("await openRegional(page, 'empty'); await filter(page, '商业建筑');", "await openRegional(page, 'empty');")
s = s.replace("page.getByText('没有符合当前筛选条件的建筑。')", "page.getByText('当前地区尚未拥有商业建筑。')")
p.write_text(s)
# Other province browser contracts keep their original purpose while following the new industrial label.
for p in Path('tests/browser').glob('*.spec.ts'):
    if p.name == 'unified-buildings.spec.ts': continue
    s = p.read_text().replace("getByRole('tab', { name: '建筑', exact: true })", "getByRole('tab', { name: '工业', exact: true })")
    s = s.replace("getByRole('tab', { name: '商业', exact: true })).toHaveCount(0)", "getByRole('tab', { name: '商业', exact: true })).toBeVisible()")
    s = s.replace("provinceTabs.getByRole('tab')).toHaveCount(4)", "provinceTabs.getByRole('tab')).toHaveCount(5)")
    p.write_text(s)

# Narrow fixture controls exercise real page components, never duplicate business rules.
p = Path('tests/browser/runtime-harness.tsx')
s = p.read_text()
a = s.index('function CommerceHarness(')
b = s.index('\nconst runtimeView =', a)
fragment = s[a:b]
fragment = fragment.replace('  Object.assign(window, {\n    __updateCommercialGroup:', '  Object.assign(window, {\n    __setCommercialProvince: setProvinceId,\n    __updateCommercialGroup:')
fragment = fragment.replace('  return <GameShell model={model}><FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider></GameShell>;', '''  if (scenario === 'no-navigation') {
    return <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider>;
  }
  return <GameShell model={model}><FacilityRecipeProfitMarketsProvider markets={model.game.markets}>{page}</FacilityRecipeProfitMarketsProvider></GameShell>;''')
s = s[:a] + fragment + s[b:]
p.write_text(s)

# Temporary edit transport is removed from the final tree before PR validation.
Path('.github/apply-regional-building-tabs.py').unlink()
Path('.github/workflows/prepare-regional-building-tabs.yml').unlink()
