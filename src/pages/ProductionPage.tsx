import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  facilityStatusNames,
  facilityStopReasonNames,
  type LoadedGameViewModel,
} from '../app/gameViewModel';
import { FacilityProgress } from '../components/facilities/FacilityProgress';
import {
  Button,
  DataList,
  DataRow,
  PageLayout,
  Panel,
  StatusTag,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import type { ProductionMode } from '../types';
import { formatCurrency, formatDuration } from '../utils/formatters';

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'constructing') return 'warning';
  if (status === 'listed') return 'info';
  if (['full', 'insufficient_funds', 'insufficient_input'].includes(status)) return 'danger';
  return 'neutral';
}

export function ProductionPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    now,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    listingPrices,
    setListingPrices,
    buildFacility,
    startFacility,
    stopFacility,
    setProductionPlan,
    collectFacility,
    listFacility,
    cancelFacilityListing,
    showResult,
  } = model;
  const [planModes, setPlanModes] = useState<Record<string, ProductionMode>>({});
  const [planTargets, setPlanTargets] = useState<Record<string, number>>({});

  useEffect(() => {
    setPlanModes((current) => {
      const next = { ...current };
      for (const facility of game.facilities) next[facility.id] ??= facility.productionMode;
      return next;
    });
    setPlanTargets((current) => {
      const next = { ...current };
      for (const facility of game.facilities) {
        next[facility.id] ??= facility.targetQuantity || facility.outputPerCycle * 10;
      }
      return next;
    });
  }, [game.facilities]);

  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
  );
  const hasConstruction = game.facilities.some((facility) => facility.status === 'constructing');

  function productName(productId?: string) {
    if (!productId) return '无';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  if (!selectedType) {
    return <PageLayout title="生产" description="服务器尚未返回工厂目录。"><Panel className="empty-state">暂无工厂类型。</Panel></PageLayout>;
  }

  return (
    <PageLayout
      title="生产"
      description="自由持有工厂，设置生产计划，并手动控制每座工厂的启动与停止。"
      actions={
        <>
          <StatusTag tone="success">运行 {model.derived.runningFacilities}</StatusTag>
          <StatusTag tone="warning">施工 {model.derived.constructingFacilities}</StatusTag>
          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>阻塞 {model.derived.blockedFacilities}</StatusTag>
        </>
      }
    >
      <div className="production-grid">
        <Panel className="widget build-card">
          <WidgetHeading title="建设新工厂" />
          <label>
            工厂类型
            <select value={selectedType.id} onChange={(event) => setSelectedFacilityTypeId(event.target.value)}>
              {game.facilityTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}
            </select>
          </label>
          <div className="facility-type-summary">
            <h3>{selectedType.name}</h3>
            <p>
              {selectedType.input
                ? `${selectedType.input.quantity} ${productName(selectedType.input.productId)} → ${selectedType.output.quantity} ${productName(selectedType.output.productId)}`
                : `无原料 → ${selectedType.output.quantity} ${productName(selectedType.output.productId)}`}
            </p>
          </div>
          <DataList>
            <DataRow label="建造费用" value={`¤ ${formatCurrency(selectedType.buildCost)}`} tone="danger" />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
            <DataRow label="生产周期" value={`${selectedType.cycleMs / 1000} 秒`} />
            <DataRow label="周期产出" value={`${selectedType.output.quantity} ${productName(selectedType.output.productId)}`} />
            <DataRow label="运营费用" value={`¤ ${selectedType.operatingCost} / 周期`} />
            <DataRow label="内部容量" value={selectedType.internalCapacity} />
          </DataList>
          <Button
            block
            onClick={() => void showResult(buildFacility(selectedType.id))}
            disabled={hasConstruction || game.credits < selectedType.buildCost}
          >
            {hasConstruction ? '已有工厂正在施工' : `建设${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">工厂持有数量不设上限；为控制施工节奏，同一时间只能施工一座工厂。</small>
        </Panel>

        <div className="facility-list">
          {game.facilities.map((facility) => {
            const listingPrice = listingPrices[facility.id] ?? facility.systemValue;
            const mode = planModes[facility.id] ?? facility.productionMode;
            const target = planTargets[facility.id] ?? facility.targetQuantity ?? facility.outputPerCycle * 10;
            const hourlyCycles = Math.floor(3_600_000 / facility.cycleMs);
            const hourlyOutput = hourlyCycles * facility.outputPerCycle;
            const hourlyCost = hourlyCycles * facility.operatingCost;
            const inputName = productName(facility.inputProductId);
            const outputName = productName(facility.outputProductId);
            const inputInventory = facility.inputProductId ? game.inventories[facility.inputProductId]?.available ?? 0 : null;
            const remainingTarget = facility.productionMode === 'target'
              ? Math.max(0, (facility.targetQuantity || 0) - facility.completedQuantity)
              : null;
            const canConfigure = !['running', 'constructing', 'listed'].includes(facility.status);
            const canStart = !['running', 'constructing', 'listed'].includes(facility.status);
            return (
              <Panel className="facility-card" key={facility.id}>
                <div className="facility-card-head">
                  <div>
                    <StatusTag tone={facilityTone(facility.status)}>{facilityStatusNames[facility.status]}</StatusTag>
                    <h2>{facility.name}</h2>
                    <p>
                      {facility.inputProductId
                        ? `${facility.inputPerCycle} ${inputName} → ${facility.outputPerCycle} ${outputName}`
                        : `无原料 → ${facility.outputPerCycle} ${outputName}`}
                    </p>
                    {facility.stopReason ? <small className="facility-stop-reason">{facilityStopReasonNames[facility.stopReason]}</small> : null}
                  </div>
                  <div className="facility-output">
                    <strong>{facility.internalGoods}/{facility.internalCapacity}</strong>
                    <span>内部{outputName}</span>
                  </div>
                </div>

                <FacilityProgress facility={facility} now={now} />

                <div className="facility-specs ui-spec-grid">
                  <span>周期 <strong>{facility.cycleMs / 1000} 秒</strong></span>
                  <span>小时产量 <strong>{hourlyOutput} {outputName}</strong></span>
                  <span>小时运营费 <strong>¤ {hourlyCost}</strong></span>
                  <span>原料库存 <strong>{inputInventory === null ? '无需原料' : `${inputInventory} ${inputName}`}</strong></span>
                  <span>累计产量 <strong>{facility.lifetimeOutput}</strong></span>
                  <span>参考估值 <strong>¤ {facility.systemValue}</strong></span>
                </div>

                <div className="production-plan-card">
                  <div className="production-plan-heading">
                    <div>
                      <strong>生产计划</strong>
                      <small>
                        {facility.productionMode === 'continuous'
                          ? '当前：持续生产'
                          : `当前：${facility.completedQuantity}/${facility.targetQuantity}，剩余 ${remainingTarget}`}
                      </small>
                    </div>
                    <StatusTag tone={facility.productionMode === 'target' ? 'info' : 'neutral'}>
                      {facility.productionMode === 'target' ? '定量' : '持续'}
                    </StatusTag>
                  </div>
                  <div className="production-plan-controls">
                    <select
                      aria-label={`${facility.name}生产模式`}
                      value={mode}
                      disabled={!canConfigure}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setPlanModes((current) => ({
                        ...current,
                        [facility.id]: event.target.value as ProductionMode,
                      }))}
                    >
                      <option value="continuous">持续生产</option>
                      <option value="target">定量生产</option>
                    </select>
                    {mode === 'target' ? (
                      <input
                        aria-label={`${facility.name}计划产量`}
                        type="number"
                        min={facility.outputPerCycle}
                        step={facility.outputPerCycle}
                        value={target}
                        disabled={!canConfigure}
                        onChange={(event) => setPlanTargets((current) => ({
                          ...current,
                          [facility.id]: Number(event.target.value),
                        }))}
                      />
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={!canConfigure}
                      onClick={() => void showResult(setProductionPlan(
                        facility.id,
                        mode,
                        mode === 'target' ? target : undefined,
                      ))}
                    >
                      保存计划
                    </Button>
                  </div>
                </div>

                <div className="facility-actions ui-inline-actions">
                  {facility.status === 'running' ? (
                    <Button variant="danger" onClick={() => void showResult(stopFacility(facility.id))}>停止生产</Button>
                  ) : (
                    <Button disabled={!canStart} onClick={() => void showResult(startFacility(facility.id))}>启动生产</Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={facility.internalGoods <= 0}
                    onClick={() => void showResult(collectFacility(facility.id))}
                  >
                    领取{outputName}
                  </Button>
                </div>

                {canConfigure ? (
                  <div className="listing-control">
                    <input
                      aria-label={`${facility.name}挂牌价格`}
                      type="number"
                      min={Math.ceil(facility.systemValue * 0.5)}
                      max={facility.systemValue * 2}
                      value={listingPrice}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setListingPrices((current) => ({
                        ...current,
                        [facility.id]: Number(event.target.value),
                      }))}
                    />
                    <Button variant="secondary" onClick={() => void showResult(listFacility(facility.id, listingPrice))}>挂牌出售</Button>
                  </div>
                ) : null}
                {facility.status === 'listed' && facility.listedOrderId ? (
                  <Button
                    block
                    variant="danger"
                    className="facility-cancel-listing"
                    onClick={() => void showResult(cancelFacilityListing(facility.listedOrderId as string))}
                  >
                    撤销工厂挂牌
                  </Button>
                ) : null}
              </Panel>
            );
          })}
          {game.facilities.length === 0 ? (
            <Panel className="empty-state tall">尚未拥有工厂。选择产业方向并建设第一座工厂。</Panel>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}
