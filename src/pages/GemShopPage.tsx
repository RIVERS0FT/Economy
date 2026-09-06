import { CompactCurrency, CompactNumber } from '../components/ui/CompactNumber';
import { useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { gameActions, getGemShopSummary, type GemShopSummary } from '../api/game';
import { InvitationSettings } from '../components/InvitationSettings';
import { CreditsIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, TextInput } from '../components/ui/FormControls';
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
  const [giftCode, setGiftCode] = useState('');

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

  async function submitGift() {
    const code = giftCode.trim().toUpperCase();
    if (!code) return;
    const result = await model.redeemGift(code);
    await model.showResult(result);
    if (result.ok) setGiftCode('');
  }

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
      await model.showResult(result);
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
      await model.showResult(response.result);
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
      description="邀请好友获得宝石、兑换礼品码，并在每日终端报价中决定是否兑换普通货币。报价接受或放弃后当日不可更改。"
    >
      <div className="gem-shop-grid">
        <Panel className="widget gem-shop-balance-card">
          <WidgetHeading title="当前余额" action={<StatusTag tone={quoteTone}>今日终端报价</StatusTag>} />
          <div className="gem-shop-balance-row">
            <div><GemIcon /><span>宝石</span><strong>{<CompactNumber value={model.game.gems} />}</strong></div>
            <div><CreditsIcon /><span>可用资金</span><strong><CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount></strong></div>
            <div className="gem-shop-rate-summary">
              <span>今日报价</span>
              <strong>{summary ? `1 宝石 = ${formatCurrency(summary.creditsPerGem)} 货币` : loading ? '读取中…' : '暂不可用'}</strong>
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
          <InvitationSettings notify={model.notify} />

          <Panel className="widget gem-shop-history-card">
            <WidgetHeading title="兑换记录" action={summary ? <StatusTag tone="neutral">最近 20 笔</StatusTag> : undefined} />
            {summary?.recentExchanges.length ? (
              <div className="gem-shop-history-list">
                {summary.recentExchanges.map((record) => (
                  <div key={`${record.createdAt}-${record.gemsSpent}`}>
                    <span>消耗 {<CompactNumber value={record.gemsSpent} />} 宝石</span>
                    <strong><CurrencyAmount sign="+">{formatCurrency(record.creditsReceived)}</CurrencyAmount></strong>
                    <small>
                      {record.creditsPerGem ? `当时报价 1 = ${formatCurrency(record.creditsPerGem)} · ` : ''}
                      {formatDate(record.createdAt)}
                    </small>
                  </div>
                ))}
              </div>
            ) : <p className="gem-shop-empty-copy">{loading ? '正在读取兑换记录…' : '尚无兑换记录'}</p>}
            {summary ? (
              <div className="gem-shop-total-row">
                <span>累计消耗 {<CompactNumber value={summary.totalGemsSpent} />} 宝石</span>
                <strong>累计获得 <CurrencyAmount>{formatCurrency(summary.totalCreditsReceived)}</CurrencyAmount></strong>
              </div>
            ) : null}
          </Panel>
        </div>

        <div className="gem-shop-side-column">
          <Panel className="widget gem-shop-exchange-card">
            <WidgetHeading
              title="兑换货币"
              action={summary ? (
                <StatusTag tone={quoteDecision === 'pending' ? 'info' : 'neutral'}>
                  {quoteDecision === 'pending' ? '待决定' : quoteDecision === 'accepted' ? '已接受' : '已放弃'}
                </StatusTag>
              ) : undefined}
            />
            {summary ? (
              quoteDecision === 'pending' ? (
                <>
                  <IntegerInput
                    label="消耗宝石数量"
                    value={amountDraft}
                    fallbackValue={amount}
                    min={summary.minExchangeGems}
                    max={Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1))}
                    error={amountError}
                    onValueChange={updateAmountDraft}
                    onKeyDown={(event) => { if (event.key === 'Enter') void exchange(); }}
                  />
                  <div className="gem-shop-quick-row" aria-label="快捷兑换数量">
                    {QUICK_AMOUNTS.map((value) => (
                      <Button key={value} variant="compact" disabled={value > model.game.gems} onClick={() => setAmountValue(value)}>{value}</Button>
                    ))}
                    <Button variant="compact" disabled={summary.maxExchangeableGems < 1} onClick={() => setAmountValue(summary.maxExchangeableGems)}>最大</Button>
                  </div>
                  <div className="gem-shop-preview">
                    <span>预计获得</span>
                    <strong><CurrencyAmount>{formatCurrency(creditsPreview)}</CurrencyAmount></strong>
                  </div>
                  <div className="gem-shop-quick-row">
                    <Button disabled={!validAmount || exchanging || rejecting} onClick={() => void exchange()}>
                      {exchanging ? '兑换处理中…' : '确认兑换'}
                    </Button>
                    <Button variant="secondary" disabled={exchanging || rejecting} onClick={() => void rejectQuote()}>
                      {rejecting ? '提交处理中…' : '放弃今日报价'}
                    </Button>
                  </div>
                  <small>
                    每日只能接受或放弃一次报价；接受后单次兑换 {<CompactNumber value={summary.minExchangeGems} />}～{<CompactNumber value={summary.maxExchangeGems} />} 宝石，且不可撤销。宝石不能用货币买回。
                  </small>
                </>
              ) : (
                <p className="gem-shop-empty-copy">
                  {quoteDecision === 'accepted' ? '今日报价已经使用，请等待明日新报价。' : '今日报价已经放弃，请等待明日新报价。'}
                </p>
              )
            ) : <p>{loading ? '正在加载商店…' : error || '商店暂时不可用'}</p>}
          </Panel>

          <Panel className="widget gem-shop-gift-card">
            <WidgetHeading title="礼品码兑换" action={<StatusTag tone="info">礼品</StatusTag>} />
            <p>输入有效礼品码领取奖励。同一账号对同一礼品只能兑换一次。</p>
            <TextInput
              label="礼品兑换码"
              value={giftCode}
              maxLength={64}
              autoComplete="off"
              placeholder="RIVER-XXXX-XXXX"
              onChange={(event) => setGiftCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitGift();
              }}
            />
            <Button block disabled={!giftCode.trim()} onClick={() => void submitGift()}>兑换礼品</Button>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
}
