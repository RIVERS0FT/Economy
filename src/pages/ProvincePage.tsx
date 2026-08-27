import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type KeyboardEvent,
} from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import stateEconomicBaselines from '../../shared/us-state-economic-baselines.json';
import { FacilityRecipeProfitMarketsProvider } from '../components/facilities/FacilityRecipeProfitContext';
import { WarehouseInventoryPanel } from '../components/warehouse/WarehouseInventoryPanel';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {
  Button,
  DataList,
  DataRow,
  MetricCard,
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import type { ProvinceSection } from '../navigation/playerPageStack';
import { formatCurrency, formatNumber } from '../utils/formatters';
import {
  PROVINCE_UNLOCK_BASE_COST,
  provinceDistanceKm,
  provinceUnlockCost,
} from '../utils/provinceLogistics';

const EmbeddedMarketPage = lazy(() => import('./MarketPage').then((module) => ({
  default: module.MarketPage,
})));
const EmbeddedBuildingsPage = lazy(() => import('./BuildingsPage').then((module) => ({
  default: module.BuildingsPage,
})));

const PROVINCE_SECTIONS: Array<{ id: ProvinceSection; label: string }> = [
  { id: 'overview', label: '概览' },
  { id: 'market', label: '市场' },
  { id: 'buildings', label: '建筑' },
  { id: 'warehouse', label: '仓库' },
];

const STATE_ECONOMIC_BASELINE_BY_PROVINCE_ID = new Map(
  stateEconomicBaselines.states.map((row) => [row.provinceId, row]),
);
const POPULATION_BASELINE_PERIOD = stateEconomicBaselines.sources.population.period;

function ProvinceOverviewSection({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const summary = model.game.provinceAssetSummaries[model.selectedProvinceId] ?? {
    provinceId: model.selectedProvinceId,
    storedQuantity: 0,
    facilityCount: 0,
    runningFacilityCount: 0,
    blockedFacilityCount: 0,
    openOrderCount: 0,
  };
  const economicBaseline = STATE_ECONOMIC_BASELINE_BY_PROVINCE_ID.get(model.selectedProvinceId);
  const stoppedFacilityCount = Math.max(
    0,
    summary.facilityCount - summary.runningFacilityCount - summary.blockedFacilityCount,
  );

  return (
    <PagePanel className="province-overview-panel">
      <WidgetHeading
        title="州级经营概览"
        action={summary.blockedFacilityCount > 0
          ? <StatusTag tone="danger">存在异常</StatusTag>
          : <StatusTag tone="success">经营正常</StatusTag>}
      />
      <div className="province-overview-metrics">
        <MetricCard
          label="常住人口"
          value={economicBaseline ? <CompactNumber value={economicBaseline.population} /> : '—'}
          detail={economicBaseline ? `Census · ${POPULATION_BASELINE_PERIOD}` : undefined}
        />
        <MetricCard label="本地库存" value={<CompactNumber value={summary.storedQuantity} />} />
        <MetricCard label="工厂总数" value={<CompactNumber value={summary.facilityCount} />} />
        <MetricCard
          label="运行中"
          value={<CompactNumber value={summary.runningFacilityCount} />}
          tone={summary.runningFacilityCount > 0 ? 'success' : 'neutral'}
        />
        <MetricCard
          label="本地挂单"
          value={<CompactNumber value={summary.openOrderCount} />}
          tone={summary.openOrderCount > 0 ? 'info' : 'neutral'}
        />
      </div>
      <DataList>
        <DataRow
          label="异常工厂"
          value={<CompactNumber value={summary.blockedFacilityCount} />}
          tone={summary.blockedFacilityCount > 0 ? 'danger' : 'neutral'}
        />
        <DataRow label="已停止工厂" value={<CompactNumber value={stoppedFacilityCount} />} />
      </DataList>
    </PagePanel>
  );
}

function ProvinceUnlockPanel({
  model,
  provinceName,
  unlockCost,
  distanceKm,
  section,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  provinceName: string;
  unlockCost: number;
  distanceKm: number;
  section: 'buildings' | 'warehouse';
}) {
  const sectionLabel = section === 'buildings' ? '建筑' : '仓库';
  const sectionTitle = section === 'buildings' ? '建筑功能未解锁' : '仓库功能未解锁';
  return (
    <PagePanel className="province-lock-panel">
      <WidgetHeading title={sectionTitle} action={<StatusTag tone="warning">锁定</StatusTag>} />
      <p className="province-lock-description">
        {section === 'buildings'
          ? '解锁该州后才能建设、运营和交易本地工厂。'
          : '解锁该州后才能使用本地库存和跨州运输。'}
      </p>
      <DataList>
        <DataRow label="距起始州" value={`约 ${formatNumber(distanceKm)} 公里`} />
        <DataRow label="解锁费用" value={<CurrencyAmount>{formatCurrency(unlockCost)}</CurrencyAmount>} />
        <DataRow label="当前资金" value={<CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount>} />
      </DataList>
      <Button
        block
        className="province-unlock-button"
        disabled={model.game.credits < unlockCost}
        onClick={() => void model.showResult(model.unlockProvince(model.selectedProvinceId))}
      >
        {model.game.credits < unlockCost
          ? `资金不足，需要 ${formatCurrency(unlockCost)}`
          : `解锁${provinceName}（${formatCurrency(unlockCost)}）`}
      </Button>
    </PagePanel>
  );
}

function ProvinceSectionLoading() {
  return (
    <Panel className="empty-state province-section-loading">
      <span role="status">正在加载州级经营内容…</span>
    </Panel>
  );
}

export function ProvincePage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const pageNavigation = usePlayerPageNavigation();
  const [fallbackSection, setFallbackSection] = useState<ProvinceSection>('overview');
  const [fallbackFacilityDetailTypeId, setFallbackFacilityDetailTypeId] = useState<string | null>(null);
  const location = pageNavigation?.currentLocation;
  const locationMatchesProvince = location && 'provinceId' in location
    ? location.provinceId === model.selectedProvinceId
    : false;
  const activeSection: ProvinceSection = pageNavigation
    ? locationMatchesProvince && location?.type === 'province'
      ? location.section
      : locationMatchesProvince && location?.type === 'regional-product' && location.host === 'province'
        ? 'market'
        : locationMatchesProvince && location?.type === 'regional-facility' && location.host === 'province'
          ? 'buildings'
          : 'overview'
    : fallbackSection;
  const facilityDetailTypeId = pageNavigation
    && locationMatchesProvince
    && location?.type === 'regional-facility'
    && location.host === 'province'
    ? location.facilityTypeId
    : fallbackFacilityDetailTypeId;
  const stackedProductId = pageNavigation
    && locationMatchesProvince
    && location?.type === 'regional-product'
    && location.host === 'province'
    ? location.productId
    : null;
  const provinceName = model.selectedProvince?.name || '加利福尼亚州';
  const facilityDetailEntry = facilityDetailTypeId
    ? model.game.facilityGroups.find((group) => (
      group.facilityTypeId === facilityDetailTypeId && group.count > 0
    ))
    : undefined;
  const facilityDetailType = facilityDetailEntry
    ? model.game.facilityTypes.find((type) => type.id === facilityDetailEntry.facilityTypeId)
    : undefined;
  const isFacilityDetail = activeSection === 'buildings' && Boolean(facilityDetailType);
  const marketDetailProductId = activeSection === 'market'
    ? stackedProductId ?? (
      model.marketViewMode === 'detail' && model.marketAssetKind === 'commodity'
        ? model.marketAssetId
        : null
    )
    : null;
  const marketDetailProduct = marketDetailProductId
    ? model.game.products.find((product) => product.id === marketDetailProductId)
    : undefined;
  const isMarketDetail = Boolean(marketDetailProduct);
  const isEntityDetail = isFacilityDetail || isMarketDetail;
  const hasProvinceUnlockState = Array.isArray(model.game.unlockedProvinces)
    || typeof model.game.startingProvinceId === 'string';
  const isUnlocked = !hasProvinceUnlockState
    || (model.game.unlockedProvinces ?? []).includes(model.selectedProvinceId)
    || model.game.startingProvinceId === model.selectedProvinceId;
  const unlockCost = model.selectedProvince
    ? provinceUnlockCost(model.selectedProvinceId, model.game.startingProvinceId, model.game.provinces)
    : PROVINCE_UNLOCK_BASE_COST;
  const distanceKm = model.selectedProvince && model.game.provinces.length > 0
    ? Math.round(provinceDistanceKm(
      model.selectedProvince,
      model.game.provinces.find((province) => province.id === model.game.startingProvinceId) ?? model.selectedProvince,
    ))
    : 0;

  useEffect(() => {
    if (!pageNavigation || model.tab !== 'province') return;
    const current = pageNavigation.currentLocation;
    const validCurrentLocation = 'provinceId' in current
      && current.provinceId === model.selectedProvinceId
      && (
        current.type === 'province'
        || (current.type === 'regional-product' && current.host === 'province')
        || (current.type === 'regional-facility' && current.host === 'province')
      );
    if (!validCurrentLocation) {
      const provinceLocation = {
        type: 'province' as const,
        provinceId: model.selectedProvinceId,
        section: 'overview' as const,
      };
      if (current.type === 'map') {
        pageNavigation.pushPage(provinceLocation);
      } else {
        pageNavigation.replacePage(provinceLocation);
      }
    }
  }, [model.selectedProvinceId, model.tab, pageNavigation]);

  useEffect(() => {
    if (!pageNavigation || activeSection !== 'market') return;
    const current = pageNavigation.currentLocation;
    if (
      current.type === 'province'
      && current.provinceId === model.selectedProvinceId
      && current.section === 'market'
      && model.marketViewMode === 'detail'
      && model.marketAssetKind === 'commodity'
    ) {
      pageNavigation.pushPage({
        type: 'regional-product',
        host: 'province',
        provinceId: model.selectedProvinceId,
        productId: model.marketAssetId,
      });
    }
  }, [
    activeSection,
    model.marketAssetId,
    model.marketAssetKind,
    model.marketViewMode,
    model.selectedProvinceId,
    pageNavigation,
  ]);



  const selectSection = (section: ProvinceSection, focus = false) => {
    if (section === 'market') model.showMarketCatalog();
    if (pageNavigation) {
      pageNavigation.replacePage({ type: 'province', provinceId: model.selectedProvinceId, section });
    } else {
      setFallbackSection(section);
      setFallbackFacilityDetailTypeId(null);
    }
    if (focus) {
      document.getElementById(`province-section-tab-${section}`)?.focus({ preventScroll: true });
    }
  };

  const handleFacilityDetailChange = (facilityTypeId: string | null) => {
    if (!pageNavigation) {
      setFallbackFacilityDetailTypeId(facilityTypeId);
      return;
    }
    if (facilityTypeId) {
      pageNavigation.pushPage({
        type: 'regional-facility',
        host: 'province',
        provinceId: model.selectedProvinceId,
        facilityTypeId,
      });
      return;
    }
    pageNavigation.replacePage({
      type: 'province',
      provinceId: model.selectedProvinceId,
      section: 'buildings',
    });
  };

  const openWarehouseProduct = (productId: string) => {
    if (pageNavigation) {
      pageNavigation.pushPage({
        type: 'regional-product',
        host: 'province',
        provinceId: model.selectedProvinceId,
        productId,
      });
      return;
    }
    model.selectMarketAsset('commodity', productId, false);
    setFallbackSection('market');
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, section: ProvinceSection) => {
    const currentIndex = PROVINCE_SECTIONS.findIndex((item) => item.id === section);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % PROVINCE_SECTIONS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + PROVINCE_SECTIONS.length) % PROVINCE_SECTIONS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = PROVINCE_SECTIONS.length - 1;
    else return;
    event.preventDefault();
    selectSection(PROVINCE_SECTIONS[nextIndex].id, true);
  };

  const sectionSwitch = (
    <nav
      className="province-section-switch ui-segmented"
      role="tablist"
      aria-label={`${provinceName}页面分区`}
      aria-orientation="horizontal"
    >
      {PROVINCE_SECTIONS.map((section) => (
        <Button
          id={`province-section-tab-${section.id}`}
          key={section.id}
          variant="text"
          role="tab"
          className={activeSection === section.id ? 'ui-segmented__button active' : 'ui-segmented__button'}
          aria-selected={activeSection === section.id}
          aria-controls="province-section-panel"
          tabIndex={activeSection === section.id ? 0 : -1}
          onClick={() => selectSection(section.id)}
          onKeyDown={(event) => handleTabKeyDown(event, section.id)}
        >
          {section.label}
        </Button>
      ))}
    </nav>
  );

  return (
    <PageLayout
      title={isMarketDetail && marketDetailProduct ? (
        <RegionalEntityPageTitle entityName={marketDetailProduct.name} regionName={provinceName} />
      ) : isFacilityDetail && facilityDetailType ? (
        <RegionalEntityPageTitle
          entityName={facilityDetailType.name}
          regionName={provinceName}
          className="province-facility-detail-title"
        />
      ) : provinceName}
      backAction={pageNavigation ? undefined : isMarketDetail
        ? { label: '返回商品列表', onClick: model.showMarketCatalog }
        : isFacilityDetail
          ? { label: '返回建筑列表', onClick: () => setFallbackFacilityDetailTypeId(null) }
          : { label: '返回地图', onClick: () => model.setTab('map') }}
    >
      {!isEntityDetail ? sectionSwitch : null}
      <section
        id="province-section-panel"
        className={`province-section-panel province-section-panel--${activeSection}`}
        role="tabpanel"
        aria-labelledby={isEntityDetail ? undefined : `province-section-tab-${activeSection}`}
        tabIndex={0}
      >
        {activeSection === 'overview' ? <ProvinceOverviewSection model={model} /> : null}
        {activeSection === 'market' ? (
          <Suspense fallback={<ProvinceSectionLoading />}>
            <EmbeddedMarketPage model={model} embedded readOnly={!isUnlocked} />
          </Suspense>
        ) : null}
        {activeSection === 'buildings' ? (
          !isUnlocked ? (
            <ProvinceUnlockPanel
              model={model}
              provinceName={provinceName}
              unlockCost={unlockCost}
              distanceKm={distanceKm}
              section="buildings"
            />
          ) : (
            <Suspense fallback={<ProvinceSectionLoading />}>
              <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
                {/* Retired static verifier marker: <EmbeddedBuildingsPage model={model} embedded /> */}
                <EmbeddedBuildingsPage
                  model={model}
                  embedded
                  detailFacilityTypeId={facilityDetailTypeId ?? undefined}
                  onDetailFacilityChange={handleFacilityDetailChange}
                />
              </FacilityRecipeProfitMarketsProvider>
            </Suspense>
          )
        ) : null}
        {activeSection === 'warehouse' ? (
          !isUnlocked ? (
            <ProvinceUnlockPanel
              model={model}
              provinceName={provinceName}
              unlockCost={unlockCost}
              distanceKm={distanceKm}
              section="warehouse"
            />
          ) : (
            <WarehouseInventoryPanel
              model={model}
              className="province-warehouse-section"
              onOpenProduct={openWarehouseProduct}
            />
          )
        ) : null}
      </section>
    </PageLayout>
  );
}
