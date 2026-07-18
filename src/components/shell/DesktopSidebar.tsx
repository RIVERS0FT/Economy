import { Button } from '../ui/layout';
import { BRAND_LOGO_URL, BRAND_NAME } from '../../config/brand';
import type { TabId } from '../../config/navigation';
import { LogoutIcon, QqIcon } from '../icons/GameIcons';
import { NavigationItems } from './NavigationItems';

export function DesktopSidebar({
  playerName,
  activeTab,
  openOrderCount,
  collapsed,
  qqGroupUrl,
  onToggleCollapsed,
  onSelect,
  onSignOut,
}: {
  playerName: string;
  activeTab: TabId;
  openOrderCount: number;
  collapsed: boolean;
  qqGroupUrl: string;
  onToggleCollapsed: () => void;
  onSelect: (tab: TabId) => void;
  onSignOut: () => void;
}) {
  const displayName = playerName.trim() || '玩家';

  return (
    <aside className="sidebar desktop-sidebar panel" data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="sidebar-brand">
        {collapsed ? (
          <button
            type="button"
            className="sidebar-logo-expand-button"
            aria-label="展开侧栏"
            aria-expanded="false"
            onClick={onToggleCollapsed}
          >
            <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
            <span className="sidebar-logo-expand-icon" aria-hidden="true" />
          </button>
        ) : (
          <>
            <img src={BRAND_LOGO_URL} alt="" aria-hidden="true" />
            <div>
              <strong>{BRAND_NAME}</strong>
              <span title={displayName}>{displayName}</span>
            </div>
            <button
              type="button"
              className="sidebar-collapse-button"
              aria-label="折叠侧栏"
              aria-expanded="true"
              onClick={onToggleCollapsed}
            >
              <span aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      <nav className="sidebar-nav" aria-label="游戏主导航">
        <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
      </nav>

      <div className="sidebar-footer">
        <a
          className="ui-button ui-button--secondary ui-button--block sidebar-community-link"
          href={qqGroupUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="加入 QQ 群（在新窗口打开）"
        >
          <QqIcon className="sidebar-community-icon" />
          <strong>加入 QQ 群</strong>
        </a>
        <Button block variant="secondary" className="sidebar-logout" aria-label="退出登录" onClick={onSignOut}>
          <LogoutIcon className="sidebar-logout-icon" />
          <strong>退出登录</strong>
        </Button>
      </div>
    </aside>
  );
}
