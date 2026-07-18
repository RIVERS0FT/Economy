import { useMemo, useState } from 'react';
import { gameActions } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  getCollectibleState,
  type AssetAuction,
  type AuctionAssetKind,
} from '../collectibles/types';
import { FactoryIcon } from '../components/icons/GameIcons';
import { ProductIcon } from '../components/icons/ProductIcons';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { Button, EmptyState, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';

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

function AuctionAssetVisual({ auction, compact = false }: { auction: AssetAuction; compact?: boolean }) {
  if (auction.assetKind === 'collectible' && auction.asset.thumbnailUrl) {
    const image = (
      <img
        src={auction.asset.thumbnailUrl}
        alt={compact ? '' : auction.asset.name}
        aria-hidden={compact || undefined}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
      />
    );
    return auction.asset.sourceUrl && !compact ? (
      <a className="collectible-auction-image" href={auction.asset.sourceUrl} target="_blank" rel="noreferrer">{image}</a>
    ) : image;
  }
  return (
    <div className={compact ? 'asset-auction-history-icon' : 'asset-auction-icon'} aria-hidden="true">
      {auction.assetKind === 'commodity'
        ? <ProductIcon productId={auction.assetId} />
        : <FactoryIcon />}
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
  const [startingBid, setStartingBid] = useState(100);
  const [durationHours, setDurationHours] = useState(24);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const availableOptions = useMemo<AuctionOption[]>(() => {
    if (assetKind === 'collectible') {
      return collectibles
        .filter((item) => item.currentOwnerId === model.game.userId && !item.auctionId)
        .map((item) => ({ id: item.id, label: `${item.title} · ${item.artist}`, available: 1 }));
    }
    if (assetKind === 'commodity') {
      return model.game.products.flatMap((product) => {
        const available = Number(model.game.inventories[product.id]?.available || 0);
        return available > 0 ? [{ id: product.id, label: `${product.name} · 可用 ${formatNumber(available)}`, available }] : [];
      });
    }
    return model.game.facilityGroups.flatMap((group) => {
      const type = model.game.facilityTypes.find((item) => item.id === group.facilityTypeId);
      return type && group.availableCount > 0
        ? [{ id: type.id, label: `${type.name} · 可用 ${formatNumber(group.availableCount)}`, available: group.availableCount }]
        : [];
    });
  }, [assetKind, collectibles, model.game.facilityGroups, model.game.facilityTypes, model.game.inventories, model.game.products, model.game.userId]);

  const selectedOption = useMemo(() => (
    availableOptions.find((item) => item.id === selectedAssetId) ?? availableOptions[0]
  ), [availableOptions, selectedAssetId]);
  const selectedQuantity = assetKind === 'collectible' ? 1 : Math.max(1, Math.floor(quantity));
  const canPublish = Boolean(selectedOption)
    && selectedQuantity <= Number(selectedOption?.available || 0)
    && Number.isInteger(startingBid) && startingBid > 0
    && Number.isInteger(durationHours) && durationHours >= 1 && durationHours <= 168;

  async function run(operation: () => ReturnType<typeof gameActions.createAuction>) {
    if (submitting) return;
    setSubmitting(true);
    try {
      const response = await operation();
      model.notify(response.result.message);
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
      description="玩家可以竞价交易藏品、商品和工厂。卖方资产与最高出价资金都会冻结，结束后由服务器自动结算。"
      actions={<StatusTag tone="warning">进行中 {formatNumber(openAuctions.length)} 场</StatusTag>}
    >
      <Panel className="collectible-auction-create">
        <WidgetHeading title="发起资产拍卖" action={<StatusTag>最长 168h</StatusTag>} />
        <div className="asset-auction-kind-switch" role="group" aria-label="拍卖资产类型">
          {(['collectible', 'commodity', 'facility'] as const).map((kind) => (
            <Button
              key={kind}
              variant={assetKind === kind ? 'primary' : 'secondary'}
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
          <EmptyState>当前没有可拍卖的{assetKindNames[assetKind]}；已冻结或拍卖中的资产不能重复发布。</EmptyState>
        ) : (
          <div className="collectible-auction-form asset-auction-form">
            <label>
              资产
              <select value={selectedOption?.id || ''} onChange={(event) => setSelectedAssetId(event.target.value)}>
                {availableOptions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}
              </select>
            </label>
            <label>
              数量
              <input
                type="number"
                min="1"
                max={selectedOption?.available || 1}
                value={selectedQuantity}
                disabled={assetKind === 'collectible'}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </label>
            <label>
              起拍价（整批）
              <input type="number" min="1" max="1000000000" value={startingBid} onChange={(event) => setStartingBid(Number(event.target.value))} />
            </label>
            <label>
              时长（h）
              <input type="number" min="1" max="168" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} />
            </label>
            <Button
              disabled={submitting || !canPublish}
              onClick={() => void run(() => gameActions.createAuction(assetKind, selectedOption?.id || '', selectedQuantity, startingBid, durationHours))}
            >
              发布拍卖
            </Button>
          </div>
        )}
      </Panel>

      <section className="collectible-auction-section" aria-labelledby="open-auctions-heading">
        <div className="section-heading"><h2 id="open-auctions-heading">进行中的拍卖</h2><span>{formatNumber(openAuctions.length)} 场</span></div>
        {openAuctions.length === 0 ? <Panel><EmptyState>暂无进行中的资产拍卖。</EmptyState></Panel> : (
          <div className="collectible-auction-grid">
            {openAuctions.map((auction) => {
              const amount = Number(bidAmounts[auction.id] || auction.minimumBid);
              return (
                <Panel className={`collectible-auction-card asset-auction-card asset-auction-${auction.assetKind}`} key={auction.id}>
                  <AuctionAssetVisual auction={auction} />
                  <div className="collectible-auction-body">
                    <WidgetHeading title={auction.asset.name} action={<StatusTag tone="warning">{remainingText(auction.endsAt, model.now)}</StatusTag>} />
                    <p>{auction.asset.subtitle} · {assetKindNames[auction.assetKind]}</p>
                    <dl className="collectible-auction-metrics">
                      <div><dt>当前价</dt><dd><CurrencyAmount>{formatCurrency(auction.highestBid ?? auction.startingBid)}</CurrencyAmount></dd></div>
                      <div><dt>数量</dt><dd>{formatNumber(auction.quantity)}</dd></div>
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
                          <span>出价（最低 <CurrencyAmount>{formatCurrency(auction.minimumBid)}</CurrencyAmount>）</span>
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

      {closedAuctions.length > 0 ? (
        <Panel className="collectible-auction-history">
          <WidgetHeading title="最近结束" />
          <div className="collectible-auction-history-list">
            {closedAuctions.map((auction) => (
              <div key={auction.id}>
                <AuctionAssetVisual auction={auction} compact />
                <span><strong>{auction.asset.name} × {formatNumber(auction.quantity)}</strong><small>{assetKindNames[auction.assetKind]} · {auction.sellerName} · {formatTime(auction.settledAt ?? auction.endsAt)}</small></span>
                <StatusTag tone={auctionTone(auction.status)}>
                  {statusNames[auction.status]}
                  {auction.highestBid ? <> · <CurrencyAmount>{formatCurrency(auction.highestBid)}</CurrencyAmount></> : null}
                </StatusTag>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </PageLayout>
  );
}
