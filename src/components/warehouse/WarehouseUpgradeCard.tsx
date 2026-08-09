import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OnlineAutoSellAwareGameViewModel } from '../../auto-sell/useOnlineAutoSell';
import {
  AUTO_SELL_PANEL_EVENT,
  consumeAutoSellPanelRequest,
} from '../../auto-sell/autoSellStorage';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { formatMoneyDraft, parseMoneyDraft } from '../../utils/moneyDraft';
import { ProductIcon } from '../icons/ProductIcons';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { MoneyInput } from '../ui/FormControls';
import { Button, Panel, StatusTag, ToggleField, WidgetHeading } from '../ui/layout';

export function WarehouseUpgradeCard({
  model,
  className = '',
  compact = false,
}: {
  model: OnlineAutoSellAwareGameViewModel;
  className?: string;
  compact?: boolean;
}) {
  const { game, showResult, upgradeWarehouse } = model;
  const autoSell = useMemo(() => model.autoSell ?? ({
    policies: {},
    busyProductId: null,
    policyFor: (productId: string) => ({
      enabled: false,
      price: Math.max(0.01, Number(game.products.find((product) => product.id === productId)?.basePrice || 1)),
    }),
    statusFor: (productId: string) => {
      const inventory = game.inventories[productId] ?? { available: 0, frozen: 0 };
      return {
        availableInventory: Math.max(0, Math.floor(Number(inventory.available || 0))),
        productionReserved: 0,
        contractReserved: 0,
        eligibleQuantity: 0,
        blockedByOwnBuy: false,
        hasCrossingBuyer: false,
      };
    },
    setPolicy: () => undefined,
  }), [game.inventories, game.products, model.autoSell]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [autoSellEnabledDraft, setAutoSellEnabledDraft] = useState(false);
  const [autoSellPriceDraft, setAutoSellPriceDraft] = useState('1.00');
  const upgradeUnavailable = game.warehouseUpgradeCost === null || game.warehouseNextCapacityIncrease <= 0;
  const canAfford = game.warehouseUpgradeCost !== null && game.credits >= game.warehouseUpgradeCost;
  const overCapacity = game.warehouseUsedCapacity > game.inventoryCapacity;
  const usagePercent = game.inventoryCapacity > 0
    ? Math.min(100, Math.round((game.warehouseUsedCapacity / game.inventoryCapacity) * 100))
    : 0;
  const capacityScale = Math.max(1, game.inventoryCapacity);
  const orderReserved = game.warehouseOrderReservedQuantity ?? 0;
  const contractReserved = game.warehouseContractReservedQuantity ?? 0;
  const auctionReserved = game.warehouseAuctionReservedQuantity ?? 0;
  const capacitySegments = [
    { id: 'stored', label: '实物库存', value: game.warehouseStoredQuantity },
    { id: 'order', label: '市场订单预占', value: orderReserved },
    { id: 'contract', label: '合同预占', value: contractReserved },
    { id: 'auction', label: '拍卖预占', value: auctionReserved },
  ];
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
      return inventory.available > 0 || inventory.frozen > 0 || autoSell.policyFor(product.id).enabled;
    }),
    [autoSell, game.inventories, game.products],
  );
  const selectedProduct = game.products.find((product) => product.id === selectedProductId) ?? null;
  const selectedAutoSellStatus = selectedProduct ? autoSell.statusFor(selectedProduct.id) : null;
  const selectedPolicy = selectedProduct ? autoSell.policyFor(selectedProduct.id) : null;
  const parsedAutoSellPrice = parseMoneyDraft(autoSellPriceDraft, { min: 0.01 });

  const openAutoSellPanel = useCallback((productId: string) => {
    const product = game.products.find((candidate) => candidate.id === productId);
    if (!product) return;
    const policy = autoSell.policyFor(product.id);
    setSelectedProductId(product.id);
    setAutoSellEnabledDraft(policy.enabled);
    setAutoSellPriceDraft(formatMoneyDraft(policy.price));
  }, [autoSell, game.products]);

  useEffect(() => {
    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested) openAutoSellPanel(requested);
    const handlePanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: number; productId?: string }>).detail;
      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      openAutoSellPanel(detail.productId);
    };
    window.addEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
    return () => window.removeEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
  }, [model.user.id, openAutoSellPanel]);

  async function upgrade() {
    if (submitting || upgradeUnavailable) return;
    setSubmitting(true);
    try {
      await showResult(upgradeWarehouse());
    } finally {
      setSubmitting(false);
    }
  }

  function saveAutoSellPolicy() {
    if (!selectedProduct || parsedAutoSellPrice === null) return;
    autoSell.setPolicy(selectedProduct.id, {
      enabled: autoSellEnabledDraft,
      price: parsedAutoSellPrice,
    });
    model.notify(autoSellEnabledDraft
      ? `${selectedProduct.name}自动出售已开启，最低价 ${parsedAutoSellPrice.toFixed(2)}`
      : `${selectedProduct.name}自动出售已关闭`);
  }

  return (
    <Panel className={`production-surface warehouse-upgrade-card ${compact ? 'compact' : ''} ${className}`.trim()}>
      <WidgetHeading
        title="共享仓库"
        action={(
<div className="warehouse-heading-status">
  {overCapacity ? <StatusTag tone="danger">容量超限</StatusTag> : null}
  <StatusTag tone="info">等级 {formatNumber(game.warehouseLevel)}</StatusTag>
</div>
        )}
      />

      <div className="warehouse-layout">
        <section className="warehouse-management" aria-label="仓库容量与升级">
<div
  className="warehouse-capacity-progress"
  aria-label={`仓库已使用 ${formatNumber(game.warehouseUsedCapacity)}/${formatNumber(game.inventoryCapacity)}，实物库存 ${formatNumber(game.warehouseStoredQuantity)}，市场订单预占 ${formatNumber(orderReserved)}，合同预占 ${formatNumber(contractReserved)}，拍卖预占 ${formatNumber(auctionReserved)}`}
>
  <div>
    <span>已使用</span>
    <strong>{formatNumber(game.warehouseUsedCapacity)}/{formatNumber(game.inventoryCapacity)}</strong>
  </div>
  <div className={`progress-track warehouse-capacity-track ${overCapacity ? 'is-over-capacity' : ''}`} aria-hidden="true">
    {capacitySegments.map((segment) => (
      <span
        className={`warehouse-capacity-segment warehouse-capacity-segment--${segment.id}`}
        key={segment.id}
        style={{ width: `${(Math.max(0, segment.value) / capacityScale) * 100}%` }}
      />
    ))}
  </div>
  <small>{usagePercent}% 已使用 · 所有商品共用容量</small>
</div>

<dl className="warehouse-summary-list">
  {capacitySegments.map((segment) => (
    <div className={`warehouse-summary-item warehouse-summary-item--${segment.id}`} key={segment.id}>
      <dt><span className="warehouse-summary-swatch" aria-hidden="true" />{segment.label}</dt>
      <dd>{formatNumber(segment.value)}</dd>
    </div>
  ))}
  <div className="warehouse-summary-item warehouse-summary-item--available">
    <dt>剩余容量</dt>
    <dd className={game.warehouseAvailableCapacity > 0 ? 'positive' : 'negative'}>{formatNumber(game.warehouseAvailableCapacity)}</dd>
  </div>
</dl>

<div className="warehouse-upgrade-summary">
  <div>
    <span>下一等级容量</span>
    <strong>{formatNumber(game.warehouseNextCapacity)}</strong>
    <small>增加 {formatNumber(game.warehouseNextCapacityIncrease)} 容量</small>
  </div>
  <div>
    <span>升级费用</span>
    <strong>{game.warehouseUpgradeCost === null ? '数值不可用' : <CurrencyAmount>{formatCurrency(game.warehouseUpgradeCost)}</CurrencyAmount>}</strong>
    <small>当前可用资金 <CurrencyAmount>{formatCurrency(game.credits)}</CurrencyAmount></small>
  </div>
</div>

{overCapacity ? <p className="warehouse-capacity-warning">当前占用超过容量，释放库存或扩容前不能继续增加库存或新增预占。</p> : null}

<Button
  block
  onClick={() => void upgrade()}
  disabled={submitting || upgradeUnavailable || !canAfford}
>
  {submitting
    ? '正在扩容…'
    : upgradeUnavailable
      ? '扩容数值不可用'
      : canAfford
        ? <>支付 <CurrencyAmount>{formatCurrency(game.warehouseUpgradeCost ?? 0)}</CurrencyAmount> 扩容</>
        : <>资金不足 · 需要 <CurrencyAmount>{formatCurrency(game.warehouseUpgradeCost ?? 0)}</CurrencyAmount></>}
</Button>
        </section>

        <section className="warehouse-content" aria-label="仓库内容">
<header className="warehouse-content-heading">
  <strong>仓库内容</strong>
</header>

{stockedProducts.length > 0 ? (
  <div className="warehouse-product-grid">
    {stockedProducts.map((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0 };
      const policy = autoSell.policyFor(product.id);
      return (
        <button
          type="button"
          className={`warehouse-product-card ${policy.enabled ? 'is-auto-sell-enabled' : ''}`}
          key={product.id}
          aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，设置自动出售`}
          onClick={() => openAutoSellPanel(product.id)}
        >
          <span className="warehouse-product-card-name">{product.name}</span>
          <span className="warehouse-product-card-icon">
            <ProductIcon productId={product.id} />
          </span>
          <strong className="warehouse-product-card-available">
            可用 {formatNumber(inventory.available)}
          </strong>
          <small className="warehouse-product-card-frozen">
            冻结 {formatNumber(inventory.frozen)}{policy.enabled ? ' · 自动' : ''}
          </small>
        </button>
      );
    })}
  </div>
) : (
  <div className="empty-state warehouse-content-empty">
    <strong>仓库中暂无商品</strong>
    <span>生产或买入商品后，商品会显示在这里。</span>
  </div>
)}

{selectedProduct && selectedAutoSellStatus && selectedPolicy ? (
  <section className="warehouse-auto-sell-panel" aria-label={`${selectedProduct.name}自动出售设置`}>
    <WidgetHeading
      title={`${selectedProduct.name} · 自动出售`}
      action={<Button variant="secondary" onClick={() => setSelectedProductId('')}>关闭面板</Button>}
    />
    <div className="warehouse-auto-sell-status">
      <StatusTag tone="info">仅客户端在线</StatusTag>
      {autoSell.busyProductId === selectedProduct.id ? <StatusTag tone="success">正在自动出售</StatusTag> : null}
      {autoSellEnabledDraft && selectedAutoSellStatus.blockedByOwnBuy ? <StatusTag tone="warning">自己的买单阻止自动出售</StatusTag> : null}
      {autoSellEnabledDraft && !selectedAutoSellStatus.blockedByOwnBuy ? (
        <StatusTag tone={selectedAutoSellStatus.hasCrossingBuyer ? 'success' : 'neutral'}>
          {selectedAutoSellStatus.hasCrossingBuyer ? '已有买盘达到价格' : '等待达到价格的买盘'}
        </StatusTag>
      ) : null}
    </div>
    <div className="warehouse-auto-sell-summary">
      <div><span>自由可用</span><strong>{formatNumber(selectedAutoSellStatus.availableInventory)}</strong></div>
      <div><span>生产预定</span><strong>{formatNumber(selectedAutoSellStatus.productionReserved)}</strong></div>
      <div><span>合同预定</span><strong>{formatNumber(selectedAutoSellStatus.contractReserved)}</strong></div>
      <div><span>预计可自动出售</span><strong>{formatNumber(selectedAutoSellStatus.eligibleQuantity)}</strong></div>
    </div>
    <ToggleField
      label="启用自动出售"
      description="仅当前客户端在线时生效；关闭页面、退出登录或断网后不会继续发起自动成交。"
      checked={autoSellEnabledDraft}
      onChange={(event) => setAutoSellEnabledDraft(event.target.checked)}
    />
    <MoneyInput
      label="最低自动出售价格"
      description="只有市场中现有买单价格达到或高于该价格时才会出售。"
      value={autoSellPriceDraft}
      fallbackValue={selectedPolicy.price}
      min={0.01}
      wheelStep={0.01}
      error={parsedAutoSellPrice === null ? '请输入不低于 0.01、最多两位小数的价格' : undefined}
      onValueChange={setAutoSellPriceDraft}
    />
    <p className="warehouse-auto-sell-note">
      数量由服务器成交前重新计算：先保留开启中工厂下一完整周期的原料，再保留自动准备的合同批次；普通手动卖单仍只在市场页发布。
    </p>
    <Button block disabled={parsedAutoSellPrice === null} onClick={saveAutoSellPolicy}>
      {autoSellEnabledDraft ? '保存并启用自动出售' : '保存并关闭自动出售'}
    </Button>
  </section>
) : null}
        </section>
      </div>
    </Panel>
  );
}
