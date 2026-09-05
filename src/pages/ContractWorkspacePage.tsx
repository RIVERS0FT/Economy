import { useEffect, useMemo, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, MoneyInput, SelectInput, TextInput } from '../components/ui/FormControls';
import { CompactNumber } from '../components/ui/CompactNumber';
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  MetricCard,
  PageLayout,
  PagePanel,
  StatusTag,
  ToggleField,
  WidgetHeading,
} from '../components/ui/layout';
import {
  productionContractActions,
  productionContractAudit,
  type ContractHistoryQuery,
  type CreateProductionContractInput,
} from '../contracts/api';
import {
  productionContractStateFromGame,
  type ContractAuditHistoryItem,
  type ContractKind,
  type ContractPerformanceSummary,
  type ProductionContract,
  type ProductionContractStatus,
  type SupplyPriorityCondition,
} from '../contracts/types';
import { ContractNegotiationSection } from '../contracts/ContractNegotiationSection';
import { consumeContractMarketIntent } from '../contracts/navigation';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import '../styles/contract-audit.css';
import '../styles/contract-negotiation.css';
import '../styles/contract-commercial.css';

type ContractWorkspaceView = 'workbench' | 'market' | 'active' | 'history';
type PublishType = 'supply' | 'purchase' | 'lend' | 'borrow' | 'lease-out' | 'lease-in';
type HistoryRole = 'any' | 'publisher' | 'buyer' | 'supplier' | 'lender' | 'borrower' | 'lessor' | 'lessee';
type RunAction = (key: string, operation: () => Promise<{ result: { ok: boolean; message: string } }>) => Promise<void>;

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_LABELS: Record<ProductionContractStatus, string> = {
  open: '等待承接', active: '履约中', completed: '已完成', cancelled: '已取消', terminated: '已终止', expired: '已过期',
};
const END_REASON_LABELS: Record<string, string> = {
  completed: '正常完成', publisher_cancelled: '发布者取消', offer_expired: '等待承接超时',
  termination_requested: '按申请正常结束', immediate_by_participant: '参与方主动违约终止',
  buyer_default: '采购方违约', supplier_default: '供应方违约', both_default: '双方违约',
  borrower_default: '借款方违约', lessee_default: '承租方违约', participant_missing: '参与者状态异常',
  missing_from_world: '合同数据异常结束', unknown: '结束原因待核查',
};
const PUBLISH_TYPES: Array<[PublishType, string, string]> = [
  ['supply', '供应合同', '按固定价格提供商品'],
  ['purchase', '采购合同', '按固定价格采购商品'],
  ['lend', '放贷合同', '提供冻结贷款'],
  ['borrow', '贷款合同', '寻找冻结贷款'],
  ['lease-out', '出租合同', '提供工厂使用权'],
  ['lease-in', '租赁合同', '寻找工厂使用权'],
];
const LOAN_DAY_OPTIONS = [[0.5, '0.5 天'], [1, '1 天'], [3, '3 天']] as const;
const LEASE_DAY_OPTIONS = [[1 / 24, '1/24 天'], [1 / 8, '1/8 天'], [1 / 4, '1/4 天'], [0.5, '0.5 天'], [1, '1 天']] as const;
const FIRST_DAY_OPTIONS = [[0, '立即'], ...LEASE_DAY_OPTIONS] as const;

