import { useState } from 'react';
import { ChevronIcon } from '../components/icons/GameIcons';
import { IntegerInput, MoneyInput, SelectInput } from '../components/ui/FormControls';
import { Button, DataList, DataRow, StatusTag } from '../components/ui/layout';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import { productionContractActions, type SupplyNegotiationTermsInput } from './api';
import type { ProductionContract, ProductionContractNegotiation, ProductionContractNegotiationTerms } from './types';

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

type RunContractAction = (
  key: string,
  operation: () => Promise<{ result: { ok: boolean; message: string } }>,
) => Promise<void>;

function parseOptionalDeliveriesDraft(value: string): number | null | undefined {
  if (value.trim() === '') return null;
  return parseIntegerDraft(value, { min: 2, max: 100 }) ?? undefined;
}

function deliveryCountLabel(value: number | null) {
  return value === null ? '长期' : `${formatNumber(value)} 批`;
}

function durationLabel(value: number) {
  return INTERVAL_OPTIONS.find(([candidate]) => candidate === value)?.[1] ?? `${Math.round(value / 60_000)} 分钟`;
}

function firstDelayLabel(value: number) {
  return FIRST_DELAY_OPTIONS.find(([candidate]) => candidate === value)?.[1]
    ?? (value === 0 ? '签订后立即进入首批交付' : `签订后 ${Math.round(value / 60_000)} 分钟`);
}

function TermChange({ from, to }: { from: string; to: string }) {
  return (
    <span className="contract-negotiation-change">
      <span>{from}</span>
      <ChevronIcon direction="right" />
      <span>{to}</span>
    </span>
  );
}

function TermsSummary({
  terms,
  baseTerms,
}: {
  terms: ProductionContractNegotiationTerms;
  baseTerms: ProductionContractNegotiationTerms;
}) {
  const quantityLabel = terms.quantityPerDelivery === baseTerms.quantityPerDelivery
    ? formatNumber(terms.quantityPerDelivery)
    : <TermChange from={formatNumber(baseTerms.quantityPerDelivery)} to={formatNumber(terms.quantityPerDelivery)} />;
  const priceLabel = terms.unitPrice === baseTerms.unitPrice
    ? formatCurrency(terms.unitPrice)
    : <TermChange from={formatCurrency(baseTerms.unitPrice)} to={formatCurrency(terms.unitPrice)} />;
  const intervalLabel = terms.deliveryIntervalMs === baseTerms.deliveryIntervalMs
    ? durationLabel(terms.deliveryIntervalMs)
    : <TermChange from={durationLabel(baseTerms.deliveryIntervalMs)} to={durationLabel(terms.deliveryIntervalMs)} />;
  const deliveriesLabel = terms.totalDeliveries === baseTerms.totalDeliveries
    ? deliveryCountLabel(terms.totalDeliveries)
    : <TermChange from={deliveryCountLabel(baseTerms.totalDeliveries)} to={deliveryCountLabel(terms.totalDeliveries)} />;
  const firstDelay = terms.firstDeliveryDelayMs === baseTerms.firstDeliveryDelayMs
    ? firstDelayLabel(terms.firstDeliveryDelayMs)
    : <TermChange from={firstDelayLabel(baseTerms.firstDeliveryDelayMs)} to={firstDelayLabel(terms.firstDeliveryDelayMs)} />;

  return (
    <DataList className="compact contract-negotiation-summary">
      <DataRow label="每批数量" value={quantityLabel} />
      <DataRow label="单位价格" value={<CurrencyAmount>{priceLabel}</CurrencyAmount>} />
      <DataRow label="交付周期" value={intervalLabel} />
      <DataRow label="总批次" value={deliveriesLabel} />
      <DataRow label="首次交付" value={firstDelay} />
    </DataList>
  );
}

