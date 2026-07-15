import { useMemo } from 'react';
import {
  type LoadedGameViewModel,
} from '../app/gameViewModel';
import { FacilityProductionFormula } from '../components/facilities/FacilityProductionFormula';
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
import type { FacilityGroup, FacilityTypeDefinition } from '../types';
import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function facilityStatusLabel(group: FacilityGroup) {
  if (group.status === 'running') return '运行';
  if (group.status === 'stopped') return '停止';
  switch (group.statusReason) {
    case 'warehouse_full': return '异常：仓库已满';
    case 'insufficient_funds': return '异常：资金不足';
    case 'insufficient_input': return '异常：原料不足';
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
    setFacilityRecipe,
    selectMarketAsset,
    showResult,
  } = model;

  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
  );
  const hasConstruction = Boolean(game.facilityConstruction);
  const selectedRecipes = selectedType?.recipes ?? [];

  function productName(productId?: string) {
    if (!productId) return '无';
    return game.products.find((product) => product.id === productId)?.name ?? productId;
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
      description="同类未冻结工厂共享生产周期并持续运行；工厂卖单会立即冻结对应数量并降低产量。"
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
            <p>{selectedRecipes.length > 1
              ? `可选配方：${selectedRecipes.map((recipe) => recipe.name.replace('种植', '')).join('／')}`
              : selectedType.input
              ? `${formatNumber(selectedType.input.quantity)} ${productName(selectedType.input.productId)} → ${formatNumber(selectedType.output.quantity)} ${productName(selectedType.output.productId)}`
              : `无原料 → ${formatNumber(selectedType.output.quantity)} ${productName(selectedType.output.productId)}`}</p>
          </div>
          <DataList>
            <DataRow label="建造费用" value={`¤ ${formatCurrency(selectedType.buildCost)}`} tone="danger" />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
            <DataRow label="生产周期" value={`${formatNumber(selectedType.cycleMs / 1000)} 秒`} />
            <DataRow label="单座周期产量" value={selectedRecipes.length > 1
              ? selectedRecipes.map((recipe) => `${formatNumber(recipe.output.quantity)} ${productName(recipe.output.productId)}`).join('／')
              : `${formatNumber(selectedType.output.quantity)} ${productName(selectedType.output.productId)}`} />
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
            const recipes = type.recipes ?? [];
            const activeRecipe = recipes.find((recipe) => recipe.id === group.activeRecipeId);
            const pendingRecipe = recipes.find((recipe) => recipe.id === group.pendingRecipeId);
            const formulaType: FacilityTypeDefinition = activeRecipe
              ? {
                ...type,
                cycleMs: activeRecipe.cycleMs,
                operatingCost: activeRecipe.operatingCost,
                input: activeRecipe.input,
                output: activeRecipe.output,
              }
              : type;

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

                <FacilityProductionFormula
                  group={group}
                  type={formulaType}
                  products={game.products}
                  inventories={game.inventories}
                  now={now}
                />

                {recipes.length > 1 ? (
                  <div className="production-plan-card production-recipe-card">
                    <div className="production-plan-heading">
                      <strong>种植作物</strong>
                      {pendingRecipe ? <small className="production-plan-status">下一周期改为{pendingRecipe.name.replace('种植', '')}</small> : null}
                    </div>
                    <select
                      aria-label={`${type.name}种植作物`}
                      value={pendingRecipe?.id ?? activeRecipe?.id ?? recipes[0].id}
                      disabled={group.count < 1}
                      onChange={(event) => void showResult(setFacilityRecipe(group.facilityTypeId, event.target.value))}
                    >
                      {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name.replace('种植', '')}</option>)}
                    </select>
                  </div>
                ) : null}

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