function dayLabel(value?: number | null) {
  if (value === null || value === undefined) return '长期';
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded} 天`;
}
function msAsDays(value?: number | null) { return value == null ? null : Number(value) / DAY_MS; }
function dateTimeLabel(value?: number | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(value);
}
function optionalDays(value: string): number | null | undefined {
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
  if (contract.kind === 'loan') return '解除合同并处置冻结';
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
  return Boolean(contract.issue || contract.graceEndsAt || contract.breachedAt || contract.terminationRequestedBy || contract.renewalProposal?.awaitingMyApproval);
}
function statusTone(contract: ProductionContract) {
  if (contract.status === 'completed') return 'success' as const;
  if (contract.status === 'terminated' || contract.breachedAt) return 'danger' as const;
  if (contract.issue || contract.graceEndsAt) return 'warning' as const;
  return contract.status === 'active' ? 'success' as const : 'neutral' as const;
}
function kindName(contract: ProductionContract) {
  if (contract.kind === 'loan') return contract.publisherSide === 'lender' ? '放贷合同' : '贷款合同';
  if (contract.kind === 'facility_lease') return contract.publisherSide === 'lessor' ? '出租合同' : '租赁合同';
  return contract.publisherRole === 'supplier' ? '供应合同' : '采购合同';
}
function roleTag(contract: ProductionContract) {
  if (contract.kind === 'loan') return contract.isLender ? '我放贷' : contract.isBorrower ? '我贷款' : contract.publisherSide === 'lender' ? '放贷报价' : '贷款需求';
  if (contract.kind === 'facility_lease') return contract.isLessor ? '我出租' : contract.isLessee ? '我租赁' : contract.publisherSide === 'lessor' ? '出租报价' : '租赁需求';
  return contract.isBuyer ? '我采购' : contract.isSupplier ? '我供货' : contract.publisherRole === 'buyer' ? '采购需求' : '供应报价';
}

function DailySupplyTerms({ contract }: { contract: ProductionContract }) {
  return (
    <DataList className="compact">
      <DataRow label="每日最大供应量" value={<CompactNumber value={contract.dailyMaxQuantity ?? contract.quantityPerDelivery} />} />
      <DataRow label="固定价格" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
      <DataRow label="合同时间" value={dayLabel(contract.durationDays)} />
      <DataRow label="开始延迟" value={dayLabel(contract.startDelayDays ?? 0)} />
      <DataRow label="地区" value={contract.provinceId || '—'} />
    </DataList>
  );
}

function LegacySupplyTerms({ contract }: { contract: ProductionContract }) {
  return (
    <DataList className="compact">
      <DataRow label="旧版每批数量" value={<CompactNumber value={contract.quantityPerDelivery} />} />
      <DataRow label="固定价格" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
      <DataRow label="交付周期" value={dayLabel(msAsDays(contract.deliveryIntervalMs))} />
      <DataRow label="首次交付" value={dayLabel(msAsDays(contract.firstDeliveryDelayMs))} />
      <DataRow label="总批次" value={contract.totalDeliveries === null ? '长期' : `${formatNumber(contract.totalDeliveries)} 批`} />
    </DataList>
  );
}

function OpenContractCard({ contract, label, busy, run }: { contract: ProductionContract; label: string; busy: boolean; run: RunAction }) {
  return (
    <PagePanel className="contract-card contract-offer-card">
      <header className="contract-card-heading">
        <div><div className="contract-card-tags"><StatusTag>{roleTag(contract)}</StatusTag><StatusTag tone="info">{contract.supplyMode === 'daily' ? '每日额度' : kindName(contract)}</StatusTag></div><h2>{label}</h2><p>发布者：{contract.publisherName}</p></div>
        <StatusTag>{STATUS_LABELS[contract.status]}</StatusTag>
      </header>
      {contract.kind === 'supply' ? (contract.supplyMode === 'daily' ? <DailySupplyTerms contract={contract} /> : <LegacySupplyTerms contract={contract} />) : (
        <DataList className="compact">
          <DataRow label={contract.kind === 'loan' ? '本金' : '每期租金'} value={<CurrencyAmount>{formatCurrency(contract.kind === 'loan' ? contract.principal || 0 : contract.rentPerPeriod || 0)}</CurrencyAmount>} />
          <DataRow label="地区" value={contract.provinceId || '—'} />
          <DataRow label="期限" value={dayLabel(contract.kind === 'loan' ? (contract.termDays ?? msAsDays(contract.termMs)) : (contract.periodDays ?? msAsDays(contract.periodMs)))} />
        </DataList>
      )}
      <div className="contract-card-actions">{!contract.isPublisher ? <Button disabled={busy} onClick={() => void run(`${contract.id}:accept`, () => productionContractActions.accept(contract.id))}>承接合同</Button> : null}{contract.isPublisher ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:cancel`, () => productionContractActions.cancel(contract.id))}>取消公开合同</Button> : null}</div>
      {contract.kind === 'supply' && contract.supplyMode === 'daily' ? <ContractNegotiationSection contract={contract} busy={busy} run={run} /> : null}
    </PagePanel>
  );
}

function SupplyPriorityEditor({ contract, busy, run }: { contract: ProductionContract; busy: boolean; run: RunAction }) {
  const current = contract.prioritySupply ?? { enabled: false, minDailyProduction: 0, minContractPrice: 0 };
  const [enabled, setEnabled] = useState(current.enabled);
  const [productionInput, setProductionInput] = useState(String(current.minDailyProduction));
  const [priceInput, setPriceInput] = useState(String(current.minContractPrice));
  const production = parseIntegerDraft(productionInput, { min: 0, max: 1_000_000_000 });
  const price = parseMoneyDraft(priceInput, { min: 0, max: 1_000_000 });
  if (!contract.isSupplier || contract.supplyMode !== 'daily') return null;
  const save = () => {
    if (production === null || price === null) return;
    const priority: SupplyPriorityCondition = { enabled, minDailyProduction: production, minContractPrice: price };
    void run(`${contract.id}:priority`, () => productionContractActions.setAutoReserve(contract.id, contract.supplierAutoReserve, priority));
  };
  return (
    <section className="contract-priority-panel" aria-label="优先供应条件">
      <strong>优先供应条件</strong>
      <ToggleField checked={enabled} onChange={(event) => setEnabled(event.target.checked)} label="启用优先供应" description="同时满足当日产量和最低合同价格后，新增库存才自动进入合同预留。" />
      <div className="contract-publish-grid">
        <IntegerInput label="最低当日产量" value={productionInput} fallbackValue={0} min={0} max={1_000_000_000} error={production === null ? '请输入有效整数。' : undefined} onValueChange={setProductionInput} />
        <MoneyInput label="最低合同价格" value={priceInput} fallbackValue={0} min={0} max={1_000_000} error={price === null ? '请输入有效金额。' : undefined} onValueChange={setPriceInput} />
      </div>
      <Button variant="secondary" disabled={busy || production === null || price === null} onClick={save}>保存优先供应条件</Button>
    </section>
  );
}

function CommercialContractActions({ contract, busy, run }: { contract: ProductionContract; busy: boolean; run: RunAction }) {
  if (contract.kind === 'loan' && contract.isBorrower) {
    return <div className="contract-card-actions"><Button variant="secondary" disabled={busy} onClick={() => void run(`${contract.id}:repay`, () => productionContractActions.repayLoan(contract.id))}>立即还款</Button><ToggleField checked={contract.autoRepay !== false} onChange={(event) => void run(`${contract.id}:auto-repay`, () => productionContractActions.setLoanAutoRepay(contract.id, event.target.checked))} label="自动还款" description="到期时自动使用当前可用资金偿还，不透支未来收入。" /></div>;
  }
  if (contract.kind === 'facility_lease' && contract.isLessee) {
    return <div className="contract-card-actions"><Button variant="secondary" disabled={busy} onClick={() => void run(`${contract.id}:lease-fund`, () => productionContractActions.fundLease(contract.id))}>补充租金</Button><ToggleField checked={contract.autoFund !== false} onChange={(event) => void run(`${contract.id}:lease-auto-fund`, () => productionContractActions.setLeaseAutoFund(contract.id, event.target.checked))} label="自动补充租金" description="每期只使用当前可用资金补充租金，不透支未来收入。" /></div>;
  }
  return null;
}

