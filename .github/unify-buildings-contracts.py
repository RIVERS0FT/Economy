from pathlib import Path
import re

p = Path('src/styles/commercial-buildings.css')
s = p.read_text().replace('.commercial-building-artwork {', ':where(.commercial-building-artwork) {')
p.write_text(s)

# Structural assertions follow the component that now actually owns the DOM.
p = Path('scripts/verify-runtime-architecture.mjs')
s = p.read_text().replace("for (const target of ['./MarketPage', './BuildingsPage'])", "for (const target of ['./MarketPage', './RegionalBuildingsPage'])")
p.write_text(s)
p = Path('scripts/verify-interaction-modality.mjs')
s = p.read_text().replace("requireText('src/pages/BuildingsPage.tsx', 'className=\"facility-cluster-detail-shell facility-cluster-detail-page\"');", "requireText('src/components/buildings/BuildingDetailPage.tsx', 'facility-cluster-detail-shell facility-cluster-detail-page');\n  requireText('src/pages/BuildingsPage.tsx', '<BuildingDetailPage');\n  requireText('src/pages/CommercePage.tsx', '<BuildingDetailPage');")
p.write_text(s)
p = Path('scripts/verify-product-artwork.mjs')
s = p.read_text().replace("const formulaPath = 'src/components/facilities/FacilityProductionFormula.tsx';", "const formulaPath = 'src/components/buildings/BuildingSettlementProducts.tsx';")
p.write_text(s)
p = Path('scripts/verify-facility-groups.mjs')
s = p.read_text()
old = "const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };"
new = """const requireText = (path, text) => {
  const owners = path === 'src/components/facilities/FacilityProductionFormula.tsx'
    ? [path, 'src/components/buildings/BuildingSettlementPanel.tsx', 'src/components/buildings/BuildingSettlementProducts.tsx'] : [path];
  if (!owners.map(read).join('\n').includes(text)) failures.push(`${path} 缺少: ${text}`);
};""".replace("join('\n')", "join('\\n')")
s = s.replace(old, new)
p.write_text(s)
p = Path('scripts/verify-unified-factory-recipes-grid.mjs')
s = p.read_text().replace('<strong>title={<GameConcept concept="production-settlement" />}</strong>', 'title={<GameConcept concept="production-settlement" />}')
p.write_text(s)

replacements = [
 ('概览｜市场｜商业｜工业｜仓库', '概览｜市场｜建筑｜仓库'),
 ('建筑固定采用“工厂目录 → 工厂地区列表 → 地区工厂详情”的工厂优先钻取', '建筑固定采用“建筑目录 → 建筑地区列表 → 地区建筑详情”的类型优先钻取'),
 ('默认态保持正式工厂目录顺序', '默认态保持正式建筑目录顺序'),
 ('表头允许按工厂名称、平均利润和拥有数量', '表头允许按建筑名称、单座／单厂利润和拥有数量'),
 ('一级建筑只提供工厂类型全局总览与工厂优先地区钻取', '一级建筑只提供建筑类型全局总览与类型优先地区钻取'),
 ('`ProvincePage` 内的市场、商业与工业分区仍始终是地图所打开当前州的本地视图', '`ProvincePage` 内的市场与建筑分区始终是地图所打开当前州的本地视图'),
 ('商业、工业与仓库直接显示本地经营内容', '建筑与仓库直接显示本地经营内容'),
 ('一级市场商品的地区行情列表与一级建筑工厂的地区列表覆盖连续 48 州', '一级市场商品的地区行情列表与一级建筑类型的地区列表覆盖连续 48 州'),
]
for path in ['scripts/verify-page-content.mjs', 'scripts/verify-provincial-economy.mjs', 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md']:
    p = Path(path)
    s = p.read_text()
    for old, new in replacements: s = s.replace(old, new)
    if path.endswith('verify-page-content.mjs'):
        s = s.replace('<EmbeddedCommercePage', '<EmbeddedBuildingsPage')
        s = s.replace('onClick={() => openGlobalFacility(row.facilityTypeId)}', "row.kind === 'commercial' ? openGlobalCommercial(row.buildingTypeId) : openGlobalFacility(row.buildingTypeId)")
        # Preserve quoting of the updated JavaScript assertion.
        s = s.replace("  'row.kind === 'commercial' ? openGlobalCommercial(row.buildingTypeId) : openGlobalFacility(row.buildingTypeId)',", '  "row.kind === \'commercial\' ? openGlobalCommercial(row.buildingTypeId) : openGlobalFacility(row.buildingTypeId)",')
    p.write_text(s)
p = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
s = p.read_text()
if '目录表头固定显示“建筑｜利润｜拥有”' not in s:
    s += '\n统一一级建筑目录表头固定显示“建筑｜利润｜拥有”，末列保留导航箭头。默认态保持正式建筑目录顺序（工业正式目录随后商业正式目录），表头允许按建筑名称、单座／单厂利润和拥有数量排序；同值继续按正式目录稳定排序，不修改数据本身。\n'
p.write_text(s)
p = Path('docs/UI_DESIGN_SYSTEM.md')
s = p.read_text()
if '商业插画基础样式必须使用零优先级' not in s:
    s += '\n商业插画基础样式必须使用零优先级 `:where()` 选择器，为图片本身提供默认尺寸而不覆盖各目录、卡片和详情插画槽的正式宽高；不得通过隐藏页面溢出来掩盖错误的插画尺寸。\n'
p.write_text(s)

# Bound the on-failure diagnostics; regular assertions remain unchanged.
p = Path('tests/browser/unified-buildings.spec.ts')
s = p.read_text()
s = re.sub(r"  for \(const width of widths\) expect\(width\.scroll, JSON\.stringify\(await page\.locator\('\.global-buildings-page'\).*?\.toBeLessThanOrEqual\(width\.client \+ 1\);", "  for (const width of widths) expect(width.scroll).toBeLessThanOrEqual(width.client + 1);", s)
p.write_text(s)
