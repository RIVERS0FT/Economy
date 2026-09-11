import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ActionResult, LoadedGameViewModel } from '../../app/gameViewModel';
import type { CommodityInvestmentQuote, CommodityInvestmentTradeInput } from '../../types';
import { usePageTabPreference } from '../../hooks/usePageTabPreference';
import { useNow } from '../../hooks/useNow';
import { availableInvestmentQuote, investmentTradePreview, formatInvestmentExpiry } from '../../investment/tradePreview';
import { formatCurrency, formatNumber, formatTime } from '../../utils/formatters';
import { ProductArtwork } from '../products/ProductArtwork';
import { IntegerInput } from '../ui/FormControls';
import { CompactNumber } from '../ui/CompactNumber';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { GameConcept } from '../ui/GameConcept';
import { Button, DataList, DataRow, EmptyState, PagePanel, StatusTag, WidgetHeading } from '../ui/layout';
import '../../styles/investment.css';

const TABS = ['commodities', 'positions', 'capital'] as const;
type InvestmentTab = typeof TABS[number];
const TAB_NAMES: Record<InvestmentTab, string> = { commodities: '商品', positions: '持仓', capital: '资金' };
const TRANSACTION_NAMES = { buy: '买入', sell: '卖出', expiry: '到期结算', collection: '违约追偿' };

function Money({ value }: { value: number | null | undefined }) {
  return value == null ? <>待核对</> : <CurrencyAmount>{formatCurrency(value)}</CurrencyAmount>;
}

function TradeForm({ model, quote, productId, pending, submit, initialSide }: {
  model: LoadedGameViewModel; quote: CommodityInvestmentQuote | undefined; productId: string;
  pending: boolean; submit: (input: CommodityInvestmentTradeInput) => Promise<ActionResult>;
  initialSide: 'buy' | 'sell';
}) {
  const [side, setSide] = useState<'buy' | 'sell'>(initialSide);
  const [draft, setDraft] = useState('');
  const alive = useRef(true);
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const now = useNow(model.game.lastProcessedAt, 1000);
  const account = model.game.commodityInvestment;
  const held = account?.positions.find((position) => position.contractId === quote?.contractId);
  const product = model.game.products.find((item) => item.id === productId);
  const ready = availableInvestmentQuote(quote, now);
  const preview = investmentTradePreview({ quote, now, side, draft, credits: model.game.credits,
    heldQuantity: held?.quantity ?? 0, closeGross: account?.closeGross ?? 0, feesPaid: account?.feesPaid ?? 0 });
  const blockedByExpiry = account?.positions.some((position) => position.expiresAt <= now) ?? false;
  const maxQuantity = preview?.maxQuantity ?? 0;
  async function trade() {
    if (pending || blockedByExpiry || !preview?.input) return;
    const submittedDraft = draft;
    const result = await submit(preview.input);
    if (alive.current && result.ok && currentDraft.current === submittedDraft) setDraft('');
  }
  return (
    <PagePanel className="investment-trade-panel">
      <WidgetHeading title={product?.name ?? productId} action={<GameConcept concept="commodity-futures" />} />
      <div className="ui-segmented" role="group" aria-label="期货买卖方向">
        {(['buy', 'sell'] as const).map((direction) => (
          <Button key={direction} variant="text" className={`ui-segmented__button${side === direction ? ' active' : ''}`}
            aria-pressed={side === direction} disabled={pending} onClick={() => { setSide(direction); setDraft(''); }}>
            {direction === 'buy' ? '买入' : '卖出'}
          </Button>
        ))}
      </div>
      <DataList>
        <DataRow label="商品指数价" value={quote?.available ? <Money value={quote.price} /> : '报价待同步'} />
        <DataRow label="合约到期" value={quote?.expiresAt ? `${formatInvestmentExpiry(quote.expiresAt)}（北京时间）` : '待同步'} />
        <DataRow label="可用资金" value={<Money value={model.game.credits} />} />
        <DataRow label="当期持仓" value={<CompactNumber value={held?.quantity ?? 0} />} />
      </DataList>
      <IntegerInput label="交易数量" value={draft} onValueChange={setDraft} allowEmpty fallbackValue={1}
        min={1} max={Math.max(1, maxQuantity)} disabled={!ready || pending || blockedByExpiry || maxQuantity < 1}
        error={draft && !preview?.input ? '请输入可成交范围内的正整数数量。' : undefined} />
      <div className="investment-quantity-actions" role="group" aria-label="快捷交易数量">
        {[0.25, 0.5, 1].map((share) => (
          <Button key={share} variant="secondary" disabled={!ready || pending || blockedByExpiry || maxQuantity < 1}
            onClick={() => setDraft(String(Math.max(1, Math.floor(maxQuantity * share))))}>
            {share === 1 ? '最大' : `${share * 100}%`}
          </Button>
        ))}
      </div>
      <DataList>
        <DataRow label="成交金额" value={preview?.gross == null ? '—' : <Money value={preview.gross} />} />
        <DataRow label="结算费用" value={preview?.fee == null ? '—' : <Money value={preview.fee} />} />
        <DataRow label={side === 'buy' ? '预计支付' : '预计返还'} value={preview?.amount == null ? '—' : <Money value={preview.amount} />} />
      </DataList>
      <Button block disabled={!preview?.input || !ready || pending || blockedByExpiry} onClick={() => { void trade(); }}>
        {pending ? '交易确认中…' : blockedByExpiry ? '等待到期结算' : side === 'buy' ? '确认买入' : '确认卖出'}
      </Button>
    </PagePanel>
  );
}

