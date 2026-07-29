import {
  FINANCIAL_BACKGROUND_IMAGE_960_URL,
  FINANCIAL_BACKGROUND_IMAGE_URL,
} from '../../config/visualAssets';

export type FinancialBackdropVariant = 'auth' | 'game' | 'admin';
export type FinancialBackdropTone = 'normal' | 'critical';

export function FinancialBackdrop({
  variant,
  priority = false,
  tone = 'normal',
}: {
  variant: FinancialBackdropVariant;
  priority?: boolean;
  tone?: FinancialBackdropTone;
}) {
  const signedInPrefix = variant === 'auth' ? 'login' : 'game';
  const prefix = variant === 'auth' ? 'login' : variant;
  const resolvedPrefix = prefix === 'admin' ? 'admin' : signedInPrefix;

  return (
    <>
      <div
        className={`${resolvedPrefix}-image-layer financial-backdrop-image financial-backdrop-image--${variant}`}
        aria-hidden="true"
      >
        <picture>
          <source media="(max-width: 720px)" srcSet={FINANCIAL_BACKGROUND_IMAGE_960_URL} />
          <img
            src={FINANCIAL_BACKGROUND_IMAGE_URL}
            alt=""
            decoding="async"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        </picture>
      </div>

      <div
        className={`${resolvedPrefix}-atmosphere-layer financial-backdrop-atmosphere financial-backdrop-atmosphere--${variant}${tone === 'critical' ? ' financial-backdrop-atmosphere--critical' : ''}`}
        aria-hidden="true"
      />
    </>
  );
}
