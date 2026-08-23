from __future__ import annotations

from pathlib import Path
import re

ROOT = Path.cwd()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    text = read(path)
    actual = text.count(old)
    if actual != count:
        raise RuntimeError(f'{path}: expected {count} occurrences, found {actual}: {old[:100]!r}')
    write(path, text.replace(old, new))


def replace_regex(path: str, pattern: str, replacement: str, count: int = 1) -> None:
    text = read(path)
    updated, actual = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if actual != count:
        raise RuntimeError(f'{path}: expected {count} regex replacements, found {actual}: {pattern[:100]!r}')
    write(path, updated)


def replace_between(path: str, start: str, end: str, replacement: str) -> None:
    text = read(path)
    start_index = text.find(start)
    if start_index < 0:
        raise RuntimeError(f'{path}: start marker not found: {start!r}')
    end_index = text.find(end, start_index)
    if end_index < 0:
        raise RuntimeError(f'{path}: end marker not found: {end!r}')
    write(path, text[:start_index] + replacement + text[end_index:])


# Shared regional entity page title: entity first, full region second in muted gray,
# while keeping the existing PageLayout title track height unchanged.
write('src/components/ui/RegionalEntityPageTitle.tsx', '''interface RegionalEntityPageTitleProps {
  entityName: string;
  regionName: string;
  className?: string;
}

export function RegionalEntityPageTitle({
  entityName,
  regionName,
  className = '',
}: RegionalEntityPageTitleProps) {
  return (
    <span
      className={`regional-entity-title ${className}`.trim()}
      data-regional-entity-title="true"
      aria-label={`${entityName}，${regionName}`}
    >
      <span className="regional-entity-title__name" aria-hidden="true">{entityName}</span>
      <span className="regional-entity-title__region" aria-hidden="true">{regionName}</span>
    </span>
  );
}
''')

write('src/styles/regional-entity-page-title.css', '''/* Shared two-line title for region-scoped entity detail pages.
 * The wrapper is constrained to the existing 40px PageLayout title track so
 * commodity/factory details never increase fixed-header height. */
.regional-entity-title {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 40px;
  display: grid;
  grid-template-rows: 22px 13px;
  align-content: center;
  justify-items: center;
  gap: 1px;
  overflow: hidden;
  line-height: 1;
}

.regional-entity-title__name,
.regional-entity-title__region {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.regional-entity-title__name {
  color: var(--color-text-primary);
  font-size: clamp(1.05rem, 1.5vw, 1.25rem);
  font-weight: 850;
  line-height: 22px;
  letter-spacing: -0.03em;
}

.regional-entity-title__region {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: 650;
  line-height: 13px;
  letter-spacing: 0;
}

/* Keep compatibility with the existing factory-detail class while the shared
 * regional entity title owns its internal two-line layout. */
.regional-entity-title.province-facility-detail-title {
  display: grid;
  font-size: inherit;
  line-height: 1;
}

@media (max-width: 720px) {
  .regional-entity-title__name {
    font-size: 1.05rem;
  }
}
''')

replace_exact(
    'src/main.tsx',
    "import './styles/production-surface.css';\n",
    "import './styles/production-surface.css';\nimport './styles/regional-entity-page-title.css';\n",
)

# Initial session/view should expose the persistent strategic map, not open overview.
replace_exact('src/app/gameViewModel.ts', "const [tab, setActiveTab] = useState<TabId>('home');", "const [tab, setActiveTab] = useState<TabId>('map');")
replace_exact('src/app/LocalGamePreviewApp.tsx', "const [tab, setTabState] = useState<TabId>('home');", "const [tab, setTabState] = useState<TabId>('map');")

# MarketPage: catalog becomes a direct content list; auto-trade moves into commodity detail.
replace_exact(
    'src/pages/MarketPage.tsx',
    "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\n",
    "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';\n",
)
replace_exact(
    'src/pages/MarketPage.tsx',
    "  const [catalogWorkspace, setCatalogWorkspace] = useState<'overview' | 'auto-trade'>('overview');\n",
    '',
)
replace_exact(
    'src/pages/MarketPage.tsx',
    '''  useEffect(() => {
    const openRequestedAutoTrade = (productId: string) => {
      if (!game.products.some((product) => product.id === productId)) return;
      setRequestedAutoTradeProductId(productId);
      setCatalogWorkspace('auto-trade');
    };
    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested) openRequestedAutoTrade(requested);
    const handlePanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: number; productId?: string }>).detail;
      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      openRequestedAutoTrade(detail.productId);
    };
    window.addEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
    return () => window.removeEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
  }, [game.products, model.user.id]);
''',
    '''  useEffect(() => {
    const openRequestedAutoTrade = (productId: string) => {
      if (!game.products.some((product) => product.id === productId)) return;
      setRequestedAutoTradeProductId(productId);
      selectMarketAsset('commodity', productId, !embedded);
    };
    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested) openRequestedAutoTrade(requested);
    const handlePanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: number; productId?: string }>).detail;
      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      openRequestedAutoTrade(detail.productId);
    };
    window.addEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
    return () => window.removeEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
  }, [embedded, game.products, model.user.id, selectMarketAsset]);
''',
)
replace_exact(
    'src/pages/MarketPage.tsx',
    "  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;\n",
    "  const marketTrend = marketBuckets[marketBuckets.length - 1].price - marketBuckets[0].price;\n  const marketVolume24h = useMemo(() => {\n    const windowStart = now - (24 * 60 * 60 * 1_000);\n    return marketHistory\n      .filter((point) => point.createdAt >= windowStart && point.createdAt <= now)\n      .reduce((sum, point) => sum + Math.max(0, Number(point.quantity || 0)), 0);\n  }, [marketHistory, now]);\n",
)

