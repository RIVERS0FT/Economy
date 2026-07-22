from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}: {old[:100]!r}")
    file.write_text(text.replace(old, new, 1))


# Existing V13 construction payments remain historical sinks and do not retroactively create wages.
replace_once(
    'server/src/facility-groups.js',
    "  player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0);\n\n  if (Array.isArray(player.facilities)",
    "  player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0);\n\n"
    "  if (player.facilityConstruction) {\n"
    "    const constructionType = typeFor(player.facilityConstruction.facilityTypeId);\n"
    "    if (constructionType && player.facilityConstruction.buildCost === undefined) {\n"
    "      player.facilityConstruction.buildCost = constructionType.buildCost;\n"
    "      player.facilityConstruction.employmentReleased = constructionType.buildCost;\n"
    "    }\n"
    "  }\n\n"
    "  if (Array.isArray(player.facilities)",
)

# Client public types and V16.
replace_once(
    'src/types.ts',
    "  category: 'raw' | 'processing' | 'consumer' | 'industrial';\n  buildCost: number;",
    "  category: 'raw' | 'processing' | 'consumer' | 'industrial';\n  complexity: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7';\n  buildCost: number;",
)
replace_once(
    'src/types.ts',
    "  completesAt: number;\n}",
    "  completesAt: number;\n  buildCost?: number;\n  employmentReleased?: number;\n}",
)
replace_once(
    'src/types.ts',
    "  giftIssued: number;\n  invitationGemsIssued: number;",
    "  giftIssued: number;\n  gemExchangeCredits: number;\n  populationIncome: number;\n  employmentPayments: number;\n  productionPayroll: number;\n  constructionPayroll: number;\n  warehousePayroll: number;\n  marketServiceFees: number;\n  invitationGemsIssued: number;",
)
replace_once('src/types.ts', '  version: 15;', '  version: 16;')

# Admin API types.
replace_once(
    'src/api/admin.ts',
    "export type ExtendedAdminSummary = AdminSummary & {\n  collectibleCount: number;\n  openAuctionCount: number;\n};",
    "export type PopulationModelId = 'basic' | 'skilled' | 'professional';\n\n"
    "export interface PopulationModelAdminSummary {\n"
    "  id: PopulationModelId;\n"
    "  name: string;\n"
    "  consumptionState: 'normal' | 'cautious' | 'subsistence';\n"
    "  credits: number;\n"
    "  frozenCredits: number;\n"
    "  pendingIncome: Record<'production' | 'construction' | 'warehouse' | 'marketService', number>;\n"
    "  lastIncome: number;\n"
    "  incomeEma: number;\n"
    "  recentPeakIncome: number;\n"
    "  noIncomeCycles: number;\n"
    "  lastBudget: number;\n"
    "  foodBudget: number;\n"
    "  householdBudget: number;\n"
    "  totalIncome: number;\n"
    "  totalSpent: number;\n"
    "}\n\n"
    "export interface PopulationEconomyAdminSummary {\n"
    "  credits: number;\n"
    "  frozenCredits: number;\n"
    "  pendingIncome: number;\n"
    "  lastIncome: number;\n"
    "  lastBudget: number;\n"
    "  totalIncome: number;\n"
    "  totalSpent: number;\n"
    "  constructionEscrow: number;\n"
    "  totalEmploymentIncome: number;\n"
    "  totalConsumption: number;\n"
    "  models: Record<PopulationModelId, PopulationModelAdminSummary>;\n"
    "  sources: Record<'production' | 'construction' | 'warehouse' | 'marketService', number>;\n"
    "  productionByComplexity: Record<'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7', number>;\n"
    "  issuance: { work: number; exchange: number; gift: number; legacyPopulation: number; migration: number; total: number };\n"
    "}\n\n"
    "export type ExtendedAdminSummary = AdminSummary & {\n"
    "  collectibleCount: number;\n"
    "  openAuctionCount: number;\n"
    "  populationEconomy: PopulationEconomyAdminSummary;\n"
    "};",
)

