import type { ReactNode } from 'react';
import { RegionalEntityPageTitle } from '../ui/RegionalEntityPageTitle';
import { PageLayout, PagePanel } from '../ui/layout';
import type { BuildingKind } from './BuildingTypeFilter';

/** One page/surface owner. Domain adapters supply content, never convert asset models. */
export function BuildingDetailPage({ kind, name, provinceName, embedded = false, onBack, children }: {
  kind: BuildingKind;
  name: string;
  provinceName: string;
  embedded?: boolean;
  onBack: () => void;
  children: ReactNode;
}) {
  const commercial = kind === 'commercial';
  const content = (
    <div className={`facility-cluster-detail-shell facility-cluster-detail-page building-detail-page${commercial ? ' commercial-cluster-detail-page' : ''}`}
      data-building-kind={kind}>
      <PagePanel className={`production-surface facility-card facility-group-card facility-cluster-detail-card${commercial ? ' commercial-building-detail-card' : ''}`}>
        {children}
      </PagePanel>
    </div>
  );
  return embedded ? content : (
    <PageLayout title={<RegionalEntityPageTitle entityName={name} regionName={provinceName} className="province-facility-detail-title" />}
      backAction={{ label: '返回建筑列表', onClick: onBack }}>
      {content}
    </PageLayout>
  );
}
