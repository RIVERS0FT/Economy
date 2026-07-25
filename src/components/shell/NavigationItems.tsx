import { NavigationIcon } from '../icons/GameIcons';
import { navigationItems, type TabId } from '../../config/navigation';
import type { NavigationBadgeMap } from '../../navigation/navigationBadges';
import { NavigationBadge } from '../ui/NavigationBadge';

export function NavigationItems({
  activeTab,
  onSelect,
  badges,
}: {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  badges: NavigationBadgeMap;
}) {
  return (
    <>
      {navigationItems.map(({ id, label }) => {
        const badge = badges[id];
        const accessibleLabel = badge ? `${label}，${badge.accessibleLabel}` : label;

        return (
          <button
            key={id}
            type="button"
            aria-label={accessibleLabel}
            aria-current={activeTab === id ? 'page' : undefined}
            className={activeTab === id ? 'sidebar-nav-button active' : 'sidebar-nav-button'}
            onClick={() => onSelect(id)}
          >
            <span aria-hidden="true"><NavigationIcon name={id} /></span>
            <strong>{label}</strong>
            {badge ? <NavigationBadge badge={badge} /> : null}
          </button>
        );
      })}
    </>
  );
}
