import { useContext, useMemo, useState } from 'react';
import regionCatalog from '../../../shared/provinces.json';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';
import { useNow } from '../../hooks/useNow';
import type { PendingNotificationItem } from '../../notifications/notificationCenter';
import type { ProvinceAssetSummary, ProvinceDefinition, TransportModeId, TransportShipment } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { isTransportRouteClosed, transportRouteSetupCost, transportRouteStopIds } from '../../utils/provinceLogistics';
import { StrategicOutliner } from '../outliner/StrategicOutliner';
import { SelectInput } from '../ui/FormControls';
import {
  UsMainlandMap,
  type ProvinceMapLens,
  type ProvinceMapRouteOverlay,
  type ProvinceMapRoutePicking,
  type ProvinceMapShipmentOverlay,
} from '../provinces/UsMainlandMap';
import { TransportRouteDraftContext } from './TransportRouteDraftContext';
import {
  AssetsIcon,
  FactoryIcon,
  MapIcon,
  MarketIcon,
  WarehouseIcon,
} from '../icons/GameIcons';

const fallbackProvinces = regionCatalog as ProvinceDefinition[];

type ShipmentView = TransportShipment & {
  routeName?: string;
  manifest?: Array<{ productId: string; destinationProvinceId: string; quantity: number }>;
  legPlan?: Array<{
    fromProvinceId: string;
    toProvinceId: string;
    departsAt: number;
    arrivesAt: number;
    remainingLoad: number;
  }>;
};

const MAP_LENSES: Array<{
  id: ProvinceMapLens;
  label: string;
  icon: typeof MapIcon;
}> = [
  { id: 'political', label: '州界', icon: MapIcon },
  { id: 'assets', label: '资产', icon: AssetsIcon },
  { id: 'industry', label: '工业', icon: FactoryIcon },
  { id: 'market', label: '市场', icon: MarketIcon },
  { id: 'alerts', label: '异常', icon: WarehouseIcon },
];

const MAP_LENS_BUTTON_STYLE = {
  minHeight: 44,
  borderRadius: 999,
  flexDirection: 'row',
  whiteSpace: 'nowrap',
} as const;

function strategicMapState(model: LoadedGameViewModel) {
  const game = model.game as LoadedGameViewModel['game'] & {
    provinces?: ProvinceDefinition[];
    provinceAssetSummaries?: Record<string, ProvinceAssetSummary>;
  };
  const provinces = Array.isArray(game.provinces) && game.provinces.length > 0
    ? game.provinces
    : fallbackProvinces;
  const selectedProvinceId = model.selectedProvinceId
    || game.defaultProvinceId
    || provinces[0]?.id
    || '110000';
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId) ?? provinces[0];
  return { provinces, summaries: game.provinceAssetSummaries || {}, selectedProvinceId, selectedProvince };
}

function strategicOutlinerModel(model: LoadedGameViewModel): LoadedGameViewModel {
  const game = model.game as Partial<LoadedGameViewModel['game']>;
  const provinces = Array.isArray(game.provinces) && game.provinces.length > 0 ? game.provinces : fallbackProvinces;
  const products = Array.isArray(game.products) ? game.products : [];
  const facilityTypes = Array.isArray(game.facilityTypes) ? game.facilityTypes : [];
  const facilityGroups = Array.isArray(game.facilityGroups) ? game.facilityGroups : [];
  const selectedProvinceId = typeof model.selectedProvinceId === 'string' && model.selectedProvinceId.trim()
    ? model.selectedProvinceId
    : game.defaultProvinceId || provinces[0]?.id || '110000';
  const selectedFacilityTypeId = typeof model.selectedFacilityTypeId === 'string' && model.selectedFacilityTypeId.trim()
    ? model.selectedFacilityTypeId
    : facilityTypes[0]?.id || '';
  const marketAssetId = typeof model.marketAssetId === 'string' && model.marketAssetId.trim()
    ? model.marketAssetId
    : products[0]?.id || selectedFacilityTypeId;
  return {
    ...model,
    selectedProvinceId,
    selectedProvince: model.selectedProvince ?? provinces.find((province) => province.id === selectedProvinceId) ?? provinces[0],
    selectedFacilityTypeId,
    marketAssetKind: model.marketAssetKind === 'facility' ? 'facility' : 'commodity',
    marketAssetId,
    game: {
      ...model.game,
      provinces,
      products,
      facilityTypes,
      facilityGroups,
      markets: game.markets ?? {},
      research: game.research ?? { active: null },
      facilityConstruction: game.facilityConstruction ?? null,
      economicCalendar: game.economicCalendar ?? { events: [] },
    },
  } as LoadedGameViewModel;
}

