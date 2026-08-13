import { useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { gameActions, getGemShopSummary, type GemShopSummary } from '../api/game';
import { InvitationSettings } from '../components/InvitationSettings';
import { CreditsIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput } from '../components/ui/FormControls';
import { Button, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { LiveDurationUntil } from '../components/time/LiveServerTime';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';

const QUICK_AMOUNTS = [1, 5, 10, 25];

export function GemShopPage({ model }: { model: LoadedGameViewModel }) {
  const [summary, setSummary] = useState<GemShopSummary | null>(null);
  const [amount, setAmount] = useState(1);
  const [amountDraft, setAmountDraft] = useState('1');
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    try {
      setSummary(await getGemShopSummary());
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法读取商店');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const parsedAmount = summary
    ? parseIntegerDraft(amountDraft, {
      min: summary.minExchangeGems,
      max: Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1)),
    })
    : null;
  const creditsPreview = useMemo(
    () => (parsedAmount ?? 0) * (summary?.creditsPerGem ?? 0),
    [parsedAmount, summary?.creditsPerGem],
  );
  const amountError = summary && parsedAmount === null
    ? `请输入 ${formatNumber(summary.minExchangeGems)}～${formatNumber(Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1)))} 的整数。`
    : undefined;
  const quoteDecision = summary?.quoteDecision ?? 'pending';
  const validAmount = Boolean(summary)
    && quoteDecision === 'pending'
    && parsedAmount !== null
    && parsedAmount <= model.game.gems;
  const quoteTone = summary?.demandTone === 'high'
    ? 'danger'
    : summary?.demandTone === 'low'
      ? 'success'
      : 'info';

  function setAmountValue(value: number) {
    setAmount(value);
    setAmountDraft(String(value));
  }

  function updateAmountDraft(value: string) {
    setAmountDraft(value);
    if (!summary) return;
    const parsed = parseIntegerDraft(value, {
      min: summary.minExchangeGems,
      max: Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1)),
    });
    if (parsed !== null) setAmount(parsed);
  }

  async function exchange() {
    if (!validAmount || exchanging || parsedAmount === null) return;
    setExchanging(true);
    try {
      const result = await model.exchangeGems(parsedAmount);
      model.notify(result.message);
      if (result.ok) {
        setAmountValue(1);
        await load();
      }
    } finally {
      setExchanging(false);
    }
  }

  async function rejectQuote() {
    if (!summary || quoteDecision !== 'pending' || rejecting || exchanging) return;
    setRejecting(true);
    try {
      const response = await gameActions.rejectGemShopQuote();
      model.notify(response.result.message);
      if (response.result.ok) await load();
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '无法放弃今日报价');
    } finally {
      setRejecting(false);
    }
  }

  return (
    <PageLayout
      title="商店"
      description="邀请好友获得宝石，并在每日终端报价中决定是否兑换普通货币。报价接受或放弃后当日不可更改。"
    >
      <div className="gem-shop-grid">
        <Panel className="widget gem-shop-balance-card">
          <WidgetHeading title="当前余额" action={<StatusTag tone={quoteTone}>今日终端报价</StatusTag>} />
          <div className="gem-shop-balance-row">
            <div><GemIcon /><span>宝石</span><strong>{formatNumber(model.game.gems)}</strong></div>
            <div><CreditsIcon /><span>可用资金</span><strong><CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount></strong></div>
            <div className="gem-shop-rate-summary">
              <span>今日报价</span>
              <strong>{summary ? `1 宝石 = ${formatNumber(summary.creditsPerGem)} 货币` : loading ? '读取中…' : '暂不可用'}</strong>
              {summary ? (
                <small>
                  {summary.rateDelta
                    ? `较昨日 ${summary.rateDelta > 0 ? '+' : ''}${summary.rateDelta}`
                    : '较昨日不变'}
                  {' · '}
                  {typeof summary.nextRateAt === 'number'
                    ? <LiveDurationUntil deadline={summary.nextRateAt} referenceNow={model.game.lastProcessedAt} zeroText="即将更新" />
                    : '即将更新'}
                </small>
              ) : null}
            </div>
          </div>
        </Panel>

        <div className="gem-shop-main-column">
          <InvitationSettings />

          <Panel className="widget gem-shop-history-card">
            <WidgetHeading title="兑换记录" action={summary ? <StatusTag tone="neutral">最近 20 笔</StatusTag> : undefined} />
            {summary?.recentExchanges.length ? (
              <div className="gem-shop-history-list">
                {summary.recentExchanges.map((record) => (
                  <div className="gem-shop-history-row" key={record.id}>
                    <span>{formatDate(record.createdAt)}</span>
                    <strong><GemIcon /> {formatNumber(record.gems)} → <CurrencyAmount>{formatCurrency(record.credits)}</CurrencyAmount></strong>
                  </div>
                ))}
              </div>
            ) : <p className="muted">暂无兑换记录。</p>}
          </Panel>
        </div>

        <Panel className="widget gem-shop-exchange-card">
          <WidgetHeading title="每日终端报价" action={summary ? <StatusTag tone={quoteDecision === 'accepted' ? 'success' : quoteDecision === 'rejected' ? 'neutral' : 'warning'}>{quoteDecision === 'accepted' ? '今日已接受' : quoteDecision === 'rejected' ? '今日已放弃' : '等待决定'}</StatusTag> : undefined} />
          {error ? <p className="error-text">{error}</p> : null}
          {summary ? (
            <>
              <div className="gem-shop-quote-detail">
                <div><span>当前报价</span><strong>1 宝石 = {formatNumber(summary.creditsPerGem)} 货币</strong></div>
                <div><span>需求状态</span><strong>{summary.demandLabel}</strong></div>
                <div><span>可兑换宝石</span><strong>{formatNumber(summary.maxExchangeableGems)}</strong></div>
              </div>
              <IntegerInput
                label="兑换宝石数量"
                value={amountDraft}
                fallbackValue={amount}
                min={summary.minExchangeGems}
                max={Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1))}
                error={amountError}
                onValueChange={updateAmountDraft}
              />
              <div className="gem-shop-quick-amounts">
                {QUICK_AMOUNTS.map((value) => (
                  <Button key={value} variant="secondary" onClick={() => setAmountValue(value)} disabled={value > summary.maxExchangeableGems}>
                    {formatNumber(value)} 宝石
                  </Button>
                ))}
              </div>
              <div className="gem-shop-preview">
                <span>预计获得</span>
                <strong><CurrencyAmount>{formatCurrency(creditsPreview)}</CurrencyAmount></strong>
              </div>
              <div className="gem-shop-actions">
                <Button
                  disabled={!validAmount || exchanging || rejecting}
                  onClick={() => void exchange()}
                >
                  {exchanging ? '兑换中…' : quoteDecision === 'accepted' ? '今日已接受报价' : quoteDecision === 'rejected' ? '今日已放弃报价' : '接受报价并兑换'}
                </Button>
                <Button
                  variant="secondary"
                  disabled={quoteDecision !== 'pending' || rejecting || exchanging}
                  onClick={() => void rejectQuote()}
                >
                  {rejecting ? '处理中…' : quoteDecision === 'rejected' ? '今日已放弃报价' : '放弃今日报价'}
                </Button>
              </div>
            </>
          ) : loading ? <p className="muted">正在读取终端报价…</p> : null}
        </Panel>
      </div>
    </PageLayout>
  );
}
