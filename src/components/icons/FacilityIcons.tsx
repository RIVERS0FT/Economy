import type { SVGProps } from 'react';

export const FACILITY_ICON_IDS = [
  'farm',
  'orchard',
  'logging-camp',
  'mine',
  'ranch',
  'fishery',
  'oil-field',
  'mill',
  'sawmill',
  'pulp-mill',
  'steelworks',
  'refinery',
  'textile-mill',
  'food-factory',
  'beverage-factory',
  'paper-mill',
  'furniture-factory',
  'garment-factory',
  'machine-factory',
  'electronics-factory',
  'appliance-factory',
] as const;

type FacilityIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  facilityTypeId: string;
};

export function FacilityIcon({ facilityTypeId, className, ...props }: FacilityIconProps) {
  return (
    <svg
      {...props}
      className={className ? `game-icon facility-icon ${className}` : 'game-icon facility-icon'}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-facility-icon={facilityTypeId}
    >
      <path d="M3 20V10l5 3V9l5 3V6h4l1 14H3Z" />
      <path d="M17 6V3h3v17" />
      <path d="M7 16h2M12 16h2M16 16h2" />
    </svg>
  );
}
