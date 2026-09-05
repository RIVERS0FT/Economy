from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    assert count == 1, f'{label}: expected 1, got {count}'
    return text.replace(old, new, 1)

component = Path('src/components/market/MarketContractSummary.tsx')
component.write_text("""import type { LoadedGameViewModel } from '../../app/gameViewModel';
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
    <Panel className=\"widget span-3 market-contract-summary-card\">
      <WidgetHeading title=\"合同简要\" />
      <div className=\"market-contract-summary-grid\" aria-label=\"合同简要\">
        <div><span>采购合同</span><strong><CompactNumber value={purchaseContracts.length} /></strong></div>
        <div><span>供应合同</span><strong><CompactNumber value={supplyContracts.length} /></strong></div>
        <div><span>今日采购额度</span><strong><CompactNumber value={purchaseRemaining} /></strong></div>
        <div><span>最低采购合同价</span><strong><CurrencyAmount>{lowestPurchasePrice === null ? '—' : formatCurrency(lowestPurchasePrice)}</CurrencyAmount></strong></div>
      </div>
      <Button variant=\"text\" onClick={openContracts}>查看相关合同</Button>
    </Panel>
  );
}
""")

market = Path('src/pages/MarketPage.tsx')
text = market.read_text()
import_line = "import { CommodityFreezeDisclosure } from '../components/market/CommodityFreezeDisclosure';\n"
text = replace_once(text, import_line, import_line + "import { MarketContractSummary } from '../components/market/MarketContractSummary';\n", 'market import')
panel_marker = '\n\n        <Panel className="widget span-3 market-account-panel">'
text = replace_once(text, panel_marker, '\n\n        {selectedProduct ? <MarketContractSummary model={model} productId={selectedProduct.id} /> : null}' + panel_marker, 'market contract insertion')
market.write_text(text)

styles = Path('src/styles/market-detail-direct-flow.css')
text = styles.read_text()
container_marker = '\n\n@container market-page (max-width: 720px) {'
addition = """

.market-detail-surface .market-contract-summary-card {
  display: grid;
  gap: var(--space-3);
}

.market-detail-surface .market-contract-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.market-detail-surface .market-contract-summary-grid > div {
  min-width: 0;
  display: grid;
  gap: 2px;
  padding-block: var(--space-2);
  border-top: 1px solid var(--color-divider);
}

.market-detail-surface .market-contract-summary-grid span {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.market-detail-surface .market-contract-summary-grid strong {
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}
"""
text = replace_once(text, container_marker, addition + container_marker, 'contract styles')
mobile_pattern = r'(  \.market-detail-surface \.market-detail-trade-summary\.ui-entity-card \{\n\s+grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);\n  \}\n)'
text, count = re.subn(mobile_pattern, r'''\1
  .market-detail-surface .market-contract-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
''', text, count=1)
assert count == 1, f'mobile summary styles: expected 1, got {count}'
styles.write_text(text)

warehouse = Path('src/styles/warehouse-expansion.css')
text = warehouse.read_text()
pattern = r'\n\.warehouse-product-card\.is-auto-trade-enabled \{.*?\n@media \(max-width: 720px\) \{'
text, count = re.subn(pattern, '\n@media (max-width: 720px) {', text, count=1, flags=re.S)
assert count == 1, f'retired auto-trade styles: expected 1, got {count}'
mobile_old = """@media (max-width: 420px) {
  .warehouse-auto-trade-summary,
  .market-auto-trade-execution__prices {
    grid-template-columns: 1fr;
  }

  .warehouse-heading-actions {"""
text = replace_once(text, mobile_old, """@media (max-width: 420px) {
  .warehouse-heading-actions {""", 'retired mobile auto-trade styles')
warehouse.write_text(text)

verifier = Path('scripts/verify-daily-supply-contracts.mjs')
text = verifier.read_text()
text = replace_once(text, "const productDetail = read('src/components/market/MarketAutoTradePanel.tsx');", "const productDetail = read('src/components/market/MarketContractSummary.tsx');\nconst marketPage = read('src/pages/MarketPage.tsx');", 'daily contract component path')
text = replace_once(text, "requireText(productDetail, 'setContractMarketIntent(product.id, model.selectedProvinceId)', '地区商品详情合同跳转必须携带 provinceId + productId。');", "requireText(productDetail, 'setContractMarketIntent(productId, model.selectedProvinceId)', '地区商品详情合同跳转必须携带 provinceId + productId。');\nrequireText(marketPage, '<MarketContractSummary model={model} productId={selectedProduct.id} />', '地区商品详情必须实际渲染合同简要，而不是只在未使用组件中保留。');", 'daily contract navigation verifier')
verifier.write_text(text)

