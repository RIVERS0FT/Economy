import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  OnlineAutoTradeController,
} from '../../auto-trade/useOnlineAutoTrade';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import {
  AUTO_SELL_PANEL_EVENT,
  consumeAutoSellPanelRequest,
} from '../../auto-sell/autoSellStorage';
import { formatNumber } from '../../utils/formatters';
import { parseIntegerDraft } from '../../utils/integerDraft';
import { formatMoneyDraft, parseMoneyDraft } from '../../utils/moneyDraft';
import { ProductIcon } from '../icons/ProductIcons';
import { IntegerInput, MoneyInput } from '../ui/FormControls';
import { MobileWorkspaceDetailSheet } from '../ui/MobileWorkspaceDetailSheet';
import { RichSelectInput, type RichSelectOption } from '../ui/RichSelectInput';
import { Button, PagePanel, Panel, StatusTag, ToggleField, WidgetHeading } from '../ui/layout';

function isMobileMarketAutoTradeLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

type AutoTradeMode = 'buy' | 'sell';
type AutoTradeCapableGameViewModel = LoadedGameViewModel & {
  autoTrade?: OnlineAutoTradeController;
};

export function MarketAutoTradePanel({
  model,
  className = '',
  requestedProductId = null,
  fixedProductId = null,
}: {
  model: AutoTradeCapableGameViewModel;
  className?: string;
  requestedProductId?: string | null;
  fixedProductId?: string | null;
}) {
  const { game } = model;
  const autoTrade = useMemo<OnlineAutoTradeController>(() => model.autoTrade ?? ({
    buyPolicies: {},
    sellPolicies: {},
    busyProductId: null,
    busySide: null,
    buyPolicyFor: (productId: string) => ({
      enabled: false,
      maxPrice: Math.max(0.01, Number(game.products.find((product) => product.id === productId)?.basePrice || 1)),
      targetFreeInventory: 0,
    }),
    sellPolicyFor: (productId: string) => ({
      enabled: false,
      price: Math.max(0.01, Number(game.products.find((product) => product.id === productId)?.basePrice || 1)),
      minimumFreeInventory: 0,
    }),
    statusFor: (productId: string) => {
      const inventory = game.inventories[productId] ?? { available: 0, frozen: 0, inTransit: 0 };
      const availableInventory = Math.max(0, Math.floor(Number(inventory.available || 0)));
      return {
        availableInventory,
        productionReserved: 0,
        contractReserved: 0,
        currentFreeInventory: availableInventory,
        buyDesiredQuantity: 0,
        buyEligibleQuantity: 0,
        buyFundingLimited: false,
        blockedBuyByOwnSell: false,
        hasCrossingSeller: false,
        hasManagedBuyOrder: false,
        buyNeedsMaintenance: false,
        sellEligibleQuantity: availableInventory,
        blockedSellByOwnBuy: false,
        hasCrossingBuyer: false,
        hasManagedSellOrder: false,
        sellNeedsMaintenance: false,
      };
    },
    setPolicy: async () => ({ ok: false, message: '自动交易控制器不可用' }),
  }), [game.inventories, game.products, model.autoTrade]);
  const [selectedProductId, setSelectedProductId] = useState(fixedProductId ?? '');
  const [activeMode, setActiveMode] = useState<AutoTradeMode>('buy');
  const [isMobileAutoTradeOpen, setMobileAutoTradeOpen] = useState(false);
  const [autoBuyEnabledDraft, setAutoBuyEnabledDraft] = useState(false);
  const [autoBuyPriceDraft, setAutoBuyPriceDraft] = useState('1.00');
  const [autoBuyTargetInventoryDraft, setAutoBuyTargetInventoryDraft] = useState('0');
  const [autoSellEnabledDraft, setAutoSellEnabledDraft] = useState(false);
  const [autoSellPriceDraft, setAutoSellPriceDraft] = useState('1.00');
  const [autoSellMinimumInventoryDraft, setAutoSellMinimumInventoryDraft] = useState('0');
  const [savingAutoTradePolicy, setSavingAutoTradePolicy] = useState(false);
  const autoTradeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileAutoTradeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const handledRequestedProductRef = useRef<string | null>(null);

  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
      return inventory.available > 0 || inventory.frozen > 0
        || autoTrade.buyPolicyFor(product.id).enabled
        || autoTrade.sellPolicyFor(product.id).enabled;
    }),
    [autoTrade, game.inventories, game.products],
  );
  const productOptions = useMemo<RichSelectOption[]>(() => [
    { value: '', label: '选择商品' },
    ...game.products.map((product) => ({
      value: product.id,
      label: product.name,
      visual: <ProductIcon productId={product.id} />,
    })),
  ], [game.products]);
  const selectedProduct = game.products.find((product) => product.id === selectedProductId) ?? null;
  const fixedMode = Boolean(fixedProductId);
  const selectedStatus = selectedProduct ? autoTrade.statusFor(selectedProduct.id) : null;
  const selectedBuyPolicy = selectedProduct ? autoTrade.buyPolicyFor(selectedProduct.id) : null;
  const selectedSellPolicy = selectedProduct ? autoTrade.sellPolicyFor(selectedProduct.id) : null;

  const parsedAutoBuyPrice = parseMoneyDraft(autoBuyPriceDraft, { min: 0.01 });
  const parsedAutoBuyTargetInventory = parseIntegerDraft(autoBuyTargetInventoryDraft, { min: 0 });
  const parsedAutoSellPrice = parseMoneyDraft(autoSellPriceDraft, { min: 0.01 });
  const parsedAutoSellMinimumInventory = parseIntegerDraft(autoSellMinimumInventoryDraft, { min: 0 });
  const autoTradeConflict = useMemo(() => {
    if (!autoBuyEnabledDraft || !autoSellEnabledDraft) return '';
    if (
      parsedAutoBuyTargetInventory !== null
      && parsedAutoSellMinimumInventory !== null
      && parsedAutoBuyTargetInventory > parsedAutoSellMinimumInventory
    ) return '自动采购目标自由库存不能高于自动出售最低自由库存';
    if (
      parsedAutoBuyPrice !== null
      && parsedAutoSellPrice !== null
      && parsedAutoBuyPrice >= parsedAutoSellPrice
    ) return '最高自动采购价格必须低于最低自动出售价格';
    return '';
  }, [
    autoBuyEnabledDraft,
    autoSellEnabledDraft,
    parsedAutoBuyPrice,
    parsedAutoBuyTargetInventory,
    parsedAutoSellMinimumInventory,
    parsedAutoSellPrice,
  ]);

  const resolveProductTrigger = useCallback((productId: string) => (
    Array.from(document.querySelectorAll<HTMLButtonElement>('.market-auto-trade-product-card[data-product-id]'))
      .find((button) => button.dataset.productId === productId) ?? null
  ), []);

  const loadProductDrafts = useCallback((productId: string) => {
    const product = game.products.find((candidate) => candidate.id === productId);
    if (!product) return false;
    const buyPolicy = autoTrade.buyPolicyFor(product.id);
    const sellPolicy = autoTrade.sellPolicyFor(product.id);
    setSelectedProductId(product.id);
    setAutoBuyEnabledDraft(buyPolicy.enabled);
    setAutoBuyPriceDraft(formatMoneyDraft(buyPolicy.maxPrice));
    setAutoBuyTargetInventoryDraft(String(buyPolicy.targetFreeInventory));
    setAutoSellEnabledDraft(sellPolicy.enabled);
    setAutoSellPriceDraft(formatMoneyDraft(sellPolicy.price));
    setAutoSellMinimumInventoryDraft(String(sellPolicy.minimumFreeInventory));
    return true;
  }, [autoTrade, game.products]);

  useEffect(() => {
    if (!fixedProductId) return;
    loadProductDrafts(fixedProductId);
  }, [fixedProductId, loadProductDrafts]);

  const openAutoTradePanel = useCallback((
    productId?: string,
    trigger?: HTMLButtonElement | null,
    mode?: AutoTradeMode,
  ) => {
    if (productId && !loadProductDrafts(productId)) return;
    autoTradeTriggerRef.current = trigger
      ?? (productId ? resolveProductTrigger(productId) : null)
      ?? mobileAutoTradeTriggerRef.current
      ?? autoTradeTriggerRef.current;
    if (mode) setActiveMode(mode);
    if (isMobileMarketAutoTradeLayout()) setMobileAutoTradeOpen(true);
  }, [loadProductDrafts, resolveProductTrigger]);

  useEffect(() => {
    const requested = consumeAutoSellPanelRequest(model.user.id);
    if (requested && (!fixedProductId || requested === fixedProductId)) {
      openAutoTradePanel(requested, undefined, 'sell');
    }
    const handlePanelRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: number; productId?: string }>).detail;
      if (Number(detail?.userId) !== Number(model.user.id) || !detail?.productId) return;
      if (fixedProductId && detail.productId !== fixedProductId) return;
      openAutoTradePanel(detail.productId, undefined, 'sell');
    };
    window.addEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
    return () => window.removeEventListener(AUTO_SELL_PANEL_EVENT, handlePanelRequest);
  }, [fixedProductId, model.user.id, openAutoTradePanel]);

  useEffect(() => {
    if (!requestedProductId || handledRequestedProductRef.current === requestedProductId) return;
    if (fixedProductId && requestedProductId !== fixedProductId) return;
    handledRequestedProductRef.current = requestedProductId;
    openAutoTradePanel(requestedProductId, undefined, 'sell');
  }, [fixedProductId, openAutoTradePanel, requestedProductId]);

  const selectProduct = useCallback((productId: string) => {
    if (!productId) {
      setSelectedProductId('');
      return;
    }
    loadProductDrafts(productId);
  }, [loadProductDrafts]);

  async function saveAutoTradePolicy() {
    if (
      savingAutoTradePolicy
      || !selectedProduct
      || parsedAutoBuyPrice === null
      || parsedAutoBuyTargetInventory === null
      || parsedAutoSellPrice === null
      || parsedAutoSellMinimumInventory === null
      || autoTradeConflict
    ) return;
    setSavingAutoTradePolicy(true);
    try {
      const result = await autoTrade.setPolicy(selectedProduct.id, {
        buy: {
          enabled: autoBuyEnabledDraft,
          maxPrice: parsedAutoBuyPrice,
          targetFreeInventory: parsedAutoBuyTargetInventory,
        },
        sell: {
          enabled: autoSellEnabledDraft,
          price: parsedAutoSellPrice,
          minimumFreeInventory: parsedAutoSellMinimumInventory,
        },
      });
      model.notify(result.message);
    } finally {
      setSavingAutoTradePolicy(false);
    }
  }

  const renderProductSelector = () => (
    <RichSelectInput
      label="商品"
      value={selectedProductId}
      options={productOptions}
      onValueChange={selectProduct}
      description="可选择任意商品，包括当前库存为 0 的商品。"
      aria-label="自动交易商品"
    />
  );

  const renderTradeTabs = () => (
    <div className="warehouse-auto-trade-tabs" role="group" aria-label="自动交易方向">
      <Button
        variant={activeMode === 'buy' ? 'primary' : 'secondary'}
        aria-pressed={activeMode === 'buy'}
        onClick={() => setActiveMode('buy')}
      >
        自动采购
      </Button>
      <Button
        variant={activeMode === 'sell' ? 'primary' : 'secondary'}
        aria-pressed={activeMode === 'sell'}
        onClick={() => setActiveMode('sell')}
      >
        自动出售
      </Button>
    </div>
  );

  const renderAutoBuyFields = () => {
    if (!selectedProduct || !selectedStatus || !selectedBuyPolicy) return null;
    const busy = autoTrade.busyProductId === selectedProduct.id && autoTrade.busySide === 'buy';
    return (
      <>
        <div className="warehouse-auto-trade-status">
          <StatusTag tone="info">设置保存至存档 · 在线维护买单</StatusTag>
          {busy ? <StatusTag tone="success">正在维护自动买单</StatusTag> : null}
          {autoBuyEnabledDraft && selectedStatus.blockedBuyByOwnSell ? (
            <StatusTag tone="warning">自己的卖单阻止自动采购</StatusTag>
          ) : null}
          {autoBuyEnabledDraft && selectedStatus.buyFundingLimited ? (
            <StatusTag tone="warning">可用资金限制采购数量</StatusTag>
          ) : null}
          {autoBuyEnabledDraft && !selectedStatus.blockedBuyByOwnSell ? (
            <StatusTag tone={selectedStatus.hasManagedBuyOrder || selectedStatus.hasCrossingSeller ? 'success' : 'neutral'}>
              {selectedStatus.hasManagedBuyOrder
                ? '已在市场挂单采购'
                : selectedStatus.hasCrossingSeller ? '已有卖盘达到价格' : '等待维护市场需求'}
            </StatusTag>
          ) : null}
        </div>
        <div className="warehouse-auto-trade-summary">
          <div><span>当前可用</span><strong>{formatNumber(selectedStatus.availableInventory)}</strong></div>
          <div className="is-primary is-buy"><span>预计自动采购</span><strong>{formatNumber(selectedStatus.buyEligibleQuantity)}</strong></div>
          <div><span>当前自由库存</span><strong>{formatNumber(selectedStatus.currentFreeInventory)}</strong></div>
          <div><span>生产预定</span><strong>{formatNumber(selectedStatus.productionReserved)}</strong></div>
          <div><span>合同预定</span><strong>{formatNumber(selectedStatus.contractReserved)}</strong></div>
        </div>
        <ToggleField
          label="启用自动采购"
          description="Economy 客户端在线时创建和调整真实买单；已经挂出的买单在离线后仍可继续成交。"
          checked={autoBuyEnabledDraft}
          onChange={(event) => setAutoBuyEnabledDraft(event.target.checked)}
        />
        <IntegerInput
          label="目标自由库存"
          description="在生产预定和合同预定之外希望保有的库存；不足时自动采购，填写 0 表示只补足生产与合同需要。"
          value={autoBuyTargetInventoryDraft}
          fallbackValue={selectedBuyPolicy.targetFreeInventory}
          min={0}
          error={parsedAutoBuyTargetInventory === null ? '请输入不小于 0 的整数' : undefined}
          onValueChange={setAutoBuyTargetInventoryDraft}
        />
        <MoneyInput
          label="最高自动采购价格"
          description="自动买单按该最高价进入订单簿；不高于该价格的卖单会立即成交，没有卖盘时则持续留下买盘需求。"
          value={autoBuyPriceDraft}
          fallbackValue={selectedBuyPolicy.maxPrice}
          min={0.01}
          wheelStep={0.01}
          error={parsedAutoBuyPrice === null ? '请输入不低于 0.01、最多两位小数的价格' : undefined}
          onValueChange={setAutoBuyPriceDraft}
        />
        <p className="warehouse-auto-trade-note">
          数量由服务器按生产预定、合同预定、目标自由库存和当前可用库存计算，并按可用资金缩量。买单使用真实冻结资金和统一订单簿；库存或资金变化后，客户端在线时会重新平衡。
        </p>
      </>
    );
  };

  const renderAutoSellFields = () => {
    if (!selectedProduct || !selectedStatus || !selectedSellPolicy) return null;
    const busy = autoTrade.busyProductId === selectedProduct.id && autoTrade.busySide === 'sell';
    return (
      <>
        <div className="warehouse-auto-trade-status">
          <StatusTag tone="info">设置保存至存档 · 在线维护卖单</StatusTag>
          {busy ? <StatusTag tone="success">正在维护自动卖单</StatusTag> : null}
          {autoSellEnabledDraft && selectedStatus.blockedSellByOwnBuy ? (
            <StatusTag tone="warning">自己的买单阻止自动出售</StatusTag>
          ) : null}
          {autoSellEnabledDraft && !selectedStatus.blockedSellByOwnBuy ? (
            <StatusTag tone={selectedStatus.hasManagedSellOrder || selectedStatus.hasCrossingBuyer ? 'success' : 'neutral'}>
              {selectedStatus.hasManagedSellOrder
                ? '已在市场挂单供应'
                : selectedStatus.hasCrossingBuyer ? '已有买盘达到价格' : '等待维护市场供应'}
            </StatusTag>
          ) : null}
        </div>
        <div className="warehouse-auto-trade-summary">
          <div><span>当前可用</span><strong>{formatNumber(selectedStatus.availableInventory)}</strong></div>
          <div className="is-primary is-sell"><span>预计自动出售</span><strong>{formatNumber(selectedStatus.sellEligibleQuantity)}</strong></div>
          <div><span>当前自由库存</span><strong>{formatNumber(selectedStatus.currentFreeInventory)}</strong></div>
          <div><span>生产预定</span><strong>{formatNumber(selectedStatus.productionReserved)}</strong></div>
          <div><span>合同预定</span><strong>{formatNumber(selectedStatus.contractReserved)}</strong></div>
        </div>
        <ToggleField
          label="启用自动出售"
          description="Economy 客户端在线时创建和调整真实卖单；已经挂出的卖单在离线后仍可继续成交。"
          checked={autoSellEnabledDraft}
          onChange={(event) => setAutoSellEnabledDraft(event.target.checked)}
        />
        <IntegerInput
          label="最低自由库存"
          description="在生产预定和合同预定之外额外保留的可用库存；填写 0 表示不额外保留。该值只限制自动出售。"
          value={autoSellMinimumInventoryDraft}
          fallbackValue={selectedSellPolicy.minimumFreeInventory}
          min={0}
          error={parsedAutoSellMinimumInventory === null ? '请输入不小于 0 的整数' : undefined}
          onValueChange={setAutoSellMinimumInventoryDraft}
        />
        <MoneyInput
          label="最低自动出售价格"
          description="自动卖单按该最低价进入订单簿；达到或高于该价格的买单会立即成交，没有买盘时则持续留下卖盘供应。"
          value={autoSellPriceDraft}
          fallbackValue={selectedSellPolicy.price}
          min={0.01}
          wheelStep={0.01}
          error={parsedAutoSellPrice === null ? '请输入不低于 0.01、最多两位小数的价格' : undefined}
          onValueChange={setAutoSellPriceDraft}
        />
        <p className="warehouse-auto-trade-note">
          自动出售先保护开启中工厂下一完整周期原料，再保护自动准备的合同批次和最低自由库存；剩余商品作为真实冻结卖单进入统一订单簿。
        </p>
      </>
    );
  };

  const renderSelectedTradeFields = () => {
    if (!selectedProduct) {
      return (
        <div className="empty-state warehouse-auto-trade-empty">
          <strong>选择商品设置自动交易</strong>
          <span>可以为零库存商品开启自动采购，也可以为现有库存设置自动出售。</span>
        </div>
      );
    }
    return (
      <>
        {renderTradeTabs()}
        {activeMode === 'buy' ? renderAutoBuyFields() : renderAutoSellFields()}
        {autoTradeConflict ? <p className="warehouse-auto-trade-error" role="alert">{autoTradeConflict}</p> : null}
      </>
    );
  };

  const saveDisabled = savingAutoTradePolicy
    || !selectedProduct
    || parsedAutoBuyPrice === null
    || parsedAutoBuyTargetInventory === null
    || parsedAutoSellPrice === null
    || parsedAutoSellMinimumInventory === null
    || Boolean(autoTradeConflict);

  const renderSaveButton = () => (
    <Button block disabled={saveDisabled} onClick={() => void saveAutoTradePolicy()}>
      {savingAutoTradePolicy ? '正在保存…' : '保存自动交易设置'}
    </Button>
  );

  return (
    <>
      <div className={`production-warehouse-workspace market-auto-trade-workspace ${fixedMode ? 'market-auto-trade-workspace--fixed' : ''} ${className}`.trim()}>
        <PagePanel className="production-surface warehouse-auto-trade-card market-auto-trade-card">
          <WidgetHeading
            title={selectedProduct ? `${selectedProduct.name} · 自动交易` : '自动交易'}
            action={<StatusTag tone="info">在线维护</StatusTag>}
          />
          <section className="warehouse-auto-trade-panel" aria-label="商品自动交易设置">
            {fixedMode ? null : renderProductSelector()}
            {renderSelectedTradeFields()}
            {selectedProduct ? renderSaveButton() : null}
          </section>
        </PagePanel>

        {fixedMode ? (
          <Panel className="production-surface market-auto-trade-fixed-mobile">
            <WidgetHeading
              title={selectedProduct ? `${selectedProduct.name} · 自动交易` : '自动交易'}
              action={<StatusTag tone="info">在线维护</StatusTag>}
            />
            <button
              ref={mobileAutoTradeTriggerRef}
              type="button"
              className="ui-button ui-button--primary ui-button--block"
              onClick={(event) => openAutoTradePanel(fixedProductId ?? undefined, event.currentTarget)}
            >
              设置自动交易
            </button>
          </Panel>
        ) : (
          <Panel className="production-surface warehouse-inventory-panel market-auto-trade-products">
            <WidgetHeading
              title="自动交易商品"
              action={(
                <div className="warehouse-heading-actions">
                  <StatusTag tone="neutral">无限容量</StatusTag>
                  <button
                    ref={mobileAutoTradeTriggerRef}
                    type="button"
                    className="ui-button ui-button--compact warehouse-auto-trade-mobile-trigger"
                    onClick={(event) => openAutoTradePanel(selectedProductId || undefined, event.currentTarget)}
                  >
                    自动交易
                  </button>
                </div>
              )}
            />
            <section className="warehouse-content" aria-label="自动交易商品与库存">
              <header className="warehouse-content-heading">
                <strong>策略与库存</strong>
                <span>{formatNumber(stockedProducts.length)} 种活跃商品</span>
              </header>
              {stockedProducts.length > 0 ? (
                <div className="warehouse-product-grid">
                  {stockedProducts.map((product) => {
                    const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
                    const buyEnabled = autoTrade.buyPolicyFor(product.id).enabled;
                    const sellEnabled = autoTrade.sellPolicyFor(product.id).enabled;
                    const automationLabel = buyEnabled && sellEnabled
                      ? '自动交易'
                      : buyEnabled ? '自动采购' : sellEnabled ? '自动出售' : '';
                    return (
                      <button
                        type="button"
                        className={`warehouse-product-card market-auto-trade-product-card ${automationLabel ? 'is-auto-trade-enabled' : ''}`}
                        data-product-id={product.id}
                        key={product.id}
                        aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，设置自动交易`}
                        onClick={(event) => openAutoTradePanel(product.id, event.currentTarget)}
                      >
                        <span className="warehouse-product-card-name">{product.name}</span>
                        <span className="warehouse-product-card-icon"><ProductIcon productId={product.id} /></span>
                        <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                        <small className="warehouse-product-card-frozen">
                          冻结 {formatNumber(inventory.frozen)}{automationLabel ? ` · ${automationLabel}` : ''}
                        </small>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state warehouse-content-empty">
                  <strong>暂无活跃自动交易商品</strong>
                  <span>可从左侧商品选择器为任意商品开启自动采购或自动出售。</span>
                </div>
              )}
            </section>
          </Panel>
        )}
      </div>

      <MobileWorkspaceDetailSheet
        isOpen={isMobileAutoTradeOpen}
        ariaLabel={selectedProduct ? `${selectedProduct.name}自动交易设置` : '商品自动交易设置'}
        viewportAriaLabel="商品自动交易设置内容"
        returnFocusRef={autoTradeTriggerRef}
        onClose={() => setMobileAutoTradeOpen(false)}
        footer={renderSaveButton()}
      >
        <section className="warehouse-auto-trade-sheet-content">
          <WidgetHeading
            title={selectedProduct ? `${selectedProduct.name} · 自动交易` : '自动交易'}
            action={<StatusTag tone="info">在线维护</StatusTag>}
          />
          {fixedMode ? null : renderProductSelector()}
          {renderSelectedTradeFields()}
        </section>
      </MobileWorkspaceDetailSheet>
    </>
  );
}
