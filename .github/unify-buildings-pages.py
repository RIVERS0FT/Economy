from pathlib import Path


def replace(text, before, after, count=1):
    assert text.count(before) == count, (before[:110], text.count(before), count)
    return text.replace(before, after)


def edit(path, before, after, count=1):
    p = Path(path)
    p.write_text(replace(p.read_text(), before, after, count))

# Industrial adapter offers construction/cards fragments to the unified regional directory.
p = Path('src/pages/BuildingsPage.tsx')
s = p.read_text()
s = s.replace("import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';", "import { BuildingDetailPage } from '../components/buildings/BuildingDetailPage';")
s = replace(s, '  embedded = false,', "  embedded = false,\n  renderPart,")
s = replace(s, '  embedded?: boolean;', "  embedded?: boolean;\n  renderPart?: 'build' | 'cards';")
s = replace(s, '    if (!selectedType) return undefined;', "    if (!selectedType || renderPart === 'cards') return undefined;")
s = replace(s, 'model.selectedProvinceId, selectedType]);', 'model.selectedProvinceId, selectedType, renderPart]);')
s = replace(s, '  if (!selectedType) {', "  if (!selectedType) {\n    if (renderPart === 'cards') return null;")
a = s.index('        {orderedFacilityGroups.map((entry) => (')
b = s.index('\n      </div>', a)
expression = s[a:b].strip()[1:-1]
s = s[:a] + '        {facilityCards}' + s[b:]
s = s.replace('  const facilityList = (', '  const facilityCards = ' + expression + ';\n\n  const facilityList = (')
s = replace(s, '  const facilityDetail = selectedFacilityEntry ? (', '''  if (renderPart === 'build') return buildCard;
  if (renderPart === 'cards') return <>{facilityCards}</>;

  const facilityDetail = selectedFacilityEntry ? (''')
s = replace(s, '    <div className="facility-cluster-detail-shell facility-cluster-detail-page">\n      <PagePanel className="production-surface facility-card facility-group-card facility-cluster-detail-card">', '''    <BuildingDetailPage kind="industrial" name={selectedFacilityEntry.type.name}
      provinceName={model.selectedProvince?.name || '当前地区'} embedded={embedded} onBack={closeFacilityDetail}>''')
a = s.index('  const facilityDetail =')
b = s.index('  const buildingsManagementContent', a)
fragment = s[a:b].replace('      </PagePanel>\n    </div>', '    </BuildingDetailPage>')
s = s[:a] + fragment + s[b:]
a = s.index('  if (embedded) return buildingsContent;')
b = s.index('  return (\n    <PageLayout\n      title={`${model.selectedProvince', a)
s = s[:a] + '  if (selectedFacilityEntry) return facilityDetail;\n  if (embedded) return buildingsContent;\n\n' + s[b:]
p.write_text(s)

