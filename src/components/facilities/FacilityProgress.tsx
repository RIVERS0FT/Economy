import type { ProductionFacility } from '../../types';
import { facilityStatusNames } from '../../app/gameViewModel';
import { formatDuration } from '../../utils/formatters';

export function FacilityProgress({
  facility,
  now,
  buildTimeMs,
}: {
  facility: ProductionFacility;
  now: number;
  buildTimeMs?: number;
}) {
  let progress = 0;
  let detail = facilityStatusNames[facility.status];

  if (facility.status === 'constructing' && facility.constructionCompletesAt) {
    const remaining = Math.max(0, facility.constructionCompletesAt - now);
    const total = Math.max(1, buildTimeMs || remaining || 1);
    progress = Math.max(0, Math.min(100, 100 - (remaining / total) * 100));
    detail = `施工剩余 ${formatDuration(remaining)}`;
  } else if (facility.status === 'running' && facility.cycleStartedAt) {
    const elapsed = Math.max(0, now - facility.cycleStartedAt);
    const cycleElapsed = elapsed % facility.cycleMs;
    progress = Math.max(0, Math.min(100, (cycleElapsed / facility.cycleMs) * 100));
    detail = `本周期 ${formatDuration(facility.cycleMs - cycleElapsed)}`;
  } else if (facility.status === 'full') {
    progress = 100;
  } else if (facility.productionMode === 'target' && facility.targetQuantity) {
    progress = Math.max(0, Math.min(100, (facility.completedQuantity / facility.targetQuantity) * 100));
    detail = `计划 ${facility.completedQuantity}/${facility.targetQuantity}`;
  }

  return (
    <div className="progress-wrap">
      <div className="progress-meta"><span>{detail}</span><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}
