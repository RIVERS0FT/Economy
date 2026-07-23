import type { PopulationEconomyAdminSummary, PopulationModelAdminSummary, PopulationModelId } from '../api/admin';
import { formatCurrency } from '../utils/formatters';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { StatusTag, type StatusTone } from './ui/layout';

// ADMIN_OVERVIEW_SCHEME: population-health-matrix
const MODEL_IDS: PopulationModelId[] = ['basic', 'skilled', 'professional'];
type HealthTone = 'success' | 'warning' | 'danger' | 'neutral';

function stateLabel(state: PopulationModelAdminSummary['consumptionState']) {
  if (state === 'lavish') return '奢靡';
  if (state === 'prosperous') return '繁荣';
  if (state === 'strained') return '拮据';
  if (state === 'subsistence') return '生存';
  return '正常';
}

function stateTone(state: PopulationModelAdminSummary['consumptionState']): StatusTone {
  if (state === 'lavish') return 'neutral';
  if (state === 'prosperous') return 'info';
  if (state === 'strained') return 'warning';
  if (state === 'subsistence') return 'danger';
  return 'success';
}

function stateClassName(state: PopulationModelAdminSummary['consumptionState']) {
  return state === 'lavish' ? 'admin-population-state--lavish' : undefined;
}

function stateDescription(state: PopulationModelAdminSummary['consumptionState']) {
  if (state === 'lavish') return '收入与钱包长期显著充裕';
  if (state === 'prosperous') return '收入稳定且钱包充足';
  if (state === 'strained') return '收入明显低于近期水平';
  if (state === 'subsistence') return '收入严重不足或持续中断';
  return '收入与储蓄处于稳定区间';
}

function pendingTotal(model: PopulationModelAdminSummary) {
  return Object.values(model.pendingIncome).reduce((sum, value) => sum + value, 0);
}

function walletHealth(economy: PopulationEconomyAdminSummary, model: PopulationModelAdminSummary) {
  const target = Math.max(0, model.stabilizationBudget * economy.policy.targetWalletCycles);
  const wallet = Math.max(0, model.credits + model.frozenCredits);
  const gap = Math.max(0, target - wallet);
  const coverage = target > 0 ? Math.round(wallet / target * 100) : 100;
  const tone: HealthTone = coverage >= 100 ? 'success' : coverage >= 50 ? 'warning' : 'danger';
  return { target, gap, coverage, tone };
}

