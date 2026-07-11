import { Button } from '../ui/layout';
import { BRAND_LOGO_URL, BRAND_NAME } from '../../config/brand';
import type { TabId } from '../../config/navigation';
import { NavigationItems } from './NavigationItems';

export function DesktopSidebar({
  playerName,
  activeTab,
  openOrderCount,
  onSelect,
  onSignOut,
}: {
  playerName: string;
  activeTab: TabId;
  openOrderCount: number;
  onSelect: (tab: TabId) => void;
  onSignOut: () => void;
}) {
  const displayName = playerName.trim() || '玩家';

  return (
    <aside className="sidebar desktop-sidebar panel">
      <div className="sidebar-brand">
        <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
        <div>
          <strong>{BRAND_NAME}</strong>
          <span title={displayName}>{displayName}</span>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="游戏主导航">
        <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
      </nav>

      <div className="sidebar-footer">
        <div className="connection-state">
          <span className="status-dot" />
          <div><strong>市场在线</strong><small>服务器权威经济</small></div>
        </div>
        <Button block variant="secondary" className="sidebar-logout" onClick={onSignOut}>退出登录</Button>
      </div>
    </aside>
  );
}