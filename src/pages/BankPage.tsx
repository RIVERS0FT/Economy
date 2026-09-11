import { useState } from 'react';
import { InvestmentPage } from './InvestmentPage';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { AssetOverviewPanel } from '../components/assets/AssetOverviewPanel';
import { BankIcon, FactoryIcon } from '../components/icons/GameIcons';
import { CompactNumber } from '../components/ui/CompactNumber';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { MoneyInput } from '../components/ui/FormControls';
import {
  Button,
  DataList,
  DataRow,
  EmptyState,
  MetricCard,
  PageLayout,
  PagePanel,
  StatusTag,
  ToggleField,
  WidgetHeading,
} from '../components/ui/layout';
import { LiveDurationUntil } from '../components/time/LiveServerTime';
import { useNow } from '../hooks/useNow';
import { formatCurrency, formatTime } from '../utils/formatters';
import { parseMoneyDraft } from '../utils/moneyDraft';

const RECENT_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;

type PendingAction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'auto-repay' | null;
type TransferDirection = 'deposit' | 'withdraw';
type HistoryFilter = 'all' | 'transfer' | 'interest' | 'loan' | 'settlement';
type LoanTermHours = 24 | 72 | 168;

const HISTORY_FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'transfer', label: '存取' },
  { id: 'interest', label: '利息' },
  { id: 'loan', label: '贷款' },
  { id: 'settlement', label: '结算' },
];

const LOAN_TERM_OPTIONS: Array<{ hours: LoanTermHours; rateBps: number }> = [
  { hours: 24, rateBps: 200 },
  { hours: 72, rateBps: 400 },
  { hours: 168, rateBps: 900 },
];

function formatRateBps(rateBps: number) {
  return `${(Math.max(0, rateBps) / 100).toFixed(2)}%`;
}

function transactionTone(type: string) {
  if (['deposit', 'loan_disbursed', 'deposit_interest', 'collection_surplus'].includes(type)) return 'success' as const;
  if (['default', 'interest_paid', 'weekly_cash_settlement', 'collection_repayment'].includes(type)) return 'danger' as const;
  if (['grace_started', 'collection_pending'].includes(type)) return 'warning' as const;
  return 'neutral' as const;
}

function transactionFilter(type: string): Exclude<HistoryFilter, 'all'> {
  if (['deposit', 'withdrawal'].includes(type)) return 'transfer';
  if (['deposit_interest', 'interest_paid'].includes(type)) return 'interest';
  if (type === 'weekly_cash_settlement') return 'settlement';
  return 'loan';
}

function floorMoney(value: number) {
  return Math.max(0, Math.floor((Math.max(0, value) + Number.EPSILON) * 100) / 100);
}

function ceilMoney(value: number) {
  return Math.max(0, Math.ceil((Math.max(0, value) - Number.EPSILON) * 100) / 100);
}

function utilizationSurchargeBps(utilizationBps: number) {
  if (utilizationBps <= 5_000) return 0;
  if (utilizationBps <= 8_000) return 100;
  return 200;
}

export function BankPage({ model }: { model: LoadedGameViewModel }) {
  const identity = `${model.user?.id ?? 'preview'}:${model.game.saveEpoch}`;
  if (model.game.commodityInvestment?.enabled) {
    return <InvestmentPage key={identity} model={model} funds={<BankFundsPanel model={model} />} />;
  }
  return <PageLayout title="银行"><AssetOverviewPanel model={model} /><BankFundsPanel key={identity} model={model} /></PageLayout>;
}

