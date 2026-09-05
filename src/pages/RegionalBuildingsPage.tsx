import { useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import type { BuildingKind } from '../components/buildings/BuildingTypeFilter';
import { PageLayout } from '../components/ui/layout';
import { useBuildingConstructionDraft } from '../hooks/useBuildingConstructionDraft';
import { BuildingsPage } from './BuildingsPage';
import { CommercePage } from './CommercePage';

interface RegionalBuildingsPageProps {
  model: LoadedGameViewModel;
  kind: BuildingKind;
  embedded?: boolean;
  detailFacilityTypeId?: string;
  detailCommercialTypeId?: string;
  onDetailFacilityChange?: (id: string | null) => void;
  onDetailCommercialTypeChange?: (id: string | null) => void;
}

/** The province tab fixes the kind; no second classification state or control. */
export function RegionalBuildingsPage(props: RegionalBuildingsPageProps) {
  const { model, kind } = props;
  const scope = `${model.game.userId}:${model.game.saveEpoch ?? 0}:${model.selectedProvinceId}:${kind}`;
  return <RegionalBuildingDirectory key={scope} {...props} scope={scope} />;
}

function RegionalBuildingDirectory({ model, kind, scope, embedded = false,
  detailFacilityTypeId, detailCommercialTypeId, onDetailFacilityChange, onDetailCommercialTypeChange,
}: RegionalBuildingsPageProps & { scope: string }) {
  const constructionDraft = useBuildingConstructionDraft(scope);
  const [localIndustrialId, setLocalIndustrialId] = useState<string | null>(null);
  const [localCommercialId, setLocalCommercialId] = useState<string | null>(null);
  const industrialId = onDetailFacilityChange ? detailFacilityTypeId : localIndustrialId;
  const commercialId = onDetailCommercialTypeChange ? detailCommercialTypeId : localCommercialId;
  const changeIndustrial = onDetailFacilityChange ?? setLocalIndustrialId;
  const changeCommercial = onDetailCommercialTypeChange ?? setLocalCommercialId;
  if (kind === 'commercial' && commercialId) {
    return <CommercePage model={model} embedded={embedded} constructionDraft={constructionDraft}
      detailCommercialTypeId={commercialId} onDetailCommercialTypeChange={changeCommercial} />;
  }
  if (kind === 'industrial' && industrialId) {
    return <BuildingsPage model={model} embedded={embedded} constructionDraft={constructionDraft}
      detailFacilityTypeId={industrialId} onDetailFacilityChange={changeIndustrial} />;
  }

  const commercial = kind === 'commercial';
  const label = commercial ? '商业建筑' : '工业建筑';
  const count = commercial
    ? (model.game.commercialBuildingGroups ?? []).filter((group) => group.provinceId === model.selectedProvinceId && group.count > 0).length
    : model.game.facilityGroups.filter((group) => group.count > 0).length;
  const content = <div className="regional-buildings-management unified-regional-buildings" data-building-kind={kind}>
    <div className="building-construction-sections">
      {commercial
        ? <CommercePage model={model} embedded renderPart="build" constructionDraft={constructionDraft} />
        : <BuildingsPage model={model} embedded renderPart="build" constructionDraft={constructionDraft} />}
    </div>
    <section className="facility-cluster-selector-region" aria-label={`地区${label}列表`}>
      <div className="facility-cluster-selector-list unified-building-list">
        {commercial
          ? <CommercePage model={model} embedded renderPart="cards" constructionDraft={constructionDraft} onDetailCommercialTypeChange={changeCommercial} />
          : <BuildingsPage model={model} embedded renderPart="cards" constructionDraft={constructionDraft} onDetailFacilityChange={changeIndustrial} />}
      </div>
      {count === 0 ? <div className="empty-state tall">当前地区尚未拥有{label}。</div> : null}
    </section>
  </div>;
  return embedded ? content : <PageLayout title={`${model.selectedProvince?.name || '当前地区'}${label}`}>{content}</PageLayout>;
}
