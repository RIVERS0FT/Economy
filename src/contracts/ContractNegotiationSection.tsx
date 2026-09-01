import { useState, type ReactNode } from 'react';
import { ChevronIcon } from '../components/icons/GameIcons';
import { IntegerInput, MoneyInput } from '../components/ui/FormControls';
import { Button, DataList, DataRow, StatusTag } from '../components/ui/layout';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { CompactNumber } from '../components/ui/CompactNumber';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import { productionContractActions, type SupplyNegotiationTermsInput } from './api';
import type { ProductionContract, ProductionContractNegotiationTerms } from './types';

type RunContractAction = (key: string, operation: () => Promise<{ result: { ok: boolean; message: string } }>) => Promise<void>;

function optionalDays(value: string): number | null | undefined {
  if (value.trim() === '') return null;
  return parseIntegerDraft(value, { min: 1, max: 3650 }) ?? undefined;
}

function daysLabel(value: number | null) {
  return value === null ? '长期' : `${value} 天`;
}

function TermChange({ from, to }: { from: ReactNode; to: ReactNode }) {
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
  const quantity = terms.dailyMaxQuantity === baseTerms.dailyMaxQuantity
    ? <CompactNumber value={terms.dailyMaxQuantity} />
    : <TermChange from={<CompactNumber value={baseTerms.dailyMaxQuantity} />} to={<CompactNumber value={terms.dailyMaxQuantity} />} />;
  const price = terms.unitPrice === baseTerms.unitPrice
    ? <CurrencyAmount>{terms.unitPrice}</CurrencyAmount>
    : <TermChange from={<CurrencyAmount>{baseTerms.unitPrice}</CurrencyAmount>} to={<CurrencyAmount>{terms.unitPrice}</CurrencyAmount>} />;
  const duration = terms.durationDays === baseTerms.durationDays
    ? daysLabel(terms.durationDays)
    : <TermChange from={daysLabel(baseTerms.durationDays)} to={daysLabel(terms.durationDays)} />;
  const startDelay = terms.startDelayDays === baseTerms.startDelayDays
    ? `${terms.startDelayDays} 天`
    : <TermChange from={`${baseTerms.startDelayDays} 天`} to={`${terms.startDelayDays} 天`} />;

  return (
    <DataList className="compact contract-negotiation-summary">
      <DataRow label="每日最大供应量" value={quantity} />
      <DataRow label="固定价格" value={price} />
      <DataRow label="合同时间" value={duration} />
      <DataRow label="开始延迟" value={startDelay} />
    </DataList>
  );
}

function TermsEditor({ initial, busy, submitLabel, onSubmit, onCancel }: {
  initial: ProductionContractNegotiationTerms;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: SupplyNegotiationTermsInput) => void;
  onCancel: () => void;
}) {
  const [quantityInput, setQuantityInput] = useState(String(initial.dailyMaxQuantity));
  const [unitPriceInput, setUnitPriceInput] = useState(String(initial.unitPrice));
  const [durationInput, setDurationInput] = useState(initial.durationDays === null ? '' : String(initial.durationDays));
  const [startDelayInput, setStartDelayInput] = useState(String(initial.startDelayDays));
  const quantity = parseIntegerDraft(quantityInput, { min: 1, max: 1_000_000 });
  const unitPrice = parseMoneyDraft(unitPriceInput, { min: 0.01, max: 1_000_000 });
  const durationDays = optionalDays(durationInput);
  const startDelayDays = parseIntegerDraft(startDelayInput, { min: 0, max: 365 });
  const canSubmit = quantity !== null && unitPrice !== null && durationDays !== undefined && startDelayDays !== null;
  return (
    <div className="contract-negotiation-editor">
      <div className="contract-negotiation-editor-grid">
        <IntegerInput label="每日最大供应量" value={quantityInput} fallbackValue={initial.dailyMaxQuantity} min={1} max={1_000_000} error={quantity === null ? '请输入有效整数。' : undefined} onValueChange={setQuantityInput} />
        <MoneyInput label="固定价格" value={unitPriceInput} fallbackValue={initial.unitPrice} min={0.01} max={1_000_000} error={unitPrice === null ? '请输入有效金额。' : undefined} onValueChange={setUnitPriceInput} />
        <IntegerInput label="合同时间（天，可选）" description="留空表示长期合同。" value={durationInput} fallbackValue={initial.durationDays ?? 30} allowEmpty min={1} max={3650} error={durationDays === undefined ? '请输入 1～3650 天，或留空。' : undefined} onValueChange={setDurationInput} />
        <IntegerInput label="开始延迟（天）" value={startDelayInput} fallbackValue={initial.startDelayDays} min={0} max={365} error={startDelayDays === null ? '请输入 0～365 天。' : undefined} onValueChange={setStartDelayInput} />
      </div>
      <div className="contract-negotiation-actions">
        <Button disabled={busy || !canSubmit} onClick={() => {
          if (!canSubmit || quantity === null || unitPrice === null || durationDays === undefined || startDelayDays === null) return;
          onSubmit({ dailyMaxQuantity: quantity, unitPrice, durationDays, startDelayDays });
        }}>{submitLabel}</Button>
        <Button variant="text" disabled={busy} onClick={onCancel}>取消</Button>
      </div>
    </div>
  );
}

