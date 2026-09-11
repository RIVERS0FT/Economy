import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import type { CommodityInvestmentTradeInput } from '../api/game';
import { isUnconfirmedConfiguration } from '../app/latestConfigurationQueue';
import { AssetOverviewPanel } from '../components/assets/AssetOverviewPanel';
import { ProductArtwork } from '../components/products/ProductArtwork';
import { CompactNumber } from '../components/ui/CompactNumber';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, SelectInput } from '../components/ui/FormControls';
import { GameConcept } from '../components/ui/GameConcept';
import { Button, DataList, DataRow, EmptyState, PageLayout, PagePanel, WidgetHeading } from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import { usePageTabPreference } from '../hooks/usePageTabPreference';
import { useStableSelection } from '../hooks/useStableSelection';
import { commodityInvestmentPreview, maximumCommodityInvestmentQuantity } from '../investments/commodityInvestmentPreview';
import { formatCurrency } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import '../styles/investments.css';

const TABS = ['commodities', 'positions', 'funds'] as const;
type InvestmentTab = typeof TABS[number];
const LABELS: Record<InvestmentTab, string> = { commodities: '商品', positions: '持仓', funds: '资金' };
const TRANSACTIONS = { buy: '买入', sell: '卖出', expiry: '到期结算', 'bank-collection': '贷款违约清算' } as const;
const shanghaiDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' });
const shanghaiDate = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
function deadline(at: number | undefined) { return at === undefined ? '—' : `${shanghaiDate.format(at)}（北京时间）`; }
function Money({ value }: { value: number | null | undefined }) {
  return value === null || value === undefined ? <>待确认</> : <CurrencyAmount>{formatCurrency(value)}</CurrencyAmount>;
}

function InvestmentOrder({ model, productId, side, setSide }: {
  model: LoadedGameViewModel; productId: string; side: 'buy' | 'sell'; setSide: (side: 'buy' | 'sell') => void;
}) {
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<CommodityInvestmentTradeInput | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const now = useNow(model.game.lastProcessedAt);
  const quote = model.game.commodityInvestmentQuotes?.[productId];
  const holding = model.game.commodityInvestment?.positions.find((position) => position.contractId === quote?.contractId);
  const anyExpiryPending = model.game.commodityInvestment?.positions.some((position) => position.expiresAt <= now);
  const maximum = side === 'sell' ? holding?.quantity ?? 0 : maximumCommodityInvestmentQuantity(model.game.credits, quote?.price ?? 0);
  const quantity = parseIntegerDraft(draft, { min: 1, max: maximum });
  const preview = quantity && quote?.price ? commodityInvestmentPreview(quote.price, quantity, side, quote.feeBps) : null;
  const validQuote = quote?.available && quote.contractId && quote.priceDateKey && quote.expiresAt !== undefined
    && quote.expiresAt > now && quote.priceDateKey === shanghaiDayKey.format(now);
  const product = model.game.products.find((item) => item.id === productId);

  async function submit() {
    if (inFlight.current) return;
    const input = unconfirmed ?? (validQuote && quantity && preview && !anyExpiryPending ? {
      productId, contractId: quote!.contractId!, priceDateKey: quote!.priceDateKey!, side, quantity,
    } : null);
    if (!input) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await model.tradeCommodityInvestment(input);
      if (!mounted.current) return;
      if (isUnconfirmedConfiguration(result)) setUnconfirmed(input);
      else {
        setUnconfirmed(null);
        if (result.ok) setDraft('');
      }
      if (result.message) model.notify(result.message, result.ok ? 'success' : undefined);
    } catch (error) {
      if (!mounted.current) return;
      setUnconfirmed(input);
      model.notify(error instanceof Error ? error.message : '交易结果尚未确认，请确认原交易');
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  }

  return <PagePanel className="investment-order-panel">
    <WidgetHeading title={product?.name ?? '商品期货'} action={<GameConcept concept="commodity-investment" />} />
    <DataList>
      <DataRow label="指数价格" value={<Money value={quote?.price} />} />
      <DataRow label="合约到期" value={deadline(quote?.expiresAt)} />
      <DataRow label="当前持仓" value={<CompactNumber value={holding?.quantity ?? 0} />} />
    </DataList>
    <div className="ui-segmented" role="group" aria-label="投资交易方向">
      {(['buy', 'sell'] as const).map((value) => <Button key={value} variant={side === value ? 'primary' : 'secondary'}
        aria-pressed={side === value} disabled={pending || unconfirmed !== null}
        onClick={() => { setSide(value); setDraft(''); }}>{value === 'buy' ? '买入' : '卖出'}</Button>)}
    </div>
    <IntegerInput label={side === 'buy' ? '买入数量' : '卖出数量'} value={draft} fallbackValue={1} allowEmpty
      min={1} max={Math.max(1, maximum)} disabled={pending || unconfirmed !== null} onValueChange={setDraft} />
    <DataList>
      <DataRow label={side === 'buy' ? '最多可买' : '最多可卖'} value={<CompactNumber value={maximum} />} />
      <DataRow label="成交总额" value={<Money value={preview?.gross} />} />
      <DataRow label="服务费" value={<Money value={preview?.fee} />} />
      <DataRow label={side === 'buy' ? '预计支付' : '预计返还'} value={<Money value={preview?.cash} />} />
    </DataList>
    <Button disabled={pending || (!unconfirmed && (!validQuote || !preview || Boolean(anyExpiryPending)))} onClick={() => void submit()}>
      {pending ? '正在确认' : unconfirmed ? '确认原交易' : side === 'buy' ? '确认买入' : '确认卖出'}
    </Button>
  </PagePanel>;
}

