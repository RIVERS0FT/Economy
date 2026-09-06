import { useNow } from '../hooks/useNow';
import type { ProvinceDefinition, TransportShipment } from '../types';
import { formatTransportDuration } from '../utils/provinceLogistics';

export function TransportShipmentProgress({ shipment, provinceById, referenceNow }: {
  shipment: TransportShipment;
  provinceById: Map<string, ProvinceDefinition>;
  referenceNow: number;
}) {
  const now = useNow(referenceNow, 1_000);
  if (shipment.status === 'docked') {
    const provinceId = shipment.currentProvinceId ?? shipment.stopPlan?.[0]?.provinceId;
    const name = provinceId ? provinceById.get(provinceId)?.name ?? provinceId : '当前节点';
    return <span>停靠 {name} · 在线自动装卸</span>;
  }
  const next = shipment.stopPlan?.[0];
  const name = next ? provinceById.get(next.provinceId)?.name ?? next.provinceId : '';
  const remaining = formatTransportDuration(Math.max(0, shipment.arrivesAt - now));
  return <span>{name ? `下一站 ${name} · ` : ''}剩余 {remaining}</span>;
}
