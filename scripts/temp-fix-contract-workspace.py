from pathlib import Path
import re


def replace(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing {label}')
    p.write_text(text.replace(old, new, 1))


def sub(path, pattern, replacement, label):
    p = Path(path)
    text = p.read_text()
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'missing {label}')
    p.write_text(next_text)

path = 'src/pages/ContractWorkspacePage.tsx'
p = Path(path)
text = p.read_text()

text = text.replace(
"""  type ContractAuditHistoryItem,
  type ContractKind,
  type ProductionContract,
  type ProductionContractStatus,
""",
"""  type ContractAuditHistoryItem,
  type ContractKind,
  type ContractPerformanceSummary,
  type ProductionContract,
  type ProductionContractStatus,
""",
1,
)

text = text.replace(
"""const STATUS_LABELS: Record<ProductionContractStatus, string> = {
  open: '等待承接', active: '履约中', completed: '已完成', cancelled: '已取消', terminated: '已终止', expired: '已过期',
};
""",
"""const STATUS_LABELS: Record<ProductionContractStatus, string> = {
  open: '等待承接', active: '履约中', completed: '已完成', cancelled: '已取消', terminated: '已终止', expired: '已过期',
};
const END_REASON_LABELS: Record<string, string> = {
  completed: '正常完成', publisher_cancelled: '发布者取消', offer_expired: '等待承接超时',
  termination_requested: '按申请正常结束', immediate_by_participant: '参与方主动违约终止',
  buyer_default: '采购方违约', supplier_default: '供应方违约', both_default: '双方违约',
  borrower_default: '借款方违约', lessee_default: '承租方违约', participant_missing: '参与者状态异常',
  missing_from_world: '合同数据异常结束', unknown: '结束原因待核查',
};
""",
1,
)

text = text.replace(
"""function optionalDays(value: string): number | null | undefined {
  if (!value.trim()) return null;
  return parseIntegerDraft(value, { min: 1, max: 3650 }) ?? undefined;
}
function contractNeedsAttention(contract: ProductionContract) {
""",
"""function optionalDays(value: string): number | null | undefined {
  if (!value.trim()) return null;
  return parseIntegerDraft(value, { min: 1, max: 3650 }) ?? undefined;
}
function isConfirmedDefault(contract: Pick<ProductionContract, 'status' | 'terminationReason'> & Partial<Pick<ProductionContract, 'breachedAt'>>) {
  return contract.status === 'active'
    && Boolean(contract.breachedAt)
    && ['buyer_default', 'supplier_default', 'both_default', 'borrower_default', 'lessee_default'].includes(String(contract.terminationReason || ''));
}
function canClaimConfirmedDefault(contract: ProductionContract) {
  if (!isConfirmedDefault(contract)) return false;
  if (contract.terminationReason === 'buyer_default') return Boolean(contract.isSupplier);
  if (contract.terminationReason === 'supplier_default') return Boolean(contract.isBuyer);
  if (contract.terminationReason === 'both_default') return Boolean(contract.isParticipant || contract.isBuyer || contract.isSupplier);
  if (contract.terminationReason === 'borrower_default') return Boolean(contract.isLender);
  if (contract.terminationReason === 'lessee_default') return Boolean(contract.isLessor);
  return false;
}
function defaultClaimLabel(contract: ProductionContract) {
  if (contract.kind === 'loan') return '解除合同并处置抵押';
  if (contract.terminationReason === 'both_default') return '解除合同';
  return '解除合同并领取违约金';
}
function endReasonTone(reasonCode: string) {
  if (reasonCode === 'completed') return 'success' as const;
  if (['publisher_cancelled', 'offer_expired'].includes(reasonCode)) return 'neutral' as const;
  if (reasonCode === 'termination_requested') return 'warning' as const;
  return 'danger' as const;
}
function completionUnitLabel(unit: ContractAuditHistoryItem['endSummary']['completion']['unit']) {
  if (unit === 'quantity') return '个';
  if (unit === 'repayment') return '笔';
  if (unit === 'lease_period') return '期';
  return '批';
}
function contractNeedsAttention(contract: ProductionContract) {
""",
1,
)

