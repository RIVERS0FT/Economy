import type { ReactNode } from 'react';
import { FrostedGlassSurface } from '../ui/FrostedGlassSurface';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function MobileBottomNavigationFrame({
  ariaLabel,
  navLabel,
  className,
  surfaceId,
  workspaceSheetHidden = false,
  navigationReturning = false,
  onReturnAnimationEnd,
  children,
}: {
  ariaLabel: string;
  navLabel: string;
  className?: string;
  surfaceId?: string;
  workspaceSheetHidden?: boolean;
  navigationReturning?: boolean;
  onReturnAnimationEnd?: () => void;
  children: ReactNode;
}) {
  // The shared base remains equivalent to className="sidebar mobile-bottom-navigation";
  // callers may only append a surface-specific class.
  return (
    <aside
      className={classNames('sidebar mobile-bottom-navigation', className)}
      aria-label={ariaLabel}
      aria-hidden={workspaceSheetHidden || undefined}
      inert={workspaceSheetHidden || undefined}
      data-navigation-surface={surfaceId}
      data-workspace-sheet-hidden={workspaceSheetHidden ? 'true' : 'false'}
      data-navigation-returning={navigationReturning ? 'true' : 'false'}
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget
          && event.animationName === 'mobile-bottom-navigation-return'
        ) {
          onReturnAnimationEnd?.();
        }
      }}
    >
      <FrostedGlassSurface variant="mobileNavigation">
        <nav className="mobile-bottom-navigation__viewport" aria-label={navLabel}>
          {children}
        </nav>
      </FrostedGlassSurface>
    </aside>
  );
}
