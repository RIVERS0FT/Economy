import {
  FINANCIAL_BACKGROUND_IMAGE_960_URL,
  FINANCIAL_BACKGROUND_IMAGE_URL,
} from '../../config/visualAssets';

type FinancialBackdropVariant = 'auth' | 'game';

export function FinancialBackdrop({
  variant,
  priority = false,
}: {
  variant: FinancialBackdropVariant;
  priority?: boolean;
}) {
  const prefix = variant === 'auth' ? 'login' : 'game';

  return (
    <>
      <div
        className={`${prefix}-image-layer financial-backdrop-image financial-backdrop-image--${variant}`}
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
        className={`${prefix}-atmosphere-layer financial-backdrop-atmosphere financial-backdrop-atmosphere--${variant}`}
        aria-hidden="true"
      />
    </>
  );
}
