import { Button } from '../ui/layout';
import { BRAND_NAME } from '../../config/brand';
import type { TabId } from '../../config/navigation';
import { LogoutIcon, QqIcon } from '../icons/GameIcons';
import { NavigationItems } from './NavigationItems';
import { SidebarFrame } from './SidebarFrame';

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
    <SidebarFrame
      title={BRAND_NAME}
      subtitle={displayName}
      navLabel="游戏主导航"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      footer={(
        <>
          <a
            className="ui-button ui-button--secondary sidebar-community-link sidebar-footer-action"
            href={qqGroupUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="加入 QQ 群（在新窗口打开）"
          >
            <QqIcon className="sidebar-community-icon" />
            <strong>加入 QQ 群</strong>
          </a>
          <Button variant="secondary" className="sidebar-logout sidebar-footer-action" aria-label="退出登录" onClick={onSignOut}>
            <LogoutIcon className="sidebar-logout-icon" />
            <strong>退出登录</strong>
          </Button>
        </>
      )}
    >
      <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
    </SidebarFrame>
  );
}
