import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { adminApi, type ExtendedAdminSummary } from '../api/admin';
import type {
  CollectibleAdminRecord,
  CollectibleImportRecord,
  CollectibleOwnershipRecord,
} from '../collectibles/types';
import { VirtualList } from '../components/ui/VirtualList';
import type { AuthUser, GiftCodeAdminRecord } from '../types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';

const collectibleFormatExample = `[
  {
    "sourceArtworkId": 28560,
    "title": "The Bedroom",
    "artist": "Vincent van Gogh",
    "dateDisplay": "1889",
    "mediumDisplay": "Oil on canvas",
    "dimensions": "73.6 × 92.3 cm",
    "imageId": "芝加哥艺术博物馆 image_id",
    "isPublicDomain": true,
    "initialOwnerId": 123
  }
]`;

function parseImportItems(value: unknown): CollectibleImportRecord[] {
  const records = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];
  return records as CollectibleImportRecord[];
}

function ownershipReason(record: CollectibleOwnershipRecord) {
  if (record.reason === 'auction') return '拍卖成交';
  if (record.reason === 'assigned') return '管理员初始分配';
  return '创建藏品';
}

export function AdminApp({ user }: { user: AuthUser }) {
  const [summary, setSummary] = useState<ExtendedAdminSummary | null>(null);
  const [giftCodes, setGiftCodes] = useState<GiftCodeAdminRecord[]>([]);
  const [collectibles, setCollectibles] = useState<CollectibleAdminRecord[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [rewardCredits, setRewardCredits] = useState(100);
  const [maxRedemptions, setMaxRedemptions] = useState(100);
  const [expiresAt, setExpiresAt] = useState('');
  const [note, setNote] = useState('');
  const [createdCode, setCreatedCode] = useState('');
  const [redemptions, setRedemptions] = useState<Array<{ user_id: number; reward_credits: number; redeemed_at: number }>>([]);
  const [selectedGiftId, setSelectedGiftId] = useState<number | null>(null);
  const [importItems, setImportItems] = useState<CollectibleImportRecord[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [ownership, setOwnership] = useState<CollectibleOwnershipRecord[]>([]);
  const [selectedCollectible, setSelectedCollectible] = useState<CollectibleAdminRecord | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextCodes, nextCollectibles] = await Promise.all([
        adminApi.summary(),
        adminApi.giftCodes(),
        adminApi.collectibles(),
      ]);
      setSummary(nextSummary);
      setGiftCodes(nextCodes);
      setCollectibles(nextCollectibles);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '无法加载管理员数据');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (user.role !== 'admin') {
    return <main className="admin-shell admin-denied"><section><h1>无权访问</h1><p>当前账号不是 Economy 管理员。</p><a href="/economy/">返回游戏</a></section></main>;
  }

  async function createGift() {
    try {
      const result = await adminApi.createGiftCode({
        code: code.trim() || undefined,
        rewardCredits,
        maxRedemptions,
        expiresAt: expiresAt ? new Date(expiresAt).getTime() : null,
        note,
      });
      setCreatedCode(result.code);
      setCode('');
      setNotice('礼品码已创建。明文只在此处显示，请立即保存。');
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '创建礼品码失败');
    }
  }

  async function disableGift(id: number) {
    try {
      await adminApi.disableGiftCode(id);
      setNotice(`礼品码 #${id} 已停用`);
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '停用礼品码失败');
    }
  }

  async function showRedemptions(id: number) {
    try {
      setSelectedGiftId(id);
      setRedemptions(await adminApi.redemptions(id));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '读取兑换记录失败');
    }
  }

  async function readCollectibleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const records = parseImportItems(parsed);
      if (records.length === 0) throw new Error('JSON 必须是藏品数组或包含 items 数组');
      setImportItems(records);
      setImportFileName(file.name);
      setNotice(`已读取 ${records.length} 条藏品记录，请确认后上传。`);
    } catch (reason) {
      setImportItems([]);
      setImportFileName('');
      setNotice(reason instanceof Error ? reason.message : '无法读取藏品 JSON');
    }
  }

  async function uploadCollectibles() {
    if (uploading || importItems.length === 0) return;
    setUploading(true);
    try {
      const result = await adminApi.importCollectibles(importItems);
      setNotice(`成功导入 ${result.importedCount} 件藏品。`);
      setImportItems([]);
      setImportFileName('');
      await load();
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '导入藏品失败');
    } finally {
      setUploading(false);
    }
  }

  async function showOwnership(item: CollectibleAdminRecord) {
    try {
      setSelectedCollectible(item);
      setOwnership(await adminApi.collectibleOwnership(item.id));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : '读取藏品归属记录失败');
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><span>Economy</span><h1>管理员后台</h1><p>{user.email}</p></div>
        <div><a href="/economy/">返回游戏</a><button type="button" onClick={() => void load()}>刷新</button></div>
      </header>

      {error ? <div className="admin-alert danger">{error}</div> : null}
      {notice ? <div className="admin-alert">{notice}</div> : null}

      <section className="admin-summary-grid" aria-label="世界概况">
        <article><span>玩家数量</span><strong>{summary?.playerCount ?? '--'}</strong></article>
        <article><span>未完成订单</span><strong>{summary?.openOrderCount ?? '--'}</strong></article>
        <article><span>商品订单</span><strong>{summary?.commodityOrderCount ?? '--'}</strong></article>
        <article><span>工厂订单</span><strong>{summary?.facilityOrderCount ?? '--'}</strong></article>
        <article><span>藏品数量</span><strong>{summary?.collectibleCount ?? '--'}</strong></article>
        <article><span>进行中拍卖</span><strong>{summary?.openAuctionCount ?? '--'}</strong></article>
        <article><span>世界版本</span><strong>{summary?.worldVersion ?? '--'}</strong></article>
        <article><span>API 状态</span><strong>{summary?.apiStatus ?? '--'}</strong></article>
      </section>

      <section className="admin-grid">
        <article className="admin-panel admin-collectible-upload">
          <h2>上传藏品</h2>
          <p>仅接受芝加哥艺术博物馆公版藏品。图片地址由服务器根据 IIIF image_id 生成，不允许上传任意图片 URL。</p>
          <label>藏品 JSON 文件<input type="file" accept="application/json,.json" onChange={(event) => void readCollectibleFile(event)} /></label>
          <pre className="admin-collectible-format">{collectibleFormatExample}</pre>
          <div className="admin-collectible-preview">
            <span>{importFileName ? `${importFileName} · ${importItems.length} 条` : '尚未选择文件'}</span>
            <button type="button" disabled={uploading || importItems.length === 0} onClick={() => void uploadCollectibles()}>{uploading ? '正在导入…' : '导入藏品'}</button>
          </div>
        </article>

        <article className="admin-panel">
          <h2>创建礼品码</h2>
          <label>指定兑换码（留空自动生成）<input value={code} maxLength={64} onChange={(event: ChangeEvent<HTMLInputElement>) => setCode(event.target.value.toUpperCase())} placeholder="RIVER-XXXX-XXXX" /></label>
          <label>奖励货币<input type="number" min="1" max="1000000" value={rewardCredits} onChange={(event) => setRewardCredits(Number(event.target.value))} /></label>
          <label>最大兑换次数<input type="number" min="1" max="1000000" value={maxRedemptions} onChange={(event) => setMaxRedemptions(Number(event.target.value))} /></label>
          <label>过期时间（可选）<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
          <label>管理备注<textarea value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} /></label>
          <button type="button" onClick={() => void createGift()}>创建礼品码</button>
          {createdCode ? <div className="created-gift-code"><span>新礼品码</span><strong>{createdCode}</strong></div> : null}
        </article>
      </section>

      <section className="admin-panel admin-gift-list">
        <h2>藏品管理与当前归属</h2>
        {collectibles.length === 0 ? <p>暂无藏品。</p> : (
          <div className="virtual-record-table admin-collectibles-virtual-table" role="table" aria-label="藏品管理与当前归属">
            <div className="virtual-record-header" role="row">
              <span role="columnheader">图片</span><span role="columnheader">藏品</span><span role="columnheader">艺术家</span><span role="columnheader">当前归属</span><span role="columnheader">状态</span><span role="columnheader">归属记录</span><span role="columnheader">操作</span>
            </div>
            <VirtualList
              items={collectibles}
              getKey={(item) => item.id}
              estimateSize={72}
              viewportHeight={560}
              minViewportHeight={96}
              overscan={5}
              gap={0}
              className="virtual-record-viewport"
              role="rowgroup"
              itemRole="presentation"
              ariaLabel="藏品管理行"
              renderItem={(item) => (
                <div className="virtual-record-row" role="row">
                  <span role="cell"><img className="admin-collectible-thumb" src={item.thumbnailUrl} alt="" aria-hidden="true" loading="lazy" decoding="async" referrerPolicy="no-referrer" /></span>
                  <span role="cell"><strong>{item.title}</strong><small> AIC #{item.sourceArtworkId}</small></span>
                  <span role="cell">{item.artist || '佚名'}</span>
                  <span role="cell">{item.currentOwnerId ? `${item.currentOwnerName} (#${item.currentOwnerId})` : '未分配'}</span>
                  <span role="cell">{item.auctionId ? '拍卖中' : '未拍卖'}</span>
                  <span role="cell">{item.ownershipCount}</span>
                  <span role="cell"><span className="admin-row-actions"><a href={item.sourceUrl} target="_blank" rel="noreferrer">馆藏页</a><button type="button" onClick={() => void showOwnership(item)}>归属历史</button></span></span>
                </div>
              )}
            />
          </div>
        )}
      </section>

      {selectedCollectible ? (
        <section className="admin-panel">
          <h2>《{selectedCollectible.title}》归属历史</h2>
          <VirtualList
            key={selectedCollectible.id}
            items={ownership}
            getKey={(record) => record.id}
            estimateSize={72}
            viewportHeight={420}
            minViewportHeight={80}
            overscan={5}
            gap={8}
            className="admin-ownership-list admin-ownership-virtual-list"
            ariaLabel={`${selectedCollectible.title}归属历史`}
            empty={<p>暂无归属记录。</p>}
            renderItem={(record) => (
              <div>
                <span>{record.fromOwnerId ? `${record.fromOwnerName} (#${record.fromOwnerId})` : '系统'}</span>
                <strong>→</strong>
                <span>{record.toOwnerId ? `${record.toOwnerName} (#${record.toOwnerId})` : '未分配'}</span>
                <small>{ownershipReason(record)}{record.price ? ` · ¤ ${formatCurrency(record.price)}` : ''} · {formatTime(record.createdAt)}</small>
              </div>
            )}
          />
        </section>
      ) : null}

      <section className="admin-panel admin-gift-list">
        <h2>礼品码记录</h2>
        {giftCodes.length === 0 ? <p>暂无礼品码。</p> : (
          <div className="virtual-record-table admin-gifts-virtual-table" role="table" aria-label="礼品码记录">
            <div className="virtual-record-header" role="row">
              <span role="columnheader">ID</span><span role="columnheader">奖励</span><span role="columnheader">兑换</span><span role="columnheader">状态</span><span role="columnheader">有效期</span><span role="columnheader">备注</span><span role="columnheader">操作</span>
            </div>
            <VirtualList
              items={giftCodes}
              getKey={(gift) => gift.id}
              estimateSize={58}
              viewportHeight={520}
              minViewportHeight={96}
              overscan={6}
              gap={0}
              className="virtual-record-viewport"
              role="rowgroup"
              itemRole="presentation"
              ariaLabel="礼品码记录行"
              renderItem={(gift) => (
                <div className="virtual-record-row" role="row">
                  <span role="cell">#{gift.id}</span>
                  <span role="cell">¤ {formatCurrency(gift.reward_credits)}</span>
                  <span role="cell">{gift.redeemed_count}/{gift.max_redemptions}</span>
                  <span role="cell">{gift.enabled ? '启用' : '停用'}</span>
                  <span role="cell">{gift.expires_at ? formatDate(gift.expires_at) : '长期'}</span>
                  <span role="cell">{gift.note || '—'}</span>
                  <span role="cell"><span className="admin-row-actions"><button type="button" onClick={() => void showRedemptions(gift.id)}>兑换记录</button>{gift.enabled ? <button type="button" className="danger" onClick={() => void disableGift(gift.id)}>停用</button> : null}</span></span>
                </div>
              )}
            />
          </div>
        )}
      </section>

      {selectedGiftId !== null ? (
        <section className="admin-panel admin-redemptions">
          <h2>礼品码 #{selectedGiftId} 兑换记录</h2>
          {redemptions.length === 0 ? <p>暂无兑换记录。</p> : (
            <div className="virtual-record-table admin-redemptions-virtual-table" role="table" aria-label={`礼品码 ${selectedGiftId} 兑换记录`}>
              <div className="virtual-record-header" role="row"><span role="columnheader">玩家 ID</span><span role="columnheader">奖励</span><span role="columnheader">兑换时间</span></div>
              <VirtualList
                key={selectedGiftId}
                items={redemptions}
                getKey={(record) => `${record.user_id}-${record.redeemed_at}`}
                estimateSize={52}
                viewportHeight={420}
                minViewportHeight={80}
                overscan={6}
                gap={0}
                className="virtual-record-viewport"
                role="rowgroup"
                itemRole="presentation"
                ariaLabel="礼品码兑换记录行"
                renderItem={(record) => (
                  <div className="virtual-record-row" role="row"><span role="cell">{record.user_id}</span><span role="cell">¤ {formatCurrency(record.reward_credits)}</span><span role="cell">{formatTime(record.redeemed_at)}</span></div>
                )}
              />
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
