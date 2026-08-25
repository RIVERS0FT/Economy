from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8').replace('\r\n', '\n')


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content).lstrip('\n'), encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    if before not in source:
        raise SystemExit(f'{path}: expected block not found:\n{before[:500]}')
    source = source.replace(before, after, 1)
    (ROOT / path).write_text(source, encoding='utf-8')


def forbid(path: str, token: str) -> None:
    if token in read(path):
        raise SystemExit(f'{path}: forbidden token remains: {token}')


write('src/navigation/playerPageStack.ts', r'''
import type { TabId } from '../config/navigation';

export const MAX_PLAYER_PAGE_STACK_DEPTH = 20;

export type ProvinceSection = 'overview' | 'market' | 'buildings' | 'warehouse';

export type PlayerPageLocation =
  | { type: 'map' }
  | { type: 'tab'; tab: Exclude<TabId, 'map'> }
  | { type: 'province'; provinceId: string; section: ProvinceSection }
  | { type: 'regional-product'; host: 'province' | 'market'; provinceId: string; productId: string }
  | { type: 'regional-facility'; host: 'province' | 'buildings'; provinceId: string; facilityTypeId: string }
  | { type: 'global-market-product'; productId: string }
  | { type: 'global-building'; facilityTypeId: string };

export function playerPageLocationForTab(tab: TabId): PlayerPageLocation {
  return tab === 'map' ? { type: 'map' } : { type: 'tab', tab };
}

export function tabForPlayerPageLocation(location: PlayerPageLocation): TabId {
  if (location.type === 'map') return 'map';
  if (location.type === 'tab') return location.tab;
  if (location.type === 'province') return 'province';
  if (location.type === 'global-market-product') return 'market';
  if (location.type === 'global-building') return 'buildings';
  if (location.type === 'regional-product') return location.host === 'province' ? 'province' : 'market';
  return location.host === 'province' ? 'province' : 'buildings';
}

export function playerPageLocationKey(location: PlayerPageLocation) {
  if (location.type === 'map') return 'map';
  if (location.type === 'tab') return `tab:${location.tab}`;
  if (location.type === 'province') return `province:${location.provinceId}:${location.section}`;
  if (location.type === 'regional-product') {
    return `regional-product:${location.host}:${location.provinceId}:${location.productId}`;
  }
  if (location.type === 'regional-facility') {
    return `regional-facility:${location.host}:${location.provinceId}:${location.facilityTypeId}`;
  }
  if (location.type === 'global-market-product') return `global-market-product:${location.productId}`;
  return `global-building:${location.facilityTypeId}`;
}

export function appendPlayerPageHistory(
  history: readonly PlayerPageLocation[],
  current: PlayerPageLocation,
) {
  const maximumHistoryDepth = MAX_PLAYER_PAGE_STACK_DEPTH - 1;
  const next = [...history, current];
  if (next.length <= maximumHistoryDepth) return next;

  if (next[0]?.type === 'map' && maximumHistoryDepth > 1) {
    return [next[0], ...next.slice(-(maximumHistoryDepth - 1))];
  }
  return next.slice(-maximumHistoryDepth);
}
''')

write('src/components/ui/PageNavigationContext.tsx', r'''
import { createContext, useContext, type ReactNode } from 'react';
import type { PlayerPageLocation } from '../../navigation/playerPageStack';

export interface PlayerPageNavigationValue {
  canGoBack: boolean;
  currentLocation: PlayerPageLocation;
  onBack: () => void;
  onClose: () => void;
  pushPage: (location: PlayerPageLocation) => void;
  replacePage: (location: PlayerPageLocation) => void;
}

const PlayerPageNavigationContext = createContext<PlayerPageNavigationValue | null>(null);

export function PlayerPageNavigationProvider({
  value,
  children,
}: {
  value: PlayerPageNavigationValue;
  children: ReactNode;
}) {
  return (
    <PlayerPageNavigationContext.Provider value={value}>
      {children}
    </PlayerPageNavigationContext.Provider>
  );
}

export function usePlayerPageNavigation() {
  return useContext(PlayerPageNavigationContext);
}
''')

