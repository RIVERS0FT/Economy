import {
  formatNavigationBadgeCount,
  type NavigationBadge as NavigationBadgeValue,
} from '../../navigation/navigationBadges';

export function NavigationBadge({ badge }: { badge: NavigationBadgeValue }) {
  if (badge.count < 1) return null;
  return (
    <small className="navigation-badge" title={badge.title} aria-hidden="true">
      {formatNavigationBadgeCount(badge.count)}
    </small>
  );
}
