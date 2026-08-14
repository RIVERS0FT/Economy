import { useEffect, useMemo, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, MoneyInput, SelectInput, TextInput } from '../components/ui/FormControls';
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
  type RenewProductionContractInput,
} from '../contracts/api';
import {
  productionContractStateFromGame,
  type ContractAuditHistoryItem,
  type ContractKind,
  type ContractPerformanceSummary,
  type ProductionContract,
  type ProductionContractStatus,
} from '../contracts/types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import { ContractNegotiationSection } from '../contracts/ContractNegotiationSection';
import { consumeContractMarketIntent } from '../contracts/navigation';
import '../styles/contract-audit.css';
import '../styles/contract-negotiation.css';
import '../styles/contract-commercial.css';

const INTERVAL_OPTIONS = [
  [10 * 60 * 1000, '每 10 分钟'],
  [30 * 60 * 1000, '每 30 分钟'],
  [60 * 60 * 1000, '每 1 小时'],
  [3 * 60 * 60 * 1000, '每 3 小时'],
  [6 * 60 * 60 * 1000, '每 6 小时'],
  [12 * 60 * 60 * 1000, '每 12 小时'],
  [24 * 60 * 60 * 1000, '每天'],
] as const;

const FIRST_DELAY_OPTIONS = [
  [0, '签订后立即进入首批交付'],
  [10 * 60 * 1000, '签订后 10 分钟'],
  [30 * 60 * 1000, '签订后 30 分钟'],
  [60 * 60 * 1000, '签订后 1 小时'],
  [3 * 60 * 60 * 1000, '签订后 3 小时'],
  [6 * 60 * 60 * 1000, '签订后 6 小时'],
  [12 * 60 * 60 * 1000, '签订后 12 小时'],
  [24 * 60 * 60 * 1000, '签订后 24 小时'],
] as const;

type PersonalContractView = 'active' | 'history';
type HistoryRole = 'any' | 'publisher' | 'buyer' | 'supplier' | 'lender' | 'borrower' | 'lessor' | 'lessee';

const STATUS_LABELS: Record<ProductionContractStatus, string> = {
  open: '等待承接',
  active: '履约中',
  completed: '已完成',
  cancelled: '已取消',
  terminated: '已终止',
  expired: '已过期',
};

const END_REASON_LABELS: Record<string, string> = {
  completed: '正常完成',
  publisher_cancelled: '发布者取消',
  offer_expired: '等待承接超时',
  termination_requested: '按申请完成当前批次后结束',
  immediate_by_participant: '参与方主动违约终止',
  buyer_default: '采购方违约',
  supplier_default: '供应方违约',
  both_default: '双方违约',
  borrower_default: '借款方违约',
  lessee_default: '承租方违约',
  participant_missing: '参与者状态异常',
  missing_from_world: '合同数据异常结束',
  unknown: '结束原因待核查',
};

function durationLabel(milliseconds: number) {
  const option = INTERVAL_OPTIONS.find(([value]) => value === milliseconds);
  if (option) return option[1];
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  return minutes < 60 ? `每 ${minutes} 分钟` : `每 ${Math.round(minutes / 60)} 小时`;
}

function parseOptionalDeliveriesDraft(value: string): number | null | undefined {
  if (value.trim() === '') return null;
  return parseIntegerDraft(value, { min: 2, max: 100 }) ?? undefined;
}

function deliveryCountLabel(value: number | null) {
  return value === null ? '长期' : `${formatNumber(value)} 批`;
}

