import type { ExtendedAdminSummary, PopulationEconomyAdminSummary, PopulationModelAdminSummary, PopulationModelId } from '../api/admin';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AdminPopulationControl } from './AdminPopulationControl';
import { CurrencyAmount } from './ui/CurrencyAmount';
import { EmptyState, Panel, StatusTag } from './ui/layout';

// ADMIN_OVERVIEW_SCHEME: population-health-matrix
const MODEL_IDS: PopulationModelId[] = ['basic', 'skilled', 'professional'];

type HealthTone = 'success' | 'warning' | 'danger' | 'neutral';

function populationStateLabel(state: PopulationModelAdminSummary['consumptionState']) {
  if (state === 'cautious') return '谨慎';
  if (state === 'subsistence') return '生存';
  return '正常';
}

function populationStateTone(state: PopulationModelAdminSummary['consumptionState']): HealthTone {
  if (state === 'cautious') return 'warning';
  if (state === 'subsistence') return 'danger';
  return 'success';
}

function pendingIncomeTotal(model: PopulationModelAdminSummary) {
  return Object.values(model.pendingIncome).reduce((sum, value) => sum + value, 0);
}

function walletHealth(economy: PopulationEconomyAdminSummary, model: PopulationModelAdminSummary) {
  const target = Math.max(0, model.stabilizationBudget * economy.policy.targetWalletCycles);
  const wallet = Math.max(0, model.credits + model.frozenCredits);
  const gap = Math.max(0, target - wallet);
  const coveragePercent = target > 0 ? Math.round(wallet / target * 100) : 100;
  const tone: HealthTone = coveragePercent >= 100 ? 'success' : coveragePercent >= 50 ? 'warning' : 'danger';
  return { target, wallet, gap, coveragePercent, tone };
}

function ProgressBar({ value, tone, label }: { value: number; tone: HealthTone; label: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <span className={`admin-population-bar admin-population-bar--${tone}`} role="img" aria-label={label}>
      <span style={{ width: `${width}%` }} />
    </span>
  );
}

function BudgetSplit({ food, household }: { food: number; household: number }) {
  const total = Math.max(0, food + household);
  const foodPercent = total > 0 ? Math.round(food / total * 100) : 0;
  const householdPercent = Math.max(0, 100 - foodPercent);
  return (
    <span className="admin-population-budget-split" aria-label={`食品 ${foodPercent}%，家庭 ${householdPercent}%`}>
      <span className="food" style={{ width: `${foodPercent}%` }} />
      <span className="household" style={{ width: `${householdPercent}%` }} />
    </span>
  );
}

function PopulationAmount({ value }: { value: number }) {
  return <CurrencyAmount>{formatCurrency(value)}</CurrencyAmount>;
}