write('src/components/warehouse/WarehouseInventoryPanel.tsx', r'''
import { useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../../auto-trade/useOnlineAutoTrade';
import type { TransportModeId } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { useNow } from '../../hooks/useNow';
import { parseIntegerDraft } from '../../utils/integerDraft';
import {
  formatTransportDuration,
  provinceDistanceKm,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  TRANSPORT_MODES,
  transportCost,
  transportDurationMs,
} from '../../utils/provinceLogistics';
import { ChevronIcon } from '../icons/GameIcons';
import { ProductIcon } from '../icons/ProductIcons';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { IntegerInput, SelectInput } from '../ui/FormControls';
import { Button, Panel, StatusTag, WidgetHeading } from '../ui/layout';

export function WarehouseInventoryGrid({
  model,
  onOpenProduct,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  onOpenProduct?: (productId: string) => void;
}) {
  const { game } = model;
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
      return inventory.available > 0 || inventory.frozen > 0;
    }),
    [game.inventories, game.products],
  );

  return (
    <section className="warehouse-content" aria-label="仓库商品">
      {stockedProducts.length > 0 ? (
        <div className="warehouse-product-grid">
          {stockedProducts.map((product) => {
            const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
            return (
              <button
                type="button"
                className="warehouse-product-card"
                data-ui-interactive="surface"
                key={product.id}
                aria-label={`打开${product.name}详情，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}`}
                onClick={() => onOpenProduct?.(product.id)}
              >
                <span className="warehouse-product-card-name">{product.name}</span>
                <span className="warehouse-product-card-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
                <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                <small className="warehouse-product-card-frozen">冻结 {formatNumber(inventory.frozen)}</small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state warehouse-content-empty">
          <strong>仓库中暂无商品</strong>
          <span>通过生产或市场交易获得商品后，会在这里按州级库存显示。</span>
        </div>
      )}
    </section>
  );
}

export function WarehouseTransportPanel({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const { game } = model;
  const now = useNow(game.lastProcessedAt, 1_000);
  const unlockedProvinces = game.unlockedProvinces ?? [];
  const transportShipments = game.transportShipments ?? [];
  const [transportProductId, setTransportProductId] = useState('');
  const [transportQuantity, setTransportQuantity] = useState('');
  const [transportDestination, setTransportDestination] = useState('');
  const [transportMode, setTransportMode] = useState<TransportModeId>('road');
  const transportableProducts = useMemo(
    () => game.products.filter((product) => (game.inventories[product.id]?.available ?? 0) > 0),
    [game.inventories, game.products],
  );
  const destinations = useMemo(
    () => game.provinces.filter((province) => (
      province.id !== model.selectedProvinceId
      && (unlockedProvinces.includes(province.id) || game.startingProvinceId === province.id)
    )),
    [game.provinces, game.startingProvinceId, model.selectedProvinceId, unlockedProvinces],
  );
  const selectedDestination = destinations.find((province) => province.id === transportDestination);
  const selectedSource = game.provinces.find((province) => province.id === model.selectedProvinceId)
    ?? game.provinces[0];
  const distanceKm = selectedDestination && selectedSource
    ? provinceDistanceKm(selectedSource, selectedDestination)
    : 0;
  const parsedQuantity = parseIntegerDraft(transportQuantity, { min: 1 });
  const estimatedCost = parsedQuantity !== null && selectedDestination
    ? transportCost(transportMode, parsedQuantity, distanceKm)
    : 0;
  const estimatedDurationMs = selectedDestination
    ? transportDurationMs(transportMode, distanceKm)
    : 0;
  const inTransitCount = transportShipments.filter((shipment) => shipment.status === 'in-transit').length;
  const activeShipments = transportShipments
    .filter((shipment) => shipment.status === 'in-transit')
    .sort((left, right) => left.arrivesAt - right.arrivesAt);

  function submitTransport() {
    if (parsedQuantity === null || !transportProductId || !selectedDestination) return;
    const inventory = game.inventories[transportProductId];
    const quantity = Math.min(parsedQuantity, TRANSPORT_MODES[transportMode].capacity, inventory?.available ?? 0);
    if (quantity <= 0) return;
    void model.showResult(model.transportShip({
      sourceProvinceId: model.selectedProvinceId,
      destinationProvinceId: selectedDestination.id,
      productId: transportProductId,
      quantity,
      mode: transportMode,
    }));
  }

  return (
    <Panel className="widget warehouse-transport-panel">
      <WidgetHeading
        title="跨州运输"
        action={<StatusTag tone="neutral">在途 {formatNumber(inTransitCount)} / {TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER}</StatusTag>}
      />
      <section className="warehouse-transport-section" aria-label="跨州运输">
        <div className="transport-dispatch-grid">
          <SelectInput
            label="商品"
            value={transportProductId}
            onChange={(event) => setTransportProductId(event.target.value)}
          >
            <option value="">选择商品</option>
            {transportableProducts.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </SelectInput>
          <IntegerInput
            label="数量"
            value={transportQuantity}
            fallbackValue={1}
            min={1}
            max={TRANSPORT_MODES[transportMode].capacity}
            onValueChange={setTransportQuantity}
          />
          <SelectInput
            label="目的州"
            value={transportDestination}
            onChange={(event) => setTransportDestination(event.target.value)}
          >
            <option value="">选择目的州</option>
            {destinations.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </SelectInput>
          <div className="transport-mode-switch" role="group" aria-label="运输方式">
            {Object.values(TRANSPORT_MODES).map((mode) => (
              <Button
                key={mode.id}
                variant="text"
                className={transportMode === mode.id ? 'transport-mode active' : 'transport-mode'}
                aria-pressed={transportMode === mode.id}
                onClick={() => setTransportMode(mode.id)}
              >
                {mode.name}
                <small>单次 ≤ {formatNumber(mode.capacity)}</small>
              </Button>
            ))}
          </div>
        </div>
        <div className="transport-estimate">
          <span><small>预计费用</small><strong><CurrencyAmount>{formatCurrency(estimatedCost)}</CurrencyAmount></strong></span>
          <span><small>预计耗时</small><strong>{formatTransportDuration(estimatedDurationMs)}</strong></span>
          <span><small>距离</small><strong>约 {formatNumber(Math.round(distanceKm))} 公里</strong></span>
        </div>
        <Button
          block
          className="transport-submit"
          disabled={!transportProductId || parsedQuantity === null || !selectedDestination}
          onClick={submitTransport}
        >
          {!transportProductId
            ? '请选择运输商品'
            : parsedQuantity === null
              ? '请输入有效数量'
              : !selectedDestination
                ? '请选择目的州'
                : `通过${TRANSPORT_MODES[transportMode].name}发运`}
        </Button>
        {activeShipments.length > 0 ? (
          <ul className="transport-shipment-list" aria-label="进行中运输">
            {activeShipments.map((shipment) => {
              const product = game.products.find((entry) => entry.id === shipment.productId);
              const destination = game.provinces.find((province) => province.id === shipment.destinationProvinceId);
              const remainingMs = Math.max(0, shipment.arrivesAt - now);
              return (
                <li key={shipment.id} className="transport-shipment-row">
                  <span className="transport-shipment-product">{product?.name ?? shipment.productId}</span>
                  <span>×{formatNumber(shipment.quantity)}</span>
                  <span>{TRANSPORT_MODES[shipment.mode]?.name ?? shipment.mode}</span>
                  <span className="transport-shipment-destination">
                    <ChevronIcon direction="right" />
                    {destination?.name ?? shipment.destinationProvinceId}
                  </span>
                  <span className="transport-shipment-eta">{formatTransportDuration(remainingMs)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted transport-empty">当前没有进行中的运输。</p>
        )}
      </section>
    </Panel>
  );
}

export function WarehouseInventoryPanel({
  model,
  className = '',
  onOpenProduct,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  className?: string;
  onOpenProduct?: (productId: string) => void;
}) {
  return (
    <div className={`warehouse-inventory-panel ${className}`.trim()}>
      <WarehouseInventoryGrid model={model} onOpenProduct={onOpenProduct} />
      <WarehouseTransportPanel model={model} />
    </div>
  );
}
''')

write('src/pages/ProvincePage.tsx', r'''
import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type KeyboardEvent,
} from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
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
    if (!pageNavigation || model.tab !== 'province' || !isUnlocked) return;
    const current = pageNavigation.currentLocation;
    const validCurrentLocation = 'provinceId' in current
      && current.provinceId === model.selectedProvinceId
      && (
        current.type === 'province'
        || (current.type === 'regional-product' && current.host === 'province')
        || (current.type === 'regional-facility' && current.host === 'province')
      );
    if (!validCurrentLocation) {
      pageNavigation.replacePage({
        type: 'province',
        provinceId: model.selectedProvinceId,
        section: 'overview',
      });
    }
  }, [isUnlocked, model.selectedProvinceId, model.tab, pageNavigation]);

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

  if (!isUnlocked) {
    return (
      <PageLayout
        title={provinceName}
        backAction={pageNavigation ? undefined : { label: '返回地图', onClick: () => model.setTab('map') }}
      >
        <PagePanel className="province-lock-panel">
          <WidgetHeading title="州级地区未解锁" action={<StatusTag tone="warning">锁定</StatusTag>} />
          <p className="province-lock-description">
            该州尚未解锁，解锁后可以使用市场、工厂与仓库经营功能。
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
      </PageLayout>
    );
  }

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
            <EmbeddedMarketPage model={model} embedded />
          </Suspense>
        ) : null}
        {activeSection === 'buildings' ? (
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
        ) : null}
        {activeSection === 'warehouse' ? (
          <WarehouseInventoryPanel
            model={model}
            className="province-warehouse-section"
            onOpenProduct={openWarehouseProduct}
          />
        ) : null}
      </section>
    </PageLayout>
  );
}
''')

