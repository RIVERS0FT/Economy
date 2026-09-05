import { useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import type { BuildingKind } from '../components/buildings/BuildingTypeFilter';
import { PageLayout } from '../components/ui/layout';
import { useBuildingConstructionDraft } from '../hooks/useBuildingConstructionDraft';
import { BuildingsPage } from './BuildingsPage';
import { CommercePage } from './CommercePage';

/** The province tab owns the kind; both domains retain the same grid and detail components. */
export function RegionalBuildingsPage({ model, kind, embedded = false, detailFacilityTypeId, detailCommercialTypeId,
  onDetailFacilityChange, onDetailCommercialTypeChange }: {
  model: LoadedGameViewModel;
  kind: BuildingKind;
  embedded?: boolean;
  detailFacilityTypeId?: string;
  detailCommercialTypeId?: string;
  onDetailFacilityChange?: (id: string | null) => void;
  onDetailCommercialTypeChange?: (id: string | null) => void;
}) {
  const scope = JSON.stringify([model.game.userId, model.selectedProvinceId, kind]);
  const constructionDraft = useBuildingConstructionDraft(scope);
  const [localDetail, setLocalDetail] = useState<{ scope: string; id: string | null }>({ scope, id: null });
  const isCommercial = kind === 'commercial';
  const label = isCommercial ? '商业建筑' : '工业建筑';
  const onDetailChange = isCommercial ? onDetailCommercialTypeChange : onDetailFacilityChange;
  const suppliedDetailId = isCommercial ? detailCommercialTypeId : detailFacilityTypeId;
  const detailId = onDetailChange ? suppliedDetailId : localDetail.scope === scope ? localDetail.id : null;
  const changeDetail = (id: string | null) => {
    if (onDetailChange) onDetailChange(id);
    else setLocalDetail({ scope, id });
  };

  if (detailId) {
    return isCommercial
      ? <CommercePage model={model} embedded={embedded} constructionDraft={constructionDraft}
          detailCommercialTypeId={detailId} onDetailCommercialTypeChange={changeDetail} />
      : <BuildingsPage model={model} embedded={embedded} constructionDraft={constructionDraft}
          detailFacilityTypeId={detailId} onDetailFacilityChange={changeDetail} />;
  }

  const count = isCommercial
    ? (model.game.commercialBuildingGroups ?? []).filter((group) => group.provinceId === model.selectedProvinceId && group.count > 0).length
    : model.game.facilityGroups.filter((group) => group.count > 0).length;
  const content = <div className="regional-buildings-management unified-regional-buildings" data-building-kind={kind}>
    <div className="building-construction-sections">
      {isCommercial
        ? <CommercePage model={model} embedded renderPart="build" constructionDraft={constructionDraft} />
        : <BuildingsPage model={model} embedded renderPart="build" constructionDraft={constructionDraft} />}
    </div>
    <section className="facility-cluster-selector-region" aria-label={`地区${label}列表`}>
      <div className="facility-cluster-selector-list unified-building-list">
        {isCommercial
          ? <CommercePage model={model} embedded renderPart="cards" constructionDraft={constructionDraft} onDetailCommercialTypeChange={changeDetail} />
          : <BuildingsPage model={model} embedded renderPart="cards" constructionDraft={constructionDraft} onDetailFacilityChange={changeDetail} />}
      </div>
      {count === 0 ? <div className="empty-state tall">当前地区尚未拥有{label}。</div> : null}
    </section>
  </div>;
  return embedded ? content : <PageLayout title={`${model.selectedProvince?.name || '当前地区'}${label}`}>{content}</PageLayout>;
}
