import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { currentFormulaScope } from '../components/facilities/FacilityProductionFormula';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { ChevronIcon } from '../components/icons/GameIcons';
import {
  EntityListHeader,
  type EntityListSortDirection,
  type EntityListSortState,
} from '../components/ui/EntityListHeader';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { PageLayout, Panel } from '../components/ui/layout';
import {
  resolveFacilityProfitPresentation,
  type FacilityProfitTone,
} from '../utils/facilityProfitPresentation';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { resolveFacilityDetailRecipeState } from './production/ProductionFacilityDetail';
import '../styles/global-operation-pages.css';
import '../styles/entity-list-header.css';

type FacilityCatalogSortKey = 'name' | 'profit' | 'count';
type FacilityRegionSortKey = 'name' | 'profit' | 'count' | 'status';

function compareOptionalNumber(
  left: number | null,
  right: number | null,
  direction: EntityListSortDirection,
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === 'asc' ? left - right : right - left;
}

function directedComparison(value: number, direction: EntityListSortDirection) {
  return direction === 'asc' ? value : -value;
}

const EmbeddedBuildingsPage = lazy(() => import('./BuildingsPage').then((module) => ({
  default: module.BuildingsPage,
})));

function operationalProvinces(model: OnlineAutoTradeAwareGameViewModel) {
  const game = model.game;
  const hasUnlockState = Array.isArray(game.unlockedProvinces)
    || typeof game.startingProvinceId === 'string';
  if (!hasUnlockState) return game.provinces;
  const unlocked = new Set(game.unlockedProvinces ?? []);
  if (game.startingProvinceId) unlocked.add(game.startingProvinceId);
  return game.provinces.filter((province) => unlocked.has(province.id));
}

function globalProfitTone(value: number | null): FacilityProfitTone {
  if (value === null) return 'unavailable';
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return 'neutral';
}

function accessibleProfit(value: number | null) {
  if (value === null) return '暂无可计算利润';
  if (value > 0) return `盈利 ${formatCurrency(value)}`;
  if (value < 0) return `亏损 ${formatCurrency(Math.abs(value))}`;
  return '持平 0.00';
}

function facilityStatusLabel(status: 'running' | 'stopped' | 'error') {
  if (status === 'running') return '运行中';
  if (status === 'error') return '异常';
  return '已停止';
}

