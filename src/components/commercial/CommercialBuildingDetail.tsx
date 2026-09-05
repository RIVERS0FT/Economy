import type { ProductDefinition, ProductInventory } from '../../types';
import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../../types/commercial';
import { useNow } from '../../hooks/useNow';
import { formatCurrency, formatDuration } from '../../utils/formatters';
import {
  COMMERCIAL_REASON_LABELS, COMMERCIAL_STATUS_LABELS,
  commercialCycleProgress, commercialProfitPerMinute, commercialStatusLabel,
} from '../../utils/commercialPresentation';
import { ProductArtwork } from '../products/ProductArtwork';
import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { MobileDetailSummary } from '../ui/MobileDetailSummary';
import { DataList, DataRow, StatusTag, SwitchControl, WidgetHeading } from '../ui/layout';
import { CommercialBuildingArtwork } from './CommercialBuildingArtwork';
import '../../styles/facility-recipe-profit-analysis.css';

function CommercialCycleProgress({ group, now }: { group: CommercialBuildingGroup; now: number }) {
  const liveNow = useNow(now);
  const cycle = commercialCycleProgress(group, liveNow);
  const label = cycle.waiting ? '等待服务器结算'
    : cycle.active ? `本周期剩余 ${formatDuration(cycle.remaining)}`
      : group.status === 'error' ? '等待条件恢复'
        : group.status === 'running' ? '等待服务器确认周期' : '当前未营业';
  return (
    <div className={`progress-wrap facility-progress-running${cycle.active ? '' : ' is-idle'}`}>
      <div className="progress-track" role="progressbar" aria-label="营业周期进度"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cycle.progress)} aria-valuetext={label}>
        <span style={{ width: `${cycle.progress}%` }} />
        <div className="progress-track-copy"><strong>{label}</strong><span>{Math.round(cycle.progress)}%</span></div>
      </div>
    </div>
  );
}

export function CommercialBuildingDetail({ group, type, products, inventories, now, pending, onToggle }: {
  group: CommercialBuildingGroup;
  type: CommercialBuildingTypeDefinition;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const profit = commercialProfitPerMinute(type);
  const tone = group.status === 'running' ? 'success' : group.status === 'error' ? 'danger' : 'neutral';
  return (
    <>
      <section className="facility-information" data-status={group.status} aria-label={`${type.name}商业建筑信息`}>
        <MobileDetailSummary
          className="facility-information-summary"
          artworkClassName="facility-detail-artwork facility-information-artwork"
          artwork={<CommercialBuildingArtwork commercialTypeId={type.id} className="facility-detail-artwork-icon" />}
          title={null}
          meta={<>
            <span className="facility-information-total"><small>总数量</small><strong><CompactNumber value={group.count} /></strong></span>
            <StatusTag tone={tone}>{COMMERCIAL_STATUS_LABELS[group.status]}</StatusTag>
          </>}
          action={<SwitchControl checked={group.enabled} disabled={pending || group.count < 1}
            aria-label={group.enabled ? `停止${type.name}营业` : `开始${type.name}营业`}
            title={group.enabled ? '停止后续自动营业' : '开启自动营业'}
            onChange={(event) => onToggle(event.target.checked)} />}
          description={<div className="facility-information-details">
            <div className="facility-count-summary" aria-label={`${type.name}营业数量`}>
              <span>本周期营业 <strong><CompactNumber value={group.participatingCount} /></strong></span>
            </div>
            <section className={`facility-average-profit${profit > 0 ? ' is-positive' : ''}`} aria-label={`${type.name}单座稳定利润每分钟`}>
              <div className="facility-average-profit__copy"><strong>单座稳定利润／分钟</strong></div>
              <div className="facility-average-profit__value"><CurrencyAmount sign={profit > 0 ? '+' : undefined}>{formatCurrency(profit)}</CurrencyAmount></div>
            </section>
            {group.status === 'error' ? <small className="commercial-action-error" role="status">{group.statusReason ? COMMERCIAL_REASON_LABELS[group.statusReason] : commercialStatusLabel(group)}；条件恢复后自动续营。</small> : null}
            {!group.enabled && group.status === 'running' ? <small className="ui-helper-text">已停止后续营业，本周期仍按锁定结果完成结算。</small> : null}
            <CommercialCycleProgress group={group} now={now} />
          </div>}
        />
      </section>
      <section className="mobile-detail-section commercial-earnings" aria-label="经营收益">
        <WidgetHeading title="经营收益" />
        <DataList>
          <DataRow label="集群额定利润／分钟" value={<CompactCurrency value={commercialProfitPerMinute(type, group.count)} />} />
          <DataRow label="集群额定利润／周期" value={<CompactCurrency value={type.profitPerCycle * group.count} />} />
          <DataRow label="全部建筑运营成本／周期" value={<CompactCurrency value={type.operatingCost * group.count} />} />
          <DataRow label="营业周期" value={formatDuration(type.cycleMs)} />
          {group.status === 'running' ? <>
            <DataRow label="本周期锁定收入" value={group.pendingRevenue === undefined ? '—' : <CompactCurrency value={group.pendingRevenue} />} />
            <DataRow label="本周期锁定利润" value={group.pendingProfit === undefined ? '—' : <CompactCurrency value={group.pendingProfit} />} />
            <DataRow label="本周期已消费商品" value={group.pendingGoodsConsumed === undefined ? '—' : <CompactNumber value={group.pendingGoodsConsumed} suffix=" 件" />} />
          </> : null}
        </DataList>
        <small className="ui-helper-text">额定收益按全部建筑计算；本周期收入与利润以服务器开始营业时锁定的结果为准。</small>
      </section>
      <section className="mobile-detail-section" aria-label="商品消耗">
        <WidgetHeading title="商品消耗" />
        <small className="ui-helper-text">下一周期需求按全部建筑计算，库存仅限当前州；当前周期已投入的商品不会退还。</small>
        <div className="commercial-consumption-list">
          {type.consumptionInputs.map((input) => {
            const name = products.find((product) => product.id === input.productId)?.name ?? input.productId;
            const required = input.quantity * group.count;
            const available = inventories[input.productId]?.available ?? 0;
            return (
              <div className="commercial-consumption-item" data-shortage={available < required} key={input.productId}>
                <ProductArtwork productId={input.productId} className="commercial-consumption-artwork" />
                <div><strong>{name}</strong>
                  <span>每周期 <CompactNumber value={required} /> 件</span>
                  <span>本地库存 <CompactNumber value={available} /> 件{available < required ? ' · 库存不足' : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <section className="mobile-detail-section" aria-label="累计经营">
        <WidgetHeading title="累计经营" />
        <DataList>
          <DataRow label="累计营业收入" value={<CompactCurrency value={group.lifetimeRevenue} />} />
          <DataRow label="累计稳定利润" value={<CompactCurrency value={group.lifetimeProfit} />} />
          <DataRow label="累计消费商品" value={<CompactNumber value={group.lifetimeGoodsConsumed} suffix=" 件" />} />
        </DataList>
      </section>
    </>
  );
}
