import { useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../auto-trade/useOnlineAutoTrade';
import type { CommercialBuildingTypeDefinition } from '../types/commercial';
import { COMMERCIAL_STATUS_LABELS, commercialProfitPerMinute, commercialStatusLabel } from '../utils/commercialPresentation';
import { CommercePage } from './CommercePage';
import { ChevronIcon } from '../components/icons/GameIcons';
import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';
import { EntityListHeader, type EntityListSortState } from '../components/ui/EntityListHeader';
import { usePlayerPageNavigation } from '../components/ui/PageNavigationContext';
import { RegionalEntityPageTitle } from '../components/ui/RegionalEntityPageTitle';
import { PageLayout, Panel } from '../components/ui/layout';

type SortKey = 'name' | 'profit' | 'count' | 'status';

export function GlobalCommercialBuildingPage({ model, type, activeProvinceId, onOpenRegion, onBack }: {
  model: OnlineAutoTradeAwareGameViewModel;
  type: CommercialBuildingTypeDefinition;
  activeProvinceId: string | null;
  onOpenRegion: (provinceId: string) => void;
  onBack: () => void;
}) {
  const navigation = usePlayerPageNavigation();
  const [sort, setSort] = useState<EntityListSortState<SortKey>>({ key: 'catalog', direction: 'asc' });
  const profit = commercialProfitPerMinute(type);
  const groups = model.game.commercialBuildingGroups ?? [];
  const rows = model.game.provinces.flatMap((province, index) => {
    const group = groups.find((candidate) => candidate.provinceId === province.id && candidate.commercialTypeId === type.id && candidate.count > 0);
    return group ? [{ province, group, index }] : [];
  }).sort((a, b) => {
    const rank = { error: 0, stopped: 1, running: 2 };
    const comparison = sort.key === 'name' ? a.province.name.localeCompare(b.province.name, 'zh-CN')
      : sort.key === 'count' ? a.group.count - b.group.count
        : sort.key === 'status' ? rank[a.group.status] - rank[b.group.status] : 0;
    return comparison * (sort.direction === 'asc' ? 1 : -1) || a.index - b.index;
  });
  const province = model.game.provinces.find((candidate) => candidate.id === activeProvinceId);
  if (province) {
    return <PageLayout title={<RegionalEntityPageTitle entityName={type.name} regionName={province.name} />}
      backAction={navigation ? undefined : { label: '返回地区建筑', onClick: onBack }}>
      <div className="global-operation-page global-buildings-page" data-global-scope="buildings" data-drilldown-province-id={province.id}>
        {model.selectedProvinceId === province.id ? <CommercePage model={model} embedded detailCommercialTypeId={type.id}
          onDetailCommercialTypeChange={(id) => { if (!id) { if (navigation) navigation.onBack(); else onBack(); } }} />
          : <Panel className="empty-state"><span role="status">正在切换经营地区…</span></Panel>}
      </div>
    </PageLayout>;
  }
  return <PageLayout title={type.name} backAction={navigation ? undefined : { label: '返回建筑列表', onClick: onBack }}>
    <div className="global-operation-page global-buildings-page global-facility-region-page" data-global-scope="buildings" data-global-commercial-type-id={type.id}>
      <section className="entity-list-surface global-facility-region-surface">
        <EntityListHeader className="global-facility-region-header" columns={[
          { label: '地区', sortKey: 'name', defaultDirection: 'asc' },
          { label: '利润／分钟', sortKey: 'profit', defaultDirection: 'desc' },
          { label: '拥有', sortKey: 'count', defaultDirection: 'desc' },
          { label: '状态', sortKey: 'status', defaultDirection: 'asc' },
          { key: 'chevron', label: '' },
        ]} sortState={sort} onSortChange={setSort} />
        <ul className="entity-list-rows global-facility-region-list" aria-label={`${type.name}地区商业建筑`}>
          {rows.map(({ province: region, group }) => <li key={region.id}>
            <div className="entity-list-row global-facility-region-row" data-province-id={region.id} data-building-kind="commercial">
              <button type="button" className="global-facility-region-row__open" data-ui-interactive="surface"
                aria-label={`打开${region.name}${type.name}建筑详情，拥有 ${group.count} 座，${commercialStatusLabel(group)}`}
                onClick={() => onOpenRegion(region.id)}>
                <span className="global-facility-region-row__identity"><strong>{region.name}</strong></span>
                <strong className="entity-list-value global-facility-region-row__profit is-positive" title="单座满员额定利润／分钟"><CompactCurrency value={profit} /></strong>
                <strong className="global-facility-region-row__metric"><CompactNumber value={group.count} /></strong>
                <strong className="global-facility-region-row__status" title={commercialStatusLabel(group)}>{COMMERCIAL_STATUS_LABELS[group.status]}</strong>
                <span className="global-facility-region-row__chevron" aria-hidden="true"><ChevronIcon direction="right" /></span>
              </button>
            </div>
          </li>)}
        </ul>
        {rows.length === 0 ? <div className="empty-state">当前已没有地区持有该商业建筑。</div> : null}
      </section>
    </div>
  </PageLayout>;
}