# Make republishing restore the current player's actual role rather than the original publisher direction.
text = text.replace(
"""      setType(initial.publisherRole === 'supplier' ? 'supply' : 'purchase'); setProductId(initial.productId); setQuantityInput(String(initial.dailyMaxQuantity ?? initial.quantityPerDelivery)); setPriceInput(String(initial.unitPrice)); setDurationInput(initial.durationDays === null ? '' : String(initial.durationDays ?? 30)); setStartDelayInput(String(initial.startDelayDays ?? 0));
    } else if (initial.kind === 'loan') {
      setType(initial.publisherSide === 'lender' ? 'lend' : 'borrow'); setPrincipalInput(String(initial.principal || 1000)); setInterestInput(String(Number(initial.interestRateBps || 500) / 100)); setLoanDays(initial.termDays ?? msAsDays(initial.termMs) ?? 1); setFacilityTypeId(initial.facilityTypeId || initialFacility?.id || ''); setCollateralInput(String(initial.collateralQuantity || 1));
    } else {
      setType(initial.publisherSide === 'lessor' ? 'lease-out' : 'lease-in'); setFacilityTypeId(initial.facilityTypeId || initialFacility?.id || ''); setQuantityInput(String(initial.quantity || 1)); setRentInput(String(initial.rentPerPeriod || 100)); setLeaseDays(initial.periodDays ?? msAsDays(initial.periodMs) ?? 1 / 8); setLeasePeriodsInput(String(initial.totalPeriods || 12)); setFirstPeriodDays(initial.firstPeriodDelayDays ?? msAsDays(initial.firstPeriodDelayMs) ?? 0);
""",
"""      setType(initial.isSupplier ? 'supply' : initial.isBuyer ? 'purchase' : initial.publisherRole === 'supplier' ? 'supply' : 'purchase'); setProductId(initial.productId); setQuantityInput(String(initial.dailyMaxQuantity ?? initial.quantityPerDelivery)); setPriceInput(String(initial.unitPrice)); setDurationInput(initial.durationDays === null ? '' : String(initial.durationDays ?? 30)); setStartDelayInput(String(initial.startDelayDays ?? 0));
    } else if (initial.kind === 'loan') {
      setType(initial.isLender ? 'lend' : initial.isBorrower ? 'borrow' : initial.publisherSide === 'lender' ? 'lend' : 'borrow'); setPrincipalInput(String(initial.principal || 1000)); setInterestInput(String(Number(initial.interestRateBps || 500) / 100)); setLoanDays(initial.termDays ?? msAsDays(initial.termMs) ?? 1); setFacilityTypeId(initial.facilityTypeId || initialFacility?.id || ''); setCollateralInput(String(initial.collateralQuantity || 1));
    } else {
      setType(initial.isLessor ? 'lease-out' : initial.isLessee ? 'lease-in' : initial.publisherSide === 'lessor' ? 'lease-out' : 'lease-in'); setFacilityTypeId(initial.facilityTypeId || initialFacility?.id || ''); setQuantityInput(String(initial.quantity || 1)); setRentInput(String(initial.rentPerPeriod || 100)); setLeaseDays(initial.periodDays ?? msAsDays(initial.periodMs) ?? 1 / 8); setLeasePeriodsInput(String(initial.totalPeriods || 12)); setFirstPeriodDays(initial.firstPeriodDelayDays ?? msAsDays(initial.firstPeriodDelayMs) ?? 0);
""",
1,
)

