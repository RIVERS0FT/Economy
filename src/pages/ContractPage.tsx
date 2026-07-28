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
  type ContractAuditDetail,
  type ContractAuditEvent,
  type ContractAuditHistoryItem,
  type ContractAuditTransfer,
  type ProductionContract,
  type ProductionContractRole,
  type ProductionContractStatus,
} from '../contracts/types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import '../styles/contract-audit.css';

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

type ContractTab = 'active' | 'market' | 'pending' | 'history';
type HistoryRole = 'any' | 'publisher' | 'buyer' | 'supplier';

const STATUS_LABELS: Record<ProductionContractStatus, string> = {
  open: '等待承接',
  active: '履约中',
  completed: '已完成',
  cancelled: '已取消',
  terminated: '已终止',
  expired: '已过期',
};

const AUDIT_EVENT_LABELS: Record<string, string> = {
  legacy_snapshot_imported: '导入旧合同摘要',
  contract_published: '发布合同',
  contract_accepted: '承接并签订',
  contract_cancelled: '取消公开合同',
  contract_expired: '公开合同过期',
  buyer_funds_reserved_manual: '采购方手动补充货款',
  buyer_funds_reserved_auto: '采购方自动补充货款',
  supplier_goods_reserved_manual: '供应方手动准备商品',
  supplier_goods_reserved_auto: '供应方自动准备商品',
  buyer_auto_fund_changed: '修改自动补款',
  supplier_auto_reserve_changed: '修改自动准备',
  termination_requested: '申请批次后结束',
  grace_started: '进入宽限期',
  delivery_completed: '批次交付完成',
  contract_completed: '合同全部完成',
  contract_terminated_after_batch: '当前批次后结束',
  contract_terminated_immediate: '立即违约终止',
  contract_defaulted: '宽限期违约终止',
  contract_terminated_participant_missing: '参与者异常终止',
  contract_terminated: '合同终止',
  contract_removed_unexpectedly: '合同异常移除',
  renewal_proposed: '提出续签',
  renewal_accepted: '确认续签',
  renewal_rejected: '拒绝续签',
  renewal_revoked: '撤回续签',
  renewal_expired: '续签提议过期',
  renewal_activated: '续签合同生效',
  renewal_cancelled_parent_ended: '父合同结束并取消续签',
};

const REASON_LABELS: Record<string, string> = {
  supplier_goods: '供应方商品不足',
  buyer_funds: '采购方货款不足',
  buyer_warehouse: '采购方仓库空间不足',
  participant_missing: '合同参与者不存在',
  buyer_default: '采购方违约',
  supplier_default: '供应方违约',
  both_default: '双方均未满足履约条件',
  immediate_by_participant: '参与方主动立即终止',
  notice_completed: '按申请完成当前批次后结束',
  history_before_audit_unavailable: '审计功能上线前的逐批历史不可恢复',
  missing_from_world: '合同从权威世界异常消失',
  unknown: '服务器未识别到单一原因',
};

const TRANSFER_PURPOSE_LABELS: Record<string, string> = {
  first_batch_funding: '首批货款托管',
  buyer_bond: '采购方保证金托管',
  supplier_bond: '供应方保证金托管',
  first_batch_goods: '首批商品托管',
  manual_batch_funding: '手动补充货款',
  automatic_batch_funding: '自动补充货款',
  manual_goods_reservation: '手动准备商品',
  automatic_goods_reservation: '自动准备商品',
  delivery_goods: '交付商品',
  delivery_net_payment: '供应方实收货款',
  market_service_fee: '市场服务费',
  buyer_bond_release: '退回采购方保证金',
  supplier_bond_release: '退回供应方保证金',
  unused_escrow_release: '退回未使用货款',
  unused_goods_release: '退回未交付商品',
  bond_compensation: '违约保证金赔付',
  renewal_first_batch_funding: '续签首批货款托管',
  renewal_buyer_bond: '续签采购方保证金托管',
  renewal_supplier_bond: '续签供应方保证金托管',
  renewal_first_batch_goods: '续签首批商品托管',
  renewal_escrow_release: '退回续签托管资产',
};

