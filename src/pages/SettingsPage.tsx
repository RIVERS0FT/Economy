import { type ChangeEvent, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import {
  deleteGameSave,
  getSaveDeletionPreflight,
  resetGameStateDelivery,
  type SaveDeletionPreflight,
} from '../api/game';
import { clearTutorialRun, setPendingTutorialCompletion } from '../game-guide/tutorialStorage';
import { notificationStorageKey } from '../notifications/notificationCenter';
import { navigationBadgeStorageKey } from '../navigation/navigationBadges';
import { SelectInput, TextInput } from '../components/ui/FormControls';
import {
  Button,
  PageLayout,
  Panel,
  StatusTag,
  ToggleField,
  WidgetHeading,
} from '../components/ui/layout';
import { formatDate, formatNumber } from '../utils/formatters';

export function SettingsPage({ model }: { model: TutorialAwareGameViewModel }) {
  const {
    user,
    game,
    avatarText,
    playerName,
    setPlayerName,
    compactNumbers,
    setCompactNumbers,
    refreshRate,
    setRefreshRate,
    renamePlayer,
    redeemGift,
    showResult,
    signOut,
    tutorial,
  } = model;
  const [giftCode, setGiftCode] = useState('');
  const [saveDeletionPreflight, setSaveDeletionPreflight] = useState<SaveDeletionPreflight | null>(null);
  const [deletingSave, setDeletingSave] = useState(false);
  const roleLabel = user.role === 'admin' ? '管理员' : '普通用户';

  async function submitGift() {
    const code = giftCode.trim().toUpperCase();
    if (!code) return;
    const result = await redeemGift(code);
    model.notify(result.message);
    if (result.ok) setGiftCode('');
  }

  function restartTutorial() {
    const confirmed = window.confirm(
      '重新开始后，当前成长线进度会被清除。工作、建设、启动、生产、挂单、成交、研发、合同浏览、银行存款和排行榜浏览均需重新完成；游戏资产不会重置。',
    );
    if (confirmed) tutorial.restart();
  }

  function clearDeletedSaveClientState() {
    clearTutorialRun(user.id);
    setPendingTutorialCompletion(user.id, false);
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
          '该操作每个账号只能自行执行一次，且不可撤销。',
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
    <PageLayout title="设置" description="管理玩家资料、客户端偏好、经营成长线、礼品兑换和当前经济存档。">
      <div className="settings-layout">
        <div className="settings-primary-column">
          <Panel className="widget profile-settings-card">
            <WidgetHeading title="玩家资料" action={<StatusTag tone={user.role === 'admin' ? 'info' : 'neutral'}>{roleLabel}</StatusTag>} />
            <div className="profile-card">
              <div className="profile-avatar">{avatarText}</div>
              <div><strong>{game.playerName}</strong><span>{user.email}</span><small>注册于 {formatDate(game.registeredAt)}</small></div>
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
              <div><span>点击工作次数</span><strong>{formatNumber(game.stats.workClicks)}</strong></div>
              <div><span>生产商品总数</span><strong>{formatNumber(game.stats.producedGoods)}</strong></div>
              <div><span>买入商品总数</span><strong>{formatNumber(game.stats.boughtGoods)}</strong></div>
              <div><span>卖出商品总数</span><strong>{formatNumber(game.stats.soldGoods)}</strong></div>
            </div>
          </Panel>
        </div>

        <div className="settings-side-column">
          <Panel className="widget game-preferences-card">
            <WidgetHeading title="游戏设置" />
            <ToggleField
              label="紧凑数字"
              description="全局使用 K/M/B/T 缩写大额金额、库存、数量与容量"
              checked={compactNumbers}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setCompactNumbers(event.target.checked)}
            />
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
              aria-description="重新开始只清除本轮成长线进度，不会重置游戏资产。"
            >
              <div className="tutorial-settings-copy">
                <h3 id="tutorial-settings-heading">经营成长线</h3>
                <p>{tutorial.statusLabel}</p>
              </div>
              <div className="tutorial-settings-actions">
                {tutorial.isActive && !tutorial.isVisible ? (
                  <Button variant="secondary" onClick={tutorial.show}>显示经营成长线</Button>
                ) : null}
                <Button onClick={restartTutorial}>重新开始成长线</Button>
              </div>
            </section>
          </Panel>

          <Panel className="widget gift-redemption-card">
            <WidgetHeading title="礼品兑换" action={<StatusTag tone="info">游戏货币</StatusTag>} />
            <p>输入有效礼品码兑换游戏货币。同一账号对同一礼品只能兑换一次。</p>
            <TextInput
              label="礼品兑换码"
              value={giftCode}
              maxLength={64}
              autoComplete="off"
              placeholder="RIVER-XXXX-XXXX"
              onChange={(event) => setGiftCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitGift();
              }}
            />
            <Button block disabled={!giftCode.trim()} onClick={() => void submitGift()}>兑换礼品</Button>
          </Panel>

          <Panel className="widget account-management-card">
            <WidgetHeading title="账号与管理" />

            <section className="account-action-group" aria-labelledby="account-profile-heading">
              <h3 id="account-profile-heading">账号资料</h3>
              <a className="ui-link" href="https://riversoft.top/profile">前往主页修改账号资料</a>
            </section>

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
              <p>
                恢复为新玩家初始经济状态。普通货币、库存、工厂、研发、银行资产和经营统计将被清空；
                账号、注册时间、宝石、邀请码及领取和审计记录保留。
              </p>
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
                disabled={deletingSave || saveDeletionPreflight?.alreadyUsed === true}
                onClick={() => void requestSaveDeletion()}
              >
                {deletingSave ? '正在检查存档…' : '删除存档'}
              </Button>
            </section>

            <section className="account-action-group" aria-labelledby="current-session-heading">
              <h3 id="current-session-heading">当前会话</h3>
              <Button block variant="secondary" onClick={() => void signOut()}>退出登录</Button>
            </section>
          </Panel>
        </div>
      </div>
    </PageLayout>
  );
}
