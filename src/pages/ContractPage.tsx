import { useMemo, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { ProductIconLabel } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, SelectInput } from '../components/ui/FormControls';
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
  type CreateProductionContractInput,
} from '../contracts/api';
import {
  productionContractStateFromGame,
  type ProductionContract,
  type ProductionContractRole,
  type ProductionContractStatus,
} from '../contracts/types';
import { formatCurrency, formatNumber } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';

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

const STATUS_LABELS: Record<ProductionContractStatus, string> = {
  open: '等待承接',
  active: '履约中',
  completed: '已完成',
  cancelled: '已取消',
  terminated: '已终止',
  expired: '已过期',
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
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(timestamp);
}

function statusTone(contract: ProductionContract) {
  if (contract.status === 'completed') return 'success' as const;
  if (contract.status === 'terminated') return 'danger' as const;
  if (contract.status !== 'active') return 'neutral' as const;
  if (contract.graceEndsAt) return 'danger' as const;
  if (contract.issue) return 'warning' as const;
  return 'success' as const;
}

function contractTitle(contract: ProductionContract, productName: string) {
  return `${productName}长期供货合同`;
}

function RoleTag({ contract }: { contract: ProductionContract }) {
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

function HistoryContractRow({ contract, productName }: { contract: ProductionContract; productName: string }) {
  return (
    <div className="contract-history-row">
      <div className="contract-history-copy">
        <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{STATUS_LABELS[contract.status]}</StatusTag></div>
        <h2><ProductIconLabel productId={contract.productId}>{contractTitle(contract, productName)}</ProductIconLabel></h2>
        <p>{formatNumber(contract.completedDeliveries)} / {formatNumber(contract.totalDeliveries)} 批 · {durationLabel(contract.deliveryIntervalMs)}</p>
      </div>
      <div className="contract-history-meta">
        <strong><CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount> / 批</strong>
        <span>{dateTimeLabel(contract.endedAt || contract.completedAt)}</span>
      </div>
    </div>
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
  const parsedUnitPrice = parseIntegerDraft(unitPriceInput, { min: 1, max: 1_000_000 });
  const parsedDeliveries = parseIntegerDraft(deliveriesInput, { min: 2, max: 100 });
  const batchGross = parsedQuantity !== null && parsedUnitPrice !== null
    ? parsedQuantity * parsedUnitPrice
    : null;
  const totalGross = batchGross !== null && parsedDeliveries !== null
    ? batchGross * parsedDeliveries
    : null;
  const bond = batchGross !== null ? Math.ceil(batchGross * 0.2) : null;
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
    const parsed = parseIntegerDraft(value, { min: 1, max: 1_000_000 });
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
      <p className="contract-section-description">只约定商品、价格、周期和批次，不出租工厂，不涉及藏品。</p>
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
            <IntegerInput
              label="单位价格"
              value={unitPriceInput}
              fallbackValue={unitPrice}
              min={1}
              max={1_000_000}
              error={parsedUnitPrice === null ? '请输入 1～1000000 的整数。' : undefined}
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
  const { productionContracts, productionContractSummary } = productionContractStateFromGame(model.game);
  const productNames = useMemo(() => new Map(model.game.products.map((product) => [product.id, product.name])), [model.game.products]);

  const activeContracts = productionContracts
    .filter((contract) => contract.status === 'active' && (contract.isBuyer || contract.isSupplier))
    .sort((left, right) => Number(Boolean(right.graceEndsAt)) - Number(Boolean(left.graceEndsAt)) || Number(right.issue !== null) - Number(left.issue !== null) || Number(left.nextDueAt || Infinity) - Number(right.nextDueAt || Infinity));
  const openContracts = productionContracts.filter((contract) => contract.status === 'open').sort((left, right) => right.createdAt - left.createdAt);
  const pendingContracts = activeContracts.filter((contract) => contract.issue || contract.terminationRequestedBy);
  const historyContracts = productionContracts
    .filter((contract) => !['open', 'active'].includes(contract.status) && (contract.isPublisher || contract.isBuyer || contract.isSupplier))
    .sort((left, right) => Number(right.endedAt || right.completedAt || right.createdAt) - Number(left.endedAt || left.completedAt || left.createdAt));

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

  const visibleCount = tab === 'active'
    ? activeContracts.length
    : tab === 'market'
      ? openContracts.length
      : tab === 'pending'
        ? pendingContracts.length
        : historyContracts.length;

  const emptyMessage = tab === 'active'
    ? '当前没有进行中的长期合作合同。'
    : tab === 'market'
      ? '当前没有可承接的公开合同。'
      : tab === 'pending'
        ? '当前没有需要处理的合同事项。'
        : '当前没有已结束的合同。';

  return (
    <PageLayout
      title="合同"
      description="与其他玩家签订长期周期供货协议，稳定上下游生产合作。合同不绑定工厂、不控制配方，也不涉及藏品。"
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
        <Button id="contract-tab-history" variant="text" role="tab" aria-selected={tab === 'history'} aria-controls="contract-tabpanel" className={tab === 'history' ? 'ui-segmented__button active' : 'ui-segmented__button'} onClick={() => setTab('history')}>合同历史 <span className="contract-tab-count">{historyContracts.length}</span></Button>
      </nav>

      <section
        id="contract-tabpanel"
        className={`contract-list${tab === 'market' ? ' contract-offer-grid' : ''}`}
        role="tabpanel"
        aria-labelledby={`contract-tab-${tab}`}
        tabIndex={0}
        aria-live="polite"
      >
        {visibleCount === 0 ? <EmptyState>{emptyMessage}</EmptyState> : null}
        {tab === 'active' ? activeContracts.map((contract) => (
          <ActiveContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'pending' ? pendingContracts.map((contract) => (
          <ActiveContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'market' ? openContracts.map((contract) => (
          <OpenContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'history' && historyContracts.length > 0 ? (
          <PagePanel className="contract-history-panel">
            {historyContracts.map((contract) => (
              <HistoryContractRow key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} />
            ))}
          </PagePanel>
        ) : null}
      </section>
    </PageLayout>
  );
}