new_catalog_block = '''  if (!facilityAssetId && marketViewMode === 'catalog') {
    const catalogContent = (
      <div className="market-page-surface market-catalog-surface">
        <div className="market-catalog-filters" aria-label="市场列表筛选">
          <TextInput
            label="搜索"
            type="search"
            value={catalogQuery}
            placeholder="搜索商品"
            onChange={(event) => setCatalogQuery(event.currentTarget.value)}
          />
          <SelectInput
            label="分类"
            value={catalogCategory}
            onChange={(event) => setCatalogCategory(event.currentTarget.value)}
          >
            <option value="all">全部分类</option>
            {catalogCategoryOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </SelectInput>
          <SelectInput
            label="市场状态"
            value={catalogStatus}
            onChange={(event) => setCatalogStatus(event.currentTarget.value as MarketCatalogStatus)}
          >
            <option value="all">全部状态</option>
            <option value="traded">有真实成交</option>
            <option value="buy">有买盘</option>
            <option value="sell">有卖盘</option>
            <option value="unmet-demand">消费需求未满足</option>
            <option value="own-order">有我的订单</option>
          </SelectInput>
          <SelectInput
            label="排序"
            value={catalogSort}
            onChange={(event) => setCatalogSort(event.currentTarget.value as MarketCatalogSort)}
          >
            <option value="catalog">目录顺序</option>
            <option value="name">名称</option>
            <option value="price">市场价</option>
            <option value="trend">24h 变化</option>
            <option value="buy-volume">买单量</option>
            <option value="sell-volume">卖单量</option>
            <option value="balance">挂单差额</option>
          </SelectInput>
        </div>
        <ul className="market-catalog-list" aria-label="商品市场列表">
          {catalogEntries.map((entry) => {
            const entryTrendTone: StatusTone = (entry.trend ?? 0) > 0 ? 'success' : (entry.trend ?? 0) < 0 ? 'danger' : 'neutral';
            const deviationTone: StatusTone = (entry.baseDeviationPercent ?? 0) > 0 ? 'warning' : (entry.baseDeviationPercent ?? 0) < 0 ? 'info' : 'neutral';
            return (
              <li className="market-catalog-item" key={`${entry.kind}:${entry.id}`}>
                <button
                  type="button"
                  className="market-catalog-row"
                  data-ui-interactive="surface"
                  aria-label={`查看${entry.name}详情`}
                  onClick={() => selectMarketAsset(entry.kind, entry.id, !embedded)}
                >
                  <span className="market-catalog-row__identity">
                    <span className="market-catalog-row__artwork" aria-hidden="true">
                      <ProductArtwork productId={entry.id} />
                    </span>
                    <span className="market-catalog-row__name">
                      <strong>{entry.name}</strong>
                      <small>{entry.categoryLabel}</small>
                    </span>
                  </span>
                  <span className="market-catalog-row__metric">
                    <small>卖单量</small>
                    <strong>{formatNumber(entry.sellVolume)}</strong>
                  </span>
                  <span className="market-catalog-row__metric">
                    <small>买单量</small>
                    <strong>{formatNumber(entry.buyVolume)}</strong>
                  </span>
                  <span className="market-catalog-row__metric market-catalog-row__balance">
                    <small>挂单差额</small>
                    <strong>{entry.balance > 0 ? '+' : ''}{formatNumber(entry.balance)}</strong>
                  </span>
                  <span className="market-catalog-row__metric">
                    <small>市场价</small>
                    <strong>{typeof entry.marketPrice === 'number'
                      ? <CurrencyAmount>{formatCurrency(entry.marketPrice)}</CurrencyAmount>
                      : '—'}</strong>
                  </span>
                  <span className="market-catalog-row__metric market-catalog-row__deviation">
                    <small>基准偏离</small>
                    {typeof entry.baseDeviationPercent === 'number'
                      ? <StatusTag tone={deviationTone}>{entry.baseDeviationPercent > 0 ? '+' : ''}{entry.baseDeviationPercent.toFixed(1)}%</StatusTag>
                      : <strong>—</strong>}
                  </span>
                  <span className="market-catalog-row__metric market-catalog-row__trend">
                    <small>24h 变化</small>
                    {typeof entry.trend === 'number'
                      ? <StatusTag tone={entryTrendTone}><CurrencyAmount sign={entry.trend > 0 ? '+' : undefined}>{formatCurrency(entry.trend)}</CurrencyAmount></StatusTag>
                      : <strong>—</strong>}
                  </span>
                  <span className="market-catalog-row__condition">
                    <small>挂单状态</small>
                    <StatusTag tone={marketConditionTone(entry.condition)}>{MARKET_CONDITION_LABELS[entry.condition]}</StatusTag>
                  </span>
                  <span className="market-catalog-row__chevron" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
          {catalogEntries.length === 0 ? (
            <li className="market-catalog-empty">
              <p>没有符合当前筛选条件的商品。</p>
              <Button variant="secondary" onClick={resetCatalogFilters}>清除筛选</Button>
            </li>
          ) : null}
        </ul>
      </div>
    );
    return embedded
      ? catalogContent
      : <PageLayout title={`${provinceName}市场`}>{catalogContent}</PageLayout>;
  }

'''
market_text = read('src/pages/MarketPage.tsx')
summary_start = market_text.find('  const marketConditionSummary = useMemo(() => {')
if summary_start < 0:
    raise RuntimeError('MarketPage marketConditionSummary marker missing')
catalog_start = market_text.find("  if (!facilityAssetId && marketViewMode === 'catalog') {", summary_start)
detail_start = market_text.find('  const detailContent =', catalog_start)
if catalog_start < 0 or detail_start < 0:
    raise RuntimeError('MarketPage catalog/detail markers missing')
market_text = market_text[:summary_start] + new_catalog_block + market_text[detail_start:]
write('src/pages/MarketPage.tsx', market_text)

replace_exact(
    'src/pages/MarketPage.tsx',
    '''      {embedded ? (
        <div className="province-embedded-section-navigation">
''',
    '''      {embedded && facilityAssetId ? (
        <div className="province-embedded-section-navigation">
''',
)
replace_exact(
    'src/pages/MarketPage.tsx',
    '''              <span>
                <small>{availableAssetLabel}</small>
                <strong>{formatNumber(availableAssetQuantity)}</strong>
              </span>
''',
    '''              <span>
                <small>{selectedProduct ? '24h 成交量' : availableAssetLabel}</small>
                <strong>{formatNumber(selectedProduct ? marketVolume24h : availableAssetQuantity)}</strong>
              </span>
''',
)
replace_exact(
    'src/pages/MarketPage.tsx',
    '''          </Panel>

          <Panel className="widget span-3 market-account-panel">
''',
    '''          </Panel>

          {selectedProduct ? (
            <MarketAutoTradePanel
              model={model}
              fixedProductId={selectedProduct.id}
              requestedProductId={requestedAutoTradeProductId}
              className="market-detail-auto-trade"
            />
          ) : null}

          <Panel className="widget span-3 market-account-panel">
''',
)
replace_exact(
    'src/pages/MarketPage.tsx',
    '''    <PageLayout
      title={`${provinceName} · ${assetName}`}
      backAction={{
''',
    '''    <PageLayout
      title={<RegionalEntityPageTitle entityName={assetName} regionName={provinceName} />}
      backAction={{
''',
)