export function InvestmentWorkspace({ model, capital }: { model: LoadedGameViewModel; capital: ReactNode }) {
  const [tab, setTab] = usePageTabPreference<InvestmentTab>({ userId: model.user.id, pageId: 'investment',
    allowed: TABS, fallback: model.game.economyMode === 'cash' ? 'commodities' : 'capital' });
  const [selection, setSelection] = useState<{ productId: string; side: 'buy' | 'sell'; generation: number } | null>(null);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const account = model.game.commodityInvestment;
  const quotes = model.game.commodityInvestmentQuotes ?? [];
  const positions = account?.positions ?? [];
  const now = useNow(model.game.lastProcessedAt, 1000);
  const productName = (id: string) => model.game.products.find((product) => product.id === id)?.name ?? id;
  function select(productId: string, side: 'buy' | 'sell') {
    setSelection((old) => ({ productId, side, generation: (old?.generation ?? 0) + 1 }));
  }
  async function submit(input: CommodityInvestmentTradeInput): Promise<ActionResult> {
    if (lock.current) return { ok: false, message: '' };
    lock.current = true; setPending(true);
    try {
      const result = await model.tradeCommodityInvestment(input);
      if (alive.current && result.message) model.notify(result.message);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : '期货交易结果未确认，请核对持仓后再操作';
      if (alive.current) model.notify(message);
      return { ok: false, message };
    } finally {
      lock.current = false;
      if (alive.current) setPending(false);
    }
  }
  const selectedQuote = quotes.find((quote) => quote.productId === selection?.productId);
  const form = selection ? (
    <TradeForm key={`${selection.generation}:${selection.productId}:${selectedQuote?.contractId ?? ''}`}
      model={model} productId={selection.productId} quote={selectedQuote} pending={pending}
      submit={submit} initialSide={selection.side} />
  ) : null;
  return (
    <>
      <div className="ui-segmented investment-tabs" role="tablist" aria-label="投资页面分区">
        {TABS.map((item) => <Button key={item} id={`investment-tab-${item}`} variant="text" role="tab"
          aria-selected={item === tab} aria-controls={`investment-panel-${item}`}
          className={`ui-segmented__button${item === tab ? ' active' : ''}`} tabIndex={item === tab ? 0 : -1}
          onKeyDown={(event) => {
            const index = TABS.indexOf(item);
            const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
              : event.key === 'ArrowLeft' ? TABS[(index + TABS.length - 1) % TABS.length]
                : event.key === 'Home' ? TABS[0] : event.key === 'End' ? TABS[TABS.length - 1] : null;
            if (!next) return;
            event.preventDefault(); setSelection(null); setTab(next);
            document.getElementById(`investment-tab-${next}`)?.focus();
          }} onClick={() => { if (item !== tab) setSelection(null); setTab(item); }}>
          {TAB_NAMES[item]}
        </Button>)}
      </div>
      <div id={`investment-panel-${tab}`} role="tabpanel" aria-labelledby={`investment-tab-${tab}`} className="investment-content">
        {tab === 'capital' ? capital : model.game.economyMode !== 'cash' ? <EmptyState>商品期货尚未开放。</EmptyState> : selection ? (
          <>
            <Button variant="text" className="investment-back" autoFocus onClick={() => setSelection(null)}>返回{TAB_NAMES[tab]}列表</Button>
            {form}
          </>
        ) : tab === 'commodities' ? (
          <>
            <PagePanel className="investment-catalog">
              <WidgetHeading title="商品期货" action={<GameConcept concept="commodity-futures" />} />
              <div className="investment-catalog-header entity-list-header" aria-hidden="true"><span>商品</span><span>指数价</span><span>持仓</span></div>
              {model.game.products.map((product) => {
                const quote = quotes.find((row) => row.productId === product.id);
                const quantity = positions.filter((row) => row.productId === product.id).reduce((sum, row) => sum + row.quantity, 0);
                return <Button key={product.id} variant="text" className="investment-catalog-row"
                  aria-label={`${product.name}，指数价${quote?.price == null ? '待同步' : formatCurrency(quote.price)}，持仓${quantity}`}
                  onClick={() => select(product.id, 'buy')}>
                  <span className="investment-product"><span className="investment-artwork" aria-hidden="true"><ProductArtwork productId={product.id} /></span><strong>{product.name}</strong></span>
                  <span><Money value={quote?.price} /></span><span><CompactNumber value={quantity} /></span>
                </Button>;
              })}
            </PagePanel>
          </>
        ) : (
          <>
            <PagePanel>
              <WidgetHeading title="商品持仓" action={<GameConcept concept="commodity-futures" />} />
              <DataList>
                <DataRow label="持仓权益" value={<Money value={account?.equity ?? (positions.length ? null : 0)} />} />
                <DataRow label="建仓本金" value={<Money value={account?.principal ?? 0} />} />
                <DataRow label="浮动损益" value={<Money value={account?.unrealizedProfit ?? (positions.length ? null : 0)} />} />
                <DataRow label="已实现损益" value={<Money value={account?.realizedProfit ?? 0} />} />
              </DataList>
              {positions.length === 0 ? <EmptyState>暂无商品期货持仓。</EmptyState> : positions.map((position) => (
                <section key={position.contractId} className="investment-position" aria-label={`${productName(position.productId)}持仓`}>
                  <WidgetHeading title={productName(position.productId)} action={
                    <StatusTag tone={position.expiresAt <= now ? 'warning' : 'neutral'}>{position.expiresAt <= now ? '到期结算中' : '持有中'}</StatusTag>
                  } />
                  <DataList>
                    <DataRow label="持仓数量" value={<CompactNumber value={position.quantity} />} />
                    <DataRow label="建仓均价" value={<Money value={position.averageCost} />} />
                    <DataRow label="当前指数价" value={<Money value={position.price} />} />
                    <DataRow label="浮动损益" value={<Money value={position.unrealizedProfit} />} />
                    <DataRow label="到期时间" value={`${formatInvestmentExpiry(position.expiresAt)}（北京时间）`} />
                  </DataList>
                  <Button variant="secondary" disabled={pending || position.expiresAt <= now}
                    onClick={() => select(position.productId, 'sell')}>卖出{productName(position.productId)}</Button>
                </section>
              ))}
            </PagePanel>
            <PagePanel>
              <WidgetHeading title="投资记录" />
              {!account?.recentTransactions.length ? <EmptyState>暂无投资记录。</EmptyState> : (
                <div className="bank-history-list">
                  {[...account.recentTransactions].reverse().map((row) => (
                    <div key={row.id} className="bank-history-row investment-history-row">
                      <div><strong>{TRANSACTION_NAMES[row.type]} {productName(row.productId)} × {formatNumber(row.quantity)}</strong>
                        <small>{formatTime(row.createdAt)} · 成交价 {formatCurrency(row.price)} · 费用 {formatCurrency(row.fee)}</small>
                      </div>
                      <span><Money value={row.cashChange} /></span>
                    </div>
                  ))}
                </div>
              )}
            </PagePanel>
          </>
        )}
      </div>
    </>
  );
}
