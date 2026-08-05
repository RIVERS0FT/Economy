import type { ReactNode } from 'react';

export interface MobileDetailSummaryProps {
  artwork: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  description?: ReactNode;
  className?: string;
  artworkClassName?: string;
  ariaLabel?: string;
}

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function MobileDetailSummary({
  artwork,
  title,
  meta,
  action,
  description,
  className,
  artworkClassName,
  ariaLabel,
}: MobileDetailSummaryProps) {
  return (
    <div className={joinClassNames('mobile-detail-summary', className)} aria-label={ariaLabel}>
      <div
        className={joinClassNames('mobile-detail-summary__artwork', artworkClassName)}
        aria-hidden="true"
      >
        {artwork}
      </div>
      <div className="mobile-detail-summary__main">
        <div className="mobile-detail-summary__heading">
          <div className="mobile-detail-summary__title">
            {title}
            {meta ? <div className="mobile-detail-summary__meta">{meta}</div> : null}
          </div>
          {action ? <div className="mobile-detail-summary__action">{action}</div> : null}
        </div>
        {description ? <div className="mobile-detail-summary__description">{description}</div> : null}
      </div>
    </div>
  );
}