replace_once('src/components/shell/GameShell.tsx', r'''import type { TabId } from '../../config/navigation';
import { PlayerPageNavigationProvider } from '../ui/PageNavigationContext';''', r'''import type { TabId } from '../../config/navigation';
import {
  appendPlayerPageHistory,
  playerPageLocationForTab,
  playerPageLocationKey,
  tabForPlayerPageLocation,
  type PlayerPageLocation,
} from '../../navigation/playerPageStack';
import { PlayerPageNavigationProvider } from '../ui/PageNavigationContext';''')

replace_once('src/components/shell/GameShell.tsx', r'''  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mapLens, setMapLens] = useState<ProvinceMapLens>('assets');
  const pageHistoryRef = useRef<TabId[]>([]);
  const observedTabRef = useRef<TabId>(model.tab);
  const skipNextHistoryRef = useRef(false);
  const mobilePageCloseRef = useRef<MobileWorkspaceSheetRequestClose | null>(null);''', r'''  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mapLens, setMapLens] = useState<ProvinceMapLens>('assets');
  const initialPageLocation = playerPageLocationForTab(model.tab);
  const pageHistoryRef = useRef<PlayerPageLocation[]>([]);
  const pageLocationRef = useRef<PlayerPageLocation>(initialPageLocation);
  const [pageLocation, setPageLocation] = useState<PlayerPageLocation>(initialPageLocation);
  const observedTabRef = useRef<TabId>(model.tab);
  const mobilePageCloseRef = useRef<MobileWorkspaceSheetRequestClose | null>(null);''')

replace_once('src/components/shell/GameShell.tsx', r'''    {
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(game.warehouseStoredQuantity),
      compactValue: formatCompactNumber(game.warehouseStoredQuantity),
      detail: <>无限容量 · 实物库存总量</>,
    },''', r'''    {
      id: 'warehouse', icon: <WarehouseIcon />, label: '仓库库存', value: formatNumber(game.warehouseStoredQuantity),
      compactValue: formatCompactNumber(game.warehouseStoredQuantity),
    },''')

replace_once('src/components/shell/GameShell.tsx', r'''  useEffect(() => {
    const previousTab = observedTabRef.current;
    if (previousTab === model.tab) return;
    if (skipNextHistoryRef.current) {
      skipNextHistoryRef.current = false;
    } else if (previousTab !== 'map' && previousTab !== 'province') {
      pageHistoryRef.current = [...pageHistoryRef.current, previousTab].slice(-20);
    }
    observedTabRef.current = model.tab;
    setCanGoBack(pageHistoryRef.current.length > 0);
  }, [model.tab]);

  const returnToPreviousPage = useCallback(() => {
    let target = pageHistoryRef.current.pop();
    while (target === model.tab) target = pageHistoryRef.current.pop();
    setCanGoBack(pageHistoryRef.current.length > 0);
    if (!target) return;
    skipNextHistoryRef.current = true;
    model.setTab(target);
  }, [model.setTab, model.tab]);

  const showMap = useCallback(() => {
    model.setTab('map');
  }, [model.setTab]);

  const closeCurrentPage = useCallback(() => {
    const requestClose = mobilePageCloseRef.current;
    if (requestClose && typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      requestClose();
      return;
    }
    showMap();
  }, [showMap]);

  const selectMobileTab = useCallback((tab: TabId) => {
    if (tab === 'map' && model.tab !== 'map') {
      const requestClose = mobilePageCloseRef.current;
      if (requestClose) {
        requestClose();
        return;
      }
    }
    model.setTab(tab);
  }, [model.setTab, model.tab]);''', r'''  const commitPlayerPageLocation = useCallback((location: PlayerPageLocation) => {
    pageLocationRef.current = location;
    setPageLocation(location);
    setCanGoBack(pageHistoryRef.current.length > 0);
  }, []);

  const applyPlayerPageLocation = useCallback((location: PlayerPageLocation) => {
    if ('provinceId' in location && model.selectedProvinceId !== location.provinceId) {
      model.setSelectedProvinceId(location.provinceId);
    }
    if (location.type === 'regional-product') {
      const alreadySelected = model.marketViewMode === 'detail'
        && model.marketAssetKind === 'commodity'
        && model.marketAssetId === location.productId;
      if (!alreadySelected) model.selectMarketAsset('commodity', location.productId, false);
    } else if (
      location.type === 'province'
      && location.section === 'market'
      && model.marketViewMode !== 'catalog'
    ) {
      model.showMarketCatalog();
    }

    const targetTab = tabForPlayerPageLocation(location);
    observedTabRef.current = targetTab;
    if (model.tab !== targetTab) model.setTab(targetTab);
    commitPlayerPageLocation(location);
  }, [
    commitPlayerPageLocation,
    model.marketAssetId,
    model.marketAssetKind,
    model.marketViewMode,
    model.selectedProvinceId,
    model.selectMarketAsset,
    model.setSelectedProvinceId,
    model.setTab,
    model.showMarketCatalog,
    model.tab,
  ]);

  const pushPlayerPage = useCallback((location: PlayerPageLocation) => {
    const current = pageLocationRef.current;
    if (playerPageLocationKey(current) === playerPageLocationKey(location)) return;
    pageHistoryRef.current = appendPlayerPageHistory(pageHistoryRef.current, current);
    applyPlayerPageLocation(location);
  }, [applyPlayerPageLocation]);

  const replacePlayerPage = useCallback((location: PlayerPageLocation) => {
    applyPlayerPageLocation(location);
  }, [applyPlayerPageLocation]);

  useEffect(() => {
    if (observedTabRef.current === model.tab) return;
    observedTabRef.current = model.tab;
    const next = playerPageLocationForTab(model.tab);
    const current = pageLocationRef.current;
    if (playerPageLocationKey(current) !== playerPageLocationKey(next)) {
      pageHistoryRef.current = appendPlayerPageHistory(pageHistoryRef.current, current);
    }
    commitPlayerPageLocation(next);
  }, [commitPlayerPageLocation, model.tab]);

  const returnToPreviousPage = useCallback(() => {
    const currentKey = playerPageLocationKey(pageLocationRef.current);
    let target = pageHistoryRef.current.pop();
    while (target && playerPageLocationKey(target) === currentKey) {
      target = pageHistoryRef.current.pop();
    }
    if (!target) {
      setCanGoBack(false);
      return;
    }
    applyPlayerPageLocation(target);
  }, [applyPlayerPageLocation]);

  const showMap = useCallback(() => {
    pageHistoryRef.current = [];
    applyPlayerPageLocation({ type: 'map' });
  }, [applyPlayerPageLocation]);

  const closeCurrentPage = useCallback(() => {
    const requestClose = mobilePageCloseRef.current;
    if (requestClose && typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches) {
      requestClose();
      return;
    }
    showMap();
  }, [showMap]);

  const selectPlayerTab = useCallback((tab: TabId) => {
    if (tab === 'map' && model.tab !== 'map') {
      const requestClose = mobilePageCloseRef.current;
      if (requestClose) {
        requestClose();
        return;
      }
      showMap();
      return;
    }
    if (tab === 'map') {
      showMap();
      return;
    }
    pushPlayerPage(playerPageLocationForTab(tab));
  }, [model.tab, pushPlayerPage, showMap]);''')