active_replacement = r'''function ActiveContractCard({ contract, label, busy, run }: { contract: ProductionContract; label: string; busy: boolean; run: RunAction }) {
  const needsAttention = contractNeedsAttention(contract);
  const confirmedDefault = isConfirmedDefault(contract);
  const canClaimDefault = canClaimConfirmedDefault(contract);
  const className = `contract-card contract-active-card contract-card--${confirmedDefault || contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`;
  const dailyMax = contract.dailyMaxQuantity ?? contract.quantityPerDelivery;
  const dailyUsed = contract.dailyUsedQuantity ?? 0;
  const remaining = contract.dailyRemainingQuantity ?? Math.max(0, dailyMax - dailyUsed);
  return (
    <PagePanel className={className}>
      <header className="contract-card-heading"><div><div className="contract-card-tags"><StatusTag tone={statusTone(contract)}>{confirmedDefault ? '已违约待解除' : STATUS_LABELS[contract.status]}</StatusTag><StatusTag>{roleTag(contract)}</StatusTag></div><h2>{label}</h2><p>{confirmedDefault ? '违约已经服务器确认，合同不会通过事后补货、补款或还款恢复。' : contract.issue || `下一状态边界：${dateTimeLabel(contract.nextDueAt)}`}</p></div></header>
      {contract.kind === 'supply' && contract.supplyMode === 'daily' ? <>
        <div className="contract-summary-grid">
          <MetricCard label="今日已使用" value={<CompactNumber value={dailyUsed} />} detail={`每日上限 ${formatNumber(dailyMax)}`} />
          <MetricCard label="今日剩余额度" value={<CompactNumber value={remaining} />} tone={remaining > 0 ? 'success' : 'neutral'} />
          <MetricCard label="固定价格" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
          <MetricCard label="累计交付" value={<CompactNumber value={contract.totalDeliveredQuantity ?? 0} />} />
        </div>
        <DailySupplyTerms contract={contract} />
        <DataList className="compact">
          <DataRow label="当日货款托管" value={<CurrencyAmount>{formatCurrency(contract.buyerEscrowCredits)}</CurrencyAmount>} />
          <DataRow label="当日商品预留" value={<CompactNumber value={contract.supplierReservedQuantity} />} />
        </DataList>
      </> : contract.kind === 'supply' ? <LegacySupplyTerms contract={contract} /> : (
        <DataList className="compact">
          <DataRow label={contract.kind === 'loan' ? '本金' : '每期租金'} value={<CurrencyAmount>{formatCurrency(contract.kind === 'loan' ? contract.principal || 0 : contract.rentPerPeriod || 0)}</CurrencyAmount>} />
          <DataRow label="地区" value={contract.provinceId || '—'} />
          <DataRow label="期限" value={dayLabel(contract.kind === 'loan' ? (contract.termDays ?? msAsDays(contract.termMs)) : (contract.periodDays ?? msAsDays(contract.periodMs)))} />
        </DataList>
      )}
      {confirmedDefault ? (
        <div className="contract-card-actions contract-default-claim-actions">
          {canClaimDefault
            ? <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:default-claim`, () => productionContractActions.terminateNow(contract.id))}>{defaultClaimLabel(contract)}</Button>
            : <StatusTag tone="danger">等待受偿方处理</StatusTag>}
        </div>
      ) : contract.kind === 'supply' ? <>
        {contract.isSupplier ? <ToggleField checked={contract.supplierAutoReserve} onChange={(event) => void run(`${contract.id}:auto-reserve`, () => productionContractActions.setAutoReserve(contract.id, event.target.checked, contract.prioritySupply))} label="自动准备商品" /> : null}
        {contract.isBuyer ? <ToggleField checked={contract.buyerAutoFund} onChange={(event) => void run(`${contract.id}:auto-fund`, () => productionContractActions.setAutoFund(contract.id, event.target.checked))} label="自动补充货款" /> : null}
        <div className="contract-card-actions">
          {contract.isSupplier ? <Button variant="secondary" disabled={busy} onClick={() => void run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>立即准备商品</Button> : null}
          {contract.isBuyer ? <Button variant="secondary" disabled={busy} onClick={() => void run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>立即补充货款</Button> : null}
          {!contract.terminationRequestedBy ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:request-end`, () => productionContractActions.requestTermination(contract.id))}>{contract.supplyMode === 'daily' ? '按当前日结束' : '申请当前批次后结束'}</Button> : <StatusTag tone="warning">{contract.supplyMode === 'daily' ? '已申请当前日后结束' : '已申请当前批次后结束'}</StatusTag>}
          <Button variant="text" disabled={busy} onClick={() => { if (window.confirm('立即终止会由发起方承担违约责任，是否继续？')) void run(`${contract.id}:terminate`, () => productionContractActions.terminateNow(contract.id)); }}>立即违约终止</Button>
        </div>
      </> : <CommercialContractActions contract={contract} busy={busy} run={run} />}
      {!confirmedDefault ? <SupplyPriorityEditor contract={contract} busy={busy} run={run} /> : null}
    </PagePanel>
  );
}

function PublishPanel'''
text, count = re.subn(r"function ActiveContractCard\([\s\S]*?\n\}\n\nfunction PublishPanel", active_replacement, text, count=1)
if count != 1:
    raise SystemExit('missing active contract card')

