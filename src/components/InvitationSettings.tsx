import { useEffect, useState } from 'react';
import { claimInvitation, getInvitationSummary, type InvitationSummary } from '../api/invitations';
import { formatDate, formatNumber } from '../utils/formatters';
import { TextInput } from './ui/FormControls';
import { Button, Panel, StatusTag, WidgetHeading } from './ui/layout';

function sourceLabel(source: 'share_link' | 'manual_code') {
  return source === 'share_link' ? '分享链接' : '手动邀请码';
}

function statusLabel(status: string) {
  if (status === 'rewarded') return '已奖励';
  if (status === 'blocked_same_ip') return '同网络不奖励';
  if (status === 'blocked_banned_account') return '封禁账号不奖励';
  return '已撤销';
}

export function InvitationSettings() {
  const [summary, setSummary] = useState<InvitationSummary | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  async function load() {
    try {
      setSummary(await getInvitationSummary());
      setStatus('');
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : '无法读取邀请信息');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function copyText(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setStatus(success);
    } catch {
      setStatus('无法自动复制，请手动选择并复制');
    }
  }

  async function share() {
    if (!summary) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Economy',
          text: `一起来经营你的经济帝国。完成注册后，分享者可获得 ${summary.rewardGems} 宝石。`,
          url: summary.shareUrl,
        });
        setStatus('分享链接已发送');
        return;
      }
      await copyText(summary.shareUrl, '分享链接已复制');
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setStatus('无法分享邀请链接');
    }
  }

  async function claim() {
    const normalized = inviteCode.trim().toUpperCase();
    if (!normalized || claiming) return;
    setClaiming(true);
    try {
      const result = await claimInvitation(normalized);
      setInviteCode('');
      setStatus(result.message);
      await load();
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : '邀请码绑定失败');
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Panel className="widget invite-card">
      <WidgetHeading
        title="邀请好友"
        action={<StatusTag tone="info">宝石 {loading ? '--' : formatNumber(summary?.gems ?? 0)}</StatusTag>}
      />
      {summary ? (
        <>
          <p>好友通过分享链接完成注册，或在注册后填写你的邀请码，你将立即获得 {summary.rewardGems} 宝石。</p>
          <div className="invite-link-grid">
            <TextInput
              label="分享链接"
              value={summary.shareUrl}
              readOnly
              aria-label="Economy 专属分享链接"
            />
            <div className="invite-action-row">
              <Button onClick={() => void share()}>分享链接</Button>
              <Button variant="secondary" onClick={() => void copyText(summary.shareUrl, '分享链接已复制')}>复制链接</Button>
            </div>
            <TextInput
              label="我的邀请码"
              value={summary.inviteCode}
              readOnly
              aria-label="我的邀请码"
            />
            <Button variant="secondary" onClick={() => void copyText(summary.inviteCode, '邀请码已复制')}>复制邀请码</Button>
          </div>

          <div className="player-stat-grid invitation-stat-grid" aria-label="邀请统计">
            <div><span>成功邀请</span><strong>{formatNumber(summary.successfulInvitations)}</strong></div>
            <div><span>分享链接</span><strong>{formatNumber(summary.shareLinkInvitations)}</strong></div>
            <div><span>手动邀请码</span><strong>{formatNumber(summary.manualCodeInvitations)}</strong></div>
            <div><span>累计宝石</span><strong>{formatNumber(summary.invitationGemsEarned)}</strong></div>
          </div>

          {summary.claimedInvitation ? (
            <div className="manual-invite-claim invitation-bound-state">
              <TextInput
                label="已填写的邀请码"
                value={summary.claimedInvitation.inviteCode}
                disabled
                aria-label="已填写的邀请码"
              />
              <strong>邀请关系已绑定，邀请码不可修改</strong>
              <span>邀请人：{summary.claimedInvitation.inviterName}</span>
              <span>来源：{sourceLabel(summary.claimedInvitation.source)}</span>
              <span>状态：{statusLabel(summary.claimedInvitation.status)}</span>
              <small>{formatDate(summary.claimedInvitation.claimedAt)}</small>
            </div>
          ) : (
            <div className="manual-invite-claim">
              <TextInput
                label="填写好友邀请码"
                value={inviteCode}
                maxLength={8}
                autoComplete="off"
                placeholder="8 位邀请码"
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => { if (event.key === 'Enter') void claim(); }}
              />
              <p>注册时可以直接填写邀请码；未填写的账号仍可在首次创建 Economy 玩家档案后的 24 小时内填写一次。</p>
              <Button disabled={!inviteCode.trim() || claiming} onClick={() => void claim()}>
                {claiming ? '正在绑定…' : '确认填写'}
              </Button>
            </div>
          )}

          {summary.recentInvitations.length > 0 ? (
            <div className="recent-invitations">
              <h3>最近邀请</h3>
              {summary.recentInvitations.map((record) => (
                <div key={`${record.playerName}-${record.claimedAt}`}>
                  <span>{record.playerName}</span>
                  <span>{sourceLabel(record.source)}</span>
                  <span>{statusLabel(record.status)}</span>
                  <small>{formatDate(record.claimedAt)}</small>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : <p>{loading ? '正在读取邀请信息…' : '邀请信息暂时不可用'}</p>}
      {status ? <small role="status">{status}</small> : null}
    </Panel>
  );
}