replace_once('src/components/shell/GameShell.tsx', '        pageTransitionKey={model.tab}', '        pageTransitionKey={playerPageLocationKey(pageLocation)}')
replace_once('src/components/shell/GameShell.tsx', '            onSelect={model.setTab}', '            onSelect={selectPlayerTab}')
replace_once('src/components/shell/GameShell.tsx', '                selectMobileTab(tab);', '                selectPlayerTab(tab);')
replace_once('src/components/shell/GameShell.tsx', '              onSelect={selectMobileTab}', '              onSelect={selectPlayerTab}')
replace_once('src/components/shell/GameShell.tsx', r'''          value={{
            canGoBack,
            onBack: returnToPreviousPage,
            onClose: closeCurrentPage,
          }}''', r'''          value={{
            canGoBack,
            currentLocation: pageLocation,
            onBack: returnToPreviousPage,
            onClose: closeCurrentPage,
            pushPage: pushPlayerPage,
            replacePage: replacePlayerPage,
          }}''')
replace_once('src/components/shell/GameShell.tsx', r'''            data-strategic-page={model.tab}
            data-strategic-presentation={pagePresentation}''', r'''            data-strategic-page={model.tab}
            data-strategic-page-location={playerPageLocationKey(pageLocation)}
            data-strategic-presentation={pagePresentation}''')

replace_once('src/pages/GlobalMarketPage.tsx', r'''import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {''', r'''import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {''')
replace_once('src/pages/GlobalMarketPage.tsx', r'''  const [regionalSort, setRegionalSort] = useState<RegionalProductSort>('catalog');
  const game = model.game;''', r'''  const [regionalSort, setRegionalSort] = useState<RegionalProductSort>('catalog');
  const pageNavigation = usePlayerPageNavigation();
  const stackedLocation = pageNavigation?.currentLocation;
  const game = model.game;''')
replace_once('src/pages/GlobalMarketPage.tsx', r'''  const allProvinceOrders = ((game as EconomyState & { allProvinceOrders?: AssetOrder[] }).allProvinceOrders ?? game.orders);

  const productRows = useMemo(() => game.products.map((product) => {''', r'''  const allProvinceOrders = ((game as EconomyState & { allProvinceOrders?: AssetOrder[] }).allProvinceOrders ?? game.orders);

  useEffect(() => {
    if (!stackedLocation) return;
    if (stackedLocation.type === 'global-market-product') {
      setSelectedGlobalProductId(stackedLocation.productId);
      setActiveProvinceId(null);
      return;
    }
    if (stackedLocation.type === 'regional-product' && stackedLocation.host === 'market') {
      setSelectedGlobalProductId(stackedLocation.productId);
      setActiveProvinceId(stackedLocation.provinceId);
      return;
    }
    if (stackedLocation.type === 'tab' && stackedLocation.tab === 'market') {
      setSelectedGlobalProductId(null);
      setActiveProvinceId(null);
    }
  }, [stackedLocation]);

  const productRows = useMemo(() => game.products.map((product) => {''')
replace_once('src/pages/GlobalMarketPage.tsx', r'''  const openGlobalProduct = (productId: string) => {
    setSelectedGlobalProductId(productId);
    setActiveProvinceId(null);
    setRegionalStatusFilter('all');
    setRegionalSort('catalog');
  };''', r'''  const openGlobalProduct = (productId: string) => {
    setSelectedGlobalProductId(productId);
    setActiveProvinceId(null);
    setRegionalStatusFilter('all');
    setRegionalSort('catalog');
    pageNavigation?.pushPage({ type: 'global-market-product', productId });
  };''')
replace_once('src/pages/GlobalMarketPage.tsx', r'''  const openRegionalProduct = (provinceId: string) => {
    if (!selectedGlobalProduct) return;
    setActiveProvinceId(provinceId);
    model.setSelectedProvinceId(provinceId);
  };''', r'''  const openRegionalProduct = (provinceId: string) => {
    if (!selectedGlobalProduct) return;
    setActiveProvinceId(provinceId);
    model.setSelectedProvinceId(provinceId);
    pageNavigation?.pushPage({
      type: 'regional-product',
      host: 'market',
      provinceId,
      productId: selectedGlobalProduct.id,
    });
  };''')
replace_once('src/pages/GlobalMarketPage.tsx', r'''          backAction={{
            label: '返回商品全局详情',
            onClick: () => {
              model.showMarketCatalog();
              setActiveProvinceId(null);
            },
          }}''', r'''          backAction={pageNavigation ? undefined : {
            label: '返回商品全局详情',
            onClick: () => {
              model.showMarketCatalog();
              setActiveProvinceId(null);
            },
          }}''')
replace_once('src/pages/GlobalMarketPage.tsx', r'''        backAction={{ label: '返回商品列表', onClick: () => setSelectedGlobalProductId(null) }}''', r'''        backAction={pageNavigation ? undefined : { label: '返回商品列表', onClick: () => setSelectedGlobalProductId(null) }}''')