function dateTimeLabel(timestamp?: number | null) {
  if (!timestamp) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
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

function statusTone(contract: Pick<ProductionContract, 'status' | 'terminationReason'> & Partial<Pick<ProductionContract, 'graceEndsAt' | 'issue' | 'breachedAt'>>) {
  if (contract.status === 'completed') return 'success' as const;
  if (contract.status === 'terminated' || isConfirmedDefault(contract)) return 'danger' as const;
  if (contract.status !== 'active') return 'neutral' as const;
  if (contract.graceEndsAt) return 'danger' as const;
  if (contract.issue) return 'warning' as const;
  return 'success' as const;
}

function contractNeedsAttention(contract: ProductionContract) {
  return Boolean(
    isConfirmedDefault(contract)
    || contract.graceEndsAt
    || contract.issue
    || contract.terminationRequestedBy
    || contract.renewalProposal?.awaitingMyApproval,
  );
}

function contractTitle(contract: Pick<ProductionContract, 'kind' | 'publisherSide' | 'publisherRole' | 'productId'>, productName: string) {
  if (contract.kind === 'loan') return `${contract.publisherSide === 'lender' ? '放贷' : '贷款'}合同 · ${productName}`;
  if (contract.kind === 'facility_lease') return `${contract.publisherSide === 'lessor' ? '出租' : '租赁'}合同 · ${productName}`;
  return `${productName}${contract.publisherRole === 'supplier' ? '供应' : '采购'}合同`;
}

function RoleTag({ contract }: { contract: ProductionContract }) {
  if (contract.publisherType === 'market_reserve') return <StatusTag tone="info">市场储备采购</StatusTag>;
  if (contract.kind === 'loan') {
    if (contract.isLender) return <StatusTag tone="success">我放贷</StatusTag>;
    if (contract.isBorrower) return <StatusTag tone="info">我贷款</StatusTag>;
    return <StatusTag>{contract.publisherSide === 'lender' ? '放贷报价' : '贷款需求'}</StatusTag>;
  }
  if (contract.kind === 'facility_lease') {
    if (contract.isLessor) return <StatusTag tone="success">我出租</StatusTag>;
    if (contract.isLessee) return <StatusTag tone="info">我租赁</StatusTag>;
    return <StatusTag>{contract.publisherSide === 'lessor' ? '出租报价' : '租赁需求'}</StatusTag>;
  }
  if (contract.isBuyer) return <StatusTag tone="info">我采购</StatusTag>;
  if (contract.isSupplier) return <StatusTag tone="success">我供货</StatusTag>;
  return <StatusTag>{contract.publisherRole === 'buyer' ? '采购需求' : '供应报价'}</StatusTag>;
}

function ContractProgress({ contract }: { contract: ProductionContract }) {
  if (contract.totalDeliveries === null) {
    return (
      <div className="contract-progress" aria-label={`长期合同，已履约 ${contract.completedDeliveries} 批`}>
        <strong>长期合同 · 已履约 {formatNumber(contract.completedDeliveries)} 批</strong>
      </div>
    );
  }
  const percentage = Math.min(
    100,
    Math.round(contract.completedDeliveries / Math.max(1, contract.totalDeliveries) * 100),
  );
  return (
    <div className="contract-progress" aria-label={`已完成 ${contract.completedDeliveries} / ${contract.totalDeliveries} 批`}>
      <div className="contract-progress-track"><span style={{ width: `${percentage}%` }} /></div>
      <strong>{formatNumber(contract.completedDeliveries)} / {formatNumber(contract.totalDeliveries)} 批</strong>
    </div>
  );
}

function ReadinessMeter({
  label,
  current,
  target,
  currency = false,
}: {
  label: string;
  current: number;
  target: number;
  currency?: boolean;
}) {
  const ready = current >= target;
  const percentage = Math.min(100, Math.round(current / Math.max(1, target) * 100));
  return (
    <div className="contract-readiness-meter" data-ready={ready ? 'true' : 'false'}>
      <div>
        <span>{label}</span>
        <strong>
          {currency ? (
            <><CurrencyAmount>{formatCurrency(current)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(target)}</CurrencyAmount></>
          ) : `${formatNumber(current)} / ${formatNumber(target)}`}
        </strong>
      </div>
      <div className="contract-readiness-track" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div>
    </div>
  );
}

interface ContractCardProps {
  contract: ProductionContract;
  productName: string;
  busy: boolean;
  run: (key: string, operation: () => Promise<{ result: { ok: boolean; message: string } }>) => Promise<void>;
}


function ContractRenewalSection({ contract, busy, run }: ContractCardProps) {
  if (contract.fixedTerms || contract.totalDeliveries === null) return null;
  const proposal = contract.renewalProposal;
  const remaining = Math.max(0, contract.totalDeliveries - contract.completedDeliveries);
  const eligible = !proposal
    && remaining >= 1
    && remaining <= 3
    && !contract.graceEndsAt
    && !isConfirmedDefault(contract)
    && !contract.terminationRequestedBy;
  const [editing, setEditing] = useState(false);
  const [quantityInput, setQuantityInput] = useState(String(contract.quantityPerDelivery));
  const [unitPriceInput, setUnitPriceInput] = useState(String(contract.unitPrice));
  const [deliveriesInput, setDeliveriesInput] = useState(String(contract.totalDeliveries));
  const [interval, setInterval] = useState(contract.deliveryIntervalMs);
  const [firstDelay, setFirstDelay] = useState(contract.firstDeliveryDelayMs);
  const quantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const unitPrice = parseMoneyDraft(unitPriceInput, { min: 0.01, max: 1_000_000 });
  const deliveries = parseOptionalDeliveriesDraft(deliveriesInput);

  if (proposal) {
    const terms = proposal.terms;
    const approvedCount = Number(Boolean(proposal.buyerApproved)) + Number(Boolean(proposal.supplierApproved));
    const pendingText = proposal.approvedByMe ? '你已同意，等待合作方确认' : '等待你确认续签条款';
    return (
      <section className="contract-renewal-panel" aria-label="合同续签">
        <div className="contract-renewal-heading">
          <div>
            <strong>合同续签</strong>
            <span>{proposal.status === 'proposed' ? pendingText : proposal.status === 'accepted' ? '双方已同意，当前合同完成后生效' : '后续合同已经生效'}</span>
          </div>
          <StatusTag tone={proposal.status === 'accepted' || proposal.status === 'activated' ? 'success' : 'info'}>
            {proposal.status === 'proposed' ? `${approvedCount}/2 已同意` : proposal.status === 'accepted' ? '已锁定' : '已生效'}
          </StatusTag>
        </div>
        <DataList className="compact contract-renewal-summary">
          <DataRow label="每批数量" value={formatNumber(terms.quantityPerDelivery)} />
          <DataRow label="单位价格" value={<CurrencyAmount>{formatCurrency(terms.unitPrice)}</CurrencyAmount>} />
          <DataRow label="交付周期" value={durationLabel(terms.deliveryIntervalMs)} />
          <DataRow label="总批次" value={deliveryCountLabel(terms.totalDeliveries)} />
          <DataRow label="采购方确认" value={<StatusTag tone={proposal.buyerApproved ? 'success' : 'neutral'}>{proposal.buyerApproved ? '已同意' : '待确认'}</StatusTag>} />
          <DataRow label="供应方确认" value={<StatusTag tone={proposal.supplierApproved ? 'success' : 'neutral'}>{proposal.supplierApproved ? '已同意' : '待确认'}</StatusTag>} />
        </DataList>
        {proposal.status === 'proposed' ? (
          <div className="contract-renewal-actions">
            {proposal.approvedByMe ? (
              <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-revoke`, () => productionContractActions.revokeRenewal(contract.id))}>撤销同意</Button>
            ) : (
              <Button disabled={busy} onClick={() => void run(`${contract.id}:renewal-accept`, () => productionContractActions.acceptRenewal(contract.id))}>同意续签</Button>
            )}
            {proposal.isProposer ? (
              <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-cancel`, () => productionContractActions.rejectRenewal(contract.id))}>取消续签提议</Button>
            ) : !proposal.approvedByMe ? (
              <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-reject`, () => productionContractActions.rejectRenewal(contract.id))}>拒绝续签</Button>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  if (!eligible) return null;
  if (!editing) {
    return (
      <section className="contract-renewal-panel contract-renewal-panel--available" aria-label="合同续签">
        <div>
          <strong>继续长期合作</strong>
          <span>合同剩余 {formatNumber(remaining)} 批，可提前协商下一期条款。</span>
        </div>
        <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>提出续签</Button>
      </section>
    );
  }

  const canSubmit = quantity !== null && unitPrice !== null && deliveries !== undefined;
  const submit = () => {
    if (!canSubmit || quantity === null || unitPrice === null || deliveries === undefined) return;
    const input: RenewProductionContractInput = {
      quantityPerDelivery: quantity,
      unitPrice,
      deliveryIntervalMs: interval,
      totalDeliveries: deliveries,
      firstDeliveryDelayMs: firstDelay,
    };
    void run(`${contract.id}:renewal-propose`, () => productionContractActions.proposeRenewal(contract.id, input));
  };
  return (
    <section className="contract-renewal-panel" aria-label="续签条款">
      <div className="contract-renewal-heading">
        <div><strong>提出续签</strong><span>商品与合作方保持不变，续签将创建关联的新合同。</span></div>
        <Button variant="text" onClick={() => setEditing(false)}>取消</Button>
      </div>
      <div className="contract-renewal-form">
        <IntegerInput label="每批数量" value={quantityInput} fallbackValue={contract.quantityPerDelivery} min={1} max={1_000_000} error={quantity === null ? '请输入有效整数。' : undefined} onValueChange={setQuantityInput} />
        <MoneyInput label="单位价格" value={unitPriceInput} fallbackValue={contract.unitPrice} min={0.01} max={1_000_000} error={unitPrice === null ? '请输入有效金额；超过两位小数会向下截断。' : undefined} onValueChange={setUnitPriceInput} />
        <SelectInput label="交付周期" value={interval} onChange={(event) => setInterval(Number.parseInt(event.target.value, 10))}>
          {INTERVAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
        <IntegerInput label="总交付批次（可选）" description="留空表示长期合同。" value={deliveriesInput} fallbackValue={contract.totalDeliveries} allowEmpty min={2} max={100} error={deliveries === undefined ? '请输入 2～100 的整数，或留空设为长期合同。' : undefined} onValueChange={setDeliveriesInput} />
        <SelectInput label="首次交付" value={firstDelay} onChange={(event) => setFirstDelay(Number.parseInt(event.target.value, 10))}>
          {FIRST_DELAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
      </div>
      <div className="contract-renewal-actions">
        <Button disabled={busy || !canSubmit} onClick={submit}>发送续签提议</Button>
      </div>
    </section>
  );
}

function contractKindLabel(contract: Pick<ProductionContract, 'kind' | 'publisherSide' | 'publisherRole'>) {
  if (contract.kind === 'loan') return contract.publisherSide === 'lender' ? '放贷合同' : '贷款合同';
  if (contract.kind === 'facility_lease') return contract.publisherSide === 'lessor' ? '出租合同' : '租赁合同';
  return contract.publisherRole === 'supplier' ? '供应合同' : '采购合同';
}

function commercialCounterparty(contract: ProductionContract) {
  if (contract.kind === 'loan') return contract.isLender ? contract.borrowerName : contract.lenderName;
  if (contract.kind === 'facility_lease') return contract.isLessor ? contract.lesseeName : contract.lessorName;
  return contract.isBuyer ? contract.supplierName : contract.buyerName;
}

function CommercialOpenContractCard({ contract, productName, busy, run }: ContractCardProps) {
  const isLoan = contract.kind === 'loan';
  const rate = Number(contract.interestRateBps || 0) / 100;
  return (
    <PagePanel className="contract-card contract-offer-card contract-commercial-card">
      <header className="contract-card-heading">
        <div className="contract-card-title">
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag>{contractKindLabel(contract)}</StatusTag></div>
          <h2>{isLoan ? '玩家抵押借贷' : productName}</h2>
          <p>发布者：{contract.publisherName}</p>
        </div>
        <strong className="contract-offer-price"><CurrencyAmount>{formatCurrency(isLoan ? contract.principal || 0 : contract.rentPerPeriod || 0)}</CurrencyAmount><small>{isLoan ? ' 本金' : ' / 期'}</small></strong>
      </header>
      <div className="contract-offer-terms">
        <DataList className="compact">
          {isLoan ? <DataRow label="固定总利率" value={`${rate.toFixed(2)}%`} /> : <DataRow label="工厂数量" value={`${productName} × ${formatNumber(contract.quantity || 0)}`} />}
          {isLoan ? <DataRow label="贷款期限" value={durationLabel(contract.termMs || 0)} /> : <DataRow label="租金周期" value={durationLabel(contract.periodMs || 0)} />}
        </DataList>
        <DataList className="compact">
          <DataRow label={isLoan ? '抵押工厂' : '总租期'} value={isLoan ? `${productName} × ${formatNumber(contract.collateralQuantity || 0)}` : `${formatNumber(contract.totalPeriods || 0)} 期`} />
          <DataRow label="到期方式" value={isLoan ? '本金与利息一次结清' : '每期服务器自动结算'} />
        </DataList>
      </div>
      <p className="contract-offer-note">{isLoan ? '抵押工厂继续生产，但合同期间不得出售、拍卖、重复抵押或出租。' : '所有权仍归出租方；承租方承担生产投入并获得租赁期间产出。'}</p>
      <footer className="contract-card-actions">
        {contract.isPublisher ? (
          <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:cancel`, () => productionContractActions.cancel(contract.id))}>取消发布</Button>
        ) : (
          <Button disabled={busy} onClick={() => {
            const message = isLoan
              ? '签订后将立即放款并锁定约定抵押工厂，是否继续？'
              : '签订后将冻结首期租金和双方保证金，并转移临时生产使用权，是否继续？';
            if (window.confirm(message)) void run(`${contract.id}:accept`, () => productionContractActions.accept(contract.id));
          }}>承接并签订</Button>
        )}
      </footer>
    </PagePanel>
  );
}

