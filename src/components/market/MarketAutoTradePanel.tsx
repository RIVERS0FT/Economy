import { useMemo } from 'react';
import type { OnlineAutoTradeController } from '../../auto-trade/useOnlineAutoTrade';
import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { formatCurrency } from '../../utils/formatters';
import { CompactNumber } from '../ui/CompactNumber';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { PagePanel, StatusTag, WidgetHeading } from '../ui/layout';

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
  const productId = fixedProductId ?? requestedProductId ?? '';
  const product = model.game.products.find((candidate) => candidate.id === productId) ?? null;
  const autoTrade = model.autoTrade;
  const status = useMemo(
    () => product && autoTrade ? autoTrade.statusFor(product.id) : null,
    [autoTrade, product],
  );
  const buyPolicy = product && autoTrade ? autoTrade.buyPolicyFor(product.id) : null;
  const sellPolicy = product && autoTrade ? autoTrade.sellPolicyFor(product.id) : null;

  if (!product || !status || !buyPolicy || !sellPolicy) return null;

  return (
    <PagePanel className={`warehouse-auto-trade-card market-auto-trade-execution ${className}`.trim()}>
      <WidgetHeading
        title="自动经营执行"
        action={<StatusTag tone="info">由工厂策略汇总</StatusTag>}
      />

      <div className="warehouse-auto-trade-status">
        <StatusTag tone={buyPolicy.enabled ? 'success' : 'neutral'}>
          {buyPolicy.enabled ? '自动采购已启用' : '当前无需自动采购'}
        </StatusTag>
        <StatusTag tone={sellPolicy.enabled ? 'success' : 'neutral'}>
          {sellPolicy.enabled ? '自动出售已启用' : '当前无需自动出售'}
        </StatusTag>
        {status.buyFundingLimited ? <StatusTag tone="warning">采购受可用资金限制</StatusTag> : null}
        {status.blockedBuyByOwnSell || status.blockedSellByOwnBuy ? (
          <StatusTag tone="warning">本人反向订单阻止自动维护</StatusTag>
        ) : null}
      </div>

      <div className="warehouse-auto-trade-summary">
        <div><span>当前可用</span><strong>{<CompactNumber value={status.availableInventory} />}</strong></div>
        <div><span>生产预定</span><strong>{<CompactNumber value={status.productionReserved} />}</strong></div>
        <div><span>合同预定</span><strong>{<CompactNumber value={status.contractReserved} />}</strong></div>
        <div><span>当前自由库存</span><strong>{<CompactNumber value={status.currentFreeInventory} />}</strong></div>
        <div className="is-primary is-buy"><span>预计自动采购</span><strong>{<CompactNumber value={status.buyEligibleQuantity} />}</strong></div>
        <div className="is-primary is-sell"><span>预计自动出售</span><strong>{<CompactNumber value={status.sellEligibleQuantity} />}</strong></div>
      </div>

      <div className="market-auto-trade-execution__prices">
        <span>
          <small>采购价格上限</small>
          <strong><CurrencyAmount>{buyPolicy.enabled ? formatCurrency(buyPolicy.maxPrice) : '—'}</CurrencyAmount></strong>
        </span>
        <span>
          <small>出售价格下限</small>
          <strong><CurrencyAmount>{sellPolicy.enabled ? formatCurrency(sellPolicy.price) : '—'}</CurrencyAmount></strong>
        </span>
      </div>

      <p className="warehouse-auto-trade-note">
        数量与库存保护由本州工厂的自动经营策略、当前生产配置和合同共同决定；真实买卖仍进入统一商品订单簿。要调整保障周期、经营模式或产成品处理，请进入对应工厂详情。
      </p>
    </PagePanel>
  );
}
