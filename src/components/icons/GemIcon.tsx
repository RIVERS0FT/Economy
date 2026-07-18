import type { SVGProps } from 'react';

export function GemIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className ? `game-icon ${className}` : 'game-icon'}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M6.5 3.5h11l4 5.5L12 21 2.5 9l4-5.5Zm.9 2L5 8h4l1.4-2.5h-3Zm5.3 0L11.3 8h4.2l-1.4-2.5h-1.4ZM17 5.5 18.8 8h-2.9l1.1-2.5ZM5.2 10l5 6.3L8.7 10H5.2Zm5.6 0L12 16.9 13.2 10h-2.4Zm4.5 0-1.5 6.3 5-6.3h-3.5Z" fill="currentColor" />
    </svg>
  );
}
