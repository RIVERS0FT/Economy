import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';
import type {
  FacilityRecipeDefinition,
  ProductDefinition,
  ProductInventory,
  ProductMarketState,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { buildFacilityOperatingDiagnosis } from '../../utils/facilityOperatingDiagnostics';
import { marketDecisionSignal } from '../../utils/marketDecisionSignals';
import { ChevronIcon } from '../icons/GameIcons';
import { ProductArtwork } from '../products/ProductArtwork';
import { Button } from '../ui/layout';
import '../../styles/facility-operating-diagnostics.css';

function cyclesLabel(value: number | null) {
  return value === null ? '不限' : `${formatNumber(value)} 周期`;
}

export function FacilityOperatingDiagnostics({
  recipe,
  productionCount,
  products,
  inventories,
  markets,
  credits,
  onOpenContracts,
  onOpenProductMarket,
}: {
  recipe: FacilityRecipeDefinition;
  productionCount: number;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  markets: Record<string, ProductMarketState>;
  credits: number;
  onOpenContracts: (productId: string) => void;
  onOpenProductMarket?: (productId: string) => void;
}) {
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const diagnosis = buildFacilityOperatingDiagnosis({
    recipe,
    productionCount,
    inventories,
    credits,
  });
  const marketProductIds = [...new Set([
    ...recipe.inputs.map((item) => item.productId),
    recipe.output.productId,
  ])];

  return (
    <section className="facility-operating-diagnostics mobile-detail-section" aria-label="工厂经营诊断">
      <div className="facility-operating-diagnostics__heading">
        <div>
          <strong>经营诊断</strong>
          <small>按当前等效产能、可用库存、现金和真实成交快照计算</small>
        </div>
        <span>{diagnosis.bottleneck.label}</span>
      </div>
      <div className="facility-operating-diagnostics__metrics">
        <div><span>原料续航</span><strong>{cyclesLabel(diagnosis.inputCycles)}</strong></div>
        <div><span>现金续航</span><strong>{cyclesLabel(diagnosis.cashCycles)}</strong><small>每周期 {<CompactCurrency value={diagnosis.cashPerCycle} />}</small></div>
        <div><span>周期产出</span><strong>{<CompactNumber value={diagnosis.outputPerCycle} />}</strong><small>无限仓库直接入库</small></div>
        <div><span>第一瓶颈</span><strong>{diagnosis.bottleneck.label}</strong><small>{cyclesLabel(diagnosis.bottleneck.cycles)}</small></div>
      </div>
      {diagnosis.inputRows.length > 0 ? (
        <div className="facility-operating-diagnostics__inputs" aria-label="原料续航明细">
          {diagnosis.inputRows.map((item) => (
            <div key={item.productId}>
              <ProductArtwork productId={item.productId} />
              <span><strong>{productNames.get(item.productId) ?? item.productId}</strong><small>每周期需 {<CompactNumber value={item.requiredPerCycle} />} · 可用 {<CompactNumber value={item.available} />}</small></span>
              <span>{cyclesLabel(item.supportedCycles)}{item.shortfallThisCycle > 0 ? ` · 缺 ${formatNumber(item.shortfallThisCycle)}` : ''}{item.shortfallThisCycle > 0 && onOpenProductMarket ? <Button variant="text" aria-label={`采购${productNames.get(item.productId) ?? item.productId}`} onClick={() => onOpenProductMarket(item.productId)}>前往采购</Button> : null}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="facility-operating-diagnostics__markets" aria-label="上下游真实成交信号">
        {marketProductIds.map((productId) => {
          const signal = marketDecisionSignal(markets[productId]);
          const role = productId === recipe.output.productId ? '产出' : '投入';
          const trendDirection = signal.trend === 'up'
            ? 'up'
            : signal.trend === 'down'
              ? 'down'
              : signal.trend === 'flat'
                ? 'right'
                : null;
          return (
            <div key={productId}>
              <span>{role}</span>
              <ProductArtwork productId={productId} />
              <strong>{productNames.get(productId) ?? productId}</strong>
              <span className="facility-operating-diagnostics__market-price">
                {signal.price === null ? '暂无真实成交' : (
                  <>
                    <span>{<CompactCurrency value={signal.price} />}</span>
                    {trendDirection ? <ChevronIcon direction={trendDirection} /> : null}
                  </>
                )}
              </span>
              <Button variant="text" className="facility-operating-diagnostics__contract-link" onClick={() => onOpenContracts(productId)}>查看相关合同</Button>
            </div>
          );
        })}
      </div>
      <p className="ui-helper-text">该区域只展示当前经营事实，不自动推荐最高利润产物、配方、采购或出售动作。</p>
    </section>
  );
}
