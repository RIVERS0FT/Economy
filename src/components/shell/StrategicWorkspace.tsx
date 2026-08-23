import regionCatalog from '../../../shared/provinces.json';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import type { GameTutorialController } from '../../game-guide/useGameTutorial';
import type { PendingNotificationItem } from '../../notifications/notificationCenter';
import type { ProvinceAssetSummary, ProvinceDefinition } from '../../types';
import { StrategicOutliner } from '../outliner/StrategicOutliner';
import { UsMainlandMap, type ProvinceMapLens } from '../provinces/UsMainlandMap';
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
  pendingItems,
}: {
  model: LoadedGameViewModel;
  tutorial?: GameTutorialController;
  pendingItems: PendingNotificationItem[];
}) {
  const outlinerModel = strategicOutlinerModel(model);
  // The previous direct `model={model}` handoff is intentionally not used here;
  // StrategicOutliner must receive the normalized display projection above.
  return (
    <StrategicOutliner
      model={outlinerModel}
      tutorial={tutorial}
      pendingItems={pendingItems}
    />
  );
}
