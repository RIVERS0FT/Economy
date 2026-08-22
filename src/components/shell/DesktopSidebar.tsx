import { Button } from '../ui/layout';
import type { TabId } from '../../config/navigation';
import type { NavigationBadgeMap } from '../../navigation/navigationBadges';
import { QqIcon, SettingsIcon } from '../icons/GameIcons';
import { NavigationItems } from './NavigationItems';
import { SidebarFrame } from './SidebarFrame';

export function DesktopSidebar({
  activeTab,
  badges,
  collapsed,
  qqGroupUrl,
  onToggleCollapsed,
  onSelect,
}: {
  activeTab: TabId;
  badges: NavigationBadgeMap;
  collapsed: boolean;
  qqGroupUrl: string;
  onToggleCollapsed: () => void;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <SidebarFrame
      title="游戏导航"
      subtitle=""
      navLabel="游戏主导航"
      collapsed={collapsed}
      onToggleCollapsed={onToggleCollapsed}
      showIdentity={false}
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
          <Button
            variant="secondary"
            className="sidebar-settings sidebar-footer-action"
            aria-label="设置"
            aria-current={activeTab === 'settings' ? 'page' : undefined}
            onClick={() => onSelect('settings')}
          >
            <SettingsIcon className="sidebar-settings-icon" />
            <strong>设置</strong>
          </Button>
        </>
      )}
    >
      <NavigationItems
        activeTab={activeTab}
        onSelect={onSelect}
        badges={badges}
        excludedTabs={['settings']}
        showBadges={false}
      />
    </SidebarFrame>
  );
}