export function BankFundsPanel({ model }: { model: LoadedGameViewModel }) {
  const { bankAccount, bankSummary } = model.game;
  const provinces = model.game.provinces || [];
  const weeklyCashSettlement = bankSummary.weeklyCashSettlement;
  const referenceNow = model.game.lastProcessedAt;
  const riskNow = useNow(referenceNow, 60_000);
  const [transferDirection, setTransferDirection] = useState<TransferDirection>('deposit');
  const [transferDraft, setTransferDraft] = useState('');
  const [loanDraft, setLoanDraft] = useState('');
  const [loanTermHours, setLoanTermHours] = useState<LoanTermHours>(72);
  const [repayDraft, setRepayDraft] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [pending, setPending] = useState<PendingAction>(null);

  const activeLoan = bankAccount.activeLoan;
  const legacyCollateralLoan = Boolean(activeLoan && activeLoan.collateral.length > 0);
  const transferSourceCredits = transferDirection === 'deposit' ? model.game.credits : bankAccount.depositCredits;
  const transferBlocked = transferSourceCredits < 0.01 || (transferDirection === 'withdraw' && activeLoan?.status === 'grace');
  const transferAmount = parseMoneyDraft(transferDraft, { min: 0.01, max: Math.max(0.01, transferSourceCredits) });

  const recentDefault = bankAccount.recentDefaultAt !== null && riskNow - bankAccount.recentDefaultAt < RECENT_DEFAULT_MS;
  const goodRepayment = bankAccount.repaidLoanCount > 0 && !recentDefault;
  const creditRatioBps = Math.min(
    bankSummary.maximumLoanToValueBps,
    Math.max(
      bankSummary.minimumLoanToValueBps,
      bankSummary.baseLoanToValueBps
        + (goodRepayment ? bankSummary.repaymentHistoryBonusBps : 0)
        - (recentDefault ? bankSummary.recentDefaultPenaltyBps : 0),
    ),
  );
  const creditAssetValue = Math.max(0, bankSummary.assetCreditValue
    ?? model.game.assetSummary.netAssetValue ?? model.game.assetSummary.totalAssets ?? 0);
  const maximumLoan = bankSummary.maximumLoanCredits ?? floorMoney(creditAssetValue * creditRatioBps / 10_000);
  const requestedLoan = parseMoneyDraft(loanDraft, { min: 0.01, max: Math.max(0.01, maximumLoan) });
  const creditUtilizationBps = requestedLoan && maximumLoan > 0
    ? Math.min(10_000, Math.ceil(requestedLoan * 10_000 / maximumLoan))
    : 0;
  const selectedTerm = LOAN_TERM_OPTIONS.find((option) => option.hours === loanTermHours) || LOAN_TERM_OPTIONS[1];
  const usageSurchargeBps = utilizationSurchargeBps(creditUtilizationBps);
  const requestedInterestRateBps = selectedTerm.rateBps + usageSurchargeBps;
  const requestedInterest = requestedLoan
    ? ceilMoney(requestedLoan * requestedInterestRateBps / 10_000)
    : 0;
  const remainingLoanCapacity = floorMoney(maximumLoan - (requestedLoan || 0));

  const activeLiability = activeLoan
    ? activeLoan.principalOutstanding + activeLoan.interestOutstanding
    : 0;
  const repayAmount = activeLoan
    ? parseMoneyDraft(repayDraft, { min: 0.01, max: Math.max(0.01, activeLiability) })
    : null;
  const loanDeadline = activeLoan?.status === 'grace' ? activeLoan.graceEndsAt : activeLoan?.dueAt;
  const activeTermHours = activeLoan
    ? Math.max(1, Math.round((activeLoan.dueAt - activeLoan.borrowedAt) / (60 * 60 * 1000)))
    : 0;
  const filteredTransactions = historyFilter === 'all'
    ? bankAccount.recentTransactions
    : bankAccount.recentTransactions.filter((transaction) => transactionFilter(transaction.type) === historyFilter);

  function setTransferShare(share: number) {
    const amount = share >= 1 ? transferSourceCredits : floorMoney(transferSourceCredits * share);
    setTransferDraft(amount >= 0.01 ? String(amount) : '');
  }

  function setLoanShare(share: number) {
    const amount = share >= 1 ? maximumLoan : floorMoney(maximumLoan * share);
    setLoanDraft(amount >= 0.01 ? String(amount) : '');
  }

  function changeTransferDirection(direction: TransferDirection) {
    if (direction === transferDirection) return;
    setTransferDirection(direction);
    setTransferDraft('');
  }

  async function submit(action: Exclude<PendingAction, null>, operation: () => Promise<{ ok: boolean; message: string }>, clear?: () => void) {
    if (pending) return;
    setPending(action);
    try {
      const result = await operation();
      model.notify(result.message);
      if (result.ok) clear?.();
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '银行操作失败');
    } finally {
      setPending(null);
    }
  }

  return (
    <>

      <PagePanel className="bank-cash-panel">
        <WidgetHeading title="资金管理" action={<BankIcon />} />
        <div className="bank-account-balance-strip" aria-label="资金账户余额">
          <span><small>可用资金</small><strong><CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount></strong></span>
          <span><small>银行存款</small><strong><CurrencyAmount>{formatCurrency(bankAccount.depositCredits)}</CurrencyAmount></strong></span>
          <span><small>今日计息余额</small><strong><CurrencyAmount>{formatCurrency(bankAccount.eligibleDepositCredits)}</CurrencyAmount></strong></span>
        </div>

        <div className="bank-cash-workspace">
          <section className="bank-transfer-workspace" aria-labelledby="bank-transfer-title">
            <div className="bank-section-heading">
              <div>
                <h3 id="bank-transfer-title">资金转移</h3>
                <p>在经营现金与银行存款之间调配资金，不改变净资产。</p>
              </div>
            </div>
            <div className="ui-segmented bank-transfer-direction" role="group" aria-label="资金转移方向">
              <Button
                variant="text"
                className={transferDirection === 'deposit' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={transferDirection === 'deposit'}
                disabled={Boolean(pending)}
                onClick={() => changeTransferDirection('deposit')}
              >存入</Button>
              <Button
                variant="text"
                className={transferDirection === 'withdraw' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={transferDirection === 'withdraw'}
                disabled={activeLoan?.status === 'grace' || Boolean(pending)}
                onClick={() => changeTransferDirection('withdraw')}
              >取出</Button>
            </div>
            <MoneyInput
              label={transferDirection === 'deposit' ? '存入金额' : '取出金额'}
              description={transferDirection === 'deposit'
                ? '本日新增存款从下一个北京时间自然日开始参与计息。'
                : '当日取款会降低本日有效计息余额；贷款宽限期和追偿期暂停取款。'}
              value={transferDraft}
              fallbackValue={0.01}
              min={0.01}
              max={Math.max(0.01, transferSourceCredits)}
              onValueChange={setTransferDraft}
              disabled={transferBlocked}
              error={transferDraft && transferAmount === null
                ? `请输入不超过${transferDirection === 'deposit' ? '可用资金' : '银行存款'}的正数金额；超过两位小数无效。`
                : undefined}
            />
            <div className="bank-transfer-quick-actions" aria-label="快捷金额">
              <Button variant="secondary" disabled={transferBlocked || Boolean(pending)} onClick={() => setTransferShare(0.25)}>25%</Button>
              <Button variant="secondary" disabled={transferBlocked || Boolean(pending)} onClick={() => setTransferShare(0.5)}>50%</Button>
              <Button variant="secondary" disabled={transferBlocked || Boolean(pending)} onClick={() => setTransferShare(1)}>最大</Button>
            </div>
            <Button
              block
              disabled={!transferAmount || transferBlocked || Boolean(pending)}
              onClick={() => {
                if (!transferAmount) return;
                if (transferDirection === 'deposit') {
                  void submit('deposit', () => model.bankDeposit(transferAmount), () => setTransferDraft(''));
                } else {
                  void submit('withdraw', () => model.bankWithdraw(transferAmount), () => setTransferDraft(''));
                }
              }}
            >
              {pending === transferDirection ? '处理中…' : transferDirection === 'deposit' ? '确认存入' : '确认取出'}
            </Button>
          </section>

          <section className="bank-week-plan" aria-labelledby="bank-week-plan-title">
            <div className="bank-section-heading">
              <div>
                <h3 id="bank-week-plan-title">本周资金计划</h3>
                <p>集中查看服务器已经给出的计息资格、结息和周结算估算。</p>
              </div>
              <StatusTag tone={weeklyCashSettlement.interestActive ? 'success' : 'neutral'}>
                {weeklyCashSettlement.interestActive ? '本周已激活' : '本周未激活'}
              </StatusTag>
            </div>
            <DataList>
              <DataRow label="固定日利率" value={formatRateBps(bankSummary.dailyInterestCapBps)} tone="success" />
              <DataRow label="本周状态" value={weeklyCashSettlement.interestActive ? '成功经济活动后已激活' : '等待成功经济活动'} />
              <DataRow label="计息开始" value={weeklyCashSettlement.interestEligibleFrom ? formatTime(weeklyCashSettlement.interestEligibleFrom) : '激活后的下一个 00:00'} />
              <DataRow
                label="下一次结息"
                value={<LiveDurationUntil deadline={bankSummary.nextInterestSettlementAt} referenceNow={referenceNow} zeroText="等待服务器结算" />}
              />
              <DataRow label="昨日入账利息" value={<CurrencyAmount>{formatCurrency(bankAccount.lastDepositInterestEarned)}</CurrencyAmount>} tone="success" />
              <DataRow label="累计存款利息" value={<CurrencyAmount>{formatCurrency(bankAccount.totalDepositInterestEarned)}</CurrencyAmount>} />
              <DataRow label="预计周末计税资金" value={<CurrencyAmount>{formatCurrency(weeklyCashSettlement.estimatedTaxBase)}</CurrencyAmount>} />
              <DataRow label="预计周扣除" value={<CurrencyAmount>{formatCurrency(weeklyCashSettlement.estimatedAssessment)}</CurrencyAmount>} tone="warning" />
              <DataRow label="待完成结算" value={<CurrencyAmount>{formatCurrency(weeklyCashSettlement.outstandingCredits)}</CurrencyAmount>} tone={weeklyCashSettlement.outstandingCredits > 0 ? 'danger' : 'neutral'} />
            </DataList>
            <p className="bank-settlement-countdown">结息时间：{formatTime(bankSummary.nextInterestSettlementAt)}</p>
            <p className="bank-panel-note">成功经济操作会激活本周，存款从下一个北京时间自然日按每日 1% 计息；周末按净货币资金生成 10% 账单，并在下一次登录时优先从存款、再从可用资金完成。冻结资金计入周末估算，但不会被直接解冻或扣除。</p>
          </section>
        </div>
      </PagePanel>

      <PagePanel className="bank-loan-panel">
        <WidgetHeading
          title="银行贷款"
          action={activeLoan
            ? <StatusTag tone={activeLoan.status === 'grace' ? 'danger' : 'warning'}>{legacyCollateralLoan ? '历史抵押贷款' : activeLoan.status === 'grace' ? '宽限／追偿期' : '还款中'}</StatusTag>
            : <StatusTag tone="info">资产授信</StatusTag>}
        />
        {activeLoan ? (
          <div className="bank-active-loan">
            <div className="bank-loan-summary-grid">
              <MetricCard label="总应还" value={<CurrencyAmount>{formatCurrency(activeLiability)}</CurrencyAmount>} tone={activeLoan.status === 'grace' ? 'danger' : 'warning'} />
              <MetricCard label="未偿本金" value={<CurrencyAmount>{formatCurrency(activeLoan.principalOutstanding)}</CurrencyAmount>} />
              <MetricCard label="未付利息" value={<CurrencyAmount>{formatCurrency(activeLoan.interestOutstanding)}</CurrencyAmount>} tone="warning" />
              <MetricCard label={legacyCollateralLoan ? '贷款价值比' : '授信利用率'} value={formatRateBps(activeLoan.ltvBps)} />
              <MetricCard label="锁定总利率" value={formatRateBps(activeLoan.interestRateBps)} />
              <MetricCard label="贷款周期" value={`${activeTermHours}h`} />
              <MetricCard label="剩余时间" value={loanDeadline ? <LiveDurationUntil deadline={loanDeadline} referenceNow={referenceNow} zeroText="等待服务器结算" /> : '—'} detail={formatTime(loanDeadline || 0)} tone={activeLoan.status === 'grace' ? 'danger' : 'neutral'} />
            </div>
            {activeLoan.status === 'grace' ? (
              <div className="bank-loan-risk-callout" role="status">
                <strong>宽限期风险</strong>
                <span>{legacyCollateralLoan
                  ? '该历史贷款仍按原条款处理：宽限结束仍未结清时，服务器按原抵押规则处置冻结工厂。'
                  : '宽限结束仍未结清时，服务器依次追偿银行存款、可用资金、可用商品、可用工厂和商业建筑；不足部分保留欠款并定期继续追偿。'}</span>
              </div>
            ) : null}
            {legacyCollateralLoan ? (
              <div className="bank-collateral-summary">
                <strong>历史冻结工厂</strong>
                <div className="bank-collateral-chips">
                  {activeLoan.collateral.map((item) => {
                    const type = model.game.facilityTypes.find((facility) => facility.id === item.facilityTypeId);
                    const province = provinces.find((candidate) => candidate.id === item.provinceId);
                    return <span key={`${item.provinceId}:${item.facilityTypeId}`}><FactoryIcon />{province?.name || item.provinceId} · {type?.name || item.facilityTypeId} × {<CompactNumber value={item.quantity} />}</span>;
                  })}
                </div>
                <small>这是升级前已存在的贷款，冻结资产和违约条款保持不变直到贷款结束；新贷款不会再冻结资产。</small>
              </div>
            ) : (
              <p className="bank-panel-note">当前贷款没有抵押物。贷款期间工厂、商品与商业建筑保持正常经营和交易资格，只有发生违约追偿时服务器才处理可用资产。</p>
            )}
            <ToggleField
              label="自动还款"
              description="到期时先使用银行存款，再使用可用资金。"
              checked={activeLoan.autoRepay}
              disabled={Boolean(pending)}
              onChange={(event) => { const enabled = event.currentTarget.checked; void submit('auto-repay', () => model.bankSetAutoRepay(activeLoan.id, enabled)); }}
            />
            <div className="bank-repayment-row">
              <MoneyInput
                label="还款金额"
                value={repayDraft}
                fallbackValue={0.01}
                min={0.01}
                max={Math.max(0.01, activeLiability)}
                onValueChange={setRepayDraft}
                error={repayDraft && repayAmount === null ? '请输入不超过当前应还总额的正数金额；超过两位小数无效。' : undefined}
              />
              <div className="bank-form-actions">
                <Button variant="secondary" disabled={model.game.credits < activeLiability || Boolean(pending)} onClick={() => setRepayDraft(String(activeLiability))}>全部金额</Button>
                <Button disabled={!repayAmount || model.game.credits < (repayAmount || 0) || Boolean(pending)} onClick={() => submit('repay', () => model.bankRepay(activeLoan.id, repayAmount || 0), () => setRepayDraft(''))}>
                  {pending === 'repay' ? '处理中…' : '还款'}
                </Button>
                <Button variant="secondary" disabled={model.game.credits < activeLiability || Boolean(pending)} onClick={() => submit('repay', () => model.bankRepay(activeLoan.id, 'all'), () => setRepayDraft(''))}>全部还清</Button>
              </div>
            </div>
          </div>
        ) : (
          <section className="bank-loan-decision" aria-labelledby="bank-loan-decision-title">
            <div className="bank-section-heading">
              <div>
                <h3 id="bank-loan-decision-title">贷款方案</h3>
                <p>额度由服务器按当前净资产确定；不需要选择或冻结任何抵押物。</p>
              </div>
            </div>

            <DataList>
              <DataRow label="授信资产净值" value={<CurrencyAmount>{formatCurrency(bankSummary.assetValuationAvailable === false ? null : creditAssetValue)}</CurrencyAmount>} />
              <DataRow label="最高可贷额度" value={<CurrencyAmount>{formatCurrency(maximumLoan)}</CurrencyAmount>} tone="success" />
            </DataList>

            <div className="ui-segmented bank-loan-term-selector" role="group" aria-label="贷款周期">
              {LOAN_TERM_OPTIONS.map((option) => (
                <Button
                  key={option.hours}
                  variant="text"
                  className={loanTermHours === option.hours ? 'ui-segmented__button active' : 'ui-segmented__button'}
                  aria-pressed={loanTermHours === option.hours}
                  disabled={Boolean(pending)}
                  onClick={() => setLoanTermHours(option.hours)}
                >{option.hours}h · {formatRateBps(option.rateBps)}</Button>
              ))}
            </div>

            <MoneyInput
              label="申请金额"
              description="可在当前最高额度内自行决定具体金额；贷款成立时锁定周期与总利息。"
              value={loanDraft}
              fallbackValue={0.01}
              min={0.01}
              max={Math.max(0.01, maximumLoan)}
              onValueChange={setLoanDraft}
              disabled={maximumLoan < 0.01}
              error={loanDraft && requestedLoan === null ? '申请金额必须为不超过当前最高额度的正数；超过两位小数无效。' : undefined}
            />
            <div className="bank-transfer-quick-actions" aria-label="贷款快捷金额">
              <Button variant="secondary" disabled={maximumLoan < 0.01 || Boolean(pending)} onClick={() => setLoanShare(0.25)}>25%</Button>
              <Button variant="secondary" disabled={maximumLoan < 0.01 || Boolean(pending)} onClick={() => setLoanShare(0.5)}>50%</Button>
              <Button variant="secondary" disabled={maximumLoan < 0.01 || Boolean(pending)} onClick={() => setLoanShare(0.75)}>75%</Button>
              <Button variant="secondary" disabled={maximumLoan < 0.01 || Boolean(pending)} onClick={() => setLoanShare(1)}>最大</Button>
            </div>

            <div className="bank-credit-utilization">
              <div className="bank-credit-utilization-heading">
                <span>授信利用率</span>
                <strong>{(creditUtilizationBps / 100).toFixed(2)}%</strong>
              </div>
              <div
                className="bank-credit-utilization-track"
                role="progressbar"
                aria-label="授信利用率"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={creditUtilizationBps / 100}
              >
                <span style={{ width: `${creditUtilizationBps / 100}%` }} />
              </div>
              <div className="bank-credit-utilization-meta">
                <span>剩余授信 <strong><CurrencyAmount>{formatCurrency(remainingLoanCapacity)}</CurrencyAmount></strong></span>
                <span>额度使用加点 <strong>+{formatRateBps(usageSurchargeBps)}</strong></span>
              </div>
            </div>

            <DataList>
              <DataRow label="贷款周期" value={`${loanTermHours}h`} />
              <DataRow label="锁定总利率" value={formatRateBps(requestedInterestRateBps)} />
              <DataRow label="预计总利息" value={<CurrencyAmount>{formatCurrency(requestedInterest)}</CurrencyAmount>} />
              <DataRow label="预计应还总额" value={<CurrencyAmount>{formatCurrency((requestedLoan || 0) + requestedInterest)}</CurrencyAmount>} tone="warning" />
            </DataList>

            <div className="bank-credit-basis">
              <h4>授信依据</h4>
              <DataList>
                <DataRow label="基础授信比例" value={formatRateBps(bankSummary.baseLoanToValueBps)} />
                <DataRow label="良好还款记录" value={goodRepayment ? `+${formatRateBps(bankSummary.repaymentHistoryBonusBps)}` : '+0.00%'} tone={goodRepayment ? 'success' : 'neutral'} />
                <DataRow label="近期违约" value={recentDefault ? `-${formatRateBps(bankSummary.recentDefaultPenaltyBps)}` : '0.00%'} tone={recentDefault ? 'danger' : 'neutral'} />
                <DataRow label="最终授信比例" value={formatRateBps(creditRatioBps)} tone="info" />
              </DataList>
            </div>

            <Button block disabled={!requestedLoan || Boolean(pending)} onClick={() => submit(
              'borrow',
              () => model.bankBorrow(requestedLoan || 0, loanTermHours, true),
              () => setLoanDraft(''),
            )}>
              {pending === 'borrow' ? '评估并放款中…' : '申请贷款'}
            </Button>
            <small>贷款不冻结工厂、商品或其他资产。贷款本金会同时增加等额负债，不会提高净资产或排行榜成绩；宽限结束仍未结清时，服务器才按全资产追偿规则处理可用资产。</small>
          </section>
        )}
      </PagePanel>

      <PagePanel className="bank-history-panel">
        <WidgetHeading title="银行记录" />
        <div className="ui-segmented bank-history-filters" role="group" aria-label="银行记录分类">
          {HISTORY_FILTERS.map((filter) => (
            <Button
              key={filter.id}
              variant="text"
              className={historyFilter === filter.id ? 'ui-segmented__button active' : 'ui-segmented__button'}
              aria-pressed={historyFilter === filter.id}
              onClick={() => setHistoryFilter(filter.id)}
            >{filter.label}</Button>
          ))}
        </div>
        {filteredTransactions.length === 0 ? <EmptyState>当前分类暂无银行记录。</EmptyState> : (
          <div className="bank-history-list">
            {filteredTransactions.map((transaction) => (
              <div className="bank-history-row" key={transaction.id}>
                <div>
                  <strong>{transaction.description}</strong>
                  <small>{formatTime(transaction.createdAt)}</small>
                </div>
                <StatusTag tone={transactionTone(transaction.type)}>
                  {transaction.amount > 0 ? <CurrencyAmount>{formatCurrency(transaction.amount)}</CurrencyAmount> : '状态变更'}
                </StatusTag>
              </div>
            ))}
          </div>
        )}
      </PagePanel>
    </>
  );
}
