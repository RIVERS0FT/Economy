import type { SVGProps } from 'react';

export const COMMERCIAL_ARTWORK_IDS = [
  'convenience-store',
  'fresh-market',
  'restaurant',
  'clothing-store',
  'furniture-showroom',
  'appliance-store',
] as const;

type CommercialBuildingArtworkProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  commercialTypeId: string;
};

/** Local commercial scene artwork with a generic storefront fallback. */
export function CommercialBuildingArtwork({ commercialTypeId, className = '', ...props }: CommercialBuildingArtworkProps) {
  return (
    <svg {...props} className={`commercial-building-artwork ${className}`.trim()}
      viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"
      data-commercial-artwork={commercialTypeId}>
      <path d="M3 10h18l-1.5-5h-15L3 10Z" />
      <path d="M4 10v9h16v-9M8 19v-6h4v6M15 13h3v3h-3" />
      <path d="M2.5 10c0 1.1.8 2 1.8 2s1.8-.9 1.8-2c0 1.1.8 2 1.8 2s1.8-.9 1.8-2c0 1.1.8 2 1.8 2s1.8-.9 1.8-2c0 1.1.8 2 1.8 2s1.8-.9 1.8-2c0 1.1.8 2 1.8 2s1.8-.9 1.8-2" />
    </svg>
  );
}
