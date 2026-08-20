import type { ReactNode } from 'react';

type ChromeFrostedGlassSurfaceVariant = 'statusBar' | 'mobileNavigation' | 'authCard' | 'workspaceCard';
export type FrostedGlassSurfaceVariant = ChromeFrostedGlassSurfaceVariant | 'stateCard';
export type FrostedGlassSurfaceLayout = 'fixed' | 'content';

export function FrostedGlassSurface({
  variant,
  children,
  className = '',
  layout = 'fixed',
}: {
  variant: FrostedGlassSurfaceVariant;
  children: ReactNode;
  className?: string;
  layout?: FrostedGlassSurfaceLayout;
}) {
  const classes = [
    'frosted-glass-surface',
    `frosted-glass-surface--${variant}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      data-frosted-glass-variant={variant}
      data-frosted-glass-layout={layout}
    >
      <div className="frosted-glass-surface__content">{children}</div>
    </div>
  );
}
