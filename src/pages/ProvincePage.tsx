import {
  lazy,
  Suspense,
  useState,
  type KeyboardEvent,
} from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { FacilityRecipeProfitMarketsProvider } from '../components/facilities/FacilityRecipeProfitContext';
import { WarehouseInventoryPanel } from '../components/warehouse/WarehouseInventoryPanel';
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
import { formatNumber } from '../utils/formatters';

const EmbeddedMarketPage = lazy(() => import('./MarketPage').then((module) => ({
  default: module.MarketPage,
})));
const EmbeddedBuildingsPage = lazy(() => import('./BuildingsPage').then((module) => ({
  default: module.BuildingsPage,
})));

const PROVINCE_SECTIONS = [
  { id: 'overview', label: '概览' },
  { id: 'market', label: '市场' },
  { id: 'buildings', label: '建筑' },
  { id: 'warehouse', label: '仓库' },
] as const;

type ProvinceSection = (typeof PROVINCE_SECTIONS)[number]['id'];

function ProvinceOverviewSection({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const summary = model.game.provinceAssetSummaries[model.selectedProvinceId] ?? {
    provinceId: model.selectedProvinceId,
    storedQuantity: 0,
    facilityCount: 0,
    runningFacilityCount: 0,
    blockedFacilityCount: 0,
    openOrderCount: 0,
  };
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
        <MetricCard label="本地库存" value={formatNumber(summary.storedQuantity)} />
        <MetricCard label="工厂总数" value={formatNumber(summary.facilityCount)} />
        <MetricCard
          label="运行中"
          value={formatNumber(summary.runningFacilityCount)}
          tone={summary.runningFacilityCount > 0 ? 'success' : 'neutral'}
        />
        <MetricCard
          label="本地挂单"
          value={formatNumber(summary.openOrderCount)}
          tone={summary.openOrderCount > 0 ? 'info' : 'neutral'}
        />
      </div>
      <DataList>
        <DataRow
          label="异常工厂"
          value={formatNumber(summary.blockedFacilityCount)}
          tone={summary.blockedFacilityCount > 0 ? 'danger' : 'neutral'}
        />
        <DataRow label="已停止工厂" value={formatNumber(stoppedFacilityCount)} />
      </DataList>
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
  const [activeSection, setActiveSection] = useState<ProvinceSection>('overview');
  const provinceName = model.selectedProvince?.name || '加利福尼亚州';

  const selectSection = (section: ProvinceSection, focus = false) => {
    setActiveSection(section);
    if (focus) {
      document.getElementById(`province-section-tab-${section}`)?.focus({ preventScroll: true });
    }
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
      title={provinceName}
      actions={sectionSwitch}
      backAction={{ label: '返回地图', onClick: () => model.setTab('map') }}
    >
      <section
        id="province-section-panel"
        className={`province-section-panel province-section-panel--${activeSection}`}
        role="tabpanel"
        aria-labelledby={`province-section-tab-${activeSection}`}
        tabIndex={0}
      >
        {activeSection === 'overview' ? <ProvinceOverviewSection model={model} /> : null}
        {activeSection === 'market' ? (
          <Suspense fallback={<ProvinceSectionLoading />}>
            <EmbeddedMarketPage model={model} embedded />
          </Suspense>
        ) : null}
        {activeSection === 'buildings' ? (
          <Suspense fallback={<ProvinceSectionLoading />}>
            <FacilityRecipeProfitMarketsProvider markets={model.game.markets}>
              <EmbeddedBuildingsPage model={model} embedded />
            </FacilityRecipeProfitMarketsProvider>
          </Suspense>
        ) : null}
        {activeSection === 'warehouse' ? (
          <WarehouseInventoryPanel model={model} className="province-warehouse-section" />
        ) : null}
      </section>
    </PageLayout>
  );
}