function Amount({ value }: { value: number }) {
  return <CurrencyAmount>{formatCurrency(value)}</CurrencyAmount>;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  if (value < 0.1) return '<0.1%';
  if (value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

function formatBps(value: number) {
  return formatPercent(Math.max(0, value) / 100);
}

function Bar({ value, rawValue = value, tone, label }: { value: number; rawValue?: number; tone: HealthTone; label: string }) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const hasValue = Number.isFinite(rawValue) && rawValue > 0;
  const width = hasValue ? `max(4px, ${clamped}%)` : '0%';
  return <span className={`admin-population-bar admin-population-bar--${tone}`} role="img" aria-label={label}><span style={{ width }} /></span>;
}

function PopulationState({ model }: { model: PopulationModelAdminSummary }) {
  return (
    <span className="admin-population-state-cell" title={stateDescription(model.consumptionState)}>
      <StatusTag tone={stateTone(model.consumptionState)} className={stateClassName(model.consumptionState)}>{stateLabel(model.consumptionState)}</StatusTag>
      <small>持续 {model.stateCycles} 周期</small>
    </span>
  );
}

function StateMetrics({ model }: { model: PopulationModelAdminSummary }) {
  return (
    <span className="admin-population-state-metrics">
      <strong>健康 {formatBps(model.incomeHealthBps)}</strong>
      <small>收入覆盖 {formatBps(model.incomeCoverageBps)} · 判定钱包 {formatBps(model.walletCoverageBps)}</small>
    </span>
  );
}

export function AdminPopulationHealth({ economy }: { economy: PopulationEconomyAdminSummary }) {
  const models = MODEL_IDS.map((id) => economy.models[id]);
  const totalGap = models.reduce((sum, model) => sum + walletHealth(economy, model).gap, 0);
  const sourceRows = [
    ['生产运营', economy.sources.production],
    ['建造业', economy.sources.construction],
    ['仓库扩容', economy.sources.warehouse],
    ['市场服务', economy.sources.marketService],
  ] as const;
  const sourceTotal = Math.max(0, sourceRows.reduce((sum, [, value]) => sum + value, 0));
  const complexity = Object.entries(economy.productionByComplexity) as [string, number][];
  const complexityMax = Math.max(1, ...complexity.map(([, value]) => value));

  return (
    <section className="admin-population-health" aria-label="人口经济健康概况">
      <section className="admin-population-health-grid" aria-label="人口经济当前状态">
        <article><span>人口可用资金</span><strong><Amount value={economy.credits} /></strong></article>
        <article><span>人口冻结资金</span><strong><Amount value={economy.frozenCredits} /></strong></article>
        <article><span>本周期消费预算</span><strong><Amount value={economy.lastBudget} /></strong></article>
        <article><span>待结算就业收入</span><strong><Amount value={economy.pendingIncome} /></strong></article>
        <article><span>施工就业托管</span><strong><Amount value={economy.constructionEscrow} /></strong></article>
        <article className={totalGap > 0 ? 'is-warning' : 'is-success'}><span>当前钱包总缺口</span><strong><Amount value={totalGap} /></strong></article>
      </section>

      <section className="admin-population-matrix" role="table" aria-label="人口需求比较矩阵">
        <div className="admin-population-matrix__row admin-population-matrix__row--header" role="row">
          <span role="columnheader">指标</span>
          {models.map((model) => <strong role="columnheader" key={model.id}>{model.name}</strong>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">状态</span>
          {models.map((model) => <span role="cell" key={model.id}><PopulationState model={model} /></span>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">钱包覆盖</span>
          {models.map((model) => {
            const health = walletHealth(economy, model);
            return <span className="admin-population-coverage" role="cell" key={model.id}><span><strong>{health.coverage}%</strong><small>目标 <Amount value={health.target} /></small></span><Bar value={health.coverage} rawValue={health.coverage} tone={health.tone} label={`${model.name}钱包覆盖 ${health.coverage}%`} /><small>{health.gap > 0 ? <>缺口 <Amount value={health.gap} /></> : '钱包充足'}</small></span>;
          })}
        </div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">可用／冻结</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={model.credits} />／<Amount value={model.frozenCredits} /></span>)}</div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">当前消费预算</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={model.lastBudget} /></span>)}</div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">食品／家庭</span>
          {models.map((model) => {
            const total = Math.max(0, model.foodBudget + model.householdBudget);
            const food = total > 0 ? Math.round(model.foodBudget / total * 100) : 0;
            return <span className="admin-population-budget-cell" role="cell" key={model.id}><span className="admin-population-budget-split" aria-label={`食品 ${food}%，家庭 ${100 - food}%`}><span className="food" style={{ width: `${food}%` }} /><span className="household" style={{ width: `${100 - food}%` }} /></span><small>食品 {food}% · 家庭 {100 - food}%</small></span>;
          })}
        </div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">最近收入／EMA</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={model.lastIncome} />／<Amount value={model.incomeEma} /></span>)}</div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">状态判定指标</span>{models.map((model) => <span role="cell" key={model.id}><StateMetrics model={model} /></span>)}</div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">稳定预算／自动补充</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={model.stabilizationBudget} />／<Amount value={model.lastStabilizationIssued} /></span>)}</div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">待结算／无收入周期</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={pendingTotal(model)} />／{model.noIncomeCycles}</span>)}</div>
      </section>

      <section className="admin-population-mobile-models" aria-label="人口需求移动端摘要">
        {models.map((model) => {
          const health = walletHealth(economy, model);
          const total = Math.max(0, model.foodBudget + model.householdBudget);
          const food = total > 0 ? Math.round(model.foodBudget / total * 100) : 0;
          return <article className="admin-population-model-card" key={model.id}><header><h3>{model.name}</h3><PopulationState model={model} /></header><div className="admin-population-mobile-coverage"><span><strong>钱包覆盖 {health.coverage}%</strong><small>{health.gap > 0 ? <>缺口 <Amount value={health.gap} /></> : '钱包充足'}</small></span><Bar value={health.coverage} rawValue={health.coverage} tone={health.tone} label={`${model.name}钱包覆盖 ${health.coverage}%`} /></div><dl><div><dt>可用／冻结</dt><dd><Amount value={model.credits} />／<Amount value={model.frozenCredits} /></dd></div><div><dt>当前预算</dt><dd><Amount value={model.lastBudget} /></dd></div><div><dt>食品／家庭</dt><dd>{food}%／{100 - food}%</dd></div><div><dt>收入／EMA</dt><dd><Amount value={model.lastIncome} />／<Amount value={model.incomeEma} /></dd></div><div><dt>状态判定</dt><dd><StateMetrics model={model} /></dd></div><div><dt>稳定／补充</dt><dd><Amount value={model.stabilizationBudget} />／<Amount value={model.lastStabilizationIssued} /></dd></div></dl></article>;
        })}
      </section>

      <div className="admin-population-analysis-grid">
        <section className="admin-population-analysis-card"><header><h3>就业收入来源</h3><small>累计构成</small></header><div className="admin-population-distribution-list">{sourceRows.map(([label, value]) => { const percent = sourceTotal > 0 ? value / sourceTotal * 100 : 0; const percentLabel = formatPercent(percent); return <div key={label}><span><strong>{label}</strong><small>{percentLabel} · <Amount value={value} /></small></span><Bar value={percent} rawValue={value} tone="neutral" label={`${label}占比 ${percentLabel}`} /></div>; })}</div></section>
        <section className="admin-population-analysis-card"><header><h3>C1—C7 生产工资</h3><small>复杂度分布</small></header><div className="admin-population-complexity-bars">{complexity.map(([label, value]) => { const percent = value / complexityMax * 100; return <div key={label}><span>{label}</span><Bar value={percent} rawValue={value} tone="neutral" label={`${label}工资 ${formatCurrency(value)}`} /><strong><Amount value={value} /></strong></div>; })}</div></section>
      </div>

      <section className="admin-population-ledger" aria-label="人口经济累计统计"><header><h3>累计资金流</h3><small>历史统计与发行构成</small></header><dl><div><dt>累计就业收入</dt><dd><Amount value={economy.totalEmploymentIncome} /></dd></div><div><dt>累计人口消费</dt><dd><Amount value={economy.totalConsumption} /></dd></div><div><dt>累计货币发行</dt><dd><Amount value={economy.issuance.total} /></dd></div><div><dt>累计稳定需求补充</dt><dd><Amount value={economy.issuance.stabilization} /></dd></div><div><dt>累计管理员人口补充</dt><dd><Amount value={economy.issuance.adminPopulation} /></dd></div><div><dt>累计生产工资补贴／扣留</dt><dd><Amount value={economy.productionWageAdjustment.subsidyIssued} />／<Amount value={economy.productionWageAdjustment.withheld} /></dd></div></dl></section>
    </section>
  );
}
