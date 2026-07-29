import type { ReactNode } from 'react';
import {
  FinancialBackdrop,
  type FinancialBackdropTone,
  type FinancialBackdropVariant,
} from './FinancialBackdrop';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PhotographicStateShell({
  variant,
  tone = 'normal',
  priority = false,
  className = '',
  contentClassName = '',
  role,
  children,
}: {
  variant: FinancialBackdropVariant;
  tone?: FinancialBackdropTone;
  priority?: boolean;
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
      <FinancialBackdrop variant={variant} tone={tone} priority={priority} />
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
