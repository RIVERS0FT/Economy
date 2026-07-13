import { NavigationIcon } from '../icons/GameIcons';
import { navigationItems, type TabId } from '../../config/navigation';
import { formatNumber } from '../../utils/formatters';

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
      {navigationItems.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-current={activeTab === id ? 'page' : undefined}
          className={activeTab === id ? 'sidebar-nav-button active' : 'sidebar-nav-button'}
          onClick={() => onSelect(id)}
        >
          <span aria-hidden="true"><NavigationIcon name={id} /></span>
          <strong>{label}</strong>
          {id === 'market' && openOrderCount > 0 ? <small>{formatNumber(openOrderCount)}</small> : null}
        </button>
      ))}
    </>
  );
}
