import type { ReactNode, SVGProps } from 'react';

export const PRODUCT_ICON_IDS = [
  'wheat',
  'rice',
  'cotton',
  'timber',
  'ore',
  'copper-ore',
  'crude-oil',
  'meat',
  'eggs',
  'milk',
  'wool',
  'flour',
  'lumber',
  'steel',
  'copper',
  'plastic',
  'textile',
  'food',
  'furniture',
  'clothing',
  'machinery',
  'electronics',
] as const;

type ProductIconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  productId: string;
};

function ProductSvg({
  productId,
  className,
  children,
  ...props
}: ProductIconProps & { children: ReactNode }) {
  return (
    <svg
      {...props}
      className={className ? `game-icon product-icon ${className}` : 'game-icon product-icon'}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-product-icon={productId}
    >
      {children}
    </svg>
  );
}

export function ProductIcon({ productId, ...props }: ProductIconProps) {
  switch (productId) {
    case 'wheat':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M12 21V4" />
          <path d="M12 8c-2.7 0-4.6-1.3-5.1-3.6C9.7 4.3 11.5 5.6 12 8Z" />
          <path d="M12 12c-2.8 0-4.8-1.4-5.3-3.8 2.9-.1 4.8 1.3 5.3 3.8Z" />
          <path d="M12 16c-2.7 0-4.6-1.3-5.1-3.6 2.8-.1 4.6 1.2 5.1 3.6Z" />
          <path d="M12 8c2.7 0 4.6-1.3 5.1-3.6-2.8-.1-4.6 1.2-5.1 3.6Z" />
          <path d="M12 12c2.8 0 4.8-1.4 5.3-3.8-2.9-.1-4.8 1.3-5.3 3.8Z" />
          <path d="M12 16c2.7 0 4.6-1.3 5.1-3.6-2.8-.1-4.6 1.2-5.1 3.6Z" />
        </ProductSvg>
      );
    case 'rice':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M5 14h14c-.7 4-3.1 6-7 6s-6.3-2-7-6Z" />
          <path d="M7 11c1.2-1.4 2.5-1.4 3.7 0 1.2-1.4 2.5-1.4 3.7 0 1.1-1.2 2.2-1.3 3.3-.3" />
          <path d="M12 9V3" />
          <path d="M12 6c-2.1 0-3.4-.9-3.9-2.7 2.2-.1 3.5.8 3.9 2.7Z" />
          <path d="M12 8c2.1 0 3.4-.9 3.9-2.7-2.2-.1-3.5.8-3.9 2.7Z" />
        </ProductSvg>
      );
    case 'cotton':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M12 20v-7" />
          <path d="M8.5 14.5C5.7 14.5 4 12.8 4 10.5 4 8.3 5.7 7 7.7 7c.5-2.2 2.1-3.5 4.3-3.5S15.8 4.8 16.3 7c2 0 3.7 1.3 3.7 3.5 0 2.3-1.7 4-4.5 4Z" />
          <path d="M8 20h8" />
        </ProductSvg>
      );
    case 'timber':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M6 6h11a4 4 0 0 1 0 8H6" />
          <ellipse cx="6" cy="10" rx="3" ry="4" />
          <path d="M5 8.5c1.3.2 2.2 1 2.4 2.4" />
          <path d="M4.5 12c1.7-.1 2.8-.8 3.3-2.2" />
          <path d="M15 7.5c1.2 1.5 1.2 3.5 0 5" />
        </ProductSvg>
      );
    case 'ore':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="m4 15 3-7 5-3 6 3 2 7-5 4H8Z" />
          <path d="m7 8 5 4 6-4" />
          <path d="m12 12 3 7" />
          <path d="m12 12-4 7" />
        </ProductSvg>
      );
    case 'copper-ore':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="m4 15 3-7 5-3 6 3 2 7-5 4H8Z" />
          <circle cx="10" cy="11" r="1.3" />
          <circle cx="15.5" cy="14.5" r="1.5" />
          <path d="m7 8 3 3M18 8l-2.5 5" />
        </ProductSvg>
      );
    case 'crude-oil':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M12 3c3.2 4.2 5.5 7.1 5.5 10.1A5.5 5.5 0 0 1 6.5 13C6.5 10.1 8.8 7.2 12 3Z" />
          <path d="M9.2 14.4a3.1 3.1 0 0 0 2.8 1.7" />
        </ProductSvg>
      );
    case 'meat':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M8.5 5.5c3-2.2 7.1-1.5 9.1 1.2 2 2.8.8 6.7-2.4 8.4-2.6 1.4-4.8.7-6.3 2.2L6.8 19.5 4.5 17.2 6.7 15c1.5-1.5.8-3.7 2.2-6.3" />
          <circle cx="16.5" cy="7.5" r="1" />
        </ProductSvg>
      );
    case 'eggs':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M9.5 4C7.6 6.5 6.3 9.2 6.3 12a5.7 5.7 0 0 0 11.4 0c0-2.8-1.3-5.5-3.2-8a3.1 3.1 0 0 0-5 0Z" />
          <path d="M9.2 15.2c1.7 1.2 3.6 1.2 5.3 0" />
        </ProductSvg>
      );
    case 'milk':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M8 4h7l2 4v12H7V8Z" />
          <path d="M8 4v4h9" />
          <path d="M10 12c1.2-1 2.8-1 4 0v4c-1.2 1-2.8 1-4 0Z" />
        </ProductSvg>
      );
    case 'wool':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M7 17a4 4 0 0 1-1-7.9A4.5 4.5 0 0 1 14.4 6 4 4 0 0 1 18 12.8 3.5 3.5 0 0 1 15 18H8" />
          <path d="M9 18v2M15 18v2" />
          <path d="M7.5 12h9" />
        </ProductSvg>
      );
    case 'flour':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M9 4h6l-1 3c2.8 1.5 4.5 4.2 4.5 7.2 0 3.7-2.8 5.8-6.5 5.8s-6.5-2.1-6.5-5.8C5.5 11.2 7.2 8.5 10 7Z" />
          <path d="M9 7h6" />
          <path d="M9.5 13.5c1.8-1.2 3.2-1.2 5 0" />
          <path d="M12 11.5v4" />
        </ProductSvg>
      );
    case 'lumber':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M4 6h14l2 3H6Z" />
          <path d="M4 11h14l2 3H6Z" />
          <path d="M4 16h14l2 3H6Z" />
          <path d="m4 6 2 3v10" />
        </ProductSvg>
      );
    case 'steel':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M5 4h14v4h-5v8h5v4H5v-4h5V8H5Z" />
          <path d="M10 8h4" />
          <path d="M10 16h4" />
        </ProductSvg>
      );
    case 'copper':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M5 7h14l-2 4H7Z" />
          <path d="M7 13h10l2 4H5Z" />
          <path d="M8 7V5h8v2M8 17v2h8v-2" />
        </ProductSvg>
      );
    case 'plastic':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M9 3h6" />
          <path d="M10 3v3l-2 2v10c0 1.7 1.3 3 3 3h2c1.7 0 3-1.3 3-3V8l-2-2V3" />
          <path d="M8 11h8" />
          <path d="M10.5 15.5h3" />
        </ProductSvg>
      );
    case 'textile':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M5 6h12l2 3-2 9H5L3 9Z" />
          <path d="M6 9h12M8 6v12M12 6v12M16 6v12" />
          <path d="M5 13h12" />
        </ProductSvg>
      );
    case 'food':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M4 11h16c0 5-3.3 8-8 8s-8-3-8-8Z" />
          <path d="M7 8c0-1.5 1-2.5 2.5-3" />
          <path d="M12 8c0-1.7 1.1-2.8 2.8-3.5" />
          <path d="M8 21h8" />
        </ProductSvg>
      );
    case 'furniture':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="M7 4v8h10V4" />
          <path d="M5 10v5h14v-5" />
          <path d="M7 15v5" />
          <path d="M17 15v5" />
          <path d="M7 8h10" />
        </ProductSvg>
      );
    case 'clothing':
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="m8 4-5 4 3 4 2-1v9h8v-9l2 1 3-4-5-4c-.8 1.3-2.2 2-4 2s-3.2-.7-4-2Z" />
          <path d="M10 4c.4 1 1 1.5 2 1.5S13.6 5 14 4" />
        </ProductSvg>
      );
    case 'machinery':
      return (
        <ProductSvg productId={productId} {...props}>
          <circle cx="12" cy="12" r="3.2" />
          <path d="M12 3v2" />
          <path d="M12 19v2" />
          <path d="m5.6 5.6 1.4 1.4" />
          <path d="m17 17 1.4 1.4" />
          <path d="M3 12h2" />
          <path d="M19 12h2" />
          <path d="m5.6 18.4 1.4-1.4" />
          <path d="m17 7 1.4-1.4" />
          <circle cx="12" cy="12" r="7" />
        </ProductSvg>
      );
    case 'electronics':
      return (
        <ProductSvg productId={productId} {...props}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="6" height="6" rx="1" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </ProductSvg>
      );
    default:
      return (
        <ProductSvg productId={productId} {...props}>
          <path d="m4 8 8-4 8 4-8 4Z" />
          <path d="M4 8v8l8 4 8-4V8" />
          <path d="M12 12v8" />
        </ProductSvg>
      );
  }
}

export function ProductIconLabel({
  productId,
  children,
  className,
}: {
  productId: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={className ? `product-icon-label ${className}` : 'product-icon-label'}>
      <ProductIcon productId={productId} />
      <span>{children}</span>
    </span>
  );
}
