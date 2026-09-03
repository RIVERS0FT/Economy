import { useEffect, useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { ChevronIcon } from '../components/icons/GameIcons';
import { useTransportRouteDraft } from '../components/shell/TransportRouteDraftContext';
import { CompactNumber } from '../components/ui/CompactNumber';
import { TextInput } from '../components/ui/FormControls';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { Button, PageLayout, StatusTag, WidgetHeading } from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import type { TransportModeId, TransportRoute, TransportShipment, TransportTripType } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  formatTransportDuration,
  isTransportRouteClosed,
  TRANSPORT_DEFAULT_TRIP_TYPE,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
  transportCycleCost,
  transportRouteSetupCost,
  transportRouteStopIds,
} from '../utils/provinceLogistics';

type TransportRouteView = TransportRoute & { setupCost?: number };
type ManifestEntry = { productId: string; destinationProvinceId: string; quantity: number };
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

function routeRuntimeLabel(shipment: TransportShipmentView | undefined) {
  if (!shipment) return '等待在线规划';
  return shipment.status === 'docked' ? '节点装卸' : '运输中';
}

export function TransportPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const { game } = model;
  const pageNavigation = usePlayerPageNavigation();
  const now = useNow(game.lastProcessedAt, 1_000);
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

  const provinceById = useMemo(() => new Map(game.provinces.map((province) => [province.id, province])), [game.provinces]);
  const productById = useMemo(() => new Map(game.products.map((product) => [product.id, product])), [game.products]);
  const activeByRouteId = useMemo(() => new Map(
    shipments
      .filter((shipment) => shipment.status !== 'arrived' && shipment.routeId)
      .map((shipment) => [String(shipment.routeId), shipment]),
  ), [shipments]);

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
    if (
      Number.isFinite(Number(route.cycleDistanceKm))
      && Number.isFinite(Number(route.cycleTransportFee))
      && Number.isFinite(Number(route.cycleFuelCost))
      && Number.isFinite(Number(route.cycleCost))
    ) {
      return {
        distanceKm: Number(route.cycleDistanceKm),
        transportFee: Number(route.cycleTransportFee),
        fuelCost: Number(route.cycleFuelCost),
        totalCost: Number(route.cycleCost),
      };
    }
    const calculated = transportCycleCost(route, route.mode, provinceById);
    return {
      distanceKm: calculated.distanceKm,
      transportFee: calculated.transportFee,
      fuelCost: calculated.fuelCost,
      totalCost: calculated.totalCost,
    };
  }

  useEffect(() => {
    setRouteNameDraft(detailRoute ? visibleRouteName(detailRoute) : '');
  }, [detailRoute?.destinationProvinceId, detailRoute?.id, detailRoute?.name, detailRoute?.sourceProvinceId]);

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
    await runMutation(`route-rename:${route.id}`, () => model.renameTransportRoute(route.id, name));
  }

  async function deleteRoute(route: TransportRouteView) {
    const ok = await runMutation(`route-delete:${route.id}`, () => model.deleteTransportRoute(route.id));
    if (ok) {
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
    if (entries.length === 0) return <span className="transport-empty">无车载货物</span>;
    return (
      <ul className="transport-manifest-list">
        {entries.map((entry, index) => (
          <li key={`${entry.productId}-${entry.destinationProvinceId}-${index}`}>
            <strong>{productById.get(entry.productId)?.name ?? entry.productId}</strong>
            <span>×<CompactNumber value={entry.quantity} /></span>
            <span><ChevronIcon direction="right" />{provinceById.get(entry.destinationProvinceId)?.name ?? entry.destinationProvinceId}</span>
          </li>
        ))}
      </ul>
    );
  }

  function shipmentProgress(shipment: TransportShipmentView) {
    if (shipment.status === 'docked') {
      const provinceId = shipment.currentProvinceId ?? shipment.stopPlan?.[0]?.provinceId;
      const name = provinceId ? provinceById.get(provinceId)?.name ?? provinceId : '当前节点';
      return `停靠 ${name} · 在线自动装卸`;
    }
    const nextStop = (shipment.stopPlan || [])[0];
    const nextName = nextStop ? provinceById.get(nextStop.provinceId)?.name ?? nextStop.provinceId : '';
    const remaining = formatTransportDuration(Math.max(0, shipment.arrivesAt - now));
    return nextName ? `下一站 ${nextName} · 剩余 ${remaining}` : `剩余 ${remaining}`;
  }

  function shipmentCard(shipment: TransportShipmentView, active: boolean) {
    const timestamp = active
      ? shipment.arrivesAt
      : Number(shipment.arrivedAt || shipment.arrivesAt);
    return (
      <li className="transport-shipment-card" key={shipment.id} data-shipment-status={shipment.status}>
        <div className="transport-shipment-heading">
          <strong>{active ? shipmentProgress(shipment) : '已完成'}</strong>
          <StatusTag tone={active ? 'info' : 'neutral'}>{TRANSPORT_MODES[shipment.mode]?.name ?? shipment.mode}</StatusTag>
        </div>
        {routePath(shipment)}
        <div className="transport-shipment-meta">
          <span><small>周期总费用</small><strong>{formatCurrency(shipment.cost)}</strong></span>
          <span><small>运输费</small><strong>{formatCurrency(Number(shipment.transportFee || 0))}</strong></span>
          <span><small>燃料费</small><strong>{formatCurrency(Number(shipment.fuelCost || 0))}</strong></span>
          <span><small>{active ? shipment.status === 'docked' ? '停靠时间' : '预计到站' : '完成时间'}</small><strong>{new Date(timestamp).toLocaleString()}</strong></span>
        </div>
        <div className="transport-shipment-cargo">
          <small>{active ? '当前车载' : '周期运输记录'}</small>
          {manifestList(shipment)}
        </div>
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

    return (
      <PageLayout title={visibleRouteName(detailRoute)}>
        <div className="transport-page-content" data-transport-route-detail={detailRoute.id}>
          <section className="transport-page-section transport-route-detail-panel">
            <WidgetHeading
              title="路线设置"
              action={<StatusTag tone={activeShipment ? 'info' : 'neutral'}>{routeRuntimeLabel(activeShipment ?? undefined)}</StatusTag>}
            />
            <div className="transport-route-name-editor">
              <TextInput
                label="路线名称"
                value={routeNameDraft}
                maxLength={40}
                disabled={Boolean(pendingAction)}
                onChange={(event) => setRouteNameDraft(event.target.value)}
              />
              <Button
                variant="secondary"
                disabled={Boolean(pendingAction) || !routeNameDraft.trim() || routeNameDraft.trim() === visibleRouteName(detailRoute)}
                onClick={() => void renameRoute(detailRoute)}
              >
                保存名称
              </Button>
            </div>
            {routePath(detailRoute)}
            <div className="transport-route-summary-grid">
              <span><small>行程</small><strong>{routeTripLabel(detailRoute)}</strong></span>
              <span><small>运输方式</small><strong>{routeMode?.name ?? detailRoute.mode}</strong></span>
              <span><small>最大载荷</small><strong><CompactNumber value={routeMode?.capacity ?? 0} /></strong></span>
              <span><small>站点</small><strong>{transportRouteStopIds(detailRoute).length}</strong></span>
              <span><small>周期距离</small><strong>{Math.round(cycleCost.distanceKm).toLocaleString()} km</strong></span>
              <span><small>周期运输费</small><strong>{formatCurrency(cycleCost.transportFee)}</strong></span>
              <span><small>周期燃料费</small><strong>{formatCurrency(cycleCost.fuelCost)}</strong></span>
              <span><small>周期总费用</small><strong>{formatCurrency(cycleCost.totalCost)}</strong></span>
              <span><small>建线投入</small><strong>{formatCurrency(Number(detailRoute.setupCost || 0))}</strong></span>
            </div>
            <p className="transport-route-auto-note">起终点相同时按环线运行；起终点不同时按保存路径到达终点后沿原路返回。运输费和整周期燃料费都只按完整周期距离计算，并只在从起点启动新周期时一次性扣除。</p>
            <p className="transport-route-auto-note">在线客户端在每个停靠节点根据最新库存和州级行情自动决定装卸；服务器只校验真实库存、车辆容量、节点位置和资产守恒。客户端离线时车辆最多到达当前下一节点，并停靠等待重新上线。</p>
            <p className="transport-route-auto-note">路线创建后不可修改路径或运输方式；需要调整时请删除后重新建立并再次支付建线费。</p>
            <div className="transport-route-editor-actions">
              <Button variant="danger" disabled={Boolean(pendingAction) || Boolean(activeShipment)} onClick={() => void deleteRoute(detailRoute)}>删除路线</Button>
            </div>
          </section>

          <section className="transport-page-section transport-route-current-panel">
            <WidgetHeading title="当前运输" />
            {activeShipment ? (
              <ul className="transport-shipment-list">{shipmentCard(activeShipment, true)}</ul>
            ) : (
              <p className="transport-empty">当前没有运行中的运输周期；在线客户端发现可运输机会后会从起点启动新周期。</p>
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
                  const stops = transportRouteStopIds(route);
                  const cycleCost = cycleCostFor(route);
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
                        <StatusTag tone={activeShipment ? 'info' : 'neutral'}>{routeRuntimeLabel(activeShipment)}</StatusTag>
                      </div>
                      {routePath(route)}
                      <div className="transport-route-summary-grid">
                        <span><small>方式</small><strong>{TRANSPORT_MODES[route.mode]?.name ?? route.mode}</strong></span>
                        <span><small>行程</small><strong>{routeTripLabel(route)}</strong></span>
                        <span><small>周期距离</small><strong>{Math.round(cycleCost.distanceKm).toLocaleString()} km</strong></span>
                        <span><small>周期费用</small><strong>{formatCurrency(cycleCost.totalCost)}</strong></span>
                        <span><small>建线投入</small><strong>{formatCurrency(Number(route.setupCost || 0))}</strong></span>
                      </div>
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
