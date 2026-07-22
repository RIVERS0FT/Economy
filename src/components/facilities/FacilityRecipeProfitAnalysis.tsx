import type {
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { analyzeRecipeProfit } from '../../utils/recipeProfitAnalysis';
import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { StatusTag, type StatusTone } from '../ui/layout';
import { useFacilityRecipeProfitMarkets } from './FacilityRecipeProfitContext';
import '../../styles/facility-recipe-profit-analysis.css';

function amountTone(value: number | null) {
  if (value === null || value === 0) return '';
  return value > 0 ? ' is-positive' : ' is-negative';
}

function MoneyValue({
  value,
  fallback = '暂无成交数据',
  showSign = false,
}: {
  value: number | null;
  fallback?: string;
  showSign?: boolean;
}) {
  if (value === null) return <strong>{fallback}</strong>;
  const sign = showSign ? (value > 0 ? '+' : value < 0 ? '−' : undefined) : undefined;
  return <CurrencyAmount sign={sign}>{formatCurrency(Math.abs(value))}</CurrencyAmount>;
}

function profitStatus({
  scopeCount,
  cycleProfit,
  missingPriceCount,
}: {
  scopeCount: number;
  cycleProfit: number | null;
  missingPriceCount: number;
}): { label: string; tone: StatusTone } {
  if (scopeCount < 1) return { label: '无可生产工厂', tone: 'neutral' };
  if (missingPriceCount > 0 || cycleProfit === null) return { label: '暂无成交数据', tone: 'warning' };
  if (cycleProfit < 0) return { label: '预计亏损', tone: 'danger' };
  return { label: '预计盈利', tone: 'success' };
}

function priceDescription(price: number | null, total: number | null, valueLabel: string) {
  if (price === null || total === null) return '暂无最近真实成交价';
  return `最近成交价 ${formatCurrency(price)}；${valueLabel} ${formatCurrency(total)}`;
}

export function FacilityRecipeProfitAnalysis({
  type,
  scopeCount,
  scopeLabel,
  products,
  inventories: _inventories,
}: {
  type: FacilityTypeDefinition;
  scopeCount: number;
  scopeLabel: string;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
}) {
  void _inventories;
  const markets = useFacilityRecipeProfitMarkets();
  const analysis = analyzeRecipeProfit({
    recipe: type,
    scopeCount,
    markets,
    buildCost: type.buildCost,
  });
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const outputName = productNames.get(analysis.output.productId) ?? analysis.output.productId;
  const hasInputs = analysis.inputs.length > 0;
  const status = profitStatus({
    scopeCount: analysis.scopeCount,
    cycleProfit: analysis.cycleProfit,
    missingPriceCount: analysis.missingPriceProductIds.length,
  });
  const warnings: string[] = [];

  if (analysis.scopeCount < 1) {
    warnings.push('当前没有可参与本轮生产的工厂，利润分析将在工厂解冻或加入后恢复。');
  } else if (analysis.missingPriceProductIds.length > 0) {
    const names = analysis.missingPriceProductIds.map((productId) => productNames.get(productId) ?? productId);
    warnings.push(`缺少最近真实成交价：${names.join('、')}。相关利润暂不可计算。`);
  } else if (analysis.cycleProfit !== null && analysis.cycleProfit < 0) {
    warnings.push(`按最近真实成交价估算，本轮预计亏损 ${formatCurrency(Math.abs(analysis.cycleProfit))}。`);
  }

  const paybackLabel = analysis.profitPerMinute === null
    ? '暂无成交数据'
    : analysis.profitPerMinute <= 0 || analysis.paybackMinutes === null
      ? '不可回本'
      : formatDuration(analysis.paybackMinutes * 60_000);

  return (
    <section className="facility-profit-analysis" aria-label={`${type.name}${scopeLabel}市场利润分析`}>
      <div className="facility-profit-analysis__heading">
        <div>
          <strong>市场利润分析</strong>
          <small>{scopeLabel} × {formatNumber(analysis.scopeCount)}，按最近真实成交价估算</small>
        </div>
        <StatusTag tone={status.tone}>{status.label}</StatusTag>
      </div>

      <div className="facility-profit-analysis__summary">
        <div className="facility-profit-analysis__metric">
          <small>原料市场成本</small>
          {hasInputs ? (
            <MoneyValue value={analysis.inputMarketCost} fallback={analysis.scopeCount < 1 ? '暂无范围' : '暂无成交数据'} />
          ) : <strong>无需原料</strong>}
          <span>全部输入均按最近真实成交价计价</span>
        </div>
        <div className="facility-profit-analysis__metric">
          <small>产出市场价值</small>
          <MoneyValue value={analysis.outputMarketValue} fallback={analysis.scopeCount < 1 ? '暂无范围' : '暂无成交数据'} />
          <span>{outputName} × {formatNumber(analysis.output.quantity)}</span>
        </div>
        <div className="facility-profit-analysis__metric">
          <small>周期运营成本</small>
          <MoneyValue value={analysis.scopeCount > 0 ? analysis.operatingCost : null} fallback="暂无范围" />
          <span>服务器正式配方固定成本</span>
        </div>
        <div className={`facility-profit-analysis__metric${amountTone(analysis.cycleProfit)}`}>
          <small>单周期利润</small>
          <MoneyValue value={analysis.cycleProfit} fallback={analysis.scopeCount < 1 ? '暂无范围' : '无法估算'} showSign />
          <span>产出价值减原料成本与周期运营成本</span>
        </div>
      </div>

      <div className="facility-profit-analysis__metrics">
        <div className={`facility-profit-analysis__metric${amountTone(analysis.profitPerMinute)}`}>
          <small>利润／分钟</small>
          <MoneyValue value={analysis.profitPerMinute} fallback={analysis.scopeCount < 1 ? '暂无范围' : '暂无成交数据'} showSign />
          <span>按当前配方周期折算</span>
        </div>
        <div className="facility-profit-analysis__metric">
          <small>静态建造回本</small>
          <strong>{analysis.scopeCount < 1 ? '暂无范围' : paybackLabel}</strong>
          <span>按当前集群对应建造成本静态估算</span>
        </div>
      </div>

      <div className="facility-profit-analysis__inputs" aria-label="最近成交价明细">
        {analysis.inputs.map((input) => {
          const name = productNames.get(input.productId) ?? input.productId;
          return (
            <div className="facility-profit-analysis__input-row" key={`input-${input.productId}`}>
              <strong>原料 · {name} × {formatNumber(input.quantity)}</strong>
              <span className="facility-profit-analysis__input-detail">
                {priceDescription(input.lastTradePrice, input.totalValue, '成本')}
              </span>
            </div>
          );
        })}
        <div className="facility-profit-analysis__input-row" key={`output-${analysis.output.productId}`}>
          <strong>产出 · {outputName} × {formatNumber(analysis.output.quantity)}</strong>
          <span className="facility-profit-analysis__input-detail">
            {priceDescription(analysis.output.lastTradePrice, analysis.output.totalValue, '价值')}
          </span>
        </div>
      </div>

      {warnings.length > 0 ? (
        <ul className="facility-profit-analysis__warning-list" aria-live="polite">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}

      <p className="facility-profit-analysis__note">
        根据各商品最近一次统一订单簿真实成交价估算，不考虑玩家库存、挂单深度和交易手续费。该结果仅用于配方比较，不代表当前可立即成交的实际收益。
      </p>
    </section>
  );
}
