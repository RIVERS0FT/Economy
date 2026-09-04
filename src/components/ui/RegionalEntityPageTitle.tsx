import { usePlayerPageNavigation } from './PageNavigationContext';

interface RegionalEntityPageTitleProps {
  entityName: string;
  regionName: string;
  className?: string;
}

export function RegionalEntityPageTitle({
  entityName,
  regionName,
  className = '',
}: RegionalEntityPageTitleProps) {
  const pageNavigation = usePlayerPageNavigation();
  const currentLocation = pageNavigation?.currentLocation;
  const regionalLocation = currentLocation?.type === 'regional-product'
    || currentLocation?.type === 'regional-commercial'
    || currentLocation?.type === 'regional-facility'
    ? currentLocation
    : null;

  const openRegionOverview = regionalLocation && pageNavigation
    ? () => {
        pageNavigation.pushPage({
          type: 'province',
          provinceId: regionalLocation.provinceId,
          section: 'overview',
        });
      }
    : null;

  return (
    <span
      className={`regional-entity-title ${className}`.trim()}
      data-regional-entity-title="true"
    >
      <span className="regional-entity-title__name">{entityName}</span>
      {openRegionOverview ? (
        <button
          type="button"
          className="regional-entity-title__region regional-entity-title__region-button"
          data-regional-entity-region-link="true"
          aria-label={`前往${regionName}地区页面`}
          onClick={openRegionOverview}
        >
          {regionName}
        </button>
      ) : (
        <span className="regional-entity-title__region">{regionName}</span>
      )}
    </span>
  );
}
