import type { TabId } from '../../config/navigation';
import { NavigationItems } from './NavigationItems';

export function MobileBottomNavigation({
  activeTab,
  openOrderCount,
  onSelect,
}: {
  activeTab: TabId;
  openOrderCount: number;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <aside className="sidebar mobile-bottom-navigation panel" aria-label="移动端游戏导航">
      <nav className="sidebar-nav" aria-label="游戏主导航">
        <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
      </nav>
    </aside>
  );
}
