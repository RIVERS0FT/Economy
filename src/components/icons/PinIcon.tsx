import type { SVGProps } from 'react';

type PinIconProps = SVGProps<SVGSVGElement>;

export function PinIcon({ className, ...props }: PinIconProps) {
  return (
    <svg
      className={className ? `game-icon ${className}` : 'game-icon'}
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
      {...props}
    >
      <path d="M8 3h8l-1 6 3 3H6l3-3-1-6Z" />
      <path d="M12 12v9" />
    </svg>
  );
}
