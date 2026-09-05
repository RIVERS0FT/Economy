import { useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { BuildingTypeFilter, type BuildingKindFilter } from '../components/buildings/BuildingTypeFilter';
import { PageLayout } from '../components/ui/layout';
import { BuildingsPage } from './BuildingsPage';
import { CommercePage } from './CommercePage';

/** Regional building directory: one filter, one owned-building grid and one detail route. */
export function RegionalBuildingsPage({ model, embedded = false, detailFacilityTypeId, detailCommercialTypeId,
  onDetailFacilityChange, onDetailCommercialTypeChange }: {
  model: LoadedGameViewModel;
  embedded?: boolean;
  detailFacilityTypeId?: string;
  detailCommercialTypeId?: string;
  onDetailFacilityChange?: (id: string | null) => void;
  onDetailCommercialTypeChange?: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<BuildingKindFilter>('all');
  const [localIndustrialId, setLocalIndustrialId] = useState<string | null>(null);
  const [localCommercialId, setLocalCommercialId] = useState<string | null>(null);
  const industrialId = onDetailFacilityChange ? detailFacilityTypeId : localIndustrialId;
  const commercialId = onDetailCommercialTypeChange ? detailCommercialTypeId : localCommercialId;
  const changeIndustrial = onDetailFacilityChange ?? setLocalIndustrialId;
  const changeCommercial = onDetailCommercialTypeChange ?? setLocalCommercialId;
  if (commercialId) return <CommercePage model={model} embedded={embedded} detailCommercialTypeId={commercialId} onDetailCommercialTypeChange={changeCommercial} />;
  if (industrialId) return <BuildingsPage model={model} embedded={embedded} detailFacilityTypeId={industrialId} onDetailFacilityChange={changeIndustrial} />;

  const showIndustrial = filter !== 'commercial';
  const showCommercial = filter !== 'industrial';
  const industrialCount = model.game.facilityGroups.filter((group) => group.count > 0).length;
  const commercialCount = (model.game.commercialBuildingGroups ?? []).filter((group) => group.provinceId === model.selectedProvinceId && group.count > 0).length;
  const count = (showIndustrial ? industrialCount : 0) + (showCommercial ? commercialCount : 0);
  const content = <div className="regional-buildings-management unified-regional-buildings">
    <BuildingTypeFilter value={filter} onChange={setFilter} />
    <div className="building-construction-sections">
      {showIndustrial ? <BuildingsPage model={model} embedded renderPart="build" /> : null}
      {showCommercial ? <CommercePage model={model} embedded renderPart="build" /> : null}
    </div>
    <section className="facility-cluster-selector-region" aria-label="地区建筑列表">
      <div className="facility-cluster-selector-list unified-building-list">
        {showIndustrial ? <BuildingsPage model={model} embedded renderPart="cards" onDetailFacilityChange={changeIndustrial} /> : null}
        {showCommercial ? <CommercePage model={model} embedded renderPart="cards" onDetailCommercialTypeChange={changeCommercial} /> : null}
      </div>
      {count === 0 ? <div className="empty-state tall">没有符合当前筛选条件的建筑。</div> : null}
    </section>
  </div>;
  return embedded ? content : <PageLayout title={`${model.selectedProvince?.name || '当前地区'}建筑`}>{content}</PageLayout>;
}
