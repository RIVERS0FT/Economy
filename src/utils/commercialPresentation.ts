import type { CommercialBuildingGroup, CommercialBuildingTypeDefinition, CommercialStatus, CommercialStatusReason } from '../types/commercial';

export const COMMERCIAL_STATUS_LABELS: Record<CommercialStatus, string> = {
  running: '营业中', stopped: '已停止', error: '经营异常',
};
export const COMMERCIAL_REASON_LABELS: Record<CommercialStatusReason, string> = {
  manual: '手动停止', insufficient_funds: '运营资金不足', insufficient_input: '消费商品不足',
};

export function commercialStatusLabel(group: CommercialBuildingGroup) {
  const reason = group.statusReason && COMMERCIAL_REASON_LABELS[group.statusReason];
  return `${COMMERCIAL_STATUS_LABELS[group.status]}${reason ? `：${reason}` : ''}`;
}

export function commercialProfitPerMinute(type: Pick<CommercialBuildingTypeDefinition, 'cycleMs' | 'profitPerCycle'>, count = 1) {
  if (!Number.isFinite(type.cycleMs) || type.cycleMs <= 0) return 0;
  return type.profitPerCycle * count * 60_000 / type.cycleMs;
}

/** Never repeat a completed cycle locally or infer its settlement. */
export function commercialCycleProgress(group: Pick<CommercialBuildingGroup, 'status' | 'cycleStartedAt' | 'cycleCompletesAt'>, now: number) {
  const start = group.cycleStartedAt;
  const end = group.cycleCompletesAt;
  if (group.status !== 'running' || typeof start !== 'number' || typeof end !== 'number'
    || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || !Number.isFinite(now)) {
    return { active: false, progress: 0, remaining: 0, waiting: false };
  }
  const remaining = Math.max(0, end - now);
  const progress = Math.max(0, Math.min(100, (now - start) / (end - start) * 100));
  return { active: true, progress, remaining, waiting: remaining === 0 };
}
