import { GiftIcon, HomeIcon, QqIcon, ShieldIcon } from '../icons/GameIcons';
import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame';
import { SidebarFrame } from './SidebarFrame';

export type AdminSectionId = 'overview' | 'community' | 'gift-codes' | 'bans';

export const adminNavigationItems: Array<{
  id: AdminSectionId;
  label: string;
  icon: typeof HomeIcon;
}> = [
  { id: 'overview', label: '概况', icon: HomeIcon },
  { id: 'community', label: '社区', icon: QqIcon },
  { id: 'gift-codes', label: '礼品码', icon: GiftIcon },
  { id: 'bans', label: '账号封禁', icon: ShieldIcon },
];

function AdminNavigationItems({
  activeSection,
  onSelect,
}: {
  activeSection: AdminSectionId;
  onSelect: (section: AdminSectionId) => void;
}) {
  return adminNavigationItems.map(({ id, label, icon: Icon }) => (
    <button
      key={id}
      type="button"
      aria-label={label}
      aria-current={activeSection === id ? 'page' : undefined}
      className={activeSection === id ? 'sidebar-nav-button active' : 'sidebar-nav-button'}
      onClick={() => onSelect(id)}
    >
      <span aria-hidden="true"><Icon /></span>
      <strong>{label}</strong>
    </button>
  ));
}

export function AdminSidebar({
  email,
  activeSection,
  collapsed,
  onToggleCollapsed,
  onSelect,
}: {
  email: string;
  activeSection: AdminSectionId;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onSelect: (section: AdminSectionId) => void;
}) {
  return (
    <SidebarFrame
      title="管理员后台"
      subtitle={email}
      navLabel="管理员导航"
      collapsed={collapsed}
      className="admin-sidebar"
      onToggleCollapsed={onToggleCollapsed}
      footer={(
        <a className="ui-button ui-button--secondary sidebar-footer-action" href="/economy/" aria-label="返回游戏">
          <HomeIcon className="sidebar-footer-icon" />
          <strong>返回游戏</strong>
        </a>
      )}
    >
      <AdminNavigationItems activeSection={activeSection} onSelect={onSelect} />
    </SidebarFrame>
  );
}

export function AdminMobileNavigation({
  activeSection,
  onSelect,
}: {
  activeSection: AdminSectionId;
  onSelect: (section: AdminSectionId) => void;
}) {
  return (
    <MobileBottomNavigationFrame
      ariaLabel="移动端管理员导航"
      navLabel="管理员移动导航"
      className="admin-mobile-bottom-navigation"
      surfaceId="admin-mobile-navigation"
    >
      <AdminNavigationItems activeSection={activeSection} onSelect={onSelect} />
    </MobileBottomNavigationFrame>
  );
}
