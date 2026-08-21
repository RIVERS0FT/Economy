import regionCatalog from '../../../shared/provinces.json';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { EconomicEventLogPanel } from '../EconomicEventLogPanel';
import { GameGuideStrip } from '../GameGuideStrip';
import { getEChartsInstanceByDom, type EChartsType } from '../charts/echartsCore';
import { UsMainlandMap, type ProvinceMapLens } from '../provinces/UsMainlandMap';
import {
  AssetsIcon,
  FactoryIcon,
  MapIcon,
  MarketIcon,
  RefreshIcon,
  WarehouseIcon,
} from '../icons/GameIcons';
import '../../styles/map-zoom-controls.css';

const fallbackProvinces = regionCatalog as ProvinceDefinition[];
const MAP_ZOOM_MIN = 0.5;
const MAP_ZOOM_MAX = 4;
const MAP_ZOOM_IN_FACTOR = 1.25;
const MAP_ZOOM_OUT_FACTOR = 0.8;

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

function strategicMapChart() {
  if (typeof document === 'undefined') return null;
  const container = document.querySelector<HTMLElement>(
    '.strategic-map-stage .province-map-echart .economy-chart__canvas',
  );
  if (!container) return null;
  return getEChartsInstanceByDom(container) ?? null;
}

function strategicMapSeries(chart: EChartsType) {
  const option = chart.getOption() as {
    series?: Array<{ id?: string; zoom?: number }>;
  };
  return option.series?.find((series) => series.id === 'us-mainland-map') ?? option.series?.[0];
}

function setStrategicMapZoom(factor: number) {
  const chart = strategicMapChart();
  if (!chart) return;
  const current = Number(strategicMapSeries(chart)?.zoom || 1);
  const zoom = Math.min(
    MAP_ZOOM_MAX,
    Math.max(MAP_ZOOM_MIN, Number((current * factor).toFixed(3))),
  );
  chart.setOption({
    series: [{
      id: 'us-mainland-map',
      zoom,
      scaleLimit: { min: MAP_ZOOM_MIN, max: MAP_ZOOM_MAX },
    }],
  }, {
    notMerge: false,
    lazyUpdate: false,
  });
  chart.getDom().dataset.mapCameraZoom = String(zoom);
}

function resetStrategicMapCamera() {
  const chart = strategicMapChart();
  if (!chart) return;
  chart.setOption({
    series: [{
      id: 'us-mainland-map',
      center: null,
      zoom: 1,
      scaleLimit: { min: MAP_ZOOM_MIN, max: MAP_ZOOM_MAX },
    }],
  }, {
    notMerge: false,
    lazyUpdate: false,
  });
  chart.getDom().dataset.mapCameraZoom = '1';
  chart.getDom().dataset.mapCameraReset = 'zoom-control';
}

export function StrategicMapZoomControls() {
  return (
    <div className="strategic-map-zoom-controls panel" role="group" aria-label="地图缩放">
      <button
        type="button"
        className="strategic-map-zoom-button"
        data-ui-interactive="surface"
        aria-label="放大地图"
        title="放大地图"
        onClick={() => setStrategicMapZoom(MAP_ZOOM_IN_FACTOR)}
      >
        <span aria-hidden="true">＋</span>
      </button>
      <button
        type="button"
        className="strategic-map-zoom-button"
        data-ui-interactive="surface"
        aria-label="缩小地图"
        title="缩小地图"
        onClick={() => setStrategicMapZoom(MAP_ZOOM_OUT_FACTOR)}
      >
        <span aria-hidden="true">−</span>
      </button>
      <button
        type="button"
        className="strategic-map-zoom-button"
        data-ui-interactive="surface"
        aria-label="重置地图缩放和平移"
        title="重置地图缩放和平移"
        onClick={resetStrategicMapCamera}
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

export function StrategicMapStage({
  model,
  lens,
}: {
  model: LoadedGameViewModel;
  lens: ProvinceMapLens;
}) {
  const state = strategicMapState(model);
  const setSelectedProvinceId = typeof model.setSelectedProvinceId === 'function'
    ? model.setSelectedProvinceId
    : () => {};
  const openProvincePage = (provinceId: string) => {
    setSelectedProvinceId(provinceId);
    model.setTab('province');
  };
  return (
    <div
      className="strategic-map-stage"
      data-strategic-map-stage="true"
      data-map-lens={lens}
    >
      <UsMainlandMap
        provinces={state.provinces}
        summaries={state.summaries}
        unlockedProvinceIds={model.game.unlockedProvinces}
        selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}
        onSelectProvince={openProvincePage}
        lens={lens}
      />
      <div className="strategic-map-vignette" aria-hidden="true" />
      <StrategicMapZoomControls />
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
  showEventRail,
}: {
  model: LoadedGameViewModel;
  tutorial?: GameTutorialController;
  showEventRail: boolean;
}) {
  return showEventRail ? (
    <aside className="strategic-economic-event-rail" aria-label="公开经济事件日志">
      {model.tab === 'home' && tutorial ? <GameGuideStrip tutorial={tutorial} /> : null}
      <EconomicEventLogPanel
        events={model.game.economicCalendar?.events ?? []}
        products={model.game.products}
        markets={model.game.markets}
        referenceNow={model.game.lastProcessedAt}
      />
    </aside>
  ) : null;
}
