import { useEffect, useMemo, useState } from 'react';
import { transportCyclePolicyForShipment } from '../../shared/transport-policy.js';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { ChevronIcon } from '../components/icons/GameIcons';
import { useTransportRouteDraft } from '../components/shell/TransportRouteDraftContext';
import { CompactNumber } from '../components/ui/CompactNumber';
import { TextInput } from '../components/ui/FormControls';
import { GameConcept } from '../components/ui/GameConcept';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { Button, PageLayout, StatusTag, WidgetHeading } from '../components/ui/layout';
import type { TransportModeId, TransportRoute, TransportShipment, TransportTripType } from '../types';
import { formatCurrency } from '../utils/formatters';
import { estimateTransportRoute } from '../transport/transportPlanning.js';
import { TransportForecast, TransportFuel, TransportLoad, TransportModeComparison, transportWaitingLabel } from '../transport/TransportEconomics';
import { TransportShipmentProgress } from '../transport/TransportShipmentProgress';
import { useTransportForecastNow } from '../transport/useTransportForecastNow';
import {
  isTransportRouteClosed,
  TRANSPORT_DEFAULT_TRIP_TYPE,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
  transportCycleCost,
  transportRouteSetupCost,
  transportRouteStopIds,
} from '../utils/provinceLogistics';

type TransportRouteView = TransportRoute & { setupCost?: number };
type ManifestEntry = { productId: string; destinationProvinceId?: string; quantity: number };
type LegPlanEntry = {
  fromProvinceId: string;
  toProvinceId: string;
  departsAt: number;
  arrivesAt: number;
  remainingLoad: number;
};
type TransportShipmentView = TransportShipment & {
  routeName?: string;
  manifest?: ManifestEntry[];
  legPlan?: LegPlanEntry[];
};
type RouteConfig = {
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds?: string[];
  tripType?: TransportTripType;
  mode: TransportModeId;
};

function routeTripLabel(route: RouteConfig) {
  return isTransportRouteClosed(route) ? '环线' : '往返';
}

function shipmentManifest(shipment: TransportShipmentView): ManifestEntry[] {
  return Array.isArray(shipment.manifest) ? shipment.manifest : [];
}

function routeRuntimeLabel(shipment: TransportShipmentView | undefined, waitingLabel: string) {
  if (!shipment) return waitingLabel;
  return shipment.status === 'docked' ? '节点装卸' : '运输中';
}

