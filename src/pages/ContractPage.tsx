import { useMemo, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import {
  Button,
  EmptyState,
  MetricCard,
  PageLayout,
  Panel,
  StatusTag,
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
  const percentage = Math.min(100, Math.round(contract.completedDeliveries / contract.totalDeliveries * 100));
  return (
    <div className="contract-progress" aria-label={`已完成 ${contract.completedDeliveries} / ${contract.totalDeliveries} 批`}>
      <div className="contract-progress-track"><span style={{ width: `${percentage}%` }} /></div>
      <strong>{formatNumber(contract.completedDeliveries)} / {formatNumber(contract.totalDeliveries)} 批</strong>
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

  return (
    <Panel className={`contract-card contract-card--${contract.graceEndsAt ? 'danger' : contract.issue ? 'attention' : 'normal'}`}>
      <header className="contract-card-heading">
        <div>
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{contract.graceEndsAt ? '宽限期' : STATUS_LABELS[contract.status]}</StatusTag></div>
          <h2>{contractTitle(contract, productName)}</h2>
          <p>合作方：{counterparty || '等待服务器同步'}</p>
        </div>
        <ContractProgress contract={contract} />
      </header>

      <div className="contract-terms-grid">
        <div><span>每批商品</span><strong>{productName} × {formatNumber(contract.quantityPerDelivery)}</strong></div>
        <div><span>合同单价</span><strong><CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount></strong></div>
        <div><span>每批货款</span><strong><CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount></strong></div>
        <div><span>交付周期</span><strong>{durationLabel(contract.deliveryIntervalMs)}</strong></div>
      </div>

      <div className="contract-readiness-grid">
        <div>
          <span>供应方商品</span>
          <strong>{formatNumber(contract.supplierReservedQuantity)} / {formatNumber(contract.quantityPerDelivery)}</strong>
        </div>
        <div>
          <span>采购方货款</span>
          <strong><CurrencyAmount>{formatCurrency(contract.buyerEscrowCredits)}</CurrencyAmount> / <CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount></strong>
        </div>
      </div>

      <div className="contract-schedule-row">
        <div><span>下次交付</span><strong>{dateTimeLabel(contract.nextDueAt)}</strong></div>
        {contract.graceEndsAt ? <div><span>宽限期结束</span><strong>{dateTimeLabel(contract.graceEndsAt)}</strong></div> : null}
      </div>

      {contract.issue ? <p className="contract-issue" role="status">{contract.issue}</p> : <p className="contract-ok">本批履约条件正常</p>}

      <footer className="contract-card-actions">
        {canPrepare ? <Button disabled={busy} onClick={() => run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>准备本批商品</Button> : null}
        {canFund ? <Button disabled={busy} onClick={() => run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>补充本批货款</Button> : null}
        {contract.isSupplier ? (
          <Button variant="secondary" disabled={busy} onClick={() => run(`${contract.id}:auto-reserve`, () => productionContractActions.setAutoReserve(contract.id, !contract.supplierAutoReserve))}>
            {contract.supplierAutoReserve ? '关闭自动准备' : '开启自动准备'}
          </Button>
        ) : null}
        {contract.isBuyer ? (
          <Button variant="secondary" disabled={busy} onClick={() => run(`${contract.id}:auto-fund`, () => productionContractActions.setAutoFund(contract.id, !contract.buyerAutoFund))}>
            {contract.buyerAutoFund ? '关闭自动补款' : '开启自动补款'}
          </Button>
        ) : null}
        {!contract.terminationRequestedBy ? (
          <Button
            variant="text"
            disabled={busy}
            onClick={() => {
              if (window.confirm('合同将在当前批次完成后结束，是否继续？')) {
                void run(`${contract.id}:notice`, () => productionContractActions.requestTermination(contract.id));
              }
            }}
          >申请结束</Button>
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
    </Panel>
  );
}

function OpenContractCard({ contract, productName, busy, run }: ContractCardProps) {
  return (
    <Panel className="contract-card contract-offer-card">
      <header className="contract-card-heading">
        <div>
          <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag>{STATUS_LABELS[contract.status]}</StatusTag></div>
          <h2>{contract.publisherRole === 'buyer' ? `采购 ${productName}` : `供应 ${productName}`}</h2>
          <p>发布者：{contract.publisherName}</p>
        </div>
        <strong className="contract-offer-price"><CurrencyAmount>{formatCurrency(contract.unitPrice)}</CurrencyAmount><small>/ 个</small></strong>
      </header>
      <div className="contract-terms-grid">
        <div><span>每批数量</span><strong>{formatNumber(contract.quantityPerDelivery)}</strong></div>
        <div><span>每批货款</span><strong><CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount></strong></div>
        <div><span>交付周期</span><strong>{durationLabel(contract.deliveryIntervalMs)}</strong></div>
        <div><span>总批次</span><strong>{formatNumber(contract.totalDeliveries)} 批</strong></div>
      </div>
      <p className="contract-offer-note">合同不会控制你的工厂或配方；你需要自行保证每批商品、资金和仓库条件。</p>
      <footer className="contract-card-actions">
        {contract.isPublisher ? (
          <Button variant="danger" disabled={busy} onClick={() => run(`${contract.id}:cancel`, () => productionContractActions.cancel(contract.id))}>取消发布</Button>
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
    </Panel>
  );
}

function HistoryContractCard({ contract, productName }: { contract: ProductionContract; productName: string }) {
  return (
    <Panel className="contract-history-card">
      <div>
        <div className="contract-card-tags"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{STATUS_LABELS[contract.status]}</StatusTag></div>
        <h2>{contractTitle(contract, productName)}</h2>
        <p>{formatNumber(contract.completedDeliveries)} / {formatNumber(contract.totalDeliveries)} 批 · {durationLabel(contract.deliveryIntervalMs)}</p>
      </div>
      <div className="contract-history-meta">
        <strong><CurrencyAmount>{formatCurrency(contract.batchGross)}</CurrencyAmount> / 批</strong>
        <span>{dateTimeLabel(contract.endedAt || contract.completedAt)}</span>
      </div>
    </Panel>
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
  const [publisherRole, setPublisherRole] = useState<ProductionContractRole>('buyer');
  const [productId, setProductId] = useState(model.game.products[0]?.id ?? 'wheat');
  const [quantity, setQuantity] = useState(100);
  const [unitPrice, setUnitPrice] = useState(model.game.products[0]?.basePrice ?? 1);
  const [interval, setIntervalValue] = useState<number>(60 * 60 * 1000);
  const [deliveries, setDeliveries] = useState(12);
  const [firstDelay, setFirstDelay] = useState<number>(60 * 60 * 1000);
  const batchGross = Math.max(0, quantity * unitPrice);

  const submit = async () => {
    const input: CreateProductionContractInput = {
      publisherRole,
      productId,
      quantityPerDelivery: Math.floor(quantity),
      unitPrice: Math.floor(unitPrice),
      deliveryIntervalMs: interval,
      totalDeliveries: Math.floor(deliveries),
      firstDeliveryDelayMs: firstDelay,
    };
    await run('publish', () => productionContractActions.create(input));
  };

  return (
    <Panel className="contract-publish-panel">
      <header className="contract-publish-heading">
        <div><h2>发布长期供货合同</h2><p>只约定商品、价格、周期和批次，不出租工厂，不涉及藏品。</p></div>
        <Button variant="text" onClick={close}>关闭</Button>
      </header>
      <div className="contract-publish-grid">
        <label><span>发布方向</span><select value={publisherRole} onChange={(event) => setPublisherRole(event.target.value as ProductionContractRole)}><option value="buyer">我长期采购</option><option value="supplier">我长期供应</option></select></label>
        <label><span>合同商品</span><select value={productId} onChange={(event) => { const next = event.target.value; setProductId(next); setUnitPrice(model.game.products.find((item) => item.id === next)?.basePrice ?? 1); }}>{model.game.products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        <label><span>每批数量</span><input type="number" min="1" max="1000000" step="1" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        <label><span>单位价格</span><input type="number" min="1" max="1000000" step="1" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} /></label>
        <label><span>交付周期</span><select value={interval} onChange={(event) => setIntervalValue(Number(event.target.value))}>{INTERVAL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>总交付批次</span><input type="number" min="2" max="100" step="1" value={deliveries} onChange={(event) => setDeliveries(Number(event.target.value))} /></label>
        <label><span>首次交付</span><select value={firstDelay} onChange={(event) => setFirstDelay(Number(event.target.value))}>{FIRST_DELAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>
      <div className="contract-publish-summary">
        <div><span>每批货款</span><strong><CurrencyAmount>{formatCurrency(batchGross)}</CurrencyAmount></strong></div>
        <div><span>理论合同总额</span><strong><CurrencyAmount>{formatCurrency(batchGross * deliveries)}</CurrencyAmount></strong></div>
        <div><span>履约保证金</span><strong><CurrencyAmount>{formatCurrency(Math.ceil(batchGross * 0.2))}</CurrencyAmount> / 方</strong></div>
      </div>
      <p className="contract-offer-note">签订时采购方冻结首批货款和 20% 保证金，供应方冻结 20% 保证金。每批成功交付按卖方累计货款收取 1% 市场服务费。</p>
      <Button disabled={busy || !productId || quantity < 1 || unitPrice < 1 || deliveries < 2} onClick={() => void submit()}>发布合同</Button>
    </Panel>
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

  const list = tab === 'active' ? activeContracts : tab === 'market' ? openContracts : tab === 'pending' ? pendingContracts : historyContracts;

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

      <nav className="contract-tabs" aria-label="合同页面分类">
        <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}>进行中的合同 <span>{activeContracts.length}</span></button>
        <button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>合同广场 <span>{openContracts.length}</span></button>
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>待处理 <span>{pendingContracts.length}</span></button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>合同历史 <span>{historyContracts.length}</span></button>
      </nav>

      <section className="contract-list" aria-live="polite">
        {list.length === 0 ? (
          <EmptyState>
            {tab === 'active' ? '当前没有进行中的长期合作合同。' : tab === 'market' ? '当前没有可承接的公开合同。' : tab === 'pending' ? '当前没有需要处理的合同事项。' : '当前没有已结束的合同。'}
          </EmptyState>
        ) : null}
        {tab === 'active' || tab === 'pending' ? activeContracts.filter((contract) => tab === 'active' || pendingContracts.includes(contract)).map((contract) => (
          <ActiveContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'market' ? openContracts.map((contract) => (
          <OpenContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} busy={Boolean(busyKey)} run={run} />
        )) : null}
        {tab === 'history' ? historyContracts.map((contract) => (
          <HistoryContractCard key={contract.id} contract={contract} productName={productNames.get(contract.productId) ?? contract.productId} />
        )) : null}
      </section>
    </PageLayout>
  );
}
