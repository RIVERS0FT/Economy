import { useMemo } from 'react';
import { useNow } from '../hooks/useNow';
import {
  type LoadedGameViewModel,
} from '../app/gameViewModel';
import { FacilityProductionFormula } from '../components/facilities/FacilityProductionFormula';
import { CurrencyAmount } from '../components/ui/CurrencyAmount';
import { SelectInput } from '../components/ui/FormControls';
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
import type {
  FacilityGroup,
  FacilityRecipeDefinition,
  FacilityTypeDefinition,
} from '../types';
import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';

function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'error') return 'danger';
  return 'neutral';
}

function facilityStatusLabel(group: FacilityGroup) {
  if (group.status === 'running') return '运行中';
  if (group.status === 'stopped') return '已停止';
  switch (group.statusReason) {
    case 'warehouse_full': return '异常：仓库已满';
    case 'insufficient_funds': return '异常：资金不足';
    case 'insufficient_input': return '异常：原料不足';
    case 'no_available_facility': return '异常：无可运行工厂';
    case 'maintenance': return '异常：维护中';
    default: return '异常：生产条件不足';
  }
}

function recipesForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  if (Array.isArray(type.recipes) && type.recipes.length > 0) return type.recipes;
  return [{
    id: type.defaultRecipeId || `${type.id}-default`,
    name: type.name,
    cycleMs: type.cycleMs,
    operatingCost: type.operatingCost,
    inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
    output: type.output,
  }];
}

function typeForRecipe(type: FacilityTypeDefinition, recipe: FacilityRecipeDefinition): FacilityTypeDefinition {
  return {
    ...type,
    cycleMs: recipe.cycleMs,
    operatingCost: recipe.operatingCost,
    inputs: Array.isArray(recipe.inputs) ? recipe.inputs : recipe.input ? [recipe.input] : [],
    input: recipe.input,
    output: recipe.output,
  };
}

export function ProductionPage({ model }: { model: LoadedGameViewModel }) {
  const {
    game,
    selectedFacilityTypeId,
    setSelectedFacilityTypeId,
    buildFacility,
    startFacility,
    stopFacility,
    setFacilityRecipe,
    selectMarketAsset,
    showResult,
  } = model;

  const now = useNow();
  const selectedType = useMemo(
    () => game.facilityTypes.find((type) => type.id === selectedFacilityTypeId) ?? game.facilityTypes[0],
    [game.facilityTypes, selectedFacilityTypeId],
  );
  const orderedFacilityGroups = useMemo(() => {
    const groupsByTypeId = new Map<string, FacilityGroup>(
      game.facilityGroups.map((group) => [group.facilityTypeId, group]),
    );

    return game.facilityTypes.flatMap((type) => {
      const group = groupsByTypeId.get(type.id);
      return group ? [{ type, group }] : [];
    });
  }, [game.facilityGroups, game.facilityTypes]);
  const hasConstruction = Boolean(game.facilityConstruction);
  const selectedRecipes = selectedType ? recipesForType(selectedType) : [];

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
      description="同类未冻结工厂共享生产周期和服务器正式配方；公式展示本周期或恢复后的集群输入、输出与成本。"
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
        <Panel className="production-surface widget build-card production-build-card">
          <WidgetHeading title="建设新工厂" />
          <SelectInput
            label="工厂类型"
            value={selectedType.id}
            onChange={(event) => setSelectedFacilityTypeId(event.target.value)}
          >
            {game.facilityTypes.map((type) => <option value={type.id} key={type.id}>{type.name}</option>)}
          </SelectInput>
          <div className="facility-type-summary">
            <h3>{selectedType.name}</h3>
            <p>{selectedRecipes.length > 1
              ? `可选配方：${selectedRecipes.map((recipe) => recipe.name).join('／')}`
              : `固定配方：${selectedRecipes[0]?.name ?? selectedType.name}`}</p>
          </div>
          <DataList>
            <DataRow label="建造费用" value={<CurrencyAmount>{formatCurrency(selectedType.buildCost)}</CurrencyAmount>} tone="danger" />
            <DataRow label="施工时间" value={formatDuration(selectedType.buildTimeMs)} tone="warning" />
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
          {orderedFacilityGroups.map(({ group, type }) => {
            const recipes = recipesForType(type);
            const activeRecipe = recipes.find((recipe) => recipe.id === group.activeRecipeId)
              ?? recipes.find((recipe) => recipe.id === type.defaultRecipeId)
              ?? recipes[0];
            const pendingRecipe = recipes.find((recipe) => recipe.id === group.pendingRecipeId);
            const nextRecipe = pendingRecipe ?? activeRecipe;
            const formulaType = typeForRecipe(type, activeRecipe);
            const nextFormulaType = typeForRecipe(type, nextRecipe);
            const showNextCyclePreview = Boolean(pendingRecipe);

            return (
              <div className="facility-group-card-shell" key={group.facilityTypeId}>
                <Panel className="production-surface facility-card facility-group-card">
                  <div className="facility-card-head facility-status-header">
                    <div className="facility-card-title-row">
                      <h2>{type.name} × {formatNumber(group.count)}</h2>
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
                    <div className="facility-card-status-row">
                      <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
                    </div>
                    <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
                      <span>运行中 <strong>{formatNumber(group.participatingCount)}</strong></span>
                      <span>下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong></span>
                      <span>冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong></span>
                    </div>
                  </div>

                  <div className="facility-recipe-section">
                    <div className="facility-recipe-heading">
                      <strong>生产配方</strong>
                      {pendingRecipe ? (
                        <small className="facility-recipe-status" aria-live="polite">
                          下一周期切换为：{pendingRecipe.name}
                        </small>
                      ) : null}
                    </div>
                    <SelectInput
                      label={<span className="sr-only">{type.name}生产配方</span>}
                      aria-label={`${type.name}生产配方`}
                      value={pendingRecipe?.id ?? activeRecipe.id}
                      disabled={group.count < 1 || recipes.length === 1}
                      onChange={(event) => void showResult(setFacilityRecipe(group.facilityTypeId, event.target.value))}
                    >
                      {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                    </SelectInput>
                  </div>

                  <FacilityProductionFormula
                    group={group}
                    type={formulaType}
                    nextType={nextFormulaType}
                    showNextCyclePreview={showNextCyclePreview}
                    products={game.products}
                    inventories={game.inventories}
                    now={now}
                  />

                  <div className="facility-card-spacer" aria-hidden="true" />

                  <div className="facility-market-link-row">
                    <Button
                      variant="text"
                      className="facility-market-link"
                      onClick={() => selectMarketAsset('facility', group.facilityTypeId)}
                    >
                      前往市场交易该工厂 →
                    </Button>
                  </div>
                </Panel>
              </div>
            );
          })}
          {orderedFacilityGroups.length === 0 ? <Panel className="empty-state tall">尚未拥有工厂集群。先确认共享仓库容量，再建设第一座工厂。</Panel> : null}
        </div>
      </div>
    </PageLayout>
  );
}