# Admin population panel stays inside the existing overview section.
replace_once(
    'src/app/AdminApp.tsx',
    "function ownershipReason(record: CollectibleOwnershipRecord) {\n  if (record.reason === 'auction') return '拍卖成交';\n  if (record.reason === 'assigned') return '管理员初始分配';\n  return '创建藏品';\n}\n",
    "function ownershipReason(record: CollectibleOwnershipRecord) {\n  if (record.reason === 'auction') return '拍卖成交';\n  if (record.reason === 'assigned') return '管理员初始分配';\n  return '创建藏品';\n}\n\n"
    "function populationStateLabel(state: 'normal' | 'cautious' | 'subsistence') {\n"
    "  if (state === 'cautious') return '谨慎';\n"
    "  if (state === 'subsistence') return '生存';\n"
    "  return '正常';\n"
    "}\n",
)
old_overview = """              {activeSection === 'overview' ? (
                <section className="admin-summary-grid" aria-label="世界概况">
                  <MetricCard label="玩家数量" value={summary?.playerCount ?? '--'} />
                  <MetricCard label="未完成订单" value={summary?.openOrderCount ?? '--'} />
                  <MetricCard label="商品订单" value={summary?.commodityOrderCount ?? '--'} />
                  <MetricCard label="工厂订单" value={summary?.facilityOrderCount ?? '--'} />
                  <MetricCard label="藏品数量" value={summary?.collectibleCount ?? '--'} />
                  <MetricCard label="进行中拍卖" value={summary?.openAuctionCount ?? '--'} />
                  <MetricCard label="世界版本" value={summary?.worldVersion ?? '--'} />
                  <MetricCard label="API 状态" value={summary?.apiStatus ?? '--'} tone={summary?.apiStatus === 'ok' ? 'success' : 'neutral'} />
                </section>
              ) : null}
"""
new_overview = """              {activeSection === 'overview' ? (
                <div className="admin-section-stack">
                  <section className="admin-summary-grid" aria-label="世界概况">
                    <MetricCard label="玩家数量" value={summary?.playerCount ?? '--'} />
                    <MetricCard label="未完成订单" value={summary?.openOrderCount ?? '--'} />
                    <MetricCard label="商品订单" value={summary?.commodityOrderCount ?? '--'} />
                    <MetricCard label="工厂订单" value={summary?.facilityOrderCount ?? '--'} />
                    <MetricCard label="藏品数量" value={summary?.collectibleCount ?? '--'} />
                    <MetricCard label="进行中拍卖" value={summary?.openAuctionCount ?? '--'} />
                    <MetricCard label="世界版本" value={summary?.worldVersion ?? '--'} />
                    <MetricCard label="API 状态" value={summary?.apiStatus ?? '--'} tone={summary?.apiStatus === 'ok' ? 'success' : 'neutral'} />
                  </section>

                  <Panel className="admin-panel admin-population-economy">
                    <WidgetHeading title="人口经济" />
                    {summary?.populationEconomy ? (
                      <>
                        <section className="admin-population-summary-grid" aria-label="人口经济总览">
                          <MetricCard label="人口可用资金" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.credits)}</CurrencyAmount>} />
                          <MetricCard label="人口冻结资金" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.frozenCredits)}</CurrencyAmount>} />
                          <MetricCard label="待结算就业收入" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.pendingIncome)}</CurrencyAmount>} />
                          <MetricCard label="施工就业托管" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.constructionEscrow)}</CurrencyAmount>} />
                          <MetricCard label="累计就业收入" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.totalEmploymentIncome)}</CurrencyAmount>} />
                          <MetricCard label="累计人口消费" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.totalConsumption)}</CurrencyAmount>} />
                          <MetricCard label="本周期消费预算" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.lastBudget)}</CurrencyAmount>} />
                          <MetricCard label="累计货币发行" value={<CurrencyAmount>{formatCurrency(summary.populationEconomy.issuance.total)}</CurrencyAmount>} />
                        </section>

                        <div className="admin-population-model-grid">
                          {Object.values(summary.populationEconomy.models).map((model) => (
                            <section className="admin-population-model-card" key={model.id}>
                              <header><h3>{model.name}</h3><StatusTag tone={model.consumptionState === 'normal' ? 'success' : model.consumptionState === 'cautious' ? 'warning' : 'danger'}>{populationStateLabel(model.consumptionState)}</StatusTag></header>
                              <dl>
                                <div><dt>可用／冻结</dt><dd><CurrencyAmount>{formatCurrency(model.credits)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.frozenCredits)}</CurrencyAmount></dd></div>
                                <div><dt>最近收入／EMA</dt><dd><CurrencyAmount>{formatCurrency(model.lastIncome)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.incomeEma)}</CurrencyAmount></dd></div>
                                <div><dt>当前预算</dt><dd><CurrencyAmount>{formatCurrency(model.lastBudget)}</CurrencyAmount></dd></div>
                                <div><dt>食品／家庭</dt><dd><CurrencyAmount>{formatCurrency(model.foodBudget)}</CurrencyAmount>／<CurrencyAmount>{formatCurrency(model.householdBudget)}</CurrencyAmount></dd></div>
                                <div><dt>连续无收入周期</dt><dd>{model.noIncomeCycles}</dd></div>
                                <div><dt>待结算</dt><dd><CurrencyAmount>{formatCurrency(Object.values(model.pendingIncome).reduce((sum, value) => sum + value, 0))}</CurrencyAmount></dd></div>
                              </dl>
                            </section>
                          ))}
                        </div>

                        <div className="admin-population-detail-grid">
                          <section>
                            <h3>就业收入来源</h3>
                            <dl className="admin-population-source-list">
                              <div><dt>生产运营</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.production)}</CurrencyAmount></dd></div>
                              <div><dt>建造业（固定 60/30/10）</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.construction)}</CurrencyAmount></dd></div>
                              <div><dt>仓库扩容</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.warehouse)}</CurrencyAmount></dd></div>
                              <div><dt>市场服务</dt><dd><CurrencyAmount>{formatCurrency(summary.populationEconomy.sources.marketService)}</CurrencyAmount></dd></div>
                            </dl>
                          </section>
                          <section>
                            <h3>生产工资复杂度</h3>
                            <div className="admin-population-complexity-grid">
                              {Object.entries(summary.populationEconomy.productionByComplexity).map(([complexity, amount]) => (
                                <div key={complexity}><span>{complexity}</span><strong><CurrencyAmount>{formatCurrency(amount)}</CurrencyAmount></strong></div>
                              ))}
                            </div>
                          </section>
                        </div>
                      </>
                    ) : <EmptyState>人口经济数据尚未初始化。</EmptyState>}
                  </Panel>
                </div>
              ) : null}
"""
replace_once('src/app/AdminApp.tsx', old_overview, new_overview)

