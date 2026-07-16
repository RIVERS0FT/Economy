import { useMemo, useState } from 'react';
import { gameActions } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { getCollectibleState, type CollectibleAuction } from '../collectibles/types';
import { Button, EmptyState, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { formatCurrency, formatDuration, formatNumber, formatTime } from '../utils/formatters';

const statusNames = {
  open: '进行中',
  sold: '已成交',
  ended: '流拍',
  cancelled: '已取消',
} as const;

function remainingText(endsAt: number, now: number) {
  const remaining = Math.max(0, endsAt - now);
  return remaining === 0 ? '等待服务器结算' : formatDuration(remaining);
}

function auctionTone(status: CollectibleAuction['status']) {
  if (status === 'open') return 'warning' as const;
  if (status === 'sold') return 'success' as const;
  return 'neutral' as const;
}

export function AuctionPage({ model }: { model: LoadedGameViewModel }) {
  const { collectibles, collectibleAuctions } = getCollectibleState(model.game);
  const available = collectibles.filter((item) => item.currentOwnerId === model.game.userId && !item.auctionId);
  const openAuctions = collectibleAuctions.filter((auction) => auction.status === 'open');
  const closedAuctions = collectibleAuctions.filter((auction) => auction.status !== 'open').slice(0, 12);
  const [selectedCollectibleId, setSelectedCollectibleId] = useState('');
  const [startingBid, setStartingBid] = useState(100);
  const [durationHours, setDurationHours] = useState(24);
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const selectedId = useMemo(() => (
    available.some((item) => item.id === selectedCollectibleId) ? selectedCollectibleId : available[0]?.id || ''
  ), [available, selectedCollectibleId]);

  async function run(operation: () => ReturnType<typeof gameActions.createCollectibleAuction>) {
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
      description="玩家以竞价方式交易唯一藏品。最高出价资金会冻结，拍卖结束后由服务器自动结算并转移归属。"
      actions={<StatusTag tone="warning">进行中 {formatNumber(openAuctions.length)} 场</StatusTag>}
    >
      <Panel className="collectible-auction-create">
        <WidgetHeading title="发起藏品拍卖" action={<StatusTag>最长 168h</StatusTag>} />
        {available.length === 0 ? (
          <EmptyState>当前没有可发起拍卖的藏品；拍卖中的藏品不能重复发布。</EmptyState>
        ) : (
          <div className="collectible-auction-form">
            <label>
              藏品
              <select value={selectedId} onChange={(event) => setSelectedCollectibleId(event.target.value)}>
                {available.map((item) => <option value={item.id} key={item.id}>{item.title} · {item.artist}</option>)}
              </select>
            </label>
            <label>
              起拍价
              <input type="number" min="1" max="1000000000" value={startingBid} onChange={(event) => setStartingBid(Number(event.target.value))} />
            </label>
            <label>
              时长（h）
              <input type="number" min="1" max="168" value={durationHours} onChange={(event) => setDurationHours(Number(event.target.value))} />
            </label>
            <Button disabled={submitting || !selectedId} onClick={() => void run(() => gameActions.createCollectibleAuction(selectedId, startingBid, durationHours))}>发布拍卖</Button>
          </div>
        )}
      </Panel>

      <section className="collectible-auction-section" aria-labelledby="open-auctions-heading">
        <div className="section-heading"><h2 id="open-auctions-heading">进行中的拍卖</h2><span>{formatNumber(openAuctions.length)} 场</span></div>
        {openAuctions.length === 0 ? <Panel><EmptyState>暂无进行中的藏品拍卖。</EmptyState></Panel> : (
          <div className="collectible-auction-grid">
            {openAuctions.map((auction) => {
              const amount = Number(bidAmounts[auction.id] || auction.minimumBid);
              return (
                <Panel className="collectible-auction-card" key={auction.id}>
                  <a className="collectible-auction-image" href={auction.collectible.sourceUrl} target="_blank" rel="noreferrer">
                    <img src={auction.collectible.thumbnailUrl} alt={`${auction.collectible.artist}《${auction.collectible.title}》`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                  </a>
                  <div className="collectible-auction-body">
                    <WidgetHeading title={auction.collectible.title} action={<StatusTag tone="warning">{remainingText(auction.endsAt, model.now)}</StatusTag>} />
                    <p>{auction.collectible.artist}{auction.collectible.dateDisplay ? ` · ${auction.collectible.dateDisplay}` : ''}</p>
                    <dl className="collectible-auction-metrics">
                      <div><dt>当前价</dt><dd>¤ {formatCurrency(auction.highestBid ?? auction.startingBid)}</dd></div>
                      <div><dt>出价次数</dt><dd>{formatNumber(auction.bids.length)}</dd></div>
                      <div><dt>卖家</dt><dd>{auction.sellerName}</dd></div>
                      <div><dt>最高出价者</dt><dd>{auction.highestBidderName || '暂无'}</dd></div>
                    </dl>
                    {auction.isSeller ? (
                      <div className="collectible-auction-actions">
                        <StatusTag tone="info">你是卖家</StatusTag>
                        {!auction.highestBidderId ? <Button variant="danger" disabled={submitting} onClick={() => void run(() => gameActions.cancelCollectibleAuction(auction.id))}>取消拍卖</Button> : <small>已有出价，不能取消</small>}
                      </div>
                    ) : (
                      <div className="collectible-bid-form">
                        <label>
                          出价（最低 ¤ {formatCurrency(auction.minimumBid)}）
                          <input
                            type="number"
                            min={auction.minimumBid}
                            max="1000000000"
                            value={bidAmounts[auction.id] ?? String(auction.minimumBid)}
                            onChange={(event) => setBidAmounts((current) => ({ ...current, [auction.id]: event.target.value }))}
                          />
                        </label>
                        <Button disabled={submitting || !Number.isFinite(amount) || amount < auction.minimumBid} onClick={() => void run(() => gameActions.placeCollectibleBid(auction.id, amount))}>
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
                <img src={auction.collectible.thumbnailUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
                <span><strong>{auction.collectible.title}</strong><small>{auction.sellerName} · {formatTime(auction.settledAt ?? auction.endsAt)}</small></span>
                <StatusTag tone={auctionTone(auction.status)}>{statusNames[auction.status]}{auction.highestBid ? ` · ¤ ${formatCurrency(auction.highestBid)}` : ''}</StatusTag>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}
    </PageLayout>
  );
}
