import { useMemo, useState } from 'react';
import type { OnlineAutoTradeAwareGameViewModel } from '../../auto-trade/useOnlineAutoTrade';
import type { TransportModeId } from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { useNow } from '../../hooks/useNow';
import { parseIntegerDraft } from '../../utils/integerDraft';
import {
  formatTransportDuration,
  provinceDistanceKm,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  TRANSPORT_MODES,
  transportCost,
  transportDurationMs,
} from '../../utils/provinceLogistics';
import { ChevronIcon } from '../icons/GameIcons';
import { ProductIcon } from '../icons/ProductIcons';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { IntegerInput, SelectInput } from '../ui/FormControls';
import { Button, Panel, StatusTag, WidgetHeading } from '../ui/layout';

export function WarehouseInventoryGrid({
  model,
  onOpenProduct,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  onOpenProduct?: (productId: string) => void;
}) {
  const { game } = model;
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
      return inventory.available > 0 || inventory.frozen > 0;
    }),
    [game.inventories, game.products],
  );

  return (
    <section className="warehouse-content" aria-label="仓库商品">
      <div className="warehouse-content-heading">
        <strong>仓库内容</strong>
        <span>实物库存 {formatNumber(game.warehouseStoredQuantity)}</span>
      </div>
      {stockedProducts.length > 0 ? (
        <div className="warehouse-product-grid">
          {stockedProducts.map((product) => {
            const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
            return (
              <button
                type="button"
                className="warehouse-product-card"
                data-ui-interactive="surface"
                key={product.id}
                aria-label={`打开${product.name}详情，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}`}
                onClick={() => onOpenProduct?.(product.id)}
              >
                <span className="warehouse-product-card-name">{product.name}</span>
                <span className="warehouse-product-card-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
                <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                <small className="warehouse-product-card-frozen">冻结 {formatNumber(inventory.frozen)}</small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty-state warehouse-content-empty">
          <strong>仓库中暂无商品</strong>
          <span>通过生产或市场交易获得商品后，会在这里按州级库存显示。</span>
        </div>
      )}
    </section>
  );
}

export function WarehouseTransportPanel({ model }: { model: OnlineAutoTradeAwareGameViewModel }) {
  const { game } = model;
  const now = useNow(game.lastProcessedAt, 1_000);
  const unlockedProvinces = game.unlockedProvinces ?? [];
  const transportShipments = game.transportShipments ?? [];
  const [transportProductId, setTransportProductId] = useState('');
  const [transportQuantity, setTransportQuantity] = useState('');
  const [transportDestination, setTransportDestination] = useState('');
  const [transportMode, setTransportMode] = useState<TransportModeId>('road');
  const transportableProducts = useMemo(
    () => game.products.filter((product) => (game.inventories[product.id]?.available ?? 0) > 0),
    [game.inventories, game.products],
  );
  const destinations = useMemo(
    () => game.provinces.filter((province) => (
      province.id !== model.selectedProvinceId
      && (unlockedProvinces.includes(province.id) || game.startingProvinceId === province.id)
    )),
    [game.provinces, game.startingProvinceId, model.selectedProvinceId, unlockedProvinces],
  );
  const selectedDestination = destinations.find((province) => province.id === transportDestination);
  const selectedSource = game.provinces.find((province) => province.id === model.selectedProvinceId)
    ?? game.provinces[0];
  const distanceKm = selectedDestination && selectedSource
    ? provinceDistanceKm(selectedSource, selectedDestination)
    : 0;
  const parsedQuantity = parseIntegerDraft(transportQuantity, { min: 1 });
  const estimatedCost = parsedQuantity !== null && selectedDestination
    ? transportCost(transportMode, parsedQuantity, distanceKm)
    : 0;
  const estimatedDurationMs = selectedDestination
    ? transportDurationMs(transportMode, distanceKm)
    : 0;
  const inTransitCount = transportShipments.filter((shipment) => shipment.status === 'in-transit').length;
  const activeShipments = transportShipments
    .filter((shipment) => shipment.status === 'in-transit')
    .sort((left, right) => left.arrivesAt - right.arrivesAt);

  function submitTransport() {
    if (parsedQuantity === null || !transportProductId || !selectedDestination) return;
    const inventory = game.inventories[transportProductId];
    const quantity = Math.min(parsedQuantity, TRANSPORT_MODES[transportMode].capacity, inventory?.available ?? 0);
    if (quantity <= 0) return;
    void model.showResult(model.transportShip({
      sourceProvinceId: model.selectedProvinceId,
      destinationProvinceId: selectedDestination.id,
      productId: transportProductId,
      quantity,
      mode: transportMode,
    }));
  }

  return (
    <Panel className="widget warehouse-transport-panel">
      <WidgetHeading
        title="跨州运输"
        action={<StatusTag tone="neutral">在途 {formatNumber(inTransitCount)} / {TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER}</StatusTag>}
      />
      <section className="warehouse-transport-section" aria-label="跨州运输">
        <div className="transport-dispatch-grid">
          <SelectInput
            label="商品"
            value={transportProductId}
            onChange={(event) => setTransportProductId(event.target.value)}
          >
            <option value="">选择商品</option>
            {transportableProducts.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </SelectInput>
          <IntegerInput
            label="数量"
            value={transportQuantity}
            fallbackValue={1}
            min={1}
            max={TRANSPORT_MODES[transportMode].capacity}
            onValueChange={setTransportQuantity}
          />
          <SelectInput
            label="目的州"
            value={transportDestination}
            onChange={(event) => setTransportDestination(event.target.value)}
          >
            <option value="">选择目的州</option>
            {destinations.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </SelectInput>
          <div className="transport-mode-switch" role="group" aria-label="运输方式">
            {Object.values(TRANSPORT_MODES).map((mode) => (
              <Button
                key={mode.id}
                variant="text"
                className={transportMode === mode.id ? 'transport-mode active' : 'transport-mode'}
                aria-pressed={transportMode === mode.id}
                onClick={() => setTransportMode(mode.id)}
              >
                {mode.name}
                <small>单次 ≤ {formatNumber(mode.capacity)}</small>
              </Button>
            ))}
          </div>
        </div>
        <div className="transport-estimate">
          <span><small>预计费用</small><strong><CurrencyAmount>{formatCurrency(estimatedCost)}</CurrencyAmount></strong></span>
          <span><small>预计耗时</small><strong>{formatTransportDuration(estimatedDurationMs)}</strong></span>
          <span><small>距离</small><strong>约 {formatNumber(Math.round(distanceKm))} 公里</strong></span>
        </div>
        <Button
          block
          className="transport-submit"
          disabled={!transportProductId || parsedQuantity === null || !selectedDestination}
          onClick={submitTransport}
        >
          {!transportProductId
            ? '请选择运输商品'
            : parsedQuantity === null
              ? '请输入有效数量'
              : !selectedDestination
                ? '请选择目的州'
                : `通过${TRANSPORT_MODES[transportMode].name}发运`}
        </Button>
        {activeShipments.length > 0 ? (
          <ul className="transport-shipment-list" aria-label="进行中运输">
            {activeShipments.map((shipment) => {
              const product = game.products.find((entry) => entry.id === shipment.productId);
              const destination = game.provinces.find((province) => province.id === shipment.destinationProvinceId);
              const remainingMs = Math.max(0, shipment.arrivesAt - now);
              return (
                <li key={shipment.id} className="transport-shipment-row">
                  <span className="transport-shipment-product">{product?.name ?? shipment.productId}</span>
                  <span>×{formatNumber(shipment.quantity)}</span>
                  <span>{TRANSPORT_MODES[shipment.mode]?.name ?? shipment.mode}</span>
                  <span className="transport-shipment-destination">
                    <ChevronIcon direction="right" />
                    {destination?.name ?? shipment.destinationProvinceId}
                  </span>
                  <span className="transport-shipment-eta">{formatTransportDuration(remainingMs)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted transport-empty">当前没有进行中的运输。</p>
        )}
      </section>
    </Panel>
  );
}

export function WarehouseInventoryPanel({
  model,
  className = '',
  onOpenProduct,
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  className?: string;
  onOpenProduct?: (productId: string) => void;
}) {
  return (
    <div className={`warehouse-inventory-panel ${className}`.trim()}>
      <div className="warehouse-capacity-status">
        <StatusTag tone="neutral">无限容量</StatusTag>
      </div>
      <WarehouseInventoryGrid model={model} onOpenProduct={onOpenProduct} />
      <WarehouseTransportPanel model={model} />
    </div>
  );
}