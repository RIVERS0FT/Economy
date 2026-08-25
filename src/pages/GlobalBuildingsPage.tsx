import { lazy, Suspense, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { currentFormulaScope } from '../components/facilities/FacilityProductionFormula';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { ChevronIcon } from '../components/icons/GameIcons';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import {
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import {
  resolveFacilityProfitPresentation,
  type FacilityProfitTone,
} from '../utils/facilityProfitPresentation';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { resolveFacilityDetailRecipeState } from './production/ProductionFacilityDetail';
import '../styles/global-operation-pages.css';

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

export function GlobalBuildingsPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
  const [facilityDetailTypeId, setFacilityDetailTypeId] = useState<string | null>(null);
  const game = model.game;
  const provinces = operationalProvinces(model);
  const summaries = game.provinceAssetSummaries ?? {};

  const provinceRows = useMemo(() => provinces.map((province) => {
    const summary = summaries[province.id];
    const facilityCount = Number(summary?.facilityCount || 0);
    const runningFacilityCount = Number(summary?.runningFacilityCount || 0);
    const blockedFacilityCount = Number(summary?.blockedFacilityCount || 0);
    return {
      province,
      facilityCount,
      runningFacilityCount,
      blockedFacilityCount,
      stoppedFacilityCount: Math.max(0, facilityCount - runningFacilityCount - blockedFacilityCount),
    };
  }), [provinces, summaries]);

  const facilityRows = useMemo(() => game.facilityTypes.flatMap((type) => {
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
      name: type.name,
      totalCount,
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

  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : undefined;

  const openProvinceBuildings = (provinceId: string) => {
    model.setSelectedProvinceId(provinceId);
    setFacilityDetailTypeId(null);
    setActiveProvinceId(provinceId);
  };

  if (activeProvince) {
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

  return (
    <PageLayout title="建筑">
      <div className="global-operation-page global-buildings-page" data-global-scope="buildings">
        <section className="global-facility-catalog" aria-label="全局工厂目录">
          <WidgetHeading title="全局工厂目录" action={<StatusTag>{formatNumber(facilityRows.length)} 类已拥有</StatusTag>} />
          {facilityRows.length > 0 ? (
            <ul className="global-facility-catalog-list" aria-label="跨州工厂汇总">
              {facilityRows.map((row) => (
                <li
                  className="global-facility-catalog-row"
                  key={row.facilityTypeId}
                  aria-label={`${row.name}，拥有 ${formatNumber(row.totalCount)} 座，跨州单厂平均利润每分钟：${row.profitAccessibleValue}`}
                  title={row.profitDetail}
                >
                  <span className="global-facility-catalog-row__identity">
                    <FacilityIcon facilityTypeId={row.facilityTypeId} className="global-facility-catalog-row__artwork" />
                    <strong>{row.name}</strong>
                  </span>
                  <span className="global-facility-catalog-row__metric">
                    <small>平均利润／分钟</small>
                    <strong
                      className={`global-facility-catalog-row__profit is-${row.profitTone}`}
                      title={row.profitDetail}
                    >
                      {row.profitValue}
                    </strong>
                  </span>
                  <span className="global-facility-catalog-row__metric">
                    <small>拥有</small>
                    <strong>{formatNumber(row.totalCount)}</strong>
                  </span>
                </li>
              ))}
            </ul>
          ) : <Panel className="empty-state">当前还没有已建成工厂。</Panel>}
        </section>

        <PagePanel className="global-province-list-panel">
          <WidgetHeading title="地区建筑" action={<StatusTag>{formatNumber(provinceRows.length)} 个已解锁州</StatusTag>} />
          <ul className="global-province-list" aria-label="全局地区建筑入口">
            {provinceRows.map((row) => (
              <li key={row.province.id}>
                <button
                  type="button"
                  className="global-province-row"
                  data-ui-interactive="surface"
                  data-province-id={row.province.id}
                  aria-label={`打开${row.province.name}地区建筑`}
                  onClick={() => openProvinceBuildings(row.province.id)}
                >
                  <span className="global-province-row__identity">
                    <strong>{row.province.name}</strong>
                    <small>{row.province.shortName}</small>
                  </span>
                  <span className="global-province-row__metric"><small>工厂总数</small><strong>{formatNumber(row.facilityCount)}</strong></span>
                  <span className="global-province-row__metric"><small>运行中</small><strong>{formatNumber(row.runningFacilityCount)}</strong></span>
                  <span className="global-province-row__metric"><small>已停止</small><strong>{formatNumber(row.stoppedFacilityCount)}</strong></span>
                  <span className="global-province-row__metric"><small>异常</small><strong>{formatNumber(row.blockedFacilityCount)}</strong></span>
                  <span className="global-province-row__chevron" aria-hidden="true">
                    <ChevronIcon direction="right" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PagePanel>
      </div>
    </PageLayout>
  );
}
