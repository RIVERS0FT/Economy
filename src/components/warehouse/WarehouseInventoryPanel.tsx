import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnlineAutoSellAwareGameViewModel } from '../../auto-sell/useOnlineAutoSell';
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
import { Button, PagePanel, Panel, StatusTag, ToggleField, WidgetHeading } from '../ui/layout';

function isMobileWarehouseLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

export function WarehouseInventoryPanel({
  model,
  className = '',
}: {
  model: OnlineAutoSellAwareGameViewModel;
  className?: string;
}) {
  const { game } = model;
  const autoSell = useMemo(() => model.autoSell ?? ({
    policies: {},
    busyProductId: null,
    policyFor: (productId: string) => ({
      enabled: false,
      price: Math.max(0.01, Number(game.products.find((product) => product.id === productId)?.basePrice || 1)),
      minimumFreeInventory: 0,
    }),
    statusFor: (productId: string) => {
      const inventory = game.inventories[productId] ?? { available: 0, frozen: 0 };
      return {
        availableInventory: Math.max(0, Math.floor(Number(inventory.available || 0))),
        productionReserved: 0,
        contractReserved: 0,
        minimumFreeInventory: 0,
        eligibleQuantity: 0,
        blockedByOwnBuy: false,
        hasCrossingBuyer: false,
      };
    },
    setPolicy: async () => ({ ok: false, message: '自动出售控制器不可用' }),
  }), [game.inventories, game.products, model.autoSell]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [isMobileAutoSellOpen, setMobileAutoSellOpen] = useState(false);
  const [autoSellEnabledDraft, setAutoSellEnabledDraft] = useState(false);
  const [autoSellPriceDraft, setAutoSellPriceDraft] = useState('1.00');
  const [autoSellMinimumInventoryDraft, setAutoSellMinimumInventoryDraft] = useState('0');
  const [savingAutoSellPolicy, setSavingAutoSellPolicy] = useState(false);
  const autoSellTriggerRef = useRef<HTMLButtonElement | null>(null);
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
  const parsedAutoSellMinimumInventory = parseIntegerDraft(autoSellMinimumInventoryDraft, { min: 0 });

  const resolveProductTrigger = useCallback((productId: string) => (
    Array.from(document.querySelectorAll<HTMLButtonElement>('.warehouse-product-card[data-product-id]'))
      .find((button) => button.dataset.productId === productId) ?? null
  ), []);

  const openAutoSellPanel = useCallback((productId: string, trigger?: HTMLButtonElement | null) => {
    const product = game.products.find((candidate) => candidate.id === productId);
    if (!product) return;
    const policy = autoSell.policyFor(product.id);
    autoSellTriggerRef.current = trigger ?? resolveProductTrigger(product.id) ?? autoSellTriggerRef.current;
    setSelectedProductId(product.id);
    setAutoSellEnabledDraft(policy.enabled);
    setAutoSellPriceDraft(formatMoneyDraft(policy.price));
    setAutoSellMinimumInventoryDraft(String(policy.minimumFreeInventory));
    if (isMobileWarehouseLayout()) setMobileAutoSellOpen(true);
  }, [autoSell, game.products, resolveProductTrigger]);

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

  async function saveAutoSellPolicy() {
    if (
      savingAutoSellPolicy
      || !selectedProduct
      || parsedAutoSellPrice === null
      || parsedAutoSellMinimumInventory === null
    ) return;
    setSavingAutoSellPolicy(true);
    try {
      const result = await autoSell.setPolicy(selectedProduct.id, {
        enabled: autoSellEnabledDraft,
        price: parsedAutoSellPrice,
        minimumFreeInventory: parsedAutoSellMinimumInventory,
      });
      model.notify(result.message);
    } finally {
      setSavingAutoSellPolicy(false);
    }
  }

  const renderAutoSellFields = () => {
    if (!selectedProduct || !selectedAutoSellStatus || !selectedPolicy) return null;
    return (
      <>
        <div className="warehouse-auto-sell-status">
          <StatusTag tone="info">设置保存至存档 · 仅在线执行</StatusTag>
          {autoSell.busyProductId === selectedProduct.id ? <StatusTag tone="success">正在自动出售</StatusTag> : null}
          {autoSellEnabledDraft && selectedAutoSellStatus.blockedByOwnBuy ? <StatusTag tone="warning">自己的买单阻止自动出售</StatusTag> : null}
          {autoSellEnabledDraft && !selectedAutoSellStatus.blockedByOwnBuy ? (
            <StatusTag tone={selectedAutoSellStatus.hasCrossingBuyer ? 'success' : 'neutral'}>
              {selectedAutoSellStatus.hasCrossingBuyer ? '已有买盘达到价格' : '等待达到价格的买盘'}
            </StatusTag>
          ) : null}
        </div>
        <div className="warehouse-auto-sell-summary">
          <div><span>当前可用</span><strong>{formatNumber(selectedAutoSellStatus.availableInventory)}</strong></div>
          <div className="is-primary"><span>预计可自动出售</span><strong>{formatNumber(selectedAutoSellStatus.eligibleQuantity)}</strong></div>
          <div><span>生产预定</span><strong>{formatNumber(selectedAutoSellStatus.productionReserved)}</strong></div>
          <div><span>合同预定</span><strong>{formatNumber(selectedAutoSellStatus.contractReserved)}</strong></div>
          <div><span>最低自由库存</span><strong>{formatNumber(selectedAutoSellStatus.minimumFreeInventory)}</strong></div>
        </div>
        <ToggleField
          label="启用自动出售"
          description="设置会跟随当前经济存档同步；只有 Economy 客户端在线时才会发起新的自动成交。"
          checked={autoSellEnabledDraft}
          onChange={(event) => setAutoSellEnabledDraft(event.target.checked)}
        />
        <IntegerInput
          label="最低自由库存"
          description="在生产预定和合同预定之外额外保留的可用库存；填写 0 表示不额外保留。该值只限制自动出售。"
          value={autoSellMinimumInventoryDraft}
          fallbackValue={selectedPolicy.minimumFreeInventory}
          min={0}
          error={parsedAutoSellMinimumInventory === null ? '请输入不小于 0 的整数' : undefined}
          onValueChange={setAutoSellMinimumInventoryDraft}
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
          数量和策略均由服务器成交前重新读取并计算：先保留开启中工厂下一完整周期的原料，再保留自动准备的合同批次，最后额外保留你设置的最低自由库存；该值不限制生产、合同履约、手动卖出或拍卖。
        </p>
      </>
    );
  };

  const renderSaveButton = () => (
    <Button
      block
      disabled={savingAutoSellPolicy || parsedAutoSellPrice === null || parsedAutoSellMinimumInventory === null}
      onClick={() => void saveAutoSellPolicy()}
    >
      {savingAutoSellPolicy
        ? '正在保存…'
        : autoSellEnabledDraft ? '保存并启用自动出售' : '保存并关闭自动出售'}
    </Button>
  );

  return (
    <>
      <div className={`production-warehouse-workspace ${className}`.trim()}>
        <PagePanel className="production-surface warehouse-auto-sell-card">
          <WidgetHeading
            title={selectedProduct ? `${selectedProduct.name} · 自动出售` : '自动出售'}
            action={<StatusTag tone="info">仅客户端在线</StatusTag>}
          />
          {selectedProduct && selectedAutoSellStatus && selectedPolicy ? (
            <section className="warehouse-auto-sell-panel" aria-label={`${selectedProduct.name}自动出售设置`}>
              {renderAutoSellFields()}
              {renderSaveButton()}
            </section>
          ) : (
            <div className="empty-state warehouse-auto-sell-empty">
              <strong>选择商品设置自动出售</strong>
              <span>点击右侧仓库中的商品后，在这里设置最低价格和保留库存。</span>
            </div>
          )}
        </PagePanel>

        <Panel className="production-surface warehouse-inventory-panel">
          <WidgetHeading title="共享仓库" action={<StatusTag tone="neutral">无限容量</StatusTag>} />
          <section className="warehouse-content" aria-label="仓库内容">
            <header className="warehouse-content-heading">
              <strong>仓库内容</strong>
              <span>实物库存 {formatNumber(game.warehouseStoredQuantity)}</span>
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
                      data-product-id={product.id}
                      key={product.id}
                      aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，设置自动出售`}
                      onClick={(event) => openAutoSellPanel(product.id, event.currentTarget)}
                    >
                      <span className="warehouse-product-card-name">{product.name}</span>
                      <span className="warehouse-product-card-icon"><ProductIcon productId={product.id} /></span>
                      <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                      <small className="warehouse-product-card-frozen">冻结 {formatNumber(inventory.frozen)}{policy.enabled ? ' · 自动' : ''}</small>
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
          </section>
        </Panel>
      </div>

      {selectedProduct && selectedAutoSellStatus && selectedPolicy ? (
        <MobileWorkspaceDetailSheet
          isOpen={isMobileAutoSellOpen}
          ariaLabel={`${selectedProduct.name}自动出售设置`}
          viewportAriaLabel={`${selectedProduct.name}自动出售设置内容`}
          returnFocusRef={autoSellTriggerRef}
          onClose={() => setMobileAutoSellOpen(false)}
          footer={renderSaveButton()}
        >
          <section className="warehouse-auto-sell-sheet-content">
            <WidgetHeading
              title={`${selectedProduct.name} · 自动出售`}
              action={<StatusTag tone="info">仅客户端在线</StatusTag>}
            />
            {renderAutoSellFields()}
          </section>
        </MobileWorkspaceDetailSheet>
      ) : null}
    </>
  );
}