function PopulationMatrix({ economy }: { economy: PopulationEconomyAdminSummary }) {
  const models = MODEL_IDS.map((id) => economy.models[id]);
  return (
    <>
      <section className="admin-population-matrix" role="table" aria-label="人口需求比较矩阵">
        <div className="admin-population-matrix__row admin-population-matrix__row--header" role="row">
          <span role="columnheader">指标</span>
          {models.map((model) => <strong role="columnheader" key={model.id}>{model.name}</strong>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">状态</span>
          {models.map((model) => (
            <span role="cell" key={model.id}><StatusTag tone={populationStateTone(model.consumptionState)}>{populationStateLabel(model.consumptionState)}</StatusTag></span>
          ))}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">钱包覆盖</span>
          {models.map((model) => {
            const health = walletHealth(economy, model);
            return (
              <span className="admin-population-coverage" role="cell" key={model.id}>
                <span><strong>{health.coveragePercent}%</strong><small>目标 <PopulationAmount value={health.target} /></small></span>
                <ProgressBar value={health.coveragePercent} tone={health.tone} label={`${model.name}钱包覆盖 ${health.coveragePercent}%`} />
                <small>{health.gap > 0 ? <>缺口 <PopulationAmount value={health.gap} /></> : '钱包充足'}</small>
              </span>
            );
          })}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">可用／冻结</span>
          {models.map((model) => <span role="cell" key={model.id}><PopulationAmount value={model.credits} />／<PopulationAmount value={model.frozenCredits} /></span>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">当前消费预算</span>
          {models.map((model) => <span role="cell" key={model.id}><PopulationAmount value={model.lastBudget} /></span>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">食品／家庭</span>
          {models.map((model) => {
            const total = Math.max(0, model.foodBudget + model.householdBudget);
            const foodPercent = total > 0 ? Math.round(model.foodBudget / total * 100) : 0;
            return (
              <span className="admin-population-budget-cell" role="cell" key={model.id}>
                <BudgetSplit food={model.foodBudget} household={model.householdBudget} />
                <small>食品 {foodPercent}% · 家庭 {100 - foodPercent}%</small>
              </span>
            );
          })}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">最近收入／EMA</span>
          {models.map((model) => <span role="cell" key={model.id}><PopulationAmount value={model.lastIncome} />／<PopulationAmount value={model.incomeEma} /></span>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">稳定预算／自动补充</span>
          {models.map((model) => <span role="cell" key={model.id}><PopulationAmount value={model.stabilizationBudget} />／<PopulationAmount value={model.lastStabilizationIssued} /></span>)}
        </div>
        <div className="admin-population-matrix__row" role="row">
          <span role="rowheader">待结算／无收入周期</span>
          {models.map((model) => <span role="cell" key={model.id}><PopulationAmount value={pendingIncomeTotal(model)} />／{model.noIncomeCycles}</span>)}
        </div>
      </section>

      <section className="admin-population-mobile-models" aria-label="人口需求移动端摘要">
        {models.map((model) => {
          const health = walletHealth(economy, model);
          const totalBudget = Math.max(0, model.foodBudget + model.householdBudget);
          const foodPercent = totalBudget > 0 ? Math.round(model.foodBudget / totalBudget * 100) : 0;
          return (
            <article className="admin-population-model-card" key={model.id}>
              <header><h3>{model.name}</h3><StatusTag tone={populationStateTone(model.consumptionState)}>{populationStateLabel(model.consumptionState)}</StatusTag></header>
              <div className="admin-population-mobile-coverage">
                <span><strong>钱包覆盖 {health.coveragePercent}%</strong><small>{health.gap > 0 ? <>缺口 <PopulationAmount value={health.gap} /></> : '钱包充足'}</small></span>
                <ProgressBar value={health.coveragePercent} tone={health.tone} label={`${model.name}钱包覆盖 ${health.coveragePercent}%`} />
              </div>
              <dl>
                <div><dt>可用／冻结</dt><dd><PopulationAmount value={model.credits} />／<PopulationAmount value={model.frozenCredits} /></dd></div>
                <div><dt>当前预算</dt><dd><PopulationAmount value={model.lastBudget} /></dd></div>
                <div><dt>食品／家庭</dt><dd>{foodPercent}%／{100 - foodPercent}%</dd></div>
                <div><dt>收入／EMA</dt><dd><PopulationAmount value={model.lastIncome} />／<PopulationAmount value={model.incomeEma} /></dd></div>
                <div><dt>稳定／补充</dt><dd><PopulationAmount value={model.stabilizationBudget} />／<PopulationAmount value={model.lastStabilizationIssued} /></dd></div>
                <div><dt>待结算／无收入</dt><dd><PopulationAmount value={pendingIncomeTotal(model)} />／{model.noIncomeCycles}</dd></div>
              </dl>
            </article>
          );
        })}
      </section>
    </>
  );
}

function SourceDistribution({ economy }: { economy: PopulationEconomyAdminSummary }) {
  const rows = [
    ['生产运营', economy.sources.production],
    ['建造业（60／30／10）', economy.sources.construction],
    ['仓库扩容', economy.sources.warehouse],
    ['市场服务', economy.sources.marketService],
  ] as const;
  const total = Math.max(0, rows.reduce((sum, [, value]) => sum + value, 0));
  return (
    <section className="admin-population-analysis-card">
      <header><h3>就业收入来源</h3><small>累计构成</small></header>
      <div className="admin-population-distribution-list">
        {rows.map(([label, value]) => {
          const percent = total > 0 ? Math.round(value / total * 100) : 0;
          return (
            <div key={label}>
              <span><strong>{label}</strong><small>{percent}% · <PopulationAmount value={value} /></small></span>
              <ProgressBar value={percent} tone="neutral" label={`${label}占比 ${percent}%`} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ComplexityDistribution({ economy }: { economy: PopulationEconomyAdminSummary }) {
  const entries = Object.entries(economy.productionByComplexity) as [keyof PopulationEconomyAdminSummary['productionByComplexity'], number][];
  const maximum = Math.max(1, ...entries.map(([, value]) => value));
  return (
    <section className="admin-population-analysis-card">
      <header><h3>C1—C7 生产工资</h3><small>复杂度分布</small></header>
      <div className="admin-population-complexity-bars">
        {entries.map(([complexity, value]) => {
          const percent = Math.round(value / maximum * 100);
          return (
            <div key={complexity}>
              <span>{complexity}</span>
              <ProgressBar value={percent} tone="neutral" label={`${complexity}工资 ${formatCurrency(value)}`} />
              <strong><PopulationAmount value={value} /></strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AdminOverview({
  summary,
  onChanged,
  onNotice,
}: {
  summary: ExtendedAdminSummary | null;
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const economy = summary?.populationEconomy;
  const totalWalletGap = economy
    ? MODEL_IDS.reduce((sum, id) => sum + walletHealth(economy, economy.models[id]).gap, 0)
    : 0;

  return (
    <div className="admin-section-stack admin-overview-dashboard">
      <section className="admin-summary-grid admin-summary-grid--compact" aria-label="世界概况">
        <article className="admin-overview-stat">
          <span>玩家数量</span>
          <strong>{summary?.playerCount ?? '--'}</strong>
          <small>当前注册账户</small>
        </article>
        <article className="admin-overview-stat">
          <span>未完成订单</span>
          <strong>{summary?.openOrderCount ?? '--'}</strong>
          <small>商品 {summary?.commodityOrderCount ?? '--'} · 工厂 {summary?.facilityOrderCount ?? '--'}</small>
        </article>
        <article className="admin-overview-stat">
          <span>藏品资产</span>
          <strong>{summary?.collectibleCount ?? '--'}</strong>
          <small>进行中拍卖 {summary?.openAuctionCount ?? '--'}</small>
        </article>
      </section>

      <Panel className="admin-panel admin-population-economy">
        <header className="admin-population-heading">
          <div>
            <h2>人口经济</h2>
            <p>横向比较三类人口钱包、收入和需求状态，优先识别下一周期资金缺口。</p>
          </div>
          {economy ? (
            <div className="admin-population-heading__meta">
              <StatusTag tone={economy.policy.isDefault ? 'success' : economy.policy.remainingCycles !== null && economy.policy.remainingCycles <= 2 ? 'warning' : 'neutral'}>
                {economy.policy.isDefault ? '默认政策' : `临时政策 · 剩余 ${economy.policy.remainingCycles} 周期`}
              </StatusTag>
              <small>下个需求周期 {formatDate(economy.policy.nextCycleAt)}</small>
            </div>
          ) : null}
        </header>

        {economy ? (
          <>
            <section className="admin-population-health-grid" aria-label="人口经济当前状态">
              <article><span>人口可用资金</span><strong><PopulationAmount value={economy.credits} /></strong></article>
              <article><span>人口冻结资金</span><strong><PopulationAmount value={economy.frozenCredits} /></strong></article>
              <article><span>本周期消费预算</span><strong><PopulationAmount value={economy.lastBudget} /></strong></article>
              <article><span>待结算就业收入</span><strong><PopulationAmount value={economy.pendingIncome} /></strong></article>
              <article><span>施工就业托管</span><strong><PopulationAmount value={economy.constructionEscrow} /></strong></article>
              <article className={totalWalletGap > 0 ? 'is-warning' : 'is-success'}><span>当前钱包总缺口</span><strong><PopulationAmount value={totalWalletGap} /></strong></article>
            </section>

            <PopulationMatrix economy={economy} />

            <div className="admin-population-analysis-grid">
              <SourceDistribution economy={economy} />
              <ComplexityDistribution economy={economy} />
            </div>

            <section className="admin-population-ledger" aria-label="人口经济累计统计">
              <header><h3>累计资金流</h3><small>历史统计与发行构成</small></header>
              <dl>
                <div><dt>累计就业收入</dt><dd><PopulationAmount value={economy.totalEmploymentIncome} /></dd></div>
                <div><dt>累计人口消费</dt><dd><PopulationAmount value={economy.totalConsumption} /></dd></div>
                <div><dt>累计货币发行</dt><dd><PopulationAmount value={economy.issuance.total} /></dd></div>
                <div><dt>累计稳定需求补充</dt><dd><PopulationAmount value={economy.issuance.stabilization} /></dd></div>
                <div><dt>累计管理员人口补充</dt><dd><PopulationAmount value={economy.issuance.adminPopulation} /></dd></div>
                <div><dt>累计生产工资补贴</dt><dd><PopulationAmount value={economy.productionWageAdjustment.subsidyIssued} /></dd></div>
                <div><dt>累计生产工资扣留</dt><dd><PopulationAmount value={economy.productionWageAdjustment.withheld} /></dd></div>
                <div><dt>工作／兑换／礼品发行</dt><dd><PopulationAmount value={economy.issuance.work} />／<PopulationAmount value={economy.issuance.exchange} />／<PopulationAmount value={economy.issuance.gift} /></dd></div>
              </dl>
            </section>

            <AdminPopulationControl economy={economy} onChanged={onChanged} onNotice={onNotice} />
          </>
        ) : <EmptyState>人口经济数据尚未初始化。</EmptyState>}
      </Panel>
    </div>
  );
}