replace_once(
    'src/styles/unified-market-admin.css',
    ".admin-summary-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: var(--space-3);\n}\n",
    ".admin-summary-grid {\n  display: grid;\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  gap: var(--space-3);\n}\n\n"
    ".admin-population-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--space-3); }\n"
    ".admin-population-model-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }\n"
    ".admin-population-model-card { min-width: 0; display: grid; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-muted); }\n"
    ".admin-population-model-card header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); }\n"
    ".admin-population-model-card h3, .admin-population-detail-grid h3 { margin: 0; font-size: var(--font-size-md); }\n"
    ".admin-population-model-card dl, .admin-population-source-list { display: grid; gap: var(--space-2); margin: 0; }\n"
    ".admin-population-model-card dl > div, .admin-population-source-list > div { display: flex; justify-content: space-between; gap: var(--space-3); }\n"
    ".admin-population-model-card dt, .admin-population-source-list dt { color: var(--text-muted); }\n"
    ".admin-population-model-card dd, .admin-population-source-list dd { margin: 0; text-align: right; }\n"
    ".admin-population-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }\n"
    ".admin-population-detail-grid > section { display: grid; gap: var(--space-3); padding: var(--space-3); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }\n"
    ".admin-population-complexity-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--space-2); }\n"
    ".admin-population-complexity-grid > div { min-width: 0; display: grid; gap: 4px; padding: var(--space-2); border-radius: var(--radius-control); background: var(--surface-muted); text-align: center; }\n"
    ".admin-population-complexity-grid span { color: var(--text-muted); font-size: var(--font-size-sm); }\n"
    ".admin-population-complexity-grid strong { overflow: hidden; text-overflow: ellipsis; }\n",
)
replace_once(
    'src/styles/unified-market-admin.css',
    "  .admin-summary-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }",
    "  .admin-summary-grid,\n  .admin-population-summary-grid {\n    grid-template-columns: repeat(2, minmax(0, 1fr));\n  }\n\n  .admin-population-model-grid { grid-template-columns: 1fr; }\n  .admin-population-complexity-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }",
)
replace_once(
    'src/styles/unified-market-admin.css',
    "  .admin-summary-grid,\n  .admin-form-grid {\n    grid-template-columns: 1fr;\n  }",
    "  .admin-summary-grid,\n  .admin-population-summary-grid,\n  .admin-population-detail-grid,\n  .admin-form-grid {\n    grid-template-columns: 1fr;\n  }\n\n  .admin-population-complexity-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
)

