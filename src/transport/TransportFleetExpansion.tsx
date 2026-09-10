import { useRef, useState } from 'react';
import { TRANSPORT_MAX_VEHICLES_PER_ROUTE, TRANSPORT_MODE_POLICY, transportRouteVehicleCount } from '../../shared/transport-policy.js';
import { CompactNumber } from '../components/ui/CompactNumber';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { IntegerInput } from '../components/ui/FormControls';
import { GameConcept } from '../components/ui/GameConcept';
import { Button } from '../components/ui/layout';
import type { TransportRoute } from '../types';

/** Keep the confirmation basis fixed until this form is closed. A stale form
 * must never become a second purchase after an unconfirmed write succeeds.
 */
export function TransportFleetExpansion({ route, credits, busy, onSubmit, onCancel }: {
  route: TransportRoute;
  credits: number;
  busy: boolean;
  onSubmit: (quantity: number, expectedVehicleCount: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [expectedVehicleCount] = useState(() => transportRouteVehicleCount(route));
  const [quantityDraft, setQuantityDraft] = useState('1');
  const submitting = useRef(false);
  const definition = TRANSPORT_MODE_POLICY[route.mode];
  const quantity = Number(quantityDraft);
  const maximum = TRANSPORT_MAX_VEHICLES_PER_ROUTE - expectedVehicleCount;
  const valid = quantityDraft.trim() !== '' && Number.isSafeInteger(quantity) && quantity > 0 && quantity <= maximum;
  const nextCount = expectedVehicleCount + (valid ? quantity : 0);
  const cost = valid ? quantity * definition.vehiclePurchaseCost : 0;
  const stale = expectedVehicleCount !== transportRouteVehicleCount(route);
  const disabled = busy || stale || Boolean(route.deletionPending) || !valid || !Number.isFinite(credits) || credits < cost;

  async function submit() {
    if (disabled || submitting.current) return;
    submitting.current = true;
    try { await onSubmit(quantity, expectedVehicleCount); }
    finally { submitting.current = false; }
  }

  return (
    <form className="transport-fleet-expansion" aria-label="增加运力" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <IntegerInput
        label={`增加${definition.vehicleName}数量（${definition.vehicleUnit}）`}
        value={quantityDraft} fallbackValue={1} min={1} max={Math.max(1, maximum)}
        disabled={busy || stale || Boolean(route.deletionPending)}
        aria-invalid={!valid} onValueChange={setQuantityDraft}
      />
      <div className="transport-route-summary-grid">
        <span><small>单价</small><strong><CurrencyAmount>{definition.vehiclePurchaseCost}</CurrencyAmount></strong></span>
        <span><small>本次费用</small><strong data-transport-expansion-cost={cost}>{valid ? <CurrencyAmount>{cost}</CurrencyAmount> : '—'}</strong></span>
        <span><small>增购后数量</small><strong data-transport-expanded-count={nextCount}><CompactNumber value={nextCount} /> {definition.vehicleUnit}</strong></span>
        <span><small>增购后最大运力</small><strong data-transport-expanded-capacity={nextCount * definition.capacity}><CompactNumber value={nextCount * definition.capacity} /></strong></span>
      </div>
      <div className="transport-route-rules"><GameConcept concept="transport-fleet">新增运力从下一趟可用</GameConcept></div>
      <div className="transport-route-editor-actions">
        <Button type="submit" variant="primary" disabled={disabled}>{stale ? '运力已变化，请重新确认' : '确认增购'}</Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>取消增购</Button>
      </div>
    </form>
  );
}