history_components = r'''function HistoryRow({
  contract,
  label,
  productName,
  facilityName,
  provinceName,
  republish,
}: {
  contract: ContractAuditHistoryItem;
  label: string;
  productName: string;
  facilityName: string;
  provinceName: string;
  republish: () => void;
}) {
  const summary = contract.endSummary;
  const completion = summary.completion;
  const settlement = summary.settlement;
  const completionUnit = completionUnitLabel(completion.unit);
  const counterparty = contract.kind === 'loan'
    ? (contract.isLender ? contract.borrowerName : contract.lenderName)
    : contract.kind === 'facility_lease'
      ? (contract.isLessor ? contract.lesseeName : contract.lessorName)
      : (contract.isBuyer ? contract.supplierName : contract.buyerName);
  return (
    <article className="contract-history-entry">
      <header className="contract-history-heading">
        <div className="contract-history-copy"><div className="contract-card-tags"><StatusTag>{roleTag(contract)}</StatusTag><StatusTag tone={endReasonTone(summary.reasonCode)}>{END_REASON_LABELS[summary.reasonCode] || summary.reasonCode}</StatusTag></div><h2>{label}</h2></div>
        <Button className="contract-history-republish" variant="text" onClick={republish}>重新拟定</Button>
      </header>
      <div className="contract-history-result-grid">
        <section className="contract-history-section" aria-label="合同内容">
          <h3>合同内容</h3>
          <DataList className="compact">
            <DataRow label="地区" value={provinceName} />
            {contract.kind === 'supply' && contract.supplyMode === 'daily' ? <>
              <DataRow label="商品" value={productName} />
              <DataRow label="每日最大供应量" value={<CompactNumber value={contract.dailyMaxQuantity ?? contract.quantityPerDelivery} />} />
              <DataRow label="固定价格" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
              <DataRow label="合同时间" value={dayLabel(contract.durationDays)} />
              <DataRow label="开始延迟" value={dayLabel(contract.startDelayDays ?? 0)} />
            </> : null}
            {contract.kind === 'supply' && contract.supplyMode !== 'daily' ? <>
              <DataRow label="商品" value={productName} />
              <DataRow label="旧版每批数量" value={<CompactNumber value={contract.quantityPerDelivery} />} />
              <DataRow label="固定价格" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
              <DataRow label="交付周期" value={dayLabel(msAsDays(contract.deliveryIntervalMs))} />
              <DataRow label="总批次" value={contract.totalDeliveries === null ? '长期' : `${formatNumber(contract.totalDeliveries)} 批`} />
            </> : null}
            {contract.kind === 'loan' ? <>
              <DataRow label="贷款本金" value={<CurrencyAmount>{formatCurrency(contract.principal || 0)}</CurrencyAmount>} />
              <DataRow label="固定总利率" value={`${(Number(contract.interestRateBps || 0) / 100).toFixed(2)}%`} />
              <DataRow label="贷款期限" value={dayLabel(contract.termDays ?? msAsDays(contract.termMs))} />
              <DataRow label="抵押工厂" value={facilityName} />
              <DataRow label="抵押数量" value={<CompactNumber value={contract.collateralQuantity || 0} />} />
            </> : null}
            {contract.kind === 'facility_lease' ? <>
              <DataRow label="租赁工厂" value={facilityName} />
              <DataRow label="工厂数量" value={<CompactNumber value={contract.quantity || 0} />} />
              <DataRow label="每期租金" value={<CurrencyAmount>{formatCurrency(contract.rentPerPeriod || 0)}</CurrencyAmount>} />
              <DataRow label="租金周期" value={dayLabel(contract.periodDays ?? msAsDays(contract.periodMs))} />
              <DataRow label="总租期" value={`${formatNumber(contract.totalPeriods || 0)} 期`} />
            </> : null}
            <DataRow label="合作方" value={counterparty || '—'} />
          </DataList>
        </section>
        <section className="contract-history-section" aria-label="完成事实">
          <h3>完成事实</h3>
          <DataList className="compact">
            {contract.kind === 'supply' && contract.supplyMode === 'daily' ? <>
              <DataRow label="实际交付数量" value={`${formatNumber(contract.totalDeliveredQuantity ?? settlement.goodsDelivered)} 个`} />
              <DataRow label="实际交付事件" value={`${formatNumber(contract.completedDeliveryEvents ?? 0)} 次`} />
              <DataRow label="合同持续时间" value={dayLabel(contract.durationDays)} />
            </> : <>
              <DataRow label="已完成" value={completion.total === null ? `${formatNumber(completion.completed)} ${completionUnit}` : `${formatNumber(completion.completed)} / ${formatNumber(completion.total)} ${completionUnit}`} />
              {completion.ratioBps !== null ? <DataRow label="完成率" value={`${(completion.ratioBps / 100).toFixed(1)}%`} /> : null}
              {contract.kind === 'supply' ? <DataRow label="实际交付" value={`${formatNumber(settlement.goodsDelivered)} 个`} /> : null}
            </>}
          </DataList>
        </section>
        <section className="contract-history-section" aria-label="结束原因"><h3>结束原因</h3><StatusTag tone={endReasonTone(summary.reasonCode)}>{END_REASON_LABELS[summary.reasonCode] || summary.reasonCode}</StatusTag></section>
        <section className="contract-history-section" aria-label="结束时间"><h3>结束时间</h3><time dateTime={new Date(summary.endedAt).toISOString()}>{dateTimeLabel(summary.endedAt)}</time></section>
        <section className="contract-history-section contract-history-section--statistics" aria-label="结束统计">
          <h3>结束统计</h3>
          <DataList className="compact">
            {contract.kind === 'supply' ? <>
              <DataRow label="累计货款" value={<CurrencyAmount>{formatCurrency(settlement.grossTotal)}</CurrencyAmount>} />
              <DataRow label="累计服务费" value={<CurrencyAmount>{formatCurrency(settlement.feeTotal)}</CurrencyAmount>} />
              {contract.isSupplier ? <DataRow label="我的净收入" value={<CurrencyAmount>{formatCurrency(settlement.netTotal)}</CurrencyAmount>} /> : <DataRow label="我支付货款" value={<CurrencyAmount>{formatCurrency(settlement.grossTotal)}</CurrencyAmount>} />}
            </> : null}
            {contract.kind === 'loan' ? <>
              <DataRow label="实际发放本金" value={<CurrencyAmount>{formatCurrency(settlement.loanPrincipalDisbursed || contract.principal || 0)}</CurrencyAmount>} />
              <DataRow label="实际偿还" value={<CurrencyAmount>{formatCurrency(settlement.loanRepaid)}</CurrencyAmount>} />
              {settlement.collateralReceivedByMe > 0 ? <DataRow label="我获得抵押工厂" value={`${formatNumber(settlement.collateralReceivedByMe)} 个`} /> : null}
              {settlement.collateralReturnedToMe > 0 ? <DataRow label="退回我的抵押工厂" value={`${formatNumber(settlement.collateralReturnedToMe)} 个`} /> : null}
            </> : null}
            {contract.kind === 'facility_lease' ? <>
              <DataRow label="累计租金" value={<CurrencyAmount>{formatCurrency(settlement.leaseRentPaid || settlement.grossTotal)}</CurrencyAmount>} />
              <DataRow label="累计服务费" value={<CurrencyAmount>{formatCurrency(settlement.feeTotal)}</CurrencyAmount>} />
              {contract.isLessor ? <DataRow label="我的净收入" value={<CurrencyAmount>{formatCurrency(settlement.netTotal)}</CurrencyAmount>} /> : <DataRow label="我支付租金" value={<CurrencyAmount>{formatCurrency(settlement.leaseRentPaid || settlement.grossTotal)}</CurrencyAmount>} />}
            </> : null}
            {settlement.compensationPaidByMe > 0 ? <DataRow label="我支付赔付" value={<CurrencyAmount>{formatCurrency(settlement.compensationPaidByMe)}</CurrencyAmount>} /> : null}
            {settlement.compensationReceivedByMe > 0 ? <DataRow label="我获得赔付" value={<CurrencyAmount>{formatCurrency(settlement.compensationReceivedByMe)}</CurrencyAmount>} /> : null}
            {settlement.refundedCreditsToMe > 0 ? <DataRow label="退回我的资金" value={<CurrencyAmount>{formatCurrency(settlement.refundedCreditsToMe)}</CurrencyAmount>} /> : null}
            {settlement.refundedGoodsToMe > 0 ? <DataRow label="退回我的商品" value={`${formatNumber(settlement.refundedGoodsToMe)} 个`} /> : null}
          </DataList>
          {contract.auditCompleteness === 'legacy_partial' ? <p className="contract-history-legacy-note">该旧合同上线审计前已存在，仅展示可确认的部分统计，不伪造缺失过程。</p> : null}
        </section>
      </div>
    </article>
  );
}

function ContractPerformancePanel({ performance, error }: { performance: ContractPerformanceSummary | null; error: string }) {
  return (
    <PagePanel className="contract-performance-panel">
      <WidgetHeading title="我的履约档案" action={<StatusTag tone="info">真实合同历史</StatusTag>} />
      <p className="contract-section-description">只展示服务器追加式审计中的已结束合同事实，不生成星级、信用等级或主观评分。</p>
      {error ? <p className="contract-issue">{error}</p> : null}
      {performance ? <>
        <div className="contract-performance-grid">
          <MetricCard label="已结束合同" value={<CompactNumber value={performance.totalEnded} />} />
          <MetricCard label="正常完成" value={<CompactNumber value={performance.completed} />} detail={`完成率 ${(performance.completionRateBps / 100).toFixed(1)}%`} tone="success" />
          <MetricCard label="异常结束" value={<CompactNumber value={performance.abnormalEnded} />} tone={performance.abnormalEnded > 0 ? 'warning' : 'neutral'} />
          <MetricCard label="违约或主动违约" value={<CompactNumber value={performance.defaulted} />} tone={performance.defaulted > 0 ? 'warning' : 'neutral'} />
          <MetricCard label="累计支付赔付" value={<CurrencyAmount>{formatCurrency(performance.compensationPaid)}</CurrencyAmount>} />
          <MetricCard label="累计获得赔付" value={<CurrencyAmount>{formatCurrency(performance.compensationReceived)}</CurrencyAmount>} />
        </div>
        <section className="contract-performance-recent" aria-label="最近五份合同结果">
          <strong>最近五份合同结果</strong>
          {performance.recent.length ? performance.recent.map((item) => <div className="contract-performance-recent-row" key={item.id}><span>{item.kind === 'supply' ? '商品合作' : item.kind === 'loan' ? '玩家借贷' : '工厂租赁'} · {dateTimeLabel(item.endedAt)}</span><StatusTag tone={endReasonTone(item.reasonCode)}>{END_REASON_LABELS[item.reasonCode] || STATUS_LABELS[item.status]}</StatusTag></div>) : <span>暂无已结束合同。</span>}
        </section>
      </> : !error ? <p className="contract-audit-loading">正在读取履约档案…</p> : null}
    </PagePanel>
  );
}

export function ContractWorkspacePage'''
text, count = re.subn(r"function HistoryRow\([\s\S]*?\n\}\n\nexport function ContractWorkspacePage", history_components, text, count=1)
if count != 1:
    raise SystemExit('missing history row')