export function ContractNegotiationSection({ contract, busy, run }: { contract: ProductionContract; busy: boolean; run: RunContractAction }) {
  if (contract.supplyMode !== 'daily') return null;
  const baseTerms: ProductionContractNegotiationTerms = {
    dailyMaxQuantity: contract.dailyMaxQuantity ?? contract.quantityPerDelivery,
    unitPrice: contract.unitPrice,
    durationDays: contract.durationDays ?? null,
    startDelayDays: contract.startDelayDays ?? 0,
  };
  const negotiations = contract.negotiations ?? [];
  const [editing, setEditing] = useState<string | null>(null);

  if (contract.isPublisher) {
    if (negotiations.length === 0) return null;
    return (
      <section className="contract-negotiation-panel" aria-label="合同议价">
        <div className="contract-negotiation-heading"><strong>收到的议价</strong><StatusTag tone="info">{negotiations.length} 个进行中</StatusTag></div>
        {negotiations.map((item) => (
          <article key={item.id} className="contract-negotiation-item">
            <header><div><strong>{item.proposerName || '议价玩家'}</strong><span>第 {item.revision} 轮</span></div><StatusTag tone={item.awaitingMyResponse ? 'warning' : 'info'}>{item.awaitingMyResponse ? '等待你处理' : '等待对方'}</StatusTag></header>
            <TermsSummary terms={item.terms} baseTerms={baseTerms} />
            {editing === item.id ? (
              <TermsEditor initial={item.terms} busy={busy} submitLabel="发送反报价" onCancel={() => setEditing(null)} onSubmit={(input) => { setEditing(null); void run(`${contract.id}:negotiation:${item.id}:counter`, () => productionContractActions.counterNegotiation(contract.id, item.id, input)); }} />
            ) : item.awaitingMyResponse ? (
              <div className="contract-negotiation-actions">
                <Button disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${item.id}:accept`, () => productionContractActions.acceptNegotiation(contract.id, item.id))}>接受并签订</Button>
                <Button variant="secondary" disabled={busy || item.revision >= 5} onClick={() => setEditing(item.id)}>反报价</Button>
                <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${item.id}:reject`, () => productionContractActions.rejectNegotiation(contract.id, item.id))}>拒绝</Button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    );
  }

  const own = negotiations.find((item) => item.isProposer);
  if (!own) {
    if (editing !== 'new') return <div className="contract-negotiation-entry"><Button variant="secondary" disabled={busy} onClick={() => setEditing('new')}>提出议价</Button><span>议价只调整每日最大供应量、固定价格和按天计算的合同时间。</span></div>;
    return <section className="contract-negotiation-panel" aria-label="提出合同议价"><div className="contract-negotiation-heading"><strong>提出议价</strong><StatusTag tone="info">最多 5 轮</StatusTag></div><TermsEditor initial={baseTerms} busy={busy} submitLabel="发送议价" onCancel={() => setEditing(null)} onSubmit={(input) => { setEditing(null); void run(`${contract.id}:negotiation:propose`, () => productionContractActions.proposeNegotiation(contract.id, input)); }} /></section>;
  }
  return (
    <section className="contract-negotiation-panel" aria-label="我的合同议价">
      <div className="contract-negotiation-heading"><div><strong>{own.awaitingMyResponse ? '收到反报价' : '我的议价'}</strong><span>第 {own.revision} 轮</span></div><StatusTag tone={own.awaitingMyResponse ? 'warning' : 'info'}>{own.awaitingMyResponse ? '等待你处理' : '等待发布者'}</StatusTag></div>
      <TermsSummary terms={own.terms} baseTerms={baseTerms} />
      {editing === own.id ? <TermsEditor initial={own.terms} busy={busy} submitLabel="发送再报价" onCancel={() => setEditing(null)} onSubmit={(input) => { setEditing(null); void run(`${contract.id}:negotiation:${own.id}:counter`, () => productionContractActions.counterNegotiation(contract.id, own.id, input)); }} /> : (
        <div className="contract-negotiation-actions">
          {own.awaitingMyResponse ? <><Button disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${own.id}:accept`, () => productionContractActions.acceptNegotiation(contract.id, own.id))}>接受并签订</Button><Button variant="secondary" disabled={busy || own.revision >= 5} onClick={() => setEditing(own.id)}>再报价</Button><Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${own.id}:reject`, () => productionContractActions.rejectNegotiation(contract.id, own.id))}>拒绝</Button></> : <Button variant="text" disabled={busy} onClick={() => void run(`${contract.id}:negotiation:${own.id}:revoke`, () => productionContractActions.revokeNegotiation(contract.id, own.id))}>撤回议价</Button>}
        </div>
      )}
    </section>
  );
}
