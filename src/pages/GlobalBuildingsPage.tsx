import { lazy, Suspense, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import {
  Button,
  MetricCard,
  PageLayout,
  PagePanel,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatNumber } from '../utils/formatters';
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

export function GlobalBuildingsPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const [activeProvinceId, setActiveProvinceId] = useState<string | null>(null);
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

  const facilityRows = useMemo(() => {
    const aggregates = new Map<string, {
      facilityTypeId: string;
      name: string;
      totalCount: number;
      runningCount: number;
      blockedCount: number;
      provinceIds: Set<string>;
    }>();
    for (const type of game.facilityTypes) {
      aggregates.set(type.id, {
        facilityTypeId: type.id,
        name: type.name,
        totalCount: 0,
        runningCount: 0,
        blockedCount: 0,
        provinceIds: new Set(),
      });
    }
    for (const province of provinces) {
      for (const group of game.provinceFacilityGroups?.[province.id] ?? []) {
        const aggregate = aggregates.get(group.facilityTypeId);
        if (!aggregate) continue;
        const count = Math.max(0, Number(group.count || 0));
        if (count <= 0) continue;
        aggregate.totalCount += count;
        aggregate.provinceIds.add(province.id);
        if (group.status === 'running') {
          aggregate.runningCount += Math.max(0, Number(group.participatingCount ?? count));
        }
        if (group.status === 'error') aggregate.blockedCount += count;
      }
    }
    return [...aggregates.values()].filter((row) => row.totalCount > 0);
  }, [game.facilityTypes, game.provinceFacilityGroups, provinces]);

  const totalFacilities = provinceRows.reduce((sum, row) => sum + row.facilityCount, 0);
  const totalRunning = provinceRows.reduce((sum, row) => sum + row.runningFacilityCount, 0);
  const totalBlocked = provinceRows.reduce((sum, row) => sum + row.blockedFacilityCount, 0);
  const occupiedProvinceCount = provinceRows.filter((row) => row.facilityCount > 0).length;
  const currentProvinceName = model.selectedProvince?.name || '加利福尼亚州';
  const activeProvince = activeProvinceId
    ? provinces.find((province) => province.id === activeProvinceId)
    : undefined;

  const openProvinceBuildings = (provinceId: string) => {
    model.setSelectedProvinceId(provinceId);
    setActiveProvinceId(provinceId);
  };

  if (activeProvince) {
    const provinceReady = model.selectedProvinceId === activeProvince.id;
    return (
      <PageLayout
        title="建筑"
        actions={(
          <div className="global-operation-page-actions">
            <StatusTag>{activeProvince.name}地区建筑</StatusTag>
            <Button variant="secondary" onClick={() => setActiveProvinceId(null)}>返回全局建筑</Button>
          </div>
        )}
      >
        <div className="global-operation-page global-buildings-page" data-global-scope="buildings" data-drilldown-province-id={activeProvince.id}>
          <section className="global-operation-drilldown-context" aria-label="当前地区建筑">
            <small>全局建筑 · 地区生产视图</small>
            <h2>{activeProvince.name}建筑</h2>
          </section>
          {provinceReady ? (
            <Suspense fallback={<Panel className="empty-state"><span role="status">正在加载地区建筑…</span></Panel>}>
              <EmbeddedBuildingsPage model={model} embedded />
            </Suspense>
          ) : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="建筑">
      <div className="global-operation-page global-buildings-page" data-global-scope="buildings">
        <section className="global-operation-metrics" aria-label="全局建筑汇总">
          <MetricCard label="工厂总数" value={formatNumber(totalFacilities)} detail="所有已解锁州合计" />
          <MetricCard label="运行中" value={formatNumber(totalRunning)} tone={totalRunning > 0 ? 'success' : 'neutral'} detail="各州运行工厂合计" />
          <MetricCard label="异常" value={formatNumber(totalBlocked)} tone={totalBlocked > 0 ? 'danger' : 'neutral'} detail="需要处理的本地工厂" />
          <MetricCard label="有工厂地区" value={formatNumber(occupiedProvinceCount)} detail={`已解锁 ${formatNumber(provinces.length)} 州`} />
        </section>

        <PagePanel className="global-current-scope-summary">
          <WidgetHeading title="当前经营州" action={<StatusTag>地图选择</StatusTag>} />
          <h2>{currentProvinceName}建筑</h2>
          <p className="muted">当前经营州只决定后续地区写操作；本页默认汇总全部已解锁州的工厂。点击州卡进入对应地区的建设与生产管理。</p>
        </PagePanel>

        <PagePanel>
          <WidgetHeading title="全局工厂目录" action={<StatusTag>{formatNumber(facilityRows.length)} 类已拥有</StatusTag>} />
          {facilityRows.length > 0 ? (
            <ul className="global-operation-summary-list" aria-label="跨州工厂汇总">
              {facilityRows.map((row) => (
                <li className="global-operation-summary-row global-facility-type-row" key={row.facilityTypeId}>
                  <span className="global-operation-summary-identity">
                    <span className="global-operation-summary-artwork" aria-hidden="true"><FacilityIcon facilityTypeId={row.facilityTypeId} /></span>
                    <strong>{row.name}</strong>
                  </span>
                  <span><small>拥有</small><strong>{formatNumber(row.totalCount)}</strong></span>
                  <span><small>运行中</small><strong>{formatNumber(row.runningCount)}</strong></span>
                  <span><small>分布州数</small><strong>{formatNumber(row.provinceIds.size)}</strong></span>
                </li>
              ))}
            </ul>
          ) : <Panel className="empty-state">当前还没有已建成工厂。</Panel>}
        </PagePanel>

        <PagePanel>
          <WidgetHeading title="地区建筑" action={<StatusTag>{formatNumber(provinceRows.length)} 个已解锁州</StatusTag>} />
          <div className="global-province-grid" aria-label="全局地区建筑入口">
            {provinceRows.map((row) => (
              <button
                type="button"
                className="global-province-card"
                data-ui-interactive="surface"
                data-province-id={row.province.id}
                key={row.province.id}
                aria-label={`打开${row.province.name}地区建筑`}
                onClick={() => openProvinceBuildings(row.province.id)}
              >
                <span className="global-province-card__title"><strong>{row.province.name}</strong><small>{row.province.shortName}</small></span>
                <span><small>工厂总数</small><strong>{formatNumber(row.facilityCount)}</strong></span>
                <span><small>运行中</small><strong>{formatNumber(row.runningFacilityCount)}</strong></span>
                <span><small>已停止</small><strong>{formatNumber(row.stoppedFacilityCount)}</strong></span>
                <span><small>异常</small><strong>{formatNumber(row.blockedFacilityCount)}</strong></span>
              </button>
            ))}
          </div>
        </PagePanel>
      </div>
    </PageLayout>
  );
}
