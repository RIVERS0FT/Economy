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
import { ProductIcon } from '../icons/ProductIcons';
import { CurrencyAmount } from '../ui/CurrencyAmount';
import { IntegerInput, SelectInput } from '../ui/FormControls';
import { Button, Panel, StatusTag, WidgetHeading } from '../ui/layout';

export function WarehouseInventoryPanel({
  model,
  className = '',
}: {
  model: OnlineAutoTradeAwareGameViewModel;
  className?: string;
}) {
  const { game } = model;
  const now = useNow(game.lastProcessedAt, 1_000);
  const [transportProductId, setTransportProductId] = useState('');
  const [transportQuantity, setTransportQuantity] = useState('');
  const [transportDestination, setTransportDestination] = useState('');
  const [transportMode, setTransportMode] = useState<TransportModeId>('road');
  const stockedProducts = useMemo(
    () => game.products.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
      return inventory.available > 0 || inventory.frozen > 0 || inventory.inTransit > 0;
    }),
    [game.inventories, game.products],
  );
  const transportableProducts = useMemo(
    () => stockedProducts.filter((product) => {
      const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
      return inventory.available > 0;
    }),
    [game.inventories, stockedProducts],
  );
  const destinations = useMemo(
    () => game.provinces.filter((province) => (
      province.id !== model.selectedProvinceId
      && (game.unlockedProvinces.includes(province.id) || game.startingProvinceId === province.id)
    )),
    [game.provinces, game.startingProvinceId, game.unlockedProvinces, model.selectedProvinceId],
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
  const inTransitCount = game.transportShipments.filter((shipment) => shipment.status === 'in-transit').length;
  const activeShipments = game.transportShipments
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
    <Panel className={`production-surface warehouse-inventory-panel warehouse-only-panel ${className}`.trim()}>
      <WidgetHeading
        title="共享仓库"
        action={<StatusTag tone="neutral">无限容量</StatusTag>}
      />
      <section className="warehouse-content" aria-label="仓库内容">
        <header className="warehouse-content-heading">
          <strong>仓库内容</strong>
          <span>实物库存 {formatNumber(game.warehouseStoredQuantity)}</span>
        </header>
        {stockedProducts.length > 0 ? (
          <div className="warehouse-product-grid">
            {stockedProducts.map((product) => {
              const inventory = game.inventories[product.id] ?? { available: 0, frozen: 0, inTransit: 0 };
              return (
                <article
                  className="warehouse-product-card warehouse-product-card--readonly"
                  key={product.id}
                  aria-label={`${product.name}，可用 ${formatNumber(inventory.available)}，冻结 ${formatNumber(inventory.frozen)}，在途 ${formatNumber(inventory.inTransit)}`}
                >
                  <span className="warehouse-product-card-name">{product.name}</span>
                  <span className="warehouse-product-card-icon" aria-hidden="true"><ProductIcon productId={product.id} /></span>
                  <strong className="warehouse-product-card-available">可用 {formatNumber(inventory.available)}</strong>
                  <small className="warehouse-product-card-frozen">冻结 {formatNumber(inventory.frozen)}</small>
                  {inventory.inTransit > 0 ? (
                    <small className="warehouse-product-card-in-transit">在途 {formatNumber(inventory.inTransit)}</small>
                  ) : null}
                </article>
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
      <section className="warehouse-transport-section" aria-label="跨州运输">
        <header className="warehouse-content-heading">
          <strong>跨州运输</strong>
          <span>在途 {formatNumber(inTransitCount)} / {TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER}</span>
        </header>
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
            {(Object.values(TRANSPORT_MODES)).map((mode) => (
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
                  <span>→ {destination?.name ?? shipment.destinationProvinceId}</span>
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
