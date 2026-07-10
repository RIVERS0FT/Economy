import type { ChangeEvent } from 'react';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { PageLayout, Panel } from '../components/ui/layout';
import { formatDate } from '../utils/formatters';

export function SettingsPage({ model }: { model: LoadedGameViewModel }) {
  const {
    user,
    game,
    derived,
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
    notify,
    signOut,
    reset,
  } = model;

  return (
    <PageLayout
      eyebrow="Preferences"
      title="设置"
      description="管理玩家资料、显示偏好和本地预览数据。"
    >
      <div className="settings-grid">
        <Panel className="widget">
          <p className="eyebrow">Player profile</p><h2>玩家资料</h2>
          <div className="profile-card"><div className="profile-avatar">{avatarText}</div><div><strong>{game.playerName}</strong><span>{user.email}</span><small>注册于 {formatDate(game.registeredAt)}</small></div></div>
          <label>玩家昵称<input value={playerName} maxLength={32} onChange={(event: ChangeEvent<HTMLInputElement>) => setPlayerName(event.target.value)} /></label>
          <button onClick={() => { renamePlayer(playerName); notify('玩家昵称已更新'); }}>保存玩家昵称</button>
          <a className="link-button" href="https://riversoft.top/profile">前往主页修改账号资料</a>
        </Panel>

        <Panel className="widget">
          <p className="eyebrow">Game settings</p><h2>游戏设置</h2>
          <div className="setting-row"><div><strong>界面音效</strong><span>订单成交与生产完成提示</span></div><input className="toggle-input" type="checkbox" checked={soundEnabled} onChange={(event) => setSoundEnabled(event.target.checked)} /></div>
          <div className="setting-row"><div><strong>紧凑数字</strong><span>使用 K / M 缩写显示大额资产</span></div><input className="toggle-input" type="checkbox" checked={compactNumbers} onChange={(event) => setCompactNumbers(event.target.checked)} /></div>
          <label>市场刷新频率<select value={refreshRate} onChange={(event) => setRefreshRate(event.target.value)}><option value="1">每 1 秒</option><option value="3">每 3 秒</option><option value="5">每 5 秒</option></select></label>
          <label>画面性能<select defaultValue="balanced"><option value="quality">高质量</option><option value="balanced">平衡</option><option value="performance">高性能</option></select></label>
        </Panel>

        <Panel className="widget account-summary">
          <p className="eyebrow">Account status</p><h2>账号与资产</h2>
          <dl className="detail-list"><div><dt>账号 ID</dt><dd>{user.id}</dd></div><div><dt>账号角色</dt><dd>{user.role || 'user'}</dd></div><div><dt>设施槽位</dt><dd>{game.facilitySlots}</dd></div><div><dt>库存容量</dt><dd>{game.inventoryCapacity}</dd></div><div><dt>当前排名</dt><dd>#{derived.currentRank?.rank ?? '--'}</dd></div></dl>
          <button className="ghost-button" onClick={() => void signOut()}>退出登录</button>
        </Panel>

        <Panel className="widget danger-zone span-3">
          <div><p className="eyebrow">Preview data</p><h2>重置本地经济状态</h2><p>当前版本使用浏览器本地数据预览多人经济规则。重置不会影响你的主页账号。</p></div>
          <button className="danger-button" onClick={() => { if (window.confirm('确认重置当前账号的金融帝国预览状态？')) reset(user); }}>重置经济状态</button>
        </Panel>
      </div>
    </PageLayout>
  );
}