text = text.replace(
"""  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
""",
"""  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [contractPerformance, setContractPerformance] = useState<ContractPerformanceSummary | null>(null);
  const [contractPerformanceError, setContractPerformanceError] = useState('');
""",
1,
)

text = text.replace(
"""  const activeContracts = state.productionContracts.filter((contract) => contract.status === 'active' && (contract.isParticipant || contract.isBuyer || contract.isSupplier || contract.isLender || contract.isBorrower || contract.isLessor || contract.isLessee)).sort((a, b) => Number(contractNeedsAttention(b)) - Number(contractNeedsAttention(a)) || Number(a.nextDueAt || Infinity) - Number(b.nextDueAt || Infinity));
""",
"""  const activeContracts = state.productionContracts.filter((contract) => contract.status === 'active' && (contract.isParticipant || contract.isBuyer || contract.isSupplier || contract.isLender || contract.isBorrower || contract.isLessor || contract.isLessee)).sort((a, b) => Number(isConfirmedDefault(b)) - Number(isConfirmedDefault(a)) || Number(contractNeedsAttention(b)) - Number(contractNeedsAttention(a)) || Number(a.nextDueAt || Infinity) - Number(b.nextDueAt || Infinity));
""",
1,
)

text = text.replace(
"""  const historyQuery = useMemo<ContractHistoryQuery>(() => ({
""",
"""  useEffect(() => {
    let cancelled = false;
    setContractPerformanceError('');
    void productionContractAudit.performance()
      .then((performance) => { if (!cancelled) setContractPerformance(performance); })
      .catch((reason) => { if (!cancelled) setContractPerformanceError(reason instanceof Error ? reason.message : '履约档案读取失败'); });
    return () => { cancelled = true; };
  }, []);

  const startRepublish = (contract: ContractAuditHistoryItem) => {
    if (showPublish && !window.confirm('使用历史合同参数将替换当前未发布内容，是否继续？')) return;
    setRepublish(contract);
    setShowPublish(true);
    model.notify('已填入历史合同参数，请核对当前条件后发布。');
  };

  const historyQuery = useMemo<ContractHistoryQuery>(() => ({
""",
1,
)

