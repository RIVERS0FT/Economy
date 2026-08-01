import { useEffect, useMemo, useState } from 'react';
import { gameActions, getAuctionBidHistory } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  getAuctionState,
  type AssetAuction,
  type AuctionAssetKind,
  type AuctionBidHistory,
  type AuctionItem,
  type AuctionItemSummary,
} from '../auctions/types';
import { FacilityIcon } from '../components/icons/FacilityIcons';
import { ProductIcon } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, MoneyInput, SelectInput } from '../components/ui/FormControls';
import { Button, EmptyState, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { useNow } from '../hooks/useNow';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import { parseMoneyDraft } from '../utils/moneyDraft';
import '../styles/auction-card-layers.css';

const MAX_AUCTION_ITEMS = 20;
const LISTING_FEE_RATE = 0.002;
const LISTING_FEE_MINIMUM = 0.5;
const LISTING_FEE_MAXIMUM = 100;
const SELLER_FEE_RATE = 0.01;

const statusNames = {
  open: '进行中',
  sold: '已成交',
  ended: '流拍',
  cancelled: '已取消',
} as const;

const settlementNames: Record<Exclude<AssetAuction['settlementReason'], null>, string> = {
  sold: '已成交',
  no_bid: '无人出价',
  reserve_not_met: '未达保留价',
  seller_cancelled: '卖方取消',
  settlement_failed: '结算异常',
  migration_cancelled: '迁移取消',
};

const assetKindNames: Record<AuctionAssetKind, string> = {
  commodity: '商品',
  facility: '工厂',
};

interface AuctionOption {
  id: string;
  label: string;
  available: number;
}

interface BidHistoryCacheEntry {
  bidCount: number;
  latestBidAt: number | null;
  history: AuctionBidHistory;
}

function parseAuctionQuantity(value: string, maximum?: number) {
  return parseIntegerDraft(value, { min: 1, max: maximum });
}

function auctionItemKey(item: Pick<AuctionItem, 'assetKind' | 'assetId'>) {
  return `${item.assetKind}:${item.assetId}`;
}

function remainingText(endsAt: number, now: number) {
  const remaining = Math.max(0, endsAt - now);
  return remaining === 0 ? '等待服务器结算' : formatDuration(remaining);
}

function auctionTone(status: AssetAuction['status']) {
  if (status === 'open') return 'warning' as const;
  if (status === 'sold') return 'success' as const;
  return 'neutral' as const;
}

function auctionItems(auction: AssetAuction): AuctionItemSummary[] {
  if (auction.itemSummaries?.length) return auction.itemSummaries;
  return [{ ...auction.asset, quantity: auction.quantity }];
}

function auctionTitle(auction: AssetAuction) {
  const items = auctionItems(auction);
  if (items.length === 1) return `${items[0].name} × ${formatNumber(items[0].quantity)}`;
  if (items.length === 2) return `${items[0].name} + ${items[1].name}`;
  return `${items[0].name}、${items[1].name}等 ${formatNumber(items.length)} 项资产`;
}

function auctionCardTitle(auction: AssetAuction) {
  const items = auctionItems(auction);
  return items.length === 1 ? items[0].name : auctionTitle(auction);
}

function calculateListingFee(startingBid: number, reservePrice: number | null) {
  const basis = Math.max(startingBid, reservePrice ?? 0);
  const proportional = Math.ceil(basis * LISTING_FEE_RATE * 100) / 100;
  return Math.min(LISTING_FEE_MAXIMUM, Math.max(LISTING_FEE_MINIMUM, proportional));
}

function calculateMinimumIncrement(startingBid: number) {
  return Math.max(0.01, Math.ceil(startingBid * 0.02 * 100) / 100);
}

function AuctionItemIcon({ item }: { item: AuctionItemSummary; compact?: boolean }) {
  return item.kind === 'commodity'
    ? <ProductIcon productId={item.id} />
    : <FacilityIcon facilityTypeId={item.id} />;
}

function AuctionAssetVisual({ auction, compact = false }: { auction: AssetAuction; compact?: boolean }) {
  const items = auctionItems(auction);
  if (compact) {
    return (
      <div className="asset-auction-history-icon" aria-hidden="true">
        <AuctionItemIcon item={items[0]} compact />
      </div>
    );
  }
  return (
    <div
      className={`asset-auction-bundle-visual asset-auction-item-count-${Math.min(items.length, 4)}`}
      aria-label={`拍卖包含 ${items.length} 项资产`}
    >
      {items.slice(0, 4).map((item) => (
        <div
          className="asset-auction-bundle-tile"
          key={`${item.kind}:${item.id}`}
          aria-label={`${item.name}，数量 ${formatNumber(item.quantity)}`}
        >
          <AuctionItemIcon item={item} compact />
        </div>
      ))}
      {items.length > 4 ? <strong className="asset-auction-more-count">+{formatNumber(items.length - 4)}</strong> : null}
    </div>
  );
}

function AuctionAssetSummary({ auction }: { auction: AssetAuction }) {
  const items = auctionItems(auction);
  const placeholderCount = Math.max(0, MAX_AUCTION_ITEMS - items.length);
  return (
    <div className="asset-auction-icon-layer" aria-label={`资产明细，共 ${formatNumber(items.length)} 项`}>
      {items.map((item) => (
        <div
          className="asset-auction-summary-icon"
          key={`${item.kind}:${item.id}`}
          aria-label={`${item.name}，数量 ${formatNumber(item.quantity)}`}
          title={`${item.name} ×${formatNumber(item.quantity)}`}
        >
          <AuctionItemIcon item={item} compact />
          <span className="asset-auction-summary-quantity" aria-hidden="true">×{formatNumber(item.quantity)}</span>
        </div>
      ))}
      {Array.from({ length: placeholderCount }, (_, index) => (
        <span className="asset-auction-summary-placeholder" key={`placeholder-${index}`} aria-hidden="true" />
      ))}
    </div>
  );
}

function BidHistoryPanel({
  auction,
  expanded,
  loading,
  history,
  error,
  onToggle,
}: {
  auction: AssetAuction;
  expanded: boolean;
  loading: boolean;
  history?: AuctionBidHistory;
  error?: string;
  onToggle: () => void;
}) {
  if (auction.bidCount === 0) {
    return <div className="asset-auction-bid-history-empty">暂无出价记录</div>;
  }
  return (
    <section className="asset-auction-bid-history" aria-label="出价记录">
      <button
        type="button"
        className="asset-auction-bid-history-toggle"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>出价记录 · 共 {formatNumber(auction.bidCount)} 次</span>
        <small>{auction.latestBidAt ? `最近出价 ${formatTime(auction.latestBidAt)}` : ''}</small>
        <strong>{expanded ? '收起' : '查看最近 10 条'}</strong>
      </button>
      {expanded ? (
        <div className="asset-auction-bid-history-content">
          {loading ? <p>正在读取出价记录…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {!loading && !error && history ? (
            <>
              <ol>
                {history.bids.map((bid, index) => (
                  <li key={`${bid.createdAt}-${bid.amount}-${index}`}>
                    <span>{bid.isMine ? `你（${bid.bidderLabel}）` : bid.bidderLabel}</span>
                    <CurrencyAmount>{formatCurrency(bid.amount)}</CurrencyAmount>
                    <time>{formatTime(bid.createdAt)}</time>
                  </li>
                ))}
              </ol>
              {history.bidCount > history.bids.length ? (
                <p>仅显示最近 10 条，共 {formatNumber(history.bidCount)} 次出价</p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function AuctionPage({ model }: { model: LoadedGameViewModel }) {
  const now = useNow(model.game.lastProcessedAt);
  const { assetAuctions } = getAuctionState(model.game);
  const openAuctions = assetAuctions.filter((auction) => auction.status === 'open');
  const closedAuctions = assetAuctions.filter((auction) => auction.status !== 'open').slice(0, 12);
  const [assetKind, setAssetKind] = useState<AuctionAssetKind>('commodity');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [bundleItems, setBundleItems] = useState<AuctionItem[]>([]);
  const [bundleQuantityDrafts, setBundleQuantityDrafts] = useState<Record<string, string>>({});
  const [startingBid, setStartingBid] = useState(100);
  const [startingBidInput, setStartingBidInput] = useState('100');
  const [reserveEnabled, setReserveEnabled] = useState(false);
  const [reservePrice, setReservePrice] = useState(100);
  const [reservePriceInput, setReservePriceInput] = useState('100');
  const [durationHours, setDurationHours] = useState(24);
  const [durationHoursInput, setDurationHoursInput] = useState('24');
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [expandedBidHistoryIds, setExpandedBidHistoryIds] = useState<Set<string>>(() => new Set());
  const [bidHistoryCache, setBidHistoryCache] = useState<Record<string, BidHistoryCacheEntry>>({});
  const [loadingBidHistoryIds, setLoadingBidHistoryIds] = useState<Set<string>>(() => new Set());
  const [bidHistoryErrors, setBidHistoryErrors] = useState<Record<string, string>>({});

  const bundledQuantity = (kind: AuctionAssetKind, id: string) => (
    bundleItems.find((item) => item.assetKind === kind && item.assetId === id)?.quantity ?? 0
  );

  const availableOptions = useMemo<AuctionOption[]>(() => {
    if (assetKind === 'commodity') {
      return model.game.products.flatMap((product) => {
        const available = Math.max(0, Number(model.game.inventories[product.id]?.available || 0) - bundledQuantity('commodity', product.id));
        return available > 0 ? [{ id: product.id, label: `${product.name} · 剩余可加入 ${formatNumber(available)}`, available }] : [];
      });
    }
    return model.game.facilityGroups.flatMap((group) => {
      const type = model.game.facilityTypes.find((item) => item.id === group.facilityTypeId);
      const available = Math.max(0, group.availableCount - bundledQuantity('facility', group.facilityTypeId));
      return type && available > 0
        ? [{ id: type.id, label: `${type.name} · 剩余可加入 ${formatNumber(available)}`, available }]
        : [];
    });
  }, [assetKind, bundleItems, model.game.facilityGroups, model.game.facilityTypes, model.game.inventories, model.game.products]);

  const selectedOption = useMemo(() => (
    availableOptions.find((item) => item.id === selectedAssetId) ?? availableOptions[0]
  ), [availableOptions, selectedAssetId]);

  useEffect(() => {
    setSelectedAssetId((current) => (
      availableOptions.some((item) => item.id === current) ? current : availableOptions[0]?.id ?? ''
    ));
  }, [availableOptions]);

  useEffect(() => {
    for (const auction of assetAuctions) {
      if (!expandedBidHistoryIds.has(auction.id) || loadingBidHistoryIds.has(auction.id)) continue;
      const cached = bidHistoryCache[auction.id];
      if (cached && cached.bidCount === auction.bidCount && cached.latestBidAt === auction.latestBidAt) continue;
      setLoadingBidHistoryIds((current) => new Set(current).add(auction.id));
      setBidHistoryErrors((current) => {
        const next = { ...current };
        delete next[auction.id];
        return next;
      });
      void getAuctionBidHistory(auction.id)
        .then((history) => setBidHistoryCache((current) => ({
          ...current,
          [auction.id]: { bidCount: auction.bidCount, latestBidAt: auction.latestBidAt, history },
        })))
        .catch((reason) => setBidHistoryErrors((current) => ({
          ...current,
          [auction.id]: reason instanceof Error ? reason.message : '读取出价记录失败',
        })))
        .finally(() => setLoadingBidHistoryIds((current) => {
          const next = new Set(current);
          next.delete(auction.id);
          return next;
        }));
    }
  }, [assetAuctions, bidHistoryCache, expandedBidHistoryIds, loadingBidHistoryIds]);

  const selectedQuantity = parseAuctionQuantity(quantityInput, selectedOption?.available);
  const parsedStartingBid = parseMoneyDraft(startingBidInput, { min: 0.01, max: 1_000_000_000 });
  const parsedReservePrice = reserveEnabled
    ? parseMoneyDraft(reservePriceInput, { min: 0.01, max: 1_000_000_000 })
    : null;
  const reserveInvalid = reserveEnabled && (
    parsedReservePrice === null || parsedStartingBid === null || parsedReservePrice < parsedStartingBid
  );
  const parsedDurationHours = parseIntegerDraft(durationHoursInput, { min: 1, max: 168 });
  const listingFeePreview = parsedStartingBid === null || reserveInvalid
    ? null
    : calculateListingFee(parsedStartingBid, parsedReservePrice);
  const minimumIncrementPreview = parsedStartingBid === null ? null : calculateMinimumIncrement(parsedStartingBid);
  const canAdd = Boolean(selectedOption)
    && selectedQuantity !== null
    && selectedQuantity <= Number(selectedOption?.available || 0)
    && (bundleItems.length < MAX_AUCTION_ITEMS || bundledQuantity(assetKind, selectedOption?.id || '') > 0);
  const hasInvalidBundleQuantity = bundleItems.some((item) => {
    const draft = bundleQuantityDrafts[auctionItemKey(item)] ?? String(item.quantity);
    return parseAuctionQuantity(draft, availableForItem(item)) === null;
  });
  const canPublish = bundleItems.length > 0
    && !hasInvalidBundleQuantity
    && parsedStartingBid !== null
    && !reserveInvalid
    && listingFeePreview !== null
    && model.game.credits >= listingFeePreview
    && parsedDurationHours !== null;

  function labelForItem(item: AuctionItem) {
    if (item.assetKind === 'commodity') return model.game.products.find((entry) => entry.id === item.assetId)?.name ?? item.assetId;
    return model.game.facilityTypes.find((entry) => entry.id === item.assetId)?.name ?? item.assetId;
  }

  function availableForItem(item: AuctionItem) {
    if (item.assetKind === 'commodity') return Number(model.game.inventories[item.assetId]?.available || 0);
    return model.game.facilityGroups.find((entry) => entry.facilityTypeId === item.assetId)?.availableCount ?? 0;
  }

  function clearBundleQuantityDraft(key: string) {
    setBundleQuantityDrafts((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function updateStartingBid(value: string) {
    setStartingBidInput(value);
    const parsed = parseMoneyDraft(value, { min: 0.01, max: 1_000_000_000 });
    if (parsed !== null) {
      setStartingBid(parsed);
      if (!reserveEnabled) {
        setReservePrice(parsed);
        setReservePriceInput(String(parsed));
      }
    }
  }

  function updateReservePrice(value: string) {
    setReservePriceInput(value);
    const parsed = parseMoneyDraft(value, { min: 0.01, max: 1_000_000_000 });
    if (parsed !== null) setReservePrice(parsed);
  }

  function updateDurationHours(value: string) {
    setDurationHoursInput(value);
    const parsed = parseIntegerDraft(value, { min: 1, max: 168 });
    if (parsed !== null) setDurationHours(parsed);
  }

  function addSelectedItem() {
    if (!selectedOption || !canAdd || selectedQuantity === null) return;
    const key = `${assetKind}:${selectedOption.id}`;
    setBundleItems((current) => {
      const existing = current.find((item) => item.assetKind === assetKind && item.assetId === selectedOption.id);
      if (existing) return current.map((item) => item === existing ? { ...item, quantity: item.quantity + selectedQuantity } : item);
      return [...current, { assetKind, assetId: selectedOption.id, quantity: selectedQuantity }];
    });
    clearBundleQuantityDraft(key);
    setSelectedAssetId('');
    setQuantityInput('1');
  }

  function updateBundleQuantityDraft(target: AuctionItem, value: string) {
    const key = auctionItemKey(target);
    setBundleQuantityDrafts((current) => ({ ...current, [key]: value }));
    const parsed = parseAuctionQuantity(value, availableForItem(target));
    if (parsed === null) return;
    setBundleItems((current) => current.map((item) => auctionItemKey(item) === key ? { ...item, quantity: parsed } : item));
  }

  function commitBundleQuantityDraft(target: AuctionItem) {
    const key = auctionItemKey(target);
    const draft = bundleQuantityDrafts[key];
    if (draft === undefined) return;
    const maximum = availableForItem(target);
    const parsed = parseAuctionQuantity(draft, maximum);
    const normalized = maximum < 1 || parsed === null ? target.quantity : parsed;
    setBundleItems((current) => current.map((item) => auctionItemKey(item) === key ? { ...item, quantity: normalized } : item));
    setBundleQuantityDrafts((current) => ({ ...current, [key]: String(normalized) }));
  }

  function resetBundleQuantityDraft(target: AuctionItem) {
    setBundleQuantityDrafts((current) => ({ ...current, [auctionItemKey(target)]: String(target.quantity) }));
  }

  function removeBundleItem(target: AuctionItem) {
    const key = auctionItemKey(target);
    setBundleItems((current) => current.filter((item) => auctionItemKey(item) !== key));
    clearBundleQuantityDraft(key);
  }

  function clearBundleBuilder() {
    setBundleItems([]);
    setBundleQuantityDrafts({});
  }

  function toggleBidHistory(auctionId: string) {
    setExpandedBidHistoryIds((current) => {
      const next = new Set(current);
      if (next.has(auctionId)) next.delete(auctionId);
      else next.add(auctionId);
      return next;
    });
  }

  async function run(operation: () => ReturnType<typeof gameActions.createAuction>, onSuccess?: () => void) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await operation();
      model.notify(response.result.message);
      if (response.result.ok) onSuccess?.();
      await model.refresh();
    } catch (reason) {
      model.notify(reason instanceof Error ? reason.message : '拍卖操作失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageLayout
      title="拍卖"
      description="商品和工厂可组成不可拆分资产包公开竞价。卖方资产、最高出价资金和发布费均由服务器托管；竞买身份匿名。"
    >
      <Panel className="widget asset-auction-create">
        <WidgetHeading title="发布资产包拍卖" action={<StatusTag>{formatNumber(bundleItems.length)}/{MAX_AUCTION_ITEMS} 项 · 最长 168h</StatusTag>} />
        <div className="asset-auction-builder">
          <section className="asset-auction-add" aria-labelledby="auction-add-heading">
            <h3 id="auction-add-heading">添加资产</h3>
            <div className="ui-segmented asset-auction-kind-switch" role="group" aria-label="选择要加入资产包的类型">
              {(['commodity', 'facility'] as const).map((kind) => (
                <Button
                  key={kind}
                  variant="text"
                  className={assetKind === kind ? 'active' : ''}
                  aria-pressed={assetKind === kind}
                  onClick={() => {
                    setAssetKind(kind);
                    setSelectedAssetId('');
                    setQuantityInput('1');
                  }}
                >
                  {assetKindNames[kind]}
                </Button>
              ))}
            </div>
            {availableOptions.length === 0 ? (
              <p className="ui-helper-text">当前没有可继续加入的{assetKindNames[assetKind]}；已冻结、已拍卖或已加入资产包的数量不能重复使用。</p>
            ) : (
              <div className="asset-auction-add-form">
                <SelectInput label="资产" value={selectedAssetId} onChange={(event) => setSelectedAssetId(event.target.value)}>
                  {availableOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </SelectInput>
                <IntegerInput
                  label="数量"
                  value={quantityInput}
                  fallbackValue={selectedQuantity ?? 1}
                  min={1}
                  max={selectedOption?.available || 1}
                  error={selectedQuantity === null ? `请输入 1～${formatNumber(selectedOption?.available || 1)} 的整数。` : undefined}
                  onValueChange={setQuantityInput}
                />
                <Button variant="secondary" disabled={!canAdd} onClick={addSelectedItem}>加入资产包</Button>
              </div>
            )}
          </section>

          <section className="asset-auction-package" aria-labelledby="auction-package-heading">
            <div className="section-heading"><h3 id="auction-package-heading">拍卖资产包</h3><span>{formatNumber(bundleItems.length)} 项</span></div>
            {bundleItems.length === 0 ? <EmptyState>尚未加入资产。单项拍卖也是只包含一项资产的资产包。</EmptyState> : (
              <div className="asset-auction-package-list">
                {bundleItems.map((item) => {
                  const key = auctionItemKey(item);
                  const quantityDraft = bundleQuantityDrafts[key] ?? String(item.quantity);
                  const parsedQuantity = parseAuctionQuantity(quantityDraft, availableForItem(item));
                  return (
                    <div className="asset-auction-package-row" key={key}>
                      <div className="asset-auction-package-icon" aria-hidden="true">
                        {item.assetKind === 'commodity'
                          ? <ProductIcon productId={item.assetId} />
                          : <FacilityIcon facilityTypeId={item.assetId} />}
                      </div>
                      <span><strong>{labelForItem(item)}</strong><small>{assetKindNames[item.assetKind]}</small></span>
                      <input
                        className="ui-control ui-control--integer ui-control--compact"
                        aria-label={`${labelForItem(item)}数量`}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={quantityDraft}
                        aria-invalid={parsedQuantity === null}
                        onChange={(event) => updateBundleQuantityDraft(item, event.target.value)}
                        onBlur={() => commitBundleQuantityDraft(item)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            resetBundleQuantityDraft(item);
                          }
                        }}
                      />
                      <Button variant="danger" className="asset-auction-remove" onClick={() => removeBundleItem(item)}>移除</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="asset-auction-parameters">
          <MoneyInput
            label="整包起拍价"
            value={startingBidInput}
            fallbackValue={startingBid}
            min={0.01}
            max={1_000_000_000}
            error={parsedStartingBid === null ? '请输入不低于 0.01、最多两位小数的金额。' : undefined}
            onValueChange={updateStartingBid}
          />
          <label className="asset-auction-reserve-toggle">
            <input
              type="checkbox"
              checked={reserveEnabled}
              onChange={(event) => {
                setReserveEnabled(event.target.checked);
                if (event.target.checked && parsedStartingBid !== null && reservePrice < parsedStartingBid) {
                  setReservePrice(parsedStartingBid);
                  setReservePriceInput(String(parsedStartingBid));
                }
              }}
            />
            <span>设置隐藏保留价</span>
          </label>
          {reserveEnabled ? (
            <MoneyInput
              label="隐藏保留价"
              value={reservePriceInput}
              fallbackValue={reservePrice}
              min={parsedStartingBid ?? 0.01}
              max={1_000_000_000}
              error={reserveInvalid ? '保留价必须为合法金额且不得低于起拍价。' : undefined}
              onValueChange={updateReservePrice}
            />
          ) : null}
          <IntegerInput
            label="拍卖时长（h）"
            value={durationHoursInput}
            fallbackValue={durationHours}
            min={1}
            max={168}
            error={parsedDurationHours === null ? '请输入 1～168 的整数。' : undefined}
            onValueChange={updateDurationHours}
          />
          <Button
            disabled={submitting || !canPublish}
            onClick={() => {
              if (parsedStartingBid === null || parsedDurationHours === null || listingFeePreview === null) return;
              void run(
                () => gameActions.createAuction(bundleItems, parsedStartingBid, parsedReservePrice, parsedDurationHours),
                clearBundleBuilder,
              );
            }}
          >
            {submitting ? '发布中' : listingFeePreview === null ? '发布资产包拍卖' : `支付 ${formatCurrency(listingFeePreview)} 并发布`}
          </Button>
        </div>
        <dl className="asset-auction-fee-summary">
          <div><dt>发布费</dt><dd>{listingFeePreview === null ? '—' : <CurrencyAmount>{formatCurrency(listingFeePreview)}</CurrencyAmount>}</dd></div>
          <div><dt>最低加价</dt><dd>{minimumIncrementPreview === null ? '—' : <CurrencyAmount>{formatCurrency(minimumIncrementPreview)}</CurrencyAmount>}</dd></div>
          <div><dt>卖方成交手续费</dt><dd>成交总价的 1%</dd></div>
          <div><dt>买方手续费</dt><dd>无</dd></div>
        </dl>
        <p className="ui-helper-text">
          发布费按起拍价与保留价中较高者的 0.2% 计算，最低 <CurrencyAmount>{formatCurrency(0.5)}</CurrencyAmount>、最高 <CurrencyAmount>{formatCurrency(100)}</CurrencyAmount>；
          流拍、未达保留价或卖方自行取消时不退。结束前 2min 内有效出价会自动延时，累计最多 30min。
        </p>
        {listingFeePreview !== null && model.game.credits < listingFeePreview ? <p className="ui-error-text">可用资金不足以支付发布费。</p> : null}
      </Panel>

      <section className="asset-auction-section" aria-labelledby="open-auctions-heading">
        <div className="section-heading"><h2 id="open-auctions-heading">进行中的拍卖</h2><span>{formatNumber(openAuctions.length)} 场</span></div>
        {openAuctions.length === 0 ? <EmptyState>暂无进行中的资产拍卖。</EmptyState> : (
          <div className="asset-auction-grid">
            {openAuctions.map((auction) => {
              const bidInput = bidAmounts[auction.id] ?? String(auction.minimumBid);
              const amount = parseMoneyDraft(bidInput, { min: auction.minimumBid, max: 1_000_000_000 });
              const currentPrice = auction.highestBid ?? auction.startingBid;
              const estimatedSellerFee = currentPrice * SELLER_FEE_RATE;
              const expanded = expandedBidHistoryIds.has(auction.id);
              return (
                <Panel className={`asset-auction-card ${auction.isBundle ? 'asset-auction-bundle' : `asset-auction-${auction.assetKind}`}`} key={auction.id}>
                  <AuctionAssetVisual auction={auction} />
                  <div className="asset-auction-body">
                    <div className="asset-auction-card-heading">
                      <h2 title={auctionCardTitle(auction)}>{auctionCardTitle(auction)}</h2>
                      <StatusTag tone="warning">{remainingText(auction.endsAt, now)}</StatusTag>
                    </div>
                    <AuctionAssetSummary auction={auction} />
                    <dl className="asset-auction-metrics asset-auction-primary-metrics asset-auction-data-layer">
                      <div><dt>当前总价</dt><dd><CurrencyAmount>{formatCurrency(currentPrice)}</CurrencyAmount></dd></div>
                      <div><dt>最高竞买人</dt><dd>{auction.highestBidderLabel || '暂无'}</dd></div>
                      <div><dt>下一口最低</dt><dd><CurrencyAmount>{formatCurrency(auction.minimumBid)}</CurrencyAmount></dd></div>
                      <div><dt>保留价状态</dt><dd>{auction.hasHiddenReserve ? (auction.reserveMet ? '已达到' : '尚未达到') : '无隐藏保留价'}</dd></div>
                    </dl>
                    {auction.extensionCount > 0 ? <p className="asset-auction-extension-note">已自动延时 {formatNumber(auction.extensionCount)} 次</p> : <p className="asset-auction-extension-note">结束前 2min 内有效出价会自动延时</p>}
                    {auction.isSeller ? (
                      <>
                        <dl className="asset-auction-seller-settlement">
                          <div><dt>已支付发布费</dt><dd><CurrencyAmount>{formatCurrency(auction.listingFee ?? 0)}</CurrencyAmount></dd></div>
                          <div><dt>按当前价预计手续费</dt><dd><CurrencyAmount>{formatCurrency(estimatedSellerFee)}</CurrencyAmount></dd></div>
                          <div><dt>按当前价预计到账</dt><dd><CurrencyAmount>{formatCurrency(currentPrice - estimatedSellerFee)}</CurrencyAmount></dd></div>
                        </dl>
                        <div className="asset-auction-actions">
                          <StatusTag tone="info">你是卖家</StatusTag>
                          {!auction.hasBids ? <Button variant="danger" disabled={submitting} onClick={() => void run(() => gameActions.cancelAuction(auction.id))}>取消拍卖</Button> : <small>已有出价，不能取消</small>}
                        </div>
                      </>
                    ) : (
                      <div className="asset-bid-form">
                        <MoneyInput
                          label={<span>整包出价（最低 <CurrencyAmount>{formatCurrency(auction.minimumBid)}</CurrencyAmount>）</span>}
                          value={bidInput}
                          fallbackValue={amount ?? auction.minimumBid}
                          min={auction.minimumBid}
                          max={1_000_000_000}
                          error={amount === null ? `请输入不低于 ${formatCurrency(auction.minimumBid)} 的金额。` : undefined}
                          onValueChange={(value) => setBidAmounts((current) => ({ ...current, [auction.id]: value }))}
                        />
                        <Button disabled={submitting || amount === null} onClick={() => {
                          if (amount === null) return;
                          setBidHistoryCache((current) => {
                            const next = { ...current };
                            delete next[auction.id];
                            return next;
                          });
                          void run(() => gameActions.placeAuctionBid(auction.id, amount));
                        }}>
                          {auction.isHighestBidder ? '提高出价' : '提交出价'}
                        </Button>
                      </div>
                    )}
                    <BidHistoryPanel
                      auction={auction}
                      expanded={expanded}
                      loading={loadingBidHistoryIds.has(auction.id)}
                      history={bidHistoryCache[auction.id]?.history}
                      error={bidHistoryErrors[auction.id]}
                      onToggle={() => toggleBidHistory(auction.id)}
                    />
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>

      <Panel className="widget asset-auction-history">
        <WidgetHeading title="最近结束" />
        {closedAuctions.length === 0 ? <EmptyState>暂无最近结束的拍卖。</EmptyState> : (
          <div className="asset-auction-history-list">
            {closedAuctions.map((auction) => (
              <div key={auction.id}>
                <AuctionAssetVisual auction={auction} compact />
                <span>
                  <strong>{auctionTitle(auction)}</strong>
                  <small>
                    {auction.isBundle ? '资产包' : assetKindNames[auction.assetKind]} · {auction.sellerName} · {formatTime(auction.settledAt ?? auction.endsAt)}
                    {auction.isSeller && auction.listingFee ? ` · 发布费 ${formatCurrency(auction.listingFee)}` : ''}
                  </small>
                </span>
                <StatusTag tone={auctionTone(auction.status)}>
                  {auction.settlementReason ? settlementNames[auction.settlementReason] : statusNames[auction.status]}
                  {auction.highestBid ? <> · <CurrencyAmount>{formatCurrency(auction.highestBid)}</CurrencyAmount></> : null}
                  {auction.isSeller && auction.sellerNetProceeds !== null && auction.sellerNetProceeds !== undefined
                    ? <> · 到账 <CurrencyAmount>{formatCurrency(auction.sellerNetProceeds)}</CurrencyAmount></>
                    : null}
                </StatusTag>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageLayout>
  );
}