# Fixed-product mode for the existing auto-trade controller. The generic mode remains
# available internally, but regional commodity details use fixedProductId and expose no
# all-product selector/grid.
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''export function MarketAutoTradePanel({
  model,
  className = '',
  requestedProductId = null,
}: {
  model: AutoTradeCapableGameViewModel;
  className?: string;
  requestedProductId?: string | null;
}) {
''',
    '''export function MarketAutoTradePanel({
  model,
  className = '',
  requestedProductId = null,
  fixedProductId = null,
}: {
  model: AutoTradeCapableGameViewModel;
  className?: string;
  requestedProductId?: string | null;
  fixedProductId?: string | null;
}) {
''',
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    "  const [selectedProductId, setSelectedProductId] = useState('');\n",
    "  const [selectedProductId, setSelectedProductId] = useState(fixedProductId ?? '');\n",
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''  const selectedProduct = game.products.find((product) => product.id === selectedProductId) ?? null;
''',
    '''  const selectedProduct = game.products.find((product) => product.id === selectedProductId) ?? null;
  const fixedMode = Boolean(fixedProductId);
''',
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''  const openAutoTradePanel = useCallback((
''',
    '''  useEffect(() => {
    if (!fixedProductId) return;
    loadProductDrafts(fixedProductId);
  }, [fixedProductId, loadProductDrafts]);

  const openAutoTradePanel = useCallback((
''',
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested) openAutoTradePanel(requested, undefined, 'sell');
''',
    '''    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested && (!fixedProductId || requested === fixedProductId)) {
      openAutoTradePanel(requested, undefined, 'sell');
    }
''',
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      openAutoTradePanel(detail.productId, undefined, 'sell');
''',
    '''      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      if (fixedProductId && detail.productId !== fixedProductId) return;
      openAutoTradePanel(detail.productId, undefined, 'sell');
''',
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''  }, [model.user.id, openAutoTradePanel]);
''',
    '''  }, [fixedProductId, model.user.id, openAutoTradePanel]);
''',
)
replace_exact(
    'src/components/market/MarketAutoTradePanel.tsx',
    '''  useEffect(() => {
    if (!requestedProductId || handledRequestedProductRef.current === requestedProductId) return;
    handledRequestedProductRef.current = requestedProductId;
    openAutoTradePanel(requestedProductId, undefined, 'sell');
  }, [openAutoTradePanel, requestedProductId]);
''',
    '''  useEffect(() => {
    if (!requestedProductId || handledRequestedProductRef.current === requestedProductId) return;
    if (fixedProductId && requestedProductId !== fixedProductId) return;
    handledRequestedProductRef.current = requestedProductId;
    openAutoTradePanel(requestedProductId, undefined, 'sell');
  }, [fixedProductId, openAutoTradePanel, requestedProductId]);
''',
)

auto_text = read('src/components/market/MarketAutoTradePanel.tsx')
auto_return_start = auto_text.find('  return (\n    <>\n      <div className={`production-warehouse-workspace market-auto-trade-workspace')
auto_return_end = auto_text.rfind('  );\n}')
if auto_return_start < 0 or auto_return_end < 0:
    raise RuntimeError('MarketAutoTradePanel return markers missing')
new_auto_return = '''  return (
    <>
      <div className={`production-warehouse-workspace market-auto-trade-workspace ${fixedMode ? 'market-auto-trade-workspace--fixed' : ''} ${className}`.trim()}>
        <PagePanel className="production-surface warehouse-auto-trade-card market-auto-trade-card">
          <WidgetHeading
            title={selectedProduct ? `${selectedProduct.name} · 自动交易` : '自动交易'}
            action={<StatusTag tone="info">在线维护</StatusTag>}
          />
          <section className="warehouse-auto-trade-panel" aria-label="商品自动交易设置">
            {fixedMode ? null : renderProductSelector()}
            {renderSelectedTradeFields()}
            {selectedProduct ? renderSaveButton() : null}
          </section>
        </PagePanel>

        {fixedMode ? (
          <Panel className="production-surface market-auto-trade-fixed-mobile">
            <WidgetHeading
              title={selectedProduct ? `${selectedProduct.name} · 自动交易` : '自动交易'}
              action={<StatusTag tone="info">在线维护</StatusTag>}
            />
            <Button
              ref={mobileAutoTradeTriggerRef}
              block
              onClick={(event) => openAutoTradePanel(fixedProductId ?? undefined, event.currentTarget)}
            >
              设置自动交易
            </Button>
          </Panel>
        ) : (
          <Panel className="production-surface warehouse-inventory-panel market-auto-trade-products">
            <WidgetHeading
              title="自动交易商品"
              action={(
                <div className="warehouse-heading-actions">
                  <StatusTag tone="neutral">无限容量</StatusTag>
                  <button
                    ref={mobileAutoTradeTriggerRef}
                    type="button"
                    className="ui-button ui-button--compact warehouse-auto-trade-mobile-trigger"
                    onClick={(event) => openAutoTradePanel(selectedProductId || undefined, event.currentTarget)}
                  >
                    自动交易
                  </button>
                </div>
              )}
            />
            <section className="warehouse-content" aria-label="自动交易商品与库存">
              <header className="warehouse-content-heading">
                <strong>策略与库存</strong>
                <span>{formatNumber(stockedProducts.length)} 种活跃商品</span>
              </header>
              {stockedProducts.length > 0 ? (
                <div className="warehouse-product-grid">
                  {stockedProducts.map((product) => {
                    const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
                    const buyEnabled = autoTrade.buyPolicyFor(product.id).enabled;
                    const sellEnabled = autoTrade.sellPolicyFor(product.id).enabled;
                    const automationLabel = buyEnabled && sellEnabled
                      ? '自动交易'
                      : buyEnabled ? '自动采购' : sellEnabled ? '自动出售' : '';
                    return (
                      <button
                        type="button"
                        className={`warehouse-product-card market-auto-trade-product-card ${automationLabel ? 'is-auto-trade-enabled' : ''}`}
                        data-product-id={product.id}
                        key={product.id}
                        aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，设置自动交易`}
                        onClick={(event) => openAutoTradePanel(product.id, event.currentTarget)}
                      >
                        <span className="warehouse-product-card-name">{product.name}</span>
                        <span className="warehouse-product-card-icon"><ProductIcon productId={product.id} /></span>
                        <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                        <small className="warehouse-product-card-frozen">
                          冻结 {formatNumber(inventory.frozen)}{automationLabel ? ` · ${automationLabel}` : ''}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state warehouse-content-empty">
                  <strong>暂无活跃自动交易商品</strong>
                  <span>可从左侧商品选择器为任意商品开启自动采购或自动出售。</span>
                </div>
              )}
            </section>
          </Panel>
        )}
      </div>

      <MobileWorkspaceDetailSheet
        isOpen={isMobileAutoTradeOpen}
        ariaLabel={selectedProduct ? `${selectedProduct.name}自动交易设置` : '商品自动交易设置'}
        viewportAriaLabel="商品自动交易设置内容"
        returnFocusRef={autoTradeTriggerRef}
        onClose={() => setMobileAutoTradeOpen(false)}
        footer={renderSaveButton()}
      >
        <section className="warehouse-auto-trade-sheet-content">
          <WidgetHeading
            title={selectedProduct ? `${selectedProduct.name} · 自动交易` : '自动交易'}
            action={<StatusTag tone="info">在线维护</StatusTag>}
          />
          {fixedMode ? null : renderProductSelector()}
          {renderSelectedTradeFields()}
        </section>
      </MobileWorkspaceDetailSheet>
    </>
'''
auto_text = auto_text[:auto_return_start] + new_auto_return + auto_text[auto_return_end:]
write('src/components/market/MarketAutoTradePanel.tsx', auto_text)

# Shared titles for standalone factory detail.
replace_exact(
    'src/pages/BuildingsPage.tsx',
    "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\n",
    "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';\n",
)
replace_exact(
    'src/pages/BuildingsPage.tsx',
    '''        title={<span className="province-facility-detail-title">{provinceName}{selectedFacilityEntry.type.name}</span>}
''',
    '''        title={(
          <RegionalEntityPageTitle
            entityName={selectedFacilityEntry.type.name}
            regionName={provinceName}
            className="province-facility-detail-title"
          />
        )}
''',
)

# ProvincePage surfaces commodity/factory second-level detail in the shared PageLayout title.
replace_exact(
    'src/pages/ProvincePage.tsx',
    "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\n",
    "import { CurrencyAmount } from '../components/ui/CurrencyAmount';\nimport { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';\n",
)
replace_exact(
    'src/pages/ProvincePage.tsx',
    "  const isFacilityDetail = activeSection === 'buildings' && Boolean(facilityDetailType);\n",
    "  const isFacilityDetail = activeSection === 'buildings' && Boolean(facilityDetailType);\n  const marketDetailProduct = activeSection === 'market'\n    && model.marketViewMode === 'detail'\n    && model.marketAssetKind === 'commodity'\n    ? model.game.products.find((product) => product.id === model.marketAssetId)\n    : undefined;\n  const isMarketDetail = Boolean(marketDetailProduct);\n  const isEntityDetail = isFacilityDetail || isMarketDetail;\n",
)
replace_exact(
    'src/pages/ProvincePage.tsx',
    '''  const selectSection = (section: ProvinceSection, focus = false) => {
    setActiveSection(section);
    setFacilityDetailTypeId(null);
''',
    '''  const selectSection = (section: ProvinceSection, focus = false) => {
    setActiveSection(section);
    setFacilityDetailTypeId(null);
    if (section === 'market') model.showMarketCatalog();
''',
)
replace_between(
    'src/pages/ProvincePage.tsx',
    '''    <PageLayout
      title={isFacilityDetail ? (
''',
    '''      <section
        id="province-section-panel"
''',
    '''    <PageLayout
      title={isMarketDetail && marketDetailProduct ? (
        <RegionalEntityPageTitle entityName={marketDetailProduct.name} regionName={provinceName} />
      ) : isFacilityDetail && facilityDetailType ? (
        <RegionalEntityPageTitle
          entityName={facilityDetailType.name}
          regionName={provinceName}
          className="province-facility-detail-title"
        />
      ) : provinceName}
      backAction={isMarketDetail
        ? { label: '返回商品列表', onClick: model.showMarketCatalog }
        : isFacilityDetail
          ? { label: '返回建筑列表', onClick: () => setFacilityDetailTypeId(null) }
          : { label: '返回地图', onClick: () => model.setTab('map') }}
    >
      {!isEntityDetail ? sectionSwitch : null}
''',
)
replace_exact(
    'src/pages/ProvincePage.tsx',
    "        aria-labelledby={isFacilityDetail ? undefined : `province-section-tab-${activeSection}`}\n",
    "        aria-labelledby={isEntityDetail ? undefined : `province-section-tab-${activeSection}`}\n",
)

# Global market drilldown also surfaces the actual regional commodity title and return stack.
replace_exact(
    'src/pages/GlobalMarketPage.tsx',
    "import { ProductArtwork } from '../components/products/ProductArtwork';\n",
    "import { ProductArtwork } from '../components/products/ProductArtwork';\nimport { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';\n",
)
replace_exact('src/pages/GlobalMarketPage.tsx', '  Button,\n', '')
replace_exact(
    'src/pages/GlobalMarketPage.tsx',
    '''  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : undefined;
''',
    '''  const detailProduct = model.marketViewMode === 'detail' && model.marketAssetKind === 'commodity'
    ? game.products.find((product) => product.id === model.marketAssetId)
    : undefined;
  const detailProvince = detailProduct
    ? provinces.find((province) => province.id === model.selectedProvinceId)
    : undefined;
  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : detailProvince;
''',
)
replace_between(
    'src/pages/GlobalMarketPage.tsx',
    '  if (activeProvince) {\n',
    '  return (\n    <PageLayout title="市场">\n',
    '''  if (activeProvince) {
    const provinceReady = model.selectedProvinceId === activeProvince.id;
    const isProductDetail = provinceReady && Boolean(detailProduct);
    const returnToProvinceMarket = () => {
      setActiveProvinceId(activeProvince.id);
      model.showMarketCatalog();
    };
    return (
      <PageLayout
        title={isProductDetail && detailProduct ? (
          <RegionalEntityPageTitle entityName={detailProduct.name} regionName={activeProvince.name} />
        ) : `${activeProvince.name}市场`}
        backAction={isProductDetail
          ? { label: '返回商品列表', onClick: returnToProvinceMarket }
          : { label: '返回全局市场', onClick: () => setActiveProvinceId(null) }}
      >
        <div className="global-operation-page global-market-page" data-global-scope="market" data-drilldown-province-id={activeProvince.id}>
          {!isProductDetail ? (
            <section className="global-operation-drilldown-context" aria-label="当前地区市场">
              <small>全局市场 · 地区交易视图</small>
              <h2>{activeProvince.name}市场</h2>
            </section>
          ) : null}
          {provinceReady ? (
            <Suspense fallback={<Panel className="empty-state"><span role="status">正在加载地区市场…</span></Panel>}>
              <EmbeddedMarketPage model={model} embedded />
            </Suspense>
          ) : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
        </div>
      </PageLayout>
    );
  }

''',
)

# Global buildings uses the same controlled regional factory-detail title semantics.
replace_exact(
    'src/pages/GlobalBuildingsPage.tsx',
    "import { FacilityIcon } from '../components/icons/FacilityIcons';\n",
    "import { FacilityIcon } from '../components/icons/FacilityIcons';\nimport { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';\n",
)
replace_exact('src/pages/GlobalBuildingsPage.tsx', '  Button,\n', '')
replace_exact(
    'src/pages/GlobalBuildingsPage.tsx',
    "  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);\n",
    "  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);\n  const [facilityDetailTypeId, setFacilityDetailTypeId] = useState<string | null>(null);\n",
)
replace_exact(
    'src/pages/GlobalBuildingsPage.tsx',
    '''  const openProvinceBuildings = (provinceId: string) => {
    model.setSelectedProvinceId(provinceId);
    setActiveProvinceId(provinceId);
  };
''',
    '''  const openProvinceBuildings = (provinceId: string) => {
    model.setSelectedProvinceId(provinceId);
    setFacilityDetailTypeId(null);
    setActiveProvinceId(provinceId);
  };
''',
)
replace_between(
    'src/pages/GlobalBuildingsPage.tsx',
    '  if (activeProvince) {\n',
    '  return (\n    <PageLayout title="建筑">\n',
    '''  if (activeProvince) {
    const provinceReady = model.selectedProvinceId === activeProvince.id;
    const facilityDetailEntry = facilityDetailTypeId
      ? game.facilityGroups.find((group) => group.facilityTypeId === facilityDetailTypeId && group.count > 0)
      : undefined;
    const facilityDetailType = facilityDetailEntry
      ? game.facilityTypes.find((type) => type.id === facilityDetailEntry.facilityTypeId)
      : undefined;
    const isFacilityDetail = provinceReady && Boolean(facilityDetailType);
    return (
      <PageLayout
        title={isFacilityDetail && facilityDetailType ? (
          <RegionalEntityPageTitle
            entityName={facilityDetailType.name}
            regionName={activeProvince.name}
            className="province-facility-detail-title"
          />
        ) : `${activeProvince.name}建筑`}
        backAction={isFacilityDetail
          ? { label: '返回建筑列表', onClick: () => setFacilityDetailTypeId(null) }
          : { label: '返回全局建筑', onClick: () => setActiveProvinceId(null) }}
      >
        <div className="global-operation-page global-buildings-page" data-global-scope="buildings" data-drilldown-province-id={activeProvince.id}>
          {!isFacilityDetail ? (
            <section className="global-operation-drilldown-context" aria-label="当前地区建筑">
              <small>全局建筑 · 地区生产视图</small>
              <h2>{activeProvince.name}建筑</h2>
            </section>
          ) : null}
          {provinceReady ? (
            <Suspense fallback={<Panel className="empty-state"><span role="status">正在加载地区建筑…</span></Panel>}>
              {/* Retired static verifier marker: <EmbeddedBuildingsPage model={model} embedded /> */}
              <EmbeddedBuildingsPage
                model={model}
                embedded
                detailFacilityTypeId={facilityDetailTypeId ?? undefined}
                onDetailFacilityChange={setFacilityDetailTypeId}
              />
            </Suspense>
          ) : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
        </div>
      </PageLayout>
    );
  }

''',
)

# Market catalog styling: no surrounding list card, no workspace/stat strip.
replace_regex(
    'src/styles/market-page-polish.css',
    r'''\.market-catalog-panel \{.*?\}\n\n\.market-workspace-switch \{.*?\}\n\n\.market-overview-metrics \{.*?\}\n\n''',
    '',
)
replace_exact(
    'src/styles/market-page-polish.css',
    '''  margin-top: var(--layout-gutter);
}

.market-catalog-list {
''',
    '''  margin-top: 0;
}

.market-catalog-list {
''',
)
# Remove now-dead responsive rules for the deleted four-card strip.
replace_regex('src/styles/market-page-polish.css', r'''\n  \.market-overview-metrics \{\n    grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\n  \}\n''', '\n')
replace_regex('src/styles/market-page-polish.css', r'''\n@container market-page \(max-width: 420px\) \{\n  \.market-overview-metrics \{\n    grid-template-columns: minmax\(0, 1fr\);\n  \}\n\}\n''', '\n')

# Fixed commodity auto-trade fills detail width on desktop and uses the existing
# shared bottom sheet trigger at <=720px.
replace_exact(
    'src/styles/warehouse-expansion.css',
    '''.production-warehouse-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  align-items: start;
  gap: var(--layout-gutter);
}
''',
    '''.production-warehouse-workspace {
  display: grid;
  grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
  align-items: start;
  gap: var(--layout-gutter);
}

.market-auto-trade-workspace--fixed {
  grid-template-columns: minmax(0, 1fr);
}

.market-auto-trade-fixed-mobile {
  display: none;
}
''',
)
replace_exact(
    'src/styles/warehouse-expansion.css',
    '''  .warehouse-auto-trade-mobile-trigger {
    display: inline-flex;
  }
''',
    '''  .warehouse-auto-trade-mobile-trigger {
    display: inline-flex;
  }

  .market-auto-trade-fixed-mobile {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-3);
  }
''',
)

# Production surface comment now documents fixed-height two-line title track.
replace_exact(
    'src/styles/production-surface.css',
    '''/* Regional factory list/detail transitions share one fixed single-line title
 * track. Detail text may shrink, but the fixed header never grows or collapses. */
''',
    '''/* Regional list/detail transitions share one fixed title track. Entity detail
 * titles may use two internal lines, but the fixed header never grows or collapses. */
''',
)

# --- Authoritative design updates -------------------------------------------------
replace_exact(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '纯地图视图只能由业务页面统一“关闭”操作进入，不得恢复侧栏或底栏“地图”按钮。',
    '纯地图视图是登录后首次进入游戏和业务页面统一“关闭”操作的共同目标；不得恢复侧栏或底栏“地图”按钮，也不得在首次状态加载完成后自动打开概览或其他业务页面。',
)
replace_regex(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    r'''地区 `MarketPage` 的目录态语义标题为“\{州级地区全称\}市场”.*?下单请求必须携带当前 `provinceId`。''',
    '''地区 `MarketPage` 的目录态语义标题为“{州级地区全称}市场”；商品详情使用共享地区实体标题，第一行显示商品名称，第二行显示州级地区全称。嵌入 `GlobalMarketPage` 或 `ProvincePage` 时不得再套第二层 `PageLayout`，父级标题必须跟随同一目录／详情状态；地区商品详情返回当前地区商品目录，不得直接跳过地区层级。地区市场不显示州级下拉框；商品目录只展示商品，不再提供商品／工厂资产类型切换；工厂资产的五档盘口、下单、本人订单与成交作为建筑详情中的从属交易视图打开，返回时必须回到原建筑详情，不形成第二个可见市场目录或兼容路由。商品行情、在线自动交易策略、五档盘口、未完成订单和本地成交记录都只展示当前地区；切换地区必须在同一完整权威状态上重新投影，不得沿用上一地区的盘口、库存、价格、策略或成交记录。下单请求必须携带当前 `provinceId`。''',
)
replace_regex(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    r'''市场目录固定提供“市场行情／自动交易”两个工作区。.*?中窄与移动布局必须改为卡片式多行摘要，不得隐藏关键字段或依赖横向滚动。''',
    '''地区市场目录只承担商品发现与进入详情：筛选栏和商品列表直接排列在页面正文，不再套“商品列表”一级卡片，不显示“市场行情／自动交易”工作区切换，也不显示买盘偏多、双边均衡、卖盘偏多、无挂单四张汇总统计卡。列表支持商品名称、四类正式商品分类、市场状态和排序筛选；状态至少包含有真实成交、有买盘、有卖盘、消费需求未满足和有我的订单，排序至少包含目录顺序、名称、市场价、24h 变化、买单量、卖单量和挂单差额。每行固定显示商品、卖单量、买单量、挂单差额、市场价、相对基础价偏离、24h 变化和挂单状态；中窄与移动布局必须改为多行摘要，不得隐藏关键字段或依赖横向滚动。点击商品进入当前地区商品详情；详情固定承载当前地区真实价格与近 24 小时真实成交量／趋势、统一五档订单簿与手动下单、本人订单／本地成交，以及锁定当前 `provinceId + productId` 的在线自动采购／自动出售设置。自动交易不得在商品目录恢复全商品工作区或第二套盘口。''',
)
replace_exact(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区；自动采购／自动出售策略唯一显示在市场页“自动交易”工作区；跨州运输发货与在途记录唯一显示在仓库分区的“跨州运输”区。',
    '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区；自动采购／自动出售策略唯一显示在地区商品详情的自动交易区；跨州运输发货与在途记录唯一显示在仓库分区的“跨州运输”区。',
)
replace_exact(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '| 商品在线自动采购／自动出售策略 | 市场的地区 `MarketPage` 自动交易工作区 |',
    '| 商品在线自动采购／自动出售策略 | 市场的地区 `MarketPage` 商品详情自动交易区 |',
)

# Rewrite warehouse layout section up to shared reservations so it matches the new visible IA.
warehouse_text = read('docs/WAREHOUSE_EXPANSION_DESIGN.md')
section_start = warehouse_text.find('## 4. 州级仓库与市场自动交易布局')
section_end = warehouse_text.find('### 4.1 共享预定语义', section_start)
if section_start < 0 or section_end < 0:
    raise RuntimeError('warehouse design section markers missing')
warehouse_section = '''## 4. 州级仓库与地区商品自动交易布局

隐藏州级上下文页的“仓库”分区只渲染共享仓库库存面板。共享仓库显示当前州真实库存、“无限容量”和只读商品卡，不渲染自动交易表单、策略标记或可点击配置入口。建筑页不得渲染仓库面板。

在线自动交易唯一显示在地区商品详情，不再在地区市场商品目录提供“市场行情／自动交易”工作区切换、全商品选择器或活跃商品网格。进入商品详情后，自动交易组件固定绑定当前 `provinceId + productId`，直接展示该商品的自动采购／自动出售策略、当前可用、当前自由库存、生产预定、合同预定和预计自动买卖数量；不得通过组件内部选择器切换到其他商品。需要配置其他商品时必须先返回地区商品目录并进入对应商品详情。

`721px` 及以上商品详情直接显示当前商品的自动交易控制卡并占满详情可用宽度。`720px` 及以下不显示常驻控制卡，只显示当前商品的“设置自动交易”入口；点击后必须复用 `MobileWorkspaceDetailSheet`，并沿用完整视口遮罩、背景关闭、`Escape`、滚动锁、焦点限制、唯一滚动区、固定底栏和安全区。关闭后焦点返回实际触发按钮。桌面与移动端复用同一组商品级 React 状态和字段逻辑，不得创建第二套策略草稿。

共享仓库标题右侧继续显示“无限容量”，不得显示等级、总容量、剩余容量、预占来源、升级费用、扩容按钮、容量警告或自动交易入口。州级仓库每张商品卡只展示名称、PNG 插画、可用数量和冻结数量，不响应点击；库存显示条件仍为 `available > 0 或 frozen > 0`。仓库商品卡网格密度继续使用既有容器查询，不因自动交易迁入商品详情而改变。

当前商品自动交易控制内部使用“自动采购 / 自动出售”两个方向切换，不创建嵌套一级卡片。两侧共享当前可用、当前自由库存、生产预定与合同预定；采购侧突出“预计自动采购”，出售侧突出“预计自动出售”。卡片底部只有一个“保存自动交易设置”动作，一次原子保存同商品两侧策略。零库存商品仍可从地区商品目录进入详情并开启自动采购；零库存不是隐藏商品详情或禁止自动交易的条件。

'''
write('docs/WAREHOUSE_EXPANSION_DESIGN.md', warehouse_text[:section_start] + warehouse_section + warehouse_text[section_end:])

replace_exact(
    'docs/README.md',
    '| `WAREHOUSE_EXPANSION_DESIGN.md` | 州级本地无限仓库、真实商品库存、容量机制退役、州页仓库分区、市场在线自动采购／自动出售、商品自动交易卡和商品网格密度 |',
    '| `WAREHOUSE_EXPANSION_DESIGN.md` | 州级本地无限仓库、真实商品库存、容量机制退役、州页仓库分区、地区商品详情在线自动采购／自动出售、移动自动交易抽屉与仓库商品网格密度 |',
)
replace_exact(
    'docs/README.md',
    '41. 市场只提供商品目录，并以“市场行情／自动交易”切换承载商品挂单总览和在线自动买卖策略。商品行显示卖单量、买单量、挂单差额、市场价、基准偏离、24h 变化和挂单状态；挂单量只来自公开订单簿，不得用库存或理论产量伪造供需。商品详情增加服务器消费需求基本面和正式配方生产者／消费者关系，并保留五档盘口、24h 行情、当前资产订单与本地成交。工厂资产交易只能从建筑详情打开从属视图并返回原建筑，不得恢复市场工厂目录。实现必须同步 `MarketPage.tsx`、`BuildingsPage.tsx`、`market-page-polish.css`、`scripts/verify-market-page-layout.mjs` 与市场浏览器测试。',
    '41. 市场只提供商品目录；地区商品目录的筛选栏和商品行直接排列在正文，不得恢复“市场行情／自动交易”切换、四张挂单状态汇总卡或商品列表外层一级卡片。商品行显示卖单量、买单量、挂单差额、市场价、基准偏离、24h 变化和挂单状态；挂单量只来自公开订单簿，不得用库存或理论产量伪造供需。点击商品进入当前地区商品详情，详情统一承载真实价格与 24h 成交量／趋势、五档订单簿和手动下单、当前资产订单／本地成交及锁定当前商品的在线自动买卖策略。工厂资产交易只能从建筑详情打开从属视图并返回原建筑，不得恢复市场工厂目录。实现必须同步 `MarketPage.tsx`、`BuildingsPage.tsx`、共享地区实体标题、`market-page-polish.css`、`scripts/verify-market-page-layout.mjs` 与市场浏览器测试。',
)

replace_exact(
    'docs/UI_DESIGN_SYSTEM.md',
    '| `src/styles/warehouse-expansion.css` | 州级只读仓库、市场自动交易工作区、容器查询、紧凑商品卡和自动采购／自动出售正文布局 |',
    '| `src/styles/warehouse-expansion.css` | 州级只读仓库、地区商品详情自动交易控制、容器查询、紧凑商品卡和移动自动交易入口布局 |',
)
replace_exact(
    'docs/UI_DESIGN_SYSTEM.md',
    '| `src/styles/production-surface.css` | 建筑页建设卡和工厂详情的标题锚点、名称下状态与紧凑开关；不得定义一级卡片外层内边距 |',
    '| `src/styles/production-surface.css` | 建筑页建设卡和工厂详情的标题轨道、名称下状态与紧凑开关；不得定义一级卡片外层内边距 |\n| `src/styles/regional-entity-page-title.css` | 地区商品／工厂详情共享两行标题：实体主标题、灰色地区副标题，以及不改变固定标题区高度的溢出规则 |',
)
replace_exact(
    'docs/UI_DESIGN_SYSTEM.md',
    '- `PageLayout`\n',
    '- `PageLayout`\n- `RegionalEntityPageTitle`\n',
)
replace_exact(
    'docs/UI_DESIGN_SYSTEM.md',
    '- 市场目录只展示商品，固定提供“市场行情／自动交易”工作区；工厂资产交易只从建筑详情打开从属交易视图，不得恢复市场工厂目录、第二个一级市场页面、双列买卖盘或工厂固定价格卡。',
    '- 市场目录只展示商品，筛选栏和商品行直接位于正文，不提供“市场行情／自动交易”工作区、四张目录汇总统计卡或商品列表外层一级卡片；自动交易只在当前地区商品详情显示并锁定当前商品。工厂资产交易只从建筑详情打开从属交易视图，不得恢复市场工厂目录、第二个一级市场页面、双列买卖盘或工厂固定价格卡。',
)
# Insert shared title geometry after PagePanel component rule.
replace_exact(
    'docs/UI_DESIGN_SYSTEM.md',
    '`PagePanel` 是新增玩家端一级卡片的唯一 React 入口，固定复用 `Panel`、`.widget` 与 `.ui-primary-surface`。现有 `Panel className="widget ..."` 由兼容桥自动补充 `.ui-primary-surface`；建筑页和排行页尚未迁移的旧一级卡片类只允许在 `primary-surfaces.css` 中作为兼容入口，不得在业务 CSS 中重新定义外层 padding。\n',
    '`PagePanel` 是新增玩家端一级卡片的唯一 React 入口，固定复用 `Panel`、`.widget` 与 `.ui-primary-surface`。现有 `Panel className="widget ..."` 由兼容桥自动补充 `.ui-primary-surface`；建筑页和排行页尚未迁移的旧一级卡片类只允许在 `primary-surfaces.css` 中作为兼容入口，不得在业务 CSS 中重新定义外层 padding。\n\n`RegionalEntityPageTitle` 是地区商品与地区工厂详情的唯一共享标题结构。第一行固定显示实体名称并使用大于地区行的主标题字号；第二行固定显示州级地区全称，使用 `var(--color-text-muted)` 灰色次级文字。两行各自保持单行与省略号溢出，总容器固定占用现有 `40px` 标题轨道，不得修改 `PageLayout` 的标题 padding、返回／关闭按钮位置、`.page-fixed-header` 高度或正文起点。目录页继续使用普通单行页面标题；只有具体地区实体详情使用该两行结构。\n',
)

replace_regex(
    'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
    r'''地区工厂详情标题固定为：\n\n```text\n\{地区名称\}\{工厂名称\}\n```\n\n例如“加利福尼亚州食品加工厂”。标题保持单行；标题较长时优先缩小字号，仍超出时才省略，不得换行或增加标题区高度。''',
    '''地区工厂详情标题固定复用共享 `RegionalEntityPageTitle`：\n\n```text\n食品加工厂\n加利福尼亚州\n```\n\n第一行是工厂实体名称并使用较大主标题字号，第二行是州级地区全称并使用灰色次级文字；商品详情使用完全相同的结构。两行各自保持单行，过长时使用省略策略，总标题容器继续固定在现有 `40px` 轨道内，不得增加 `.page-fixed-header` 高度或移动返回／关闭按钮与正文起点。不得恢复“{地区名称}{工厂名称}”单行拼接标题。''',
)
replace_exact(
    'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
    '- 地区详情标题使用单行自适应字号且不改变标题区高度；',
    '- 地区详情标题复用“实体名称第一行／灰色地区全称第二行”的共享结构且不改变标题区高度；',
)
replace_exact(
    'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
    'production-surface.css` 是地区建筑页最终三列工厂卡、列表无外层卡片、建设卡顺序、二级详情可见性、详情标题缩放和建筑页紧凑开关的场景最终权威；',
    'production-surface.css` 是地区建筑页最终三列工厂卡、列表无外层卡片、建设卡顺序、二级详情可见性和建筑页紧凑开关的场景最终权威；地区实体标题内部排版由 `regional-entity-page-title.css` 统一负责；',
)

# --- Static regression guards -----------------------------------------------------
replace_exact(
    'scripts/verify-market-assets.mjs',
    "assert.equal(viewModel.includes(\"const [tab, setActiveTab] = useState<TabId>('home');\"), true, '客户端默认页面应为概览');",
    "assert.equal(viewModel.includes(\"const [tab, setActiveTab] = useState<TabId>('map');\"), true, '客户端首次进入应只显示战略地图');",
)

replace_exact(
    'scripts/verify-page-content-base.mjs',
    "  '<MarketAutoTradePanel model={model} requestedProductId={requestedAutoTradeProductId} />',\n",
    "  'fixedProductId={selectedProduct.id}',\n",
)

replace_exact(
    'scripts/verify-market-page-layout-base.mjs',
    "requireText(runtimeSpec, 'market catalog owns auto-trade and never exposes a factory directory', 'Playwright 必须覆盖自动交易归属和商品-only 目录。');",
    "requireText(runtimeSpec, 'market commodity detail owns fixed auto-trade and catalog has no workspace switch', 'Playwright 必须覆盖商品详情自动交易归属和无工作区切换的商品-only 目录。');",
)
replace_exact(
    'scripts/verify-market-page-layout-base.mjs',
    "requireText(pageDesign, '市场目录固定提供“市场行情／自动交易”两个工作区', '页面职责设计必须记录自动交易唯一归属市场。');",
    "requireText(pageDesign, '地区市场目录只承担商品发现与进入详情', '页面职责设计必须记录目录精简与自动交易下沉商品详情。');",
)
replace_exact(
    'scripts/verify-market-page-layout-base.mjs',
    "requireText(designIndex, '以“市场行情／自动交易”切换', '设计索引必须记录市场工作区。');",
    "requireText(designIndex, '不得恢复“市场行情／自动交易”切换', '设计索引必须记录地区市场目录不得恢复旧工作区切换。');",
)
# New structural requirements and old structures forbidden.
replace_exact(
    'scripts/verify-market-page-layout-base.mjs',
    "forbidText(marketCatalogSource, '<WidgetHeading', '市场列表不得显示重复目录标题。');\n",
    "forbidText(marketCatalogSource, '<WidgetHeading', '市场列表不得显示重复目录标题。');\nforbidText(marketCatalogSource, 'market-workspace-switch', '地区市场目录不得恢复市场行情／自动交易工作区切换。');\nforbidText(marketCatalogSource, 'market-overview-metrics', '地区市场目录不得恢复四张挂单状态统计卡。');\nforbidText(marketCatalogSource, 'market-catalog-panel', '地区市场商品列表不得恢复外层一级卡片。');\nrequireText(marketPage, 'fixedProductId={selectedProduct.id}', '地区商品详情必须把自动交易锁定到当前商品。');\nrequireText(marketPage, \"<small>{selectedProduct ? '24h 成交量' : availableAssetLabel}</small>\", '地区商品详情必须显示真实 24h 成交量。');\n",
)

# Warehouse verifier follows the new commodity-detail ownership while preserving server semantics.
replace_exact(
    'scripts/verify-warehouse-expansion.mjs',
    "  '市场目录固定提供“市场行情／自动交易”工作区切换',\n",
    "  '在线自动交易唯一显示在地区商品详情',\n",
)
replace_exact(
    'scripts/verify-warehouse-expansion.mjs',
    "  '市场目录固定提供“市场行情／自动交易”两个工作区',\n  '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区',\n  '自动采购／自动出售策略唯一显示在市场页“自动交易”工作区',\n",
    "  '地区市场目录只承担商品发现与进入详情',\n  '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区',\n  '自动采购／自动出售策略唯一显示在地区商品详情的自动交易区',\n",
)
replace_exact(
    'scripts/verify-warehouse-expansion.mjs',
    "  '固定提供“市场行情／自动交易”工作区',\n",
    "  '自动交易只在当前地区商品详情显示并锁定当前商品',\n",
)
replace_exact(
    'scripts/verify-warehouse-expansion.mjs',
    "  'market auto-trade panel keeps its desktop control column',\n  'uses the shared bottom sheet at 720px',\n  'keeps the desktop side panel at 721px',\n  'opens auto-trade for a zero-stock product',\n",
    "  'regional commodity detail keeps a fixed desktop auto-trade control',\n  'regional commodity detail uses the shared bottom sheet at 720px',\n  'regional commodity detail keeps the fixed desktop control at 721px',\n  'regional market catalog removes workspace switches and opens fixed commodity auto-trade',\n",
)
replace_exact(
    'scripts/verify-warehouse-expansion.mjs',
    "requireText('src/pages/MarketPage.tsx', '<MarketAutoTradePanel model={model}');",
    "requireText('src/pages/MarketPage.tsx', 'fixedProductId={selectedProduct.id}');",
)

# Production guards now lock the shared two-line title rather than old one-line concatenation.
replace_exact(
    'scripts/verify-production-desktop-layout.mjs',
    "  'className=\"province-facility-detail-title\"',\n",
    "  'className=\"province-facility-detail-title\"',\n  '<RegionalEntityPageTitle',\n",
)
replace_exact(
    'scripts/verify-production-desktop-layout.mjs',
    "  '标题保持单行',\n",
    "  '第一行是工厂实体名称',\n  '第二行是州级地区全称并使用灰色次级文字',\n  '不得增加 `.page-fixed-header` 高度',\n",
)

replace_exact(
    'scripts/verify-unified-factory-recipes-grid.mjs',
    "  '{!isFacilityDetail ? sectionSwitch : null}',\n",
    "  '{!isEntityDetail ? sectionSwitch : null}',\n  '<RegionalEntityPageTitle',\n",
)

# Page-content wrapper expects controlled embedded buildings in both region and global drilldowns.
replace_exact(
    'scripts/verify-page-content.mjs',
    "for (const text of [\n  '<EmbeddedMarketPage model={model} embedded />',\n  '<EmbeddedBuildingsPage model={model} embedded />',\n]) requireText('src/pages/ProvincePage.tsx', text);",
    "for (const text of [\n  '<EmbeddedMarketPage model={model} embedded />',\n  '<EmbeddedBuildingsPage',\n  'onDetailFacilityChange={setFacilityDetailTypeId}',\n]) requireText('src/pages/ProvincePage.tsx', text);",
)
replace_exact(
    'scripts/verify-page-content.mjs',
    "    '<EmbeddedBuildingsPage model={model} embedded />',\n",
    "    '<EmbeddedBuildingsPage',\n    'onDetailFacilityChange={setFacilityDetailTypeId}',\n",
)

# --- Browser regression updates --------------------------------------------------
replace_exact(
    'tests/browser/all-pages-preview.spec.ts',
    "  await expect(page.getByRole('heading', { level: 1, name: pages[0].heading })).toBeVisible();\n",
    "  const map = page.getByTestId('us-mainland-map');\n  await expect(map).toHaveAttribute('data-map-ready', 'true');\n  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);\n  await expect(page.locator('[data-player-page-navigation=\"true\"]')).toHaveCount(0);\n",
)
replace_exact(
    'tests/browser/all-pages-preview.spec.ts',
    "test('player page heading keeps SVG back, centered title, and SVG close in that order', async ({ page }) => {\n  await page.goto('?preview=game');\n\n",
    "test('player page heading keeps SVG back, centered title, and SVG close in that order', async ({ page }) => {\n  await page.goto('?preview=game');\n  await page.locator('.desktop-sidebar').getByRole('button', { name: /^概览/ }).click();\n\n",
)

# Market runtime title, volume, catalog and auto-trade assertions.
replace_exact(
    'tests/browser/market-runtime.spec.ts',
    "  await expect(page.getByRole('heading', { name: '加利福尼亚州 · 小麦', exact: true })).toBeVisible();\n",
    "  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');\n  await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚州');\n",
    count=2,
)
replace_exact(
    'tests/browser/market-runtime.spec.ts',
    "  await expect(tradeCard.locator('.market-trade-summary')).toContainText(/最近成交.*24h 变化.*可用小麦/);\n",
    "  await expect(tradeCard.locator('.market-trade-summary')).toContainText(/最近成交.*24h 变化.*24h 成交量/);\n",
)
replace_exact(
    'tests/browser/market-runtime.spec.ts',
    "  await expect(page.locator('.market-catalog-panel > .widget-heading')).toHaveCount(0);\n",
    "  await expect(page.locator('.market-catalog-panel')).toHaveCount(0);\n",
)
replace_exact(
    'tests/browser/market-runtime.spec.ts',
    '''test('market catalog owns auto-trade and never exposes a factory directory', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  await expect(page.getByRole('button', { name: '工厂', exact: true })).toHaveCount(0);
  await expect(page.locator('.market-catalog-list .facility-icon')).toHaveCount(0);
  expect(await page.locator('.market-catalog-list .product-artwork').count()).toBeGreaterThan(0);

  await page.getByRole('button', { name: '自动交易', exact: true }).click();
  await expect(page.locator('.market-auto-trade-workspace')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '自动交易商品' })).toBeVisible();
  await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
''',
    '''test('market commodity detail owns fixed auto-trade and catalog has no workspace switch', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto('market-runtime-test.html?scenario=active&view=catalog');

  await expect(page.getByRole('button', { name: '工厂', exact: true })).toHaveCount(0);
  await expect(page.locator('.market-catalog-list .facility-icon')).toHaveCount(0);
  await expect(page.locator('.market-workspace-switch')).toHaveCount(0);
  await expect(page.locator('.market-overview-metrics')).toHaveCount(0);
  await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
  expect(await page.locator('.market-catalog-list .product-artwork').count()).toBeGreaterThan(0);

  await page.getByRole('button', { name: '查看小麦详情' }).click();
  await expect(page.locator('.market-auto-trade-workspace--fixed')).toBeVisible();
  await expect(page.locator('.market-auto-trade-card')).toBeVisible();
  await expect(page.getByRole('combobox', { name: '自动交易商品' })).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-products')).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-card')).toContainText('小麦 · 自动交易');
  await expect(page.locator('.market-auto-trade-card').getByLabel('目标自由库存')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
''',
)
replace_exact(
    'tests/browser/market-runtime.spec.ts',
    '''  const layout = await page.locator('.market-catalog-panel').evaluate((panel) => {
    const row = panel.querySelector<HTMLElement>('.market-catalog-row');
''',
    '''  const layout = await page.locator('.market-catalog-surface').evaluate((panel) => {
    const row = panel.querySelector<HTMLElement>('.market-catalog-row');
''',
)

# Factory browser regression: two visual lines, muted region, entity larger, stable header.
replace_between(
    'tests/browser/buildings-ledger-layout.spec.ts',
    "  const titleStyle = await page.locator('.province-facility-detail-title').evaluate((element) => {\n",
    "\n  await page.locator('.page-navigation-button--back').click();",
    '''  const titleStyle = await page.locator('.regional-entity-title').evaluate((element) => {
    const name = element.querySelector<HTMLElement>('.regional-entity-title__name');
    const region = element.querySelector<HTMLElement>('.regional-entity-title__region');
    if (!name || !region) throw new Error('regional entity title is incomplete');
    const probe = document.createElement('span');
    probe.style.color = 'var(--color-text-muted)';
    document.body.appendChild(probe);
    const mutedColor = getComputedStyle(probe).color;
    probe.remove();
    return {
      name: name.textContent?.trim(),
      region: region.textContent?.trim(),
      nameFontSize: Number.parseFloat(getComputedStyle(name).fontSize),
      regionFontSize: Number.parseFloat(getComputedStyle(region).fontSize),
      regionColor: getComputedStyle(region).color,
      mutedColor,
      wrapperHeight: element.getBoundingClientRect().height,
    };
  });
  expect(titleStyle.name).toBe(factoryName);
  expect(titleStyle.region).toBe('加利福尼亚州');
  expect(titleStyle.nameFontSize).toBeGreaterThan(titleStyle.regionFontSize);
  expect(titleStyle.regionColor).toBe(titleStyle.mutedColor);
  expect(titleStyle.wrapperHeight).toBeLessThanOrEqual(40.5);
''',
)
replace_exact(
    'tests/browser/buildings-ledger-layout.spec.ts',
    "  await expect(page.locator('.province-facility-detail-title')).toBeVisible();\n",
    "  await expect(page.locator('.regional-entity-title')).toBeVisible();\n",
)

# Rewrite the auto-trade browser suite's market-specific tests for detail ownership.
warehouse_spec = read('tests/browser/warehouse-auto-sell.spec.ts')
first_test_start = warehouse_spec.find("  test('market auto-trade panel keeps its desktop control column'")
warehouse_test_start = warehouse_spec.find("  test('province warehouse stays read-only on mobile while transport remains available'", first_test_start)
last_test_start = warehouse_spec.find("  test('keeps the desktop side panel at 721px instead of opening a mobile sheet'", warehouse_test_start)
if min(first_test_start, warehouse_test_start, last_test_start) < 0:
    raise RuntimeError('warehouse auto sell browser test markers missing')
new_market_tests = '''  test('regional commodity detail keeps a fixed desktop auto-trade control', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await expect(page.locator('.market-workspace-switch')).toHaveCount(0);
    await expect(page.locator('.market-overview-metrics')).toHaveCount(0);
    await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    await expect(autoTradeCard).toBeVisible();
    await expect(page.locator('.market-auto-trade-products')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '自动交易商品' })).toHaveCount(0);
    await expect(autoTradeCard).toContainText('小麦 · 自动交易');
    await expect(autoTradeCard.getByRole('button', { name: '自动采购' })).toHaveAttribute('aria-pressed', 'true');
    await expect(autoTradeCard.getByLabel('目标自由库存')).toBeVisible();
    await autoTradeCard.getByRole('button', { name: '自动出售' }).click();
    await expect(autoTradeCard.getByLabel('最低自由库存')).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });

  test('regional market catalog removes workspace switches and opens fixed commodity auto-trade', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    const rows = page.locator('.market-catalog-row');
    expect(await rows.count()).toBeGreaterThan(1);
    await rows.last().click();
    await expect(page.locator('.market-auto-trade-workspace--fixed')).toBeVisible();
    await expect(page.locator('.market-auto-trade-card').getByRole('button', { name: '保存自动交易设置' })).toBeVisible();
  });

  test('regional commodity detail uses the shared bottom sheet at 720px', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    const trigger = page.getByRole('button', { name: '设置自动交易' });
    await expect(autoTradeCard).toBeHidden();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const sheet = page.locator('.mobile-detail-sheet');
    const detailView = sheet.locator('.mobile-workspace-sheet-detail-view');
    await expect(sheet).toBeVisible();
    await expect(detailView).toBeVisible();
    await expect(detailView).toContainText('小麦 · 自动交易');
    await expect(detailView.getByLabel('目标自由库存')).toBeVisible();
    await expect(detailView.locator('.mobile-detail-sheet-footer').getByRole('button', { name: '保存自动交易设置' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detailView).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

'''
# Keep warehouse test; replace old market tests before it.
warehouse_spec = warehouse_spec[:first_test_start] + new_market_tests + warehouse_spec[warehouse_test_start:last_test_start]
new_721 = '''  test('regional commodity detail keeps the fixed desktop control at 721px', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    await expect(autoTradeCard).toBeVisible();
    await expect(page.getByRole('button', { name: '设置自动交易' })).toBeHidden();
    await expect(autoTradeCard).toContainText('目标自由库存');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });
});
'''
warehouse_spec = warehouse_spec + new_721
write('tests/browser/warehouse-auto-sell.spec.ts', warehouse_spec)

# Additional static title requirements in market verifier.
replace_exact(
    'scripts/verify-market-page-layout.mjs',
    "requireText('src/pages/ProvincePage.tsx', '<EmbeddedMarketPage model={model} embedded />', '州级上下文必须继续复用地区 MarketPage。');\n",
    "requireText('src/pages/ProvincePage.tsx', '<EmbeddedMarketPage model={model} embedded />', '州级上下文必须继续复用地区 MarketPage。');\nrequireText('src/pages/ProvincePage.tsx', '<RegionalEntityPageTitle entityName={marketDetailProduct.name} regionName={provinceName} />', '州级商品详情必须使用共享两行地区实体标题。');\nrequireText('src/pages/MarketPage.tsx', 'fixedProductId={selectedProduct.id}', '地区商品详情必须承载当前商品固定自动交易设置。');\n",
)

# Ensure the UI design index names the shared title ownership.
replace_exact(
    'docs/README.md',
    '| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、战略页面面板与地图 Chrome、工作区浮层安全区、统一表单控件、统一 SVG 图标、统一导航角标视觉、商品与工厂场景插画主视觉、覆盖式滚动条、订单成交表、桌面导航行高、中文界面、响应式、移动触摸反馈与可访问性 |',
    '| `UI_DESIGN_SYSTEM.md` | 设计令牌、共享组件、地区实体两行标题、战略页面面板与地图 Chrome、工作区浮层安全区、统一表单控件、统一 SVG 图标、统一导航角标视觉、商品与工厂场景插画主视觉、覆盖式滚动条、订单成交表、桌面导航行高、中文界面、响应式、移动触摸反馈与可访问性 |',
)

print('regional market product page refactor applied')
