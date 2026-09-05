import type { ReactNode } from 'react';
import { CompactNumber } from '../ui/CompactNumber';

/** Shared presentation only; callers retain their own economic state and actions. */
export function BuildingClusterCard({
  name, status, count, artwork, profitValue, profitTone, profitTitle,
  ariaLabel, onSelect, className = '',
}: {
  name: string;
  status: string;
  count: number;
  artwork: ReactNode;
  profitValue: ReactNode;
  profitTone: string;
  profitTitle: string;
  ariaLabel: string;
  onSelect: (trigger: HTMLButtonElement) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`facility-cluster-selector-card ${className}`.trim()}
      data-ui-interactive="surface"
      data-status={status}
      aria-label={ariaLabel}
      onClick={(event) => onSelect(event.currentTarget)}
    >
      <strong className="facility-cluster-name">{name}</strong>
      {artwork}
      <span className={`facility-cluster-profit is-${profitTone}`} title={profitTitle}>
        {profitValue}
      </span>
      <span className="facility-cluster-count"><CompactNumber value={count} /></span>
    </button>
  );
}