text = text.replace(
"""      {showPublish ? <PublishPanel key={republish?.id || 'new'} model={model} busy={Boolean(busyKey)} close={() => { setShowPublish(false); setRepublish(null); }} run={run} initial={republish} /> : null}
      <div className="contract-workspace">
""",
"""      {showPublish ? <PublishPanel key={republish?.id || 'new'} model={model} busy={Boolean(busyKey)} close={() => { setShowPublish(false); setRepublish(null); }} run={run} initial={republish} /> : null}
      <div className="contract-workspace">
""",
1,
)

old_history_map = """                {historyItems.map((contract) => <HistoryRow key={contract.id} contract={contract} label={contract.kind === 'supply' ? products.get(contract.productId) || contract.productId : contract.kind === 'loan' ? '玩家抵押借贷' : '工厂租赁'} republish={() => { setRepublish(contract); setShowPublish(true); model.notify('已填入历史合同参数，请核对当前条件后发布。'); }} />)}
"""
new_history_map = """                {historyItems.map((contract) => <HistoryRow key={contract.id} contract={contract} label={labelFor(contract)} productName={products.get(contract.productId) || contract.productId} facilityName={facilities.get(contract.facilityTypeId || '') || contract.facilityTypeId || '—'} provinceName={contract.provinceId ? provinces.get(contract.provinceId) || contract.provinceId : '—'} republish={() => startRepublish(contract)} />)}
"""
if old_history_map not in text:
    raise SystemExit('missing history map')
