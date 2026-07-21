import { type ChangeEvent, useState } from 'react';
import type { TutorialAwareGameViewModel } from '../game-guide/useGameTutorial';
import { InvitationSettings } from '../components/InvitationSettings';
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
      '重新开始后，当前教程进度会被清除。工作、建设、启动、生产、挂单和成交均需重新完成；游戏资产不会重置。',
    );
    if (confirmed) tutorial.restart();
  }

  return (
    <PageLayout title="设置" description="管理玩家资料、客户端偏好、基础教程、邀请和礼品兑换。">
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

          <InvitationSettings />
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
              aria-description="重新开始只清除本轮教程进度，不会重置游戏资产。"
            >
              <div className="tutorial-settings-copy">
                <h3 id="tutorial-settings-heading">基础教程</h3>
                <p>{tutorial.statusLabel}</p>
              </div>
              <div className="tutorial-settings-actions">
                {tutorial.isActive && !tutorial.isVisible ? (
                  <Button variant="secondary" onClick={tutorial.show}>显示基础教程</Button>
                ) : null}
                <Button onClick={restartTutorial}>重新开始教程</Button>
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