export function StrategicMapStage({
  model,
  lens,
  startingProvinceCandidateId = null,
  onPickStartingProvince,
}: {
  model: LoadedGameViewModel;
  lens: ProvinceMapLens;
  startingProvinceCandidateId?: string | null;
  onPickStartingProvince?: (provinceId: string) => void;
}) {
  const state = strategicMapState(model);
  const now = useNow(model.game.lastProcessedAt, 500);
  const routeDraft = useContext(TransportRouteDraftContext);
  const [savingRoute, setSavingRoute] = useState(false);
  const startingProvincePicking = model.game.startingProvinceChosen === false && typeof onPickStartingProvince === 'function';
  const effectiveLens: ProvinceMapLens = startingProvincePicking ? 'political' : lens;
  const provinceById = useMemo(() => new Map(state.provinces.map((province) => [province.id, province])), [state.provinces]);
  const productById = useMemo(() => new Map(model.game.products.map((product) => [product.id, product])), [model.game.products]);
  const setSelectedProvinceId = typeof model.setSelectedProvinceId === 'function' ? model.setSelectedProvinceId : () => {};
  const openProvincePage = (provinceId: string) => {
    if (startingProvincePicking) {
      onPickStartingProvince?.(provinceId);
      return;
    }
    setSelectedProvinceId(provinceId);
    model.setTab('province');
  };
  const transportRoutes = Array.isArray(model.game.transportRoutes) ? model.game.transportRoutes : [];
  const routeById = useMemo(() => new Map(transportRoutes.map((route) => [route.id, route])), [transportRoutes]);
  const draftStops = routeDraft?.draft ? transportRouteStopIds(routeDraft.draft) : [];
  const draftSetupCost = routeDraft?.draft && draftStops.length >= 2
    ? transportRouteSetupCost(routeDraft.draft, routeDraft.draft.mode, provinceById)
    : 0;
  const routeOverlays = useMemo<ProvinceMapRouteOverlay[]>(() => {
    if (startingProvincePicking) return [];
    const overlays: ProvinceMapRouteOverlay[] = [];
    if (model.tab === 'transport') {
      for (const route of transportRoutes) {
        const stops = transportRouteStopIds(route);
        if (stops.length < 2) continue;
        overlays.push({ id: `saved-${route.mode}-${route.id}`, stops, closed: isTransportRouteClosed(route), tripType: route.tripType ?? 'one-way', kind: 'saved' });
      }
    }
    const highlightedStops = routeDraft?.highlightedRouteStops;
    if (highlightedStops && highlightedStops.length >= 2) {
      const highlightedRoute = transportRoutes.find((route) => {
        const stops = transportRouteStopIds(route);
        return stops.length === highlightedStops.length && stops.every((provinceId, index) => provinceId === highlightedStops[index]);
      });
      overlays.push({
        id: highlightedRoute ? `highlighted-${highlightedRoute.mode}-route` : 'highlighted-route',
        stops: highlightedStops,
        closed: highlightedStops[0] === highlightedStops[highlightedStops.length - 1],
        tripType: highlightedRoute?.tripType ?? 'one-way',
        kind: 'highlight',
      });
    }
    if (routeDraft?.draft && draftStops.length >= 2) {
      overlays.push({
        id: `draft-${routeDraft.draft.mode}-route`,
        stops: draftStops,
        closed: isTransportRouteClosed(routeDraft.draft),
        tripType: routeDraft.draft.tripType,
        kind: 'draft',
      });
    }
    return overlays;
  }, [draftStops, model.tab, routeDraft?.draft, routeDraft?.highlightedRouteStops, startingProvincePicking, transportRoutes]);

  const shipmentOverlays = useMemo<ProvinceMapShipmentOverlay[]>(() => {
    if (startingProvincePicking) return [];
    return ((model.game.transportShipments || []) as ShipmentView[])
      .filter((shipment) => shipment.status === 'in-transit' && Array.isArray(shipment.legPlan) && shipment.legPlan.length > 0)
      .map((shipment) => {
        const delivered = new Set((shipment.stopPlan || []).filter((stop) => stop.deliveredAt).map((stop) => stop.provinceId));
        const route = shipment.routeId ? routeById.get(shipment.routeId) : undefined;
        const routeName = shipment.routeName
          || (route as { name?: string } | undefined)?.name
          || `${provinceById.get(shipment.sourceProvinceId)?.name ?? shipment.sourceProvinceId}-${provinceById.get(shipment.destinationProvinceId)?.name ?? shipment.destinationProvinceId}`;
        return {
          id: shipment.id,
          routeId: shipment.routeId,
          routeName,
          mode: shipment.mode,
          arrivesAt: shipment.arrivesAt,
          legPlan: shipment.legPlan || [],
          cargo: (shipment.manifest || []).filter((entry) => !delivered.has(entry.destinationProvinceId)).map((entry) => ({
            productName: productById.get(entry.productId)?.name ?? entry.productId,
            quantity: entry.quantity,
            destinationName: provinceById.get(entry.destinationProvinceId)?.name ?? entry.destinationProvinceId,
          })),
        };
      });
  }, [model.game.transportShipments, productById, provinceById, routeById, startingProvincePicking]);

  const routePicking: ProvinceMapRoutePicking | null = !startingProvincePicking && routeDraft?.picking
    ? { active: true, stops: draftStops, onPickProvince: routeDraft.pickProvince }
    : null;
  const draftClosed = Boolean(routeDraft?.draft && isTransportRouteClosed(routeDraft.draft));

  async function createDraftRoute() {
    if (!routeDraft?.draft || savingRoute) return;
    const draft = routeDraft.draft;
    const stops = transportRouteStopIds(draft);
    if (!draft.sourceProvinceId || !draft.destinationProvinceId || stops.length < 2) {
      await model.showResult({ ok: false, message: '请先在地图上选择完整运输路线' });
      return;
    }
    setSavingRoute(true);
    try {
      const result = await model.createTransportRoute({
        sourceProvinceId: draft.sourceProvinceId,
        destinationProvinceId: draft.destinationProvinceId,
        viaProvinceIds: draft.viaProvinceIds,
        tripType: isTransportRouteClosed(draft) ? 'one-way' : draft.tripType,
        mode: draft.mode,
      });
      await model.showResult(result);
      if (result.ok) routeDraft.closeDraft();
      else routeDraft.finishPicking();
    } finally {
      setSavingRoute(false);
    }
  }

  return (
    <div
      className="strategic-map-stage"
      data-strategic-map-stage="true"
      data-map-lens={effectiveLens}
      data-starting-province-picking={startingProvincePicking ? 'true' : 'false'}
      data-starting-province-candidate-id={startingProvinceCandidateId ?? ''}
      data-transport-route-picking={!startingProvincePicking && routeDraft?.picking ? 'true' : 'false'}
      data-transport-route-stop-count={draftStops.length}
      data-active-transport-count={shipmentOverlays.length}
      data-active-transport-label={shipmentOverlays.length > 0 ? '正在运输' : '无在途运输'}
    >
      <UsMainlandMap
        provinces={state.provinces}
        summaries={state.summaries}
        unlockedProvinceIds={startingProvincePicking ? state.provinces.map((province) => province.id) : model.game.unlockedProvinces}
        selectedProvinceId={startingProvincePicking ? startingProvinceCandidateId : model.tab === 'province' ? state.selectedProvinceId : null}
        onSelectProvince={openProvincePage}
        lens={effectiveLens}
        routePicking={routePicking}
        routeOverlays={routeOverlays}
        shipmentOverlays={shipmentOverlays}
        now={now}
      />
      {!startingProvincePicking && routeDraft?.picking ? (
        <div className="transport-map-picking-bar" role="region" aria-label="运输路线地图选州" data-picking-stop-count={draftStops.length}>
          <div className="transport-map-picking-sequence">
            {draftStops.length > 0 ? draftStops.map((provinceId, index) => (
              <span key={`${provinceId}-${index}`} className="transport-map-picking-stop" data-stop-index={index} data-stop-role={index === 0 ? 'start' : index === draftStops.length - 1 ? 'end' : 'via'}>
                {provinceById.get(provinceId)?.name ?? provinceId}
              </span>
            )) : <span className="transport-map-picking-empty">先点击一个州作为起点</span>}
          </div>
          <p className="transport-map-picking-hint">按顺序点击州面追加站点；再次点击起点州可闭环。路线创建后路径、行程与运输方式均不可修改。</p>
          <div className="transport-map-picking-options">
            <SelectInput
              label="运输方式"
              value={routeDraft.draft?.mode ?? 'road'}
              disabled={savingRoute}
              onChange={(event) => routeDraft.updateDraft({ mode: event.target.value as TransportModeId })}
            >
              <option value="road">公路运输</option>
              <option value="rail">铁路运输</option>
              <option value="air">航空运输</option>
            </SelectInput>
            <SelectInput
              label="行程"
              value={draftClosed ? 'one-way' : routeDraft.draft?.tripType ?? 'one-way'}
              disabled={draftClosed || savingRoute}
              onChange={(event) => routeDraft.updateDraft({ tripType: event.target.value === 'round' ? 'round' : 'one-way' })}
            >
              <option value="one-way">单程</option>
              <option value="round">往返</option>
            </SelectInput>
          </div>
          <div className="transport-map-picking-cost" data-route-setup-cost={draftSetupCost}>
            <span>一次性建线费</span>
            <strong>{draftStops.length >= 2 ? formatCurrency(draftSetupCost) : '选择完整路线后计算'}</strong>
          </div>
          <div className="transport-map-picking-actions">
            <button type="button" onClick={routeDraft.closeLoop} disabled={savingRoute || draftStops.length < 2 || draftClosed}>闭环</button>
            <button type="button" onClick={routeDraft.resetStops} disabled={savingRoute || draftStops.length === 0}>重置站点</button>
            <button type="button" className="is-primary" onClick={() => void createDraftRoute()} disabled={savingRoute || draftStops.length < 2}>{savingRoute ? '创建中…' : '完成选择'}</button>
            <button type="button" onClick={routeDraft.cancelPicking} disabled={savingRoute}>取消</button>
          </div>
        </div>
      ) : null}
      <div className="strategic-map-vignette" aria-hidden="true" />
    </div>
  );
}

export function StrategicMapLensBar({ lens, onLensChange }: { lens: ProvinceMapLens; onLensChange: (lens: ProvinceMapLens) => void }) {
  return (
    <nav className="strategic-map-lens-bar panel" aria-label="地图镜头">
      {MAP_LENSES.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            className={item.id === lens ? 'strategic-map-lens-button is-active' : 'strategic-map-lens-button'}
            data-ui-interactive="surface"
            aria-pressed={item.id === lens}
            style={MAP_LENS_BUTTON_STYLE}
            onClick={() => onLensChange(item.id)}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function StrategicWorkspaceChrome({ model, tutorial, pendingItems }: {
  model: LoadedGameViewModel;
  tutorial?: GameTutorialController;
  pendingItems: PendingNotificationItem[];
}) {
  const outlinerModel = strategicOutlinerModel(model);
  return <StrategicOutliner model={outlinerModel} tutorial={tutorial} pendingItems={pendingItems} />;
}
