import type { ReactNode } from 'react';
import { LiquidGlassSurface } from '../ui/LiquidGlassSurface';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function MobileBottomNavigationFrame({
  ariaLabel,
  navLabel,
  className,
  surfaceId,
  children,
}: {
  ariaLabel: string;
  navLabel: string;
  className?: string;
  surfaceId?: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={classNames('sidebar mobile-bottom-navigation', className)}
      aria-label={ariaLabel}
      data-navigation-surface={surfaceId}
    >
      <LiquidGlassSurface variant="mobileNavigation">
        <nav className="mobile-bottom-navigation__viewport" aria-label={navLabel}>
          {children}
        </nav>
      </LiquidGlassSurface>
    </aside>
  );
}