# Exact cumulative fee preview, with no minimum fee or inflation intervention.
replace_once(
    'src/pages/MarketPage.tsx',
    "  const estimatedSellFee = orderSide === 'sell' && orderTotal > 0\n    ? Math.max(1, Math.ceil(orderTotal / 100))\n    : 0;",
    "  const estimatedSellFee = orderSide === 'sell' && orderTotal > 0\n    ? Math.floor(orderTotal / 100)\n    : 0;",
)
replace_once(
    'src/pages/MarketPage.tsx',
    "                <div className=\"order-summary\"><span>预计手续费（1%，最低 1）</span><strong><CurrencyAmount>{formatCurrency(estimatedSellFee)}</CurrencyAmount></strong></div>\n                <div className=\"order-summary\"><span>预计到账</span><strong><CurrencyAmount>{formatCurrency(estimatedNetTotal)}</CurrencyAmount></strong></div>\n                {orderTotal > 0 && estimatedNetTotal === 0 ? <p className=\"order-disabled-reason\">成交额将全部用于支付最低手续费。</p> : null}",
    "                <div className=\"order-summary\"><span>预计手续费（累计成交额的 1%）</span><strong><CurrencyAmount>{formatCurrency(estimatedSellFee)}</CurrencyAmount></strong></div>\n                <div className=\"order-summary\"><span>预计到账</span><strong><CurrencyAmount>{formatCurrency(estimatedNetTotal)}</CurrencyAmount></strong></div>",
)

