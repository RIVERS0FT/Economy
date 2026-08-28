import { useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import { ChevronIcon } from '../components/icons/GameIcons';
import { IntegerInput, SelectInput } from '../components/ui/FormControls';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { CompactNumber } from '../components/ui/CompactNumber';
import { Button, PageLayout, PagePanel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import type { TransportModeId, TransportRoute, TransportShipment } from '../types';
import { formatCurrency } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import {
  formatTransportDuration,
  provinceDistanceKm,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
  transportCost,
  transportDurationMs,
} from '../utils/provinceLogistics';

interface RouteDraft {
  routeId: string | null;
  sourceProvinceId: string;
  destinationProvinceId: string;
  productId: string;
  quantity: string;
  mode: TransportModeId;
}

export function TransportPage({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const { game } = model;
  const now = useNow(game.lastProcessedAt, 1_000);
  const routes = Array.isArray(game.transportRoutes) ? game.transportRoutes : [];
  const shipments = Array.isArray(game.transportShipments) ? game.transportShipments : [];
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
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

  function emptyRouteDraft(): RouteDraft {
    const sourceProvinceId = unlockedProvinces[0]?.id ?? '';
    const destinationProvinceId = unlockedProvinces.find((province) => province.id !== sourceProvinceId)?.id ?? '';
    return {
      routeId: null,
      sourceProvinceId,
      destinationProvinceId,
      productId: game.products[0]?.id ?? '',
      quantity: '1',
      mode: 'road',
    };
  }

  function editRoute(route: TransportRoute) {
    setRouteDraft({
      routeId: route.id,
      sourceProvinceId: route.sourceProvinceId,
      destinationProvinceId: route.destinationProvinceId,
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
    if (!routeDraft.sourceProvinceId || !routeDraft.destinationProvinceId || !routeDraft.productId || quantity === null) {
      await model.showResult({ ok: false, message: '请完整填写有效的运输路线' });
      return;
    }
    const routeId = routeDraft.routeId;
    const editing = Boolean(routeId);
    const input = {
      sourceProvinceId: routeDraft.sourceProvinceId,
      destinationProvinceId: routeDraft.destinationProvinceId,
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
    if (ok) setRouteDraft(null);
  }

  function routeMetrics(route: Pick<TransportRoute, 'sourceProvinceId' | 'destinationProvinceId' | 'quantity' | 'mode'>) {
    const source = provinceById.get(route.sourceProvinceId);
    const destination = provinceById.get(route.destinationProvinceId);
    const distanceKm = source && destination ? provinceDistanceKm(source, destination) : 0;
    return {
      distanceKm,
      cost: transportCost(route.mode, route.quantity, distanceKm),
      durationMs: transportDurationMs(route.mode, distanceKm),
    };
  }

  const editorQuantity = routeDraft
    ? parseIntegerDraft(routeDraft.quantity, { min: 1, max: TRANSPORT_MODES[routeDraft.mode].capacity })
    : null;
  const editorMetrics = routeDraft && editorQuantity !== null
    ? routeMetrics({
        sourceProvinceId: routeDraft.sourceProvinceId,
        destinationProvinceId: routeDraft.destinationProvinceId,
        quantity: editorQuantity,
        mode: routeDraft.mode,
      })
    : null;
  const canAddRoute = unlockedProvinces.length >= 2 && routes.length < TRANSPORT_MAX_ROUTES_PER_PLAYER;

  function shipmentRow(shipment: TransportShipment, showRemaining: boolean) {
    const source = provinceById.get(shipment.sourceProvinceId);
    const destination = provinceById.get(shipment.destinationProvinceId);
    const product = productById.get(shipment.productId);
    return (
      <li key={shipment.id} className="transport-record-row">
        <div className="transport-record-route">
          <strong>{source?.name ?? shipment.sourceProvinceId}</strong>
          <ChevronIcon direction="right" />
          <strong>{destination?.name ?? shipment.destinationProvinceId}</strong>
        </div>
        <span>{product?.name ?? shipment.productId} ×<CompactNumber value={shipment.quantity} /></span>
        <span>{TRANSPORT_MODES[shipment.mode]?.name ?? shipment.mode}</span>
        <span className="transport-record-time">
          {showRemaining
            ? `剩余 ${formatTransportDuration(Math.max(0, shipment.arrivesAt - now))}`
            : '已到达'}
        </span>
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
            onClick={() => setRouteDraft(emptyRouteDraft())}
          >
            增加路线
          </Button>
        </div>
        {routeDraft ? (
        <PagePanel className="transport-route-editor">
          <WidgetHeading
            title={routeDraft.routeId ? '编辑运输路线' : '增加运输路线'}
            action={<StatusTag tone="neutral">手动发运</StatusTag>}
          />
          <div className="transport-route-editor-grid">
            <SelectInput
              label="起始州"
              value={routeDraft.sourceProvinceId}
              onChange={(event) => {
                const sourceProvinceId = event.target.value;
                const destinationProvinceId = routeDraft.destinationProvinceId === sourceProvinceId
                  ? unlockedProvinces.find((province) => province.id !== sourceProvinceId)?.id ?? ''
                  : routeDraft.destinationProvinceId;
                setRouteDraft({ ...routeDraft, sourceProvinceId, destinationProvinceId });
              }}
            >
              {unlockedProvinces.map((province) => (
                <option key={province.id} value={province.id}>{province.name}</option>
              ))}
            </SelectInput>
            <SelectInput
              label="目的州"
              value={routeDraft.destinationProvinceId}
              onChange={(event) => setRouteDraft({ ...routeDraft, destinationProvinceId: event.target.value })}
            >
              {unlockedProvinces
                .filter((province) => province.id !== routeDraft.sourceProvinceId)
                .map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
            </SelectInput>
            <SelectInput
              label="商品"
              value={routeDraft.productId}
              onChange={(event) => setRouteDraft({ ...routeDraft, productId: event.target.value })}
            >
              {game.products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </SelectInput>
            <IntegerInput
              label="每次数量"
              value={routeDraft.quantity}
              fallbackValue={1}
              min={1}
              max={TRANSPORT_MODES[routeDraft.mode].capacity}
              onValueChange={(quantity) => setRouteDraft({ ...routeDraft, quantity })}
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
                setRouteDraft({ ...routeDraft, mode, quantity });
              }}
            >
              {Object.values(TRANSPORT_MODES).map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.name} · 单次 ≤ {mode.capacity}</option>
              ))}
            </SelectInput>
          </div>
          <div className="transport-route-estimate" aria-label="路线预估">
            <span><small>距离</small><strong>约 <CompactNumber value={Math.round(editorMetrics?.distanceKm ?? 0)} /> 公里</strong></span>
            <span><small>单次费用</small><strong><CurrencyAmount>{formatCurrency(editorMetrics?.cost ?? 0)}</CurrencyAmount></strong></span>
            <span><small>预计耗时</small><strong>{formatTransportDuration(editorMetrics?.durationMs ?? 0)}</strong></span>
          </div>
          <div className="transport-route-editor-actions">
            <Button variant="secondary" disabled={Boolean(pendingAction)} onClick={() => setRouteDraft(null)}>取消</Button>
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
              const metrics = routeMetrics(route);
              const available = game.provinceInventories?.[route.sourceProvinceId]?.[route.productId]?.available ?? 0;
              return (
                <article key={route.id} className="transport-route-card">
                  <div className="transport-route-card-heading">
                    <div className="transport-route-path">
                      <strong>{source?.name ?? route.sourceProvinceId}</strong>
                      <ChevronIcon direction="right" />
                      <strong>{destination?.name ?? route.destinationProvinceId}</strong>
                    </div>
                    <StatusTag tone={TRANSPORT_MODES[route.mode].tone}>{TRANSPORT_MODES[route.mode].name}</StatusTag>
                  </div>
                  <div className="transport-route-product">
                    <strong>{product?.name ?? route.productId}</strong>
                    <span>每次 ×<CompactNumber value={route.quantity} /></span>
                  </div>
                  <div className="transport-route-meta">
                    <span><small>起点可用</small><strong><CompactNumber value={available} /></strong></span>
                    <span><small>距离</small><strong><CompactNumber value={Math.round(metrics.distanceKm)} /> km</strong></span>
                    <span><small>费用</small><strong><CurrencyAmount>{formatCurrency(metrics.cost)}</CurrencyAmount></strong></span>
                    <span><small>耗时</small><strong>{formatTransportDuration(metrics.durationMs)}</strong></span>
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
            <span>{unlockedProvinces.length < 2 ? '至少解锁两个州后才能建立路线。' : '使用“增加路线”保存常用的跨州运输配置。'}</span>
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