# Commercial adapter: settings use the existing authenticated, idempotent action endpoint.
p = Path('src/pages/CommercePage.tsx')
s = p.read_text()
s = s.replace("import { runCommercialBuildingAction } from '../api/commercial';", "import { runCommercialBuildingAction, type CommercialBuildingOperation } from '../api/commercial';")
s = s.replace("import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';", "import { BuildingDetailPage } from '../components/buildings/BuildingDetailPage';\nimport { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';")
s = s.replace("import type { CommercialStateFields }", "import type { CommercialStateFields, CommercialAutoOperationPolicy }")
s = replace(s, '  embedded = false,', '  embedded = false,\n  renderPart,')
s = replace(s, '  embedded?: boolean;', "  embedded?: boolean;\n  renderPart?: 'build' | 'cards';")
s = replace(s, '  const game = model.game as', '  const navigation = usePlayerPageNavigation();\n  const game = model.game as')
s = replace(s, "    operation: 'build' | 'start' | 'stop',", '    operation: CommercialBuildingOperation,')
s = replace(s, '    quantity?: number,', '    quantity?: number,\n    policy?: CommercialAutoOperationPolicy,')
s = replace(s, '        quantity,', '        quantity,\n        policy,')
s = replace(s, '  if (types.length === 0) {', "  if (types.length === 0) {\n    if (renderPart === 'cards') return null;")
a = s.index('        {provinceGroups.map((group) => {')
b = s.index('\n      </div>', a)
expression = s[a:b].strip()[1:-1]
s = s[:a] + '        {buildingCards}' + s[b:]
s = s.replace('  const buildingList = (', '  const buildingCards = ' + expression + ';\n\n  const buildingList = (')
s = s.replace('<BuildingClusterCard key={group.commercialTypeId}', '<BuildingClusterCard kind="commercial" key={group.commercialTypeId}')
a = s.index('  const detail = selectedGroup')
b = s.index('  const content =', a)
s = s[:a] + '''  const openProductDetail = (productId: string) => {
    const current = navigation?.currentLocation;
    if (navigation && current?.type === 'regional-commercial') {
      navigation.pushPage({ type: 'regional-product', host: current.host === 'buildings' ? 'market' : 'province', provinceId: current.provinceId, productId });
      return;
    }
    model.selectMarketAsset('commodity', productId);
  };

  const detail = selectedGroup && selectedDetailType ? (
    <BuildingDetailPage kind="commercial" name={selectedDetailType.name}
      provinceName={model.selectedProvince?.name || '当前地区'} embedded={embedded} onBack={closeDetail}>
      {actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}
      <CommercialBuildingDetail group={selectedGroup} type={selectedDetailType}
        products={game.products} inventories={game.inventories} markets={game.markets} now={game.lastProcessedAt}
        pending={Boolean(pendingAction)} onOpenProductMarket={openProductDetail}
        onAutoOperationChange={(policy) => void execute('auto-operation', 'auto-operation', selectedGroup.commercialTypeId, undefined, policy)}
        onToggle={(enabled) => void execute(
          `${enabled ? 'start' : 'stop'}:${selectedGroup.commercialTypeId}`,
          enabled ? 'start' : 'stop', selectedGroup.commercialTypeId,
        )}
      />
    </BuildingDetailPage>
  ) : null;

  if (renderPart === 'build') return <>{actionError ? <p className="commercial-action-error" role="alert">{actionError}</p> : null}{buildCard}</>;
  if (renderPart === 'cards') return <>{buildingCards}</>;
  if (selectedGroup && selectedDetailType) return detail;

''' + s[b:]
a = s.index('  if (selectedGroup && selectedDetailType) {')
b = s.index('  return (\n    <PageLayout title={`${model.selectedProvince', a)
s = s[:a] + s[b:]
p.write_text(s)

p = Path('src/components/buildings/BuildingClusterCard.tsx')
s = p.read_text().replace("ariaLabel, onSelect, className = '',", "ariaLabel, onSelect, className = '', kind = 'industrial',")
s = s.replace('  className?: string;', "  className?: string;\n  kind?: 'industrial' | 'commercial';")
s = s.replace('      data-status={status}', '      data-status={status}\n      data-building-kind={kind}')
p.write_text(s)

# A legacy commercial location still resolves, but there is only one visible building section.
p = Path('src/navigation/playerPageStack.ts')
s = p.read_text()
s = replace(s, "  | { type: 'regional-commercial'; provinceId: string; commercialTypeId: string }", "  | { type: 'regional-commercial'; host?: 'province' | 'buildings'; provinceId: string; commercialTypeId: string }\n  | { type: 'global-commercial'; commercialTypeId: string }")
s = replace(s, "  if (location.type === 'province' || location.type === 'regional-commercial') return 'province';", "  if (location.type === 'province') return 'province';\n  if (location.type === 'regional-commercial') return location.host === 'buildings' ? 'buildings' : 'province';\n  if (location.type === 'global-commercial') return 'buildings';")
s = replace(s, 'return `regional-commercial:${location.provinceId}:${location.commercialTypeId}`;', 'return `regional-commercial:${location.host ?? \'province\'}:${location.provinceId}:${location.commercialTypeId}`;')
s = replace(s, "  if (location.type === 'global-market-product') return `global-market-product:${location.productId}`;", "  if (location.type === 'global-market-product') return `global-market-product:${location.productId}`;\n  if (location.type === 'global-commercial') return `global-commercial:${location.commercialTypeId}`;")
p.write_text(s)

