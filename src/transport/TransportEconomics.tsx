import type { ReactNode } from 'react';
import { TRANSPORT_COST_MARGIN, TRANSPORT_MIN_NET_GAIN, transportCyclePolicyForShipment } from '../../shared/transport-policy.js';
import { CompactNumber } from '../components/ui/CompactNumber';
import { SafeTooltip } from '../components/ui/SafeTooltip';
import { Button, StatusTag } from '../components/ui/layout';
import type { EconomyState, ProvinceDefinition, TransportModeId, TransportShipment } from '../types';
import { formatCurrency } from '../utils/formatters';
import {
  formatTransportDuration,
  TRANSPORT_MODES,
  transportRouteSetupCost,
} from '../utils/provinceLogistics';
import { estimateTransportRoute, type TransportPlanningRoute, type TransportRouteEstimate } from './transportPlanning.js';
import { TRANSPORT_WAITING_LABELS } from './transportPlanner.js';

export function TransportGainExplanation({ children = '下一周期预计增益' }: { children?: ReactNode }) {
  return (
    <SafeTooltip
      className="game-concept-anchor"
      anchorRole="term"
      anchorTabIndex={0}
      content={(
        <span className="game-concept-tooltip">
          <strong>相对本地卖出的运输增益</strong>
          <span>按当前真实可用库存和今日官方价估计，扣除卖出手续费差额及整周期运输费用。不是已实现现金利润，不包含未来产量，也不代表买入后转售利润。到站不会自动出售。</span>
          <span>新周期要求预计增益至少达到 {formatCurrency(TRANSPORT_MIN_NET_GAIN)} 与周期费用 {TRANSPORT_COST_MARGIN * 100}% 中的较高者；预计跨日调价时等待新报价。已付费周期继续完成，不会逐站重复收费。</span>
        </span>
      )}
    >
      <span className="game-concept-text" data-transport-gain-explanation="true">{children}</span>
    </SafeTooltip>
  );
}

export function TransportForecast({ estimate }: { estimate: TransportRouteEstimate }) {
  return (
    <div className="transport-forecast" data-transport-waiting-reason={estimate.reason}>
      <div className="transport-route-summary-grid">
        <span><small><TransportGainExplanation /></small><strong data-transport-net-gain="true">{estimate.netGain === null ? '待行情同步' : formatCurrency(estimate.netGain)}</strong></span>
        <span><small>发车安全余量</small><strong>{formatCurrency(estimate.threshold)}</strong></span>
        <span><small>预计运输数量</small><strong><CompactNumber value={estimate.transportedQuantity} /></strong></span>
        <span><small>预计周期耗时</small><strong>{formatTransportDuration(estimate.durationMs)}</strong></span>
      </div>
      <StatusTag tone={estimate.reason === 'ready' ? 'info' : 'neutral'}>{TRANSPORT_WAITING_LABELS[estimate.reason]}</StatusTag>
    </div>
  );
}

export function TransportLoad({ shipment }: { shipment: TransportShipment }) {
  const capacity = transportCyclePolicyForShipment(shipment).capacity;
  const currentLoad = shipment.status === 'arrived' ? 0 : (shipment.manifest ?? []).reduce(
    (total, entry) => total + Math.max(0, Math.floor(Number(entry.quantity) || 0)), 0,
  );
  const percent = Math.max(0, Math.min(100, Math.round(currentLoad / capacity * 100)));
  return (
    <div className="transport-load" data-transport-capacity={capacity} data-transport-current-load={currentLoad}>
      <div className="transport-load-heading">
        <span>当前装载率</span>
        <strong><CompactNumber value={currentLoad} /> / <CompactNumber value={capacity} /><span> · {percent}%</span></strong>
      </div>
      <progress aria-label="当前装载率" max={capacity} value={currentLoad} />
    </div>
  );
}

export function TransportModeComparison({ game, route, now, provinceById, disabled, onSelect }: {
  game: EconomyState;
  route: TransportPlanningRoute;
  now: number;
  provinceById: Map<string, ProvinceDefinition>;
  disabled: boolean;
  onSelect: (mode: TransportModeId) => void;
}) {
  return (
    <div className="transport-mode-comparison" role="group" aria-label="运输方式比较">
      {(Object.keys(TRANSPORT_MODES) as TransportModeId[]).map((mode) => {
        const candidate = { ...route, mode };
        const setupCost = transportRouteSetupCost(candidate, mode, provinceById);
        const creditsAfterSetup = Math.max(0, Math.round((game.credits - setupCost) * 1_000_000) / 1_000_000);
        const estimate = estimateTransportRoute({ ...game, credits: creditsAfterSetup }, candidate, now, provinceById);
        const waitingLabel = game.credits < setupCost ? '建线资金不足' : TRANSPORT_WAITING_LABELS[estimate.reason];
        const selected = mode === route.mode;
        return (
          <div className="transport-mode-option" key={mode} data-transport-mode-option={mode} data-selected={selected}>
            <Button variant={selected ? 'primary' : 'secondary'} disabled={disabled} aria-pressed={selected} onClick={() => onSelect(mode)}>
              {TRANSPORT_MODES[mode].name}
            </Button>
            <div className="transport-route-summary-grid">
              <span><small>一次性建线费</small><strong>{formatCurrency(setupCost)}</strong></span>
              <span><small>周期总费用</small><strong>{formatCurrency(estimate.totalCost)}</strong></span>
              <span><small>最大载荷</small><strong data-transport-mode-capacity={estimate.capacity}><CompactNumber value={estimate.capacity} /></strong></span>
              <span><small>预计周期耗时</small><strong>{formatTransportDuration(estimate.durationMs)}</strong></span>
              <span><small><TransportGainExplanation>预计运输增益</TransportGainExplanation></small><strong>{estimate.netGain === null ? '待行情同步' : formatCurrency(estimate.netGain)}</strong></span>
            </div>
            <StatusTag tone={estimate.reason === 'ready' ? 'info' : 'neutral'}>{waitingLabel}</StatusTag>
          </div>
        );
      })}
    </div>
  );
}
