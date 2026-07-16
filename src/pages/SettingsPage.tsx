import { type ChangeEvent, useState } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import {
  Button,
  PageLayout,
  Panel,
  StatusTag,
  ToggleField,
  WidgetHeading,
} from '../components/ui/layout';
import { formatDate, formatNumber } from '../utils/formatters';

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
    redeemGift,
    showResult,
    signOut,
    reset,
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

  return (
    <PageLayout title="设置" description="管理玩家资料、客户端偏好和礼品兑换。">
      <div className="settings-grid unified-settings-grid">
        <Panel className="widget profile-settings-card span-2">
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

          <div className="player-stat-grid" aria-label="玩家累计统计">
            <div><span>点击工作次数</span><strong>{formatNumber(game.stats.workClicks)}</strong></div>
            <div><span>生产商品总数</span><strong>{formatNumber(game.stats.producedGoods)}</strong></div>
            <div><span>买入商品总数</span><strong>{formatNumber(game.stats.boughtGoods)}</strong></div>
            <div><span>卖出商品总数</span><strong>{formatNumber(game.stats.soldGoods)}</strong></div>
          </div>

          <div className="profile-action-stack">
            <a className="ui-link" href="https://riversoft.top/profile">前往主页修改账号资料</a>
            {user.role === 'admin' ? <a className="ui-link" href="/economy/admin">进入管理员后台</a> : null}
            <Button block variant="secondary" onClick={() => void signOut()}>退出登录</Button>
            <Button
              block
              variant="danger"
              onClick={() => {
                if (window.confirm('确认重置当前账号的金融帝国服务器数据？统计、订单和工厂也会清空。')) void showResult(reset());
              }}
            >重置经济状态</Button>
          </div>
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
            description="全局使用 K/M/B/T 缩写大额金额、库存、数量与容量"
            checked={compactNumbers}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCompactNumbers(event.target.checked)}
          />
          <label>
            状态刷新频率
            <select value={refreshRate} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRefreshRate(event.target.value)}>
              <option value="3">每 3s</option>
              <option value="5">每 5s</option>
              <option value="10">每 10s</option>
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

        <Panel className="widget gift-redemption-card">
          <WidgetHeading title="礼品兑换" action={<StatusTag tone="info">游戏货币</StatusTag>} />
          <p>输入有效礼品码兑换游戏货币。同一账号对同一礼品只能兑换一次。</p>
          <label>
            礼品兑换码
            <input
              value={giftCode}
              maxLength={64}
              autoComplete="off"
              placeholder="RIVER-XXXX-XXXX"
              onChange={(event) => setGiftCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitGift();
              }}
            />
          </label>
          <Button block disabled={!giftCode.trim()} onClick={() => void submitGift()}>兑换礼品</Button>
        </Panel>
      </div>
    </PageLayout>
  );
}
