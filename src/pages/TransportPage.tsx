import { useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { ChevronIcon } from '../components/icons/GameIcons';
import { IntegerInput, SelectInput } from '../components/ui/FormControls';
import { useTransportRouteDraft, type TransportRouteDraft } from '../components/shell/TransportRouteDraftContext';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { CompactNumber } from '../components/ui/CompactNumber';
import { Button, PageLayout, PagePanel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import type { TransportModeId, TransportRoute, TransportShipment } from '../types';
import { formatCurrency } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import {
  formatTransportDuration,
  isTransportRouteClosed,
  TRANSPORT_DEFAULT_TRIP_TYPE,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
  transportRoutePlanMetrics,
  transportRouteStopIds,
} from '../utils/provinceLogistics';

type RouteLike = Pick<TransportRoute, 'sourceProvinceId' | 'destinationProvinceId' | 'viaProvinceIds' | 'tripType'>;

function routeTripLabel(route: RouteLike) {
  if (isTransportRouteClosed(route)) return '环线';
  return route.tripType === 'round' ? '往返' : '单程';
}

export function TransportPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const { game } = model;
  const now = useNow(game.lastProcessedAt, 1_000);
  const routes = Array.isArray(game.transportRoutes) ? game.transportRoutes : [];
  const shipments = Array.isArray(game.transportShipments) ? game.transportShipments : [];
  const {
    draft: routeDraft,
    setDraft,
    updateDraft: setRouteDraft,
    closeDraft,
    picking,
    beginPicking,
    finishPicking,
    cancelPicking,
    setHighlightedRouteStops,
  } = useTransportRouteDraft();
  const [pendingAction, setPendingAction] = useState('');

  const unlockedProvinceIds = useMemo(() => new Set([
    ...(Array.isArray(game.unlockedProvinces) ? game.unlockedProvinces : []),
    game.startingProvinceId,
  ].filter(Boolean)), [game.startingProvinceId, game.unlockedProvinces]);
  const unlockedProvinces = useMemo(
    () => game.provinces.filter((province) => unlockedProvinceIds.has(province.id)),
    [game.provinces, unlockedProvinceIds],
  );
  const provinceById = useMemo(
    () => new Map(game.provinces.map((province) => [province.id, province])),
    [game.provinces],
  );
  const productById = useMemo(
    () => new Map(game.products.map((product) => [product.id, product])),
    [game.products],
  );
  const activeShipments = useMemo(
    () => shipments
      .filter((shipment) => shipment.status === 'in-transit')
      .sort((left, right) => left.arrivesAt - right.arrivesAt),
    [shipments],
  );
  const completedShipments = useMemo(
    () => shipments
      .filter((shipment) => shipment.status === 'arrived')
      .sort((left, right) => Number(right.arrivedAt || right.createdAt) - Number(left.arrivedAt || left.createdAt)),
    [shipments],
  );

  function emptyRouteDraft(): TransportRouteDraft {
    const sourceProvinceId = unlockedProvinces[0]?.id ?? '';
    const destinationProvinceId = unlockedProvinces.find((province) => province.id !== sourceProvinceId)?.id ?? '';
    return {
      routeId: null,
      sourceProvinceId,
      destinationProvinceId,
      viaProvinceIds: [],
      tripType: TRANSPORT_DEFAULT_TRIP_TYPE,
      productId: game.products[0]?.id ?? '',
      quantity: '1',
      mode: 'road',
    };
  }

  function editRoute(route: TransportRoute) {
    setDraft({
      routeId: route.id,
      sourceProvinceId: route.sourceProvinceId,
      destinationProvinceId: route.destinationProvinceId,
      viaProvinceIds: Array.isArray(route.viaProvinceIds) ? [...route.viaProvinceIds] : [],
      tripType: route.tripType ?? 'one-way',
      productId: route.productId,
      quantity: String(route.quantity),
      mode: route.mode,
    });
  }

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

  async function saveRoute() {
    if (!routeDraft) return;
    const quantity = parseIntegerDraft(routeDraft.quantity, {
      min: 1,
      max: TRANSPORT_MODES[routeDraft.mode].capacity,
    });
    const closed = isTransportRouteClosed(routeDraft);
    const stopIds = transportRouteStopIds(routeDraft);
    if (
      !routeDraft.sourceProvinceId
      || !routeDraft.destinationProvinceId
      || stopIds.length < 2
      || (closed && routeDraft.viaProvinceIds.length < 1)
      || !routeDraft.productId
      || quantity === null
    ) {
      await model.showResult({ ok: false, message: '请完整填写有效的运输路线，站点不能重复且至少包含起终点' });
      return;
    }
    const routeId = routeDraft.routeId;
    const editing = Boolean(routeId);
    const input = {
      sourceProvinceId: routeDraft.sourceProvinceId,
      destinationProvinceId: routeDraft.destinationProvinceId,
      viaProvinceIds: routeDraft.viaProvinceIds,
      tripType: closed ? 'one-way' as const : routeDraft.tripType,
      productId: routeDraft.productId,
      quantity,
      mode: routeDraft.mode,
    };
    const ok = await runMutation(
      editing ? `update:${routeId}` : 'create',
      () => routeId
        ? model.updateTransportRoute(routeId, input)
        : model.createTransportRoute(input),
    );
    if (ok) {
      closeDraft();
      cancelPicking();
    }
  }

  function changeSourceProvince(sourceProvinceId: string) {
    if (!routeDraft) return;
    const viaProvinceIds = routeDraft.viaProvinceIds.filter((provinceId) => provinceId !== sourceProvinceId);
    const currentDestination = routeDraft.destinationProvinceId;
    const destinationProvinceId = currentDestination === sourceProvinceId
      ? (viaProvinceIds.length >= 1 ? sourceProvinceId : '')
      : currentDestination;
    setRouteDraft({
      sourceProvinceId,
      viaProvinceIds: viaProvinceIds.filter((provinceId) => provinceId !== destinationProvinceId),
      destinationProvinceId,
    });
  }

  function changeDestinationProvince(destinationProvinceId: string) {
    if (!routeDraft) return;
    const closingLoop = destinationProvinceId === routeDraft.sourceProvinceId
      && Boolean(routeDraft.destinationProvinceId)
      && routeDraft.destinationProvinceId !== destinationProvinceId;
    const viaAfterClose = closingLoop
      ? [...routeDraft.viaProvinceIds, routeDraft.destinationProvinceId]
      : routeDraft.viaProvinceIds;
    setRouteDraft({
      viaProvinceIds: viaAfterClose.filter((provinceId) => provinceId !== destinationProvinceId),
      destinationProvinceId,
    });
  }

  function appendViaProvince(provinceId: string) {
    if (!routeDraft || !provinceId) return;
    const stopIds = transportRouteStopIds(routeDraft);
    if (stopIds.includes(provinceId)) {
      void model.showResult({ ok: false, message: '该州已在线路中' });
      return;
    }
    if (isTransportRouteClosed(routeDraft)) {
      const nextStopIds = [...stopIds.slice(0, -1), provinceId];
      setRouteDraft({
        sourceProvinceId: nextStopIds[0],
        viaProvinceIds: nextStopIds.slice(1, -1),
        destinationProvinceId: nextStopIds[nextStopIds.length - 1],
      });
      return;
    }
    setRouteDraft({ viaProvinceIds: [...routeDraft.viaProvinceIds, provinceId] });
  }

  function removeViaProvince(provinceId: string) {
    if (!routeDraft) return;
    setRouteDraft({ viaProvinceIds: routeDraft.viaProvinceIds.filter((id) => id !== provinceId) });
  }

  const draftStopIds = routeDraft ? transportRouteStopIds(routeDraft) : [];
  const draftClosed = routeDraft ? isTransportRouteClosed(routeDraft) : false;
  const editorQuantity = routeDraft
    ? parseIntegerDraft(routeDraft.quantity, { min: 1, max: TRANSPORT_MODES[routeDraft.mode].capacity })
    : null;
  const editorPlan = routeDraft && editorQuantity !== null
    ? transportRoutePlanMetrics({ ...routeDraft, quantity: editorQuantity }, provinceById)
    : null;
  const canAddRoute = unlockedProvinces.length >= 2 && routes.length < TRANSPORT_MAX_ROUTES_PER_PLAYER;
  const viaOptions = routeDraft
    ? unlockedProvinces.filter((province) => !draftStopIds.includes(province.id))
    : [];

  function stopChipLabel(provinceId: string, index: number, total: number) {
    const province = provinceById.get(provinceId);
    const role = index === 0 ? '起' : index === total - 1 ? (draftClosed ? '环' : '终') : String(index);
    return `${role} · ${province?.name ?? provinceId}（${province?.capitalName ?? ''}）`;
  }

  function shipmentRow(shipment: TransportShipment, showRemaining: boolean) {
    const source = provinceById.get(shipment.sourceProvinceId);
    const destination = provinceById.get(shipment.destinationProvinceId);
    const product = productById.get(shipment.productId);
    const stopPlan = Array.isArray(shipment.stopPlan) ? shipment.stopPlan : [];
    const deliveredCount = stopPlan.filter((stop) => stop.deliveredAt).length;
    const nextStop = stopPlan.find((stop) => !stop.deliveredAt);
    const nextStopName = nextStop ? provinceById.get(nextStop.provinceId)?.name ?? nextStop.provinceId : '';
    const viaNames = (shipment.viaProvinceIds || []).map((provinceId) => provinceById.get(provinceId)?.name ?? provinceId);
    const progress = stopPlan.length > 1
      ? `已到 ${deliveredCount}/${stopPlan.length} 站${nextStopName ? ` · 下一站 ${nextStopName}` : ''} · 剩余 ${formatTransportDuration(Math.max(0, shipment.arrivesAt - now))}`
      : `剩余 ${formatTransportDuration(Math.max(0, shipment.arrivesAt - now))}`;
    return (
      <li key={shipment.id} className="transport-record-row">
        <div className="transport-record-route">
          <strong>{source?.name ?? shipment.sourceProvinceId}</strong>
          {viaNames.length > 0 ? (
            <>
              <ChevronIcon direction="right" />
              <span className="transport-record-via">{viaNames.join(' · ')}</span>
            </>
          ) : null}
          <ChevronIcon direction="right" />
          <strong>{destination?.name ?? shipment.destinationProvinceId}</strong>
          <StatusTag tone="neutral">{routeTripLabel(shipment)}</StatusTag>
        </div>
        <span>{product?.name ?? shipment.productId} 每站 ×<CompactNumber value={shipment.quantity} /></span>
        <span>{TRANSPORT_MODES[shipment.mode]?.name ?? shipment.mode}</span>
        <span className="transport-record-time">{showRemaining ? progress : '已到达'}</span>
      </li>
    );
  }

  return (
    <PageLayout title="运输">
      <div className="transport-page-content">
        <div className="transport-page-actions">
          <Button
            variant="secondary"
            disabled={!canAddRoute || Boolean(pendingAction)}
            onClick={() => setDraft(emptyRouteDraft())}
          >
            增加路线
          </Button>
        </div>
        {routeDraft ? (
        <PagePanel className="transport-route-editor">
          <WidgetHeading
            title={routeDraft.routeId ? '编辑运输路线' : '增加运输路线'}
            action={<StatusTag tone="neutral">整链一次发运 · 逐站交付</StatusTag>}
          />
          <div className="transport-route-stops" aria-label="运输站点序列">
            {draftStopIds.length > 0 ? draftStopIds.map((provinceId, index) => (
              <span
                key={`${provinceId}-${index}`}
                className="transport-route-stop-chip"
                data-stop-index={index}
                data-stop-role={index === 0 ? 'start' : index === draftStopIds.length - 1 ? 'end' : 'via'}
              >
                {stopChipLabel(provinceId, index, draftStopIds.length)}
                {index > 0 && index < draftStopIds.length - 1 ? (
                  <button
                    type="button"
                    className="transport-route-stop-remove"
                    aria-label={`移除站点 ${provinceById.get(provinceId)?.name ?? provinceId}`}
                    onClick={() => removeViaProvince(provinceId)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            )) : <span className="transport-route-stops-empty">先在地图上选择起点州</span>}
            <Button
              variant={picking ? 'primary' : 'secondary'}
              disabled={Boolean(pendingAction)}
              onClick={() => (picking ? finishPicking() : beginPicking())}
            >
              {picking ? '完成选择' : '在地图上选择'}
            </Button>
          </div>
          {picking ? (
            <p className="transport-route-picking-hint" role="status">
              地图已进入选州模式：按顺序点击州面追加站点，再次点击起点州闭环；未闭环默认往返运输。
            </p>
          ) : null}
          <div className="transport-route-editor-grid">
            <SelectInput
              label="起始州"
              value={routeDraft.sourceProvinceId}
              onChange={(event) => changeSourceProvince(event.target.value)}
            >
              {unlockedProvinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </SelectInput>
            <SelectInput
              label="目的州"
              value={routeDraft.destinationProvinceId}
              onChange={(event) => changeDestinationProvince(event.target.value)}
            >
              {!routeDraft.destinationProvinceId ? <option value="">请选择目的州</option> : null}
              {unlockedProvinces
                .filter((province) => (
                  province.id !== routeDraft.sourceProvinceId
                  || routeDraft.viaProvinceIds.length >= 1
                ))
                .map((province) => (
                  <option key={province.id} value={province.id}>
                    {province.id === routeDraft.sourceProvinceId ? `${province.name}（闭环）` : province.name}
                  </option>
                ))}
            </SelectInput>
            <SelectInput
              label="追加中间站"
              value=""
              onChange={(event) => appendViaProvince(event.target.value)}
            >
              <option value="">选择要追加的州</option>
              {viaOptions.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </SelectInput>
            <SelectInput
              label="行程"
              value={draftClosed ? 'loop' : routeDraft.tripType}
              disabled={draftClosed}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'round' || value === 'one-way') {
                  setRouteDraft({ tripType: value });
                }
              }}
            >
              {draftClosed ? <option value="loop">环线</option> : null}
              <option value="round">往返运输（默认）</option>
              <option value="one-way">单程运输</option>
            </SelectInput>
            <SelectInput
              label="商品"
              value={routeDraft.productId}
              onChange={(event) => setRouteDraft({ productId: event.target.value })}
            >
              {game.products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </SelectInput>
            <IntegerInput
              label="每站数量"
              value={routeDraft.quantity}
              fallbackValue={1}
              min={1}
              max={TRANSPORT_MODES[routeDraft.mode].capacity}
              onValueChange={(quantity) => setRouteDraft({ quantity })}
            />
            <SelectInput
              label="运输方式"
              value={routeDraft.mode}
              onChange={(event) => {
                const mode = event.target.value as TransportModeId;
                const parsed = parseIntegerDraft(routeDraft.quantity, { min: 1 });
                const quantity = parsed === null
                  ? routeDraft.quantity
                  : String(Math.min(parsed, TRANSPORT_MODES[mode].capacity));
                setRouteDraft({ mode, quantity });
              }}
            >
              {Object.values(TRANSPORT_MODES).map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.name} · 每站 ≤ {mode.capacity}</option>
              ))}
            </SelectInput>
          </div>
          <div className="transport-route-estimate" aria-label="路线预估">
            <span><small>总距离</small><strong>约 <CompactNumber value={Math.round(editorPlan?.distanceKm ?? 0)} /> 公里</strong></span>
            <span><small>单次总费用</small><strong><CurrencyAmount>{formatCurrency(editorPlan?.cost ?? 0)}</CurrencyAmount></strong></span>
            <span><small>全程耗时</small><strong>{formatTransportDuration(editorPlan?.durationMs ?? 0)}</strong></span>
            <span>
              <small>交付站数</small>
              <strong>{editorPlan ? editorPlan.deliveryStops.length : 0} 站 · 每站 ×<CompactNumber value={editorQuantity ?? 0} /></strong>
            </span>
          </div>
          <div className="transport-route-editor-actions">
            <Button variant="secondary" disabled={Boolean(pendingAction)} onClick={() => { closeDraft(); cancelPicking(); }}>取消</Button>
            <Button disabled={Boolean(pendingAction)} onClick={() => { void saveRoute(); }}>
              {routeDraft.routeId ? '保存路线' : '创建路线'}
            </Button>
          </div>
        </PagePanel>
      ) : null}

      <PagePanel className="transport-routes-panel">
        <WidgetHeading
          title="运输路线"
          action={<StatusTag tone="neutral">{routes.length} / {TRANSPORT_MAX_ROUTES_PER_PLAYER}</StatusTag>}
        />
        {routes.length > 0 ? (
          <div className="transport-route-grid">
            {routes.map((route) => {
              const source = provinceById.get(route.sourceProvinceId);
              const destination = provinceById.get(route.destinationProvinceId);
              const product = productById.get(route.productId);
              const routeStopIds = transportRouteStopIds(route);
              const closed = isTransportRouteClosed(route);
              const plan = transportRoutePlanMetrics({ ...route, quantity: route.quantity }, provinceById);
              const available = game.provinceInventories?.[route.sourceProvinceId]?.[route.productId]?.available ?? 0;
              return (
                <article
                  key={route.id}
                  className="transport-route-card"
                  onMouseEnter={() => setHighlightedRouteStops(routeStopIds)}
                  onMouseLeave={() => setHighlightedRouteStops(null)}
                  onFocus={() => setHighlightedRouteStops(routeStopIds)}
                  onBlur={() => setHighlightedRouteStops(null)}
                >
                  <div className="transport-route-card-heading">
                    <div className="transport-route-path">
                      <strong>{source?.name ?? route.sourceProvinceId}</strong>
                      {routeStopIds.slice(1, -1).map((provinceId) => (
                        <span key={provinceId} className="transport-route-via">
                          <ChevronIcon direction="right" />
                          {provinceById.get(provinceId)?.name ?? provinceId}
                        </span>
                      ))}
                      <ChevronIcon direction="right" />
                      <strong>{destination?.name ?? route.destinationProvinceId}</strong>
                    </div>
                    <div className="transport-route-tags">
                      <StatusTag tone="neutral">{routeTripLabel(route)}</StatusTag>
                      <StatusTag tone={TRANSPORT_MODES[route.mode].tone}>{TRANSPORT_MODES[route.mode].name}</StatusTag>
                    </div>
                  </div>
                  <div className="transport-route-product">
                    <strong>{product?.name ?? route.productId}</strong>
                    <span>每站 ×<CompactNumber value={route.quantity} /></span>
                  </div>
                  <div className="transport-route-meta">
                    <span><small>起点可用</small><strong><CompactNumber value={available} /></strong></span>
                    <span><small>总距离</small><strong><CompactNumber value={Math.round(plan?.distanceKm ?? 0)} /> km</strong></span>
                    <span><small>单次费用</small><strong><CurrencyAmount>{formatCurrency(plan?.cost ?? 0)}</CurrencyAmount></strong></span>
                    <span><small>全程耗时</small><strong>{formatTransportDuration(plan?.durationMs ?? 0)}</strong></span>
                    <span><small>交付站数</small><strong>{plan?.deliveryStops.length ?? 0} 站{closed ? ' · 环线' : ''}</strong></span>
                  </div>
                  <div className="transport-route-card-actions">
                    <Button
                      disabled={Boolean(pendingAction)}
                      onClick={() => { void runMutation(`dispatch:${route.id}`, () => model.dispatchTransportRoute(route.id)); }}
                    >
                      发运
                    </Button>
                    <Button variant="secondary" disabled={Boolean(pendingAction)} onClick={() => editRoute(route)}>编辑</Button>
                    <Button
                      variant="text"
                      disabled={Boolean(pendingAction)}
                      onClick={() => { void runMutation(`delete:${route.id}`, () => model.deleteTransportRoute(route.id)); }}
                    >
                      删除
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-state transport-empty-state">
            <strong>尚未创建运输路线</strong>
            <span>{unlockedProvinces.length < 2 ? '至少解锁两个州后才能建立路线。' : '在地图上按顺序点选多个州，可点击起点州闭合成环；未闭环默认往返运输。'}</span>
          </div>
        )}
      </PagePanel>

      <PagePanel className="transport-records-panel">
        <WidgetHeading
          title="运输记录"
          action={<StatusTag tone="neutral">在途 {activeShipments.length} / {TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER}</StatusTag>}
        />
        <section className="transport-record-section" aria-label="进行中运输">
          <h3>进行中运输</h3>
          {activeShipments.length > 0 ? (
            <ul className="transport-record-list transport-shipment-list">
              {activeShipments.map((shipment) => shipmentRow(shipment, true))}
            </ul>
          ) : <p className="muted transport-empty">当前没有进行中的运输。</p>}
        </section>
        <section className="transport-record-section" aria-label="最近完成运输">
          <h3>最近完成</h3>
          {completedShipments.length > 0 ? (
            <ul className="transport-record-list">
              {completedShipments.map((shipment) => shipmentRow(shipment, false))}
            </ul>
          ) : <p className="muted transport-empty">暂无已完成运输。</p>}
        </section>
      </PagePanel>
      </div>
    </PageLayout>
  );
}
