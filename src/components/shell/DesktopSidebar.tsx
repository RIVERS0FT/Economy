import { BRAND_LOGO_URL, BRAND_NAME } from '../../config/brand';
import type { TabId } from '../../config/navigation';
import type { AuthUser } from '../../types';
import { NavigationItems } from './NavigationItems';

export function DesktopSidebar({
  user,
  playerName,
  rank,
  activeTab,
  openOrderCount,
  onSelect,
  onSignOut,
}: {
  user: AuthUser;
  playerName: string;
  rank?: number;
  activeTab: TabId;
  openOrderCount: number;
  onSelect: (tab: TabId) => void;
  onSignOut: () => void;
}) {
  const avatarText = (playerName || user.email).slice(0, 1).toUpperCase();

  return (
    <aside className="sidebar desktop-sidebar panel">
      <div className="sidebar-brand">
        <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
        <div><strong>{BRAND_NAME}</strong><span>市场交易版</span></div>
      </div>

      <div className="player-mini-card">
        <div className="player-avatar">{user.avatar ? <img src={user.avatar} alt="" /> : avatarText}</div>
        <div><strong>{playerName}</strong><span>排名 #{rank ?? '--'} · 玩家</span></div>
      </div>

      <nav className="sidebar-nav" aria-label="游戏主导航">
        <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
      </nav>

      <div className="sidebar-footer">
        <div className="connection-state">
          <span className="status-dot" />
          <div><strong>市场在线</strong><small>本地多人规则预览</small></div>
        </div>
        <button type="button" className="ghost-button sidebar-logout" onClick={onSignOut}>退出登录</button>
      </div>
    </aside>
  );
}
