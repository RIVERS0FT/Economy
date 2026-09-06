import type { ReactNode } from 'react';
import { CreditsIcon, CycleIcon } from '../icons/GameIcons';
import { CompactCurrency } from '../ui/CompactNumber';
import { formatDuration } from '../../utils/formatters';

/** Shared input/output geometry; no production or commercial settlement arithmetic. */
export function BuildingSettlementPanel({ title, status, description, inputs, outputs,
  cycleMs, operatingCost, progress, children, className = '' }: {
  title: ReactNode;
  status: string;
  description: string;
  inputs: ReactNode;
  outputs: ReactNode;
  cycleMs: number;
  operatingCost: number | null;
  progress: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`facility-production-formula ${className}`.trim()} data-status={status} role="group" aria-label={description}>
      <div className="facility-production-formula-heading"><strong>{title}</strong></div>
      <div className="facility-formula-visual">
        <div className="facility-formula-top">
          <div className="facility-formula-input-side">
            <div className="facility-formula-input">{inputs}</div>
          </div>
          <div className="facility-formula-output-side">
            <div className="facility-formula-output">{outputs}</div>
          </div>
        </div>
        <div className="facility-formula-meta" aria-hidden="true">
          <span className="facility-formula-meta-unit is-cycle"><CycleIcon className="facility-formula-meta-icon" /><span>{formatDuration(cycleMs)}</span></span>
          <span className="facility-formula-meta-unit is-cost"><CreditsIcon className="facility-formula-meta-icon" /><span>{operatingCost === null ? '—' : <CompactCurrency value={operatingCost} />}</span></span>
        </div>
        <div className="facility-formula-progress">{progress}</div>
      </div>
      {children}
    </section>
  );
}
