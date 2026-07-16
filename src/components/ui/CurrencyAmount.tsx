import { Fragment, type ReactNode } from 'react';
import { CreditsIcon } from '../icons/GameIcons';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function CurrencyAmount({
  children,
  className = '',
  sign,
}: {
  children: ReactNode;
  className?: string;
  sign?: ReactNode;
}) {
  return (
    <span className={classNames('currency-amount', className)}>
      {sign !== undefined && sign !== null && sign !== '' ? <span className="currency-amount__sign">{sign}</span> : null}
      <CreditsIcon className="currency-amount__icon" />
      <span className="currency-amount__value">{children}</span>
    </span>
  );
}

export function CurrencyText({ children }: { children: string }) {
  const segments = children.split('\u00a4');
  if (segments.length === 1) return <>{children}</>;

  return (
    <>
      {segments.map((segment, index) => (
        <Fragment key={`${index}-${segment}`}>
          {index > 0 ? <CreditsIcon className="currency-inline-icon" /> : null}
          {segment}
        </Fragment>
      ))}
    </>
  );
}