export function TransportPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const { game } = model;
  const pageNavigation = usePlayerPageNavigation();
  const routes = (Array.isArray(game.transportRoutes) ? game.transportRoutes : []) as TransportRouteView[];
  const shipments = (Array.isArray(game.transportShipments) ? game.transportShipments : []) as TransportShipmentView[];
  const {
    draft: routeDraft,
    setDraft,
    closeDraft,
    picking,
    beginPicking,
    setHighlightedRouteId,
  } = useTransportRouteDraft();
  const [pendingAction, setPendingAction] = useState('');
  const [routeNameDraft, setRouteNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const provinceById = useMemo(() => new Map(game.provinces.map((province) => [province.id, province])), [game.provinces]);
  const productById = useMemo(() => new Map(game.products.map((product) => [product.id, product])), [game.products]);
  const activeByRouteId = useMemo(() => new Map(
    shipments
      .filter((shipment) => shipment.status !== 'arrived' && shipment.routeId)
      .map((shipment) => [String(shipment.routeId), shipment]),
  ), [shipments]);

  const planningRoutes = useMemo(() => routeDraft
    ? [...routes, ...(['road', 'rail', 'air'] as TransportModeId[]).map((mode) => ({ ...routeDraft, mode }))]
    : routes, [game.transportRoutes, routeDraft]);
  const now = useTransportForecastNow(game, planningRoutes, provinceById);
  const routeEstimates = useMemo(() => new Map(routes.map((route) => [
    route.id, estimateTransportRoute(game, route, now, provinceById),
  ])), [game, now, provinceById]);

  const currentLocation = pageNavigation?.currentLocation;
  const detailRouteId = currentLocation?.type === 'transport-route' ? currentLocation.routeId : null;
  const detailRoute = detailRouteId ? routes.find((route) => route.id === detailRouteId) ?? null : null;

  function defaultRouteName(route: RouteConfig) {
    const source = provinceById.get(route.sourceProvinceId)?.name ?? route.sourceProvinceId;
    const destination = provinceById.get(route.destinationProvinceId)?.name ?? route.destinationProvinceId;
    return `${source}-${destination}`;
  }

  function visibleRouteName(route: TransportRouteView) {
    return route.name?.trim() || defaultRouteName(route);
  }

  function cycleCostFor(route: TransportRouteView) {
    if (Number.isFinite(route.cycleDistanceKm) && Number.isFinite(route.cycleTransportFee)
      && Number.isSafeInteger(route.cycleFuelQuantity)) {
      return {
        distanceKm: Number(route.cycleDistanceKm), transportFee: Number(route.cycleTransportFee),
        fuelPurchased: Number(route.cycleFuelQuantity),
      };
    }
    return transportCycleCost(route, route.mode, provinceById);
  }

  useEffect(() => {
    setRouteNameDraft(detailRoute ? visibleRouteName(detailRoute) : '');
    setEditingName(false);
    setConfirmingDelete(false);
  }, [detailRoute?.destinationProvinceId, detailRoute?.id, detailRoute?.name, detailRoute?.sourceProvinceId]);

  useEffect(() => {
    setHighlightedRouteId(detailRouteId);
    return () => setHighlightedRouteId(null);
  }, [detailRouteId, setHighlightedRouteId]);

  async function runMutation(key: string, operation: () => Promise<{ ok: boolean; message: string }>) {
    if (pendingAction) return false;
    setPendingAction(key);
    try {
      const result = await operation();
      await model.showResult(result);
      return result.ok;
    } finally {
      setPendingAction('');
    }
  }

  function mutationInput(route: RouteConfig) {
    return {
      sourceProvinceId: route.sourceProvinceId,
      destinationProvinceId: route.destinationProvinceId,
      viaProvinceIds: route.viaProvinceIds,
      mode: route.mode,
    };
  }

  function beginCreateRoute() {
    setDraft({
      routeId: null,
      sourceProvinceId: '',
      destinationProvinceId: '',
      viaProvinceIds: [],
      tripType: TRANSPORT_DEFAULT_TRIP_TYPE,
      mode: 'road',
    });
    beginPicking();
  }

  async function saveRouteDraft() {
    if (!routeDraft) return;
    const stops = transportRouteStopIds(routeDraft);
    if (!routeDraft.sourceProvinceId || !routeDraft.destinationProvinceId || stops.length < 2) {
      await model.showResult({ ok: false, message: '请先在地图上选择完整运输路线' });
      return;
    }
    if (routeDraft.routeId) {
      await model.showResult({ ok: false, message: '路线创建后不可修改，请删除后重新建立' });
      closeDraft();
      return;
    }
    const ok = await runMutation(
      'route-create',
      () => model.createTransportRoute(mutationInput(routeDraft)),
    );
    if (ok) closeDraft();
  }

  async function renameRoute(route: TransportRouteView) {
    const name = routeNameDraft.trim();
    if (!name) {
      await model.showResult({ ok: false, message: '路线名称不能为空' });
      return;
    }
    const ok = await runMutation(`route-rename:${route.id}`, () => model.renameTransportRoute(route.id, name));
    if (ok) setEditingName(false);
  }

  async function deleteRoute(route: TransportRouteView) {
    const ok = await runMutation(`route-delete:${route.id}`, () => model.deleteTransportRoute(route.id));
    setConfirmingDelete(false);
    if (ok && !activeByRouteId.has(route.id)) {
      closeDraft();
      pageNavigation?.replacePage({ type: 'tab', tab: 'transport' });
    }
  }

  function routePath(route: RouteConfig) {
    const stopIds = transportRouteStopIds(route);
    return (
      <div className="transport-route-path" aria-label="运输路线站点">
        {stopIds.map((provinceId, index) => (
          <span className="transport-route-path-stop" key={`${provinceId}-${index}`}>
            {index > 0 ? <ChevronIcon direction="right" /> : null}
            <strong>{provinceById.get(provinceId)?.name ?? provinceId}</strong>
          </span>
        ))}
      </div>
    );
  }

  function manifestList(shipment: TransportShipmentView) {
    const entries = shipmentManifest(shipment);
    if (entries.length === 0) return <span className="transport-empty">{shipment.status === 'arrived' ? '无交货记录' : '无车载货物'}</span>;
    return (
      <ul className="transport-manifest-list" data-delivered-history={shipment.status === 'arrived'}>
        {entries.map((entry, index) => (
          <li key={`${entry.productId}-${entry.destinationProvinceId}-${index}`}>
            <strong>{productById.get(entry.productId)?.name ?? entry.productId}</strong>
            <span>×<CompactNumber value={entry.quantity} /></span>
            {shipment.status === 'arrived' && entry.destinationProvinceId ? <span><ChevronIcon direction="right" />{provinceById.get(entry.destinationProvinceId)?.name ?? entry.destinationProvinceId}</span> : null}
          </li>
        ))}
      </ul>
    );
  }

  function shipmentFuel(shipment: TransportShipmentView) {
    return transportCyclePolicyForShipment(shipment).fuelProductId
      ? <TransportFuel quantity={Number(shipment.fuelPurchased || 0)} />
      : <span>旧制燃料费 {formatCurrency(Number(shipment.fuelCost || 0))}</span>;
  }

  function nodeRecords(shipment: TransportShipmentView) {
    if (!shipment.nodeHistory?.length) return manifestList(shipment);
    return (
      <ol className="transport-node-records">
        {shipment.nodeHistory.map((visit, index) => (
          <li key={`${visit.visitIndex}-${index}`}>
            <strong>第 {visit.visitIndex + 1} 站 · {provinceById.get(visit.provinceId)?.name ?? visit.provinceId}</strong>
            <span className="transport-node-time">{new Date(visit.servicedAt).toLocaleString()}</span>
            {(['unload', 'load'] as const).map((kind) => visit[kind].length > 0 ? (
              <span className="transport-node-cargo" key={kind}>
                <small>{kind === 'unload' ? '卸货' : '装货'}</small>
                {visit[kind].map((entry) => <span key={entry.productId}>{productById.get(entry.productId)?.name ?? entry.productId} ×<CompactNumber value={entry.quantity} /></span>)}
              </span>
            ) : null)}
            {visit.unload.length === 0 && visit.load.length === 0 ? <span className="transport-empty">未装卸</span> : null}
          </li>
        ))}
      </ol>
    );
  }

  function shipmentCard(shipment: TransportShipmentView, active: boolean) {
    const timestamp = active ? shipment.arrivesAt : Number(shipment.arrivedAt || shipment.arrivesAt);
    if (!active) return (
      <li className="transport-shipment-card" key={shipment.id} data-shipment-status={shipment.status}>
        <details className="transport-history-details">
          <summary>
            <strong>{new Date(timestamp).toLocaleString()}</strong>
            <span>运费 {formatCurrency(Number(shipment.transportFee ?? shipment.cost))}</span>
            {shipmentFuel(shipment)}
            <span>交货 <CompactNumber value={Number(shipment.deliveredQuantity || 0)} /></span>
          </summary>
          {nodeRecords(shipment)}
        </details>
      </li>
    );
    return (
      <li className="transport-shipment-card" key={shipment.id} data-shipment-status={shipment.status}>
        <div className="transport-shipment-heading">
          <strong><TransportShipmentProgress shipment={shipment} provinceById={provinceById} referenceNow={game.lastProcessedAt} /></strong>
          <StatusTag tone="info">{shipment.status === 'docked' ? '节点装卸' : '运输中'}</StatusTag>
        </div>
        <TransportLoad shipment={shipment} />
        <div className="transport-shipment-meta">
          <span><small>本趟已付运费</small><strong>{formatCurrency(Number(shipment.transportFee ?? shipment.cost))}</strong></span>
          <span><small><GameConcept concept="transport-fuel">本趟已扣燃料</GameConcept></small><strong>{shipmentFuel(shipment)}</strong></span>
          <span><small>已交货数量</small><strong><CompactNumber value={Number(shipment.deliveredQuantity || 0)} /></strong></span>
          <span><small>{shipment.status === 'docked' ? '停靠时间' : '预计到站'}</small><strong>{new Date(timestamp).toLocaleString()}</strong></span>
        </div>
        <div className="transport-shipment-cargo"><small>当前车载</small>{manifestList(shipment)}</div>
        {shipment.nodeHistory?.length ? <details className="transport-history-details"><summary>本趟装卸记录</summary>{nodeRecords(shipment)}</details> : null}
      </li>
    );
  }

  const pendingDraftPanel = routeDraft && !picking ? (
    <section className="transport-page-section transport-route-draft-panel" data-route-draft-id={routeDraft.routeId ?? 'new'}>
      <WidgetHeading
        title="新路线待保存"
        action={<StatusTag tone="warning">保存后不可修改</StatusTag>}
      />
      {routePath(routeDraft)}
      <div className="transport-route-summary-grid">
        <span><small>行程</small><strong>{routeTripLabel(routeDraft)}</strong></span>
        <span><small>运输方式</small><strong>{TRANSPORT_MODES[routeDraft.mode]?.name ?? routeDraft.mode}</strong></span>
        <span><small>站点</small><strong>{transportRouteStopIds(routeDraft).length}</strong></span>
        <span><small>一次性建线费</small><strong>{formatCurrency(transportRouteSetupCost(routeDraft, routeDraft.mode, provinceById))}</strong></span>
      </div>
      <TransportModeComparison
        game={game} route={routeDraft} now={now} provinceById={provinceById}
        disabled={Boolean(pendingAction)} onSelect={(mode) => setDraft({ ...routeDraft, mode })}
      />
      <div className="transport-route-editor-actions">
        <Button variant="primary" disabled={Boolean(pendingAction)} onClick={() => void saveRouteDraft()}>创建路线</Button>
        <Button variant="secondary" disabled={Boolean(pendingAction)} onClick={closeDraft}>取消</Button>
      </div>
    </section>
  ) : null;

  if (detailRouteId) {
    if (!detailRoute) {
      return (
        <PageLayout title="运输路线">
          <section className="transport-page-section">
            <p className="transport-empty">该运输路线不存在或已删除。</p>
            <Button variant="secondary" onClick={() => pageNavigation?.replacePage({ type: 'tab', tab: 'transport' })}>返回运输</Button>
          </section>
        </PageLayout>
      );
    }

    const activeShipment = activeByRouteId.get(detailRoute.id) ?? null;
    const routeShipments = shipments
      .filter((shipment) => String(shipment.routeId || '') === detailRoute.id)
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    const history = routeShipments.filter((shipment) => shipment.status === 'arrived');
    const routeMode = TRANSPORT_MODES[detailRoute.mode];
    const cycleCost = cycleCostFor(detailRoute);
    const detailEstimate = routeEstimates.get(detailRoute.id) ?? estimateTransportRoute(game, detailRoute, now, provinceById);

    return (
      <PageLayout title={visibleRouteName(detailRoute)}>
        <div className="transport-page-content" data-transport-route-detail={detailRoute.id}>
          <section className="transport-page-section transport-route-detail-panel">
            <WidgetHeading
              title="路线概览"
              action={<StatusTag tone={activeShipment ? 'info' : 'neutral'}>{detailRoute.deletionPending ? '本趟完成后删除' : routeRuntimeLabel(activeShipment ?? undefined, transportWaitingLabel(detailEstimate))}</StatusTag>}
            />
            {editingName ? (
              <div className="transport-route-name-editor">
                <TextInput label="路线名称" value={routeNameDraft} maxLength={40} disabled={Boolean(pendingAction)} onChange={(event) => setRouteNameDraft(event.target.value)} />
                <Button variant="secondary" disabled={Boolean(pendingAction) || !routeNameDraft.trim() || routeNameDraft.trim() === visibleRouteName(detailRoute)} onClick={() => void renameRoute(detailRoute)}>保存名称</Button>
                <Button variant="secondary" disabled={Boolean(pendingAction)} onClick={() => setEditingName(false)}>取消</Button>
              </div>
            ) : null}
            {routePath(detailRoute)}
            <div className="transport-route-summary-grid">
              <span><small><GameConcept concept="transport-trip">行程</GameConcept></small><strong>{routeTripLabel(detailRoute)}</strong></span>
              <span><small>运输方式</small><strong>{routeMode?.name ?? detailRoute.mode}</strong></span>
              <span><small>最大载荷</small><strong><CompactNumber value={activeShipment ? transportCyclePolicyForShipment(activeShipment).capacity : routeMode?.capacity ?? 0} /></strong></span>
              <span><small><GameConcept concept="transport-distance" /></small><strong>{Math.round(cycleCost.distanceKm).toLocaleString()} km</strong></span>
            </div>
            <div className="transport-route-rules">
              <GameConcept concept="transport-node-service" />
              <GameConcept concept="transport-online" />
              <GameConcept concept="transport-route-maintenance" />
            </div>
            <div className="transport-route-editor-actions">
              {!editingName ? <Button variant="secondary" disabled={Boolean(pendingAction) || detailRoute.deletionPending} onClick={() => setEditingName(true)}>重命名</Button> : null}
              {confirmingDelete ? <>
                <Button variant="danger" disabled={Boolean(pendingAction)} onClick={() => void deleteRoute(detailRoute)}>{activeShipment ? '确认本趟完成后删除' : '确认删除路线'}</Button>
                <Button variant="secondary" disabled={Boolean(pendingAction)} onClick={() => setConfirmingDelete(false)}>取消</Button>
              </> : <Button variant="danger" disabled={Boolean(pendingAction) || detailRoute.deletionPending} onClick={() => setConfirmingDelete(true)}>{activeShipment ? '本趟完成后删除' : '删除路线'}</Button>}
            </div>
          </section>

          <section className="transport-page-section transport-route-current-panel">
            <WidgetHeading title="本趟运输" />
            {activeShipment ? (
              <ul className="transport-shipment-list">{shipmentCard(activeShipment, true)}</ul>
            ) : (
              <TransportForecast estimate={detailEstimate} />
            )}
          </section>

          <section className="transport-page-section transport-route-history-panel">
            <WidgetHeading title="运输记录" />
            {history.length > 0 ? (
              <ul className="transport-shipment-list">{history.map((shipment) => shipmentCard(shipment, false))}</ul>
            ) : (
              <p className="transport-empty">该路线暂无已完成运输记录。</p>
            )}
          </section>
        </div>
      </PageLayout>
    );
  }

  const canAddRoute = game.provinces.length >= 2 && routes.length < TRANSPORT_MAX_ROUTES_PER_PLAYER;
  return (
    <PageLayout title="运输">
      <div className="transport-page-content" data-transport-route-index="true">
        <div className="transport-page-index-body">
          {pendingDraftPanel}

          <section className="transport-page-section transport-routes-panel">
            {routes.length > 0 ? (
              <div className="transport-route-grid">
                {routes.map((route) => {
                  const activeShipment = activeByRouteId.get(route.id);
                  const cycleCost = cycleCostFor(route);
                  const estimate = routeEstimates.get(route.id) ?? estimateTransportRoute(game, route, now, provinceById);
                  return (
                    <button
                      type="button"
                      className="transport-route-card ui-entity-card"
                      key={route.id}
                      data-route-id={route.id}
                      data-transport-mode={route.mode}
                      onClick={() => pageNavigation?.pushPage({ type: 'transport-route', routeId: route.id })}
                      onMouseEnter={() => setHighlightedRouteId(route.id)}
                      onMouseLeave={() => setHighlightedRouteId(null)}
                      onFocus={() => setHighlightedRouteId(route.id)}
                      onBlur={() => setHighlightedRouteId(null)}
                    >
                      <div className="transport-route-card-heading">
                        <strong>{visibleRouteName(route)}</strong>
                        <StatusTag tone={activeShipment ? 'info' : 'neutral'}>{route.deletionPending ? '本趟完成后删除' : routeRuntimeLabel(activeShipment, transportWaitingLabel(estimate))}</StatusTag>
                      </div>
                      <span className="transport-route-mode">{TRANSPORT_MODES[route.mode]?.name ?? route.mode} · {routeTripLabel(route)}</span>
                      {routePath(route)}
                      <div className="transport-route-summary-grid">
                        <span><small>全线距离</small><strong>{Math.round(cycleCost.distanceKm).toLocaleString()} km</strong></span>
                        <span><small>下一趟预计增益</small><strong>{estimate.netGain === null ? '待条件满足' : formatCurrency(estimate.netGain)}</strong></span>
                      </div>
                      {activeShipment ? <><span className="transport-route-next-stop"><TransportShipmentProgress shipment={activeShipment} provinceById={provinceById} referenceNow={game.lastProcessedAt} /></span><TransportLoad shipment={activeShipment} /></> : null}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="transport-empty">暂无运输路线。选择“增加路线”后直接在地图上依次选择站点。</p>
            )}
          </section>
        </div>

        <div className="transport-page-footer" data-transport-page-footer="true">
          <Button variant="secondary" disabled={!canAddRoute || Boolean(pendingAction)} onClick={beginCreateRoute}>增加路线</Button>
        </div>
      </div>
    </PageLayout>
  );
}
