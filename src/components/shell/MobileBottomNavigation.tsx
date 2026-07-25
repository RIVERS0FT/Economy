import type { TabId } from '../../config/navigation';
import type { NavigationBadgeMap } from '../../navigation/navigationBadges';
import { NavigationItems } from './NavigationItems';
import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame';

/* MobileBottomNavigationFrame owns the stable mobile chrome contract:
 * className="sidebar mobile-bottom-navigation"
 * <LiquidGlassSurface variant="mobileNavigation">
 * className="mobile-bottom-navigation__viewport"
 */
export function MobileBottomNavigation({
  activeTab,
  badges,
  onSelect,
}: {
  activeTab: TabId;
  badges: NavigationBadgeMap;
  onSelect: (tab: TabId) => void;
}) {
  return (
    <MobileBottomNavigationFrame
      ariaLabel="移动端游戏导航"
      navLabel="游戏主导航"
      surfaceId="game-mobile-navigation"
    >
      <NavigationItems activeTab={activeTab} onSelect={onSelect} badges={badges} />
    </MobileBottomNavigationFrame>
  );
}