function CommercialActiveContractCard({ contract, productName, busy, run }: ContractCardProps) {
  const isLoan = contract.kind === 'loan';
  const counterparty = commercialCounterparty(contract);
  const dueAt = isLoan ? contract.dueAt : contract.nextDueAt;
  const totalLoanDue = Number(contract.principalOutstanding || 0) + Number(contract.interestDue || 0);
  const confirmedDefault = isConfirmedDefault(contract);
  const canClaimDefault = canClaimConfirmedDefault(contract);
  const canFundLease = !confirmedDefault && !isLoan && contract.isLessee && Number(contract.lesseeEscrowCredits || 0) < Number(contract.rentPerPeriod || 0);
  return (
    <PagePanel className={`contract-card contract-commercial-card contract-card--${confirmedDefault || contract.graceEndsAt ? 'danger' : contract.issue ? 'attention' : 'normal'}`}>
      <header className="contract-card-heading">
        <div className="contract-card-title">
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{confirmedDefault ? '已违约 · 待解除' : contract.graceEndsAt ? '宽限期' : contractKindLabel(contract)}</StatusTag>{contract.issue ? <StatusTag tone={confirmedDefault ? 'danger' : 'warning'}>待处理</StatusTag> : null}</div>
          <h2>{isLoan ? '玩家抵押借贷' : productName}</h2>
          <p>合作方：{counterparty || '等待服务器同步'}</p>
        </div>
        <ContractProgress contract={contract} />
      </header>
      <div className="contract-detail-layout">
        <section className="contract-detail-panel contract-current-batch">
          <h3>{isLoan ? '还款状态' : '当前租期'}</h3>
          <DataList className="compact">
            <DataRow label={isLoan ? '到期应还' : '本期租金'} value={<CurrencyAmount>{formatCurrency(isLoan ? totalLoanDue : contract.rentPerPeriod || 0)}</CurrencyAmount>} />
            {!isLoan ? <DataRow label="已托管租金" value={<CurrencyAmount>{formatCurrency(contract.lesseeEscrowCredits || 0)}</CurrencyAmount>} /> : null}
            <DataRow label={isLoan ? '贷款到期' : '下次结算'} value={dateTimeLabel(dueAt)} />
            {confirmedDefault ? <DataRow label="违约确认时间" value={dateTimeLabel(contract.breachedAt)} tone="danger" /> : contract.graceEndsAt ? <DataRow label="宽限期结束" value={dateTimeLabel(contract.graceEndsAt)} tone="danger" /> : null}
          </DataList>
          {contract.issue ? <p className="contract-issue" role="status">{contract.issue}</p> : <p className="contract-ok">合同状态正常</p>}
        </section>
        <section className="contract-detail-panel">
          <h3>合同条款</h3>
          <DataList className="compact">
            {isLoan ? <DataRow label="贷款本金" value={<CurrencyAmount>{formatCurrency(contract.principal || 0)}</CurrencyAmount>} /> : <DataRow label="租赁工厂" value={`${productName} × ${formatNumber(contract.quantity || 0)}`} />}
            {isLoan ? <DataRow label="固定总利率" value={`${(Number(contract.interestRateBps || 0) / 100).toFixed(2)}%`} /> : <DataRow label="租金周期" value={durationLabel(contract.periodMs || 0)} />}
            {isLoan ? <DataRow label="抵押工厂" value={`${productName} × ${formatNumber(contract.collateralQuantity || 0)}`} /> : <DataRow label="完成租期" value={`${formatNumber(contract.completedPeriods || 0)} / ${formatNumber(contract.totalPeriods || 0)}`} />}
            <DataRow label="对方" value={counterparty || '—'} />
          </DataList>
        </section>
      </div>
      <div className="contract-fulfillment-controls">
        <div className="contract-primary-actions">
          {confirmedDefault ? (
            canClaimDefault
              ? <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:default-claim`, () => productionContractActions.terminateNow(contract.id))}>{defaultClaimLabel(contract)}</Button>
              : <StatusTag tone="danger">等待受偿方处理</StatusTag>
          ) : (
            <>
              {isLoan && contract.isBorrower ? <Button disabled={busy} onClick={() => void run(`${contract.id}:repay`, () => productionContractActions.repayLoan(contract.id))}>偿还本金和利息</Button> : null}
              {canFundLease ? <Button disabled={busy} onClick={() => void run(`${contract.id}:lease-fund`, () => productionContractActions.fundLease(contract.id))}>补充本期租金</Button> : null}
              {!((isLoan && contract.isBorrower) || canFundLease) ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '等待责任方处理' : '当前无需手动处理'}</StatusTag> : null}
            </>
          )}
        </div>
        {!confirmedDefault ? <div className="contract-automation">
          {isLoan && contract.isBorrower ? <ToggleField label="自动还款" description="到期优先使用可用资金一次性结清。" checked={contract.autoRepay !== false} disabled={busy} onChange={() => void run(`${contract.id}:auto-repay`, () => productionContractActions.setLoanAutoRepay(contract.id, contract.autoRepay === false))} /> : null}
          {!isLoan && contract.isLessee ? <ToggleField label="自动补充租金" description="每期从当前可用资金补足托管租金。" checked={contract.autoFund !== false} disabled={busy} onChange={() => void run(`${contract.id}:lease-auto-fund`, () => productionContractActions.setLeaseAutoFund(contract.id, contract.autoFund === false))} /> : null}
        </div> : null}
      </div>
      {!isLoan && !confirmedDefault ? <footer className="contract-management-actions">
        {!contract.terminationRequestedBy ? <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:notice`, () => productionContractActions.requestTermination(contract.id))}>申请本期后结束</Button> : <StatusTag tone="warning">已申请本期后结束</StatusTag>}
        <Button variant="danger" disabled={busy} onClick={() => { if (window.confirm('立即终止会由发起方承担保证金赔付，是否继续？')) void run(`${contract.id}:terminate`, () => productionContractActions.terminateNow(contract.id)); }}>立即违约终止</Button>
      </footer> : null}
    </PagePanel>
  );
}


