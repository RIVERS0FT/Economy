import { useContext, useMemo } from 'react';
import regionCatalog from '../../../shared/provinces.json';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';
import type { PendingNotificationItem } from '../../notifications/notificationCenter';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { isTransportRouteClosed, transportRouteStopIds } from '../../utils/provinceLogistics';
import { StrategicOutliner } from '../outliner/StrategicOutliner';
import {
  UsMainlandMap,
  type ProvinceMapLens,
  type ProvinceMapRouteOverlay,
  type ProvinceMapRoutePicking,
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
  const selectedProvince = provinces.find((province) => province.id === selectedProvinceId)
    ?? provinces[0];
  return {
    provinces,
    summaries: game.provinceAssetSummaries || {},
    selectedProvinceId,
    selectedProvince,
  };
}

function strategicOutlinerModel(model: LoadedGameViewModel): LoadedGameViewModel {
  const game = model.game as Partial<LoadedGameViewModel['game']>;
  const provinces = Array.isArray(game.provinces) && game.provinces.length > 0
    ? game.provinces
    : fallbackProvinces;
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
    selectedProvince: model.selectedProvince
      ?? provinces.find((province) => province.id === selectedProvinceId)
      ?? provinces[0],
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
  const routeDraft = useContext(TransportRouteDraftContext);
  const startingProvincePicking = model.game.startingProvinceChosen === false
    && typeof onPickStartingProvince === 'function';
  const effectiveLens: ProvinceMapLens = startingProvincePicking ? 'political' : lens;
  const provinceById = useMemo(() => new Map(state.provinces.map((province) => [province.id, province])), [state.provinces]);
  const setSelectedProvinceId = typeof model.setSelectedProvinceId === 'function'
    ? model.setSelectedProvinceId
    : () => {};
  const openProvincePage = (provinceId: string) => {
    if (startingProvincePicking) {
      onPickStartingProvince?.(provinceId);
      return;
    }
    setSelectedProvinceId(provinceId);
    model.setTab('province');
  };
  const transportRoutes = Array.isArray(model.game.transportRoutes) ? model.game.transportRoutes : [];
  const draftStops = routeDraft?.draft ? transportRouteStopIds(routeDraft.draft) : [];
  const routeOverlays = useMemo<ProvinceMapRouteOverlay[]>(() => {
    if (startingProvincePicking) return [];
    const overlays: ProvinceMapRouteOverlay[] = [];
    if (model.tab === 'transport') {
      for (const route of transportRoutes) {
        const stops = transportRouteStopIds(route);
        if (stops.length < 2) continue;
        overlays.push({
          id: `saved-${route.id}`,
          stops,
          closed: isTransportRouteClosed(route),
          tripType: route.tripType ?? 'one-way',
          kind: 'saved',
        });
      }
    }
    const highlightedStops = routeDraft?.highlightedRouteStops;
    if (highlightedStops && highlightedStops.length >= 2) {
      overlays.push({
        id: 'highlighted-route',
        stops: highlightedStops,
        closed: highlightedStops[0] === highlightedStops[highlightedStops.length - 1],
        tripType: 'one-way',
        kind: 'highlight',
      });
    }
    if (routeDraft?.draft && draftStops.length >= 2) {
      overlays.push({
        id: 'draft-route',
        stops: draftStops,
        closed: isTransportRouteClosed(routeDraft.draft),
        tripType: routeDraft.draft.tripType,
        kind: 'draft',
      });
    }
    return overlays;
  }, [
    draftStops,
    model.tab,
    routeDraft?.draft,
    routeDraft?.highlightedRouteStops,
    startingProvincePicking,
    transportRoutes,
  ]);
  const routePicking: ProvinceMapRoutePicking | null = !startingProvincePicking && routeDraft?.picking
    ? { active: true, stops: draftStops, onPickProvince: routeDraft.pickProvince }
    : null;
  return (
    <div
      className="strategic-map-stage"
      data-strategic-map-stage="true"
      data-map-lens={effectiveLens}
      data-starting-province-picking={startingProvincePicking ? 'true' : 'false'}
      data-starting-province-candidate-id={startingProvinceCandidateId ?? ''}
      data-transport-route-picking={!startingProvincePicking && routeDraft?.picking ? 'true' : 'false'}
      data-transport-route-stop-count={draftStops.length}
    >
      <UsMainlandMap
        provinces={state.provinces}
        summaries={state.summaries}
        unlockedProvinceIds={startingProvincePicking
          ? state.provinces.map((province) => province.id)
          : model.game.unlockedProvinces}
        selectedProvinceId={startingProvincePicking
          ? startingProvinceCandidateId
          : model.tab === 'province' ? state.selectedProvinceId : null}
        onSelectProvince={openProvincePage}
        lens={effectiveLens}
        routePicking={routePicking}
        routeOverlays={routeOverlays}
      />
      {!startingProvincePicking && routeDraft?.picking ? (
        <div
          className="transport-map-picking-bar"
          role="region"
          aria-label="运输路线地图选州"
          data-picking-stop-count={draftStops.length}
        >
          <div className="transport-map-picking-sequence">
            {draftStops.length > 0 ? draftStops.map((provinceId, index) => (
              <span
                key={`${provinceId}-${index}`}
                className="transport-map-picking-stop"
                data-stop-index={index}
                data-stop-role={index === 0 ? 'start' : index === draftStops.length - 1 ? 'end' : 'via'}
              >
                {provinceById.get(provinceId)?.name ?? provinceId}
              </span>
            )) : <span className="transport-map-picking-empty">先点击一个州作为起点</span>}
          </div>
          <p className="transport-map-picking-hint">
            按顺序点击州面追加站点；再次点击起点州可闭环；未闭环默认按往返运输计费。
          </p>
          <div className="transport-map-picking-actions">
            <button
              type="button"
              onClick={routeDraft.closeLoop}
              disabled={draftStops.length < 2 || draftStops[0] === draftStops[draftStops.length - 1]}
            >
              闭环
            </button>
            <button type="button" onClick={routeDraft.resetStops} disabled={draftStops.length === 0}>重置站点</button>
            <button type="button" className="is-primary" onClick={routeDraft.finishPicking}>完成选择</button>
            <button type="button" onClick={routeDraft.cancelPicking}>取消</button>
          </div>
        </div>
      ) : null}
      <div className="strategic-map-vignette" aria-hidden="true" />
    </div>
  );
}

export function StrategicMapLensBar({
  lens,
  onLensChange,
}: {
  lens: ProvinceMapLens;
  onLensChange: (lens: ProvinceMapLens) => void;
}) {
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

export function StrategicWorkspaceChrome({
  model,
  tutorial,
  pendingItems,
}: {
  model: LoadedGameViewModel;
  tutorial?: GameTutorialController;
  pendingItems: PendingNotificationItem[];
}) {
  const outlinerModel = strategicOutlinerModel(model);
  return (
    <StrategicOutliner
      model={outlinerModel}
      tutorial={tutorial}
      pendingItems={pendingItems}
    />
  );
}
