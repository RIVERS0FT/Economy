import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  facilityStatusNames,
  facilityStopReasonNames,
  type LoadedGameViewModel,
} from '../app/gameViewModel';
import { FacilityGroupProgress } from '../components/facilities/FacilityProgress';
import { WarehouseUpgradeCard } from '../components/warehouse/WarehouseUpgradeCard';
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
    listFacility,
    cancelFacilityListing,
    showResult,
  } = model;
  const [planModes, setPlanModes] = useState<Record<string, ProductionMode>>({});
  const [planTargets, setPlanTargets] = useState<Record<string, number>>({});
  const [listingQuantities, setListingQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    setPlanModes((current) => {
      const next = { ...current };
      for (const group of game.facilityGroups) next[group.facilityTypeId] ??= group.productionMode;
      return next;
    });
    setPlanTargets((current) => {
      const next = { ...current };
      for (const group of game.facilityGroups) {
        const type = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
        const cycleOutput = Math.max(1, (type?.output.quantity ?? 1) * Math.max(1, group.nextCycleCount));
        next[group.facilityTypeId] ??= group.targetQuantity || cycleOutput * 10;
      }
      return next;
    });
    setListingQuantities((current) => {
      const next = { ...current };
      for (const group of game.facilityGroups) next[group.facilityTypeId] ??= 1;
      return next;
    });
  }, [game.facilityGroups, game.facilityTypes]);

  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
  );
  const hasConstruction = Boolean(game.facilityConstruction);

  function productName(productId?: string) {
    if (!productId) return '无';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  if (!selectedType) {
    return <PageLayout title="工厂" description="服务器尚未返回工厂目录。"><Panel className="empty-state">暂无工厂类型。</Panel></PageLayout>;
  }

  const constructionType = game.facilityConstruction
    ? game.facilityTypes.find((type) => type.id === game.facilityConstruction?.facilityTypeId)
    : undefined;
  const constructionRemaining = game.facilityConstruction
    ? Math.max(0, game.facilityConstruction.completesAt - now)
    : 0;

  return (
    <PageLayout
      title="工厂"
      description="同类未挂牌工厂共享统一生产周期、生产计划和启停状态；挂牌工厂不参与生产，新建、收购或撤销挂牌的数量从下一周期加入。"
      actions={
        <>
          <StatusTag tone="success">运行 {model.derived.runningFacilities}</StatusTag>
          <StatusTag tone="warning">施工 {model.derived.constructingFacilities}</StatusTag>
          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>阻塞 {model.derived.blockedFacilities}</StatusTag>
        </>
      }
    >
      <WarehouseUpgradeCard model={model} className="factory-warehouse-card" />

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
            <DataRow label="单座周期产量" value={`${selectedType.output.quantity} ${productName(selectedType.output.productId)}`} />
            <DataRow label="单座周期成本" value={`¤ ${selectedType.operatingCost}`} />
            <DataRow label="产成品去向" value="直接进入共享仓库" tone="info" />
          </DataList>
          {game.facilityConstruction ? (
            <div className="construction-status">
              <strong>{constructionType?.name ?? '工厂'}施工中</strong>
              <span>剩余 {formatDuration(constructionRemaining)}</span>
              <small>建成后不会重置当前集群进度，将在下一生产周期加入。</small>
            </div>
          ) : null}
          <Button
            block
            onClick={() => void showResult(buildFacility(selectedType.id))}
            disabled={hasConstruction || game.credits < selectedType.buildCost}
          >
            {hasConstruction ? '已有工厂正在施工' : `建设${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">工厂以类型和数量保存，不存在单座实例；同一时间只能施工一座工厂。</small>
        </Panel>

        <div className="facility-list facility-group-list">
          {game.facilityGroups.map((group) => {
            const type = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
            if (!type) return null;
            const mode = planModes[group.facilityTypeId] ?? group.productionMode;
            const currentCount = group.status === 'running' ? group.participatingCount : group.availableCount;
            const nextCount = group.nextCycleCount;
            const currentCycleOutput = type.output.quantity * currentCount;
            const currentCycleCost = type.operatingCost * currentCount;
            const nextCycleOutput = type.output.quantity * nextCount;
            const target = planTargets[group.facilityTypeId] ?? group.targetQuantity ?? Math.max(1, nextCycleOutput) * 10;
            const inputName = productName(type.input?.productId);
            const outputName = productName(type.output.productId);
            const inputInventory = type.input ? game.inventories[type.input.productId]?.available ?? 0 : null;
            const outputInventory = game.inventories[type.output.productId]?.available ?? 0;
            const remainingTarget = group.productionMode === 'target'
              ? Math.max(0, (group.targetQuantity || 0) - group.completedQuantity)
              : null;
            const ownListings = game.facilityListings.filter((listing) => (
              listing.ownerId === game.userId && listing.facilityTypeId === group.facilityTypeId
            ));
            const canConfigure = group.status !== 'running' && group.availableCount > 0;
            const canStart = group.status !== 'running' && group.availableCount > 0;
            const canList = group.status !== 'running' && group.availableCount > 0;
            const unitPrice = listingPrices[group.facilityTypeId] ?? type.systemValue;
            const listingQuantity = Math.min(
              Math.max(1, listingQuantities[group.facilityTypeId] ?? 1),
              Math.max(1, group.availableCount),
            );
            const planStep = Math.max(1, type.output.quantity * Math.max(1, group.nextCycleCount));

            return (
              <Panel className="facility-card facility-group-card" key={group.facilityTypeId}>
                <div className="facility-card-head">
                  <div>
                    <StatusTag tone={facilityTone(group.status)}>{facilityStatusNames[group.status]}</StatusTag>
                    <h2>{type.name} × {group.count}</h2>
                    <p>
                      {type.input
                        ? `${type.input.quantity} ${inputName} → ${type.output.quantity} ${outputName}`
                        : `无原料 → ${type.output.quantity} ${outputName}`}
                    </p>
                    {group.stopReason ? <small className="facility-stop-reason">{facilityStopReasonNames[group.stopReason]}</small> : null}
                  </div>
                  <div className="facility-output">
                    <strong>{outputInventory}</strong>
                    <span>仓库{outputName}</span>
                  </div>
                </div>

                <div className="facility-group-counts">
                  <span>当前参与 <strong>{group.participatingCount}</strong></span>
                  <span>下一周期 <strong>{group.nextCycleCount}</strong></span>
                  <span>待加入 <strong>{group.pendingJoinCount}</strong></span>
                  <span>已挂牌 <strong>{group.listedCount}</strong></span>
                </div>

                <FacilityGroupProgress group={group} type={type} now={now} />

                <div className="facility-specs ui-spec-grid facility-group-specs">
                  <span>周期 <strong>{type.cycleMs / 1000} 秒</strong></span>
                  <span>周期产量 <strong>{currentCycleOutput} {outputName}</strong></span>
                  <span>周期成本 <strong>¤ {currentCycleCost}</strong></span>
                  <span>原料库存 <strong>{inputInventory === null ? '无需原料' : `${inputInventory} ${inputName}`}</strong></span>
                </div>
                {group.pendingJoinCount > 0 ? (
                  <small className="ui-helper-text">下一周期将按 {nextCount} 座结算：产量 {nextCycleOutput} {outputName}，成本 ¤ {type.operatingCost * nextCount}。</small>
                ) : null}

                <div className="production-plan-card">
                  <div className="production-plan-heading">
                    <div>
                      <strong>统一生产计划</strong>
                      <small>
                        {group.productionMode === 'continuous'
                          ? '当前：持续生产'
                          : `当前：${group.completedQuantity}/${group.targetQuantity}，剩余 ${remainingTarget}`}
                      </small>
                    </div>
                    <StatusTag tone={group.productionMode === 'target' ? 'info' : 'neutral'}>
                      {group.productionMode === 'target' ? '定量' : '持续'}
                    </StatusTag>
                  </div>
                  <div className="production-plan-controls">
                    <select
                      aria-label={`${type.name}集群生产模式`}
                      value={mode}
                      disabled={!canConfigure}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setPlanModes((current) => ({
                        ...current,
                        [group.facilityTypeId]: event.target.value as ProductionMode,
                      }))}
                    >
                      <option value="continuous">持续生产</option>
                      <option value="target">定量生产</option>
                    </select>
                    {mode === 'target' ? (
                      <input
                        aria-label={`${type.name}集群计划产量`}
                        type="number"
                        min={planStep}
                        step={planStep}
                        value={target}
                        disabled={!canConfigure}
                        onChange={(event) => setPlanTargets((current) => ({
                          ...current,
                          [group.facilityTypeId]: Number(event.target.value),
                        }))}
                      />
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={!canConfigure}
                      onClick={() => void showResult(setProductionPlan(
                        group.facilityTypeId,
                        mode,
                        mode === 'target' ? target : undefined,
                      ))}
                    >
                      保存计划
                    </Button>
                  </div>
                </div>

                <div className="facility-actions ui-inline-actions">
                  {group.status === 'running' ? (
                    <Button variant="danger" onClick={() => void showResult(stopFacility(group.facilityTypeId))}>停止全部</Button>
                  ) : (
                    <Button disabled={!canStart} onClick={() => void showResult(startFacility(group.facilityTypeId))}>启动全部未挂牌工厂</Button>
                  )}
                  <span className="ui-helper-text">挂牌工厂不参与生产；启动时仅 {group.availableCount} 座未挂牌工厂进入统一周期，产成品自动入仓。</span>
                </div>

                {canList ? (
                  <div className="listing-control facility-group-listing-control">
                    <label>
                      挂牌数量
                      <input
                        aria-label={`${type.name}挂牌数量`}
                        type="number"
                        min="1"
                        max={group.availableCount}
                        value={listingQuantity}
                        onChange={(event) => setListingQuantities((current) => ({
                          ...current,
                          [group.facilityTypeId]: Number(event.target.value),
                        }))}
                      />
                    </label>
                    <label>
                      单座价格
                      <input
                        aria-label={`${type.name}单座挂牌价格`}
                        type="number"
                        min={Math.ceil(type.systemValue * 0.5)}
                        max={type.systemValue * 2}
                        value={unitPrice}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setListingPrices((current) => ({
                          ...current,
                          [group.facilityTypeId]: Number(event.target.value),
                        }))}
                      />
                    </label>
                    <div className="listing-total"><span>挂牌总额</span><strong>¤ {formatCurrency(listingQuantity * unitPrice)}</strong></div>
                    <Button
                      variant="secondary"
                      onClick={() => void showResult(listFacility(group.facilityTypeId, listingQuantity, unitPrice))}
                    >
                      挂牌 {listingQuantity} 座
                    </Button>
                  </div>
                ) : null}

                {ownListings.map((listing) => (
                  <div className="facility-group-own-listing" key={listing.id}>
                    <span>{listing.quantity} 座 · 单价 ¤ {formatCurrency(listing.unitPrice)}</span>
                    <Button variant="danger" onClick={() => void showResult(cancelFacilityListing(listing.id))}>撤销挂牌</Button>
                  </div>
                ))}
              </Panel>
            );
          })}
          {game.facilityGroups.length === 0 ? (
            <Panel className="empty-state tall">尚未拥有工厂集群。先确认共享仓库容量，再建设第一座工厂。</Panel>
          ) : null}
        </div>
      </div>
    </PageLayout>
  );
}