function ActiveContractCard({ contract, productName, busy, run }: ContractCardProps) {
  if (contract.kind !== 'supply') return <CommercialActiveContractCard contract={contract} productName={productName} busy={busy} run={run} />;
  const confirmedDefault = isConfirmedDefault(contract);
  const canClaimDefault = canClaimConfirmedDefault(contract);
  const canPrepare = !confirmedDefault && contract.isSupplier && contract.supplierReservedQuantity < contract.quantityPerDelivery;
  const canFund = !confirmedDefault && contract.isBuyer && contract.buyerEscrowCredits < contract.batchGross;
  const counterparty = contract.isBuyer ? contract.supplierName : contract.buyerName;
  const statusLabel = confirmedDefault ? '已违约 · 待解除' : contract.graceEndsAt ? '宽限期' : STATUS_LABELS[contract.status];
  const needsAttention = contractNeedsAttention(contract);

  return (
    <PagePanel className={`contract-card contract-card--${confirmedDefault || contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`}>
      <header className="contract-card-heading">
        <div className="contract-card-title">
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{statusLabel}</StatusTag>{needsAttention && !contract.graceEndsAt ? <StatusTag tone={confirmedDefault ? 'danger' : 'warning'}>待处理</StatusTag> : null}</div>
          <h2><ProductIconLabel productId={contract.productId}>{contractTitle(contract, productName)}</ProductIconLabel></h2>
          <p>合作方：{counterparty || '等待服务器同步'}</p>
        </div>
        <ContractProgress contract={contract} />
      </header>

      <div className="contract-detail-layout">
        <section className="contract-detail-panel contract-current-batch" aria-label="当前批次状态">
          <h3>当前批次</h3>
          <ReadinessMeter
            label="供应方商品"
            current={contract.supplierReservedQuantity}
            target={contract.quantityPerDelivery}
          />
          <ReadinessMeter
            label="采购方货款"
            current={contract.buyerEscrowCredits}
            target={contract.batchGross}
            currency
          />
          <DataList className="compact contract-schedule-list">
            <DataRow label="下次交付" value={dateTimeLabel(contract.nextDueAt)} />
            {confirmedDefault ? <DataRow label="违约确认时间" value={dateTimeLabel(contract.breachedAt)} tone="danger" /> : contract.graceEndsAt ? <DataRow label="宽限期结束" value={dateTimeLabel(contract.graceEndsAt)} tone="danger" /> : null}
          </DataList>
          {contract.issue ? <p className="contract-issue" role="status">{contract.issue}</p> : <p className="contract-ok">本批履约条件正常</p>}
        </section>

        <section className="contract-detail-panel" aria-label="合同条款">
          <h3>合同条款</h3>
          <DataList className="compact contract-terms-list">
            <DataRow label="每批商品" value={`${productName} × ${formatNumber(contract.quantityPerDelivery)}`} />
            <DataRow label="合同单价" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
            <DataRow label="每批货款" value={<CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount>} />
            <DataRow label="交付周期" value={durationLabel(contract.deliveryIntervalMs)} />
          </DataList>
        </section>
      </div>

      <div className="contract-fulfillment-controls">
        <div className="contract-primary-actions">
          {confirmedDefault ? (
            canClaimDefault
              ? <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:default-claim`, () => productionContractActions.terminateNow(contract.id))}>{defaultClaimLabel(contract)}</Button>
              : <StatusTag tone="danger">等待受偿方处理</StatusTag>
          ) : (
            <>
              {canPrepare ? <Button disabled={busy} onClick={() => void run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>准备本批商品</Button> : null}
              {canFund ? <Button disabled={busy} onClick={() => void run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>补充本批货款</Button> : null}
              {!canPrepare && !canFund ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '请先处理上方异常' : '当前无需手动处理'}</StatusTag> : null}
            </>
          )}
        </div>
        {!confirmedDefault ? <div className="contract-automation">
          {contract.isSupplier ? (
            <ToggleField
              label="自动准备商品"
              description="每批自动冻结当前可用库存，不透支未来产量。"
              checked={contract.supplierAutoReserve}
              disabled={busy}
              onChange={() => void run(`${contract.id}:auto-reserve`, () => productionContractActions.setAutoReserve(contract.id, !contract.supplierAutoReserve))}
            />
          ) : null}
          {contract.isBuyer ? (
            <ToggleField
              label="自动补充货款"
              description="每批自动冻结当前可用资金，不透支未来收入。"
              checked={contract.buyerAutoFund}
              disabled={busy}
              onChange={() => void run(`${contract.id}:auto-fund`, () => productionContractActions.setAutoFund(contract.id, !contract.buyerAutoFund))}
            />
          ) : null}
        </div> : null}
      </div>

      <ContractRenewalSection contract={contract} productName={productName} busy={busy} run={run} />

      {!confirmedDefault ? <footer className="contract-management-actions">
        {!contract.terminationRequestedBy ? (
          <Button
            variant="text"
            disabled={busy}
            onClick={() => {
              if (window.confirm('合同将在当前批次完成后结束，是否继续？')) {
                void run(`${contract.id}:notice`, () => productionContractActions.requestTermination(contract.id));
              }
            }}
          >申请批次后结束</Button>
        ) : <StatusTag tone="warning">已申请批次后结束</StatusTag>}
        <Button
          variant="danger"
          disabled={busy}
          onClick={() => {
            if (window.confirm('立即终止将由你承担违约责任并支付保证金，是否继续？')) {
              void run(`${contract.id}:terminate`, () => productionContractActions.terminateNow(contract.id));
            }
          }}
        >立即违约终止</Button>
      </footer> : null}
    </PagePanel>
  );
}

function OpenContractCard({ contract, productName, busy, run }: ContractCardProps) {
  if (contract.kind !== 'supply') return <CommercialOpenContractCard contract={contract} productName={productName} busy={busy} run={run} />;
  return (
    <PagePanel className="contract-card contract-offer-card">
      <header className="contract-card-heading">
        <div className="contract-card-title">
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag>{STATUS_LABELS[contract.status]}</StatusTag></div>
          <h2>
            <ProductIconLabel productId={contract.productId}>
              {contract.publisherRole === 'buyer' ? `采购 ${productName}` : `供应 ${productName}`}
            </ProductIconLabel>
          </h2>
          <p>发布者：{contract.publisherName}</p>
        </div>
        <strong className="contract-offer-price"><CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount><small>/ 个</small></strong>
      </header>
      <div className="contract-offer-terms">
        <DataList className="compact">
          <DataRow label="每批数量" value={formatNumber(contract.quantityPerDelivery)} />
          <DataRow label="每批货款" value={<CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount>} />
        </DataList>
        <DataList className="compact">
          <DataRow label="交付周期" value={durationLabel(contract.deliveryIntervalMs)} />
          <DataRow label="总批次" value={deliveryCountLabel(contract.totalDeliveries)} />
        </DataList>
      </div>
      <p className="contract-offer-note">{contract.fixedTerms
        ? '市场储备采购使用固定条款，不参与议价；承接后仍按正式托管、履约保证金和交付规则结算。'
        : '合同不会控制你的工厂或配方；你需要自行保证每批商品、资金和仓库条件。'}</p>
      {contract.fixedTerms ? null : <ContractNegotiationSection contract={contract} busy={busy} run={run} />}
      <footer className="contract-card-actions">
        {contract.isPublisher ? (
          <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:cancel`, () => productionContractActions.cancel(contract.id))}>取消发布</Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => {
              const role = contract.publisherRole === 'buyer' ? '供应方' : '采购方';
              if (window.confirm(`你将作为${role}签订长期合同。首批货款和双方履约保证金会立即冻结，是否继续？`)) {
                void run(`${contract.id}:accept`, () => productionContractActions.accept(contract.id));
              }
            }}
          >承接并签订</Button>
        )}
      </footer>
    </PagePanel>
  );
}

function dateBoundary(value: string, endOfDay = false) {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999+08:00' : 'T00:00:00.000+08:00';
  const timestamp = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function endReasonTone(reasonCode: string) {
  if (reasonCode === 'completed') return 'success' as const;
  if (['publisher_cancelled', 'offer_expired'].includes(reasonCode)) return 'neutral' as const;
  if (reasonCode === 'termination_requested') return 'warning' as const;
  return 'danger' as const;
}

function completionUnitLabel(unit: ContractAuditHistoryItem['endSummary']['completion']['unit']) {
  if (unit === 'repayment') return '笔';
  if (unit === 'lease_period') return '期';
  return '批';
}

function plainDurationLabel(milliseconds: number) {
  const minutes = Math.max(0, Math.round(milliseconds / 60_000));
  if (minutes === 0) return '立即';
  if (minutes % 60 === 0) return String(minutes / 60) + ' 小时';
  return String(minutes) + ' 分钟';
}

function HistoryContractRow({
  contract,
  productName,
  facilityName,
  onRepublish,
}: {
  contract: ContractAuditHistoryItem;
  productName: string;
  facilityName: string;
  onRepublish: () => void;
}) {
  const summary = contract.endSummary;
  const completion = summary.completion;
  const settlement = summary.settlement;
  const unit = completionUnitLabel(completion.unit);
  const percentage = completion.ratioBps === null ? 0 : Math.min(100, Math.max(0, completion.ratioBps / 100));
  const counterparty = contract.kind === 'loan'
    ? (contract.isLender ? contract.borrowerName : contract.lenderName)
    : contract.kind === 'facility_lease'
      ? (contract.isLessor ? contract.lesseeName : contract.lessorName)
      : (contract.isBuyer ? contract.supplierName : contract.buyerName);
  const loanInterest = Number(contract.principal || 0) * Number(contract.interestRateBps || 0) / 10_000;
  return (
    <article className="contract-history-entry">
      <header className="contract-history-heading">
        <div className="contract-history-copy">
          <div className="contract-card-tags"><RoleTag contract={contract} /></div>
          <h2><ProductIconLabel productId={contract.productId}>{contractTitle(contract, productName)}</ProductIconLabel></h2>
        </div>
        <Button className="contract-history-republish" variant="text" onClick={onRepublish}>重新拟定</Button>
      </header>

      <div className="contract-history-result-grid">
        <section className="contract-history-section" aria-label="合同内容">
          <h3>合同内容</h3>
          <DataList className="compact">
            {contract.kind === 'supply' ? <>
              <DataRow label="合作商品" value={productName} />
              <DataRow label="每批数量" value={formatNumber(contract.quantityPerDelivery)} />
              <DataRow label="单位价格" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
              <DataRow label="每批货款" value={<CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount>} />
              <DataRow label="交付周期" value={durationLabel(contract.deliveryIntervalMs)} />
              <DataRow label="总批次" value={deliveryCountLabel(contract.totalDeliveries)} />
              <DataRow label="首次交付" value={'签订后 ' + plainDurationLabel(contract.firstDeliveryDelayMs)} />
            </> : null}
            {contract.kind === 'loan' ? <>
              <DataRow label="贷款本金" value={<CurrencyAmount>{formatCurrency(contract.principal || 0)}</CurrencyAmount>} />
              <DataRow label="固定总利率" value={(Number(contract.interestRateBps || 0) / 100).toFixed(2) + '%'} />
              <DataRow label="到期应还" value={<CurrencyAmount>{formatCurrency(Number(contract.principal || 0) + loanInterest)}</CurrencyAmount>} />
              <DataRow label="贷款期限" value={plainDurationLabel(contract.termMs || 0)} />
              <DataRow label="抵押工厂" value={facilityName} />
              <DataRow label="抵押数量" value={formatNumber(contract.collateralQuantity || 0)} />
            </> : null}
            {contract.kind === 'facility_lease' ? <>
              <DataRow label="租赁工厂" value={facilityName} />
              <DataRow label="工厂数量" value={formatNumber(contract.quantity || 0)} />
              <DataRow label="每期租金" value={<CurrencyAmount>{formatCurrency(contract.rentPerPeriod || 0)}</CurrencyAmount>} />
              <DataRow label="租金周期" value={durationLabel(contract.periodMs || 0)} />
              <DataRow label="总租期" value={formatNumber(contract.totalPeriods || 0) + ' 期'} />
              <DataRow label="首次生效" value={'签订后 ' + plainDurationLabel(contract.firstPeriodDelayMs || 0)} />
            </> : null}
            <DataRow label="合作方" value={counterparty || '—'} />
          </DataList>
        </section>

        <section className="contract-history-section" aria-label="完成情况">
          <h3>完成情况</h3>
          {completion.total === null ? (
            <div className="contract-progress" aria-label={'长期合同，已履约 ' + completion.completed + ' ' + unit}>
              <strong>长期合同 · 已履约 {formatNumber(completion.completed)} {unit}</strong>
            </div>
          ) : (
            <div className="contract-progress" aria-label={'已完成 ' + completion.completed + ' / ' + completion.total + ' ' + unit}>
              <div className="contract-progress-track"><span style={{ width: String(percentage ?? 0) + '%' }} /></div>
              <strong>{formatNumber(completion.completed)} / {formatNumber(completion.total)} {unit}</strong>
            </div>
          )}
          <DataList className="compact">
            <DataRow label="完成率" value={percentage.toFixed(0) + '%'} />
            {contract.kind === 'supply' ? <DataRow label="实际交付" value={formatNumber(settlement.goodsDelivered) + ' 个'} /> : null}
            {contract.kind === 'loan' ? <DataRow label="偿还状态" value={completion.completed ? '已全部偿还' : '未完成偿还'} /> : null}
            {contract.kind === 'facility_lease' ? <DataRow label="已结算租期" value={formatNumber(completion.completed) + ' 期'} /> : null}
          </DataList>
        </section>

        <section className="contract-history-section" aria-label="结束原因">
          <h3>结束原因</h3>
          <StatusTag tone={endReasonTone(summary.reasonCode)}>{END_REASON_LABELS[summary.reasonCode] || summary.reasonCode}</StatusTag>
        </section>

        <section className="contract-history-section" aria-label="结束时间">
          <h3>结束时间</h3>
          <time dateTime={new Date(summary.endedAt).toISOString()}>{dateTimeLabel(summary.endedAt)}</time>
        </section>

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
              <DataRow label="服务费" value={<CurrencyAmount>{formatCurrency(settlement.feeTotal)}</CurrencyAmount>} />
              {settlement.collateralReceivedByMe > 0 ? <DataRow label="我获得抵押工厂" value={formatNumber(settlement.collateralReceivedByMe) + ' 个'} /> : null}
              {settlement.collateralReturnedToMe > 0 ? <DataRow label="退回我的抵押工厂" value={formatNumber(settlement.collateralReturnedToMe) + ' 个'} /> : null}
            </> : null}
            {contract.kind === 'facility_lease' ? <>
              <DataRow label="累计租金" value={<CurrencyAmount>{formatCurrency(settlement.leaseRentPaid || settlement.grossTotal)}</CurrencyAmount>} />
              <DataRow label="累计服务费" value={<CurrencyAmount>{formatCurrency(settlement.feeTotal)}</CurrencyAmount>} />
              {contract.isLessor ? <DataRow label="我的净收入" value={<CurrencyAmount>{formatCurrency(settlement.netTotal)}</CurrencyAmount>} /> : <DataRow label="我支付租金" value={<CurrencyAmount>{formatCurrency(settlement.leaseRentPaid || settlement.grossTotal)}</CurrencyAmount>} />}
            </> : null}
            {settlement.compensationReceivedByMe > 0 ? <DataRow label="我获得赔付" value={<CurrencyAmount>{formatCurrency(settlement.compensationReceivedByMe)}</CurrencyAmount>} tone="success" /> : null}
            {settlement.compensationPaidByMe > 0 ? <DataRow label="我支付赔付" value={<CurrencyAmount>{formatCurrency(settlement.compensationPaidByMe)}</CurrencyAmount>} tone="danger" /> : null}
            {settlement.refundedCreditsToMe > 0 ? <DataRow label="退回我的资金" value={<CurrencyAmount>{formatCurrency(settlement.refundedCreditsToMe)}</CurrencyAmount>} /> : null}
            {settlement.refundedGoodsToMe > 0 ? <DataRow label="退回我的商品" value={formatNumber(settlement.refundedGoodsToMe) + ' 个'} /> : null}
          </DataList>
        </section>
      </div>
      {contract.auditCompleteness === 'legacy_partial' ? <p className="contract-history-legacy-note">旧合同的部分过程统计无法恢复，以上内容以现有权威摘要为准。</p> : null}
    </article>
  );
}