# Verification expectations for optimized costs and exact fee.
replace_once(
    'scripts/verify-industry-catalog.mjs',
    "const expectedProfitByComplexity = { C1: 1, C2: 3, C3: 6, C4: 9, C5: 12, C6: 15, C7: 18 };",
    "const expectedProfitByComplexity = { C1: 1, C2: 3, C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };",
)
replace_once(
    'scripts/verify-industry-catalog.mjs',
    "assert.deepEqual(facilities.get('beverage-factory').recipes.map((item) => item.operatingCost), [11, 6]);\nassert.equal(facilities.get('furniture-factory').recipes[0].operatingCost, 5);",
    "assert.deepEqual(facilities.get('beverage-factory').recipes.map((item) => item.operatingCost), [14, 9]);\nassert.equal(facilities.get('furniture-factory').recipes[0].operatingCost, 8);",
)
replace_once(
    'scripts/verify-industry-catalog.mjs',
    "    'C1=1、C2=3、C3=6、C4=9、C5=12、C6=15、C7=18',",
    "    'C1=1、C2=3、C3=6、C4=6、C5=8、C6=10、C7=12',",
)
replace_once(
    'scripts/verify-industry-catalog.mjs',
    "console.log('产业目录验证通过：31 种商品、21 种工厂、C1～C7 建设复杂度、精确建造费与施工时间、配方级参数及 1/3/6/9/12/15/18 参考分钟利润梯度。');",
    "console.log('产业目录验证通过：31 种商品、21 种工厂、C1～C7 建设复杂度、精确建造费与施工时间、配方级参数及 1/3/6/6/8/10/12 参考分钟利润梯度。');",
)
replace_once('scripts/verify-market-sell-fee.mjs', "  'MARKET_SELL_FEE_MINIMUM = 1',", "  'MARKET_SELL_FEE_MINIMUM = 0',")
replace_once('scripts/verify-market-sell-fee.mjs', "  'Math.ceil(normalizedGross * MARKET_SELL_FEE_RATE_BPS / BASIS_POINTS)',", "  'Math.floor(normalizedGross * MARKET_SELL_FEE_RATE_BPS / BASIS_POINTS)',")
replace_once('scripts/verify-market-sell-fee.mjs', "for (const text of ['预计手续费（1%，最低 1）', '预计到账', '手续费 / 实收']) {", "for (const text of ['预计手续费（累计成交额的 1%）', '预计到账', '手续费 / 实收']) {")

# Updated server tests.
replace_once("server/test/warehouse.test.js", "test('warehouse state defaults to level 1 and client version 14',", "test('warehouse state defaults to level 1 and client version 16',")
replace_once("server/test/warehouse.test.js", "    assert.equal(state.version, 15);", "    assert.equal(state.version, 16);")
replace_once("server/test/warehouse.test.js", "    assert.equal(state.stats.systemSinks, 150);", "    assert.equal(state.stats.systemSinks, 0);\n    assert.equal(state.stats.warehousePayroll, 150);\n    assert.equal(state.stats.employmentPayments, 150);")
replace_once("server/test/warehouse.test.js", "    assert.equal(state.stats.systemSinks, 480);", "    assert.equal(state.stats.systemSinks, 0);\n    assert.equal(state.stats.warehousePayroll, 480);\n    assert.equal(state.stats.employmentPayments, 480);")

fee_test = Path('server/test/market-sell-fee.test.js')
text = fee_test.read_text()
text = text.replace("test('累计卖出手续费按 1% 向上取整且最低为 1',", "test('累计卖出手续费按成交总额精确收取 1%',")
text = text.replace("  assert.equal(calculateCumulativeMarketSellFee(1), 1);", "  assert.equal(calculateCumulativeMarketSellFee(1), 0);")
text = text.replace("  assert.equal(calculateCumulativeMarketSellFee(101), 2);", "  assert.equal(calculateCumulativeMarketSellFee(101), 1);")
text = text.replace("  assert.deepEqual(next, { fee: 1, netTotal: 0 });", "  assert.deepEqual(next, { fee: 0, netTotal: 1 });")
text = text.replace("  assert.equal(order.marketSellFeeCharged, 1);", "  assert.equal(order.marketSellFeeCharged, 0);", 1)
text = text.replace("  assert.deepEqual(order.fills.map((fill) => fill.fee), [1, 0, 0, 1]);", "  assert.deepEqual(order.fills.map((fill) => fill.fee), [0, 0, 1, 0]);")
text = text.replace("  assert.deepEqual(order.fills.map((fill) => fill.netTotal), [29, 30, 40, 0]);", "  assert.deepEqual(order.fills.map((fill) => fill.netTotal), [30, 30, 39, 1]);")
text = text.replace("  assert.equal(order.marketSellFeeCharged, 2);", "  assert.equal(order.marketSellFeeCharged, 1);")
text = text.replace("  assert.equal(seller.credits, 99);\n  assert.equal(seller.stats.systemSinks, 2);", "  assert.equal(seller.credits, 100);\n  assert.equal(seller.stats.systemSinks, 0);\n  assert.equal(seller.stats.marketServiceFees, 1);\n  assert.equal(seller.stats.employmentPayments, 1);")
text = text.replace("  assert.equal(seller.credits, 158);\n  assert.equal(seller.stats.systemSinks, 2);", "  assert.equal(seller.credits, 159);\n  assert.equal(seller.stats.systemSinks, 0);\n  assert.equal(seller.stats.marketServiceFees, 1);")
text = text.replace("  assert.equal(internal.fills[0].fee, 2);\n  assert.equal(internal.fills[0].netTotal, 158);", "  assert.equal(internal.fills[0].fee, 1);\n  assert.equal(internal.fills[0].netTotal, 159);")
text = text.replace("  assert.equal(publicOrder.fills[0].fee, 2);\n  assert.equal(publicOrder.fills[0].netTotal, 158);", "  assert.equal(publicOrder.fills[0].fee, 1);\n  assert.equal(publicOrder.fills[0].netTotal, 159);")
fee_test.write_text(text)