/** A single investment page owns trading and holdings; the funds workspace reuses banking. */
export function InvestmentPage({ model, funds }: { model: LoadedGameViewModel; funds: ReactNode }) {
  const [tab, setTab] = usePageTabPreference({ userId: model.user.id, pageId: 'investment', allowed: TABS, fallback: 'commodities' });
  const ids = useMemo(() => model.game.products.map((product) => product.id), [model.game.products]);
  const [productId, setProductId] = useStableSelection({ availableIds: ids, fallbackId: ids[0] ?? '', contextKey: `${model.user.id}:${model.game.saveEpoch}` });
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const id = useId();
  const account = model.game.commodityInvestment;
  const names = new Map(model.game.products.map((product) => [product.id, product.name]));
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, selected: InvestmentTab) {
    const index = TABS.indexOf(selected);
    const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
      : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length]
        : event.key === 'Home' ? TABS[0] : event.key === 'End' ? TABS[TABS.length - 1] : null;
    if (!next) return;
    event.preventDefault(); setTab(next); document.getElementById(`${id}-${next}`)?.focus();
  }
  function sell(selectedProduct: string) { setProductId(selectedProduct); setSide('sell'); setTab('commodities'); }
  return <PageLayout title="投资">
    <AssetOverviewPanel model={model} />
    <div className="ui-segmented investment-tabs" role="tablist" aria-label="投资分区">
      {TABS.map((value) => <Button key={value} role="tab" id={`${id}-${value}`} aria-selected={tab === value}
        aria-controls={`${id}-content`} tabIndex={tab === value ? 0 : -1} variant={tab === value ? 'primary' : 'secondary'}
        onKeyDown={(event) => tabKey(event, value)} onClick={() => setTab(value)}>{LABELS[value]}</Button>)}
    </div>
    <section role="tabpanel" id={`${id}-content`} aria-labelledby={`${id}-${tab}`} tabIndex={0} className="investment-content">
      {tab === 'funds' ? funds : tab === 'commodities' ? <>
        <SelectInput label="投资商品" value={productId} onChange={(event) => { setProductId(event.target.value); setSide('buy'); }}>
          {model.game.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
        </SelectInput>
        {productId ? <InvestmentOrder key={productId} model={model} productId={productId} side={side} setSide={setSide} />
          : <EmptyState>暂无商品目录</EmptyState>}
      </> : <>
        <PagePanel>
          <WidgetHeading title="商品持仓" />
          <DataList>
            <DataRow label="持仓权益" value={<Money value={account?.equity} />} />
            <DataRow label="持仓本金" value={<Money value={account?.principal} />} />
            <DataRow label="浮动损益" value={<Money value={account?.unrealizedProfit} />} />
            <DataRow label="已实现净收益" value={<Money value={account?.realizedProfit} />} />
          </DataList>
          {!account?.positions.length ? <EmptyState>暂无商品持仓</EmptyState> : <div className="investment-holdings">
            {account.positions.map((position) => <article className="investment-position" key={position.contractId}>
              <WidgetHeading title={<><ProductArtwork productId={position.productId} />{names.get(position.productId) ?? position.productId}</>}
                action={<Button variant="secondary" disabled={position.status !== 'open'} onClick={() => sell(position.productId)}>卖出</Button>} />
              <DataList>
                <DataRow label="数量" value={<CompactNumber value={position.quantity} />} />
                <DataRow label="建仓均价" value={<Money value={position.averageCost} />} />
                <DataRow label="当前权益" value={<Money value={position.value} />} />
                <DataRow label="浮动损益" value={<Money value={position.unrealizedProfit} />} />
                <DataRow label={position.status === 'expiry-pending' ? '到期结算待确认' : '到期时间'} value={deadline(position.expiresAt)} />
              </DataList>
            </article>)}
          </div>}
        </PagePanel>
        <PagePanel>
          <WidgetHeading title="投资记录" />
          {!account?.recentTransactions.length ? <EmptyState>暂无投资记录</EmptyState> : <div className="investment-history">
            {[...account.recentTransactions].reverse().map((transaction) => <div key={transaction.id} className="investment-history-row">
              <span>{TRANSACTIONS[transaction.type]} · {names.get(transaction.productId) ?? transaction.productId}
                <small>{deadline(transaction.createdAt)} · <CompactNumber value={transaction.quantity} /> 单位</small></span>
              <Money value={transaction.cashChange} />
            </div>)}
          </div>}
        </PagePanel>
      </>}
    </section>
  </PageLayout>;
}
