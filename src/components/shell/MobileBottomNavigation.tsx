import type { TabId } from '../../config/navigation';
import { NavigationItems } from './NavigationItems';
import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame';

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
    <MobileBottomNavigationFrame
      ariaLabel="移动端游戏导航"
      navLabel="游戏主导航"
      surfaceId="game-mobile-navigation"
    >
      <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
    </MobileBottomNavigationFrame>
  );
}