verifier = Path('scripts/verify-contract-layout.mjs')
text = verifier.read_text()
text = replace_once(text, "const marketPanelPath = 'src/components/market/MarketAutoTradePanel.tsx';", "const marketPanelPath = 'src/components/market/MarketContractSummary.tsx';", 'contract layout component path')
text = replace_once(text, "for (const text of ['setContractMarketIntent(product.id, model.selectedProvinceId);', '查看相关合同']) requireText(marketPanelPath, text);", "for (const text of ['setContractMarketIntent(productId, model.selectedProvinceId);', '查看相关合同']) requireText(marketPanelPath, text);", 'contract layout navigation')
text = replace_once(text, "forbidText(marketPanelPath, 'setContractMarketIntent(product.id, model.selectedProvinceId,');", "forbidText(marketPanelPath, 'setContractMarketIntent(productId, model.selectedProvinceId,');", 'contract layout direction guard')
verifier.write_text(text)

verifier = Path('scripts/verify-online-auto-sell.mjs')
text = verifier.read_text()
needle = "forbidText('src/pages/MarketPage.tsx', '<MarketAutoTradePanel');\n"
replacement = needle + "assert.ok(!existsSync('src/components/market/MarketAutoTradePanel.tsx'), '退役自动交易展示组件不得继续保留死代码');\nrequireText('src/pages/MarketPage.tsx', '<MarketContractSummary model={model} productId={selectedProduct.id} />');\nfor (const token of ['自动经营执行', '预计自动采购', '预计自动出售', '采购价格上限', '出售价格下限', '当前自由库存', '统一商品订单簿']) {\n  forbidText('src/components/market/MarketContractSummary.tsx', token);\n}\n"
text = replace_once(text, needle, replacement, 'retired auto-trade verifier')
verifier.write_text(text)

test_file = Path('tests/browser/market-information-hierarchy.spec.ts')
text = test_file.read_text()
pattern = r"(  for \(const label of \['今日价格', '今日成交量', '可用库存', '冻结库存'\]\) \{\n    await expect\(detail\.locator\('\.market-detail-trade-summary'\)\.getByText\(label, \{ exact: true \}\)\)\.toBeVisible\(\);\n  \}\n)"
text, count = re.subn(pattern, r'''\1  const contractSummary = detail.locator('.market-contract-summary-card');
  await expect(contractSummary).toBeVisible();
  for (const label of ['合同简要', '采购合同', '供应合同', '今日采购额度', '最低采购合同价', '查看相关合同']) {
    await expect(contractSummary.getByText(label, { exact: true })).toBeVisible();
  }
  for (const retired of ['自动经营执行', '预计自动采购', '预计自动出售', '采购价格上限', '出售价格下限', '当前自由库存']) {
    await expect(detail.getByText(retired, { exact: true })).toHaveCount(0);
  }
''', text, count=1)
assert count == 1, f'browser hierarchy insertion: expected 1, got {count}'
test_file.write_text(text)

chart_design = Path('docs/MARKET_CHART_LAYOUT_DESIGN.md')
text = chart_design.read_text()
old = '- 页面顺序固定为“顶部交易摘要 → 近 30 天按日成交趋势 → 手动即时交易 → 浏览器本地成交记录”。行情、即时交易和本地成交按页面内容流排列；地区商品详情不得恢复玩家盘口或第二套自动经营执行卡。'
new = '- 行情相关内容顺序固定为“顶部交易摘要 → 近 30 天按日成交趋势 → 手动即时交易”；商品合同简要按页面与仓库设计位于手动交易后、本地成交记录前。行情、即时交易、合同简要和本地成交按页面内容流排列；合同简要只展示合同事实，不得恢复玩家盘口或第二套自动经营执行卡。'
text = replace_once(text, old, new, 'market chart page order')
chart_design.write_text(text)