# Admin browser fixture includes the new read-only overview payload.
replace_once(
    'tests/browser/admin-runtime.spec.ts',
    "        worldVersion: 13,\n        revision: 120,\n        lastProcessedAt: Date.UTC(2026, 6, 19, 10),\n        apiStatus: 'ok',",
    "        worldVersion: 14,\n        revision: 120,\n        lastProcessedAt: Date.UTC(2026, 6, 19, 10),\n        apiStatus: 'ok',\n"
    "        populationEconomy: {\n"
    "          credits: 5_000, frozenCredits: 500, pendingIncome: 300, lastIncome: 200, lastBudget: 1_000,\n"
    "          totalIncome: 10_000, totalSpent: 5_000, constructionEscrow: 250, totalEmploymentIncome: 8_000, totalConsumption: 5_000,\n"
    "          models: {\n"
    "            basic: { id: 'basic', name: '基础人口', consumptionState: 'normal', credits: 3_000, frozenCredits: 300, pendingIncome: { production: 100, construction: 50, warehouse: 20, marketService: 10 }, lastIncome: 120, incomeEma: 110, recentPeakIncome: 130, noIncomeCycles: 0, lastBudget: 600, foodBudget: 468, householdBudget: 132, totalIncome: 6_000, totalSpent: 3_000 },\n"
    "            skilled: { id: 'skilled', name: '技术人口', consumptionState: 'cautious', credits: 1_500, frozenCredits: 150, pendingIncome: { production: 60, construction: 20, warehouse: 10, marketService: 10 }, lastIncome: 60, incomeEma: 70, recentPeakIncome: 100, noIncomeCycles: 1, lastBudget: 300, foodBudget: 219, householdBudget: 81, totalIncome: 3_000, totalSpent: 1_500 },\n"
    "            professional: { id: 'professional', name: '专业人口', consumptionState: 'subsistence', credits: 500, frozenCredits: 50, pendingIncome: { production: 10, construction: 5, warehouse: 3, marketService: 2 }, lastIncome: 20, incomeEma: 20, recentPeakIncome: 100, noIncomeCycles: 2, lastBudget: 100, foodBudget: 85, householdBudget: 15, totalIncome: 1_000, totalSpent: 500 },\n"
    "          },\n"
    "          sources: { production: 4_000, construction: 2_000, warehouse: 1_000, marketService: 1_000 },\n"
    "          productionByComplexity: { C1: 500, C2: 500, C3: 500, C4: 500, C5: 500, C6: 500, C7: 1_000 },\n"
    "          issuance: { work: 20_000, exchange: 5_000, gift: 1_000, legacyPopulation: 0, migration: 5_700, total: 31_700 },\n"
    "        },",
)
replace_once(
    'tests/browser/admin-runtime.spec.ts',
    "  await expect(page.locator('.admin-summary-grid .ui-metric-card')).toHaveCount(8);",
    "  await expect(page.locator('.admin-summary-grid .ui-metric-card')).toHaveCount(8);\n  await expect(page.getByRole('heading', { name: '人口经济', exact: true })).toBeVisible();\n  await expect(page.locator('.admin-population-model-card')).toHaveCount(3);",
)

