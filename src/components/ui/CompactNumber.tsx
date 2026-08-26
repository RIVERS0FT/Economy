import { SafeTooltip } from './SafeTooltip';
import {
  formatCompactCurrency,
  formatCurrency,
  formatFullNumber,
  formatNumber,
} from '../../utils/formatters';

type CompactValueProps = {
  display: string;
  full: string;
  className?: string;
  ariaLabel?: string;
};

function CompactValue({
  display,
  full,
  className = '',
  ariaLabel,
}: CompactValueProps) {
  return (
    <SafeTooltip content={full} className={className}>
      <span className="compact-numeric-value" aria-label={ariaLabel ?? full}>{display}</span>
    </SafeTooltip>
  );
}

export function CompactNumber({
  value,
  prefix = '',
  suffix = '',
  className = '',
  ariaLabel,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const display = `${prefix}${formatNumber(value)}${suffix}`;
  const full = `${prefix}${formatFullNumber(value)}${suffix}`;
  return <CompactValue display={display} full={full} className={className} ariaLabel={ariaLabel} />;
}

export function CompactCurrency({
  value,
  prefix = '',
  suffix = '',
  className = '',
  ariaLabel,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const display = `${prefix}${formatCompactCurrency(value)}${suffix}`;
  const full = `${prefix}${formatCurrency(value)}${suffix}`;
  return <CompactValue display={display} full={full} className={className} ariaLabel={ariaLabel} />;
}

export function CompactRank({
  value,
  className = '',
  ariaLabel,
}: {
  value: number | null | undefined;
  className?: string;
  ariaLabel?: string;
}) {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    return <span className={className || undefined} aria-label={ariaLabel}>#--</span>;
  }
  const normalized = Number(value);
  return (
    <CompactValue
      display={`#${formatNumber(normalized)}`}
      full={`#${formatFullNumber(normalized)}`}
      className={className}
      ariaLabel={ariaLabel}
    />
  );
}
