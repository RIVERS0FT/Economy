import type {
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { analyzeRecipeProfit } from '../../utils/recipeProfitAnalysis';
import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { StatusTag, type StatusTone } from '../ui/layout';
import { useFacilityRecipeProfitOrders } from './FacilityRecipeProfitContext';
import '../../styles/facility-recipe-profit-analysis.css';

function amountTone(value: number | null) {
  if (value === null || value === 0) return '';
  return value > 0 ? ' is-positive' : ' is-negative';
}

function MoneyValue({
  value,
  fallback = '盘口不足',
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
  cashProfit,
  valueAddedProfit,
}: {
  scopeCount: number;
  cashProfit: number | null;
  valueAddedProfit: number | null;
}): { label: string; tone: StatusTone } {
  if (scopeCount < 1) return { label: '无可生产工厂', tone: 'neutral' };
  if (cashProfit === null) return { label: '盘口不足', tone: 'warning' };
  if (cashProfit < 0) return { label: '预计亏损', tone: 'danger' };
  if (valueAddedProfit !== null && valueAddedProfit < 0) return { label: '加工倒挂', tone: 'warning' };
  return { label: '预计盈利', tone: 'success' };
}

export function FacilityRecipeProfitAnalysis({
  type,
  scopeCount,
  scopeLabel,
  products,
  inventories,
}: {
  type: FacilityTypeDefinition;
  scopeCount: number;
  scopeLabel: string;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
}) {
  const orders = useFacilityRecipeProfitOrders();
  const analysis = analyzeRecipeProfit({
    recipe: type,
    scopeCount,
    inventories,
    orders,
    buildCost: type.buildCost,
  });
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const outputName = productNames.get(analysis.outputProductId) ?? analysis.outputProductId;
  const hasInputs = analysis.inputs.length > 0;
  const status = profitStatus({
    scopeCount: analysis.scopeCount,
    cashProfit: analysis.cashProfit,
    valueAddedProfit: hasInputs ? analysis.valueAddedProfit : null,
  });
  const warnings: string[] = [];

  if (analysis.scopeCount < 1) {
    warnings.push('当前没有可参与本轮生产的工厂，利润分析将在工厂解冻或加入后恢复。');
  }
  for (const input of analysis.inputs) {
    if (input.purchaseQuantity > 0 && !input.shortagePurchase.fullyFilled) {
      const name = productNames.get(input.productId) ?? input.productId;
      warnings.push(`${name}卖盘只能补齐 ${formatNumber(input.shortagePurchase.filledQuantity)}／${formatNumber(input.purchaseQuantity)}。`);
    }
  }
  if (analysis.outputQuantity > 0 && !analysis.outputSale.fullyFilled) {
    warnings.push(`${outputName}买盘只能立即承接 ${formatNumber(analysis.outputSale.filledQuantity)}／${formatNumber(analysis.outputQuantity)}。`);
  }
  if (hasInputs && analysis.fullPurchaseCost === null && analysis.scopeCount > 0) {
    warnings.push('全量采购原料的卖盘深度不足，持续采购利润暂不可计算。');
  }
  if (hasInputs && analysis.directInputSaleNet === null && analysis.scopeCount > 0) {
    warnings.push('原料买盘深度不足，暂无法与直接出售原料比较。');
  }
  if (analysis.cashProfit !== null && analysis.cashProfit < 0) {
    warnings.push(`按当前库存、补料和产出买盘，本轮预计亏损 ${formatCurrency(Math.abs(analysis.cashProfit))}。`);
  } else if (hasInputs && analysis.valueAddedProfit !== null && analysis.valueAddedProfit < 0) {
    warnings.push(`按当前盘口，直接卖出原料比加工后出售多获得 ${formatCurrency(Math.abs(analysis.valueAddedProfit))}。`);
  }

  const coverageDescription = hasInputs
    ? `库存覆盖 ${formatNumber(analysis.inventoryCoverageQuantity)}／${formatNumber(analysis.requiredInputQuantity)}`
    : '该配方不消耗商品原料';
  const outputDescription = analysis.outputNetRevenue !== null
    ? `卖方手续费 ${formatCurrency(analysis.outputSellFee)}`
    : `当前买盘 ${formatNumber(analysis.outputSale.filledQuantity)}／${formatNumber(analysis.outputQuantity)}`;
  const paybackLabel = analysis.profitPerMinute === null
    ? '盘口不足'
    : analysis.profitPerMinute <= 0 || analysis.paybackMinutes === null
      ? '不可回本'
      : formatDuration(analysis.paybackMinutes * 60_000);

  return (
    <section className="facility-profit-analysis" aria-label={`${type.name}${scopeLabel}市场利润分析`}>
      <div className="facility-profit-analysis__heading">
        <div>
          <strong>市场利润分析</strong>
          <small>{scopeLabel} × {formatNumber(analysis.scopeCount)}，按当前公开盘口即时成交估算</small>
        </div>
        <StatusTag tone={status.tone}>{status.label}</StatusTag>
      </div>

      <div className="facility-profit-analysis__summary">
        <div className="facility-profit-analysis__metric">
          <small>补料成本</small>
          {hasInputs ? (
            <MoneyValue
              value={analysis.shortagePurchaseCost}
              fallback={analysis.scopeCount < 1 ? '暂无范围' : '盘口不足'}
            />
          ) : <strong>无需原料</strong>}
          <span>{coverageDescription}</span>
        </div>
        <div className="facility-profit-analysis__metric">
          <small>产出净额</small>
          <MoneyValue
            value={analysis.outputNetRevenue}
            fallback={analysis.scopeCount < 1 ? '暂无范围' : `${formatNumber(analysis.outputSale.filledQuantity)}／${formatNumber(analysis.outputQuantity)}`}
          />
          <span>{outputDescription}</span>
        </div>
        <div className={`facility-profit-analysis__metric${amountTone(analysis.cashProfit)}`}>
          <small>本轮现金利润</small>
          <MoneyValue value={analysis.cashProfit} fallback={analysis.scopeCount < 1 ? '暂无范围' : '无法估算'} showSign />
          <span>使用现有库存并从卖盘补齐缺口</span>
        </div>
      </div>

      <div className="facility-profit-analysis__metrics">
        {hasInputs ? (
          <>
            <div className={`facility-profit-analysis__metric${amountTone(analysis.fullPurchaseProfit)}`}>
              <small>全量采购利润</small>
              <MoneyValue value={analysis.fullPurchaseProfit} fallback="盘口不足" showSign />
              <span>全部原料按当前最低卖盘逐档买入</span>
            </div>
            <div className={`facility-profit-analysis__metric${amountTone(analysis.valueAddedProfit)}`}>
              <small>相比直接卖原料</small>
              <MoneyValue value={analysis.valueAddedProfit} fallback="盘口不足" showSign />
              <span>原料与产出均按当前最高买盘逐档卖出</span>
            </div>
          </>
        ) : (
          <>
            <div className={`facility-profit-analysis__metric${amountTone(analysis.cashProfit)}`}>
              <small>周期净收益</small>
              <MoneyValue value={analysis.cashProfit} fallback="盘口不足" showSign />
              <span>产出净额扣除周期运营成本</span>
            </div>
            <div className="facility-profit-analysis__metric">
              <small>预计卖方手续费</small>
              <MoneyValue value={analysis.outputQuantity > 0 ? analysis.outputSellFee : null} fallback="暂无范围" />
              <span>按一张卖单累计成交额估算</span>
            </div>
          </>
        )}
        <div className={`facility-profit-analysis__metric${amountTone(analysis.profitPerMinute)}`}>
          <small>{hasInputs ? '加工增值／分钟' : '生产利润／分钟'}</small>
          <MoneyValue value={analysis.profitPerMinute} fallback="盘口不足" showSign />
          <span>按当前配方周期折算</span>
        </div>
        <div className="facility-profit-analysis__metric">
          <small>静态建造回本</small>
          <strong>{paybackLabel}</strong>
          <span>按当前集群对应建造成本静态估算</span>
        </div>
      </div>

      {analysis.inputs.length > 0 ? (
        <div className="facility-profit-analysis__inputs" aria-label="原料盘口明细">
          {analysis.inputs.map((input) => {
            const name = productNames.get(input.productId) ?? input.productId;
            const purchaseDetail = input.purchaseQuantity <= 0
              ? '库存已覆盖，无需补买'
              : `补买 ${formatNumber(input.shortagePurchase.filledQuantity)}／${formatNumber(input.purchaseQuantity)}，盘口成本 ${formatCurrency(input.shortagePurchase.total)}`;
            return (
              <div className="facility-profit-analysis__input-row" key={input.productId}>
                <strong>{name} × {formatNumber(input.requiredQuantity)}</strong>
                <span className="facility-profit-analysis__input-detail">
                  可用 {formatNumber(input.inventoryQuantity)}；{purchaseDetail}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="facility-profit-analysis__warning-list" aria-live="polite">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}

      <p className="facility-profit-analysis__note">
        逐档读取公开订单簿并排除自己的反向订单，不使用基础价、参考价或未成交挂单外推。实际成交仍受价格时间优先、卖单累计手续费和后续盘口变化影响。
      </p>
    </section>
  );
}