function durationLabel(milliseconds: number) {
  const option = INTERVAL_OPTIONS.find(([value]) => value === milliseconds);
  if (option) return option[1];
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  return minutes < 60 ? `每 ${minutes} 分钟` : `每 ${Math.round(minutes / 60)} 小时`;
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

function statusTone(contract: Pick<ProductionContract, 'status'> & Partial<Pick<ProductionContract, 'graceEndsAt' | 'issue'>>) {
  if (contract.status === 'completed') return 'success' as const;
  if (contract.status === 'terminated') return 'danger' as const;
  if (contract.status !== 'active') return 'neutral' as const;
  if (contract.graceEndsAt) return 'danger' as const;
  if (contract.issue) return 'warning' as const;
  return 'success' as const;
}

function contractTitle(contract: Pick<ProductionContract, 'productId'>, productName: string) {
  void contract;
  return `${productName}长期供货合同`;
}

function RoleTag({ contract }: {
  contract: Pick<ProductionContract, 'isBuyer' | 'isSupplier' | 'publisherRole'>;
}) {
  if (contract.isBuyer) return <StatusTag tone="info">我采购</StatusTag>;
  if (contract.isSupplier) return <StatusTag tone="success">我供货</StatusTag>;
  return <StatusTag>{contract.publisherRole === 'buyer' ? '采购需求' : '供应报价'}</StatusTag>;
}

function ContractProgress({ contract }: { contract: ProductionContract }) {
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
  const proposal = contract.renewalProposal;
  const remaining = Math.max(0, contract.totalDeliveries - contract.completedDeliveries);
  const eligible = !proposal
    && remaining >= 1
    && remaining <= 3
    && !contract.graceEndsAt
    && !contract.terminationRequestedBy;
  const [editing, setEditing] = useState(false);
  const [quantityInput, setQuantityInput] = useState(String(contract.quantityPerDelivery));
  const [unitPriceInput, setUnitPriceInput] = useState(String(contract.unitPrice));
  const [deliveriesInput, setDeliveriesInput] = useState(String(contract.totalDeliveries));
  const [interval, setInterval] = useState(contract.deliveryIntervalMs);
  const [firstDelay, setFirstDelay] = useState(contract.firstDeliveryDelayMs);
  const quantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const unitPrice = parseMoneyDraft(unitPriceInput, { min: 0.01, max: 1_000_000 });
  const deliveries = parseIntegerDraft(deliveriesInput, { min: 2, max: 100 });

  if (proposal) {
    const terms = proposal.terms;
    return (
      <section className="contract-renewal-panel" aria-label="合同续签">
        <div className="contract-renewal-heading">
          <div>
            <strong>合同续签</strong>
            <span>{proposal.status === 'proposed' ? '等待双方确认' : proposal.status === 'accepted' ? '已锁定，当前合同完成后生效' : '后续合同已经生效'}</span>
          </div>
          <StatusTag tone={proposal.status === 'accepted' || proposal.status === 'activated' ? 'success' : 'info'}>
            {proposal.status === 'proposed' ? '待确认' : proposal.status === 'accepted' ? '已确认' : '已生效'}
          </StatusTag>
        </div>
        <DataList className="compact contract-renewal-summary">
          <DataRow label="每批数量" value={formatNumber(terms.quantityPerDelivery)} />
          <DataRow label="单位价格" value={<CurrencyAmount>{formatCurrency(terms.unitPrice)}</CurrencyAmount>} />
          <DataRow label="交付周期" value={durationLabel(terms.deliveryIntervalMs)} />
          <DataRow label="总批次" value={`${formatNumber(terms.totalDeliveries)} 批`} />
        </DataList>
        {proposal.status === 'proposed' ? (
          <div className="contract-renewal-actions">
            {proposal.isProposer ? (
              <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-revoke`, () => productionContractActions.revokeRenewal(contract.id))}>撤回续签</Button>
            ) : (
              <>
                <Button disabled={busy} onClick={() => void run(`${contract.id}:renewal-accept`, () => productionContractActions.acceptRenewal(contract.id))}>接受续签</Button>
                <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:renewal-reject`, () => productionContractActions.rejectRenewal(contract.id))}>拒绝续签</Button>
              </>
            )}
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

  const canSubmit = quantity !== null && unitPrice !== null && deliveries !== null;
  const submit = () => {
    if (!canSubmit || quantity === null || unitPrice === null || deliveries === null) return;
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
        <IntegerInput label="总交付批次" value={deliveriesInput} fallbackValue={contract.totalDeliveries} min={2} max={100} error={deliveries === null ? '请输入 2～100 的整数。' : undefined} onValueChange={setDeliveriesInput} />
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

function ActiveContractCard({ contract, productName, busy, run }: ContractCardProps) {
  const canPrepare = contract.isSupplier && contract.supplierReservedQuantity < contract.quantityPerDelivery;
  const canFund = contract.isBuyer && contract.buyerEscrowCredits < contract.batchGross;
  const counterparty = contract.isBuyer ? contract.supplierName : contract.buyerName;
  const statusLabel = contract.graceEndsAt ? '宽限期' : STATUS_LABELS[contract.status];

  return (
    <PagePanel className={`contract-card contract-card--${contract.graceEndsAt ? 'danger' : contract.issue ? 'attention' : 'normal'}`}>
      <header className="contract-card-heading">
        <div className="contract-card-title">
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{statusLabel}</StatusTag></div>
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
            {contract.graceEndsAt ? <DataRow label="宽限期结束" value={dateTimeLabel(contract.graceEndsAt)} tone="danger" /> : null}
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
          {canPrepare ? <Button disabled={busy} onClick={() => void run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>准备本批商品</Button> : null}
          {canFund ? <Button disabled={busy} onClick={() => void run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>补充本批货款</Button> : null}
          {!canPrepare && !canFund ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '请先处理上方异常' : '当前无需手动处理'}</StatusTag> : null}
        </div>
        <div className="contract-automation">
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
        </div>
      </div>

      <ContractRenewalSection contract={contract} productName={productName} busy={busy} run={run} />

      <footer className="contract-management-actions">
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
      </footer>
    </PagePanel>
  );
}

function OpenContractCard({ contract, productName, busy, run }: ContractCardProps) {
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
          <DataRow label="总批次" value={`${formatNumber(contract.totalDeliveries)} 批`} />
        </DataList>
      </div>
      <p className="contract-offer-note">合同不会控制你的工厂或配方；你需要自行保证每批商品、资金和仓库条件。</p>
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

function actorLabel(event: ContractAuditEvent, contract: ContractAuditHistoryItem) {
  if (event.actorType === 'system') return '服务器';
  if (event.actorUserId === contract.buyerId) return contract.buyerName || '采购方';
  if (event.actorUserId === contract.supplierId) return contract.supplierName || '供应方';
  if (event.actorUserId === contract.publisherId) return contract.publisherName || '发布者';
  return '参与玩家';
}

function reasonLabel(reasonCode: string | null) {
  if (!reasonCode) return null;
  return reasonCode
    .split('+')
    .map((reason) => REASON_LABELS[reason] || reason)
    .join('、');
}

function accountOwnerLabel(type: string, id: number | null, contract: ContractAuditHistoryItem) {
  if (type === 'system') return '系统';
  if (id === contract.buyerId) return contract.buyerName || '采购方';
  if (id === contract.supplierId) return contract.supplierName || '供应方';
  return '玩家';
}

function transferLabel(
  item: ContractAuditTransfer,
  contract: ContractAuditHistoryItem,
  productNames: Map<string, string>,
) {
  const asset = item.assetType === 'credits'
    ? <CurrencyAmount>{formatCurrency(item.quantity)}</CurrencyAmount>
    : `${productNames.get(item.productId || '') || item.productId || '商品'} × ${formatNumber(item.quantity)}`;
  return (
    <span>
      <strong>{TRANSFER_PURPOSE_LABELS[item.purpose] || item.purpose}</strong>
      {' · '}{accountOwnerLabel(item.fromType, item.fromId, contract)} → {accountOwnerLabel(item.toType, item.toId, contract)}
      {' · '}{asset}
    </span>
  );
}

function AuditEventRow({
  event,
  contract,
  productNames,
}: {
  event: ContractAuditEvent;
  contract: ContractAuditHistoryItem;
  productNames: Map<string, string>;
}) {
  const reason = reasonLabel(event.reasonCode);
  const gross = typeof event.metadata.gross === 'number' ? Number(event.metadata.gross) : null;
  const fee = typeof event.metadata.fee === 'number' ? Number(event.metadata.fee) : null;
  const plannedAt = typeof event.metadata.plannedAt === 'number' ? Number(event.metadata.plannedAt) : null;
  const deliveredAt = typeof event.metadata.deliveredAt === 'number' ? Number(event.metadata.deliveredAt) : null;
  return (
    <li className="contract-audit-event">
      <div className="contract-audit-event-marker" aria-hidden="true" />
      <div className="contract-audit-event-body">
        <header>
          <div>
            <strong>{AUDIT_EVENT_LABELS[event.eventType] || event.eventType}</strong>
            {event.batchNumber ? <StatusTag>第 {formatNumber(event.batchNumber)} 批</StatusTag> : null}
          </div>
          <time dateTime={new Date(event.occurredAt).toISOString()}>{dateTimeLabel(event.occurredAt)}</time>
        </header>
        <p>执行者：{actorLabel(event, contract)}{reason ? ` · 原因：${reason}` : ''}</p>
        {event.eventType === 'delivery_completed' ? (
          <DataList className="compact contract-audit-delivery-data">
            <DataRow label="计划交付" value={dateTimeLabel(plannedAt)} />
            <DataRow label="实际交付" value={dateTimeLabel(deliveredAt || event.occurredAt)} />
            <DataRow label="批次总额" value={<CurrencyAmount>{formatCurrency(gross || contract.batchGross)}</CurrencyAmount>} />
            <DataRow label="服务费" value={<CurrencyAmount>{formatCurrency(fee || 0)}</CurrencyAmount>} />
          </DataList>
        ) : null}
        {event.transfers.length > 0 ? (
          <ul className="contract-audit-transfers">
            {event.transfers.map((item, index) => <li key={`${event.sequence}:${index}`}>{transferLabel(item, contract, productNames)}</li>)}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function AuditDetailPanel({
  detail,
  loading,
  onLoadMore,
  productNames,
}: {
  detail: ContractAuditDetail | null;
  loading: boolean;
  onLoadMore: () => void;
  productNames: Map<string, string>;
}) {
  if (loading && !detail) return <p className="contract-audit-loading" role="status">正在读取权威审计记录…</p>;
  if (!detail) return <p className="contract-issue" role="alert">合同审计记录读取失败，请稍后重试。</p>;
  const contract = detail.contract;
  const productName = productNames.get(contract.productId) || contract.productId;
  return (
    <section className="contract-audit-detail" aria-label="合同完整审计">
      {contract.auditCompleteness === 'legacy_partial' ? (
        <p className="contract-audit-legacy-note" role="note">
          该合同在审计功能上线前已经存在。当前条款和上线后的事件可核查，但更早的逐批操作无法可靠还原。
        </p>
      ) : <p className="contract-audit-complete-note">该合同从发布开始具有完整服务器审计记录。</p>}
      <div className="contract-audit-summary-grid">
        <DataList className="compact">
          <DataRow label="合同商品" value={`${productName} × ${formatNumber(contract.quantityPerDelivery)} / 批`} />
          <DataRow label="合同单价" value={<CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount>} />
          <DataRow label="交付周期" value={durationLabel(contract.deliveryIntervalMs)} />
          <DataRow label="完成批次" value={`${formatNumber(contract.completedDeliveries)} / ${formatNumber(contract.totalDeliveries)}`} />
        </DataList>
        <DataList className="compact">
          <DataRow label="累计货款" value={<CurrencyAmount>{formatCurrency(contract.grossTotal)}</CurrencyAmount>} />
          <DataRow label="累计服务费" value={<CurrencyAmount>{formatCurrency(contract.feeTotal)}</CurrencyAmount>} />
          <DataRow label="供应方净收入" value={<CurrencyAmount>{formatCurrency(contract.netTotal)}</CurrencyAmount>} />
          <DataRow label="保证金赔付" value={<CurrencyAmount>{formatCurrency(contract.compensationTotal)}</CurrencyAmount>} />
        </DataList>
      </div>
      <ol className="contract-audit-timeline">
        {detail.events.map((event) => (
          <AuditEventRow key={event.sequence} event={event} contract={contract} productNames={productNames} />
        ))}
      </ol>
      {detail.nextCursor ? <Button variant="text" disabled={loading} onClick={onLoadMore}>{loading ? '读取中' : '加载更多审计事件'}</Button> : null}
    </section>
  );
}

function HistoryContractRow({
  contract,
  productName,
  expanded,
  detail,
  loading,
  onToggle,
  onLoadMore,
  productNames,
}: {
  contract: ContractAuditHistoryItem;
  productName: string;
  expanded: boolean;
  detail: ContractAuditDetail | null;
  loading: boolean;
  onToggle: () => void;
  onLoadMore: () => void;
  productNames: Map<string, string>;
}) {
  return (
    <article className="contract-history-entry" data-expanded={expanded ? 'true' : 'false'}>
      <button className="contract-history-row" type="button" data-ui-interactive="surface" aria-expanded={expanded} onClick={onToggle}>
        <div className="contract-history-copy">
          <div className="contract-card-tags">
            <RoleTag contract={contract} />
            <StatusTag tone={statusTone(contract)}>{STATUS_LABELS[contract.status]}</StatusTag>
            <StatusTag tone={contract.auditCompleteness === 'full' ? 'success' : 'warning'}>
              {contract.auditCompleteness === 'full' ? '完整审计' : '旧数据摘要'}
            </StatusTag>
          </div>
          <h2><ProductIconLabel productId={contract.productId}>{contractTitle(contract, productName)}</ProductIconLabel></h2>
          <p>{formatNumber(contract.completedDeliveries)} / {formatNumber(contract.totalDeliveries)} 批 · {durationLabel(contract.deliveryIntervalMs)}</p>
        </div>
        <div className="contract-history-meta">
          <strong><CurrencyAmount>{formatCurrency(contract.grossTotal)}</CurrencyAmount> 累计货款</strong>
          <span>{dateTimeLabel(contract.endedAt || contract.completedAt || contract.lastEventAt)}</span>
          <span>{expanded ? '收起审计 ↑' : '查看审计 ↓'}</span>
        </div>
      </button>
      {expanded ? <AuditDetailPanel detail={detail} loading={loading} onLoadMore={onLoadMore} productNames={productNames} /> : null}
    </article>
  );
}

function PublishContractPanel({
  model,
  busy,
  close,
  run,
}: {
  model: TutorialAwareGameViewModel;
  busy: boolean;
  close: () => void;
  run: (key: string, operation: () => Promise<{ result: { ok: boolean; message: string } }>) => Promise<void>;
}) {
  const initialProduct = model.game.products[0];
  const initialUnitPrice = initialProduct?.basePrice ?? 1;
  const [publisherRole, setPublisherRole] = useState<ProductionContractRole>('buyer');
  const [productId, setProductId] = useState(initialProduct?.id ?? '');
  const [quantity, setQuantity] = useState(100);
  const [quantityInput, setQuantityInput] = useState('100');
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice);
  const [unitPriceInput, setUnitPriceInput] = useState(String(initialUnitPrice));
  const [interval, setIntervalValue] = useState<number>(60 * 60 * 1000);
  const [deliveries, setDeliveries] = useState(12);
  const [deliveriesInput, setDeliveriesInput] = useState('12');
  const [firstDelay, setFirstDelay] = useState<number>(60 * 60 * 1000);

  const parsedQuantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const parsedUnitPrice = parseMoneyDraft(unitPriceInput, { min: 0.01, max: 1_000_000 });
  const parsedDeliveries = parseIntegerDraft(deliveriesInput, { min: 2, max: 100 });
  const batchGross = parsedQuantity !== null && parsedUnitPrice !== null
    ? parsedQuantity * parsedUnitPrice
    : null;
  const totalGross = batchGross !== null && parsedDeliveries !== null
    ? batchGross * parsedDeliveries
    : null;
  const bond = batchGross !== null ? Math.ceil(batchGross * 20) / 100 : null;
  const canSubmit = Boolean(productId)
    && parsedQuantity !== null
    && parsedUnitPrice !== null
    && parsedDeliveries !== null;

  function updateQuantity(value: string) {
    setQuantityInput(value);
    const parsed = parseIntegerDraft(value, { min: 1, max: 1_000_000 });
    if (parsed !== null) setQuantity(parsed);
  }

  function updateUnitPrice(value: string) {
    setUnitPriceInput(value);
    const parsed = parseMoneyDraft(value, { min: 0.01, max: 1_000_000 });
    if (parsed !== null) setUnitPrice(parsed);
  }

  function updateDeliveries(value: string) {
    setDeliveriesInput(value);
    const parsed = parseIntegerDraft(value, { min: 2, max: 100 });
    if (parsed !== null) setDeliveries(parsed);
  }

  const submit = async () => {
    if (parsedQuantity === null || parsedUnitPrice === null || parsedDeliveries === null) return;
    const input: CreateProductionContractInput = {
      publisherRole,
      productId,
      quantityPerDelivery: parsedQuantity,
      unitPrice: parsedUnitPrice,
      deliveryIntervalMs: interval,
      totalDeliveries: parsedDeliveries,
      firstDeliveryDelayMs: firstDelay,
    };
    await run('publish', () => productionContractActions.create(input));
  };

  return (
    <PagePanel className="contract-publish-panel">
      <WidgetHeading title="发布长期供货合同" action={<Button variant="text" onClick={close}>关闭</Button>} />
      <p className="contract-section-description">只约定商品、价格、周期和批次，不出租工厂，不涉及其他资产类型。</p>
      <div className="contract-publish-layout">
        <div className="contract-publish-form">
          <fieldset className="contract-direction-field">
            <legend>发布方向</legend>
            <div className="ui-segmented contract-direction-switch" role="group" aria-label="发布方向">
              <Button
                variant="text"
                className={publisherRole === 'buyer' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={publisherRole === 'buyer'}
                onClick={() => setPublisherRole('buyer')}
              >我长期采购</Button>
              <Button
                variant="text"
                className={publisherRole === 'supplier' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={publisherRole === 'supplier'}
                onClick={() => setPublisherRole('supplier')}
              >我长期供应</Button>
            </div>
          </fieldset>
          <div className="contract-publish-grid">
            <SelectInput
              label="合同商品"
              value={productId}
              onChange={(event) => {
                const next = event.target.value;
                const nextPrice = model.game.products.find((item) => item.id === next)?.basePrice ?? 1;
                setProductId(next);
                setUnitPrice(nextPrice);
                setUnitPriceInput(String(nextPrice));
              }}
            >
              {model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
            </SelectInput>
            <IntegerInput
              label="每批数量"
              value={quantityInput}
              fallbackValue={quantity}
              min={1}
              max={1_000_000}
              error={parsedQuantity === null ? '请输入 1～1000000 的整数。' : undefined}
              onValueChange={updateQuantity}
            />
            <MoneyInput
              label="单位价格"
              value={unitPriceInput}
              fallbackValue={unitPrice}
              min={1}
              max={1_000_000}
              error={parsedUnitPrice === null ? '请输入 0.01～1000000 的金额；超过两位小数会向下截断。' : undefined}
              onValueChange={updateUnitPrice}
            />
            <SelectInput
              label="交付周期"
              value={interval}
              onChange={(event) => setIntervalValue(Number.parseInt(event.target.value, 10))}
            >
              {INTERVAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectInput>
            <IntegerInput
              label="总交付批次"
              value={deliveriesInput}
              fallbackValue={deliveries}
              min={2}
              max={100}
              error={parsedDeliveries === null ? '请输入 2～100 的整数。' : undefined}
              onValueChange={updateDeliveries}
            />
            <SelectInput
              label="首次交付"
              value={firstDelay}
              onChange={(event) => setFirstDelay(Number.parseInt(event.target.value, 10))}
            >
              {FIRST_DELAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectInput>
          </div>
        </div>

        <aside className="contract-publish-preview" aria-label="合同预览">
          <h3>合同预览</h3>
          <DataList>
            <DataRow label="每批货款" value={<CurrencyAmount>{batchGross === null ? '—' : formatCurrency(batchGross)}</CurrencyAmount>} />
            <DataRow label="理论合同总额" value={<CurrencyAmount>{totalGross === null ? '—' : formatCurrency(totalGross)}</CurrencyAmount>} />
            <DataRow label="履约保证金 / 方" value={<CurrencyAmount>{bond === null ? '—' : formatCurrency(bond)}</CurrencyAmount>} />
          </DataList>
          <p className="contract-offer-note">签订时采购方冻结首批货款和 20% 保证金，供应方冻结 20% 保证金。每批成功交付按卖方累计货款收取 1% 市场服务费。</p>
          <Button block disabled={busy || !canSubmit} onClick={() => void submit()}>{busy ? '发布中' : '发布合同'}</Button>
        </aside>
      </div>
    </PagePanel>
  );
}

export function ContractPage({ model }: { model: TutorialAwareGameViewModel }) {
  const [tab, setTab] = useState<ContractTab>('active');
  const [showPublish, setShowPublish] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [historyStatus, setHistoryStatus] = useState<ProductionContractStatus | ''>('');
  const [historyRole, setHistoryRole] = useState<HistoryRole>('any');
  const [historyProductId, setHistoryProductId] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyItems, setHistoryItems] = useState<ContractAuditHistoryItem[]>([]);
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [expandedContractId, setExpandedContractId] = useState<string | null>(null);
  const [auditDetails, setAuditDetails] = useState<Record<string, ContractAuditDetail>>({});
  const [auditLoadingId, setAuditLoadingId] = useState<string | null>(null);
  const { productionContracts, productionContractSummary } = productionContractStateFromGame(model.game);
  const productNames = useMemo(() => new Map(model.game.products.map((product) => [product.id, product.name])), [model.game.products]);

  const activeContracts = productionContracts
    .filter((contract) => contract.status === 'active' && (contract.isBuyer || contract.isSupplier))
    .sort((left, right) => Number(Boolean(right.graceEndsAt)) - Number(Boolean(left.graceEndsAt)) || Number(right.issue !== null) - Number(left.issue !== null) || Number(left.nextDueAt || Infinity) - Number(right.nextDueAt || Infinity));
  const openContracts = productionContracts.filter((contract) => contract.status === 'open').sort((left, right) => right.createdAt - left.createdAt);
  const pendingContracts = activeContracts.filter((contract) => contract.issue || contract.terminationRequestedBy);

  const historyQuery = useMemo<ContractHistoryQuery>(() => ({
    limit: 20,
    status: historyStatus,
    productId: historyProductId,
    role: historyRole,
    from: dateBoundary(historyFrom),
    to: dateBoundary(historyTo, true),
  }), [historyFrom, historyProductId, historyRole, historyStatus, historyTo]);

  useEffect(() => {
    if (tab !== 'history') return undefined;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    setExpandedContractId(null);
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
  }, [historyQuery, tab]);

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
        if (key === 'publish') setShowPublish(false);
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

  async function toggleAudit(contractId: string) {
    if (expandedContractId === contractId) {
      setExpandedContractId(null);
      return;
    }
    setExpandedContractId(contractId);
    if (auditDetails[contractId]) return;
    setAuditLoadingId(contractId);
    try {
      const detail = await productionContractAudit.detail(contractId);
      setAuditDetails((current) => ({ ...current, [contractId]: detail }));
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '合同审计读取失败');
    } finally {
      setAuditLoadingId(null);
    }
  }

  async function loadMoreAudit(contractId: string) {
    const current = auditDetails[contractId];
    if (!current?.nextCursor || auditLoadingId) return;
    setAuditLoadingId(contractId);
    try {
      const page = await productionContractAudit.detail(contractId, current.nextCursor);
      setAuditDetails((details) => ({
        ...details,
        [contractId]: {
          contract: page.contract,
          events: [...current.events, ...page.events],
          nextCursor: page.nextCursor,
        },
      }));
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '合同审计读取失败');
    } finally {
      setAuditLoadingId(null);
    }
  }

  const visibleCount = tab === 'active'
    ? activeContracts.length
    : tab === 'market'
      ? openContracts.length
      : tab === 'pending'
        ? pendingContracts.length
        : historyItems.length;

  const emptyMessage = tab === 'active'
    ? '当前没有进行中的长期合作合同。'
    : tab === 'market'
      ? '当前没有可承接的公开合同。'
      : tab === 'pending'
        ? '当前没有需要处理的合同事项。'
        : '当前没有符合筛选条件的已结束合同。';

  return (
    <PageLayout
      title="合同"
      description="与其他玩家签订长期周期供货协议，稳定上下游生产合作。合同不绑定工厂、不控制配方，也不涉及其他资产类型。"
      actions={<Button onClick={() => setShowPublish((current) => !current)}>{showPublish ? '收起发布表单' : '发布合同'}</Button>}
    >
      <div className="contract-summary-grid">
        <MetricCard label="进行中的合同" value={formatNumber(productionContractSummary.active)} detail="我采购或我供货" tone="info" />
        <MetricCard label="等待我处理" value={formatNumber(productionContractSummary.needsAttention)} detail="商品、货款或仓库异常" tone={productionContractSummary.needsAttention ? 'warning' : 'success'} />
        <MetricCard label="24 小时内交付" value={formatNumber(productionContractSummary.upcomingWithin24Hours)} detail="即将到期批次" />
        <MetricCard label="我的公开合同" value={formatNumber(productionContractSummary.open)} detail="尚未被其他玩家承接" />
      </div>

      {showPublish ? <PublishContractPanel model={model} busy={Boolean(busyKey)} close={() => setShowPublish(false)} run={run} /> : null}

      <nav className="ui-segmented contract-tabs" role="tablist" aria-label="合同页面分类">
        <Button id="contract-tab-active" variant="text" role="tab" aria-selected={tab === 'active'} aria-controls="contract-tabpanel" className={tab === 'active' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setTab('active')}>进行中的合同 <span className="contract-tab-count">{activeContracts.length}</span></Button>
        <Button id="contract-tab-market" variant="text" role="tab" aria-selected={tab === 'market'} aria-controls="contract-tabpanel" className={tab === 'market' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setTab('market')}>合同广场 <span className="contract-tab-count">{openContracts.length}</span></Button>
        <Button id="contract-tab-pending" variant="text" role="tab" aria-selected={tab === 'pending'} aria-controls="contract-tabpanel" className={tab === 'pending' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setTab('pending')}>待处理 <span className="contract-tab-count">{pendingContracts.length}</span></Button>
        <Button id="contract-tab-history" variant="text" role="tab" aria-selected={tab === 'history'} aria-controls="contract-tabpanel" className={tab === 'history' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setTab('history')}>合同历史 <span className="contract-tab-count">{historyItems.length}</span></Button>
      </nav>

      <section
        id="contract-tabpanel"
        className={`contract-list${tab === 'market' ? ' contract-offer-grid' : ''}`}
        role="tabpanel"
        aria-labelledby={`contract-tab-${tab}`}
        tabIndex={0}
        aria-live="polite"
      >
        {tab !== 'history' && visibleCount === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
        {tab === 'active' ? activeContracts.map((contract) => (
          <ActiveContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'pending' ? pendingContracts.map((contract) => (
          <ActiveContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'market' ? openContracts.map((contract) => (
          <OpenContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'history' ? (
          <PagePanel className="contract-history-panel">
            <div className="contract-history-filters" aria-label="合同历史筛选">
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
                <option value="publisher">我发布</option>
              </SelectInput>
              <SelectInput label="合同商品" value={historyProductId} onChange={(event) => setHistoryProductId(event.target.value)}>
                <option value="">全部商品</option>
                {model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </SelectInput>
              <TextInput label="开始日期" type="date" value={historyFrom} onChange={(event) => setHistoryFrom(event.target.value)} />
              <TextInput label="结束日期" type="date" value={historyTo} onChange={(event) => setHistoryTo(event.target.value)} />
              <Button
                variant="text"
                onClick={() => {
                  setHistoryStatus('');
                  setHistoryRole('any');
                  setHistoryProductId('');
                  setHistoryFrom('');
                  setHistoryTo('');
                }}
              >清除筛选</Button>
            </div>
            {historyError ? <p className="contract-issue" role="alert">{historyError}</p> : null}
            {historyLoading && historyItems.length === 0 ? <p className="contract-audit-loading" role="status">正在读取权威合同历史…</p> : null}
            {!historyLoading && historyItems.length === 0 && !historyError ? <EmptyState>{emptyMessage}</EmptyState> : null}
            {historyItems.map((contract) => (
              <HistoryContractRow
                key={contract.id}
                contract={contract}
                productName={productNames.get(contract.productId) ?? contract.productId}
                expanded={expandedContractId === contract.id}
                detail={auditDetails[contract.id] || null}
                loading={auditLoadingId === contract.id}
                onToggle={() => void toggleAudit(contract.id)}
                onLoadMore={() => void loadMoreAudit(contract.id)}
                productNames={productNames}
              />
            ))}
            {historyNextCursor ? <Button variant="text" disabled={historyLoading} onClick={() => void loadMoreHistory()}>{historyLoading ? '读取中' : '加载更多合同历史'}</Button> : null}
          </PagePanel>
        ) : null}
      </section>
    </PageLayout>
  );
}
