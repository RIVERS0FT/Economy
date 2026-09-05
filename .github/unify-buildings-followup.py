from pathlib import Path
import re


def edit(path, before, after):
    p = Path(path)
    s = p.read_text()
    assert before in s, (path, before[:100])
    p.write_text(s.replace(before, after))


marker = Path('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md')
if '## 5. 统一建筑目录与详情' not in marker.read_text():
    p = marker
    s = p.read_text()
    for a, b in [
        ('概览、市场、商业、工业和仓库五个当前州经营分区', '概览、市场、建筑和仓库四个当前州经营分区'),
        ('概览｜市场｜商业｜工业｜仓库', '概览｜市场｜建筑｜仓库'),
        ('自动经营策略与玩家可见执行解释唯一归地区 `BuildingsPage` 工厂详情', '自动经营策略与玩家可见执行解释归地区建筑详情'),
        ('连续 48 州的工厂类型汇总、跨州平均利润、图标式快捷生产设置与工厂优先地区钻取；实际建设、运行和完整生产配置继续由地区 `BuildingsPage` 执行；工厂所有权交易唯一由拍卖页执行', '连续 48 州工业与商业建筑的分类筛选、类型汇总和地区钻取；工业保留图标式快捷生产设置，商业不附加工厂配置；实际建设与经营由地区统一建筑页及共享详情承载，工厂所有权交易仍归拍卖'),
        ('建筑固定采用“工厂目录 → 工厂地区列表 → 地区工厂详情”的工厂优先钻取', '建筑固定采用“建筑目录 → 建筑地区列表 → 地区建筑详情”的类型优先钻取'),
        ('`ProvincePage` 内的市场、商业与工业分区仍始终是地图所打开当前州的本地视图；“工业”只替换地区分区玩家可见名称，技术 section ID 继续使用 `buildings`', '`ProvincePage` 内的市场与建筑分区始终是地图所打开当前州的本地视图；统一建筑分区的技术 section ID 继续使用 `buildings`，旧 `commerce` 位置只兼容映射到建筑，不再形成可见分区'),
        ('商业、工业与仓库直接显示本地经营内容', '建筑与仓库直接显示本地经营内容'),
        ('自动经营策略与玩家可见执行解释继续只在地区工厂详情显示', '自动经营策略与玩家可见执行解释在对应地区建筑详情显示'),
        ('一级建筑工厂的地区列表', '一级建筑类型的地区列表'),
        ('商业分区只承担当前州商业建筑建设、营业与消费商品解释', '商业适配器只承担当前州商业建筑建设、营业与消费商品解释'),
        ('市场、商业、工业', '市场、建筑'),
        ('技术 section ID 不迁移', '建筑分区继续使用 `buildings`，旧商业分区兼容映射到建筑'),
    ]:
        s = s.replace(a, b)
    a = s.index('商业详情按建筑摘要、经营收益、商品消耗、累计经营排列。')
    b = s.index('\n\n### 1.1', a)
    s = s[:a] + '''商业详情按建筑摘要、自动经营、经营结算、经营收益和累计经营排列。摘要展示总数量、本周期参与数量、营业状态、单座稳定利润与营业意图开关；营业开关与自动经营开关分开，请求期间防止重复提交，失败可见且保持服务器状态。经营结算复用工厂投入／产出、周期成本与进度布局：商业投入为消费商品，结果为营业收入。运行中只读服务器锁定商品明细、商品价值、运营成本、收入和利润；未运行时按全部建筑和本州官方价预估下一周期，明确标记预计，缺少官方价显示未知。旧周期缺失的锁定明细不得用当前值补齐。商品项显示正式插画、消费数量和本地库存，点击进入同州商品详情并可返回，不执行隐式采购。累计保留营业收入、稳定利润及消费数量。不得为样式一致新增工业满员率、生产配置或无意义的零值资产字段。''' + s[b:]
    a = s.index('## 5.')
    b = s.index('### 5.4', a)
    old_section = s[a:b]
    construction = old_section[old_section.index('必须显示工厂类型、'):old_section.index('### 5.3')]
    s = s[:a] + '''## 5. 统一建筑目录与详情

一级建筑页汇总连续 48 州已拥有的工业与商业建筑，默认合并显示，两领域使用带类型标记的只读展示行，不把商业转换为工厂业务模型。同类型跨州合计数量，点击类型进入其实际持有地区列表，再进入该州详情；未持有类型不创建空行。工业继续保留既有平均利润口径、排序和快捷生产配置，商业显示单座稳定利润，不带工业快捷配置。

### 5.1 建筑筛选与地区目录

一级建筑目录与地区建筑目录共用商品页同款折叠筛选，默认全部，候选固定为“全部／商业建筑／工业建筑”。分类与排序只派生展示，不改变当前经营州、资产、经营状态或经济参数。无匹配项显示“没有符合当前筛选条件的建筑”，不得误报为未拥有任何建筑。地区页使用一个混合已拥有建筑网格和各自建设区，不再分别建立商业与工业导航分区；筛选同时决定显示哪类建设区。

两类卡片保持名称、单座／单厂利润和拥有数量语义；整卡进入二级详情，列表与详情不同时展示。几何、状态和布局唯一引用 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`，不重复定义断点或限宽。页面返回恢复原类型／地区列表，地区标题继续使用通用页面栈。商业全局位置使用 `global-commercial`；`regional-commercial` 明确标记 `province` 或 `buildings` 宿主页，未标記宿主的旧位置按地区页处理。

建筑详情不提供资产即时交易或从属订单簿；工厂所有权交易仍归一级拍卖。仓库库存唯一归地区仓库分区，自动经营策略与执行解释归对应地区建筑详情，商品详情不另设自动经营执行卡。库存、执行链路和运输规则归 `WAREHOUSE_EXPANSION_DESIGN.md`。

### 5.2 建设

建设区按筛选显示工业或商业建设表单，两类使用各自类型和数量草稿，不因商品或筛选切换而互相改写。建设区位于已拥有列表之前，不复制卡片的业务详情。商业即时建设规则归 `COMMERCIAL_BUILDINGS_DESIGN.md`，工业建设保持以下既有规则。

''' + construction + '''### 5.3 共享建筑详情

工业与商业详情统一由 `BuildingDetailPage` 承载标题、返回和正文表面，内部由各自业务适配器提供摘要、自动经营和结算内容；不得保留两套详情页面壳、专用工厂 Sheet 或独立滚动根。工业保留总数量、运行／冻结／抵押数量、单厂平均利润、满员率、生产产物与作业制度、原料保障、生产结算及既定诊断；商业内容采用本文件“商业建筑卡片与详情”的字段，不引入工业资产资格。

工厂生产公式继续展示集群输入、输出、周期和成本。运行中使用 `participatingCount`、实时投影的 `staffingRateBps` 与 `staffingBatchCarryBps` 计算当前预览；停止或异常使用 `productionAvailableCount` 和同一实时投影口径。服务器在准确完成时刻重新计算结算值，客户端预览不是权威。输入、输出和成本按整数等效产能计算，周期不乘数量，`group.count` 不作为工业公式乘数。商业已锁定周期遵守独立业务规则，不使用工业产能算法。

''' + s[b:]
    p.write_text(s)
    p = Path('docs/UI_DESIGN_SYSTEM.md')
    s = p.read_text()
    s += '''
### 共享建筑组件边界

工业与商业通过 `BuildingDetailPage` 共用真实页面承载、标题和返回，业务适配器只提供内容与操作，不复制第二套页面壳。`BuildingAutoOperationSection` 共用同一行的“自动经营”和开关及反馈区；`BuildingSettlementPanel` 共用投入／结果、周期成本带和进度结构，`BuildingSettlementProducts` 共用商品插画、数量、本地库存及同州商品导航。公共组件不计算利润、不执行采购、不转换业务类型。`BuildingTypeFilter` 复用商品筛选的原生 disclosure、按钮、选中状态和样式，不新增独立筛选外观。页面字段归 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`，局部几何归 `PRODUCTION_PILL_ALIGNMENT_DESIGN.md`。
'''
    p.write_text(s)
    p = Path('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md')
    s = p.read_text().replace('商业详情共用 `MobileDetailSummary`', '商业与工业详情统一使用 `BuildingDetailPage`，共用 `MobileDetailSummary`')
    s += '\n两类详情的自动经营与结算分别共用 `BuildingAutoOperationSection` 和 `BuildingSettlementPanel`；地区已拥有列表只保留一张混合网格，沿用本文的三列 4:5 规则。商业收入替代工业产出槽的内容，不另设结算几何。\n'
    p.write_text(s)
    p = Path('docs/WAREHOUSE_EXPANSION_DESIGN.md')
    s = p.read_text().replace('工厂详情是自动经营策略与执行解释的唯一玩家界面', '工业和商业详情是各自自动经营策略与执行解释的唯一玩家界面')
    s = s.replace('工厂详情是玩家可编辑自动经营策略的唯一界面', '工业和商业详情分别是其自动经营策略的编辑界面')
    s += '''
## 商业自动经营与共享库存保障

商业自动经营复用已有在线商品级执行链路，不新增商品级玩家策略、轮询或离线后台采购。策略为 `enabled` 与 `inputCoverageCycles: 1 | 2 | 3 | 5`；新旧未配置集群默认自动经营开启、商品保障两个营业周期，默认值由共享只读策略函数提供，不因投影读取回写存档。营业开关与自动经营开关独立，两者均开启且拥有数量为正时才派生商业采购。配置保存必须重新校验本州集群所有权和严格参数，失败不改变原策略。

商业消费需求按下一周期全部建筑数计算。每个营业开启的商业集群先保留一个下一周期需求，即使其自动经营关闭也不允许工业自动出售侵占该需求；自动经营开启时另保护 `需求 × (保障周期数 - 1)`。同州同商品的工业基本需求、商业基本需求、额外周期保障和合同可用保留合并计算，采购只补总保障减去现有可用库存的缺口；基本需求不重复计入目标自由库存，额外周期保护同时成为自动出售的最低保留。这里的保留只用于自由库存计算，不增加实际冻结，不是内部仓库。

商业采购价格上限沿用工业均衡策略的现有阈值，多来源继续合并最高采购上限。真实执行仍受当日官方价、资金、库存、合同和现有幂等事务限制；价格超过上限或资金不足不强行成交。商业没有产成品，不派生自动出售；关闭自动经营不修改营业意图和已投入周期，停止营业则解除该集群下一周期采购／保留。不同州不合并需求、不隐式取货；只有实际市场采购写入成交量，营业扣货与周期结算不写成交量。
'''
    p.write_text(s)
    p = Path('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md')
    s = p.read_text().replace('按州保存的商业建筑集群、营业意图、已投入周期锁定收入、消费商品累计与商业结算审计', '按州保存的商业建筑集群、营业意图、自动经营策略、已投入周期锁定收入及商品／成本明细、消费商品累计与商业结算审计')
    s += '\n商业自动经营策略与可选周期锁定明细随 `commercialBuildingGroups` 交付到 `player.production`，目录保持 `catalog` 归属。新增可选字段不改变状态版本或旧周期金额。设置复用现有 `commercialBuilding` 幂等动作的 `auto-operation` 操作，服务器校验玩家、本州集群所有权及策略。真实采购仍经既有在线交易事务，禁止新增后台扫描；旧在途周期缺失明细不按当前目录、价格或数量追填。业务规则引用 `COMMERCIAL_BUILDINGS_DESIGN.md`，保障策略引用 `WAREHOUSE_EXPANSION_DESIGN.md`。\n'
    p.write_text(s)

    edit('src/styles/province-page.css', 'repeat(5, minmax(0, 1fr))', 'repeat(4, minmax(0, 1fr))')
    edit('src/components/commercial/CommercialBuildingDetail.tsx', 'outputLabel={settlement.label}', "outputLabel={settlement.locked ? '锁定收入' : '预计收入'}")
    edit('src/components/commercial/CommercialBuildingDetail.tsx', 'cycleMs={type.cycleMs} operatingCost=', "cycleMs={settlement.locked && typeof group.cycleStartedAt === 'number' && typeof group.cycleCompletesAt === 'number' && group.cycleCompletesAt > group.cycleStartedAt ? group.cycleCompletesAt - group.cycleStartedAt : type.cycleMs} operatingCost=")
    p = Path('src/pages/GlobalCommercialBuildingPage.tsx')
    s = p.read_text().replace('commercialProfitPerMinute, commercialStatusLabel', 'COMMERCIAL_STATUS_LABELS, commercialProfitPerMinute, commercialStatusLabel')
    s = s.replace('<strong className="global-facility-region-row__status">{commercialStatusLabel(group)}</strong>', '<strong className="global-facility-region-row__status" title={commercialStatusLabel(group)}>{COMMERCIAL_STATUS_LABELS[group.status]}</strong>')
    p.write_text(s)
    p = Path('src/styles/global-operation-pages.css')
    p.write_text(p.read_text() + '''
/* Commercial rows have no industrial quick-control track. */
.global-facility-catalog-row[data-building-kind='commercial'] .global-facility-catalog-row__open {
  grid-row: 1 / -1;
}
.entity-list-row.global-facility-region-row[data-building-kind='commercial'] {
  grid-template-rows: minmax(44px, auto);
}
''')

    # Old source contracts move to the actual shared owner, retaining geometry assertions.
    for path in ['scripts/verify-unified-factory-recipes-grid.mjs', 'scripts/verify-production-desktop-layout.mjs']:
        p = Path(path)
        s = p.read_text().replace("read('src/pages/BuildingsPage.tsx')", "(read('src/pages/BuildingsPage.tsx') + '\\n' + read('src/components/buildings/BuildingDetailPage.tsx'))")
        s = s.replace('className="facility-cluster-detail-shell facility-cluster-detail-page"', 'facility-cluster-detail-shell facility-cluster-detail-page')
        s = s.replace('className="production-surface facility-card facility-group-card facility-cluster-detail-card"', 'production-surface facility-card facility-group-card facility-cluster-detail-card')
        s = s.replace("read('src/components/facilities/FacilityProductionFormula.tsx')", "(read('src/components/facilities/FacilityProductionFormula.tsx') + '\\n' + read('src/components/buildings/BuildingSettlementPanel.tsx') + '\\n' + read('src/components/buildings/BuildingSettlementProducts.tsx'))")
        s = s.replace('<GameConcept concept="production-settlement" />', 'title={<GameConcept concept="production-settlement" />}')
        p.write_text(s)
    p = Path('scripts/verify-production-settlement-layout.mjs')
    s = p.read_text().replace("const formula = read('src/components/facilities/FacilityProductionFormula.tsx');", "const formula = [read('src/components/facilities/FacilityProductionFormula.tsx'), read('src/components/buildings/BuildingSettlementPanel.tsx'), read('src/components/buildings/BuildingSettlementProducts.tsx')].join('\\n');")
    s = s.replace('data-status={group.status}', 'data-status={status}')
    s = s.replace('aria-label={`查看${productName}本地商品详情，生产数量 ${formatNumber(quantity)}，仓库可用 ${formatNumber(warehouseQuantity)}`}', 'quantityLabel = \'生产数量\'')
    # Use a double-quoted literal because the default label contains quotes.
    s = s.replace("  'quantityLabel = '生产数量'',", '  "quantityLabel = \'生产数量\'",')
    s = s.replace('<strong>{<CompactNumber value={quantity} />}</strong>', '<strong><CompactNumber value={quantity} /></strong>')
    p.write_text(s)
    p = Path('scripts/verify-online-auto-sell.mjs')
    s = p.read_text().replace('productionReservedQuantitiesForPlayer', 'buildingReservedQuantitiesForPlayer')
    s = s.replace('工厂详情是自动经营策略与执行解释的唯一玩家界面', '工业和商业详情是各自自动经营策略与执行解释的唯一玩家界面')
    s = s.replace('if (failures.length) {', "requireText('server/src/building-input-reservations.js', 'productionReservedQuantitiesForPlayer(world, userId, provinceId)');\nrequireText('server/src/building-input-reservations.js', 'commercialInputReservations');\n\nif (failures.length) {")
    p.write_text(s)
    p = Path('scripts/verify-provincial-economy.mjs')
    s = p.read_text().replace("  \"{ id: 'commerce', label: '商业' }\",\n", '')
    s = s.replace("{ id: 'buildings', label: '工业' }", "{ id: 'buildings', label: '建筑' }")
    s = s.replace('EmbeddedCommercePage', 'EmbeddedBuildingsPage').replace('repeat(5, minmax(0, 1fr))', 'repeat(4, minmax(0, 1fr))')
    p.write_text(s)
    p = Path('scripts/verify-commercial-buildings.mjs')
    s = p.read_text().replace("const commerce = read('src/pages/CommercePage.tsx');", "const commerce = read('src/pages/CommercePage.tsx') + read('src/components/buildings/BuildingDetailPage.tsx');")
    a = s.index('const marketIndex =')
    b = s.index('assert.ok(navigation.includes(', a)
    s = s[:a] + '''const marketIndex = province.indexOf("{ id: 'market', label: '市场' }");
const buildingsIndex = province.indexOf("{ id: 'buildings', label: '建筑' }");
assert.ok(marketIndex >= 0 && buildingsIndex > marketIndex, '地区导航必须保持市场 / 建筑顺序');
assert.equal(province.includes("{ id: 'commerce', label: '商业' }"), false, '商业不再使用独立分区');
assert.ok(provinceCss.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'), '地区四分区必须等宽');
''' + s[b:]
    s = s.replace("  '概览｜市场｜商业｜工业｜仓库',", "  '概览｜市场｜建筑｜仓库',")
    s = s.replace("  '技术 section ID 不迁移',", "  '统一建筑目录',")
    s = s.replace("  '`CommercePage`',", "  '商业建筑卡片与详情',")
    s += '''
for (const path of ['src/pages/GlobalBuildingsPage.tsx', 'src/pages/RegionalBuildingsPage.tsx']) {
  assert.ok(read(path).includes('<BuildingTypeFilter'));
  assert.ok(read(path).includes('commercialBuildingGroups'));
}
const buildingFilter = read('src/components/buildings/BuildingTypeFilter.tsx');
for (const token of ['global-market-filter-disclosure', 'global-market-filter-button', '全部', '商业建筑', '工业建筑', 'aria-pressed']) assert.ok(buildingFilter.includes(token));
'''
    p.write_text(s)
    for p in Path('tests/browser').glob('*.spec.ts'):
        s = p.read_text()
        s = s.replace("getByRole('tab', { name: '工业', exact: true })", "getByRole('tab', { name: '建筑', exact: true })")
        s = re.sub(r"(getByRole\('tab', \{ name: '商业', exact: true \}\)\)\)\.toBeVisible\(\);)", r"getByRole('tab', { name: '商业', exact: true }))).toHaveCount(0);", s)
        s = s.replace("provinceTabs.getByRole('tab')).toHaveCount(5)", "provinceTabs.getByRole('tab')).toHaveCount(4)")
        p.write_text(s)
    edit('server/test/online-auto-sell.test.js', '当前工厂策略无需自动出售该商品', '当前建筑策略无需自动出售该商品')
    p = Path('tests/browser/commercial-buildings-layout.spec.ts')
    s = p.read_text().replace('.commercial-consumption-item[data-shortage="true"]', '.commercial-settlement .facility-formula-item-group[data-shortage="true"]')
    s = s.replace("await expect(page.locator('.commercial-consumption-item').first()).toContainText('库存不足');", "await expect(page.locator('.commercial-settlement .facility-formula-item-group').first()).toHaveAttribute('aria-label', /库存不足/);")
    s = s.replace("await expect(page.locator('.commercial-consumption-item button')).toHaveCount(0);", "await expect(page.locator('.commercial-settlement button.facility-formula-item-group')).toHaveCount(2);")
    p.write_text(s)
    p = Path('tests/browser/runtime-harness.tsx')
    s = p.read_text()
    s = s.replace('pendingRevenue: 101.25, pendingProfit: 5, pendingGoodsConsumed: 4,', '''pendingRevenue: 101.25, pendingProfit: 5, pendingGoodsConsumed: 4,
    pendingOperatingCost: 3, pendingInputValue: 93.25,
    pendingInputs: type.consumptionInputs.map((input) => ({ ...input, quantity: input.quantity * 2 })),''')
    p.write_text(s)
