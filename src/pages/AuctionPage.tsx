import { useMemo, useState } from 'react';
import { useNow } from '../hooks/useNow';
import { gameActions } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  getCollectibleState,
  type AssetAuction,
  type AuctionAssetKind,
  type AuctionItem,
  type AuctionItemSummary,
} from '../collectibles/types';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIcon } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput, SelectInput } from '../components/ui/FormControls';
import { Button, EmptyState, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';
import { parseIntegerDraft } from '../utils/integerDraft';
import '../styles/auction-card-layers.css';

const MAX_AUCTION_ITEMS = 20;

const statusNames = {
  open: '进行中',
  sold: '已成交',
  ended: '流拍',
  cancelled: '已取消',
} as const;

const assetKindNames: Record<AuctionAssetKind, string> = {
  collectible: '藏品',
  commodity: '商品',
  facility: '工厂',
};

interface AuctionOption {
  id: string;
  label: string;
  available: number;
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

function AuctionItemIcon({ item, compact = false }: { item: AuctionItemSummary; compact?: boolean }) {
  if (item.kind === 'collectible' && item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt={compact ? '' : item.name}
        aria-hidden={compact || undefined}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
  }
  return item.kind === 'commodity' ? <ProductIcon productId={item.id} /> : <FactoryIcon />;
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
          <span className="asset-auction-tile-quantity" aria-hidden="true">×{formatNumber(item.quantity)}</span>
        </div>
      ))}
      {items.length > 4 ? <strong className="asset-auction-more-count">+{formatNumber(items.length - 4)}</strong> : null}
    </div>
  );
}

