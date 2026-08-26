import { Fragment, type ReactNode } from 'react';
import { CreditsIcon } from '../icons/GameIcons';
import { formatCompactCurrency, formatCurrency } from '../../utils/formatters';
import { SafeTooltip } from './SafeTooltip';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function primitiveCurrency(children: ReactNode) {
  if (typeof children === 'number' && Number.isFinite(children)) {
    return { value: children, full: formatCurrency(children) };
  }
  if (typeof children !== 'string') return null;
  const normalized = children.trim();
  if (!/^-?(?:\d{1,3}(?:,\d{3})*|\d+)(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(value) ? { value, full: normalized } : null;
}

function renderCurrencyValue(children: ReactNode, sign: ReactNode) {
  const primitive = primitiveCurrency(children);
  if (!primitive) return children;
  const signText = typeof sign === 'string' || typeof sign === 'number' ? String(sign) : '';
  return (
    <SafeTooltip content={`${signText}${primitive.full}`}>
      <span>{formatCompactCurrency(primitive.value)}</span>
    </SafeTooltip>
  );
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
      <span className="currency-amount__value">{renderCurrencyValue(children, sign)}</span>
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
