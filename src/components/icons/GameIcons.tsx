import type { PropsWithChildren, SVGProps } from 'react';
import { GemIcon } from './GemIcon';

type GameIconProps = SVGProps<SVGSVGElement>;
export type NavigationIconName = 'home' | 'market' | 'production' | 'assets' | 'collections' | 'auction' | 'contracts' | 'leaderboard' | 'gem-shop' | 'settings';

function GameIcon({ children, className, ...props }: PropsWithChildren<GameIconProps>) {
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
      {children}
    </svg>
  );
}

export function CreditsIcon(props: GameIconProps) {
  return <GameIcon {...props}><circle cx="12" cy="12" r="8.5" /><path d="M9.2 9.4c.6-.8 1.6-1.2 2.9-1.2 1.8 0 3 .8 3 2s-1.2 1.8-3 1.8-3 .7-3 1.9 1.2 2 3 2c1.4 0 2.5-.4 3.1-1.2M12 6.5v11" /></GameIcon>;
}

export function CycleIcon(props: GameIconProps) {
  return <GameIcon {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /><path d="M9 3.8h6" /></GameIcon>;
}

export function AssetsIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M12 3 21 12l-9 9-9-9 9-9Z" /><path d="m8 12 4-4 4 4-4 4-4-4Z" /></GameIcon>;
}

export function RankIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="m4 8 3.3 3L12 5l4.7 6L20 8l-1.4 9H5.4L4 8Z" /><path d="M6 20h12" /></GameIcon>;
}

export function WarehouseIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="m4 9 8-5 8 5v10H4V9Z" /><path d="M8 19v-6h8v6M8 9h.01M12 9h.01M16 9h.01" /></GameIcon>;
}

export function HomeIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></GameIcon>;
}

export function MarketIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3" /></GameIcon>;
}

export function ProductionIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M3 20V9l6 3V9l6 3V5h4v15H3Z" /><path d="M7 16h.01M11 16h.01M15 16h.01" /></GameIcon>;
}

export function FactoryIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M3 20V10l5 3V9l5 3V6h4l1 14H3Z" /><path d="M17 6V3h3v17" /><path d="M7 16h2M12 16h2M16 16h2" /></GameIcon>;
}

export function FundsIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5Z" /><path d="M4 8h16M15 14h3" /></GameIcon>;
}

export function CollectionIcon(props: GameIconProps) {
  return <GameIcon {...props}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M7 7h10v9H7z" /><path d="m7 14 3-3 2.2 2.2 1.8-1.8 3 3" /><circle cx="14.5" cy="9.5" r="1" /></GameIcon>;
}

export function AuctionIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="m13.5 5.5 5 5M11.5 7.5l5 5M8 11l7-7M13 16l7-7" /><path d="m10.2 9.8 4 4M3 20h11M5 16h7v4H5z" /></GameIcon>;
}

export function ContractIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M6 3h9l3 3v15H6V3Z" /><path d="M15 3v4h4M9 11h6M9 15h6M9 19h4" /></GameIcon>;
}

export function LeaderboardIcon(props: GameIconProps) {
  return <GameIcon {...props}><path d="M8 20v-7H4v7M14 20V4h-4v16M20 20V9h-4v11" /><path d="M3 20h18" /></GameIcon>;
}

export function SettingsIcon(props: GameIconProps) {
  return (
    <GameIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.35.55.7 1 .9.35.15.75.2 1.1.2h.1v4h-.1a1.7 1.7 0 0 0-1.1.4c-.45.3-.8.65-1 1Z" />
    </GameIcon>
  );
}

export function QqIcon(props: GameIconProps) {
  return (
    <GameIcon {...props}>
      <path d="M8.3 9.2C7.9 5.8 9.4 3.5 12 3.5s4.1 2.3 3.7 5.7" />
      <path d="M8.7 8.7c-1.6 1.8-2.4 4-2.4 6.3 0 3 2.3 5 5.7 5s5.7-2 5.7-5c0-2.3-.8-4.5-2.4-6.3" />
      <path d="M9.7 8h.01M14.3 8h.01M10.6 10.5l1.4.8 1.4-.8M6.7 13.5 4.5 16M17.3 13.5l2.2 2.5M9.2 19.8 7 21M14.8 19.8 17 21" />
    </GameIcon>
  );
}

export function LogoutIcon(props: GameIconProps) {
  return (
    <GameIcon {...props}>
      <path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9" />
    </GameIcon>
  );
}

export function GiftIcon(props: GameIconProps) {
  return (
    <GameIcon {...props}>
      <rect x="3" y="9" width="18" height="11" rx="2" />
      <path d="M12 9v11M3 13h18M5 9h14" />
      <path d="M12 9H8.5A2.5 2.5 0 1 1 11 6.5V9ZM12 9h3.5A2.5 2.5 0 1 0 13 6.5V9Z" />
    </GameIcon>
  );
}

export function ShieldIcon(props: GameIconProps) {
  return (
    <GameIcon {...props}>
      <path d="M12 3 20 6v5c0 5-3.2 8.4-8 10-4.8-1.6-8-5-8-10V6l8-3Z" />
      <path d="M9 12.2 11.1 14 15.5 9.5" />
    </GameIcon>
  );
}

export function NavigationIcon({ name, ...props }: { name: NavigationIconName } & GameIconProps) {
  switch (name) {
    case 'home': return <HomeIcon {...props} />;
    case 'market': return <MarketIcon {...props} />;
    case 'production': return <ProductionIcon {...props} />;
    case 'assets': return <FundsIcon {...props} />;
    case 'collections': return <CollectionIcon {...props} />;
    case 'auction': return <AuctionIcon {...props} />;
    case 'contracts': return <ContractIcon {...props} />;
    case 'leaderboard': return <LeaderboardIcon {...props} />;
    case 'gem-shop': return <GemIcon {...props} />;
    case 'settings': return <SettingsIcon {...props} />;
  }
}
