import type { ProductDefinition, ProductInventory } from '../../types';
import type { CommercialAutoOperationPolicy, CommercialBuildingGroup, CommercialBuildingTypeDefinition } from '../../types/commercial';
import { commercialAutoOperationPolicyFor } from '../../../shared/commercial-auto-operation.js';
import { useNow } from '../../hooks/useNow';
import { formatCurrency, formatDuration } from '../../utils/formatters';
import { COMMERCIAL_REASON_LABELS, COMMERCIAL_STATUS_LABELS, commercialCycleProgress, commercialProfitPerMinute, commercialStatusLabel } from '../../utils/commercialPresentation';
import { commercialSettlementPresentation } from '../../utils/commercialSettlement';
import { BuildingAutoOperationSection } from '../buildings/BuildingAutoOperationSection';
import { BuildingSettlementPanel } from '../buildings/BuildingSettlementPanel';
import { BuildingSettlementProducts } from '../buildings/BuildingSettlementProducts';
import { CreditsIcon } from '../icons/GameIcons';
import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { SelectInput } from '../ui/FormControls';
import { GameConcept } from '../ui/GameConcept';
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

export function CommercialBuildingDetail({ group, type, products, inventories, markets, now, pending, onToggle,
  onAutoOperationChange, onOpenProductMarket }: {
  group: CommercialBuildingGroup;
  type: CommercialBuildingTypeDefinition;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  markets: Record<string, { officialPrice?: number | null }>;
  now: number;
  pending: boolean;
  onToggle: (enabled: boolean) => void;
  onAutoOperationChange: (policy: CommercialAutoOperationPolicy) => void;
  onOpenProductMarket: (productId: string) => void;
}) {
  const profit = commercialProfitPerMinute(type);
  const tone = group.status === 'running' ? 'success' : group.status === 'error' ? 'danger' : 'neutral';
  const policy = commercialAutoOperationPolicyFor(group);
  const settlement = commercialSettlementPresentation(group, type, markets);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const nextRequirements = Object.fromEntries(type.consumptionInputs.map((input) => [input.productId, input.quantity * group.count]));
  const money = (value: number | null) => value === null ? '—' : <CompactCurrency value={value} />;
  return (
    <>
      <section className="facility-information" data-status={group.status} aria-label={`${type.name}商业建筑信息`}>
        <MobileDetailSummary className="facility-information-summary"
          artworkClassName="facility-detail-artwork facility-information-artwork"
          artwork={<CommercialBuildingArtwork commercialTypeId={type.id} className="facility-detail-artwork-icon" />} title={null}
          meta={<><span className="facility-information-total"><small>总数量</small><strong><CompactNumber value={group.count} /></strong></span>
            <StatusTag tone={tone}>{COMMERCIAL_STATUS_LABELS[group.status]}</StatusTag></>}
          action={<SwitchControl checked={group.enabled} disabled={pending || group.count < 1}
            aria-label={group.enabled ? `停止${type.name}营业` : `开始${type.name}营业`}
            title={group.enabled ? '停止后续营业' : '开始营业'} onChange={(event) => onToggle(event.target.checked)} />}
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
          </div>}
        />
      </section>
      <BuildingAutoOperationSection label={<GameConcept concept="commercial-auto-operation">自动经营</GameConcept>}
        enabled={policy.enabled} disabled={pending || group.count < 1}
        onChange={(enabled) => onAutoOperationChange({ ...policy, enabled })}>
        <SelectInput label={<GameConcept concept="commercial-input-coverage">商品保障</GameConcept>}
          aria-label={`${type.name}商品保障`} fieldClassName="facility-auto-operation__coverage"
          value={String(policy.inputCoverageCycles)} disabled={pending || !policy.enabled || group.count < 1}
          onChange={(event) => onAutoOperationChange({ ...policy, inputCoverageCycles: Number(event.target.value) as 1 | 2 | 3 | 5 })}>
          {[1, 2, 3, 5].map((cycles) => <option value={cycles} key={cycles}>{cycles} 个营业周期</option>)}
        </SelectInput>
      </BuildingAutoOperationSection>
      <BuildingSettlementPanel className="commercial-settlement" title={<GameConcept concept="commercial-settlement">经营结算</GameConcept>}
        status={group.status} description={`${type.name}经营结算，${settlement.locked ? '本周期锁定结果' : '下一周期预计结果'}，参与 ${settlement.count} 座，${settlement.label} ${settlement.revenue === null ? '待确认' : formatCurrency(settlement.revenue)}`}
        inputLabel={settlement.locked ? '已投入商品' : '消费商品'} outputLabel={settlement.locked ? '锁定收入' : '预计收入'}
        inputs={settlement.inputs ? <BuildingSettlementProducts items={settlement.inputs} productNames={productNames}
          inventories={inventories} multiplier={1} groupClassName="facility-formula-input-group commercial-consumption-list"
          itemClassName="facility-formula-input-item" quantityLabel="营业消耗" requiredForNextCycle={nextRequirements}
          onOpenProductMarket={onOpenProductMarket} /> : <span className="facility-formula-empty">锁定明细待确认</span>}
        outputs={<div className="facility-formula-output-group commercial-settlement-revenue">
          <div className="facility-formula-output-item"><CreditsIcon className="facility-formula-meta-icon" /><strong>{money(settlement.revenue)}</strong></div>
        </div>}
        cycleMs={settlement.locked && typeof group.cycleStartedAt === 'number' && typeof group.cycleCompletesAt === 'number' && group.cycleCompletesAt > group.cycleStartedAt ? group.cycleCompletesAt - group.cycleStartedAt : type.cycleMs} operatingCost={settlement.operatingCost} progress={<CommercialCycleProgress group={group} now={now} />}>
        <DataList>
          <DataRow label={settlement.label} value={money(settlement.revenue)} />
          <DataRow label={settlement.locked ? '本周期锁定商品价值' : '预计商品价值'} value={money(settlement.inputValue)} />
          <DataRow label={settlement.locked ? '本周期已付运营成本' : '预计运营成本'} value={money(settlement.operatingCost)} />
          <DataRow label={settlement.locked ? '本周期锁定利润' : '预计稳定利润'} value={money(settlement.profit)} />
        </DataList>
        {!settlement.locked ? <small className="ui-helper-text">下一周期按全部建筑和当前州官方价预估，实际投入与收入由服务器开始营业时锁定。</small> : null}
      </BuildingSettlementPanel>
      <section className="mobile-detail-section commercial-earnings" aria-label="经营收益">
        <WidgetHeading title="经营收益" />
        <DataList>
          <DataRow label="集群额定利润／分钟" value={<CompactCurrency value={commercialProfitPerMinute(type, group.count)} />} />
          <DataRow label="集群额定利润／周期" value={<CompactCurrency value={type.profitPerCycle * group.count} />} />
        </DataList>
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