# Dedicated population economy invariants.
Path('server/test/population-economy.test.js').write_text("""import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import {
  creditPopulationEmployment,
  ensurePopulationEconomy,
  populationModelState,
  releaseConstructionEmployment,
  releasePopulationOrderFunds,
  reservePopulationOrder,
  settlePopulationPurchase,
} from '../src/population-economy.js';

const now = 1_700_000_000_000;

function resetPopulation(world) {
  const state = ensurePopulationEconomy(world, now);
  for (const model of Object.values(state.models)) {
    model.credits = 0;
    model.frozenCredits = 0;
    model.pendingIncome = { production: 0, construction: 0, warehouse: 0, marketService: 0 };
    model.totalIncome = 0;
    model.totalSpent = 0;
  }
  return state;
}

test('production employment uses factory complexity and preserves every integer credit', () => {
  const world = createWorld(now);
  const state = resetPopulation(world);
  const allocation = creditPopulationEmployment(world, 100, 'production', { complexity: 'C7' });
  assert.deepEqual(allocation, { basic: 5, skilled: 25, professional: 70 });
  assert.equal(state.models.basic.pendingIncome.production, 5);
  assert.equal(state.models.skilled.pendingIncome.production, 25);
  assert.equal(state.models.professional.pendingIncome.production, 70);
});

test('construction employment is fixed at 60/30/10 and ignores factory complexity', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const low = creditPopulationEmployment(world, 100, 'construction', { complexity: 'C1' });
  const high = creditPopulationEmployment(world, 100, 'construction', { complexity: 'C7' });
  assert.deepEqual(low, { basic: 60, skilled: 30, professional: 10 });
  assert.deepEqual(high, low);
});

test('construction escrow releases by progress without creating or deleting money', () => {
  const world = createWorld(now);
  const state = resetPopulation(world);
  const construction = { buildCost: 100, startedAt: now, completesAt: now + 1_000, employmentReleased: 0 };
  assert.equal(releaseConstructionEmployment(world, construction, now + 500), 50);
  assert.equal(construction.employmentReleased, 50);
  assert.equal(Object.values(state.models).reduce((sum, model) => sum + Object.values(model.pendingIncome).reduce((inner, value) => inner + value, 0), 0), 50);
  assert.equal(releaseConstructionEmployment(world, construction, now + 1_000), 50);
  assert.equal(construction.employmentReleased, 100);
});

test('population buy orders use real escrow and refund price improvement and cancellation', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = populationModelState(world, 'basic');
  model.credits = 100;
  assert.equal(reservePopulationOrder(world, 'basic', 50), true);
  assert.equal(model.credits, 50);
  assert.equal(model.frozenCredits, 50);
  const order = { populationModelId: 'basic', price: 10, remaining: 5 };
  settlePopulationPurchase(world, order, 3, 8);
  assert.equal(model.credits, 56);
  assert.equal(model.frozenCredits, 20);
  assert.equal(model.totalSpent, 24);
  assert.equal(releasePopulationOrderFunds(world, order, 2), 20);
  assert.equal(model.credits, 76);
  assert.equal(model.frozenCredits, 0);
  assert.equal(model.credits + model.totalSpent, 100);
});
""")

Path('scripts/apply-population-economy-v7-ui-tests.py').unlink()
Path('.github/workflows/apply-population-economy-v7-ui-tests.yml').unlink()
