import type { FacilityGroup, FacilityTypeDefinition } from '../../types';
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
  if (group.status !== 'running' || !group.cycleStartedAt) {
    return (
      <div className="facility-progress-compact">
        <span>生产进度</span>
        <strong>{group.status === 'error' ? '等待条件恢复' : '当前未运行'}</strong>
      </div>
    );
  }

  const elapsed = Math.max(0, now - group.cycleStartedAt);
  const cycleElapsed = elapsed % type.cycleMs;
  const remaining = Math.max(0, type.cycleMs - cycleElapsed);
  const progress = Math.max(0, Math.min(100, (cycleElapsed / type.cycleMs) * 100));

  return (
    <div className="progress-wrap facility-progress-running">
      <div className="progress-meta">
        <span>本周期剩余 {formatDuration(remaining)}</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}