function LegacyRenewalResolution({ contract, busy, run }: { contract: ProductionContract; busy: boolean; run: RunAction }) {
  const proposal = contract.kind === 'supply' && contract.supplyMode !== 'daily' ? contract.renewalProposal : null;
  if (!proposal) return null;
  const terms = proposal.terms;
  const approvedCount = Number(Boolean(proposal.buyerApproved)) + Number(Boolean(proposal.supplierApproved));
  const pendingText = proposal.approvedByMe ? '你已同意，等待合作方确认' : '等待你确认旧合同续签条款';
  return (
    <section className="contract-renewal-panel" aria-label="旧合同续签兼容">
      <div className="contract-renewal-heading">
        <div><strong>旧合同续签</strong><span>{proposal.status === 'proposed' ? pendingText : proposal.status === 'accepted' ? '双方已同意，当前旧合同完成后生效' : '关联旧合同已经生效'}</span></div>
        <StatusTag tone={proposal.status === 'accepted' || proposal.status === 'activated' ? 'success' : 'info'}>{proposal.status === 'proposed' ? `${approvedCount}/2 已同意` : proposal.status === 'accepted' ? '已锁定' : '已生效'}</StatusTag>
      </div>
      <p className="contract-section-description">该区域只处理已经存在的旧有限批次续签，不会把批次、交付周期或续签入口恢复到新每日额度合同。</p>
      <DataList className="compact contract-renewal-summary">
        <DataRow label="每批数量" value={<CompactNumber value={terms.quantityPerDelivery} />} />
        <DataRow label="单位价格" value={<CurrencyAmount>{formatCurrency(terms.unitPrice)}</CurrencyAmount>} />
        <DataRow label="交付周期" value={dayLabel(msAsDays(terms.deliveryIntervalMs))} />
        <DataRow label="总批次" value={terms.totalDeliveries === null ? '旧长期合同' : `${formatNumber(terms.totalDeliveries)} 批`} />
        <DataRow label="采购方确认" value={<StatusTag tone={proposal.buyerApproved ? 'success' : 'neutral'}>{proposal.buyerApproved ? '已同意' : '待确认'}</StatusTag>} />
        <DataRow label="供应方确认" value={<StatusTag tone={proposal.supplierApproved ? 'success' : 'neutral'}>{proposal.supplierApproved ? '已同意' : '待确认'}</StatusTag>} />
      </DataList>
      {proposal.status === 'proposed' ? <div className="contract-renewal-actions">
        {proposal.approvedByMe
          ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-revoke`, () => productionContractActions.revokeRenewal(contract.id))}>撤销同意</Button>
          : <Button disabled={busy} onClick={() => void run(`${contract.id}:renewal-accept`, () => productionContractActions.acceptRenewal(contract.id))}>同意续签</Button>}
        {proposal.isProposer
          ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-cancel`, () => productionContractActions.rejectRenewal(contract.id))}>取消续签提议</Button>
          : !proposal.approvedByMe
            ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-reject`, () => productionContractActions.rejectRenewal(contract.id))}>拒绝续签</Button>
            : null}
      </div> : null}
    </section>
  );
}

function ActiveContractCard({ contract, label, busy, run }: { contract: ProductionContract; label: string; busy: boolean; run: RunAction }) {
  const needsAttention = contractNeedsAttention(contract);
  const confirmedDefault = isConfirmedDefault(contract);
  const canClaimDefault = canClaimConfirmedDefault(contract);
  const className = `contract-card contract-active-card contract-card--${confirmedDefault || contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`;
  const dailyMax = contract.dailyMaxQuantity ?? contract.quantityPerDelivery;
  const dailyUsed = contract.dailyUsedQuantity ?? 0;
  const remaining = contract.dailyRemainingQuantity ?? Math.max(0, dailyMax - dailyUsed);
  return (
    <PagePanel className={className}>
      <header className="contract-card-heading"><div><div className="contract-card-tags"><StatusTag tone={statusTone(contract)}>{confirmedDefault ? '已违约待解除' : STATUS_LABELS[contract.status]}</StatusTag><StatusTag>{roleTag(contract)}</StatusTag>{needsAttention && !confirmedDefault ? <StatusTag tone="warning">待处理</StatusTag> : null}</div><h2>{label}</h2><p>{confirmedDefault ? '违约已经服务器确认，合同不会通过事后补货、补款或还款恢复。' : contract.issue || `下一状态边界：${dateTimeLabel(contract.nextDueAt)}`}</p></div></header>
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
        {contract.isSupplier ? <ToggleField checked={contract.supplierAutoReserve} onChange={(event) => void run(`${contract.id}:auto-reserve`, () => productionContractActions.setAutoReserve(contract.id, event.target.checked, contract.prioritySupply))} label="自动准备商品" description="只从当前可用库存准备当日或当前批次商品，不透支未来产量。" /> : null}
        {contract.isBuyer ? <ToggleField checked={contract.buyerAutoFund} onChange={(event) => void run(`${contract.id}:auto-fund`, () => productionContractActions.setAutoFund(contract.id, event.target.checked))} label="自动补充货款" description="只从当前可用资金补充当日或当前批次货款，不透支未来收入。" /> : null}
        <div className="contract-card-actions">
          {contract.isSupplier ? <Button variant="secondary" disabled={busy} onClick={() => void run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>立即准备商品</Button> : null}
          {contract.isBuyer ? <Button variant="secondary" disabled={busy} onClick={() => void run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>立即补充货款</Button> : null}
          {!contract.terminationRequestedBy ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:request-end`, () => productionContractActions.requestTermination(contract.id))}>{contract.supplyMode === 'daily' ? '按当前日结束' : '申请当前批次后结束'}</Button> : <StatusTag tone="warning">{contract.supplyMode === 'daily' ? '已申请当前日后结束' : '已申请当前批次后结束'}</StatusTag>}
          <Button variant="text" disabled={busy} onClick={() => { if (window.confirm('立即终止会由发起方承担违约责任，是否继续？')) void run(`${contract.id}:terminate`, () => productionContractActions.terminateNow(contract.id)); }}>立即违约终止</Button>
        </div>
      </> : <CommercialContractActions contract={contract} busy={busy} run={run} />}
      {!confirmedDefault ? <SupplyPriorityEditor contract={contract} busy={busy} run={run} /> : null}
      {!confirmedDefault ? <LegacyRenewalResolution contract={contract} busy={busy} run={run} /> : null}
    </PagePanel>
  );
}

