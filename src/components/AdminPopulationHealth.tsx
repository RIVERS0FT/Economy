import type { PopulationEconomyAdminSummary, PopulationModelAdminSummary, PopulationModelId } from '../api/admin';
import { formatCurrency } from '../utils/formatters';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { StatusTag } from './ui/layout';

// ADMIN_OVERVIEW_SCHEME: population-health-matrix
const MODEL_IDS: PopulationModelId[] = ['basic', 'skilled', 'professional'];
type HealthTone = 'success' | 'warning' | 'danger' | 'neutral';

function stateLabel(state: PopulationModelAdminSummary['consumptionState']) {
  if (state === 'cautious') return '谨慎';
  if (state === 'subsistence') return '生存';
  return '正常';
}

function stateTone(state: PopulationModelAdminSummary['consumptionState']): HealthTone {
  if (state === 'cautious') return 'warning';
  if (state === 'subsistence') return 'danger';
  return 'success';
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

function Bar({ value, tone, label }: { value: number; tone: HealthTone; label: string }) {
  return <span className={`admin-population-bar admin-population-bar--${tone}`} role="img" aria-label={label}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></span>;
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
          {models.map((model) => <span role="cell" key={model.id}><StatusTag tone={stateTone(model.consumptionState)}>{stateLabel(model.consumptionState)}</StatusTag></span>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">钱包覆盖</span>
          {models.map((model) => {
            const health = walletHealth(economy, model);
            return <span className="admin-population-coverage" role="cell" key={model.id}><span><strong>{health.coverage}%</strong><small>目标 <Amount value={health.target} /></small></span><Bar value={health.coverage} tone={health.tone} label={`${model.name}钱包覆盖 ${health.coverage}%`} /><small>{health.gap > 0 ? <>缺口 <Amount value={health.gap} /></> : '钱包充足'}</small></span>;
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
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">稳定预算／自动补充</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={model.stabilizationBudget} />／<Amount value={model.lastStabilizationIssued} /></span>)}</div>
        <div className="admin-population-matrix__row" role="row"><span role="rowheader">待结算／无收入周期</span>{models.map((model) => <span role="cell" key={model.id}><Amount value={pendingTotal(model)} />／{model.noIncomeCycles}</span>)}</div>
      </section>

      <section className="admin-population-mobile-models" aria-label="人口需求移动端摘要">
        {models.map((model) => {
          const health = walletHealth(economy, model);
          const total = Math.max(0, model.foodBudget + model.householdBudget);
          const food = total > 0 ? Math.round(model.foodBudget / total * 100) : 0;
          return <article className="admin-population-model-card" key={model.id}><header><h3>{model.name}</h3><StatusTag tone={stateTone(model.consumptionState)}>{stateLabel(model.consumptionState)}</StatusTag></header><div className="admin-population-mobile-coverage"><span><strong>钱包覆盖 {health.coverage}%</strong><small>{health.gap > 0 ? <>缺口 <Amount value={health.gap} /></> : '钱包充足'}</small></span><Bar value={health.coverage} tone={health.tone} label={`${model.name}钱包覆盖 ${health.coverage}%`} /></div><dl><div><dt>可用／冻结</dt><dd><Amount value={model.credits} />／<Amount value={model.frozenCredits} /></dd></div><div><dt>当前预算</dt><dd><Amount value={model.lastBudget} /></dd></div><div><dt>食品／家庭</dt><dd>{food}%／{100 - food}%</dd></div><div><dt>收入／EMA</dt><dd><Amount value={model.lastIncome} />／<Amount value={model.incomeEma} /></dd></div><div><dt>稳定／补充</dt><dd><Amount value={model.stabilizationBudget} />／<Amount value={model.lastStabilizationIssued} /></dd></div></dl></article>;
        })}
      </section>

      <div className="admin-population-analysis-grid">
        <section className="admin-population-analysis-card"><header><h3>就业收入来源</h3><small>累计构成</small></header><div className="admin-population-distribution-list">{sourceRows.map(([label, value]) => { const percent = sourceTotal > 0 ? Math.round(value / sourceTotal * 100) : 0; return <div key={label}><span><strong>{label}</strong><small>{percent}% · <Amount value={value} /></small></span><Bar value={percent} tone="neutral" label={`${label}占比 ${percent}%`} /></div>; })}</div></section>
        <section className="admin-population-analysis-card"><header><h3>C1—C7 生产工资</h3><small>复杂度分布</small></header><div className="admin-population-complexity-bars">{complexity.map(([label, value]) => <div key={label}><span>{label}</span><Bar value={Math.round(value / complexityMax * 100)} tone="neutral" label={`${label}工资 ${formatCurrency(value)}`} /><strong><Amount value={value} /></strong></div>)}</div></section>
      </div>

      <section className="admin-population-ledger" aria-label="人口经济累计统计"><header><h3>累计资金流</h3><small>历史统计与发行构成</small></header><dl><div><dt>累计就业收入</dt><dd><Amount value={economy.totalEmploymentIncome} /></dd></div><div><dt>累计人口消费</dt><dd><Amount value={economy.totalConsumption} /></dd></div><div><dt>累计货币发行</dt><dd><Amount value={economy.issuance.total} /></dd></div><div><dt>累计稳定需求补充</dt><dd><Amount value={economy.issuance.stabilization} /></dd></div><div><dt>累计管理员人口补充</dt><dd><Amount value={economy.issuance.adminPopulation} /></dd></div><div><dt>累计生产工资补贴／扣留</dt><dd><Amount value={economy.productionWageAdjustment.subsidyIssued} />／<Amount value={economy.productionWageAdjustment.withheld} /></dd></div></dl></section>
    </section>
  );
}
