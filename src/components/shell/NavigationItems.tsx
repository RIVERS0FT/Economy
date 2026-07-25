import { NavigationIcon } from '../icons/GameIcons';
import { navigationItems, type TabId } from '../../config/navigation';
import { formatNavigationBadgeCount, type NavigationBadgeMap } from '../../navigation/navigationBadges';

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
        const navigationBadge = badges[id];
        const accessibleLabel = navigationBadge
          ? `${label}，${navigationBadge.accessibleLabel}`
          : label;

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
            {navigationBadge ? (
              <small className="navigation-badge" title={navigationBadge.title}>
                {formatNavigationBadgeCount(navigationBadge.count)}
              </small>
            ) : null}
          </button>
        );
      })}
    </>
  );
}