function TermsEditor({
  initial,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ProductionContractNegotiationTerms;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: SupplyNegotiationTermsInput) => void;
  onCancel: () => void;
}) {
  const [quantityInput, setQuantityInput] = useState(String(initial.quantityPerDelivery));
  const [unitPriceInput, setUnitPriceInput] = useState(String(initial.unitPrice));
  const [deliveriesInput, setDeliveriesInput] = useState(initial.totalDeliveries === null ? '' : String(initial.totalDeliveries));
  const [interval, setInterval] = useState(initial.deliveryIntervalMs);
  const [firstDelay, setFirstDelay] = useState(initial.firstDeliveryDelayMs);
  const quantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const unitPrice = parseMoneyDraft(unitPriceInput, { min: 0.01, max: 1_000_000 });
  const deliveries = parseOptionalDeliveriesDraft(deliveriesInput);
  const canSubmit = quantity !== null && unitPrice !== null && deliveries !== undefined;

  return (
    <div className="contract-negotiation-editor">
      <div className="contract-negotiation-editor-grid">
        <IntegerInput label="每批数量" value={quantityInput} fallbackValue={initial.quantityPerDelivery} min={1} max={1_000_000} error={quantity === null ? '请输入有效整数。' : undefined} onValueChange={setQuantityInput} />
        <MoneyInput label="单位价格" value={unitPriceInput} fallbackValue={initial.unitPrice} min={0.01} max={1_000_000} error={unitPrice === null ? '请输入有效金额。' : undefined} onValueChange={setUnitPriceInput} />
        <SelectInput label="交付周期" value={interval} onChange={(event) => setInterval(Number.parseInt(event.target.value, 10))}>
          {INTERVAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
        <IntegerInput label="总交付批次（可选）" description="留空表示长期合同。" value={deliveriesInput} fallbackValue={initial.totalDeliveries ?? 12} allowEmpty min={2} max={100} error={deliveries === undefined ? '请输入 2～100 的整数，或留空设为长期合同。' : undefined} onValueChange={setDeliveriesInput} />
        <SelectInput label="首次交付" value={firstDelay} onChange={(event) => setFirstDelay(Number.parseInt(event.target.value, 10))}>
          {FIRST_DELAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </SelectInput>
      </div>
      <div className="contract-negotiation-actions">
        <Button disabled={busy || !canSubmit} onClick={() => {
          if (!canSubmit || quantity === null || unitPrice === null || deliveries === undefined) return;
          onSubmit({
            quantityPerDelivery: quantity,
            unitPrice,
            deliveryIntervalMs: interval,
            totalDeliveries: deliveries,
            firstDeliveryDelayMs: firstDelay,
          });
        }}>{submitLabel}</Button>
        <Button variant="text" disabled={busy} onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}

function acceptNegotiation(contract: ProductionContract, negotiation: ProductionContractNegotiation, busy: boolean, run: RunContractAction) {
  if (busy) return;
  if (!window.confirm('接受后服务器会按最终条款重新检查首批货款、双方保证金和仓库空间，并立即进入履约。是否继续？')) return;
  void run(`${contract.id}:negotiation:${negotiation.id}:accept`, () => productionContractActions.acceptNegotiation(contract.id, negotiation.id));
}

export function ContractNegotiationSection({
  contract,
  busy,
  run,
}: {
  contract: ProductionContract;
  busy: boolean;
  run: RunContractAction;
}) {
  const negotiations = contract.negotiations ?? [];
  const [editing, setEditing] = useState<string | null>(null);
  const baseTerms: ProductionContractNegotiationTerms = {
    quantityPerDelivery: contract.quantityPerDelivery,
    unitPrice: contract.unitPrice,
    deliveryIntervalMs: contract.deliveryIntervalMs,
    totalDeliveries: contract.totalDeliveries,
    firstDeliveryDelayMs: contract.firstDeliveryDelayMs,
  };

  if (contract.isPublisher) {
    if (negotiations.length === 0) return null;
    return (
      <section className="contract-negotiation-panel" aria-label="合同议价">
        <div className="contract-negotiation-heading">
          <strong>收到的议价</strong>
          <StatusTag tone={negotiations.some((item) => item.awaitingMyResponse) ? 'warning' : 'info'}>{negotiations.length} 个进行中</StatusTag>
        </div>
        <div className="contract-negotiation-list">
          {negotiations.map((negotiation) => (
            <article key={negotiation.id} className="contract-negotiation-item">
              <header>
                <div><strong>{negotiation.proposerName || '议价玩家'}</strong><span>第 {negotiation.revision} 轮</span></div>
                <StatusTag tone={negotiation.awaitingMyResponse ? 'warning' : 'info'}>{negotiation.awaitingMyResponse ? '等待你处理' : '等待对方'}</StatusTag>
              </header>
              <TermsSummary terms={negotiation.terms} baseTerms={baseTerms} />
              {editing === negotiation.id ? (
                <TermsEditor
                  key={`${negotiation.id}:${negotiation.revision}`}
                  initial={negotiation.terms}
                  busy={busy}
                  submitLabel="发送反报价"
                  onCancel={() => setEditing(null)}
                  onSubmit={(input) => {
                    setEditing(null);
                    void run(`${contract.id}:negotiation:${negotiation.id}:counter`, () => productionContractActions.counterNegotiation(contract.id, negotiation.id, input));
                  }}
                />
              ) : negotiation.awaitingMyResponse ? (
                <div className="contract-negotiation-actions">
                  <Button disabled={busy} onClick={() => acceptNegotiation(contract, negotiation, busy, run)}>接受并签订</Button>
                  <Button variant="secondary" disabled={busy || negotiation.revision >= 5} onClick={() => setEditing(negotiation.id)}>反报价</Button>
                  <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${negotiation.id}:reject`, () => productionContractActions.rejectNegotiation(contract.id, negotiation.id))}>拒绝</Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </section>
    );
  }

  const ownNegotiation = negotiations.find((item) => item.isProposer);
  if (!ownNegotiation) {
    if (editing !== 'new') {
      return (
        <div className="contract-negotiation-entry">
          <Button variant="secondary" disabled={busy} onClick={() => setEditing('new')}>提出议价</Button>
          <span>只修改数量、价格、周期、批次和首次交付；总批次留空即改为长期合同，议价阶段不冻结资产。</span>
        </div>
      );
    }
    return (
      <section className="contract-negotiation-panel" aria-label="提出合同议价">
        <div className="contract-negotiation-heading"><strong>提出议价</strong><StatusTag tone="info">最多 5 轮</StatusTag></div>
        <TermsEditor
          key="new"
          initial={baseTerms}
          busy={busy}
          submitLabel="发送议价"
          onCancel={() => setEditing(null)}
          onSubmit={(input) => {
            setEditing(null);
            void run(`${contract.id}:negotiation:propose`, () => productionContractActions.proposeNegotiation(contract.id, input));
          }}
        />
      </section>
    );
  }

  return (
    <section className="contract-negotiation-panel" aria-label="我的合同议价">
      <div className="contract-negotiation-heading">
        <div><strong>{ownNegotiation.awaitingMyResponse ? '收到反报价' : '我的议价'}</strong><span>第 {ownNegotiation.revision} 轮</span></div>
        <StatusTag tone={ownNegotiation.awaitingMyResponse ? 'warning' : 'info'}>{ownNegotiation.awaitingMyResponse ? '等待你处理' : '等待发布者'}</StatusTag>
      </div>
      <TermsSummary terms={ownNegotiation.terms} baseTerms={baseTerms} />
      {editing === ownNegotiation.id ? (
        <TermsEditor
          key={`${ownNegotiation.id}:${ownNegotiation.revision}`}
          initial={ownNegotiation.terms}
          busy={busy}
          submitLabel="发送再报价"
          onCancel={() => setEditing(null)}
          onSubmit={(input) => {
            setEditing(null);
            void run(`${contract.id}:negotiation:${ownNegotiation.id}:counter`, () => productionContractActions.counterNegotiation(contract.id, ownNegotiation.id, input));
          }}
        />
      ) : ownNegotiation.awaitingMyResponse ? (
        <div className="contract-negotiation-actions">
          <Button disabled={busy} onClick={() => acceptNegotiation(contract, ownNegotiation, busy, run)}>接受并签订</Button>
          <Button variant="secondary" disabled={busy || ownNegotiation.revision >= 5} onClick={() => setEditing(ownNegotiation.id)}>再报价</Button>
          <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${ownNegotiation.id}:reject`, () => productionContractActions.rejectNegotiation(contract.id, ownNegotiation.id))}>拒绝</Button>
        </div>
      ) : (
        <div className="contract-negotiation-actions">
          <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${ownNegotiation.id}:revoke`, () => productionContractActions.revokeNegotiation(contract.id, ownNegotiation.id))}>撤回议价</Button>
        </div>
      )}
    </section>
  );
}