export function GlobalBuildingsPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [selectedGlobalFacilityTypeId, setSelectedGlobalFacilityTypeId] = useState<string | null>(null);
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const [facilityDetailTypeId, setFacilityDetailTypeId] = useState<string | null>(null);
  const [catalogSort, setCatalogSort] = useState<EntityListSortState<FacilityCatalogSortKey>>({
    key: 'catalog',
    direction: 'asc',
  });
  const [regionSort, setRegionSort] = useState<EntityListSortState<FacilityRegionSortKey>>({
    key: 'catalog',
    direction: 'asc',
  });
  const pageNavigation = usePlayerPageNavigation();
  const stackedLocation = pageNavigation?.currentLocation;
  const game = model.game;
  const provinces = operationalProvinces(model);

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

  const facilityRows = useMemo(() => game.facilityTypes.flatMap((type, catalogIndex) => {
    let totalCount = 0;
    let weightedProfitTotal = 0;
    let weightedProfitCount = 0;
    const incompleteProfitProvinces: string[] = [];

    for (const province of provinces) {
      const group = (game.provinceFacilityGroups?.[province.id] ?? [])
        .find((candidate) => candidate.facilityTypeId === type.id);
      if (!group) continue;

      const count = Math.max(0, Number(group.count || 0));
      if (count <= 0) continue;
      totalCount += count;

      const scope = currentFormulaScope(group, game.lastProcessedAt);
      if (scope.physicalCount <= 0) continue;
      const recipeState = resolveFacilityDetailRecipeState({ group, type });
      const presentation = resolveFacilityProfitPresentation({
        type: recipeState.formulaType,
        scopeCount: scope.physicalCount,
        scopeLabel: scope.name,
        staffingRateBps: scope.staffingRateBps,
        products: game.products,
        markets: game.provinceMarkets?.[province.id] ?? {},
      });
      if (presentation.profitPerMinute === null) {
        incompleteProfitProvinces.push(province.name);
        continue;
      }

      weightedProfitTotal += presentation.profitPerMinute * scope.physicalCount;
      weightedProfitCount += scope.physicalCount;
    }

    if (totalCount <= 0) return [];
    const averageProfit = incompleteProfitProvinces.length === 0 && weightedProfitCount > 0
      ? weightedProfitTotal / weightedProfitCount
      : null;
    const profitDetail = averageProfit === null
      ? incompleteProfitProvinces.length > 0
        ? `跨州单厂平均利润／分钟；${incompleteProfitProvinces.join('、')}缺少当前配方所需商品的最近真实成交价`
        : '跨州单厂平均利润／分钟；当前没有可用于利润估算的工厂'
      : '跨州单厂平均利润／分钟；按各州当前、启动后或恢复后可生产工厂数量加权，使用各州当前配方、最近真实成交价和预计满员率';

    return [{
      facilityTypeId: type.id,
      catalogIndex,
      name: type.name,
      totalCount,
      averageProfit,
      profitTone: globalProfitTone(averageProfit),
      profitValue: averageProfit === null ? '—' : formatCurrency(Math.abs(averageProfit)),
      profitAccessibleValue: accessibleProfit(averageProfit),
      profitDetail,
    }];
  }), [
    game.facilityTypes,
    game.lastProcessedAt,
    game.products,
    game.provinceFacilityGroups,
    game.provinceMarkets,
    provinces,
  ]);

  const sortedFacilityRows = useMemo(() => [...facilityRows].sort((left, right) => {
    let comparison = 0;
    if (catalogSort.key === 'name') {
      comparison = directedComparison(left.name.localeCompare(right.name, 'zh-CN'), catalogSort.direction);
    } else if (catalogSort.key === 'profit') {
      comparison = compareOptionalNumber(left.averageProfit, right.averageProfit, catalogSort.direction);
    } else if (catalogSort.key === 'count') {
      comparison = directedComparison(left.totalCount - right.totalCount, catalogSort.direction);
    }
    return comparison || left.catalogIndex - right.catalogIndex;
  }), [catalogSort, facilityRows]);

  const selectedGlobalFacility = selectedGlobalFacilityTypeId
    ? game.facilityTypes.find((type) => type.id === selectedGlobalFacilityTypeId)
    : undefined;

  const facilityProvinceRows = useMemo(() => {
    if (!selectedGlobalFacilityTypeId || !selectedGlobalFacility) return [];
    return provinces.flatMap((province, catalogIndex) => {
      const group = (game.provinceFacilityGroups?.[province.id] ?? [])
        .find((candidate) => candidate.facilityTypeId === selectedGlobalFacilityTypeId);
      const count = Math.max(0, Number(group?.count || 0));
      if (!group || count <= 0) return [];

      const scope = currentFormulaScope(group, game.lastProcessedAt);
      const recipeState = resolveFacilityDetailRecipeState({ group, type: selectedGlobalFacility });
      const presentation = resolveFacilityProfitPresentation({
        type: recipeState.formulaType,
        scopeCount: scope.physicalCount,
        scopeLabel: scope.name,
        staffingRateBps: scope.staffingRateBps,
        products: game.products,
        markets: game.provinceMarkets?.[province.id] ?? {},
      });

      return [{
        province,
        catalogIndex,
        count,
        statusCode: group.status,
        status: facilityStatusLabel(group.status),
        profitPerMinute: presentation.profitPerMinute,
        profitTone: presentation.tone,
        profitValue: presentation.visibleValue,
        profitAccessibleValue: presentation.accessibleValue,
        profitDetail: presentation.detail,
      }];
    });
  }, [
    game.lastProcessedAt,
    game.products,
    game.provinceFacilityGroups,
    game.provinceMarkets,
    provinces,
    selectedGlobalFacility,
    selectedGlobalFacilityTypeId,
  ]);

  const sortedFacilityProvinceRows = useMemo(() => [...facilityProvinceRows].sort((left, right) => {
    let comparison = 0;
    if (regionSort.key === 'name') {
      comparison = directedComparison(left.province.name.localeCompare(right.province.name, 'zh-CN'), regionSort.direction);
    } else if (regionSort.key === 'profit') {
      comparison = compareOptionalNumber(left.profitPerMinute, right.profitPerMinute, regionSort.direction);
    } else if (regionSort.key === 'count') {
      comparison = directedComparison(left.count - right.count, regionSort.direction);
    } else if (regionSort.key === 'status') {
      const rank = { error: 0, stopped: 1, running: 2 } as const;
      comparison = directedComparison(rank[left.statusCode] - rank[right.statusCode], regionSort.direction);
    }
    return comparison || left.catalogIndex - right.catalogIndex;
  }), [facilityProvinceRows, regionSort]);

  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : undefined;

  const openGlobalFacility = (facilityTypeId: string) => {
    setFacilityDetailTypeId(null);
    setActiveProvinceId(null);
    setSelectedGlobalFacilityTypeId(facilityTypeId);
    pageNavigation?.pushPage({ type: 'global-building', facilityTypeId });
  };

  const openRegionalFacility = (provinceId: string) => {
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
  };

  if (activeProvince) {
    const provinceReady = model.selectedProvinceId === activeProvince.id;
    const requestedFacilityType = facilityDetailTypeId
      ? game.facilityTypes.find((type) => type.id === facilityDetailTypeId)
      : undefined;
    const facilityDetailEntry = provinceReady && facilityDetailTypeId
      ? game.facilityGroups.find((group) => group.facilityTypeId === facilityDetailTypeId && group.count > 0)
      : undefined;
    const facilityDetailType = facilityDetailEntry ? requestedFacilityType : undefined;
    const isFacilityDetail = Boolean(facilityDetailType);
    const returningToGlobalFacility = Boolean(facilityDetailTypeId && selectedGlobalFacilityTypeId);
    return (
      <PageLayout
        title={facilityDetailTypeId && requestedFacilityType ? (
          <RegionalEntityPageTitle
            entityName={requestedFacilityType.name}
            regionName={activeProvince.name}
            className="province-facility-detail-title"
          />
        ) : `${activeProvince.name}建筑`}
        backAction={pageNavigation ? undefined : returningToGlobalFacility
          ? {
              label: '返回地区工厂',
              onClick: () => {
                setFacilityDetailTypeId(null);
                setActiveProvinceId(null);
              },
            }
          : isFacilityDetail
            ? { label: '返回建筑列表', onClick: () => setFacilityDetailTypeId(null) }
            : { label: '返回全局建筑', onClick: () => setActiveProvinceId(null) }}
      >
        <div className="global-operation-page global-buildings-page" data-global-scope="buildings" data-drilldown-province-id={activeProvince.id}>
          {!facilityDetailTypeId ? (
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
                onDetailFacilityChange={(nextFacilityTypeId) => {
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
                }}
              />
            </Suspense>
          ) : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
        </div>
      </PageLayout>
    );
  }

  if (selectedGlobalFacility) {
    return (
      <PageLayout
        title={selectedGlobalFacility.name}
        backAction={pageNavigation ? undefined : {
          label: '返回工厂列表',
          onClick: () => setSelectedGlobalFacilityTypeId(null),
        }}
      >
        <div
          className="global-operation-page global-buildings-page global-facility-region-page"
          data-global-scope="buildings"
          data-global-facility-type-id={selectedGlobalFacilityTypeId}
        >
          {facilityProvinceRows.length > 0 ? (
            <section className="entity-list-surface global-facility-region-surface">
              <EntityListHeader
                className="global-facility-region-header"
                columns={[
                  { label: '地区', sortKey: 'name', defaultDirection: 'asc' },
                  { label: '利润／分钟', sortKey: 'profit', defaultDirection: 'desc' },
                  { label: '拥有', sortKey: 'count', defaultDirection: 'desc' },
                  { label: '状态', sortKey: 'status', defaultDirection: 'asc' },
                  { key: 'chevron', label: '' },
                ]}
                sortState={regionSort}
                onSortChange={setRegionSort}
              />
              <ul className="entity-list-rows global-facility-region-list" aria-label={`${selectedGlobalFacility.name}地区工厂`}>
                {sortedFacilityProvinceRows.map((row) => (
                  <li key={row.province.id}>
                    <button
                      type="button"
                      className="entity-list-row global-facility-region-row"
                      data-ui-interactive="surface"
                      data-province-id={row.province.id}
                      aria-label={`打开${row.province.name}${selectedGlobalFacility.name}工厂详情，单厂利润每分钟：${row.profitAccessibleValue}，拥有 ${formatNumber(row.count)} 座，${row.status}`}
                      title={row.profitDetail}
                      onClick={() => openRegionalFacility(row.province.id)}
                    >
                      <span className="global-facility-region-row__identity">
                        <strong>{row.province.name}</strong>
                      </span>
                      <strong
                        className={`entity-list-value global-facility-region-row__profit is-${row.profitTone}`}
                        title={row.profitDetail}
                      >
                        {row.profitValue}
                      </strong>
                      <strong className="global-facility-region-row__metric">{<CompactNumber value={row.count} />}</strong>
                      <strong className="global-facility-region-row__status">{row.status}</strong>
                      <span className="global-facility-region-row__chevron" aria-hidden="true">
                        <ChevronIcon direction="right" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : <Panel className="empty-state">当前已没有地区持有该工厂。</Panel>}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="建筑">
      <div className="global-operation-page global-buildings-page" data-global-scope="buildings">
        <section className="entity-list-surface global-facility-catalog" aria-label="全局工厂目录">
          {facilityRows.length > 0 ? (
            <>
              <EntityListHeader
                className="global-facility-catalog-header"
                columns={[
                  { label: '工厂', sortKey: 'name', defaultDirection: 'asc' },
                  { label: '平均利润／分钟', sortKey: 'profit', defaultDirection: 'desc' },
                  { label: '拥有', sortKey: 'count', defaultDirection: 'desc' },
                  { key: 'chevron', label: '' },
                ]}
                sortState={catalogSort}
                onSortChange={setCatalogSort}
              />
              <ul className="entity-list-rows global-facility-catalog-list" aria-label="跨州工厂汇总">
                {sortedFacilityRows.map((row) => (
                  <li key={row.facilityTypeId}>
                    <button
                      type="button"
                      className="entity-list-row global-facility-catalog-row"
                      data-ui-interactive="surface"
                      aria-label={`打开${row.name}地区工厂，拥有 ${formatNumber(row.totalCount)} 座，跨州单厂平均利润每分钟：${row.profitAccessibleValue}`}
                      title={row.profitDetail}
                      onClick={() => openGlobalFacility(row.facilityTypeId)}
                    >
                      <span className="global-facility-catalog-row__identity">
                        <FacilityIcon facilityTypeId={row.facilityTypeId} className="global-facility-catalog-row__artwork" />
                        <strong>{row.name}</strong>
                      </span>
                      <strong
                        className={`entity-list-value global-facility-catalog-row__metric global-facility-catalog-row__profit is-${row.profitTone}`}
                        title={row.profitDetail}
                      >
                        {row.profitValue}
                      </strong>
                      <strong className="global-facility-catalog-row__metric">{<CompactNumber value={row.totalCount} />}</strong>
                      <span className="global-facility-catalog-row__chevron" aria-hidden="true">
                        <ChevronIcon direction="right" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : <Panel className="empty-state">当前还没有已建成工厂。</Panel>}
        </section>
      </div>
    </PageLayout>
  );
}
