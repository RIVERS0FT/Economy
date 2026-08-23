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
  return (
    <span
      className={`regional-entity-title ${className}`.trim()}
      data-regional-entity-title="true"
      aria-label={`${entityName}，${regionName}`}
    >
      <span className="regional-entity-title__name" aria-hidden="true">{entityName}</span>
      <span className="regional-entity-title__region" aria-hidden="true">{regionName}</span>
    </span>
  );
}
