import { economyConstants } from '../../store/gameStore';
import type { ProductionFacility } from '../../types';
import { facilityStatusNames } from '../../app/gameViewModel';
import { formatDuration } from '../../utils/formatters';

export function FacilityProgress({ facility, now }: { facility: ProductionFacility; now: number }) {
  let progress = 0;
  let detail = facilityStatusNames[facility.status];

  if (facility.status === 'constructing' && facility.constructionCompletesAt) {
    const remaining = facility.constructionCompletesAt - now;
    progress = Math.max(0, Math.min(100, 100 - (remaining / economyConstants.buildTimeMs) * 100));
    detail = `施工剩余 ${formatDuration(remaining)}`;
  } else if (facility.status === 'running' && facility.cycleStartedAt) {
    const elapsed = now - facility.cycleStartedAt;
    progress = Math.max(0, Math.min(100, (elapsed / facility.cycleMs) * 100));
    detail = `本周期 ${formatDuration(facility.cycleMs - elapsed)}`;
  } else if (facility.status === 'full') {
    progress = 100;
  }

  return (
    <div className="progress-wrap">
      <div className="progress-meta"><span>{detail}</span><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}
