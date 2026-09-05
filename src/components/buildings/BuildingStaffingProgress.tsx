import { CompactNumber } from '../ui/CompactNumber';

/** Shared geometry only. Each domain supplies its own authoritative projection and explanation. */
export function BuildingStaffingProgress({ name, percent, directionLabel, description }: {
  name: string;
  percent: number | null;
  directionLabel: string;
  description: string;
}) {
  return (
    <section className="facility-staffing-summary" aria-label={description}>
      <div className="facility-staffing-track" role="progressbar" aria-label={`${name}满员率`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}
        aria-valuetext={percent === null ? '满员率待同步' : `${percent}%，${directionLabel}`}>
        <span className="facility-staffing-fill" style={{ width: `${percent ?? 0}%` }} />
        <div className="facility-staffing-track-copy">
          <strong>{percent === null ? '满员率待同步' : <>满员率 {<CompactNumber value={percent} /> }%</>}</strong>
          <span>{percent === null ? '等待服务器' : directionLabel}</span>
        </div>
      </div>
    </section>
  );
}
