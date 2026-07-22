import { NavigationIcon } from '../icons/GameIcons';
import { navigationItems, type TabId } from '../../config/navigation';
import { formatNumber } from '../../utils/formatters';

const MAX_SIDEBAR_BADGE_COUNT = 999;

export function NavigationItems({
  activeTab,
  onSelect,
  openOrderCount,
}: {
  activeTab: TabId;
  onSelect: (tab: TabId) => void;
  openOrderCount: number;
}) {
  return (
    <>
      {navigationItems.map(({ id, label }) => {
        const hasOpenOrders = id === 'market' && openOrderCount > 0;
        const badgeText = openOrderCount > MAX_SIDEBAR_BADGE_COUNT
          ? `${MAX_SIDEBAR_BADGE_COUNT}+`
          : formatNumber(openOrderCount);
        const accessibleLabel = hasOpenOrders
          ? `${label}，${formatNumber(openOrderCount)} 笔未完成订单`
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
            {hasOpenOrders ? (
              <small className="sidebar-nav-count" title={`${formatNumber(openOrderCount)} 笔未完成订单`}>
                {badgeText}
              </small>
            ) : null}
          </button>
        );
      })}
    </>
  );
}
