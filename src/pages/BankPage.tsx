import { useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { AssetOverviewPanel } from '../components/assets/AssetOverviewPanel';
import { BankIcon, FactoryIcon } from '../components/icons/GameIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput } from '../components/ui/FormControls';
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
import { useNow } from '../hooks/useNow';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';

const RECENT_DEFAULT_MS = 30 * 24 * 60 * 60 * 1000;

type PendingAction = 'deposit' | 'withdraw' | 'borrow' | 'repay' | 'auto-repay' | null;

function formatRatePpm(ratePpm: number) {
  return `${(Math.max(0, ratePpm) / 10_000).toFixed(2)}%`;
}

function formatRateBps(rateBps: number) {
  return `${(Math.max(0, rateBps) / 100).toFixed(2)}%`;
}

function loanRateBps(actualLtvBps: number) {
  if (actualLtvBps <= 3_000) return 200;
  if (actualLtvBps <= 4_000) return 300;
  return 500;
}

function transactionTone(type: string) {
  if (['deposit', 'loan_disbursed', 'deposit_interest'].includes(type)) return 'success' as const;
  if (['default', 'interest_paid'].includes(type)) return 'danger' as const;
  if (['grace_started'].includes(type)) return 'warning' as const;
  return 'neutral' as const;
}

export function BankPage({ model }: { model: LoadedGameViewModel }) {
  const { bankAccount, bankSummary } = model.game;
  const now = useNow(model.game.lastProcessedAt);
  const [depositDraft, setDepositDraft] = useState('');
  const [withdrawDraft, setWithdrawDraft] = useState('');
  const [loanDraft, setLoanDraft] = useState('');
  const [repayDraft, setRepayDraft] = useState('');
  const [collateralDrafts, setCollateralDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<PendingAction>(null);

  const depositAmount = parseIntegerDraft(depositDraft, { min: 1, max: Math.max(1, model.game.credits) });
  const withdrawAmount = parseIntegerDraft(withdrawDraft, { min: 1, max: Math.max(1, bankAccount.depositCredits) });
  const collateralDraftState = useMemo(() => bankAccount.availableCollateral.map((item) => {
    const draft = collateralDrafts[item.facilityTypeId] || '';
    const parsed = parseIntegerDraft(draft, {
      min: 1,
      max: Math.max(1, item.availableQuantity),
    });
    return { item, draft, parsed, invalid: draft.trim() !== '' && (parsed === null || parsed > item.availableQuantity) };
  }), [bankAccount.availableCollateral, collateralDrafts]);
  const selectedCollateral = collateralDraftState.flatMap(({ item, parsed }) => (parsed && parsed <= item.availableQuantity
    ? [{ facilityTypeId: item.facilityTypeId, quantity: parsed, prudentUnitValue: item.prudentUnitValue }]
    : []));
  const hasInvalidCollateralDraft = collateralDraftState.some(({ invalid }) => invalid);
  const collateralValue = selectedCollateral.reduce(
    (sum, item) => sum + item.quantity * item.prudentUnitValue,
    0,
  );
  const depositBufferEligible = collateralValue > 0 && bankAccount.depositCredits * 10 >= collateralValue;
  const recentDefault = bankAccount.recentDefaultAt !== null && now - bankAccount.recentDefaultAt < RECENT_DEFAULT_MS;
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
  const maximumLoan = Math.floor(collateralValue * loanToValueBps / 10_000);
  const requestedLoan = parseIntegerDraft(loanDraft, { min: 1, max: Math.max(1, maximumLoan) });
  const actualLtvBps = requestedLoan && collateralValue > 0
    ? Math.ceil(requestedLoan * 10_000 / collateralValue)
    : 0;
  const requestedInterestRateBps = loanRateBps(actualLtvBps);
  const requestedInterest = requestedLoan
    ? Math.ceil(requestedLoan * requestedInterestRateBps / 10_000)
    : 0;
  const activeLoan = bankAccount.activeLoan;
  const activeLiability = activeLoan
    ? activeLoan.principalOutstanding + activeLoan.interestOutstanding
    : 0;
  const repayAmount = activeLoan
    ? parseIntegerDraft(repayDraft, { min: 1, max: Math.max(1, activeLiability) })
    : null;
  const loanDeadline = activeLoan?.status === 'grace' ? activeLoan.graceEndsAt : activeLoan?.dueAt;
  const loanRemaining = loanDeadline ? Math.max(0, loanDeadline - now) : 0;
  const settlementRemaining = Math.max(0, bankSummary.nextInterestSettlementAt - now);

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
    <PageLayout
      title="银行"
      description="统一查看资产构成，并管理银行存款、动态存款利息和工厂抵押贷款。"
    >
      <AssetOverviewPanel model={model} />

      <div className="bank-account-grid">
        <PagePanel className="bank-transfer-panel">
          <WidgetHeading title="存款账户" action={<BankIcon />} />
          <div className="bank-account-balance-strip" aria-label="存款账户余额">
            <span><small>可用资金</small><strong><CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount></strong></span>
            <span><small>银行存款</small><strong><CurrencyAmount>{formatCurrency(bankAccount.depositCredits)}</CurrencyAmount></strong></span>
            <span><small>今日计息余额</small><strong><CurrencyAmount>{formatCurrency(bankAccount.eligibleDepositCredits)}</CurrencyAmount></strong></span>
          </div>
          <p className="bank-panel-note">存取款只在可用资金与银行存款间转移，不改变净资产。贷款处于宽限期时暂停取款。</p>
          <div className="bank-transfer-forms">
            <div className="bank-form-block">
              <IntegerInput
                label="存入金额"
                value={depositDraft}
                fallbackValue={1}
                min={1}
                max={Math.max(1, model.game.credits)}
                onValueChange={setDepositDraft}
                disabled={model.game.credits < 1}
                error={depositDraft && depositAmount === null ? '请输入不超过可用资金的正整数。' : undefined}
              />
              <div className="bank-form-actions">
                <Button variant="secondary" disabled={model.game.credits < 1 || Boolean(pending)} onClick={() => setDepositDraft(String(model.game.credits))}>全部存入</Button>
                <Button disabled={!depositAmount || Boolean(pending)} onClick={() => submit('deposit', () => model.bankDeposit(depositAmount || 0), () => setDepositDraft(''))}>
                  {pending === 'deposit' ? '处理中…' : '存入'}
                </Button>
              </div>
            </div>
            <div className="bank-form-block">
              <IntegerInput
                label="取出金额"
                value={withdrawDraft}
                fallbackValue={1}
                min={1}
                max={Math.max(1, bankAccount.depositCredits)}
                onValueChange={setWithdrawDraft}
                disabled={activeLoan?.status === 'grace'}
                error={withdrawDraft && withdrawAmount === null ? '请输入不超过银行存款的正整数。' : undefined}
              />
              <div className="bank-form-actions">
                <Button variant="secondary" disabled={bankAccount.depositCredits < 1 || activeLoan?.status === 'grace' || Boolean(pending)} onClick={() => setWithdrawDraft(String(bankAccount.depositCredits))}>全部取出</Button>
                <Button disabled={!withdrawAmount || activeLoan?.status === 'grace' || Boolean(pending)} onClick={() => submit('withdraw', () => model.bankWithdraw(withdrawAmount || 0), () => setWithdrawDraft(''))}>
                  {pending === 'withdraw' ? '处理中…' : '取出'}
                </Button>
              </div>
            </div>
          </div>
        </PagePanel>

        <PagePanel className="bank-interest-panel">
          <WidgetHeading title="存款利息" action={<StatusTag tone="success">动态收益</StatusTag>} />
          <DataList>
            <DataRow label="昨日实际日收益率" value={formatRatePpm(bankSummary.lastDailyRatePpm)} />
            <DataRow label="近 7 日平均日收益率" value={formatRatePpm(bankSummary.sevenDayAverageRatePpm)} />
            <DataRow label="每日最高收益率" value={formatRateBps(bankSummary.dailyInterestCapBps)} />
            <DataRow label="当前可分配利息池" value={<CurrencyAmount>{formatCurrency(bankSummary.interestPoolCredits)}</CurrencyAmount>} />
            <DataRow label="昨日入账利息" value={<CurrencyAmount>{formatCurrency(bankAccount.lastDepositInterestEarned)}</CurrencyAmount>} tone="success" />
            <DataRow label="累计存款利息" value={<CurrencyAmount>{formatCurrency(bankAccount.totalDepositInterestEarned)}</CurrencyAmount>} />
          </DataList>
          <p className="bank-settlement-countdown">下一次结息：{settlementRemaining > 0 ? formatDuration(settlementRemaining) : '等待服务器结算'} · {formatTime(bankSummary.nextInterestSettlementAt)}</p>
          <p className="bank-panel-note">收益只来自借款人已经实际支付的贷款利息，不保证固定收益，也不会凭空发行普通货币。</p>
        </PagePanel>
      </div>

      <PagePanel className="bank-loan-panel">
        <WidgetHeading
          title="工厂抵押贷款"
          action={activeLoan ? <StatusTag tone={activeLoan.status === 'grace' ? 'danger' : 'warning'}>{activeLoan.status === 'grace' ? '宽限期' : '还款中'}</StatusTag> : <StatusTag tone="info">额度评估</StatusTag>}
        />
        {activeLoan ? (
          <div className="bank-active-loan">
            <div className="bank-loan-summary-grid">
              <MetricCard label="未偿本金" value={<CurrencyAmount>{formatCurrency(activeLoan.principalOutstanding)}</CurrencyAmount>} />
              <MetricCard label="未付利息" value={<CurrencyAmount>{formatCurrency(activeLoan.interestOutstanding)}</CurrencyAmount>} tone="warning" />
              <MetricCard label="剩余时间" value={loanRemaining > 0 ? formatDuration(loanRemaining) : '等待服务器结算'} detail={formatTime(loanDeadline || 0)} tone={activeLoan.status === 'grace' ? 'danger' : 'neutral'} />
              <MetricCard label="贷款总利率" value={formatRateBps(activeLoan.interestRateBps)} />
            </div>
            <div className="bank-collateral-summary">
              <strong>抵押工厂</strong>
              <div className="bank-collateral-chips">
                {activeLoan.collateral.map((item) => {
                  const type = model.game.facilityTypes.find((facility) => facility.id === item.facilityTypeId);
                  return <span key={item.facilityTypeId}><FactoryIcon />{type?.name || item.facilityTypeId} × {formatNumber(item.quantity)}</span>;
                })}
              </div>
              <small>抵押工厂继续生产，但在贷款结清前不能出售、拍卖或重复抵押。</small>
            </div>
            <ToggleField
              label="自动还款"
              description="到期时先使用银行存款，再使用可用资金。"
              checked={activeLoan.autoRepay}
              disabled={Boolean(pending)}
              onChange={(event) => { const enabled = event.currentTarget.checked; void submit('auto-repay', () => model.bankSetAutoRepay(activeLoan.id, enabled)); }}
            />
            <div className="bank-repayment-row">
              <IntegerInput
                label="还款金额"
                value={repayDraft}
                fallbackValue={1}
                min={1}
                max={Math.max(1, activeLiability)}
                onValueChange={setRepayDraft}
                error={repayDraft && repayAmount === null ? '请输入不超过当前应还总额的正整数。' : undefined}
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
          <div className="bank-loan-application">
            {bankAccount.availableCollateral.length === 0 ? (
              <EmptyState>当前没有可用于抵押的工厂。已挂牌、拍卖或抵押的工厂不能重复使用。</EmptyState>
            ) : (
              <div className="bank-collateral-table-wrap">
                <table className="bank-collateral-table">
                  <thead><tr><th>工厂</th><th>总持有</th><th>交易冻结</th><th>已抵押</th><th>可抵押</th><th>审慎单价</th><th>本次抵押</th><th>额度贡献</th></tr></thead>
                  <tbody>
                    {collateralDraftState.map(({ item, draft, parsed, invalid }) => {
                      const type = model.game.facilityTypes.find((facility) => facility.id === item.facilityTypeId);
                      const transactionFrozen = Math.max(0, item.totalQuantity - item.mortgagedQuantity - item.availableQuantity);
                      return (
                        <tr key={item.facilityTypeId}>
                          <td><span className="bank-factory-name"><FactoryIcon />{type?.name || item.facilityTypeId}</span></td>
                          <td>{formatNumber(item.totalQuantity)}</td>
                          <td>{formatNumber(transactionFrozen)}</td>
                          <td>{formatNumber(item.mortgagedQuantity)}</td>
                          <td>{formatNumber(item.availableQuantity)}</td>
                          <td><CurrencyAmount>{formatCurrency(item.prudentUnitValue)}</CurrencyAmount></td>
                          <td>
                            <input
                              className="ui-control bank-collateral-input"
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={item.availableQuantity}
                              step={1}
                              aria-label={`${type?.name || item.facilityTypeId}抵押数量`}
                              aria-invalid={invalid || undefined}
                              value={draft}
                              placeholder="0"
                              disabled={item.availableQuantity < 1}
                              onChange={(event) => setCollateralDrafts((current) => ({ ...current, [item.facilityTypeId]: event.target.value }))}
                              onBlur={() => {
                                if (!invalid) return;
                                setCollateralDrafts((current) => ({ ...current, [item.facilityTypeId]: '' }));
                              }}
                            />
                          </td>
                          <td><CurrencyAmount>{formatCurrency((parsed || 0) * item.prudentUnitValue)}</CurrencyAmount></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="bank-assessment-grid">
              <DataList>
                <DataRow label="抵押物审慎估值" value={<CurrencyAmount>{formatCurrency(collateralValue)}</CurrencyAmount>} />
                <DataRow label="基础可贷成数" value={formatRateBps(bankSummary.baseLoanToValueBps)} />
                <DataRow label="存款缓冲" value={depositBufferEligible ? `+${formatRateBps(bankSummary.depositBufferBonusBps)}` : '+0.00%'} tone={depositBufferEligible ? 'success' : 'neutral'} />
                <DataRow label="良好还款记录" value={goodRepayment ? `+${formatRateBps(bankSummary.repaymentHistoryBonusBps)}` : '+0.00%'} tone={goodRepayment ? 'success' : 'neutral'} />
                <DataRow label="近期违约" value={recentDefault ? `-${formatRateBps(bankSummary.recentDefaultPenaltyBps)}` : '0.00%'} tone={recentDefault ? 'danger' : 'neutral'} />
                <DataRow label="最终可贷成数" value={formatRateBps(loanToValueBps)} tone="info" />
                <DataRow label="最高可贷额度" value={<CurrencyAmount>{formatCurrency(maximumLoan)}</CurrencyAmount>} tone="success" />
              </DataList>
              <div className="bank-loan-request-form">
                <IntegerInput
                  label="申请金额"
                  description="贷款期限固定为 72h，贷款总利息随实际贷款价值比锁定。"
                  value={loanDraft}
                  fallbackValue={1}
                  min={1}
                  max={Math.max(1, maximumLoan)}
                  onValueChange={setLoanDraft}
                  disabled={maximumLoan < 1}
                  error={loanDraft && requestedLoan === null ? '申请金额必须是不超过当前最高额度的正整数。' : undefined}
                />
                <DataList>
                  <DataRow label="实际贷款价值比" value={formatRateBps(actualLtvBps)} />
                  <DataRow label="72h 总利率" value={formatRateBps(requestedInterestRateBps)} />
                  <DataRow label="预计总利息" value={<CurrencyAmount>{formatCurrency(requestedInterest)}</CurrencyAmount>} />
                  <DataRow label="预计应还总额" value={<CurrencyAmount>{formatCurrency((requestedLoan || 0) + requestedInterest)}</CurrencyAmount>} tone="warning" />
                </DataList>
                {hasInvalidCollateralDraft ? <p className="form-error" role="alert">抵押数量必须是不超过可抵押数量的正整数。</p> : null}
                <Button block disabled={!requestedLoan || selectedCollateral.length === 0 || hasInvalidCollateralDraft || Boolean(pending)} onClick={() => submit(
                  'borrow',
                  () => model.bankBorrow(
                    requestedLoan || 0,
                    selectedCollateral.map(({ facilityTypeId, quantity }) => ({ facilityTypeId, quantity })),
                    true,
                  ),
                  () => { setLoanDraft(''); setCollateralDrafts({}); },
                )}>
                  {pending === 'borrow' ? '评估并放款中…' : '申请贷款'}
                </Button>
                <small>贷款本金会同时增加等额负债，不会提高净资产或排行榜成绩。贷款最高存款收益低于贷款总利息，不能通过贷款后再存款获利。</small>
              </div>
            </div>
          </div>
        )}
      </PagePanel>

      <PagePanel className="bank-history-panel">
        <WidgetHeading title="银行记录" />
        {bankAccount.recentTransactions.length === 0 ? <EmptyState>暂无银行记录。</EmptyState> : (
          <div className="bank-history-list">
            {bankAccount.recentTransactions.map((transaction) => (
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
