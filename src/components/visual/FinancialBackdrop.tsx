import {
  FINANCIAL_BACKGROUND_IMAGE_960_URL,
  FINANCIAL_BACKGROUND_IMAGE_URL,
} from '../../config/visualAssets';

export type FinancialBackdropVariant = 'auth' | 'game' | 'admin';
export type FinancialBackdropTone = 'normal' | 'critical';

export function FinancialBackdrop() {
  return (
    <>
      <div
        className="application-image-layer financial-backdrop-image"
        data-persistent-financial-photography="true"
        aria-hidden="true"
      >
        <picture>
          <source media="(max-width: 720px)" srcSet={FINANCIAL_BACKGROUND_IMAGE_960_URL} />
          <img
            src={FINANCIAL_BACKGROUND_IMAGE_URL}
            alt=""
            decoding="async"
            loading="eager"
            fetchPriority="high"
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        </picture>
      </div>

      <div className="application-atmosphere-layer financial-backdrop-atmosphere" aria-hidden="true" />
    </>
  );
}