text = text.replace(old_history_map, new_history_map, 1)

# The performance panel follows the four-column workspace so the documented top-level action/summary/publish/workspace order stays intact.
text = text.replace(
"""      </div>
    </PageLayout>
  );
}
""",
"""      </div>
      <ContractPerformancePanel performance={contractPerformance} error={contractPerformanceError} />
    </PageLayout>
  );
}
""",
1,
)

p.write_text(text)

# Point architecture guards at the actual exported workspace and lock the compact-history/no-timeline rule there.
p = Path('scripts/verify-gameplay-decision-support.mjs')
text = p.read_text()
text = text.replace("requireText('src/pages/ContractPage.tsx', '我的履约档案');", "requireText('src/pages/ContractWorkspacePage.tsx', '我的履约档案');")
text = text.replace("requireText('src/pages/ContractPage.tsx', '不生成星级、信用等级或主观评分');", "requireText('src/pages/ContractWorkspacePage.tsx', '不生成星级、信用等级或主观评分');")
text = text.replace("forbidText('src/pages/ContractPage.tsx', 'creditScore');", "forbidText('src/pages/ContractWorkspacePage.tsx', 'creditScore');")
anchor = "requireText('src/pages/ContractWorkspacePage.tsx', '不生成星级、信用等级或主观评分');"
addition = """requireText('src/pages/ContractWorkspacePage.tsx', 'canClaimConfirmedDefault');
requireText('src/pages/ContractWorkspacePage.tsx', '解除合同并领取违约金');
requireText('src/pages/ContractWorkspacePage.tsx', '实际交付事件');
requireText('src/pages/ContractWorkspacePage.tsx', '使用历史合同参数将替换当前未发布内容');
"""
if addition.strip() not in text:
    text = text.replace(anchor, anchor + '\n' + addition, 1)
