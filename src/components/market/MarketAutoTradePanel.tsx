import { useMemo } from 'react';
import type { OnlineAutoTradeController } from '../../auto-trade/useOnlineAutoTrade';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { setContractMarketIntent } from '../../contracts/navigation';
import { productionContractStateFromGame } from '../../contracts/types';
import { formatCurrency } from '../../utils/formatters';
import { CompactNumber } from '../ui/CompactNumber';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { Button, PagePanel, StatusTag, WidgetHeading } from '../ui/layout';

type AutoTradeCapableGameViewModel = LoadedGameViewModel & { autoTrade?: OnlineAutoTradeController };
type OptionalAutoTradeState = LoadedGameViewModel['game'] & {
  onlineAutoBuyPolicies?: OnlineAutoTradeController['buyPolicies'];
  onlineAutoSellPolicies?: OnlineAutoTradeController['sellPolicies'];
};

function fallbackController(model: AutoTradeCapableGameViewModel): OnlineAutoTradeController {
  const game = model.game as OptionalAutoTradeState;
  const productById = new Map(game.products.map((product) => [product.id, product]));
  const buyPolicies = game.onlineAutoBuyPolicies ?? {};
  const sellPolicies = game.onlineAutoSellPolicies ?? {};
  const buyPolicyFor = (productId: string) => buyPolicies[productId] ?? { enabled: false, maxPrice: Math.max(0.01, Number(productById.get(productId)?.basePrice || 1)), targetFreeInventory: 0 };
  const sellPolicyFor = (productId: string) => sellPolicies[productId] ?? { enabled: false, price: Math.max(0.01, Number(productById.get(productId)?.basePrice || 1)), minimumFreeInventory: 0 };
  return {
    buyPolicies, sellPolicies, busyProductId: null, busySide: null, buyPolicyFor, sellPolicyFor,
    statusFor: (productId: string) => {
      const inventory = game.inventories[productId] ?? { available: 0, frozen: 0, inTransit: 0 };
      const availableInventory = Math.max(0, Math.floor(Number(inventory.available || 0)));
      const buyPolicy = buyPolicyFor(productId); const sellPolicy = sellPolicyFor(productId);
      const buyDesiredQuantity = buyPolicy.enabled ? Math.max(0, Math.floor(Number(buyPolicy.targetFreeInventory || 0)) - availableInventory) : 0;
      const buyEligibleQuantity = buyPolicy.maxPrice > 0 ? Math.min(buyDesiredQuantity, Math.floor(Math.max(0, Number(game.credits || 0)) / buyPolicy.maxPrice)) : 0;
      const sellEligibleQuantity = sellPolicy.enabled ? Math.max(0, availableInventory - Math.max(0, Math.floor(Number(sellPolicy.minimumFreeInventory || 0)))) : 0;
      return { availableInventory, productionReserved: 0, contractReserved: 0, currentFreeInventory: availableInventory, buyDesiredQuantity, buyEligibleQuantity, buyFundingLimited: buyEligibleQuantity < buyDesiredQuantity, blockedBuyByOwnSell: false, hasCrossingSeller: false, hasManagedBuyOrder: false, buyNeedsMaintenance: false, sellEligibleQuantity, blockedSellByOwnBuy: false, hasCrossingBuyer: false, hasManagedSellOrder: false, sellNeedsMaintenance: false };
    },
    setPolicy: async () => ({ ok: false, message: '自动经营策略请在工厂详情中设置' }),
  };
}

