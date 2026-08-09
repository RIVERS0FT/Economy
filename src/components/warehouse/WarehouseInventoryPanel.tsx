import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OnlineAutoSellAwareGameViewModel } from '../../auto-sell/useOnlineAutoSell';
import {
  AUTO_SELL_PANEL_EVENT,
  consumeAutoSellPanelRequest,
} from '../../auto-sell/autoSellStorage';
import { formatNumber } from '../../utils/formatters';
import { formatMoneyDraft, parseMoneyDraft } from '../../utils/moneyDraft';
import { ProductIcon } from '../icons/ProductIcons';
import { MoneyInput } from '../ui/FormControls';
import { Button, Panel, StatusTag, ToggleField, WidgetHeading } from '../ui/layout';

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
  const [selectedProductId, setSelectedProductId] = useState('');
  const [autoSellEnabledDraft, setAutoSellEnabledDraft] = useState(false);
  const [autoSellPriceDraft, setAutoSellPriceDraft] = useState('1.00');
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
    <Panel className={`production-surface warehouse-inventory-panel ${className}`.trim()}>
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
                  key={product.id}
                  aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，设置自动出售`}
                  onClick={() => openAutoSellPanel(product.id)}
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
    </Panel>
  );
}
