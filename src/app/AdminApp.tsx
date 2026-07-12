import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { adminApi } from '../api/admin';
import type { AdminSummary, AuthUser, GiftCodeAdminRecord } from '../types';
import { formatCurrency, formatDate, formatTime } from '../utils/formatters';

export function AdminApp({ user }: { user: AuthUser }) {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [giftCodes, setGiftCodes] = useState<GiftCodeAdminRecord[]>([]);
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

  const load = useCallback(async () => {
    try {
      const [nextSummary, nextCodes] = await Promise.all([adminApi.summary(), adminApi.giftCodes()]);
      setSummary(nextSummary);
      setGiftCodes(nextCodes);
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
        <article><span>世界版本</span><strong>{summary?.worldVersion ?? '--'}</strong></article>
        <article><span>API 状态</span><strong>{summary?.apiStatus ?? '--'}</strong></article>
      </section>

      <section className="admin-grid">
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

        <article className="admin-panel admin-gift-list">
          <h2>礼品码记录</h2>
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>ID</th><th>奖励</th><th>兑换</th><th>状态</th><th>有效期</th><th>备注</th><th /></tr></thead>
              <tbody>
                {giftCodes.map((gift) => (
                  <tr key={gift.id}>
                    <td>#{gift.id}</td>
                    <td>¤ {formatCurrency(gift.reward_credits)}</td>
                    <td>{gift.redeemed_count}/{gift.max_redemptions}</td>
                    <td>{gift.enabled ? '启用' : '停用'}</td>
                    <td>{gift.expires_at ? formatDate(gift.expires_at) : '长期'}</td>
                    <td>{gift.note || '—'}</td>
                    <td><div className="admin-row-actions"><button type="button" onClick={() => void showRedemptions(gift.id)}>兑换记录</button>{gift.enabled ? <button type="button" className="danger" onClick={() => void disableGift(gift.id)}>停用</button> : null}</div></td>
                  </tr>
                ))}
                {giftCodes.length === 0 ? <tr><td colSpan={7}>暂无礼品码。</td></tr> : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {selectedGiftId !== null ? (
        <section className="admin-panel admin-redemptions">
          <h2>礼品码 #{selectedGiftId} 兑换记录</h2>
          <div className="admin-table-wrap">
            <table><thead><tr><th>玩家 ID</th><th>奖励</th><th>兑换时间</th></tr></thead><tbody>
              {redemptions.map((record) => <tr key={`${record.user_id}-${record.redeemed_at}`}><td>{record.user_id}</td><td>¤ {formatCurrency(record.reward_credits)}</td><td>{formatTime(record.redeemed_at)}</td></tr>)}
              {redemptions.length === 0 ? <tr><td colSpan={3}>暂无兑换记录。</td></tr> : null}
            </tbody></table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
