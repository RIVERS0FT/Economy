import type { FacilityGroup, FacilityTypeDefinition } from '../../types';

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
        <strong>{group.status === 'error' ? '等待异常条件解除' : '当前未运行'}</strong>
      </div>
    );
  }

  const elapsed = Math.max(0, now - group.cycleStartedAt);
  const cycleElapsed = elapsed % type.cycleMs;
  const progress = Math.max(0, Math.min(100, (cycleElapsed / type.cycleMs) * 100));

  return (
    <div className="progress-wrap facility-progress-running">
      <div className="progress-meta"><span>本周期进度</span><span>{Math.round(progress)}%</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
    </div>
  );
}