p = Path('src/pages/ProvincePage.tsx')
s = p.read_text()
a = s.index("const EmbeddedCommercePage = lazy(")
b = s.index('const EmbeddedBuildingsPage', a)
s = s[:a] + s[b:]
s = s.replace("import('./BuildingsPage')", "import('./RegionalBuildingsPage')").replace('default: module.BuildingsPage,', 'default: module.RegionalBuildingsPage,')
s = replace(s, "  { id: 'commerce', label: '商业' },\n  { id: 'buildings', label: '工业' },", "  { id: 'buildings', label: '建筑' },")
s = replace(s, '? location.section\n', "? location.section === 'commerce' ? 'buildings' : location.section\n")
s = s.replace("location?.type === 'regional-commercial'", "location?.type === 'regional-commercial' && location.host !== 'buildings'")
s = s.replace("          ? 'commerce'", "          ? 'buildings'")
s = replace(s, "const isCommercialDetail = activeSection === 'commerce'", "const isCommercialDetail = activeSection === 'buildings'")
s = s.replace("|| current.type === 'regional-commercial'", "|| (current.type === 'regional-commercial' && current.host !== 'buildings')")
s = replace(s, "        type: 'regional-commercial',\n        provinceId:", "        type: 'regional-commercial',\n        host: 'province',\n        provinceId:")
s = s.replace("section: 'commerce',", "section: 'buildings',")
a = s.index("        {activeSection === 'commerce' ? (")
b = s.index("        {activeSection === 'buildings' ? (", a)
s = s[:a] + s[b:]
s = replace(s, '                onDetailFacilityChange={handleFacilityDetailChange}', '                onDetailFacilityChange={handleFacilityDetailChange}\n                detailCommercialTypeId={commercialDetailTypeId ?? undefined}\n                onDetailCommercialTypeChange={handleCommercialDetailChange}')
s = s.replace('返回商业建筑列表', '返回建筑列表').replace('返回工业建筑列表', '返回建筑列表')
p.write_text(s)

# Mixed global catalog; identifiers remain tagged presentation data, not FacilityGroup assets.
p = Path('src/pages/GlobalBuildingsPage.tsx')
s = p.read_text()
s = "import { BuildingTypeFilter, type BuildingKindFilter } from '../components/buildings/BuildingTypeFilter';\nimport { CommercialBuildingArtwork } from '../components/commercial/CommercialBuildingArtwork';\nimport { commercialProfitPerMinute } from '../utils/commercialPresentation';\nimport { GlobalCommercialBuildingPage } from './GlobalCommercialBuildingPage';\n" + s
s = replace(s, "  const [selectedGlobalFacilityTypeId", "  const [buildingFilter, setBuildingFilter] = useState<BuildingKindFilter>('all');\n  const [selectedCommercialTypeId, setSelectedCommercialTypeId] = useState<string | null>(null);\n  const [selectedGlobalFacilityTypeId")
s = replace(s, "    if (!stackedLocation) return;", '''    if (!stackedLocation) return;
    if (stackedLocation.type === 'global-commercial') {
      setSelectedCommercialTypeId(stackedLocation.commercialTypeId);
      setSelectedGlobalFacilityTypeId(null);
      setFacilityDetailTypeId(null);
      setActiveProvinceId(null);
      return;
    }
    if (stackedLocation.type === 'regional-commercial' && stackedLocation.host === 'buildings') {
      setSelectedCommercialTypeId(stackedLocation.commercialTypeId);
      setSelectedGlobalFacilityTypeId(null);
      setFacilityDetailTypeId(null);
      setActiveProvinceId(stackedLocation.provinceId);
      return;
    }
    setSelectedCommercialTypeId(null);''')
