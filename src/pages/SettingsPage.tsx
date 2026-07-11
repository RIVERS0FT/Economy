import type { ChangeEvent } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  Button,
  PageLayout,
  Panel,
  StatusTag,
  ToggleField,
  WidgetHeading,
} from '../components/ui/layout';
import { formatDate } from '../utils/formatters';

export function SettingsPage({ model }: { model: LoadedGameViewModel }) {
  const {
    user,
    game,
    avatarText,
    playerName,
    setPlayerName,
    soundEnabled,
    setSoundEnabled,
    compactNumbers,
    setCompactNumbers,
    refreshRate,
    setRefreshRate,
    renamePlayer,
    showResult,
    signOut,
    reset,
  } = model;
  const roleLabel = user.role === 'admin' ? '管理员' : '普通用户';

  return (
    <PageLayout
      title="设置"
      description="管理玩家资料、客户端偏好、登录会话和服务器经济状态。"
    >
      <div className="settings-grid">
        <Panel className="widget">
          <WidgetHeading title="玩家资料" action={<StatusTag tone={user.role === 'admin' ? 'info' : 'neutral'}>{roleLabel}</StatusTag>} />
          <div className="profile-card">
            <div className="profile-avatar">{avatarText}</div>
            <div><strong>{game.playerName}</strong><span>{user.email}</span><small>注册于 {formatDate(game.registeredAt)}</small></div>
          </div>
          <label>
            玩家昵称
            <input value={playerName} maxLength={32} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlayerName(event.target.value)} />
          </label>
          <Button block onClick={() => void showResult(renamePlayer(playerName))}>保存玩家昵称</Button>
          <a className="ui-link" href="https://riversoft.top/profile">前往主页修改账号资料</a>
        </Panel>

        <Panel className="widget">
          <WidgetHeading title="游戏设置" />
          <ToggleField
            label="界面音效"
            description="订单成交与生产完成提示"
            checked={soundEnabled}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setSoundEnabled(event.target.checked)}
          />
          <ToggleField
            label="紧凑数字"
            description="使用万和百万单位缩写大额资产"
            checked={compactNumbers}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCompactNumbers(event.target.checked)}
          />
          <label>
            市场刷新频率
            <select value={refreshRate} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRefreshRate(event.target.value)}>
              <option value="1">每 1 秒</option>
              <option value="3">每 3 秒</option>
              <option value="5">每 5 秒</option>
            </select>
          </label>
          <label>
            画面性能
            <select defaultValue="balanced">
              <option value="quality">高质量</option>
              <option value="balanced">平衡</option>
              <option value="performance">高性能</option>
            </select>
          </label>
        </Panel>

        <Panel className="widget session-card">
          <WidgetHeading title="登录会话" />
          <p>退出只会结束当前浏览器的登录会话，不会删除服务器经济状态或当前浏览器的本地活动记录。</p>
          <Button block variant="secondary" onClick={() => void signOut()}>退出登录</Button>
        </Panel>

        <Panel className="widget danger-zone span-3">
          <div>
            <h2>重置服务器经济状态</h2>
            <p>重置会删除当前玩家的资金、商品、仓库等级、工厂、生产计划、订单与挂牌，但不会影响主页账号或当前浏览器的本地日志。</p>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('确认重置当前账号的金融帝国服务器数据？')) void showResult(reset());
            }}
          >
            重置经济状态
          </Button>
        </Panel>
      </div>
    </PageLayout>
  );
}
