import type { LoadedGameViewModel } from '../app/gameViewModel';
import { EmptyState, PageLayout, Panel, StatusTag, WidgetHeading } from '../components/ui/layout';
import { getCollectibleState } from '../collectibles/types';
import { formatNumber } from '../utils/formatters';

export function CollectionsPage({ model }: { model: LoadedGameViewModel }) {
  const { collectibles } = getCollectibleState(model.game);
  const owned = collectibles.filter((item) => item.currentOwnerId === model.game.userId);

  return (
    <PageLayout
      title="藏品"
      description="查看当前账号持有的艺术藏品。图片由芝加哥艺术博物馆 IIIF 直接提供，归属由游戏服务器记录。"
      actions={<StatusTag tone="info">持有 {formatNumber(owned.length)} 件</StatusTag>}
    >
      {owned.length === 0 ? (
        <Panel className="collectible-empty-panel">
          <EmptyState>
            <strong>暂无藏品</strong>
            <p>前往拍卖页参与竞拍，成交结算后藏品会自动加入这里。</p>
            <button type="button" className="ui-button ui-button--primary" onClick={() => model.setTab('auction')}>前往拍卖</button>
          </EmptyState>
        </Panel>
      ) : (
        <div className="collectible-gallery" aria-label="我的藏品">
          {owned.map((item) => (
            <Panel className="collectible-card" key={item.id}>
              <a className="collectible-image-frame" href={item.sourceUrl} target="_blank" rel="noreferrer" aria-label={`在芝加哥艺术博物馆查看《${item.title}》`}>
                <img
                  src={item.imageUrl}
                  srcSet={`${item.thumbnailUrl} 400w, ${item.imageUrl} 843w`}
                  sizes="(max-width: 720px) 92vw, (max-width: 1200px) 45vw, 360px"
                  alt={`${item.artist}《${item.title}》`}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(event) => { event.currentTarget.closest('.collectible-image-frame')?.classList.add('image-unavailable'); }}
                />
                <span className="collectible-image-fallback">图片暂时无法加载</span>
              </a>
              <div className="collectible-card-body">
                <WidgetHeading
                  title={item.title}
                  action={item.auctionId ? <StatusTag tone="warning">拍卖中</StatusTag> : <StatusTag tone="success">已收藏</StatusTag>}
                />
                <p className="collectible-artist">{item.artist || '佚名'}{item.dateDisplay ? ` · ${item.dateDisplay}` : ''}</p>
                {item.mediumDisplay ? <p className="collectible-description">{item.mediumDisplay}</p> : null}
                <dl className="collectible-metadata">
                  <div><dt>当前归属</dt><dd>{item.currentOwnerName}</dd></div>
                  <div><dt>馆藏编号</dt><dd>#{item.sourceArtworkId}</dd></div>
                  {item.dimensions ? <div><dt>尺寸</dt><dd>{item.dimensions}</dd></div> : null}
                </dl>
                <div className="collectible-card-actions">
                  <a className="ui-button ui-button--secondary" href={item.sourceUrl} target="_blank" rel="noreferrer">查看原馆藏</a>
                  {!item.auctionId ? <button type="button" className="ui-button ui-button--primary" onClick={() => model.setTab('auction')}>发起拍卖</button> : null}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