s = replace(s, '    return [{\n      facilityTypeId: type.id,', "    return [{\n      kind: 'industrial' as const,\n      buildingTypeId: type.id,")
s = s.replace('row.facilityTypeId', 'row.buildingTypeId')
anchor = '  const sortedFacilityRows = useMemo(() => [...facilityRows].sort((left, right) => {'
s = replace(s, anchor, '''  const commercialRows = useMemo(() => (game.commercialBuildingTypes ?? []).flatMap((type, index) => {
    const validProvinces = new Set(provinces.map((province) => province.id));
    const totalCount = (game.commercialBuildingGroups ?? []).filter((group) => group.commercialTypeId === type.id && validProvinces.has(group.provinceId) && group.count > 0)
      .reduce((sum, group) => sum + group.count, 0);
    if (totalCount < 1) return [];
    const averageProfit = commercialProfitPerMinute(type);
    return [{ kind: 'commercial' as const, buildingTypeId: type.id, catalogIndex: game.facilityTypes.length + index,
      name: type.name, totalCount, averageProfit, profitTone: globalProfitTone(averageProfit),
      profitValue: formatCurrency(averageProfit), profitAccessibleValue: accessibleProfit(averageProfit),
      profitDetail: '单座稳定利润／分钟；不含集群数量倍数', quickProduction: null }];
  }), [game.commercialBuildingTypes, game.commercialBuildingGroups, game.facilityTypes.length, provinces]);
  const allBuildingRows = useMemo(() => [...facilityRows, ...commercialRows], [facilityRows, commercialRows]);
  const selectedCommercialType = game.commercialBuildingTypes?.find((type) => type.id === selectedCommercialTypeId);

  const sortedFacilityRows = useMemo(() => [...allBuildingRows].filter((row) => buildingFilter === 'all' || row.kind === buildingFilter).sort((left, right) => {''')
s = replace(s, '  }), [catalogSort, facilityRows]);', '  }), [catalogSort, allBuildingRows, buildingFilter]);')
s = replace(s, "  const openGlobalFacility = (facilityTypeId: string) => {", "  const openGlobalFacility = (facilityTypeId: string) => {\n    setSelectedCommercialTypeId(null);")
s = replace(s, '    row: (typeof facilityRows)[number],', '    row: (typeof allBuildingRows)[number],')
s = replace(s, '  if (activeProvince) {', '''  const openGlobalCommercial = (commercialTypeId: string) => {
    setSelectedCommercialTypeId(commercialTypeId);
    setSelectedGlobalFacilityTypeId(null);
    setFacilityDetailTypeId(null);
    setActiveProvinceId(null);
    pageNavigation?.pushPage({ type: 'global-commercial', commercialTypeId });
  };

  if (selectedCommercialType) {
    return <GlobalCommercialBuildingPage model={model} type={selectedCommercialType} activeProvinceId={activeProvinceId}
      onOpenRegion={(provinceId) => {
        model.setSelectedProvinceId(provinceId);
        setActiveProvinceId(provinceId);
        pageNavigation?.pushPage({ type: 'regional-commercial', host: 'buildings', provinceId, commercialTypeId: selectedCommercialType.id });
      }}
      onBack={() => { if (activeProvinceId) setActiveProvinceId(null); else setSelectedCommercialTypeId(null); }} />;
  }

  if (activeProvince) {''')
s = replace(s, '      <div className="global-operation-page global-buildings-page" data-global-scope="buildings">\n        <section', '      <div className="global-operation-page global-buildings-page" data-global-scope="buildings">\n        <BuildingTypeFilter value={buildingFilter} onChange={setBuildingFilter} />\n        <section')
s = s.replace('aria-label="全局工厂目录"', 'aria-label="全局建筑目录"').replace('aria-label="跨州工厂汇总"', 'aria-label="跨州建筑汇总"')
s = replace(s, '{facilityRows.length > 0 ? (', '{sortedFacilityRows.length > 0 ? (')
s = replace(s, '<li key={row.buildingTypeId}>', '<li key={`${row.kind}:${row.buildingTypeId}`}>')
s = replace(s, '                      data-quick-production-row={row.quickProduction', '                      data-building-kind={row.kind}\n                      data-quick-production-row={row.quickProduction')
s = replace(s, '''                      <FacilityIcon
                        facilityTypeId={row.buildingTypeId}
                        className="global-facility-catalog-row__artwork"
                      />''', '''                      {row.kind === 'commercial'
                        ? <CommercialBuildingArtwork commercialTypeId={row.buildingTypeId} className="global-facility-catalog-row__artwork" />
                        : <FacilityIcon facilityTypeId={row.buildingTypeId} className="global-facility-catalog-row__artwork" />}''')
s = replace(s, 'aria-label={`打开${row.name}地区工厂，拥有', "aria-label={`打开${row.name}${row.kind === 'commercial' ? '地区商业建筑' : '地区工厂'}，拥有")
s = replace(s, 'onClick={() => openGlobalFacility(row.buildingTypeId)}', "onClick={() => row.kind === 'commercial' ? openGlobalCommercial(row.buildingTypeId) : openGlobalFacility(row.buildingTypeId)}")
p.write_text(s)
