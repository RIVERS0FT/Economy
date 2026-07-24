import type { ExtendedAdminSummary } from '../api/admin';
import { AdminCommunityLinkPanel } from './AdminCommunityLinkPanel';
import { MetricCard } from './ui/layout';

export function AdminOverview({
  active,
  summary,
  refreshToken,
  onNotice,
  onError,
}: {
  active: boolean;
  summary: ExtendedAdminSummary | null;
  refreshToken: number;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="admin-section-stack admin-overview-console">
      <section className="admin-summary-grid" aria-label="世界概览">
        <MetricCard label="玩家数量" value={summary?.playerCount ?? '--'} />
        <MetricCard label="未完成订单" value={summary?.openOrderCount ?? '--'} />
        <MetricCard label="商品订单" value={summary?.commodityOrderCount ?? '--'} />
        <MetricCard label="工厂订单" value={summary?.facilityOrderCount ?? '--'} />
        <MetricCard label="进行中拍卖" value={summary?.openAuctionCount ?? '--'} />
        <MetricCard label="开放／履约合同" value={summary?.openContractCount ?? '--'} />
      </section>

      <AdminCommunityLinkPanel
        active={active}
        refreshToken={refreshToken}
        onNotice={onNotice}
        onError={onError}
      />
    </div>
  );
}
