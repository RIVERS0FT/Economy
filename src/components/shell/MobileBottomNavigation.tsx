import type { TabId } from '../../config/navigation';
import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';
import { ScrollArea } from '../ui/ScrollArea';
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
    <aside className="sidebar mobile-bottom-navigation" aria-label="移动端游戏导航">
      <LiquidGlassSurface variant="mobileNavigation">
        <nav className="mobile-navigation-frame" aria-label="游戏主导航">
          <ScrollArea
            axis="x"
            className="mobile-navigation-scroll-area"
            viewportClassName="sidebar-nav"
            horizontalVisibility="always"
          >
            <NavigationItems activeTab={activeTab} onSelect={onSelect} openOrderCount={openOrderCount} />
          </ScrollArea>
        </nav>
      </LiquidGlassSurface>
    </aside>
  );
}
