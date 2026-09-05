import { CompactNumber } from '../components/ui/CompactNumber';
import { useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { AssetOverviewPanel } from '../components/assets/AssetOverviewPanel';
import { BankIcon, FactoryIcon } from '../components/icons/GameIcons';
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
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';

const RECENT_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;

type PendingAction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'auto-repay' | null;
type TransferDirection = 'deposit' | 'withdraw';
type HistoryFilter = 'all' | 'transfer' | 'interest' | 'loan' | 'settlement';

const HISTORY_FILTERS: Array<{ id: HistoryFilter; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'transfer', label: '存取' },
  { id: 'interest', label: '利息' },
  { id: 'loan', label: '贷款' },
  { id: 'settlement', label: '结算' },
];

function formatRateBps(rateBps: number) {
  return `${(Math.max(0, rateBps) / 100).toFixed(2)}%`;
}

function loanRateBps(actualLtvBps: number) {
  if (actualLtvBps <= 3_000) return 300;
  if (actualLtvBps <= 4_000) return 400;
  return 600;
}

function transactionTone(type: string) {
  if (['deposit', 'loan_disbursed', 'deposit_interest'].includes(type)) return 'success' as const;
  if (['default', 'interest_paid', 'weekly_cash_settlement'].includes(type)) return 'danger' as const;
  if (['grace_started'].includes(type)) return 'warning' as const;
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

export function BankPage({ model }: { model: LoadedGameViewModel }) {
  const { bankAccount, bankSummary } = model.game;
  const provinces = model.game.provinces || [];
  const weeklyCashSettlement = bankSummary.weeklyCashSettlement;
  const referenceNow = model.game.lastProcessedAt;
  const riskNow = useNow(referenceNow, 60_000);
  const [transferDirection, setTransferDirection] = useState<TransferDirection>('deposit');
  const [transferDraft, setTransferDraft] = useState('');
  const [loanDraft, setLoanDraft] = useState('');
  const [repayDraft, setRepayDraft] = useState('');
  const [collateralDrafts, setCollateralDrafts] = useState<Record<string, string>>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [pending, setPending] = useState<PendingAction>(null);

  const activeLoan = bankAccount.activeLoan;
  const transferSourceCredits = transferDirection === 'deposit' ? model.game.credits : bankAccount.depositCredits;
  const transferBlocked = transferSourceCredits < 0.01 || (transferDirection === 'withdraw' && activeLoan?.status === 'grace');
  const transferAmount = parseMoneyDraft(transferDraft, { min: 0.01, max: Math.max(0.01, transferSourceCredits) });
  const collateralDraftState = useMemo(() => bankAccount.availableCollateral.map((item) => {
    const key = `${item.provinceId}:${item.facilityTypeId}`;
    const draft = collateralDrafts[key] || '';
    const parsed = parseIntegerDraft(draft, {
      min: 1,
      max: Math.max(1, item.availableQuantity),
    });
    return { item, key, draft, parsed, invalid: draft.trim() !== '' && (parsed === null || parsed > item.availableQuantity) };
  }), [bankAccount.availableCollateral, collateralDrafts]);
  const selectedCollateral = collateralDraftState.flatMap(({ item, parsed }) => (parsed && parsed <= item.availableQuantity
    ? [{ provinceId: item.provinceId, facilityTypeId: item.facilityTypeId, quantity: parsed, prudentUnitValue: item.prudentUnitValue }]
    : []));
  const hasInvalidCollateralDraft = collateralDraftState.some(({ invalid }) => invalid);
  const collateralValue = selectedCollateral.reduce(
    (sum, item) => sum + item.quantity * item.prudentUnitValue,
    0,
  );
  const depositBufferEligible = collateralValue > 0 && bankAccount.depositCredits * 10 >= collateralValue;
  const recentDefault = bankAccount.recentDefaultAt !== null && riskNow - bankAccount.recentDefaultAt < RECENT_DEFAULT_MS;
  const goodRepayment = bankAccount.repaidLoanCount > 0 && !recentDefault;
  const loanToValueBps = Math.min(
    bankSummary.maximumLoanToValueBps,
    Math.max(
      bankSummary.minimumLoanToValueBps,
      bankSummary.baseLoanToValueBps
        + (depositBufferEligible ? bankSummary.depositBufferBonusBps : 0)
        + (goodRepayment ? bankSummary.repaymentHistoryBonusBps : 0)
        - (recentDefault ? bankSummary.recentDefaultPenaltyBps : 0),
    ),
  );
  const maximumLoan = Math.floor(collateralValue * loanToValueBps / 100) / 100;
  const requestedLoan = parseMoneyDraft(loanDraft, { min: 0.01, max: Math.max(0.01, maximumLoan) });
  const actualLtvBps = requestedLoan && collateralValue > 0
    ? Math.ceil(requestedLoan * 10_000 / collateralValue)
    : 0;
  const requestedInterestRateBps = loanRateBps(actualLtvBps);
  const requestedInterest = requestedLoan
    ? Math.ceil(requestedLoan * requestedInterestRateBps / 100) / 100
    : 0;
  const creditUtilizationBps = requestedLoan && maximumLoan > 0
    ? Math.min(10_000, Math.ceil(requestedLoan * 10_000 / maximumLoan))
    : 0;
  const remainingLoanCapacity = floorMoney(maximumLoan - (requestedLoan || 0));
  const activeLiability = activeLoan
    ? activeLoan.principalOutstanding + activeLoan.interestOutstanding
    : 0;
  const repayAmount = activeLoan
    ? parseMoneyDraft(repayDraft, { min: 0.01, max: Math.max(0.01, activeLiability) })
    : null;
  const loanDeadline = activeLoan?.status === 'grace' ? activeLoan.graceEndsAt : activeLoan?.dueAt;
  const filteredTransactions = historyFilter === 'all'
    ? bankAccount.recentTransactions
    : bankAccount.recentTransactions.filter((transaction) => transactionFilter(transaction.type) === historyFilter);

  function setTransferShare(share: number) {
    const amount = share >= 1 ? transferSourceCredits : floorMoney(transferSourceCredits * share);
    setTransferDraft(amount >= 0.01 ? String(amount) : '');
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
    <PageLayout title="银行">
      <AssetOverviewPanel model={model} />

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
              >
                存入
              </Button>
              <Button
                variant="text"
                className={transferDirection === 'withdraw' ? 'ui-segmented__button active' : 'ui-segmented__button'}
                aria-pressed={transferDirection === 'withdraw'}
                disabled={activeLoan?.status === 'grace' || Boolean(pending)}
                onClick={() => changeTransferDirection('withdraw')}
              >
                取出
              </Button>
            </div>
            <MoneyInput
              label={transferDirection === 'deposit' ? '存入金额' : '取出金额'}
              description={transferDirection === 'deposit'
                ? '本日新增存款从下一个北京时间自然日开始参与计息。'
                : '当日取款会降低本日有效计息余额；贷款宽限期暂停取款。'}
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
          title="工厂冻结融资"
          action={activeLoan ? <StatusTag tone={activeLoan.status === 'grace' ? 'danger' : 'warning'}>{activeLoan.status === 'grace' ? '宽限期' : '还款中'}</StatusTag> : <StatusTag tone="info">额度评估</StatusTag>}
        />
        {activeLoan ? (
          <div className="bank-active-loan">
            <div className="bank-loan-summary-grid">
              <MetricCard label="总应还" value={<CurrencyAmount>{formatCurrency(activeLiability)}</CurrencyAmount>} tone={activeLoan.status === 'grace' ? 'danger' : 'warning'} />
              <MetricCard label="未偿本金" value={<CurrencyAmount>{formatCurrency(activeLoan.principalOutstanding)}</CurrencyAmount>} />
              <MetricCard label="未付利息" value={<CurrencyAmount>{formatCurrency(activeLoan.interestOutstanding)}</CurrencyAmount>} tone="warning" />
              <MetricCard label="贷款价值比" value={formatRateBps(activeLoan.ltvBps)} />
              <MetricCard label="72h 总利率" value={formatRateBps(activeLoan.interestRateBps)} />
              <MetricCard label="剩余时间" value={loanDeadline ? <LiveDurationUntil deadline={loanDeadline} referenceNow={referenceNow} zeroText="等待服务器结算" /> : '—'} detail={formatTime(loanDeadline || 0)} tone={activeLoan.status === 'grace' ? 'danger' : 'neutral'} />
            </div>
            {activeLoan.status === 'grace' ? (
              <div className="bank-loan-risk-callout" role="status">
                <strong>宽限期风险</strong>
                <span>宽限结束仍未结清时，服务器会按届时审慎单价的 80% 处置足以覆盖欠款的最少冻结工厂；本页不会提前预测具体处置数量。</span>
              </div>
            ) : null}
            <div className="bank-collateral-summary">
              <strong>冻结工厂</strong>
              <div className="bank-collateral-chips">
                {activeLoan.collateral.map((item) => {
                  const type = model.game.facilityTypes.find((facility) => facility.id === item.facilityTypeId);
                  const province = provinces.find((candidate) => candidate.id === item.provinceId);
                  return <span key={`${item.provinceId}:${item.facilityTypeId}`}><FactoryIcon />{province?.name || item.provinceId} · {type?.name || item.facilityTypeId} × {<CompactNumber value={item.quantity} />}</span>;
                })}
              </div>
              <small>冻结工厂继续生产，但在贷款结清前不能出售、拍卖或重复冻结。</small>
            </div>
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
          <div className="bank-financing-workspace">
            <div className="bank-collateral-list" role="table" aria-label="可冻结工厂">
              <div className="entity-list-header bank-collateral-list-header" role="row">
                <span role="columnheader">工厂</span>
                <span role="columnheader">可冻结</span>
                <span role="columnheader">审慎单价</span>
                <span role="columnheader">本次冻结</span>
              </div>
              {bankAccount.availableCollateral.length === 0 ? (
                <EmptyState>当前没有可用于冻结的工厂。已挂牌、拍卖或冻结的工厂不能重复使用。</EmptyState>
              ) : collateralDraftState.map(({ item, key, draft, parsed, invalid }) => {
                const type = model.game.facilityTypes.find((facility) => facility.id === item.facilityTypeId);
                const province = provinces.find((candidate) => candidate.id === item.provinceId);
                const transactionFrozen = Math.max(0, item.totalQuantity - item.mortgagedQuantity - item.availableQuantity);
                return (
                  <div className="bank-collateral-row" role="row" key={key}>
                    <div className="bank-collateral-identity" role="cell">
                      <span className="bank-factory-name"><FactoryIcon />{type?.name || item.facilityTypeId}</span>
                      <small>{province?.name || item.provinceId} · 总持有 {<CompactNumber value={item.totalQuantity} />} · 交易冻结 {<CompactNumber value={transactionFrozen} />} · 已冻结 {<CompactNumber value={item.mortgagedQuantity} />}</small>
                    </div>
                    <strong className="bank-collateral-available" role="cell"><CompactNumber value={item.availableQuantity} /></strong>
                    <span className="bank-collateral-price" role="cell"><CurrencyAmount>{formatCurrency(item.prudentUnitValue)}</CurrencyAmount></span>
                    <div className="bank-collateral-entry" role="cell">
                      <input
                        className="ui-control bank-collateral-input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={item.availableQuantity}
                        step={1}
                        aria-label={`${type?.name || item.facilityTypeId}冻结数量`}
                        aria-invalid={invalid || undefined}
                        value={draft}
                        placeholder="0"
                        disabled={item.availableQuantity < 1}
                        onChange={(event) => setCollateralDrafts((current) => ({ ...current, [key]: event.target.value }))}
                        onBlur={() => {
                          if (!invalid) return;
                          setCollateralDrafts((current) => ({ ...current, [key]: '' }));
                        }}
                      />
                      <small>{parsed ? <>贡献 <CurrencyAmount>{formatCurrency(parsed * item.prudentUnitValue)}</CurrencyAmount></> : '未选择'}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            <section className="bank-loan-decision" aria-labelledby="bank-loan-decision-title">
              <div className="bank-section-heading">
                <div>
                  <h3 id="bank-loan-decision-title">融资方案</h3>
                  <p>先选择冻结工厂，再决定本次使用多少银行授信。</p>
                </div>
              </div>
              <DataList>
                <DataRow label="冻结资产审慎估值" value={<CurrencyAmount>{formatCurrency(collateralValue)}</CurrencyAmount>} />
                <DataRow label="最高可贷额度" value={<CurrencyAmount>{formatCurrency(maximumLoan)}</CurrencyAmount>} tone="success" />
              </DataList>
              <MoneyInput
                label="申请金额"
                description="贷款期限固定为 72h，贷款总利息随实际贷款价值比锁定。"
                value={loanDraft}
                fallbackValue={1}
                min={1}
                max={Math.max(0.01, maximumLoan)}
                onValueChange={setLoanDraft}
                disabled={maximumLoan < 1}
                error={loanDraft && requestedLoan === null ? '申请金额必须为不超过当前最高额度的正数；超过两位小数无效。' : undefined}
              />
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
                  <span>实际贷款价值比 <strong>{formatRateBps(actualLtvBps)}</strong></span>
                </div>
              </div>
              <DataList>
                <DataRow label="72h 总利率" value={formatRateBps(requestedInterestRateBps)} />
                <DataRow label="预计总利息" value={<CurrencyAmount>{formatCurrency(requestedInterest)}</CurrencyAmount>} />
                <DataRow label="预计应还总额" value={<CurrencyAmount>{formatCurrency((requestedLoan || 0) + requestedInterest)}</CurrencyAmount>} tone="warning" />
              </DataList>
              <div className="bank-credit-basis">
                <h4>授信依据</h4>
                <DataList>
                  <DataRow label="基础可贷成数" value={formatRateBps(bankSummary.baseLoanToValueBps)} />
                  <DataRow label="存款缓冲" value={depositBufferEligible ? `+${formatRateBps(bankSummary.depositBufferBonusBps)}` : '+0.00%'} tone={depositBufferEligible ? 'success' : 'neutral'} />
                  <DataRow label="良好还款记录" value={goodRepayment ? `+${formatRateBps(bankSummary.repaymentHistoryBonusBps)}` : '+0.00%'} tone={goodRepayment ? 'success' : 'neutral'} />
                  <DataRow label="近期违约" value={recentDefault ? `-${formatRateBps(bankSummary.recentDefaultPenaltyBps)}` : '0.00%'} tone={recentDefault ? 'danger' : 'neutral'} />
                  <DataRow label="最终可贷成数" value={formatRateBps(loanToValueBps)} tone="info" />
                </DataList>
              </div>
              {hasInvalidCollateralDraft ? <p className="form-error" role="alert">冻结数量必须是不超过可冻结数量的正整数。</p> : null}
              <Button block disabled={!requestedLoan || selectedCollateral.length === 0 || hasInvalidCollateralDraft || Boolean(pending)} onClick={() => submit(
                'borrow',
                () => model.bankBorrow(
                  requestedLoan || 0,
                  selectedCollateral.map(({ provinceId, facilityTypeId, quantity }) => ({ provinceId, facilityTypeId, quantity })),
                  true,
                ),
                () => { setLoanDraft(''); setCollateralDrafts({}); },
              )}>
                {pending === 'borrow' ? '评估并放款中…' : '申请贷款'}
              </Button>
              <small>贷款本金会同时增加等额负债，不会提高净资产或排行榜成绩。贷款最低总利率高于 72h 内最多可获得的固定存款利息，不能通过贷款后再存款获利。</small>
            </section>
          </div>
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
            >
              {filter.label}
            </Button>
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
    </PageLayout>
  );
}
