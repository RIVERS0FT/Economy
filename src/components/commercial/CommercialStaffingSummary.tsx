import { projectCommercialStaffingRate, commercialStaffingCapacity } from '../../../shared/commercial-staffing.js';
import type { CommercialBuildingGroup } from '../../types/commercial';
import { useNow } from '../../hooks/useNow';
import { BuildingStaffingProgress } from '../buildings/BuildingStaffingProgress';

export function CommercialStaffingSummary({ group, name, now }: {
  group: CommercialBuildingGroup;
  name: string;
  now: number;
}) {
  const liveNow = useNow(now);
  const rate = projectCommercialStaffingRate(group, liveNow);
  const percent = rate === null ? null : Math.round(rate / 100);
  const recovering = group.enabled && group.status === 'running';
  const directionLabel = recovering ? (percent !== null && percent >= 100 ? '已满员' : '恢复中')
    : percent !== null && percent <= 0 ? '已降至最低' : '下降中';
  const effective = rate === null ? null : commercialStaffingCapacity(group.count, rate, group.staffingBatchCarryBps ?? 0).effectiveCount;
  const description = rate === null ? `${name}满员率待同步`
    : `${name}当前满员率 ${percent}%，${directionLabel}，按当前满员率预计下一周期 ${effective} 座整数等效经营量；本周期金额保持开始时的锁定结果。`;
  return <BuildingStaffingProgress name={name} percent={percent} directionLabel={directionLabel} description={description} />;
}
