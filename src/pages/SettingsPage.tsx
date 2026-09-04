import { type ChangeEvent, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  deleteGameSave,
  getSaveDeletionPreflight,
  resetGameStateDelivery,
  updatePlayerAvatar,
  type SaveDeletionPreflight,
} from '../api/game';
import {
  clearTutorialRun,
  clearTutorialSkip,
  setPendingTutorialCompletion,
} from '../game-guide/tutorialStorage';
import { clearAutoSellPolicies } from '../auto-sell/autoSellStorage';
import { notificationStorageKey } from '../notifications/notificationCenter';
import { navigationBadgeStorageKey } from '../navigation/navigationBadges';
import { FileInput, SelectInput, TextInput } from '../components/ui/FormControls';
import { CompactNumber } from '../components/ui/CompactNumber';
import { PlayerAvatar } from '../components/ui/PlayerAvatar';
import {
  Button,
  PageLayout,
  Panel,
  StatusTag,
  WidgetHeading,
} from '../components/ui/layout';
import { formatDate } from '../utils/formatters';
import { announcePlayerAvatarUpdated, preparePlayerAvatar } from '../utils/playerAvatar';

export function SettingsPage({ model }: { model: TutorialAwareGameViewModel }) {
  const {
    user,
    game,
    playerName,
    setPlayerName,
    refreshRate,
    setRefreshRate,
    renamePlayer,
    showResult,
    signOut,
    tutorial,
  } = model;
  const [saveDeletionPreflight, setSaveDeletionPreflight] = useState<SaveDeletionPreflight | null>(null);
  const [deletingSave, setDeletingSave] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const roleLabel = user.role === 'admin' ? '管理员' : '普通用户';
  const facilityCount = Array.isArray(game.facilityGroups)
    ? game.facilityGroups.reduce((sum, group) => sum + group.count, 0)
    : 0;

  async function changePlayerAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || avatarUploading) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const avatarData = await preparePlayerAvatar(file);
      const response = await updatePlayerAvatar(avatarData);
      if (!response.result.ok) throw new Error(response.result.message);
      announcePlayerAvatarUpdated(user.id);
      model.notify(response.result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : '头像更新失败';
      setAvatarError(message);
      model.notify(message);
    } finally {
      input.value = '';
      setAvatarUploading(false);
    }
  }

  function restartTutorial() {
    const confirmed = window.confirm(
      '重新开始后，当前教程进度会被清除。建设、启动、生产、工厂自动经营设置、自动成交、研发、合同浏览、银行存款和排行榜浏览均需重新完成；游戏资产不会重置。',
    );
    if (confirmed) tutorial.restart();
  }

  function clearDeletedSaveClientState() {
    clearTutorialRun(user.id);
    clearTutorialSkip(user.id);
    setPendingTutorialCompletion(user.id, false);
    clearAutoSellPolicies(user.id);
    model.clearLocalTrades();
    try {
      window.localStorage.removeItem(notificationStorageKey(user.id));
      window.localStorage.removeItem(navigationBadgeStorageKey(user.id));
    } catch {
      // Browser-local history is optional and must not make an authoritative deletion look failed.
    }
    resetGameStateDelivery();
  }

  async function requestSaveDeletion() {
    if (deletingSave) return;
    setDeletingSave(true);
    try {
      const preflight = await getSaveDeletionPreflight();
      setSaveDeletionPreflight(preflight);
      if (!preflight.allowed) {
        model.notify(preflight.blockers.map((entry) => entry.message).join('；'));
        return;
      }

      const autoCloseCount = Object.values(preflight.autoClose)
        .reduce((sum, value) => sum + Number(value || 0), 0);
      const confirmed = window.confirm(
        [
          '删除后将恢复为新玩家初始经济状态：普通货币、库存、工厂、研发、银行资产和经营统计会被清空。',
          '统一账号、注册时间、宝石、邀请码、签到、礼品兑换、封禁和服务器审计记录会保留。',
          autoCloseCount > 0 ? `服务器将先自动关闭 ${autoCloseCount} 个可安全取消的订单、挂牌、拍卖或合同。` : '',
          '删除后当前经济存档无法恢复，操作完成后将创建新的经济存档。',
        ].filter(Boolean).join('\n\n'),
      );
      if (!confirmed) return;

      const confirmation = window.prompt('请输入“删除存档”确认永久删除当前经济存档。');
      if (confirmation !== '删除存档') {
        model.notify('确认文字不匹配，未删除存档');
        return;
      }

      const response = await deleteGameSave(confirmation);
      clearDeletedSaveClientState();
      model.notify(response.result.message);
      window.location.assign('/economy/');
    } catch (error) {
      model.notify(error instanceof Error ? error.message : '删除存档失败');
    } finally {
      setDeletingSave(false);
    }
  }

  return (
    <PageLayout title="设置" description="管理玩家资料、客户端偏好、教程和当前经济存档。">
      <div className="settings-layout">
        <Panel className="widget profile-settings-card">
          <WidgetHeading title="玩家资料" action={<StatusTag tone={user.role === 'admin' ? 'info' : 'neutral'}>{roleLabel}</StatusTag>} />
          <div className="profile-card">
            <PlayerAvatar userId={user.id} playerName={game.playerName || user.email} size={64} className="profile-avatar" />
            <div><strong>{game.playerName}</strong><span>{user.email}</span><small>注册于 {formatDate(game.registeredAt)}</small></div>
          </div>

          <div className="avatar-editor">
            <FileInput
              label="玩家头像"
              accept="image/jpeg,image/png,image/webp"
              disabled={avatarUploading}
              error={avatarError || undefined}
              description={avatarUploading
                ? '正在本地裁剪并压缩头像…'
                : undefined}
              onChange={(event) => void changePlayerAvatar(event)}
            />
          </div>

          <div className="nickname-editor">
            <TextInput
              label="玩家昵称"
              value={playerName}
              maxLength={32}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setPlayerName(event.target.value)}
            />
            <Button onClick={() => void showResult(renamePlayer(playerName))}>保存昵称</Button>
          </div>

          <div className="player-stat-grid" aria-label="玩家累计统计">
            <div><span>持有工厂总数</span><strong><CompactNumber value={facilityCount} /></strong></div>
            <div><span>生产商品总数</span><strong><CompactNumber value={game.stats.producedGoods} /></strong></div>
            <div><span>买入商品总数</span><strong><CompactNumber value={game.stats.boughtGoods} /></strong></div>
            <div><span>卖出商品总数</span><strong><CompactNumber value={game.stats.soldGoods} /></strong></div>
          </div>
        </Panel>

        <Panel className="widget game-preferences-card">
          <WidgetHeading title="游戏设置" />
          <SelectInput
            label="状态刷新频率"
            value={refreshRate}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => setRefreshRate(event.target.value)}
          >
            <option value="3">每 3s</option>
            <option value="5">每 5s</option>
            <option value="10">每 10s</option>
          </SelectInput>

          <section
            className="tutorial-settings-section"
            aria-labelledby="tutorial-settings-heading"
            aria-description="重新开始只清除本轮教程进度，不会重置游戏资产。"
          >
            <div className="tutorial-settings-copy">
              <h3 id="tutorial-settings-heading">教程</h3>
              {tutorial.statusLabel ? <p>{tutorial.statusLabel}</p> : null}
            </div>
            <div className="tutorial-settings-actions">
              <Button onClick={restartTutorial}>重新开始教程</Button>
            </div>
          </section>
        </Panel>

        <Panel className="widget account-management-card">
          <WidgetHeading title="账号与管理" />

          {user.role === 'admin' ? (
            <section className="account-action-group" aria-labelledby="administrator-tools-heading">
              <h3 id="administrator-tools-heading">管理员工具</h3>
              <div className="account-action-links">
                <a className="ui-link" href="/economy/admin">进入管理员后台</a>
              </div>
            </section>
          ) : null}

          <section className="account-action-group save-deletion-group" aria-labelledby="save-deletion-heading">
            <div className="save-deletion-heading">
              <h3 id="save-deletion-heading">存档管理</h3>
              <StatusTag tone="danger">不可撤销</StatusTag>
            </div>
            {saveDeletionPreflight?.blockers.length ? (
              <ul className="save-deletion-blockers" aria-label="删除存档阻止事项">
                {saveDeletionPreflight.blockers.map((entry) => (
                  <li key={`${entry.type}-${entry.message}`}>{entry.message}</li>
                ))}
              </ul>
            ) : null}
            <Button
              block
              variant="danger"
              disabled={deletingSave}
              onClick={() => void requestSaveDeletion()}
            >
              {deletingSave ? '正在检查存档…' : '删除存档'}
            </Button>
          </section>

          <section className="account-action-group" aria-label="退出登录">
            <Button block variant="secondary" onClick={() => void signOut()}>退出登录</Button>
          </section>
        </Panel>
      </div>
    </PageLayout>
  );
}
