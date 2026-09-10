import { useMemo, useState } from 'react';
import { postTransportTask } from '../api/game';
import type { LoadedGameViewModel } from '../app/gameViewModel';
import { SelectInput } from '../components/ui/FormControls';
import { CompactNumber } from '../components/ui/CompactNumber';
import { StatusTag, WidgetHeading } from '../components/ui/layout';
import type { TransportModeId } from '../types';
import { TRANSPORT_MODES } from '../utils/provinceLogistics';
import './transport-slots.css';

type TransportSlotView = {
  id: string;
  index: number;
  mode: TransportModeId;
  experience: number;
  level: number;
  nextLevelExperience: number | null;
  speedBonusBps: number;
  occupied: boolean;
  routeId?: string;
};

type TransportSlotState = {
  version: number;
  stage: string;
  limit: number;
  used: number;
  slots: TransportSlotView[];
};

function slotStateFor(model: LoadedGameViewModel): TransportSlotState {
  const delivered = (model.game.research as typeof model.game.research & { transportSlots?: TransportSlotState }).transportSlots;
  if (delivered && Array.isArray(delivered.slots)) return delivered;
  const limits: Record<string, number> = { C1: 2, C2: 3, C3: 5, C4: 8, C5: 12, C6: 16, C7: 20 };
  const stage = model.game.research.unlockedComplexity || 'C1';
  const limit = limits[stage] ?? 2;
  const used = (model.game.transportShipments ?? []).filter((shipment) => shipment.status !== 'arrived').length;
  const modes: TransportModeId[] = ['road', 'rail', 'air'];
  return {
    version: 1,
    stage,
    limit,
    used,
    slots: Array.from({ length: limit }, (_, index) => ({
      id: `transport-slot-${index + 1}`,
      index: index + 1,
      mode: modes[index % modes.length],
      experience: 0,
      level: 1,
      nextLevelExperience: 3,
      speedBonusBps: 0,
      occupied: false,
    })),
  };
}

export function TransportSlotsPanel({ model }: { model: LoadedGameViewModel }) {
  const delivered = useMemo(() => slotStateFor(model), [model.game]);
  const [localState, setLocalState] = useState<TransportSlotState | null>(null);
  const [pendingSlotId, setPendingSlotId] = useState('');
  const state = localState ?? delivered;

  async function configure(slot: TransportSlotView, mode: TransportModeId) {
    if (slot.occupied || pendingSlotId || slot.mode === mode) return;
    setPendingSlotId(slot.id);
    try {
      const response = await postTransportTask({ operation: 'slot-configure', slotId: slot.id, mode } as never);
      const projected = (response.result as typeof response.result & { transportSlots?: TransportSlotState }).transportSlots;
      if (projected) setLocalState(projected);
      await model.showResult({ ...response.result, revision: response.revision });
      if (response.result.ok) await model.refresh({ mode: 'authoritative' });
    } finally {
      setPendingSlotId('');
    }
  }

  return (
    <section className="transport-page-section transport-slots-panel" data-transport-slots="true">
      <WidgetHeading
        title="运输槽位"
        action={<StatusTag tone={state.used >= state.limit ? 'warning' : 'neutral'}>{state.used} / {state.limit}</StatusTag>}
      />
      <div className="transport-slot-summary">
        <span>科技 {state.stage}</span>
        <span>每个运行趟次占用 1 个槽位</span>
        <span>完成运输自动培养工具</span>
      </div>
      <div className="transport-slot-grid">
        {state.slots.map((slot) => {
          const next = slot.nextLevelExperience;
          const progress = next === null ? 1 : Math.max(0, Math.min(1, slot.experience / Math.max(1, next)));
          return (
            <article className="transport-slot-card" key={slot.id} data-slot-id={slot.id} data-slot-occupied={slot.occupied}>
              <div className="transport-slot-heading">
                <strong>槽位 {slot.index}</strong>
                <StatusTag tone={slot.occupied ? 'info' : 'neutral'}>{slot.occupied ? '运输中' : '空闲'}</StatusTag>
              </div>
              <SelectInput
                label="运输工具"
                value={slot.mode}
                disabled={slot.occupied || Boolean(pendingSlotId)}
                onChange={(event) => void configure(slot, event.target.value as TransportModeId)}
              >
                {(Object.keys(TRANSPORT_MODES) as TransportModeId[]).map((mode) => (
                  <option key={mode} value={mode}>{TRANSPORT_MODES[mode].vehicleName}</option>
                ))}
              </SelectInput>
              <div className="transport-slot-training">
                <div className="transport-slot-training-heading">
                  <strong>{TRANSPORT_MODES[slot.mode].vehicleName} Lv.<CompactNumber value={slot.level} /></strong>
                  <span>{slot.speedBonusBps > 0 ? `速度 +${slot.speedBonusBps / 100}%` : '基础速度'}</span>
                </div>
                <div className="transport-slot-progress" role="progressbar" aria-label={`槽位 ${slot.index} 培养进度`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                  <span style={{ width: `${progress * 100}%` }} />
                </div>
                <small>{next === null ? '已达到最高等级' : `熟练度 ${slot.experience} / ${next}`}</small>
              </div>
              <small className="ui-helper-text">切换运输工具会重置该槽位的培养进度；运输中不可切换。</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
