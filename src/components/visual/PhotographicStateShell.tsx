import type { ReactNode } from 'react';

type PhotographicStateVariant = 'auth' | 'game' | 'admin';
type PhotographicStateTone = 'normal' | 'critical';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PhotographicStateShell({
  variant,
  tone = 'normal',
  className = '',
  contentClassName = '',
  role,
  children,
}: {
  variant: PhotographicStateVariant;
  tone?: PhotographicStateTone;
  className?: string;
  contentClassName?: string;
  role?: 'alert' | 'status';
  children: ReactNode;
}) {
  return (
    <main
      className={classNames(
        'photographic-state-shell',
        `photographic-state-shell--${variant}`,
        tone === 'critical' && 'photographic-state-shell--critical',
        className,
      )}
      data-photographic-state-variant={variant}
    >
      <div
        className={classNames('photographic-state-shell__content', contentClassName)}
        role={role}
        aria-live={role === 'status' ? 'polite' : undefined}
      >
        {children}
      </div>
    </main>
  );
}
