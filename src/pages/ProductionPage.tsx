import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
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
  SwitchControl,
  type StatusTone,
  WidgetHeading,
} from '../components/ui/layout';
import type { FacilityGroup, ProductionMode } from '../types';
import { formatCurrency, formatDuration } from '../utils/formatters';

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function facilityStatusLabel(group: FacilityGroup) {
  if (group.status === 'running') return '运行';
  if (group.status === 'stopped') {
    return group.statusReason === 'plan_complete' ? '停止：计划完成' : '停止';
  }
  switch (group.statusReason) {
    case 'warehouse_full': return '异常：仓库已满';
    case 'insufficient_funds': return '异常：资金不足';
    case 'insufficient_input': return '异常：原料不足';
    case 'plan_adjustment_required': return '异常：计划不兼容';
    case 'no_available_facility': return '异常：无可运行工厂';
    case 'maintenance': return '异常：维护中';
    default: return '异常：生产条件不足';
  }
}

export function ProductionPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    now,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    buildFacility,
    startFacility,
    stopFacility,
    setProductionPlan,
    selectMarketAsset,
    showResult,
  } = model;
  const [planModes, setPlanModes] = useState<Record<string, ProductionMode>>({});
  const [planTargets, setPlanTargets] = useState<Record<string, number>>({});

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
      description="同类未冻结工厂共享生产周期和计划；工厂卖单会立即冻结对应数量并降低产量。"
      actions={(
        <>
          <StatusTag tone="success">运行 {model.derived.runningFacilities}</StatusTag>
          <StatusTag tone="neutral">停止 {model.derived.stoppedFacilities}</StatusTag>
          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>异常 {model.derived.blockedFacilities}</StatusTag>
          {model.derived.constructingFacilities > 0 ? <StatusTag tone="warning">施工 {model.derived.constructingFacilities}</StatusTag> : null}
        </>
      )}
    >
      <WarehouseUpgradeCard model={model} className="factory-warehouse-card" />

      <div className="production-grid">
        <Panel className="widget build-card production-build-card">
          <WidgetHeading title="建设新工厂" />
          <label>
            工厂类型
            <select value={selectedType.id} onChange={(event) => setSelectedFacilityTypeId(event.target.value)}>
              {game.facilityTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}
            </select>
          </label>
          <div className="facility-type-summary">
            <h3>{selectedType.name}</h3>
            <p>{selectedType.input
              ? `${selectedType.input.quantity} ${productName(selectedType.input.productId)} → ${selectedType.output.quantity} ${productName(selectedType.output.productId)}`
              : `无原料 → ${selectedType.output.quantity} ${productName(selectedType.output.productId)}`}</p>
          </div>
          <DataList>
            <DataRow label="建造费用" value={`¤ ${formatCurrency(selectedType.buildCost)}`} tone="danger" />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
            <DataRow label="生产周期" value={`${selectedType.cycleMs / 1000} 秒`} />
            <DataRow label="单座周期产量" value={`${selectedType.output.quantity} ${productName(selectedType.output.productId)}`} />
            <DataRow label="单座周期成本" value={`¤ ${selectedType.operatingCost}`} />
          </DataList>
          {game.facilityConstruction ? (
            <div className="construction-status">
              <strong>{constructionType?.name ?? '工厂'}施工中</strong>
              <span>剩余 {formatDuration(constructionRemaining)}</span>
              <small>建成后不会重置当前集群进度，将在下一生产周期加入。</small>
            </div>
          ) : null}
          <Button block onClick={() => void showResult(buildFacility(selectedType.id))} disabled={hasConstruction || game.credits < selectedType.buildCost}>
            {hasConstruction ? '已有工厂正在施工' : `建设${selectedType.name}`}
          </Button>
          <small className="ui-helper-text">工厂按类型和数量保存；同一时间只能施工一座工厂。</small>
        </Panel>

        <div className="facility-list facility-group-list">
          {game.facilityGroups.map((group) => {
            const type = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
            if (!type) return null;
            const mode = planModes[group.facilityTypeId] ?? group.productionMode;
            const currentCount = group.status === 'running' ? group.participatingCount : group.availableCount;
            const currentCycleOutput = type.output.quantity * currentCount;
            const currentCycleCost = type.operatingCost * currentCount;
            const target = planTargets[group.facilityTypeId] ?? group.targetQuantity ?? Math.max(1, type.output.quantity * Math.max(1, group.nextCycleCount)) * 10;
            const inputName = productName(type.input?.productId);
            const outputName = productName(type.output.productId);
            const inputInventory = type.input ? game.inventories[type.input.productId]?.available ?? 0 : null;
            const cycleInput = type.input ? type.input.quantity * currentCount : 0;
            const remainingTarget = group.productionMode === 'target'
              ? Math.max(0, (group.targetQuantity || 0) - group.completedQuantity)
              : null;
            const canConfigure = group.nextCycleCount > 0;
            const planStep = Math.max(1, type.output.quantity * Math.max(1, group.nextCycleCount));
            const pendingPlan = group.pendingProductionPlan;

            return (
              <Panel className="facility-card facility-group-card" key={group.facilityTypeId}>
                <div className="facility-card-head facility-status-header">
                  <div className="facility-status-copy">
                    <div className="facility-status-title">
                      <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
                      <h2>{type.name} × {group.count}</h2>
                    </div>
                    <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
                      <span>运行中 <strong>{group.participatingCount}</strong></span>
                      <span>下一周期加入 <strong>{group.pendingJoinCount}</strong></span>
                      <span>冻结中 <strong>{group.listedCount}</strong></span>
                    </div>
                  </div>
                  <SwitchControl
                    checked={group.enabled}
                    aria-label={group.enabled ? `停止${type.name}生产` : `开启${type.name}生产`}
                    title={group.enabled ? '停止生产' : '开启自动运行'}
                    disabled={group.count < 1}
                    onChange={(event) => void showResult(event.target.checked
                      ? startFacility(group.facilityTypeId)
                      : stopFacility(group.facilityTypeId))}
                  />
                </div>

                <div className="facility-specs ui-spec-grid facility-group-specs">
                  <span>周期 <strong>{type.cycleMs / 1000} 秒</strong></span>
                  <span>产量 <strong>{currentCycleOutput} {outputName}</strong></span>
                  <span>成本 <strong>¤ {currentCycleCost}</strong></span>
                  <span>原料 <strong>{inputInventory === null ? '无' : `${cycleInput} ${inputName} · 库存 ${inputInventory}`}</strong></span>
                </div>

                <FacilityGroupProgress group={group} type={type} now={now} />

                <div className="production-plan-card">
                  <div className="production-plan-summary">
                    <strong>{group.productionMode === 'continuous'
                      ? '当前计划：持续运行'
                      : `当前计划：定量生产 ${group.targetQuantity} 个 · 已完成 ${group.completedQuantity} · 剩余 ${remainingTarget}`}</strong>
                    {pendingPlan ? <small>下一周期：{pendingPlan.mode === 'continuous' ? '持续运行' : `定量生产 ${pendingPlan.targetQuantity} 个`}</small> : null}
                  </div>
                  <div className="production-plan-controls">
                    <select
                      aria-label={`${type.name}集群生产模式`}
                      value={mode}
                      disabled={!canConfigure}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => setPlanModes((current) => ({ ...current, [group.facilityTypeId]: event.target.value as ProductionMode }))}
                    >
                      <option value="continuous">持续运行</option>
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
                        onChange={(event) => setPlanTargets((current) => ({ ...current, [group.facilityTypeId]: Number(event.target.value) }))}
                      />
                    ) : null}
                    <Button
                      variant="secondary"
                      disabled={!canConfigure}
                      onClick={() => void showResult(setProductionPlan(group.facilityTypeId, mode, mode === 'target' ? target : undefined))}
                    >保存计划</Button>
                  </div>
                </div>

                <div className="facility-market-link-row">
                  <span>在统一订单簿中买卖该工厂</span>
                  <Button variant="text" onClick={() => selectMarketAsset('facility', group.facilityTypeId)}>前往市场 →</Button>
                </div>
              </Panel>
            );
          })}
          {game.facilityGroups.length === 0 ? <Panel className="empty-state tall">尚未拥有工厂集群。先确认共享仓库容量，再建设第一座工厂。</Panel> : null}
        </div>
      </div>
    </PageLayout>
  );
}