export function MarketAutoTradePanel({ model, className = '', requestedProductId = null, fixedProductId = null }: {
  model: AutoTradeCapableGameViewModel;
  className?: string;
  requestedProductId?: string | null;
  fixedProductId?: string | null;
}) {
  const productId = fixedProductId ?? requestedProductId ?? '';
  const product = model.game.products.find((candidate) => candidate.id === productId) ?? null;
  const autoTrade = useMemo(() => model.autoTrade ?? fallbackController(model), [model]);
  const status = product ? autoTrade.statusFor(product.id) : null;
  const buyPolicy = product ? autoTrade.buyPolicyFor(product.id) : null;
  const sellPolicy = product ? autoTrade.sellPolicyFor(product.id) : null;
  const { productionContracts } = productionContractStateFromGame(model.game);
  const relatedContracts = productionContracts.filter((contract) => (
    contract.kind === 'supply'
    && contract.status === 'active'
    && contract.productId === productId
    && (contract.provinceId ?? model.game.defaultProvinceId) === model.selectedProvinceId
    && (contract.isBuyer || contract.isSupplier)
  ));
  const purchaseContracts = relatedContracts.filter((contract) => contract.isBuyer);
  const supplyContracts = relatedContracts.filter((contract) => contract.isSupplier);
  const purchaseRemaining = purchaseContracts.reduce((sum, contract) => sum + Math.max(0, Number(contract.dailyRemainingQuantity ?? 0)), 0);
  const purchasePrices = purchaseContracts.map((contract) => Number(contract.unitPrice)).filter((price) => Number.isFinite(price) && price > 0);
  const lowestPurchasePrice = purchasePrices.length > 0 ? Math.min(...purchasePrices) : null;

  if (!product || !status || !buyPolicy || !sellPolicy) return null;

  const openContracts = () => {
    setContractMarketIntent(product.id, model.selectedProvinceId);
    model.setTab('contracts');
  };

  return (
    <PagePanel className={`warehouse-auto-trade-card market-auto-trade-execution ${className}`.trim()}>
      <WidgetHeading title="自动经营执行" action={<StatusTag tone="info">由工厂策略汇总</StatusTag>} />
      <div className="warehouse-auto-trade-status">
        <StatusTag tone={buyPolicy.enabled ? 'success' : 'neutral'}>{buyPolicy.enabled ? '自动采购已启用' : '当前无需自动采购'}</StatusTag>
        <StatusTag tone={sellPolicy.enabled ? 'success' : 'neutral'}>{sellPolicy.enabled ? '自动出售已启用' : '当前无需自动出售'}</StatusTag>
        {status.buyFundingLimited ? <StatusTag tone="warning">采购受可用资金限制</StatusTag> : null}
        {status.blockedBuyByOwnSell || status.blockedSellByOwnBuy ? <StatusTag tone="warning">本人反向订单阻止自动维护</StatusTag> : null}
      </div>
      <div className="warehouse-auto-trade-summary">
        <div><span>当前可用</span><strong><CompactNumber value={status.availableInventory} /></strong></div>
        <div><span>生产预定</span><strong><CompactNumber value={status.productionReserved} /></strong></div>
        <div><span>合同预定</span><strong><CompactNumber value={status.contractReserved} /></strong></div>
        <div><span>当前自由库存</span><strong><CompactNumber value={status.currentFreeInventory} /></strong></div>
        <div className="is-primary is-buy"><span>预计自动采购</span><strong><CompactNumber value={status.buyEligibleQuantity} /></strong></div>
        <div className="is-primary is-sell"><span>预计自动出售</span><strong><CompactNumber value={status.sellEligibleQuantity} /></strong></div>
      </div>
      <div className="market-auto-trade-execution__prices">
        <span><small>采购价格上限</small><strong><CurrencyAmount>{buyPolicy.enabled ? formatCurrency(buyPolicy.maxPrice) : '—'}</CurrencyAmount></strong></span>
        <span><small>出售价格下限</small><strong><CurrencyAmount>{sellPolicy.enabled ? formatCurrency(sellPolicy.price) : '—'}</CurrencyAmount></strong></span>
      </div>
      <div className="warehouse-auto-trade-summary market-auto-trade-contract-summary" aria-label="合同简要">
        <div><span>采购合同</span><strong><CompactNumber value={purchaseContracts.length} /></strong></div>
        <div><span>供应合同</span><strong><CompactNumber value={supplyContracts.length} /></strong></div>
        <div><span>今日采购额度</span><strong><CompactNumber value={purchaseRemaining} /></strong></div>
        <div><span>最低采购合同价</span><strong><CurrencyAmount>{lowestPurchasePrice === null ? '—' : formatCurrency(lowestPurchasePrice)}</CurrencyAmount></strong></div>
      </div>
      <Button variant="text" onClick={openContracts}>查看相关合同</Button>
      <p className="warehouse-auto-trade-note">数量与库存保护由本州工厂的自动经营策略、当前生产配置和合同共同决定；真实买卖仍进入统一商品订单簿。工厂生产只使用同州来源：市场可执行价格高于固定合同价时优先使用合同，否则先用仓库，仓库不足再从市场采购。</p>
    </PagePanel>
  );
}