p.write_text(text)

p = Path('scripts/verify-contract-audit.mjs')
text = p.read_text()
text = text.replace("const contractPage = read('src/pages/ContractPage.tsx');", "const contractPage = read('src/pages/ContractWorkspacePage.tsx');")
old = """includesAll(contractPage, [
  \"import '../styles/contract-audit.css';\", '合同历史筛选', '合同内容', '结束原因', '结束时间',
  '完成情况', '结束统计', '重新拟定', 'productionContractAudit.history', 'initialContract',
], 'contract history player UI');
assert.ok(!contractPage.includes('productionContractAudit.detail'), 'player history must not load audit detail timelines');
assert.ok(!contractPage.includes('合同完整审计'), 'player history must not expose the audit viewer');
"""
new = """includesAll(contractPage, [
  \"import '../styles/contract-audit.css';\", 'contract-history-filters', '合同内容', '结束原因', '结束时间',
  '完成事实', '结束统计', '重新拟定', 'productionContractAudit.history', 'startRepublish',
  '我的履约档案', 'productionContractAudit.performance', '实际交付事件',
], 'contract history player UI');
assert.ok(!contractPage.includes('productionContractAudit.detail'), 'player history must not load audit detail timelines');
assert.ok(!contractPage.includes('合同完整审计'), 'player history must not expose the audit viewer');
"""
if old not in text:
    raise SystemExit('missing contract audit verifier player UI anchor')
text = text.replace(old, new, 1)
p.write_text(text)
