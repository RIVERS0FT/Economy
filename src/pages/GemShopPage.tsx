import { useEffect, useMemo, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { getGemShopSummary, type GemShopSummary } from '../api/game';
import { CreditsIcon } from '../components/icons/GameIcons';
import { GemIcon } from '../components/icons/GemIcon';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { Button, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatCurrency, formatDate, formatNumber } from '../utils/formatters';

const QUICK_AMOUNTS = [1, 5, 10, 25];

export function GemShopPage({ model }: { model: LoadedGameViewModel }) {
  const [summary, setSummary] = useState<GemShopSummary | null>(null);
  const [amount, setAmount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);
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

  const creditsPreview = useMemo(
    () => amount * (summary?.creditsPerGem ?? 0),
    [amount, summary?.creditsPerGem],
  );
  const validAmount = Boolean(summary)
    && Number.isInteger(amount)
    && amount >= summary!.minExchangeGems
    && amount <= summary!.maxExchangeGems
    && amount <= model.game.gems;

  async function exchange() {
    if (!validAmount || exchanging) return;
    setExchanging(true);
    const result = await model.exchangeGems(amount);
    model.notify(result.message);
    if (result.ok) {
      setAmount(1);
      await load();
    }
    setExchanging(false);
  }

  return (
    <PageLayout title="商店" description="使用宝石单向兑换普通货币。所有兑换由服务器即时结算且不可撤销。">
      <div className="gem-shop-grid">
        <Panel className="widget gem-shop-balance-card">
          <WidgetHeading title="当前余额" action={<StatusTag tone="info">固定汇率</StatusTag>} />
          <div className="gem-shop-balance-row">
            <div><GemIcon /><span>宝石</span><strong>{formatNumber(model.game.gems)}</strong></div>
            <div><CreditsIcon /><span>可用资金</span><strong><CurrencyAmount>{formatCurrency(model.game.credits)}</CurrencyAmount></strong></div>
          </div>
          <p>{summary ? `1 宝石 = ${formatNumber(summary.creditsPerGem)} 货币` : loading ? '正在读取服务器汇率…' : '服务器汇率暂时不可用'}</p>
        </Panel>

        <Panel className="widget gem-shop-exchange-card">
          <WidgetHeading title="兑换货币" />
          {summary ? (
            <>
              <label>
                消耗宝石数量
                <input
                  type="number"
                  inputMode="numeric"
                  min={summary.minExchangeGems}
                  max={Math.min(summary.maxExchangeGems, Math.max(summary.maxExchangeableGems, 1))}
                  step={1}
                  value={amount}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  onKeyDown={(event) => { if (event.key === 'Enter') void exchange(); }}
                />
              </label>
              <div className="gem-shop-quick-row" aria-label="快捷兑换数量">
                {QUICK_AMOUNTS.map((value) => (
                  <Button key={value} variant="secondary" disabled={value > model.game.gems} onClick={() => setAmount(value)}>{value}</Button>
                ))}
                <Button variant="secondary" disabled={summary.maxExchangeableGems < 1} onClick={() => setAmount(summary.maxExchangeableGems)}>最大</Button>
              </div>
              <div className="gem-shop-preview">
                <span>预计获得</span>
                <strong><CurrencyAmount>{formatCurrency(creditsPreview)}</CurrencyAmount></strong>
              </div>
              <Button block disabled={!validAmount || exchanging} onClick={() => void exchange()}>
                {exchanging ? '兑换处理中…' : '确认兑换'}
              </Button>
              <small>单次可兑换 {formatNumber(summary.minExchangeGems)}～{formatNumber(summary.maxExchangeGems)} 宝石；宝石不能用货币买回。</small>
            </>
          ) : <p>{loading ? '正在加载商店…' : error || '商店暂时不可用'}</p>}
        </Panel>

        <Panel className="widget gem-shop-history-card">
          <WidgetHeading title="兑换记录" action={summary ? <StatusTag tone="neutral">最近 20 笔</StatusTag> : undefined} />
          {summary?.recentExchanges.length ? (
            <div className="gem-shop-history-list">
              {summary.recentExchanges.map((record) => (
                <div key={`${record.createdAt}-${record.gemsSpent}`}>
                  <span>消耗 {formatNumber(record.gemsSpent)} 宝石</span>
                  <strong><CurrencyAmount sign="+">{formatCurrency(record.creditsReceived)}</CurrencyAmount></strong>
                  <small>{formatDate(record.createdAt)}</small>
                </div>
              ))}
            </div>
          ) : <p>{loading ? '正在读取兑换记录…' : '尚无兑换记录'}</p>}
          {summary ? (
            <div className="gem-shop-total-row">
              <span>累计消耗 {formatNumber(summary.totalGemsSpent)} 宝石</span>
              <strong>累计获得 <CurrencyAmount>{formatCurrency(summary.totalCreditsReceived)}</CurrencyAmount></strong>
            </div>
          ) : null}
        </Panel>
      </div>
    </PageLayout>
  );
}
