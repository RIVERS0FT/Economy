import regionCatalog from '../../../shared/provinces.json';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { formatNumber } from '../../utils/formatters';
import { UsMainlandMap, type ProvinceMapLens } from '../provinces/UsMainlandMap';
import { ProvinceSelect } from '../provinces/ProvinceSelect';
import {
  AssetsIcon,
  FactoryIcon,
  MapIcon,
  MarketIcon,
  WarehouseIcon,
} from '../icons/GameIcons';
import { Button, StatusTag } from '../ui/layout';

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
  return (
    <div
      className={`strategic-map-stage strategic-map-stage--${model.tab === 'map' ? 'active' : 'background'}`}
      data-strategic-map-stage="true"
      data-map-lens={lens}
    >
      <UsMainlandMap
        provinces={state.provinces}
        summaries={state.summaries}
        selectedProvinceId={state.selectedProvinceId}
        onSelectProvince={setSelectedProvinceId}
        lens={lens}
      />
      <div className="strategic-map-vignette" aria-hidden="true" />
    </div>
  );
}

function ProvinceInspector({ model, lens }: {
  model: LoadedGameViewModel;
  lens: ProvinceMapLens;
}) {
  const state = strategicMapState(model);
  if (!state.selectedProvince) return null;
  const summary = state.summaries[state.selectedProvinceId];
  const setSelectedProvinceId = typeof model.setSelectedProvinceId === 'function'
    ? model.setSelectedProvinceId
    : () => {};
  return (
    <aside className="panel strategic-province-inspector" aria-label="当前州经营检查器">
      <div className="strategic-inspector-heading">
        <div>
          <span className="ui-eyebrow">当前经营地区</span>
          <h2>{state.selectedProvince.name}</h2>
        </div>
        <StatusTag tone="info">{MAP_LENSES.find((item) => item.id === lens)?.label || '州界'}</StatusTag>
      </div>
      <ProvinceSelect
        provinces={state.provinces}
        value={state.selectedProvinceId}
        onChange={setSelectedProvinceId}
        label="战略经营地区"
      />
      <div className="strategic-inspector-metrics">
        <div><WarehouseIcon /><span>本地库存</span><strong>{formatNumber(summary?.storedQuantity || 0)}</strong></div>
        <div><FactoryIcon /><span>工厂总数</span><strong>{formatNumber(summary?.facilityCount || 0)}</strong></div>
        <div><FactoryIcon /><span>运行工厂</span><strong>{formatNumber(summary?.runningFacilityCount || 0)}</strong></div>
        <div><MarketIcon /><span>本地挂单</span><strong>{formatNumber(summary?.openOrderCount || 0)}</strong></div>
      </div>
      {Number(summary?.blockedFacilityCount || 0) > 0 ? (
        <p className="strategic-inspector-alert">{formatNumber(summary.blockedFacilityCount)} 座工厂需要处理</p>
      ) : (
        <p className="strategic-inspector-note">当地仓库、市场与工厂保持州级隔离。</p>
      )}
      <div className="strategic-inspector-actions">
        <Button onClick={() => model.setTab('market')}>进入本地市场</Button>
        <Button variant="secondary" onClick={() => model.setTab('production')}>管理本地生产</Button>
      </div>
    </aside>
  );
}

export function StrategicWorkspaceChrome({
  model,
  lens,
  onLensChange,
}: {
  model: LoadedGameViewModel;
  lens: ProvinceMapLens;
  onLensChange: (lens: ProvinceMapLens) => void;
}) {
  const showInspector = model.tab === 'map' || model.tab === 'home';
  return (
    <>
      {showInspector ? <ProvinceInspector model={model} lens={lens} /> : null}
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
    </>
  );
}
