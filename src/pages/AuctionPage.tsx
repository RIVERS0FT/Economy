import { useMemo, useState } from 'react';
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
import { Button, EmptyState, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';

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
  if (items.length === 1 && items[0].kind === 'collectible' && items[0].thumbnailUrl) {
    const image = <AuctionItemIcon item={items[0]} />;
    return items[0].sourceUrl ? (
      <a className="collectible-auction-image" href={items[0].sourceUrl} target="_blank" rel="noreferrer">{image}</a>
    ) : <div className="collectible-auction-image">{image}</div>;
  }
  if (items.length === 1) {
    return <div className="asset-auction-icon" aria-hidden="true"><AuctionItemIcon item={items[0]} /></div>;
  }
  return (
    <div className="asset-auction-bundle-visual" aria-label={`资产包包含 ${items.length} 项资产`}>
      {items.slice(0, 4).map((item) => (
        <div className="asset-auction-bundle-tile" key={`${item.kind}:${item.id}`}>
          <AuctionItemIcon item={item} compact />
        </div>
      ))}
      {items.length > 4 ? <strong>+{formatNumber(items.length - 4)}</strong> : null}
    </div>
  );
}

export function AuctionPage({ model }: { model: LoadedGameViewModel }) {
  const { collectibles, assetAuctions } = getCollectibleState(model.game);
  const openAuctions = assetAuctions.filter((auction) => auction.status === 'open');
  const closedAuctions = assetAuctions.filter((auction) => auction.status !== 'open').slice(0, 12);
  const [assetKind, setAssetKind] = useState<AuctionAssetKind>('collectible');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [bundleItems, setBundleItems] = useState<AuctionItem[]>([]);
  const [startingBid, setStartingBid] = useState(100);
  const [durationHours, setDurationHours] = useState(24);
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
  const selectedQuantity = assetKind === 'collectible' ? 1 : Math.max(1, Math.floor(quantity));
  const canAdd = Boolean(selectedOption)
    && selectedQuantity <= Number(selectedOption?.available || 0)
    && (bundleItems.length < MAX_AUCTION_ITEMS || bundledQuantity(assetKind, selectedOption?.id || '') > 0);
  const canPublish = bundleItems.length > 0
    && Number.isInteger(startingBid) && startingBid > 0
    && Number.isInteger(durationHours) && durationHours >= 1 && durationHours <= 168;

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

  function addSelectedItem() {
    if (!selectedOption || !canAdd) return;
    setBundleItems((current) => {
      const existing = current.find((item) => item.assetKind === assetKind && item.assetId === selectedOption.id);
      if (existing && assetKind !== 'collectible') {
        return current.map((item) => item === existing ? { ...item, quantity: item.quantity + selectedQuantity } : item);
      }
      return [...current, { assetKind, assetId: selectedOption.id, quantity: selectedQuantity }];
    });
    setSelectedAssetId('');
    setQuantity(1);
  }

  function updateBundleQuantity(target: AuctionItem, nextQuantity: number) {
    const maximum = availableForItem(target);
    const normalized = Math.min(maximum, Math.max(1, Math.floor(nextQuantity || 1)));
    setBundleItems((current) => current.map((item) => item === target ? { ...item, quantity: normalized } : item));
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
      <Panel className="collectible-auction-create">
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
                    setQuantity(1);
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
                <label>
                  资产
                  <select value={selectedOption?.id || ''} onChange={(event) => setSelectedAssetId(event.target.value)}>
                    {availableOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
                  </select>
                </label>
                {assetKind === 'collectible' ? null : (
                  <label>
                    数量
                    <input
                      type="number"
                      min="1"
                      max={selectedOption?.available || 1}
                      value={selectedQuantity}
                      onChange={(event) => setQuantity(Number(event.target.value))}
                    />
                  </label>
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
                  return (
                    <div className="asset-auction-package-row" key={`${item.assetKind}:${item.assetId}`}>
                      <div className="asset-auction-package-icon" aria-hidden="true">
                        {collectible?.thumbnailUrl ? <img src={collectible.thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : item.assetKind === 'commodity' ? <ProductIcon productId={item.assetId} /> : <FactoryIcon />}
                      </div>
                      <span><strong>{labelForItem(item)}</strong><small>{assetKindNames[item.assetKind]}</small></span>
                      {item.assetKind === 'collectible' ? <strong>× 1</strong> : (
                        <input
                          aria-label={`${labelForItem(item)}数量`}
                          type="number"
                          min="1"
                          max={availableForItem(item)}
                          value={item.quantity}
                          onChange={(event) => updateBundleQuantity(item, Number(event.target.value))}
                        />
                      )}
                      <Button variant="danger" className="asset-auction-remove" onClick={() => setBundleItems((current) => current.filter((entry) => entry !== item))}>移除</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className="asset-auction-parameters">
          <label>
            整包起拍价
            <input type="number" min="1" max="1000000000" value={startingBid} onChange={(event) => setStartingBid(Number(event.target.value))} />
          </label>
          <label>
            拍卖时长（h）
            <input type="number" min="1" max="168" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} />
          </label>
          <Button
            disabled={submitting || !canPublish}
            onClick={() => void run(() => gameActions.createAuction(bundleItems, startingBid, durationHours), () => setBundleItems([]))}
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
              const amount = Number(bidAmounts[auction.id] || auction.minimumBid);
              const items = auctionItems(auction);
              return (
                <Panel className={`collectible-auction-card asset-auction-card ${auction.isBundle ? 'asset-auction-bundle' : `asset-auction-${auction.assetKind}`}`} key={auction.id}>
                  <AuctionAssetVisual auction={auction} />
                  <div className="collectible-auction-body">
                    <WidgetHeading title={auctionTitle(auction)} action={<StatusTag tone="warning">{remainingText(auction.endsAt, model.now)}</StatusTag>} />
                    <p>{auction.isBundle ? '不可拆分资产包' : assetKindNames[items[0].kind]} · 整包竞价</p>
                    <div className="asset-auction-item-list">
                      {items.slice(0, 3).map((item) => <span key={`${item.kind}:${item.id}`}><strong>{item.name}</strong><small>{assetKindNames[item.kind]} · × {formatNumber(item.quantity)}</small></span>)}
                      {items.length > 3 ? <span><strong>另有 {formatNumber(items.length - 3)} 项</strong><small>全部资产随成交一次性转移</small></span> : null}
                    </div>
                    <dl className="collectible-auction-metrics">
                      <div><dt>当前总价</dt><dd><CurrencyAmount>{formatCurrency(auction.highestBid ?? auction.startingBid)}</CurrencyAmount></dd></div>
                      <div><dt>资产项目</dt><dd>{formatNumber(items.length)}</dd></div>
                      <div><dt>出价次数</dt><dd>{formatNumber(auction.bids.length)}</dd></div>
                      <div><dt>卖家</dt><dd>{auction.sellerName}</dd></div>
                      <div><dt>最高出价者</dt><dd>{auction.highestBidderName || '暂无'}</dd></div>
                    </dl>
                    {auction.isSeller ? (
                      <div className="collectible-auction-actions">
                        <StatusTag tone="info">你是卖家</StatusTag>
                        {!auction.highestBidderId ? <Button variant="danger" disabled={submitting} onClick={() => void run(() => gameActions.cancelAuction(auction.id))}>取消拍卖</Button> : <small>已有出价，不能取消</small>}
                      </div>
                    ) : (
                      <div className="collectible-bid-form">
                        <label>
                          <span>整包出价（最低 <CurrencyAmount>{formatCurrency(auction.minimumBid)}</CurrencyAmount>）</span>
                          <input
                            type="number"
                            min={auction.minimumBid}
                            max="1000000000"
                            value={bidAmounts[auction.id] ?? String(auction.minimumBid)}
                            onChange={(event) => setBidAmounts((current) => ({ ...current, [auction.id]: event.target.value }))}
                          />
                        </label>
                        <Button disabled={submitting || !Number.isFinite(amount) || amount < auction.minimumBid} onClick={() => void run(() => gameActions.placeAuctionBid(auction.id, amount))}>
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

      <Panel className="collectible-auction-history">
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