function PublishContractPanel({
  model,
  busy,
  close,
  run,
  initialContract,
}: {
  model: TutorialAwareGameViewModel;
  busy: boolean;
  close: () => void;
  run: (key: string, operation: () => Promise<{ result: { ok: boolean; message: string } }>) => Promise<void>;
  initialContract: ContractAuditHistoryItem | null;
}) {
  type PublishType = 'supply' | 'purchase' | 'lend' | 'borrow' | 'lease-out' | 'lease-in';
  const initialProduct = model.game.products[0];
  const initialFacility = model.game.facilityTypes[0];
  const [publishType, setPublishType] = useState<PublishType>('purchase');
  const [productId, setProductId] = useState(initialProduct?.id ?? '');
  const [facilityTypeId, setFacilityTypeId] = useState(initialFacility?.id ?? '');
  const [quantityInput, setQuantityInput] = useState('100');
  const [unitPriceInput, setUnitPriceInput] = useState(String(initialProduct?.basePrice ?? 1));
  const [interval, setIntervalValue] = useState<number>(60 * 60 * 1000);
  const [deliveriesInput, setDeliveriesInput] = useState('12');
  const [firstDelay, setFirstDelay] = useState<number>(60 * 60 * 1000);
  const [principalInput, setPrincipalInput] = useState('1000');
  const [interestInput, setInterestInput] = useState('5');
  const [loanTerm, setLoanTerm] = useState(24 * 60 * 60 * 1000);
  const [collateralInput, setCollateralInput] = useState('1');
  const [rentInput, setRentInput] = useState('100');
  const [leasePeriod, setLeasePeriod] = useState(3 * 60 * 60 * 1000);
  const [leasePeriodsInput, setLeasePeriodsInput] = useState('12');
  const [provinceId, setProvinceId] = useState(model.selectedProvinceId);

  useEffect(() => {
    if (!initialContract) return;
    const userId = model.game.userId;
    if (initialContract.kind === 'supply') {
      const asSupplier = Number(initialContract.supplierId) === userId
        || (initialContract.isPublisher && initialContract.publisherRole === 'supplier');
      setPublishType(asSupplier ? 'supply' : 'purchase');
      setProductId(model.game.products.some((product) => product.id === initialContract.productId) ? initialContract.productId : '');
      setQuantityInput(String(initialContract.quantityPerDelivery));
      setUnitPriceInput(String(initialContract.unitPrice));
      setIntervalValue(initialContract.deliveryIntervalMs);
      setDeliveriesInput(initialContract.totalDeliveries === null ? '' : String(initialContract.totalDeliveries));
      setFirstDelay(initialContract.firstDeliveryDelayMs);
    } else if (initialContract.kind === 'loan') {
      setProvinceId(initialContract.provinceId || model.game.defaultProvinceId);
      const asLender = Number(initialContract.lenderId) === userId
        || (initialContract.isPublisher && initialContract.publisherSide === 'lender');
      setPublishType(asLender ? 'lend' : 'borrow');
      setPrincipalInput(String(initialContract.principal || 0));
      setInterestInput(String(Number(initialContract.interestRateBps || 0) / 100));
      setLoanTerm(initialContract.termMs || 24 * 60 * 60 * 1000);
      setFacilityTypeId(model.game.facilityTypes.some((facility) => facility.id === initialContract.facilityTypeId) ? initialContract.facilityTypeId || '' : '');
      setCollateralInput(String(initialContract.collateralQuantity || 1));
    } else {
      setProvinceId(initialContract.provinceId || model.game.defaultProvinceId);
      const asLessor = Number(initialContract.lessorId) === userId
        || (initialContract.isPublisher && initialContract.publisherSide === 'lessor');
      setPublishType(asLessor ? 'lease-out' : 'lease-in');
      setFacilityTypeId(model.game.facilityTypes.some((facility) => facility.id === initialContract.facilityTypeId) ? initialContract.facilityTypeId || '' : '');
      setQuantityInput(String(initialContract.quantity || 1));
      setRentInput(String(initialContract.rentPerPeriod || 0));
      setLeasePeriod(initialContract.periodMs || 3 * 60 * 60 * 1000);
      setLeasePeriodsInput(String(initialContract.totalPeriods || 2));
      setFirstDelay(initialContract.firstPeriodDelayMs || 0);
    }
    globalThis.requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('.contract-publish-panel');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panel?.querySelector<HTMLElement>('.contract-publish-form input, .contract-publish-form select')?.focus();
    });
  }, [initialContract?.id]);

  const quantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const unitPrice = parseMoneyDraft(unitPriceInput, { min: 0.01, max: 1_000_000 });
  const deliveries = parseOptionalDeliveriesDraft(deliveriesInput);
  const principal = parseMoneyDraft(principalInput, { min: 0.01, max: 1_000_000 });
  const interestPercent = parseMoneyDraft(interestInput, { min: 1, max: 20 });
  const collateralQuantity = parseIntegerDraft(collateralInput, { min: 1, max: 1_000_000 });
  const rent = parseMoneyDraft(rentInput, { min: 0.01, max: 1_000_000 });
  const leasePeriods = parseIntegerDraft(leasePeriodsInput, { min: 2, max: 100 });
  const isSupply = publishType === 'supply' || publishType === 'purchase';
  const isLoan = publishType === 'lend' || publishType === 'borrow';
  const batchGross = quantity !== null && unitPrice !== null ? quantity * unitPrice : null;
  const bond = batchGross !== null ? Math.ceil(batchGross * 20) / 100 : null;
  const loanInterest = principal !== null && interestPercent !== null ? Math.ceil(principal * interestPercent) / 100 : null;
  const leaseBond = rent !== null ? Math.ceil(rent * 20) / 100 : null;
  const canSubmit = isSupply
    ? Boolean(productId && quantity !== null && unitPrice !== null && deliveries !== undefined)
    : isLoan
      ? Boolean(facilityTypeId && principal !== null && interestPercent !== null && collateralQuantity !== null)
      : Boolean(facilityTypeId && quantity !== null && rent !== null && leasePeriods !== null);

  const submit = async () => {
    let input: CreateProductionContractInput;
    if (isSupply) {
      if (quantity === null || unitPrice === null || deliveries === undefined) return;
      input = {
        kind: 'supply',
        publisherRole: publishType === 'supply' ? 'supplier' : 'buyer',
        productId, quantityPerDelivery: quantity, unitPrice,
        deliveryIntervalMs: interval, totalDeliveries: deliveries, firstDeliveryDelayMs: firstDelay,
      };
    } else if (isLoan) {
      if (principal === null || interestPercent === null || collateralQuantity === null) return;
      input = {
        kind: 'loan', publisherSide: publishType === 'lend' ? 'lender' : 'borrower',
        provinceId,
        principal, interestRateBps: Math.round(interestPercent * 100), termMs: loanTerm,
        facilityTypeId, collateralQuantity,
      };
    } else {
      if (quantity === null || rent === null || leasePeriods === null) return;
      input = {
        kind: 'facility_lease', publisherSide: publishType === 'lease-out' ? 'lessor' : 'lessee',
        provinceId,
        facilityTypeId, quantity, rentPerPeriod: rent, periodMs: leasePeriod,
        totalPeriods: leasePeriods, firstPeriodDelayMs: firstDelay,
      };
    }
    await run('publish', () => productionContractActions.create(input));
  };

  const types: Array<[PublishType, string, string]> = [
    ['supply', '供应合同', '我提供长期商品'],
    ['purchase', '采购合同', '我寻找长期供应'],
    ['lend', '放贷合同', '我提供抵押贷款'],
    ['borrow', '贷款合同', '我寻找出借资金'],
    ['lease-out', '出租合同', '我提供工厂使用权'],
    ['lease-in', '租赁合同', '我寻找工厂使用权'],
  ];

  return (
    <PagePanel className="contract-publish-panel">
      <WidgetHeading title="发布合同" action={<Button variant="text" onClick={close}>关闭</Button>} />
      <p className="contract-section-description">选择商品合作、玩家借贷或工厂租赁。六种名称表示发布方向，签订后双方共享同一份服务器权威合同。</p>
      <div className="contract-type-grid" role="group" aria-label="合同类型">
        {types.map(([value, label, description]) => (
          <Button key={value} variant="text" className={publishType === value ? 'contract-type-option active' : 'contract-type-option'} aria-pressed={publishType === value} onClick={() => setPublishType(value)}>
            <strong>{label}</strong><span>{description}</span>
          </Button>
        ))}
      </div>
      <div className="contract-publish-layout">
        <div className="contract-publish-form">
          <div className="contract-publish-grid">
            {isSupply ? <>
              <SelectInput label="合同商品" value={productId} onChange={(event) => {
                const next = event.target.value;
                const nextPrice = model.game.products.find((item) => item.id === next)?.basePrice ?? 1;
                setProductId(next); setUnitPriceInput(String(nextPrice));
              }}>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</SelectInput>
              <IntegerInput label="每批数量" value={quantityInput} fallbackValue={100} min={1} max={1_000_000} error={quantity === null ? '请输入 1～1000000 的整数。' : undefined} onValueChange={setQuantityInput} />
              <MoneyInput label="单位价格" value={unitPriceInput} fallbackValue={1} min={0.01} max={1_000_000} error={unitPrice === null ? '请输入有效金额。' : undefined} onValueChange={setUnitPriceInput} />
              <SelectInput label="交付周期" value={interval} onChange={(event) => setIntervalValue(Number.parseInt(event.target.value, 10))}>{INTERVAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>
              <IntegerInput label="总交付批次（可选）" description="留空表示长期合同。" value={deliveriesInput} fallbackValue={12} allowEmpty min={2} max={100} error={deliveries === undefined ? '请输入 2～100 的整数，或留空设为长期合同。' : undefined} onValueChange={setDeliveriesInput} />
              <SelectInput label="首次交付" value={firstDelay} onChange={(event) => setFirstDelay(Number.parseInt(event.target.value, 10))}>{FIRST_DELAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>
            </> : null}
            {isLoan ? <>
              <SelectInput label="工厂地区" value={provinceId} onChange={(event) => setProvinceId(event.target.value)}>{model.game.provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</SelectInput>
              <MoneyInput label="贷款本金" value={principalInput} fallbackValue={1000} min={0.01} max={1_000_000} error={principal === null ? '请输入有效本金。' : undefined} onValueChange={setPrincipalInput} />
              <MoneyInput label="固定总利率（%）" value={interestInput} fallbackValue={5} min={1} max={20} error={interestPercent === null ? '请输入 1～20。' : undefined} onValueChange={setInterestInput} />
              <SelectInput label="贷款期限" value={loanTerm} onChange={(event) => setLoanTerm(Number.parseInt(event.target.value, 10))}><option value={12 * 60 * 60 * 1000}>12 小时</option><option value={24 * 60 * 60 * 1000}>24 小时</option><option value={72 * 60 * 60 * 1000}>72 小时</option></SelectInput>
              <SelectInput label="抵押工厂" value={facilityTypeId} onChange={(event) => setFacilityTypeId(event.target.value)}>{model.game.facilityTypes.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</SelectInput>
              <IntegerInput label="抵押数量" value={collateralInput} fallbackValue={1} min={1} max={1_000_000} error={collateralQuantity === null ? '请输入有效数量。' : undefined} onValueChange={setCollateralInput} />
            </> : null}
            {!isSupply && !isLoan ? <>
              <SelectInput label="工厂地区" value={provinceId} onChange={(event) => setProvinceId(event.target.value)}>{model.game.provinces.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}</SelectInput>
              <SelectInput label="租赁工厂" value={facilityTypeId} onChange={(event) => setFacilityTypeId(event.target.value)}>{model.game.facilityTypes.map((facility) => <option key={facility.id} value={facility.id}>{facility.name}</option>)}</SelectInput>
              <IntegerInput label="工厂数量" value={quantityInput} fallbackValue={100} min={1} max={1_000_000} error={quantity === null ? '请输入有效数量。' : undefined} onValueChange={setQuantityInput} />
              <MoneyInput label="每期租金" value={rentInput} fallbackValue={100} min={0.01} max={1_000_000} error={rent === null ? '请输入有效租金。' : undefined} onValueChange={setRentInput} />
              <SelectInput label="租金周期" value={leasePeriod} onChange={(event) => setLeasePeriod(Number.parseInt(event.target.value, 10))}><option value={1 * 60 * 60 * 1000}>每 1 小时</option><option value={3 * 60 * 60 * 1000}>每 3 小时</option><option value={6 * 60 * 60 * 1000}>每 6 小时</option><option value={12 * 60 * 60 * 1000}>每 12 小时</option><option value={24 * 60 * 60 * 1000}>每天</option></SelectInput>
              <IntegerInput label="总租期" value={leasePeriodsInput} fallbackValue={12} min={2} max={100} error={leasePeriods === null ? '请输入 2～100 的整数。' : undefined} onValueChange={setLeasePeriodsInput} />
              <SelectInput label="首次生效" value={firstDelay} onChange={(event) => setFirstDelay(Number.parseInt(event.target.value, 10))}>{FIRST_DELAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectInput>
            </> : null}
          </div>
        </div>
        <aside className="contract-publish-preview" aria-label="合同预览">
          <h3>{types.find(([value]) => value === publishType)?.[1]}</h3>
          <DataList>
            {isSupply ? <><DataRow label="每批货款" value={<CurrencyAmount>{batchGross === null ? '—' : formatCurrency(batchGross)}</CurrencyAmount>} /><DataRow label="合同期限" value={deliveries === null ? '长期' : deliveries === undefined ? '—' : deliveryCountLabel(deliveries)} /><DataRow label="理论合同总额" value={<CurrencyAmount>{batchGross === null || deliveries === null || deliveries === undefined ? '—' : formatCurrency(batchGross * deliveries)}</CurrencyAmount>} /><DataRow label="单方保证金" value={<CurrencyAmount>{bond === null ? '—' : formatCurrency(bond)}</CurrencyAmount>} /></> : null}
            {isLoan ? <><DataRow label="工厂地区" value={model.game.provinces.find((province) => province.id === provinceId)?.name || provinceId} /><DataRow label="贷款本金" value={<CurrencyAmount>{principal === null ? '—' : formatCurrency(principal)}</CurrencyAmount>} /><DataRow label="固定利息" value={<CurrencyAmount>{loanInterest === null ? '—' : formatCurrency(loanInterest)}</CurrencyAmount>} /><DataRow label="到期应还" value={<CurrencyAmount>{principal === null || loanInterest === null ? '—' : formatCurrency(principal + loanInterest)}</CurrencyAmount>} /></> : null}
            {!isSupply && !isLoan ? <><DataRow label="工厂地区" value={model.game.provinces.find((province) => province.id === provinceId)?.name || provinceId} /><DataRow label="每期租金" value={<CurrencyAmount>{rent === null ? '—' : formatCurrency(rent)}</CurrencyAmount>} /><DataRow label="理论租金总额" value={<CurrencyAmount>{rent === null || leasePeriods === null ? '—' : formatCurrency(rent * leasePeriods)}</CurrencyAmount>} /><DataRow label="单方保证金" value={<CurrencyAmount>{leaseBond === null ? '—' : formatCurrency(leaseBond)}</CurrencyAmount>} /></> : null}
          </DataList>
          <p className="contract-offer-note">{isSupply ? '商品与货款逐批托管，卖方累计收取 1% 服务费。' : isLoan ? '本金不得超过抵押工厂审慎价值的 50%；宽限结束仍未还款时确认违约，由出借方主动解除并按确认时快照处置抵押。' : '租入工厂不计入承租方资产；欠租会暂停使用权，宽限结束仍欠租时由出租方主动解除并领取违约金。'}</p>
          <Button block disabled={busy || !canSubmit} onClick={() => void submit()}>{busy ? '发布中' : '发布合同'}</Button>
        </aside>
      </div>
    </PagePanel>
  );
}


export function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {
  const [personalView, setPersonalView] = useState<PersonalContractView>('active');
  const [showPublish, setShowPublish] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [marketProductId, setMarketProductId] = useState(() => consumeContractMarketIntent()?.productId ?? '');
  const [marketKind, setMarketKind] = useState<ContractKind | ''>(() => marketProductId ? 'supply' : '');
  const [historyStatus, setHistoryStatus] = useState<ProductionContractStatus | ''>('');
  const [historyKind, setHistoryKind] = useState<ContractKind | ''>('');
  const [historyRole, setHistoryRole] = useState<HistoryRole>('any');
  const [historyProductId, setHistoryProductId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyItems, setHistoryItems] = useState<ContractAuditHistoryItem[]>([]);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [republishContract, setRepublishContract] = useState<ContractAuditHistoryItem | null>(null);
  const [contractPerformance, setContractPerformance] = useState<ContractPerformanceSummary | null>(null);
  const [contractPerformanceError, setContractPerformanceError] = useState('');
  const { productionContracts, productionContractSummary } = productionContractStateFromGame(model.game);
  const productNames = useMemo(() => new Map([
    ...model.game.products.map((product) => [product.id, product.name] as const),
    ['credits', '普通货币'] as const,
    ...model.game.facilityTypes.map((facility) => [`facility:${facility.id}`, facility.name] as const),
  ]), [model.game.facilityTypes, model.game.products]);
  const contractProductName = (contract: Pick<ProductionContract, 'kind' | 'productId' | 'provinceId' | 'facilityTypeId'>) => {
    const assetName = contract.kind === 'supply'
      ? productNames.get(contract.productId) ?? contract.productId
      : productNames.get(`facility:${contract.facilityTypeId || ''}`) ?? contract.facilityTypeId ?? '—';
    if (contract.kind === 'supply') return assetName;
    const provinceName = model.game.provinces.find((province) => province.id === contract.provinceId)?.shortName
      || contract.provinceId
      || model.game.provinces.find((province) => province.id === model.game.defaultProvinceId)?.shortName;
    return provinceName ? `${provinceName} · ${assetName}` : assetName;
  };

  const activeContracts = productionContracts
    .filter((contract) => contract.status === 'active' && (contract.isParticipant || contract.isBuyer || contract.isSupplier))
    .sort((left, right) => (
      Number(isConfirmedDefault(right)) - Number(isConfirmedDefault(left))
      || Number(Boolean(right.graceEndsAt)) - Number(Boolean(left.graceEndsAt))
      || Number(contractNeedsAttention(right)) - Number(contractNeedsAttention(left))
      || Number(Boolean(right.issue)) - Number(Boolean(left.issue))
      || Number(left.nextDueAt || Infinity) - Number(right.nextDueAt || Infinity)
    ));
  const allOpenContracts = productionContracts.filter((contract) => contract.status === 'open').sort((left, right) => right.createdAt - left.createdAt);
  const openContracts = allOpenContracts.filter((contract) => (
    (!marketKind || contract.kind === marketKind)
    && (!marketProductId || (contract.kind === 'supply' && contract.productId === marketProductId))
  ));
  const pendingContracts = activeContracts.filter(contractNeedsAttention);

  useEffect(() => {
    let cancelled = false;
    void productionContractAudit.performance()
      .then((performance) => { if (!cancelled) setContractPerformance(performance); })
      .catch((reason) => { if (!cancelled) setContractPerformanceError(reason instanceof Error ? reason.message : '履约档案读取失败'); });
    return () => { cancelled = true; };
  }, []);

  const historyQuery = useMemo<ContractHistoryQuery>(() => ({
    limit: 20,
    status: historyStatus,
    kind: historyKind,
    productId: historyProductId,
    role: historyRole,
    from: dateBoundary(historyFrom),
    to: dateBoundary(historyTo, true),
  }), [historyFrom, historyKind, historyProductId, historyRole, historyStatus, historyTo]);

  useEffect(() => {
    if (personalView !== 'history') return undefined;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    productionContractAudit.history(historyQuery)
      .then((page) => {
        if (cancelled) return;
        setHistoryItems(page.items);
        setHistoryNextCursor(page.nextCursor);
      })
      .catch((reason) => {
        if (cancelled) return;
        setHistoryItems([]);
        setHistoryNextCursor(null);
        setHistoryError(reason instanceof Error ? reason.message : '合同历史读取失败');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [historyQuery, personalView]);

  const run = async (
    key: string,
    operation: () => Promise<{ result: { ok: boolean; message: string } }>,
  ) => {
    if (busyKey) return;
    setBusyKey(key);
    try {
      const response = await operation();
      model.notify(response.result.message);
      if (response.result.ok) {
        await model.refresh({ mode: 'authoritative' });
        if (key === 'publish') { setShowPublish(false); setRepublishContract(null); }
      }
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '合同操作失败');
    } finally {
      setBusyKey('');
    }
  };

  async function loadMoreHistory() {
    if (!historyNextCursor || historyLoading) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const page = await productionContractAudit.history({ ...historyQuery, cursor: historyNextCursor });
      setHistoryItems((current) => [...current, ...page.items]);
      setHistoryNextCursor(page.nextCursor);
    } catch (reason) {
      setHistoryError(reason instanceof Error ? reason.message : '合同历史读取失败');
    } finally {
      setHistoryLoading(false);
    }
  }

  function startRepublish(contract: ContractAuditHistoryItem) {
    if (showPublish && !window.confirm('使用历史合同参数将替换当前未发布内容，是否继续？')) return;
    setRepublishContract(contract);
    setShowPublish(true);
    model.notify('已填入历史合同参数，请核对当前条件后发布。');
  }

  const activeEmptyMessage = '当前没有进行中的长期合作合同。';
  const historyEmptyMessage = '当前没有符合筛选条件的已结束合同。';

  return (
    <PageLayout
      title="合同"
      description="通过商品供货、玩家抵押借贷和工厂使用权租赁建立长期合作。所有资产冻结、到期结算、宽限与违约均由服务器确认。"
      actions={<Button onClick={() => { if (showPublish) { setShowPublish(false); setRepublishContract(null); } else { setRepublishContract(null); setShowPublish(true); } }}>{showPublish ? '收起发布表单' : '发布合同'}</Button>}
    >
      <div className="contract-summary-grid">
        <MetricCard label="进行中的合同" value={formatNumber(productionContractSummary.active)} detail="供货、借贷或租赁" tone="info" />
        <MetricCard label="等待我处理" value={formatNumber(productionContractSummary.needsAttention)} detail="商品、货款或仓库异常" tone={productionContractSummary.needsAttention ? 'warning' : 'success'} />
        <MetricCard label="24 小时内交付" value={formatNumber(productionContractSummary.upcomingWithin24Hours)} detail="即将到期批次" />
        <MetricCard label="我的公开合同" value={formatNumber(productionContractSummary.open)} detail="尚未被其他玩家承接" />
      </div>

      <PagePanel className="contract-performance-panel">
        <WidgetHeading title="我的履约档案" action={<StatusTag tone="info">真实合同历史</StatusTag>} />
        {contractPerformance ? (
          <>
            <div className="contract-performance-grid">
              <MetricCard label="已结束合同" value={formatNumber(contractPerformance.totalEnded)} />
              <MetricCard label="正常完成" value={formatNumber(contractPerformance.completed)} detail={`完成率 ${(contractPerformance.completionRateBps / 100).toFixed(1)}%`} tone="success" />
              <MetricCard label="异常结束" value={formatNumber(contractPerformance.abnormalEnded)} tone={contractPerformance.abnormalEnded > 0 ? 'warning' : 'neutral'} />
              <MetricCard label="违约／主动违约" value={formatNumber(contractPerformance.defaulted)} tone={contractPerformance.defaulted > 0 ? 'danger' : 'neutral'} />
              <MetricCard label="累计赔付" value={<CurrencyAmount>{formatCurrency(contractPerformance.compensationPaid)}</CurrencyAmount>} detail={`累计获得 ${formatCurrency(contractPerformance.compensationReceived)}`} />
            </div>
            {contractPerformance.recent.length > 0 ? (
              <div className="contract-performance-recent" aria-label="近期合同结果">
                {contractPerformance.recent.map((item) => (
                  <div key={item.id}>
                    <StatusTag tone={item.status === 'completed' ? 'success' : 'warning'}>{item.kind === 'supply' ? '商品合作' : item.kind === 'loan' ? '资金借贷' : '工厂租赁'}</StatusTag>
                    <strong>{END_REASON_LABELS[item.reasonCode] ?? item.reasonCode}</strong>
                    <span>完成 {(item.completionRatioBps / 100).toFixed(0)}% · {dateTimeLabel(item.endedAt)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="ui-helper-text">暂无已结束合同，履约事实会在合同结束后自动累计。</p>}
          </>
        ) : <p className={contractPerformanceError ? 'contract-issue' : 'ui-helper-text'}>{contractPerformanceError || '正在读取履约档案…'}</p>}
        <p className="ui-helper-text">只展示真实完成、异常结束、赔付和近期结果，不生成星级、信用等级或主观评分。</p>
      </PagePanel>

      {showPublish ? <PublishContractPanel key={republishContract?.id || 'new'} model={model} busy={Boolean(busyKey)} close={() => { setShowPublish(false); setRepublishContract(null); }} run={run} initialContract={republishContract} /> : null}

      <div className="contract-workspace">
        <section className="contract-workspace-pane contract-market-pane" aria-labelledby="contract-market-heading">
          <header className="contract-pane-heading">
            <div>
              <h2 id="contract-market-heading">合同广场</h2>
              <p>公开合同常驻显示，可按领域和商品筛选；商品合作支持直接承接或结构化议价。</p>
            </div>
            <StatusTag>{formatNumber(openContracts.length)} / {formatNumber(allOpenContracts.length)} 个公开合同</StatusTag>
          </header>
          <div className="contract-market-filters" aria-label="合同广场筛选">
            <SelectInput label="合同领域" value={marketKind} onChange={(event) => {
              const next = event.target.value as ContractKind | '';
              setMarketKind(next);
              if (next && next !== 'supply') setMarketProductId('');
            }}>
              <option value="">全部领域</option>
              <option value="supply">商品合作</option>
              <option value="loan">资金借贷</option>
              <option value="facility_lease">工厂租赁</option>
            </SelectInput>
            <SelectInput label="商品" value={marketProductId} onChange={(event) => {
              const next = event.target.value;
              setMarketProductId(next);
              if (next) setMarketKind('supply');
            }}>
              <option value="">全部商品</option>
              {model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </SelectInput>
          </div>
          <div className="contract-pane-grid contract-market-grid">
            {openContracts.length === 0 ? <EmptyState>当前没有符合筛选条件的公开合同。</EmptyState> : openContracts.map((contract) => (
              <OpenContractCard key={contract.id} contract={contract} productName={contractProductName(contract)} busy={Boolean(busyKey)} run={run} />
            ))}
          </div>
        </section>

        <section className="contract-workspace-pane contract-personal-pane" aria-labelledby="contract-personal-heading">
          <header className="contract-pane-heading contract-personal-heading">
            <div>
              <h2 id="contract-personal-heading">我的合同</h2>
              <p>待处理合同使用警示色并固定排在进行中列表最前。</p>
            </div>
            <nav className="ui-segmented contract-personal-tabs" role="tablist" aria-label="我的合同分类">
              <Button id="contract-personal-tab-active" variant="text" role="tab" aria-selected={personalView === 'active'} aria-controls="contract-personal-panel" className={personalView === 'active' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setPersonalView('active')}>进行中的合同 <span className="contract-tab-count">{activeContracts.length}</span>{pendingContracts.length ? <span className="contract-tab-attention-count">待处理 {pendingContracts.length}</span> : null}</Button>
              <Button id="contract-personal-tab-history" variant="text" role="tab" aria-selected={personalView === 'history'} aria-controls="contract-personal-panel" className={personalView === 'history' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setPersonalView('history')}>历史合同</Button>
            </nav>
          </header>

          <section
            id="contract-personal-panel"
            className={`contract-personal-content${personalView === 'active' ? ' contract-active-grid' : ''}`}
            role="tabpanel"
            aria-labelledby={`contract-personal-tab-${personalView}`}
            tabIndex={0}
            aria-live="polite"
          >
            {personalView === 'active' && activeContracts.length === 0 ? <EmptyState>{activeEmptyMessage}</EmptyState> : null}
            {personalView === 'active' ? activeContracts.map((contract) => (
              <ActiveContractCard key={contract.id} contract={contract} productName={contractProductName(contract)} busy={Boolean(busyKey)} run={run} />
            )) : null}
            {personalView === 'history' ? (
          <PagePanel className="contract-history-panel">
            <div className="contract-history-filters" aria-label="合同历史筛选">
              <SelectInput label="合同领域" value={historyKind} onChange={(event) => setHistoryKind(event.target.value as ContractKind | '')}>
                <option value="">全部领域</option><option value="supply">商品合作</option><option value="loan">资金借贷</option><option value="facility_lease">工厂租赁</option>
              </SelectInput>
              <SelectInput label="最终状态" value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value as ProductionContractStatus | '')}>
                <option value="">全部状态</option>
                <option value="completed">已完成</option>
                <option value="terminated">已终止</option>
                <option value="cancelled">已取消</option>
                <option value="expired">已过期</option>
              </SelectInput>
              <SelectInput label="我的角色" value={historyRole} onChange={(event) => setHistoryRole(event.target.value as HistoryRole)}>
                <option value="any">全部角色</option>
                <option value="buyer">我采购</option>
                <option value="supplier">我供货</option>
                <option value="lender">我放贷</option>
                <option value="borrower">我贷款</option>
                <option value="lessor">我出租</option>
                <option value="lessee">我租赁</option>
                <option value="publisher">我发布</option>
              </SelectInput>
              <SelectInput label="合同标的" value={historyProductId} onChange={(event) => setHistoryProductId(event.target.value)}>
                <option value="">全部标的</option>
                <option value="credits">普通货币</option>
                {model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                {model.game.facilityTypes.map((facility) => <option key={`facility:${facility.id}`} value={`facility:${facility.id}`}>{facility.name}</option>)}
              </SelectInput>
              <TextInput label="开始日期" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
              <TextInput label="结束日期" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
              <Button
                className="contract-history-clear"
                variant="text"
                onClick={() => {
                  setHistoryStatus('');
                  setHistoryKind('');
                  setHistoryRole('any');
                  setHistoryProductId('');
                  setHistoryFrom('');
                  setHistoryTo('');
                }}
              >清除筛选</Button>
            </div>
            {historyError ? <p className="contract-issue" role="alert">{historyError}</p> : null}
            {historyLoading && historyItems.length === 0 ? <p className="contract-audit-loading" role="status">正在读取权威合同历史…</p> : null}
            {!historyLoading && historyItems.length === 0 && !historyError ? <EmptyState>{historyEmptyMessage}</EmptyState> : null}
            {historyItems.map((contract) => (
              <HistoryContractRow
                key={contract.id}
                contract={contract}
                productName={productNames.get(contract.productId) ?? contract.productId}
                facilityName={contractProductName(contract)}
                onRepublish={() => startRepublish(contract)}
              />
            ))}
            {historyNextCursor ? <Button variant="text" disabled={historyLoading} onClick={() => void loadMoreHistory()}>{historyLoading ? '读取中' : '加载更多合同历史'}</Button> : null}
          </PagePanel>
            ) : null}
          </section>
        </section>
      </div>
    </PageLayout>
  );
}
