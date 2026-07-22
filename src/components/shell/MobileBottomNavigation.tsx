import type { TabId } from '../../config/navigation';
import { NavigationItems } from './NavigationItems';
import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame';

/* MobileBottomNavigationFrame owns the stable mobile chrome contract:
 * className="sidebar mobile-bottom-navigation"
 * <LiquidGlassSurface variant="mobileNavigation">
 * className="mobile-bottom-navigation__viewport"
 */
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
