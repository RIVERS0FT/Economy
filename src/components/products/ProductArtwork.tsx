import type { HTMLAttributes } from 'react';

type ProductArtworkProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  productId: string;
  label?: string;
  decorative?: boolean;
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function ProductArtwork({
  productId,
  label,
  decorative = true,
  className,
  ...props
}: ProductArtworkProps) {
  return (
    <span
      {...props}
      className={classNames('product-icon', 'product-artwork', className)}
      data-product-icon={productId}
      data-product-artwork={productId}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label ?? productId}
    />
  );
}
