import type { FacilityGroup, FacilityTypeDefinition } from '../../types';
import { facilityStatusNames } from '../../app/gameViewModel';
import { formatDuration } from '../../utils/formatters';

export function FacilityGroupProgress({
  group,
  type,
  now,
}: {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
  now: number;
}) {
  let progress = 0;
  let detail = facilityStatusNames[group.status];

  if (group.status === 'running' && group.cycleStartedAt) {
    const elapsed = Math.max(0, now - group.cycleStartedAt);
    const cycleElapsed = elapsed % type.cycleMs;
    progress = Math.max(0, Math.min(100, (cycleElapsed / type.cycleMs) * 100));
    detail = `本周期剩余 ${formatDuration(type.cycleMs - cycleElapsed)}`;
  } else if (group.status === 'error') {
    detail = '等待条件恢复';
  } else if (group.productionMode === 'target' && group.targetQuantity) {
    progress = Math.max(0, Math.min(100, (group.completedQuantity / group.targetQuantity) * 100));
    detail = `计划 ${group.completedQuantity}/${group.targetQuantity}`;
  }

  return (
    <div className="progress-wrap">
      <div className="progress-meta"><span>{detail}</span><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}
