import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
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
import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';

type PlanSaveStatus = 'idle' | 'saving' | 'error';

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

function validPlanTarget(value: string, step: number) {
  const target = Number(value);
  if (!Number.isInteger(target) || target < step || target % step !== 0) return null;
  return target;
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
    notify,
  } = model;
  const [planModes, setPlanModes] = useState<Record<string, ProductionMode>>({});
  const [planTargets, setPlanTargets] = useState<Record<string, string>>({});
  const [planSaveStatuses, setPlanSaveStatuses] = useState<Record<string, PlanSaveStatus>>({});
  const planSaveTimers = useRef<Record<string, number>>({});
  const planSaveChains = useRef<Record<string, Promise<void>>>({});
  const planSaveVersions = useRef<Record<string, number>>({});

  useEffect(() => {
    setPlanModes((current) => {
      const next = { ...current };
      for (const group of game.facilityGroups) {
        next[group.facilityTypeId] ??= group.pendingProductionPlan?.mode ?? group.productionMode;
      }
      return next;
    });
    setPlanTargets((current) => {
      const next = { ...current };
      for (const group of game.facilityGroups) {
        const type = game.facilityTypes.find((item) => item.id === group.facilityTypeId);
        const cycleOutput = Math.max(1, (type?.output.quantity ?? 1) * Math.max(1, group.nextCycleCount));
        const pendingTarget = group.pendingProductionPlan?.mode === 'target'
          ? group.pendingProductionPlan.targetQuantity
          : undefined;
        next[group.facilityTypeId] ??= String(pendingTarget || group.targetQuantity || cycleOutput * 10);
      }
      return next;
    });
  }, [game.facilityGroups, game.facilityTypes]);

  useEffect(() => () => {
    for (const timer of Object.values(planSaveTimers.current)) window.clearTimeout(timer);
  }, []);

  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
  );
  const hasConstruction = Boolean(game.facilityConstruction);

  function productName(productId?: string) {
    if (!productId) return '无';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
  }

  function clearPlanSaveTimer(facilityTypeId: string) {
    const timer = planSaveTimers.current[facilityTypeId];
    if (timer !== undefined) window.clearTimeout(timer);
    delete planSaveTimers.current[facilityTypeId];
  }

  function queuePlanSave(facilityTypeId: string, mode: ProductionMode, targetQuantity?: number) {
    const version = (planSaveVersions.current[facilityTypeId] ?? 0) + 1;
    planSaveVersions.current[facilityTypeId] = version;
    setPlanSaveStatuses((current) => ({ ...current, [facilityTypeId]: 'saving' }));

    const previous = planSaveChains.current[facilityTypeId] ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        const result = await setProductionPlan(facilityTypeId, mode, targetQuantity);
        if (planSaveVersions.current[facilityTypeId] !== version) return;
        setPlanSaveStatuses((current) => ({
          ...current,
          [facilityTypeId]: result.ok ? 'idle' : 'error',
        }));
        if (!result.ok) notify(result.message);
      });
    planSaveChains.current[facilityTypeId] = next;
  }

  function scheduleTargetPlanSave(facilityTypeId: string, value: string, step: number) {
    clearPlanSaveTimer(facilityTypeId);
    const target = validPlanTarget(value, step);
    if (target === null) return;
    planSaveTimers.current[facilityTypeId] = window.setTimeout(() => {
      delete planSaveTimers.current[facilityTypeId];
      queuePlanSave(facilityTypeId, 'target', target);
    }, 500);
  }

  function flushTargetPlanSave(facilityTypeId: string, value: string, step: number) {
    clearPlanSaveTimer(facilityTypeId);
    const target = validPlanTarget(value, step);
    if (target !== null) queuePlanSave(facilityTypeId, 'target', target);
  }

  if (!selectedType) {
    return <PageLayout title="生产" description="服务器尚未返回工厂目录。"><Panel className="empty-state">暂无工厂类型。</Panel></PageLayout>;
  }

  const constructionType = game.facilityConstruction
    ? game.facilityTypes.find((type) => type.id === game.facilityConstruction?.facilityTypeId)
    : undefined;
  const constructionRemaining = game.facilityConstruction
    ? Math.max(0, game.facilityConstruction.completesAt - now)
    : 0;

  return (
    <PageLayout
      title="生产"
      description="同类未冻结工厂共享生产周期和计划；工厂卖单会立即冻结对应数量并降低产量。"
      actions={(
        <>
          <StatusTag tone="success">运行 {formatNumber(model.derived.runningFacilities)}</StatusTag>
          <StatusTag tone="neutral">停止 {formatNumber(model.derived.stoppedFacilities)}</StatusTag>
          <StatusTag tone={model.derived.blockedFacilities > 0 ? 'danger' : 'neutral'}>异常 {formatNumber(model.derived.blockedFacilities)}</StatusTag>
          {model.derived.constructingFacilities > 0 ? <StatusTag tone="warning">施工 {formatNumber(model.derived.constructingFacilities)}</StatusTag> : null}
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
              ? `${formatNumber(selectedType.input.quantity)} ${productName(selectedType.input.productId)} → ${formatNumber(selectedType.output.quantity)} ${productName(selectedType.output.productId)}`
              : `无原料 → ${formatNumber(selectedType.output.quantity)} ${productName(selectedType.output.productId)}`}</p>
          </div>
          <DataList>
            <DataRow label="建造费用" value={`¤ ${formatCurrency(selectedType.buildCost)}`} tone="danger" />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
            <DataRow label="生产周期" value={`${formatNumber(selectedType.cycleMs / 1000)} 秒`} />
            <DataRow label="单座周期产量" value={`${formatNumber(selectedType.output.quantity)} ${productName(selectedType.output.productId)}`} />
            <DataRow label="单座周期成本" value={`¤ ${formatCurrency(selectedType.operatingCost)}`} />
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
            const mode = planModes[group.facilityTypeId] ?? group.pendingProductionPlan?.mode ?? group.productionMode;
            const currentCount = group.status === 'running' ? group.participatingCount : group.availableCount;
            const currentCycleOutput = type.output.quantity * currentCount;
            const currentCycleCost = type.operatingCost * currentCount;
            const planStep = Math.max(1, type.output.quantity * Math.max(1, group.nextCycleCount));
            const defaultTarget = group.pendingProductionPlan?.mode === 'target'
              ? group.pendingProductionPlan.targetQuantity
              : group.targetQuantity ?? planStep * 10;
            const targetValue = planTargets[group.facilityTypeId] ?? String(defaultTarget);
            const inputName = productName(type.input?.productId);
            const outputName = productName(type.output.productId);
            const inputInventory = type.input ? game.inventories[type.input.productId]?.available ?? 0 : null;
            const cycleInput = type.input ? type.input.quantity * currentCount : 0;
            const canConfigure = group.nextCycleCount > 0;
            const pendingPlan = group.pendingProductionPlan;
            const saveStatus = planSaveStatuses[group.facilityTypeId] ?? 'idle';
            const planStatusLabel = pendingPlan
              ? '下一周期生效'
              : saveStatus === 'saving'
                ? '自动保存中…'
                : saveStatus === 'error'
                  ? '自动保存失败'
                  : '';

            return (
              <Panel className="facility-card facility-group-card" key={group.facilityTypeId}>
                <div className="facility-card-head facility-status-header">
                  <div className="facility-status-title">
                    <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
                    <h2>{type.name} × {formatNumber(group.count)}</h2>
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
                  <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
                    <span>运行中 <strong>{formatNumber(group.participatingCount)}</strong></span>
                    <span>下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong></span>
                    <span>冻结中 <strong>{formatNumber(group.listedCount)}</strong></span>
                  </div>
                </div>

                <div className="facility-specs ui-spec-grid facility-group-specs">
                  <span>周期 <strong>{formatNumber(type.cycleMs / 1000)} 秒</strong></span>
                  <span>产量 <strong>{formatNumber(currentCycleOutput)} {outputName}</strong></span>
                  <span>成本 <strong>¤ {formatCurrency(currentCycleCost)}</strong></span>
                  <span>原料 <strong>{inputInventory === null ? '无' : `${formatNumber(cycleInput)} ${inputName} · 库存 ${formatNumber(inputInventory)}`}</strong></span>
                </div>

                <FacilityGroupProgress group={group} type={type} now={now} />

                <div className="production-plan-card">
                  <div className="production-plan-heading">
                    <strong>当前计划</strong>
                    {planStatusLabel ? (
                      <small
                        className={`production-plan-status${saveStatus === 'error' && !pendingPlan ? ' status-error' : ''}`}
                        aria-live="polite"
                      >{planStatusLabel}</small>
                    ) : null}
                  </div>
                  <div className={`production-plan-fields${mode === 'continuous' ? ' is-continuous' : ''}`}>
                    <select
                      aria-label={`${type.name}集群生产模式`}
                      value={mode}
                      disabled={!canConfigure}
                      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                        const nextMode = event.target.value as ProductionMode;
                        clearPlanSaveTimer(group.facilityTypeId);
                        setPlanModes((current) => ({ ...current, [group.facilityTypeId]: nextMode }));
                        if (nextMode === 'continuous') {
                          queuePlanSave(group.facilityTypeId, nextMode);
                          return;
                        }
                        const requestedTarget = validPlanTarget(targetValue, planStep);
                        const normalizedTarget = requestedTarget
                          ?? Math.max(planStep, Math.ceil((Number(targetValue) || planStep) / planStep) * planStep);
                        setPlanTargets((current) => ({ ...current, [group.facilityTypeId]: String(normalizedTarget) }));
                        queuePlanSave(group.facilityTypeId, nextMode, normalizedTarget);
                      }}
                    >
                      <option value="continuous">持续运行</option>
                      <option value="target">定量生产</option>
                    </select>
                    {mode === 'target' ? (
                      <input
                        aria-label={`${type.name}目标产量`}
                        placeholder="目标产量"
                        type="number"
                        inputMode="numeric"
                        min={planStep}
                        step={planStep}
                        value={targetValue}
                        disabled={!canConfigure}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPlanTargets((current) => ({ ...current, [group.facilityTypeId]: value }));
                          scheduleTargetPlanSave(group.facilityTypeId, value, planStep);
                        }}
                        onBlur={(event) => flushTargetPlanSave(group.facilityTypeId, event.target.value, planStep)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') event.currentTarget.blur();
                        }}
                      />
                    ) : null}
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