function PublishPanel({ model, busy, close, run, initial }: { model: TutorialAwareGameViewModel; busy: boolean; close: () => void; run: RunAction; initial: ContractAuditHistoryItem | null }) {
  const initialProduct = model.game.products[0];
  const initialFacility = model.game.facilityTypes[0];
  const [type, setType] = useState<PublishType>('purchase');
  const [provinceId, setProvinceId] = useState(model.selectedProvinceId);
  const [productId, setProductId] = useState(initialProduct?.id ?? '');
  const [facilityTypeId, setFacilityTypeId] = useState(initialFacility?.id ?? '');
  const [quantityInput, setQuantityInput] = useState('100');
  const [priceInput, setPriceInput] = useState(String(initialProduct?.basePrice ?? 1));
  const [durationInput, setDurationInput] = useState('30');
  const [startDelayInput, setStartDelayInput] = useState('0');
  const [principalInput, setPrincipalInput] = useState('1000');
  const [interestInput, setInterestInput] = useState('5');
  const [loanDays, setLoanDays] = useState(1);
  const [collateralInput, setCollateralInput] = useState('1');
  const [rentInput, setRentInput] = useState('100');
  const [leaseDays, setLeaseDays] = useState(1 / 8);
  const [leasePeriodsInput, setLeasePeriodsInput] = useState('12');
  const [firstPeriodDays, setFirstPeriodDays] = useState(0);

  useEffect(() => {
    if (!initial) return;
    setProvinceId(initial.provinceId || model.selectedProvinceId);
    if (initial.kind === 'supply') {
      setType(initial.isSupplier ? 'supply' : initial.isBuyer ? 'purchase' : initial.publisherRole === 'supplier' ? 'supply' : 'purchase'); setProductId(initial.productId); setQuantityInput(String(initial.dailyMaxQuantity ?? initial.quantityPerDelivery)); setPriceInput(String(initial.unitPrice)); setDurationInput(initial.durationDays === null ? '' : String(initial.durationDays ?? 30)); setStartDelayInput(String(initial.startDelayDays ?? 0));
    } else if (initial.kind === 'loan') {
      setType(initial.isLender ? 'lend' : initial.isBorrower ? 'borrow' : initial.publisherSide === 'lender' ? 'lend' : 'borrow'); setPrincipalInput(String(initial.principal || 1000)); setInterestInput(String(Number(initial.interestRateBps || 500) / 100)); setLoanDays(initial.termDays ?? msAsDays(initial.termMs) ?? 1); setFacilityTypeId(initial.facilityTypeId || initialFacility?.id || ''); setCollateralInput(String(initial.collateralQuantity || 1));
    } else {
      setType(initial.isLessor ? 'lease-out' : initial.isLessee ? 'lease-in' : initial.publisherSide === 'lessor' ? 'lease-out' : 'lease-in'); setFacilityTypeId(initial.facilityTypeId || initialFacility?.id || ''); setQuantityInput(String(initial.quantity || 1)); setRentInput(String(initial.rentPerPeriod || 100)); setLeaseDays(initial.periodDays ?? msAsDays(initial.periodMs) ?? 1 / 8); setLeasePeriodsInput(String(initial.totalPeriods || 12)); setFirstPeriodDays(initial.firstPeriodDelayDays ?? msAsDays(initial.firstPeriodDelayMs) ?? 0);
    }
  }, [initial?.id]);

  const quantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const price = parseMoneyDraft(priceInput, { min: 0.01, max: 1_000_000 });
  const durationDays = optionalDays(durationInput);
  const startDelayDays = parseIntegerDraft(startDelayInput, { min: 0, max: 365 });
  const principal = parseMoneyDraft(principalInput, { min: 0.01, max: 1_000_000 });
  const interest = parseMoneyDraft(interestInput, { min: 1, max: 20 });
  const collateral = parseIntegerDraft(collateralInput, { min: 1, max: 1_000_000 });
  const rent = parseMoneyDraft(rentInput, { min: 0.01, max: 1_000_000 });
  const leasePeriods = parseIntegerDraft(leasePeriodsInput, { min: 2, max: 100 });
  const isSupply = type === 'supply' || type === 'purchase';
  const isLoan = type === 'lend' || type === 'borrow';
  const canSubmit = isSupply ? Boolean(productId && quantity !== null && price !== null && durationDays !== undefined && startDelayDays !== null) : isLoan ? Boolean(facilityTypeId && principal !== null && interest !== null && collateral !== null) : Boolean(facilityTypeId && quantity !== null && rent !== null && leasePeriods !== null);

  const submit = () => {
    let input: CreateProductionContractInput;
    if (isSupply) {
      if (quantity === null || price === null || durationDays === undefined || startDelayDays === null) return;
      input = { kind: 'supply', publisherRole: type === 'supply' ? 'supplier' : 'buyer', provinceId, productId, dailyMaxQuantity: quantity, unitPrice: price, durationDays, startDelayDays };
    } else if (isLoan) {
      if (principal === null || interest === null || collateral === null) return;
      input = { kind: 'loan', publisherSide: type === 'lend' ? 'lender' : 'borrower', provinceId, principal, interestRateBps: Math.round(interest * 100), termDays: loanDays, facilityTypeId, collateralQuantity: collateral };
    } else {
      if (quantity === null || rent === null || leasePeriods === null) return;
      input = { kind: 'facility_lease', publisherSide: type === 'lease-out' ? 'lessor' : 'lessee', provinceId, facilityTypeId, quantity, rentPerPeriod: rent, periodDays: leaseDays, totalPeriods: leasePeriods, firstPeriodDelayDays: firstPeriodDays };
    }
    void run('publish', () => productionContractActions.create(input));
  };

  return (
    <PagePanel className="contract-publish-panel">
      <WidgetHeading title="发布合同" action={<Button variant="text" onClick={close}>关闭</Button>} />
      <div className="contract-type-grid" role="group" aria-label="合同类型">{PUBLISH_TYPES.map(([value, label, description]) => <Button key={value} variant="text" className={type === value ? 'contract-type-option active' : 'contract-type-option'} aria-pressed={type === value} onClick={() => setType(value)}><strong>{label}</strong><span>{description}</span></Button>)}</div>
      <div className="contract-publish-layout"><div className="contract-publish-form"><div className="contract-publish-grid">
        <SelectInput label="合同地区" value={provinceId} onChange={(event) => setProvinceId(event.target.value)}>{model.game.provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</SelectInput>
        {isSupply ? <>
          <SelectInput label="合同商品" value={productId} onChange={(event) => { const id = event.target.value; setProductId(id); setPriceInput(String(model.game.products.find((product) => product.id === id)?.basePrice ?? 1)); }}>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput>
          <IntegerInput label="每日最大供应量" value={quantityInput} fallbackValue={100} min={1} max={1_000_000} error={quantity === null ? '请输入有效整数。' : undefined} onValueChange={setQuantityInput} />
          <MoneyInput label="固定价格" value={priceInput} fallbackValue={1} min={0.01} max={1_000_000} error={price === null ? '请输入有效金额。' : undefined} onValueChange={setPriceInput} />
          <IntegerInput label="合同时间（天，可选）" description="留空表示长期合同。" value={durationInput} fallbackValue={30} allowEmpty min={1} max={3650} error={durationDays === undefined ? '请输入 1～3650 天或留空。' : undefined} onValueChange={setDurationInput} />
          <IntegerInput label="开始延迟（天）" value={startDelayInput} fallbackValue={0} min={0} max={365} error={startDelayDays === null ? '请输入 0～365 天。' : undefined} onValueChange={setStartDelayInput} />
        </> : null}
        {isLoan ? <>
          <MoneyInput label="贷款本金" value={principalInput} fallbackValue={1000} min={0.01} max={1_000_000} error={principal === null ? '请输入有效本金。' : undefined} onValueChange={setPrincipalInput} />
          <MoneyInput label="固定总利率（%）" value={interestInput} fallbackValue={5} min={1} max={20} error={interest === null ? '请输入 1～20。' : undefined} onValueChange={setInterestInput} />
          <SelectInput label="贷款期限（天）" value={loanDays} onChange={(event) => setLoanDays(Number.parseFloat(event.target.value))}>{LOAN_DAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>
          <SelectInput label="冻结工厂" value={facilityTypeId} onChange={(event) => setFacilityTypeId(event.target.value)}>{model.game.facilityTypes.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</SelectInput>
          <IntegerInput label="冻结数量" value={collateralInput} fallbackValue={1} min={1} max={1_000_000} error={collateral === null ? '请输入有效数量。' : undefined} onValueChange={setCollateralInput} />
        </> : null}
        {!isSupply && !isLoan ? <>
          <SelectInput label="租赁工厂" value={facilityTypeId} onChange={(event) => setFacilityTypeId(event.target.value)}>{model.game.facilityTypes.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</SelectInput>
          <IntegerInput label="工厂数量" value={quantityInput} fallbackValue={1} min={1} max={1_000_000} error={quantity === null ? '请输入有效数量。' : undefined} onValueChange={setQuantityInput} />
          <MoneyInput label="每期租金" value={rentInput} fallbackValue={100} min={0.01} max={1_000_000} error={rent === null ? '请输入有效租金。' : undefined} onValueChange={setRentInput} />
          <SelectInput label="租金周期（天）" value={leaseDays} onChange={(event) => setLeaseDays(Number.parseFloat(event.target.value))}>{LEASE_DAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>
          <IntegerInput label="总租期（期）" value={leasePeriodsInput} fallbackValue={12} min={2} max={100} error={leasePeriods === null ? '请输入 2～100。' : undefined} onValueChange={setLeasePeriodsInput} />
          <SelectInput label="首次生效（天）" value={firstPeriodDays} onChange={(event) => setFirstPeriodDays(Number.parseFloat(event.target.value))}>{FIRST_DAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>
        </> : null}
      </div><div className="contract-card-actions"><Button disabled={busy || !canSubmit} onClick={submit}>发布合同</Button></div></div>
      <aside className="contract-publish-preview" aria-label="合同预览"><h3>{PUBLISH_TYPES.find(([value]) => value === type)?.[1]}</h3>{isSupply ? <><p>固定价供应，不随市场变化；每日最多使用 {quantity ?? 0} 件。</p><p>{durationDays === null ? '长期合同' : `合同 ${durationDays ?? 0} 天`} · 延迟 {startDelayDays ?? 0} 天</p></> : <p>所有时间参数统一以天表达。</p>}</aside></div>
    </PagePanel>
  );
}

function HistoryRow({
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
              <DataRow label="冻结工厂" value={facilityName} />
              <DataRow label="冻结数量" value={<CompactNumber value={contract.collateralQuantity || 0} />} />
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
              {settlement.collateralReceivedByMe > 0 ? <DataRow label="我获得冻结工厂" value={`${formatNumber(settlement.collateralReceivedByMe)} 个`} /> : null}
              {settlement.collateralReturnedToMe > 0 ? <DataRow label="退回我的冻结工厂" value={`${formatNumber(settlement.collateralReturnedToMe)} 个`} /> : null}
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

export function ContractWorkspacePage({ model }: { model: TutorialAwareGameViewModel }) {
  const state = productionContractStateFromGame(model.game);
  const intent = useMemo(() => consumeContractMarketIntent(), []);
  const [workspaceView, setWorkspaceView] = useState<ContractWorkspaceView>(intent?.productId ? 'market' : 'workbench');
  const [showPublish, setShowPublish] = useState(false);
  const [republish, setRepublish] = useState<ContractAuditHistoryItem | null>(null);
  const [busyKey, setBusyKey] = useState('');
  const [marketKind, setMarketKind] = useState<ContractKind | ''>(intent?.productId ? 'supply' : '');
  const [marketDirection, setMarketDirection] = useState<'' | 'purchase' | 'supply'>(intent?.direction ?? '');
  const [marketProductId, setMarketProductId] = useState(intent?.productId ?? '');
  const [marketProvinceId, setMarketProvinceId] = useState(intent?.provinceId ?? model.selectedProvinceId);
  const [selectedOpenContractId, setSelectedOpenContractId] = useState('');
  const [selectedActiveContractId, setSelectedActiveContractId] = useState('');
  const [historyItems, setHistoryItems] = useState<ContractAuditHistoryItem[]>([]);
  const [historyStatus, setHistoryStatus] = useState<ProductionContractStatus | ''>('');
  const [historyKind, setHistoryKind] = useState<ContractKind | ''>('');
  const [historyRole, setHistoryRole] = useState<HistoryRole>('any');
  const [historyProductId, setHistoryProductId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [contractPerformance, setContractPerformance] = useState<ContractPerformanceSummary | null>(null);
  const [contractPerformanceError, setContractPerformanceError] = useState('');

  const products = new Map(model.game.products.map((product) => [product.id, product.name]));
  const facilities = new Map(model.game.facilityTypes.map((facility) => [facility.id, facility.name]));
  const provinces = new Map(model.game.provinces.map((province) => [province.id, province.name]));
  const labelFor = (contract: ProductionContract) => {
    const province = contract.provinceId ? provinces.get(contract.provinceId) : null;
    const asset = contract.kind === 'supply' ? products.get(contract.productId) || contract.productId : contract.kind === 'loan' ? facilities.get(contract.facilityTypeId || '') || '工厂冻结' : facilities.get(contract.facilityTypeId || '') || '工厂租赁';
    return `${province ? `${province} · ` : ''}${asset} · ${kindName(contract)}`;
  };
  const activeContracts = state.productionContracts.filter((contract) => contract.status === 'active' && (contract.isParticipant || contract.isBuyer || contract.isSupplier || contract.isLender || contract.isBorrower || contract.isLessor || contract.isLessee)).sort((a, b) => Number(isConfirmedDefault(b)) - Number(isConfirmedDefault(a)) || Number(contractNeedsAttention(b)) - Number(contractNeedsAttention(a)) || Number(a.nextDueAt || Infinity) - Number(b.nextDueAt || Infinity));
  const pendingContracts = activeContracts.filter(contractNeedsAttention);
  const allOpen = state.productionContracts.filter((contract) => contract.status === 'open');
  const openContracts = allOpen.filter((contract) => (
    (!marketKind || contract.kind === marketKind)
    && (!marketProductId || contract.productId === marketProductId)
    && (!marketProvinceId || !contract.provinceId || contract.provinceId === marketProvinceId)
    && (!marketDirection || contract.kind !== 'supply' || (marketDirection === 'purchase' ? contract.publisherRole === 'supplier' : contract.publisherRole === 'buyer'))
  ));
  const selectedOpenContract = openContracts.find((contract) => contract.id === selectedOpenContractId) ?? openContracts[0] ?? null;
  const preferredActiveContracts = pendingContracts.length ? pendingContracts : activeContracts;
  const selectedActiveContract = activeContracts.find((contract) => contract.id === selectedActiveContractId) ?? preferredActiveContracts[0] ?? null;

  const run: RunAction = async (key, operation) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      const response = await operation(); model.notify(response.result.message);
      if (response.result.ok) { void model.refresh({ mode: 'authoritative' }); if (key === 'publish') { setShowPublish(false); setRepublish(null); } }
    } catch (reason) { model.notify(reason instanceof Error ? reason.message : '合同操作失败'); }
    finally { setBusyKey(''); }
  };

  useEffect(() => {
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
    status: historyStatus, kind: historyKind, role: historyRole, productId: historyProductId || undefined,
    from: historyFrom ? new Date(`${historyFrom}T00:00:00`).getTime() : null,
    to: historyTo ? new Date(`${historyTo}T23:59:59.999`).getTime() : null,
  }), [historyStatus, historyKind, historyRole, historyProductId, historyFrom, historyTo]);
  useEffect(() => {
    if (workspaceView !== 'history') return;
    let cancelled = false; setHistoryLoading(true); setHistoryError('');
    void productionContractAudit.history(historyQuery).then((page) => { if (!cancelled) { setHistoryItems(page.items); setHistoryNextCursor(page.nextCursor); } }).catch((reason) => { if (!cancelled) setHistoryError(reason instanceof Error ? reason.message : '合同历史读取失败'); }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [workspaceView, historyQuery]);

  const contractListItem = (contract: ProductionContract, selected: boolean, onSelect: () => void) => (
    <Button key={contract.id} variant="text" className={`contract-master-list-item${selected ? ' active' : ''}${contractNeedsAttention(contract) ? ' attention' : ''}`} aria-pressed={selected} onClick={onSelect}>
      <span className="contract-master-list-copy"><strong>{labelFor(contract)}</strong><small>{roleTag(contract)}{contract.kind === 'supply' ? ` · 固定价 ${formatCurrency(contract.unitPrice)}` : ''}</small></span>
      <StatusTag tone={statusTone(contract)}>{contractNeedsAttention(contract) ? '待处理' : STATUS_LABELS[contract.status]}</StatusTag>
    </Button>
  );

  return (
    <PageLayout title="合同">
      <div className="contract-content-actions"><Button onClick={() => { setRepublish(null); setShowPublish((value) => !value); }}>{showPublish ? '收起发布表单' : '发布合同'}</Button></div>
      <div className="contract-summary-grid">
        <MetricCard label="等待我处理" value={<CompactNumber value={state.productionContractSummary.needsAttention} />} detail="议价、资金、商品或合同边界" tone={state.productionContractSummary.needsAttention ? 'warning' : 'success'} />
        <MetricCard label="24 小时内履约" value={<CompactNumber value={state.productionContractSummary.upcomingWithin24Hours} />} detail="自然日、到期或租期边界" />
        <MetricCard label="进行中的合同" value={<CompactNumber value={state.productionContractSummary.active} />} detail="供货、借贷或租赁" tone="info" />
        <MetricCard label="我的公开合同" value={<CompactNumber value={state.productionContractSummary.open} />} detail="尚未承接" />
      </div>
      {showPublish ? <PublishPanel key={republish?.id || 'new'} model={model} busy={Boolean(busyKey)} close={() => { setShowPublish(false); setRepublish(null); }} run={run} initial={republish} /> : null}
      <nav className="ui-segmented contract-workspace-tabs" role="tablist" aria-label="合同工作区">
        <Button variant="text" role="tab" aria-selected={workspaceView === 'workbench'} className={workspaceView === 'workbench' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setWorkspaceView('workbench')}>工作台 {pendingContracts.length ? <span className="contract-tab-attention-count">{pendingContracts.length}</span> : null}</Button>
        <Button variant="text" role="tab" aria-selected={workspaceView === 'market'} className={workspaceView === 'market' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setWorkspaceView('market')}>合同市场 <span className="contract-tab-count">{allOpen.length}</span></Button>
        <Button variant="text" role="tab" aria-selected={workspaceView === 'active'} className={workspaceView === 'active' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setWorkspaceView('active')}>我的合同 <span className="contract-tab-count">{activeContracts.length}</span></Button>
        <Button variant="text" role="tab" aria-selected={workspaceView === 'history'} className={workspaceView === 'history' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setWorkspaceView('history')}>历史</Button>
      </nav>

      {workspaceView === 'workbench' ? <>
        <section className="contract-workspace-pane contract-workbench" aria-label="合同工作台" role="tabpanel" tabIndex={0}>
          <header className="contract-pane-heading"><div><h2>今日合同工作台</h2><p>优先处理会阻塞供应链、资金或合同边界的事项，再查看下一份即将履约的合同。</p></div><StatusTag tone={pendingContracts.length ? 'warning' : 'success'}>{pendingContracts.length ? `${pendingContracts.length} 项待处理` : '当前正常'}</StatusTag></header>
          <div className="contract-master-detail">
            <div className="contract-master-list" aria-label="待处理与近期合同">{preferredActiveContracts.length ? preferredActiveContracts.map((contract) => contractListItem(contract, selectedActiveContract?.id === contract.id, () => setSelectedActiveContractId(contract.id))) : <EmptyState>当前没有进行中的合同。</EmptyState>}</div>
            <div className="contract-master-detail-panel">{selectedActiveContract ? <ActiveContractCard contract={selectedActiveContract} label={labelFor(selectedActiveContract)} busy={Boolean(busyKey)} run={run} /> : <EmptyState>签订合同后，这里会显示下一项需要处理的履约关系。</EmptyState>}</div>
          </div>
        </section>
        <ContractPerformancePanel performance={contractPerformance} error={contractPerformanceError} />
      </> : null}

      {workspaceView === 'market' ? <section className="contract-workspace-pane contract-market-pane" aria-label="合同市场" role="tabpanel" tabIndex={0}>
        <header className="contract-pane-heading"><div><h2>合同市场</h2><p>先筛选合作方向，再在左侧比较公开合同，右侧查看完整条款、议价并承接。</p></div><StatusTag>{openContracts.length} / {allOpen.length} 个公开合同</StatusTag></header>
        <div className="contract-market-filters">
          <SelectInput label="合同领域" value={marketKind} onChange={(event) => setMarketKind(event.target.value as ContractKind | '')}><option value="">全部领域</option><option value="supply">商品合作</option><option value="loan">资金借贷</option><option value="facility_lease">工厂租赁</option></SelectInput>
          <SelectInput label="合作方向" value={marketDirection} onChange={(event) => { setMarketDirection(event.target.value as '' | 'purchase' | 'supply'); if (event.target.value) setMarketKind('supply'); }}><option value="">全部方向</option><option value="purchase">我要采购</option><option value="supply">我要供货</option></SelectInput>
          <SelectInput label="地区" value={marketProvinceId} onChange={(event) => setMarketProvinceId(event.target.value)}><option value="">全部地区</option>{model.game.provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</SelectInput>
          <SelectInput label="商品" value={marketProductId} onChange={(event) => { setMarketProductId(event.target.value); if (event.target.value) setMarketKind('supply'); }}><option value="">全部商品</option>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput>
        </div>
        <div className="contract-master-detail contract-market-master-detail">
          <div className="contract-master-list" aria-label="公开合同列表">{openContracts.length ? openContracts.map((contract) => contractListItem(contract, selectedOpenContract?.id === contract.id, () => setSelectedOpenContractId(contract.id))) : <EmptyState>当前没有符合筛选条件的公开合同。</EmptyState>}</div>
          <div className="contract-master-detail-panel">{selectedOpenContract ? <OpenContractCard contract={selectedOpenContract} label={labelFor(selectedOpenContract)} busy={Boolean(busyKey)} run={run} /> : <EmptyState>选择公开合同后查看完整条款。</EmptyState>}</div>
        </div>
      </section> : null}

      {workspaceView === 'active' ? <section className="contract-workspace-pane contract-personal-pane" aria-label="我的合同" role="tabpanel" tabIndex={0}>
        <header className="contract-pane-heading"><div><h2>我的合同</h2><p>待处理合同优先排序；选择一份合同后在右侧完成履约、自动化和结束操作。</p></div><StatusTag>{activeContracts.length} 份进行中</StatusTag></header>
        <div className="contract-master-detail">
          <div className="contract-master-list" aria-label="进行中的合同列表">{activeContracts.length ? activeContracts.map((contract) => contractListItem(contract, selectedActiveContract?.id === contract.id, () => setSelectedActiveContractId(contract.id))) : <EmptyState>当前没有进行中的合同。</EmptyState>}</div>
          <div className="contract-master-detail-panel">{selectedActiveContract ? <ActiveContractCard contract={selectedActiveContract} label={labelFor(selectedActiveContract)} busy={Boolean(busyKey)} run={run} /> : <EmptyState>当前没有进行中的合同。</EmptyState>}</div>
        </div>
      </section> : null}

      {workspaceView === 'history' ? <section className="contract-workspace-pane contract-history-workspace" aria-label="历史合同" role="tabpanel" tabIndex={0}>
        <header className="contract-pane-heading"><div><h2>历史合同</h2><p>按真实结束事实筛选历史合同，可重新拟定但不会复制旧合同的运行状态。</p></div></header>
        <PagePanel className="contract-history-panel">
          <div className="contract-history-filters">
            <SelectInput label="合同领域" value={historyKind} onChange={(event) => setHistoryKind(event.target.value as ContractKind | '')}><option value="">全部领域</option><option value="supply">商品合作</option><option value="loan">资金借贷</option><option value="facility_lease">工厂租赁</option></SelectInput>
            <SelectInput label="最终状态" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value as ProductionContractStatus | '')}><option value="">全部状态</option><option value="completed">已完成</option><option value="terminated">已终止</option><option value="cancelled">已取消</option><option value="expired">已过期</option></SelectInput>
            <SelectInput label="我的角色" value={historyRole} onChange={(event) => setHistoryRole(event.target.value as HistoryRole)}><option value="any">全部角色</option><option value="buyer">我采购</option><option value="supplier">我供货</option><option value="lender">我放贷</option><option value="borrower">我贷款</option><option value="lessor">我出租</option><option value="lessee">我租赁</option><option value="publisher">我发布</option></SelectInput>
            <SelectInput label="合同标的" value={historyProductId} onChange={(event) => setHistoryProductId(event.target.value)}><option value="">全部标的</option><option value="credits">普通货币</option>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}{model.game.facilityTypes.map((facility) => <option key={`facility:${facility.id}`} value={`facility:${facility.id}`}>{facility.name}</option>)}</SelectInput>
            <TextInput label="开始日期" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} /><TextInput label="结束日期" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
          </div>
          {historyError ? <p className="contract-issue">{historyError}</p> : null}{historyLoading && !historyItems.length ? <p>正在读取权威合同历史…</p> : null}{!historyLoading && !historyItems.length && !historyError ? <EmptyState>当前没有符合筛选条件的已结束合同。</EmptyState> : null}
          {historyItems.map((contract) => <HistoryRow key={contract.id} contract={contract} label={labelFor(contract)} productName={products.get(contract.productId) || contract.productId} facilityName={facilities.get(contract.facilityTypeId || '') || contract.facilityTypeId || '—'} provinceName={contract.provinceId ? provinces.get(contract.provinceId) || contract.provinceId : '—'} republish={() => startRepublish(contract)} />)}
          {historyNextCursor ? <Button variant="text" disabled={historyLoading} onClick={() => { setHistoryLoading(true); void productionContractAudit.history({ ...historyQuery, cursor: historyNextCursor }).then((page) => { setHistoryItems((current) => [...current, ...page.items]); setHistoryNextCursor(page.nextCursor); }).finally(() => setHistoryLoading(false)); }}>加载更多合同历史</Button> : null}
        </PagePanel>
      </section> : null}
    </PageLayout>
  );
}
