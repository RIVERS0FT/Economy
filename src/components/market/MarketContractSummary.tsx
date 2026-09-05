import type { LoadedGameViewModel } from '../../app/gameViewModel';
import { setContractMarketIntent } from '../../contracts/navigation';
import { productionContractStateFromGame } from '../../contracts/types';
import { formatCurrency } from '../../utils/formatters';
import { CompactNumber } from '../ui/CompactNumber';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { Button, Panel, WidgetHeading } from '../ui/layout';

export function MarketContractSummary({ model, productId }: {
  model: LoadedGameViewModel;
  productId: string;
}) {
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
  const purchaseRemaining = purchaseContracts.reduce(
    (sum, contract) => sum + Math.max(0, Number(contract.dailyRemainingQuantity ?? 0)),
    0,
  );
  const purchasePrices = purchaseContracts
    .map((contract) => Number(contract.unitPrice))
    .filter((price) => Number.isFinite(price) && price > 0);
  const lowestPurchasePrice = purchasePrices.length > 0 ? Math.min(...purchasePrices) : null;

  const openContracts = () => {
    setContractMarketIntent(productId, model.selectedProvinceId);
    model.setTab('contracts');
  };

  return (
    <Panel className="widget span-3 market-contract-summary-card">
      <WidgetHeading title="合同简要" />
      <div className="market-contract-summary-grid" aria-label="合同简要">
        <div><span>采购合同</span><strong><CompactNumber value={purchaseContracts.length} /></strong></div>
        <div><span>供应合同</span><strong><CompactNumber value={supplyContracts.length} /></strong></div>
        <div><span>今日采购额度</span><strong><CompactNumber value={purchaseRemaining} /></strong></div>
        <div><span>最低采购合同价</span><strong><CurrencyAmount>{lowestPurchasePrice === null ? '—' : formatCurrency(lowestPurchasePrice)}</CurrencyAmount></strong></div>
      </div>
      <Button variant="text" onClick={openContracts}>查看相关合同</Button>
    </Panel>
  );
}
