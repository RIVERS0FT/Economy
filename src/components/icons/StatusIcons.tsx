import type { SVGProps } from 'react';

type StatusIconProps = SVGProps<SVGSVGElement>;

const sharedProps: StatusIconProps = {
  viewBox: '0 0 24 24',
  width: '1em',
  height: '1em',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  focusable: false,
};

export function CreditsIcon(props: StatusIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.2 9.4c.6-.8 1.6-1.2 2.9-1.2 1.8 0 3 .8 3 2s-1.2 1.8-3 1.8-3 .7-3 1.9 1.2 2 3 2c1.4 0 2.5-.4 3.1-1.2M12 6.5v11" />
    </svg>
  );
}

export function AssetsIcon(props: StatusIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="M12 3 21 12l-9 9-9-9 9-9Z" />
      <path d="m8 12 4-4 4 4-4 4-4-4Z" />
    </svg>
  );
}

export function RankIcon(props: StatusIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m4 8 3.3 3L12 5l4.7 6L20 8l-1.4 9H5.4L4 8Z" />
      <path d="M6 20h12" />
    </svg>
  );
}

export function WarehouseIcon(props: StatusIconProps) {
  return (
    <svg {...sharedProps} {...props}>
      <path d="m4 9 8-5 8 5v10H4V9Z" />
      <path d="M8 19v-6h8v6M8 9h.01M12 9h.01M16 9h.01" />
    </svg>
  );
}