function AuctionAssetSummary({ auction }: { auction: AssetAuction }) {
  const items = auctionItems(auction);
  return (
    <div className="asset-auction-icon-layer" aria-label={`资产明细，共 ${formatNumber(items.length)} 项`}>
      {items.slice(0, 4).map((item) => (
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
      {items.length > 4 ? (
        <strong
          className="asset-auction-summary-more"
          aria-label={`另有 ${formatNumber(items.length - 4)} 项资产`}
          title={`另有 ${formatNumber(items.length - 4)} 项资产`}
        >
          +{formatNumber(items.length - 4)}
        </strong>
      ) : null}
    </div>
  );
}

export function AuctionPage({ model }: { model: LoadedGameViewModel }) {
  const now = useNow(model.game.lastProcessedAt);
  const { collectibles, assetAuctions } = getCollectibleState(model.game);
  const openAuctions = assetAuctions.filter((auction) => auction.status === 'open');
  const closedAuctions = assetAuctions.filter((auction) => auction.status !== 'open').slice(0, 12);
  const [assetKind, setAssetKind] = useState<AuctionAssetKind>('collectible');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [quantityInput, setQuantityInput] = useState('1');
  const [bundleItems, setBundleItems] = useState<AuctionItem[]>([]);
  const [bundleQuantityDrafts, setBundleQuantityDrafts] = useState<Record<string, string>>({});
  const [startingBid, setStartingBid] = useState(100);
  const [startingBidInput, setStartingBidInput] = useState('100');
  const [durationHours, setDurationHours] = useState(24);
  const [durationHoursInput, setDurationHoursInput] = useState('24');
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const bundledQuantity = (kind: AuctionAssetKind, id: string) => (
    bundleItems.find((item) => item.assetKind === kind && item.assetId === id)?.quantity ?? 0
  );

  const availableOptions = useMemo<AuctionOption[]>(() => {
    if (assetKind === 'collectible') {
      return collectibles
        .filter((item) => item.currentOwnerId === model.game.userId && !item.auctionId)
        .filter((item) => !bundleItems.some((entry) => entry.assetKind === 'collectible' && entry.assetId === item.id))
        .map((item) => ({ id: item.id, label: `${item.title} · ${item.artist}`, available: 1 }));
    }
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
  }, [assetKind, bundleItems, collectibles, model.game.facilityGroups, model.game.facilityTypes, model.game.inventories, model.game.products, model.game.userId]);

  const selectedOption = useMemo(() => (
    availableOptions.find((item) => item.id === selectedAssetId) ?? availableOptions[0]
  ), [availableOptions, selectedAssetId]);
  const selectedQuantity = assetKind === 'collectible'
    ? 1
    : parseAuctionQuantity(quantityInput, selectedOption?.available);
  const parsedStartingBid = parseIntegerDraft(startingBidInput, { min: 1, max: 1_000_000_000 });
  const parsedDurationHours = parseIntegerDraft(durationHoursInput, { min: 1, max: 168 });
  const canAdd = Boolean(selectedOption)
    && selectedQuantity !== null
    && selectedQuantity <= Number(selectedOption?.available || 0)
    && (bundleItems.length < MAX_AUCTION_ITEMS || bundledQuantity(assetKind, selectedOption?.id || '') > 0);
  const hasInvalidBundleQuantity = bundleItems.some((item) => {
    const draft = bundleQuantityDrafts[auctionItemKey(item)] ?? String(item.quantity);
    const parsed = parseAuctionQuantity(draft, availableForItem(item));
    return parsed === null;
  });
  const canPublish = bundleItems.length > 0
    && !hasInvalidBundleQuantity
    && parsedStartingBid !== null
    && parsedDurationHours !== null;

  function labelForItem(item: AuctionItem) {
    if (item.assetKind === 'collectible') return collectibles.find((entry) => entry.id === item.assetId)?.title ?? item.assetId;
    if (item.assetKind === 'commodity') return model.game.products.find((entry) => entry.id === item.assetId)?.name ?? item.assetId;
    return model.game.facilityTypes.find((entry) => entry.id === item.assetId)?.name ?? item.assetId;
  }

  function availableForItem(item: AuctionItem) {
    if (item.assetKind === 'collectible') return 1;
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
    const parsed = parseIntegerDraft(value, { min: 1, max: 1_000_000_000 });
    if (parsed !== null) setStartingBid(parsed);
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
      if (existing && assetKind !== 'collectible') {
        return current.map((item) => item === existing ? { ...item, quantity: item.quantity + selectedQuantity } : item);
      }
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
    setBundleItems((current) => current.map((item) => (
      auctionItemKey(item) === key ? { ...item, quantity: parsed } : item
    )));
  }

  function commitBundleQuantityDraft(target: AuctionItem) {
    const key = auctionItemKey(target);
    const draft = bundleQuantityDrafts[key];
    if (draft === undefined) return;
    const maximum = availableForItem(target);
    const parsed = parseAuctionQuantity(draft, maximum);
    const normalized = maximum < 1 || parsed === null ? target.quantity : parsed;
    setBundleItems((current) => current.map((item) => (
      auctionItemKey(item) === key ? { ...item, quantity: normalized } : item
    )));
    setBundleQuantityDrafts((current) => ({ ...current, [key]: String(normalized) }));
  }

  function resetBundleQuantityDraft(target: AuctionItem) {
    setBundleQuantityDrafts((current) => ({
      ...current,
      [auctionItemKey(target)]: String(target.quantity),
    }));
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
      description="发起资产拍卖：将藏品、商品和工厂组合为不可拆分的资产包公开竞价。卖方资产与最高出价资金都会冻结；冻结只限制使用，成交前仍计入各自总资产。"
    >
      <Panel className="widget collectible-auction-create">
        <WidgetHeading title="发布资产包拍卖" action={<StatusTag>{formatNumber(bundleItems.length)}/{MAX_AUCTION_ITEMS} 项 · 最长 168h</StatusTag>} />
        <div className="asset-auction-builder">
          <section className="asset-auction-add" aria-labelledby="auction-add-heading">
            <h3 id="auction-add-heading">添加资产</h3>
            <div className="ui-segmented asset-auction-kind-switch" role="group" aria-label="选择要加入资产包的类型">
              {(['collectible', 'commodity', 'facility'] as const).map((kind) => (
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
                <SelectInput
                  label="资产"
                  value={selectedOption?.id || ''}
                  onChange={(event) => setSelectedAssetId(event.target.value)}
                >
                  {availableOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                </SelectInput>
                {assetKind === 'collectible' ? null : (
                  <IntegerInput
                    label="数量"
                    value={quantityInput}
                    fallbackValue={selectedQuantity ?? 1}
                    min={1}
                    max={selectedOption?.available || 1}
                    error={selectedQuantity === null ? `请输入 1～${formatNumber(selectedOption?.available || 1)} 的整数。` : undefined}
                    onValueChange={setQuantityInput}
                  />
                )}
                <Button variant="secondary" disabled={!canAdd} onClick={addSelectedItem}>加入资产包</Button>
              </div>
            )}
          </section>

          <section className="asset-auction-package" aria-labelledby="auction-package-heading">
            <div className="section-heading"><h3 id="auction-package-heading">拍卖资产包</h3><span>{formatNumber(bundleItems.length)} 项</span></div>
            {bundleItems.length === 0 ? <EmptyState>尚未加入资产。单项拍卖也是只包含一项资产的资产包。</EmptyState> : (
              <div className="asset-auction-package-list">
                {bundleItems.map((item) => {
                  const collectible = item.assetKind === 'collectible' ? collectibles.find((entry) => entry.id === item.assetId) : null;
                  const key = auctionItemKey(item);
                  const quantityDraft = bundleQuantityDrafts[key] ?? String(item.quantity);
                  const parsedQuantity = parseAuctionQuantity(quantityDraft, availableForItem(item));
                  return (
                    <div className="asset-auction-package-row" key={key}>
                      <div className="asset-auction-package-icon" aria-hidden="true">
                        {collectible?.thumbnailUrl ? <img src={collectible.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : item.assetKind === 'commodity' ? <ProductIcon productId={item.assetId} /> : <FactoryIcon />}
                      </div>
                      <span><strong>{labelForItem(item)}</strong><small>{assetKindNames[item.assetKind]}</small></span>
                      {item.assetKind === 'collectible' ? <strong>× 1</strong> : (
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
                      )}
                      <Button variant="danger" className="asset-auction-remove" onClick={() => removeBundleItem(item)}>移除</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="asset-auction-parameters">
          <IntegerInput
            label="整包起拍价"
            value={startingBidInput}
            fallbackValue={startingBid}
            min={1}
            max={1_000_000_000}
            error={parsedStartingBid === null ? '请输入 1～1000000000 的整数。' : undefined}
            onValueChange={updateStartingBid}
          />
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
              if (parsedStartingBid === null || parsedDurationHours === null) return;
              void run(() => gameActions.createAuction(bundleItems, parsedStartingBid, parsedDurationHours), clearBundleBuilder);
            }}
          >
            {submitting ? '发布中' : '发布资产包拍卖'}
          </Button>
        </div>
        <p className="ui-helper-text">资产包中的全部资产会同时冻结，并作为整体成交、流拍或取消；已有有效出价后不能取消。冻结资产仍归卖方所有并计入总资产。</p>
      </Panel>

      <section className="collectible-auction-section" aria-labelledby="open-auctions-heading">
        <div className="section-heading"><h2 id="open-auctions-heading">进行中的拍卖</h2><span>{formatNumber(openAuctions.length)} 场</span></div>
        {openAuctions.length === 0 ? <EmptyState>暂无进行中的资产拍卖。</EmptyState> : (
          <div className="collectible-auction-grid">
            {openAuctions.map((auction) => {
              const bidInput = bidAmounts[auction.id] ?? String(auction.minimumBid);
              const amount = parseIntegerDraft(bidInput, { min: auction.minimumBid, max: 1_000_000_000 });
              return (
                <Panel className={`collectible-auction-card asset-auction-card ${auction.isBundle ? 'asset-auction-bundle' : `asset-auction-${auction.assetKind}`}`} key={auction.id}>
                  <AuctionAssetVisual auction={auction} />
                  <div className="collectible-auction-body">
                    <div className="asset-auction-card-heading">
                      <h2 title={auctionCardTitle(auction)}>{auctionCardTitle(auction)}</h2>
                      <StatusTag tone="warning">{remainingText(auction.endsAt, now)}</StatusTag>
                    </div>
                    <AuctionAssetSummary auction={auction} />
                    <dl className="collectible-auction-metrics asset-auction-primary-metrics asset-auction-data-layer">
                      <div><dt>当前总价</dt><dd><CurrencyAmount>{formatCurrency(auction.highestBid ?? auction.startingBid)}</CurrencyAmount></dd></div>
                      <div><dt>最高出价者</dt><dd>{auction.highestBidderName || '暂无'}</dd></div>
                    </dl>
                    {auction.isSeller ? (
                      <div className="collectible-auction-actions">
                        <StatusTag tone="info">你是卖家</StatusTag>
                        {!auction.highestBidderId ? <Button variant="danger" disabled={submitting} onClick={() => void run(() => gameActions.cancelAuction(auction.id))}>取消拍卖</Button> : <small>已有出价，不能取消</small>}
                      </div>
                    ) : (
                      <div className="collectible-bid-form">
                        <IntegerInput
                          label={<span>整包出价（最低 <CurrencyAmount>{formatCurrency(auction.minimumBid)}</CurrencyAmount>）</span>}
                          value={bidInput}
                          fallbackValue={amount ?? auction.minimumBid}
                          min={auction.minimumBid}
                          max={1_000_000_000}
                          error={amount === null ? `请输入不低于 ${formatCurrency(auction.minimumBid)} 的整数。` : undefined}
                          onValueChange={(value) => setBidAmounts((current) => ({ ...current, [auction.id]: value }))}
                        />
                        <Button disabled={submitting || amount === null} onClick={() => {
                          if (amount === null) return;
                          void run(() => gameActions.placeAuctionBid(auction.id, amount));
                        }}>
                          {auction.isHighestBidder ? '提高出价' : '提交出价'}
                        </Button>
                      </div>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </section>

      <Panel className="widget collectible-auction-history">
        <WidgetHeading title="最近结束" />
        {closedAuctions.length === 0 ? <EmptyState>暂无最近结束的拍卖。</EmptyState> : (
          <div className="collectible-auction-history-list">
            {closedAuctions.map((auction) => (
              <div key={auction.id}>
                <AuctionAssetVisual auction={auction} compact />
                <span><strong>{auctionTitle(auction)}</strong><small>{auction.isBundle ? '资产包' : assetKindNames[auction.assetKind]} · {auction.sellerName} · {formatTime(auction.settledAt ?? auction.endsAt)}</small></span>
                <StatusTag tone={auctionTone(auction.status)}>
                  {statusNames[auction.status]}
                  {auction.highestBid ? <> · <CurrencyAmount>{formatCurrency(auction.highestBid)}</CurrencyAmount></> : null}
                </StatusTag>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </PageLayout>
  );
}