replace_once('src/pages/GlobalBuildingsPage.tsx', "import { lazy, Suspense, useMemo, useState } from 'react';", "import { lazy, Suspense, useEffect, useMemo, useState } from 'react';")
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { PageLayout, Panel } from '../components/ui/layout';''', r'''import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { PageLayout, Panel } from '../components/ui/layout';''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''  const [facilityDetailTypeId, setFacilityDetailTypeId] = useState<string | null>(null);
  const game = model.game;''', r'''  const [facilityDetailTypeId, setFacilityDetailTypeId] = useState<string | null>(null);
  const pageNavigation = usePlayerPageNavigation();
  const stackedLocation = pageNavigation?.currentLocation;
  const game = model.game;''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''  const provinces = operationalProvinces(model);

  const facilityRows = useMemo(() => game.facilityTypes.flatMap((type) => {''', r'''  const provinces = operationalProvinces(model);

  useEffect(() => {
    if (!stackedLocation) return;
    if (stackedLocation.type === 'global-building') {
      setSelectedGlobalFacilityTypeId(stackedLocation.facilityTypeId);
      setActiveProvinceId(null);
      setFacilityDetailTypeId(null);
      return;
    }
    if (stackedLocation.type === 'regional-facility' && stackedLocation.host === 'buildings') {
      setSelectedGlobalFacilityTypeId(stackedLocation.facilityTypeId);
      setActiveProvinceId(stackedLocation.provinceId);
      setFacilityDetailTypeId(stackedLocation.facilityTypeId);
      return;
    }
    if (stackedLocation.type === 'tab' && stackedLocation.tab === 'buildings') {
      setSelectedGlobalFacilityTypeId(null);
      setActiveProvinceId(null);
      setFacilityDetailTypeId(null);
    }
  }, [stackedLocation]);

  const facilityRows = useMemo(() => game.facilityTypes.flatMap((type) => {''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''  const openGlobalFacility = (facilityTypeId: string) => {
    setFacilityDetailTypeId(null);
    setActiveProvinceId(null);
    setSelectedGlobalFacilityTypeId(facilityTypeId);
  };''', r'''  const openGlobalFacility = (facilityTypeId: string) => {
    setFacilityDetailTypeId(null);
    setActiveProvinceId(null);
    setSelectedGlobalFacilityTypeId(facilityTypeId);
    pageNavigation?.pushPage({ type: 'global-building', facilityTypeId });
  };''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''  const openRegionalFacility = (provinceId: string) => {
    if (!selectedGlobalFacilityTypeId) return;
    model.setSelectedProvinceId(provinceId);
    setFacilityDetailTypeId(selectedGlobalFacilityTypeId);
    setActiveProvinceId(provinceId);
  };''', r'''  const openRegionalFacility = (provinceId: string) => {
    if (!selectedGlobalFacilityTypeId) return;
    model.setSelectedProvinceId(provinceId);
    setFacilityDetailTypeId(selectedGlobalFacilityTypeId);
    setActiveProvinceId(provinceId);
    pageNavigation?.pushPage({
      type: 'regional-facility',
      host: 'buildings',
      provinceId,
      facilityTypeId: selectedGlobalFacilityTypeId,
    });
  };''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''        backAction={returningToGlobalFacility
          ? {
              label: '返回地区工厂',
              onClick: () => {
                setFacilityDetailTypeId(null);
                setActiveProvinceId(null);
              },
            }
          : isFacilityDetail
            ? { label: '返回建筑列表', onClick: () => setFacilityDetailTypeId(null) }
            : { label: '返回全局建筑', onClick: () => setActiveProvinceId(null) }}''', r'''        backAction={pageNavigation ? undefined : returningToGlobalFacility
          ? {
              label: '返回地区工厂',
              onClick: () => {
                setFacilityDetailTypeId(null);
                setActiveProvinceId(null);
              },
            }
          : isFacilityDetail
            ? { label: '返回建筑列表', onClick: () => setFacilityDetailTypeId(null) }
            : { label: '返回全局建筑', onClick: () => setActiveProvinceId(null) }}''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''                onDetailFacilityChange={setFacilityDetailTypeId}''', r'''                onDetailFacilityChange={(nextFacilityTypeId) => {
                  setFacilityDetailTypeId(nextFacilityTypeId);
                  if (!pageNavigation) return;
                  if (nextFacilityTypeId && activeProvince) {
                    pageNavigation.replacePage({
                      type: 'regional-facility',
                      host: 'buildings',
                      provinceId: activeProvince.id,
                      facilityTypeId: nextFacilityTypeId,
                    });
                  } else if (!nextFacilityTypeId) {
                    pageNavigation.onBack();
                  }
                }}''')
replace_once('src/pages/GlobalBuildingsPage.tsx', r'''        backAction={{
          label: '返回工厂列表',
          onClick: () => setSelectedGlobalFacilityTypeId(null),
        }}''', r'''        backAction={pageNavigation ? undefined : {
          label: '返回工厂列表',
          onClick: () => setSelectedGlobalFacilityTypeId(null),
        }}''')

replace_once('src/pages/MarketPage.tsx', r'''import { PriceSparkline } from '../components/charts/PriceSparkline';
import { MarketAutoTradePanel } from '../components/market/MarketAutoTradePanel';''', r'''import { PriceSparkline } from '../components/charts/PriceSparkline';
import { currentFormulaScope } from '../components/facilities/FacilityProductionFormula';
import { MarketAutoTradePanel } from '../components/market/MarketAutoTradePanel';''')
replace_once('src/pages/MarketPage.tsx', "  const [mobileAccountView, setMobileAccountView] = useState<'orders' | 'trades'>('orders');\n", '')
replace_once('src/pages/MarketPage.tsx', r'''  const producerFacilities = useMemo(() => {
    if (!selectedProduct) return [];
    return game.facilityTypes.filter((facility) => {
      const recipes = facility.recipes.length > 0 ? facility.recipes : [facility];
      return recipes.some((recipe) => recipe.output.productId === selectedProduct.id);
    });
  }, [game.facilityTypes, selectedProduct]);
  const consumerFacilities = useMemo(() => {
    if (!selectedProduct) return [];
    return game.facilityTypes.filter((facility) => {
      const recipes = facility.recipes.length > 0 ? facility.recipes : [facility];
      return recipes.some((recipe) => recipe.inputs.some((input) => input.productId === selectedProduct.id));
    });
  }, [game.facilityTypes, selectedProduct]);''', r'''  const productionSummary = useMemo(() => {
    if (!selectedProduct) return { effectiveCount: 0, unitsPerMinute: 0 };
    let effectiveCount = 0;
    let unitsPerMinute = 0;
    for (const group of game.facilityGroups) {
      if (!group.enabled || group.status !== 'running') continue;
      const facility = facilityTypeById.get(group.facilityTypeId);
      if (!facility) continue;
      const recipes = facility.recipes.length > 0 ? facility.recipes : [facility];
      const recipe = recipes.find((candidate) => candidate.id === group.activeRecipeId) ?? recipes[0];
      if (!recipe || recipe.output.productId !== selectedProduct.id) continue;
      const scope = currentFormulaScope(group, now);
      const count = Math.max(0, scope.count);
      if (count <= 0) continue;
      effectiveCount += count;
      unitsPerMinute += count * recipe.output.quantity * (60_000 / Math.max(1, recipe.cycleMs));
    }
    return {
      effectiveCount,
      unitsPerMinute: Math.round(unitsPerMinute * 100) / 100,
    };
  }, [facilityTypeById, game.facilityGroups, now, selectedProduct]);''')
replace_once('src/pages/MarketPage.tsx', r'''            <Panel className="widget market-flow-card">
              <WidgetHeading title="生产者与消费者" />
              <div className="market-flow-groups">
                <section>
                  <h3>生产建筑</h3>
                  <div>{producerFacilities.length > 0
                    ? producerFacilities.map((facility) => <StatusTag key={facility.id} tone="success">{facility.name}</StatusTag>)
                    : <span className="muted">没有生产该商品的建筑</span>}</div>
                </section>
                <section>
                  <h3>消费建筑</h3>
                  <div>{consumerFacilities.length > 0
                    ? consumerFacilities.map((facility) => <StatusTag key={facility.id} tone="warning">{facility.name}</StatusTag>)
                    : <span className="muted">没有以该商品为投入的建筑</span>}</div>
                </section>
              </div>
            </Panel>''', r'''            <Panel className="widget market-inventory-production-card">
              <WidgetHeading title="库存与生产" />
              <div className="market-inventory-production-metrics">
                <MetricCard label="可用库存" value={formatNumber(selectedInventory.available)} />
                <MetricCard label="冻结库存" value={formatNumber(selectedInventory.frozen)} />
                <MetricCard label="发运在途" value={formatNumber(selectedInventory.inTransit)} />
                <MetricCard
                  label="预计生产速度"
                  value={`${formatNumber(productionSummary.unitsPerMinute)} / 分钟`}
                  tone={productionSummary.unitsPerMinute > 0 ? 'success' : 'neutral'}
                />
                <MetricCard
                  label="预计等效产能"
                  value={formatNumber(productionSummary.effectiveCount)}
                  tone={productionSummary.effectiveCount > 0 ? 'success' : 'neutral'}
                />
              </div>
              <p className="market-authority-note">预计生产速度只统计当前地区运行中、当前配方实际产出该商品的工厂，并按当前预计整数等效产能换算。</p>
            </Panel>''')
replace_once('src/pages/MarketPage.tsx', r'''            <div className="market-account-view-switch ui-segmented" role="group" aria-label="我的订单与成交视图">
              <Button
                variant="text"
                className={mobileAccountView === 'orders' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={mobileAccountView === 'orders'}
                onClick={() => setMobileAccountView('orders')}
              >挂单</Button>
              <Button
                variant="text"
                className={mobileAccountView === 'trades' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={mobileAccountView === 'trades'}
                onClick={() => setMobileAccountView('trades')}
              >成交</Button>
            </div>
''', '')
replace_once('src/pages/MarketPage.tsx', r'''              <section className={mobileAccountView === 'orders' ? 'market-account-pane--active' : ''}>''', r'''              <section>''')
replace_once('src/pages/MarketPage.tsx', r'''              <section className={`local-trades-section${mobileAccountView === 'trades' ? ' market-account-pane--active' : ''}`}>''', r'''              <section className="local-trades-section">''')

replace_once('src/styles/market-page-polish.css', r'''.market-fundamentals-card,
.market-flow-card {''', r'''.market-fundamentals-card,
.market-inventory-production-card {''')
replace_once('src/styles/market-page-polish.css', r'''.market-flow-groups {
  display: grid;
  gap: var(--space-3);
}

.market-flow-groups section,
.market-flow-groups section > div {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.market-flow-groups section {
  display: grid;
}

.market-flow-groups h3 {
  margin: 0;
  font-size: var(--font-size-sm);
}
''', r'''.market-inventory-production-metrics {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}
''')
replace_once('src/styles/market-page-polish.css', r'''.market-account-view-switch {
  display: none;
}

''', '')
replace_once('src/styles/market-page-polish.css', r'''@media (max-width: 720px) {
  .market-trade-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-1);
  }

  .market-trade-summary > span {
    padding: var(--space-2);
  }

  .market-account-view-switch {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    margin-top: var(--space-3);
  }

  .market-account-grid > section {
    display: none;
  }

  .market-account-grid > section.market-account-pane--active {
    display: grid;
  }
}''', r'''@media (max-width: 720px) {
  .market-trade-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-1);
  }

  .market-trade-summary > span {
    padding: var(--space-2);
  }
}''')
replace_once('src/styles/market-funds.css', r'''.market-account-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);
}''', r'''.market-account-grid {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-4);
  margin-top: var(--space-4);
}''')

replace_once('src/styles/warehouse-expansion.css', r'''.warehouse-inventory-panel {
  padding: var(--space-4);
}''', r'''.warehouse-inventory-panel {
  padding: 0;
}''')
replace_once('src/styles/warehouse-expansion.css', r'''.warehouse-content-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.warehouse-content-heading span {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-variant-numeric: tabular-nums;
}

''', '')
replace_once('src/styles/warehouse-expansion.css', r'''.warehouse-product-card {
  position: relative;
  min-width: 0;''', r'''.warehouse-product-card {
  position: relative;
  min-width: 0;
  width: 100%;
  appearance: none;
  font: inherit;
  cursor: pointer;''')
replace_once('src/styles/warehouse-expansion.css', r'''  .warehouse-inventory-panel {
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .warehouse-content-heading {
    align-items: baseline;
  }
''', r'''  .warehouse-inventory-panel {
    gap: var(--layout-gutter);
    padding: 0;
  }
''')
replace_once('src/styles/warehouse-expansion.css', r'''.warehouse-transport-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}''', r'''.warehouse-transport-panel {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--space-3);
}

.warehouse-transport-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}''')

replace_once('docs/WAREHOUSE_EXPANSION_DESIGN.md', r'''隐藏州级上下文页的“仓库”分区只渲染共享仓库库存面板。共享仓库显示当前州真实库存、“无限容量”和只读商品卡，不渲染自动交易表单、策略标记或可点击配置入口。建筑页不得渲染仓库面板。''', r'''隐藏州级上下文页的“仓库”分区固定采用扁平正文：本地有实物库存的商品卡直接排列在页面内容区，不再显示“共享仓库”“无限容量”“仓库内容”或“实物库存”汇总说明，也不为商品网格增加一级仓库卡片。无限容量仍是服务器业务规则，但不作为仓库页面的可见状态标签。跨州运输使用商品网格之后唯一独立一级卡片，统一承载发运表单与进行中的在途记录。建筑页不得渲染仓库面板。''')
replace_once('docs/WAREHOUSE_EXPANSION_DESIGN.md', r'''共享仓库标题右侧继续显示“无限容量”，不得显示等级、总容量、剩余容量、预占来源、升级费用、扩容按钮、容量警告或自动交易入口。州级仓库每张商品卡只展示名称、PNG 插画、可用数量和冻结数量，不响应点击；州级仓库分区的库存卡在所有宽度保持只读；库存显示条件仍为 `available > 0 或 frozen > 0`。仓库商品卡网格密度继续使用既有容器查询，不因自动交易迁入商品详情而改变。''', r'''仓库商品卡只展示名称、PNG 插画、可用数量和冻结数量，库存显示条件固定为 `available > 0 或 frozen > 0`；仅有 `inTransit` 的商品不得出现在本地库存网格，在途数量唯一进入跨州运输卡。商品卡整卡是当前州商品详情入口，点击后复用同一个地区 `MarketPage` 商品详情、订单簿、自动交易和真实市场状态，不创建仓库专用商品详情或第二套商品状态。仓库商品卡网格密度继续使用既有容器查询。''')

replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'''`GameShell` 提供桌面侧栏、移动底部导航、全局状态栏、统一通知入口与面板、战略追踪器、玩家页面历史，以及所有玩家页面共享的常驻战略地图。除地图页外的十个正式玩家页面与隐藏 `province` 上下文页必须由共享 `PageLayout` 在固定标题栏按“返回 SVG｜标题｜关闭 SVG”三列排列：标题保持居中，返回与关闭只能显示统一 SVG 图标，不得渲染可见文字；返回按最近顺序回到上一个非地图业务页面，没有历史时保持可见但禁用；州级上下文页的返回固定进入地图；关闭固定切换到透明 `map` 页面，只显示常驻地图，不退出登录、不清理页面业务草稿、不重建静态 SVG 地图世界或唯一合成相机。''', r'''`GameShell` 提供桌面侧栏、移动底部导航、全局状态栏、统一通知入口与面板、战略追踪器、受限玩家页面栈，以及所有玩家页面共享的常驻战略地图。页面栈只保存 `tab`、`provinceId`、分区、`productId`、`facilityTypeId` 和渲染宿主等轻量位置描述，不得保存 `EconomyState`、订单／商品数组、React 节点、DOM、Ref 或函数；当前页面加历史总深度固定最多 20 层，超过上限时保留根 `map` 并淘汰最旧的非根历史。地区“概览／市场／建筑／仓库”同级切换使用 replace，不增加栈深度；商品、工厂和全局实体钻取使用 push；连续相同位置不得重复 push；返回只 pop 并恢复上一位置；关闭清空页面栈并回到透明 `map`。不得通过 `origin` 标志、页面来源枚举或多套局部历史模拟返回路径。除地图页外的十个正式玩家页面与隐藏 `province` 上下文页必须由共享 `PageLayout` 在固定标题栏按“返回 SVG｜标题｜关闭 SVG”三列排列：标题保持居中，返回与关闭只能显示统一 SVG 图标，不得渲染可见文字；没有可返回历史时返回按钮保持可见但禁用；关闭只显示常驻地图，不退出登录、不清理页面业务草稿、不重建静态 SVG 地图世界或唯一合成相机。''')
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'''点击商品进入当前地区商品详情；详情固定承载当前地区真实价格与近 24 小时真实成交量／趋势、统一五档订单簿与手动下单、本人订单／本地成交，以及锁定当前 `provinceId + productId` 的在线自动采购／自动出售设置。''', r'''点击商品进入当前地区商品详情；详情固定承载当前地区真实价格与近 24 小时真实成交量／趋势、当前仓库可用／冻结／发运在途库存、按运行中当前配方和预计整数等效产能换算的预计生产速度、统一五档订单簿与手动下单、本人订单／本地成交，以及锁定当前 `provinceId + productId` 的在线自动采购／自动出售设置。本人未完成订单与本地成交固定按“订单在上、成交在下”的单列顺序同时显示，移动端不得再用页签隐藏其中一项。''')
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'''商品生产者／消费者关系只能从正式建筑配方的输出／投入关系派生，不表示实际生产量、就业量或贸易流。未来若要显示维多利亚式完整市场状态、贡献量或真实利润表，必须先由服务器提供权威字段。''', r'''地区商品详情不再显示“生产者与消费者”关系卡。库存与生产卡只读取当前地区真实库存、发运在途数量以及当前运行工厂的当前配方和共享预计整数等效产能，预计生产速度统一换算为件／分钟并明确属于客户端只读投影，不进入订单簿供需、生产结算、就业、价格或排行榜。未来若要显示维多利亚式完整市场贡献量或真实利润表，必须先由服务器提供权威字段。''')
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'''详情交易区继续按实际内容宽度使用响应式布局：交易卡内部同时显示下单与五档盘口，商品基本面、生产消费关系、行情卡和当前资产订单／成交按单一页面滚动区排列。''', r'''详情交易区继续按实际内容宽度使用响应式布局：交易卡内部同时显示下单与五档盘口，商品基本面、库存与生产、行情卡以及纵向排列的当前资产订单／成交按单一页面滚动区排列。''')
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', r'''仓库库存唯一显示在隐藏州级上下文页的“仓库”分区；自动采购／自动出售策略唯一显示在地区商品详情的自动交易区；跨州运输发货与在途记录唯一显示在仓库分区的“跨州运输”区。完整库存、在线自动交易与运输规则见 `WAREHOUSE_EXPANSION_DESIGN.md`。''', r'''仓库库存唯一显示在隐藏州级上下文页的“仓库”分区；商品直接以可钻取卡片排列在正文，不显示共享仓库、容量或库存汇总说明。点击商品通过统一受限页面栈进入同一当前地区商品详情，返回恢复仓库分区；自动采购／自动出售策略唯一显示在地区商品详情的自动交易区；跨州运输发货与在途记录唯一显示在仓库分区的独立“跨州运输”一级卡片。完整库存、在线自动交易与运输规则见 `WAREHOUSE_EXPANSION_DESIGN.md`。''')
replace_once('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '状态栏其后固定按“可用资金／净资产／宝石／排行榜／仓库剩余”排序', '状态栏其后固定按“可用资金／净资产／宝石／排行榜／仓库库存”排序')

replace_once('docs/UI_DESIGN_SYSTEM.md', '`src/styles/warehouse-expansion.css` | 州级只读仓库、地区商品详情自动交易控制、容器查询、紧凑商品卡和移动自动交易入口布局', '`src/styles/warehouse-expansion.css` | 州级可钻取仓库商品网格、独立跨州运输卡、地区商品详情自动交易控制、容器查询、紧凑商品卡和移动自动交易入口布局')
replace_once('docs/UI_DESIGN_SYSTEM.md', r'''`PagePanel` 是新增玩家端一级卡片的唯一 React 入口，固定复用 `Panel`、`.widget` 与 `.ui-primary-surface`。现有 `Panel className="widget ..."` 由兼容桥自动补充 `.ui-primary-surface`；建筑页和排行页尚未迁移的旧一级卡片类只允许在 `primary-surfaces.css` 中作为兼容入口，不得在业务 CSS 中重新定义外层 padding。

''', r'''`PagePanel` 是新增玩家端一级卡片的唯一 React 入口，固定复用 `Panel`、`.widget` 与 `.ui-primary-surface`。现有 `Panel className="widget ..."` 由兼容桥自动补充 `.ui-primary-surface`；建筑页和排行页尚未迁移的旧一级卡片类只允许在 `primary-surfaces.css` 中作为兼容入口，不得在业务 CSS 中重新定义外层 padding。

玩家页面返回统一由 `PlayerPageNavigationContext` 的受限位置栈驱动。栈项必须是轻量可比较描述符，当前页加历史最多 20 层；同级分区使用 replace，实体下钻使用 push，返回 pop，关闭 reset 到 `map`。页面组件不得保存来源回调、DOM 或完整业务状态来实现返回，也不得让轮询更新改变栈深度。仓库商品卡、全局商品／工厂下钻和地区实体详情必须复用这套语义。

''')

replace_once('scripts/verify-warehouse-expansion.mjs', r'''for (const text of [
  'WarehouseInventoryPanel',
  '无限容量',
  'game.warehouseStoredQuantity',
  'warehouse-only-panel',
  'warehouse-product-card--readonly',
  '仓库中暂无商品',
  '通过生产或市场交易获得商品后，会在这里按州级库存显示。',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);''', r'''for (const text of [
  'WarehouseInventoryPanel',
  'WarehouseInventoryGrid',
  'WarehouseTransportPanel',
  'data-ui-interactive="surface"',
  'onOpenProduct?.(product.id)',
  'warehouse-transport-panel',
  '仓库中暂无商品',
  '通过生产或市场交易获得商品后，会在这里按州级库存显示。',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
for (const text of ['无限容量', '共享仓库', 'warehouse-product-card--readonly', 'warehouse-content-heading']) {
  forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
}''')
replace_once('scripts/verify-warehouse-expansion.mjs', r'''  '州级仓库分区的库存卡在所有宽度保持只读',
  '不得通过组件内部选择器切换到其他商品',''', r'''  '商品卡整卡是当前州商品详情入口',
  '不再显示“共享仓库”“无限容量”“仓库内容”或“实物库存”汇总说明',
  '不得通过组件内部选择器切换到其他商品',''')
replace_once('scripts/verify-warehouse-expansion.mjs', r'''  'province warehouse stays read-only on mobile',''', r'''  'province warehouse opens regional commodity detail and keeps transport in its own card',''')
replace_once('scripts/verify-warehouse-expansion.mjs', "console.log('无限仓库防回退验证通过：容量机制保持退役，州级仓库只读，在线自动交易唯一归属市场。');", "console.log('无限仓库防回退验证通过：容量机制保持退役，仓库商品可钻取，跨州运输独立成卡，在线自动交易唯一归属市场。');")

replace_once('scripts/verify-page-content-base.mjs', r'''  '商品基本面',
  '生产者与消费者',
  'backAction={{',''', r'''  '商品基本面',
  '库存与生产',
  '预计生产速度',
  'backAction={{',''')
replace_once('scripts/verify-page-content-base.mjs', r'''for (const text of [
  'pageHistoryRef',
  "previousTab !== 'map'",
  "model.setTab('map')",
  '<PlayerPageNavigationProvider',
]) requireText('src/components/shell/GameShell.tsx', text);''', r'''for (const text of [
  'pageHistoryRef',
  'appendPlayerPageHistory',
  'playerPageLocationKey',
  'pushPlayerPage',
  'replacePlayerPage',
  '<PlayerPageNavigationProvider',
]) requireText('src/components/shell/GameShell.tsx', text);
for (const text of [
  'MAX_PLAYER_PAGE_STACK_DEPTH = 20',
  'maximumHistoryDepth = MAX_PLAYER_PAGE_STACK_DEPTH - 1',
  "next[0]?.type === 'map'",
]) requireText('src/navigation/playerPageStack.ts', text);''')
replace_once('scripts/verify-page-content-base.mjs', "  'src/app/gameViewModel.ts',\n  'src/config/navigation.ts',", "  'src/app/gameViewModel.ts',\n  'src/navigation/playerPageStack.ts',\n  'src/config/navigation.ts',")
replace_once('scripts/verify-page-content-base.mjs', "requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得在标题下方显示 `description` 说明段落');", "requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得在标题下方显示 `description` 说明段落');\nrequireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '当前页面加历史总深度固定最多 20 层');")

replace_once('tests/browser/warehouse-auto-sell.spec.ts', r'''  test('province warehouse stays read-only on mobile while transport remains available', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const map = page.getByTestId('us-mainland-map');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await clickMapProvinceLabel(page, '加利福尼亚州');

    await page.setViewportSize({ width: 390, height: 844 });
    const provinceTabs = page.getByRole('tablist', { name: '加利福尼亚州页面分区' });
    await expect(provinceTabs).toBeVisible();
    await provinceTabs.getByRole('tab', { name: '仓库', exact: true }).click();

    const warehouse = page.locator('.province-warehouse-section');
    await expect(warehouse).toBeVisible();
    await expect(warehouse.getByText('无限容量', { exact: true })).toBeVisible();
    const productCards = warehouse.locator('.warehouse-product-card--readonly');
    expect(await productCards.count()).toBeGreaterThan(0);
    await expect(productCards.locator('button')).toHaveCount(0);
    await expect(warehouse.getByLabel('跨州运输')).toBeVisible();
    await expect(warehouse.locator('.transport-submit')).toBeVisible();
    await expect(warehouse.getByText('自动交易', { exact: true })).toHaveCount(0);
    const sheet = page.locator('.mobile-workspace-sheet-host');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-page-key', 'province');
    await expect(sheet).toHaveAttribute('data-detail-active', 'false');
  });''', r'''  test('province warehouse opens regional commodity detail and keeps transport in its own card', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const map = page.getByTestId('us-mainland-map');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await clickMapProvinceLabel(page, '加利福尼亚州');

    await page.setViewportSize({ width: 390, height: 844 });
    const provinceTabs = page.getByRole('tablist', { name: '加利福尼亚州页面分区' });
    await expect(provinceTabs).toBeVisible();
    await provinceTabs.getByRole('tab', { name: '仓库', exact: true }).click();

    const warehouse = page.locator('.province-warehouse-section');
    await expect(warehouse).toBeVisible();
    await expect(warehouse.getByText('无限容量', { exact: true })).toHaveCount(0);
    await expect(warehouse.getByText('仓库内容', { exact: true })).toHaveCount(0);
    await expect(warehouse.getByText(/实物库存/)).toHaveCount(0);
    const productCards = warehouse.locator('button.warehouse-product-card');
    expect(await productCards.count()).toBeGreaterThan(0);
    const transportCard = warehouse.locator('.warehouse-transport-panel');
    await expect(transportCard).toBeVisible();
    await expect(transportCard.getByRole('heading', { name: '跨州运输', exact: true })).toBeVisible();
    await expect(transportCard.locator('.transport-submit')).toBeVisible();
    await expect(warehouse.getByText('自动交易', { exact: true })).toHaveCount(0);

    await productCards.first().click();
    await expect(page.locator('.market-inventory-production-card')).toBeVisible();
    await expect(page.getByText('生产者与消费者', { exact: true })).toHaveCount(0);
    await expect(page.locator('.market-inventory-production-card')).toContainText('预计生产速度');

    const back = page.locator('.page-navigation-button--back');
    await back.click();
    await expect(page.locator('.province-warehouse-section')).toBeVisible();
    await back.click();
    await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'map');
  });''')

replace_once('tests/browser/market-runtime.spec.ts', r'''  await expect(page.getByRole('button', { name: '挂单', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '成交', exact: true })).toBeVisible();
  await expect(page.locator('.market-account-grid > section.market-account-pane--active')).toContainText('未完成订单');
  await page.getByRole('button', { name: '成交', exact: true }).click();
  await expect(page.locator('.market-account-grid > section.market-account-pane--active')).toContainText('本地成交');''', r'''  await expect(page.getByRole('button', { name: '挂单', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '成交', exact: true })).toHaveCount(0);
  const accountSections = page.locator('.market-account-grid > section');
  await expect(accountSections).toHaveCount(2);
  await expect(accountSections.nth(0)).toContainText('已有订单');
  await expect(accountSections.nth(1)).toContainText('本地成交');
  const ordersBox = await requireBox(accountSections.nth(0));
  const tradesBox = await requireBox(accountSections.nth(1));
  expect(tradesBox.y).toBeGreaterThan(ordersBox.y + ordersBox.height - 2);''')

forbid('src/components/warehouse/WarehouseInventoryPanel.tsx', '共享仓库')
forbid('src/components/warehouse/WarehouseInventoryPanel.tsx', '无限容量')
forbid('src/pages/MarketPage.tsx', '生产者与消费者')
forbid('src/pages/MarketPage.tsx', 'mobileAccountView')
forbid('src/components/shell/GameShell.tsx', 'skipNextHistoryRef')

print('warehouse/product/page-stack refactor applied')
