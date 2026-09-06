import type { OperationFeedback } from '../../notifications/operationFeedback';
import { BuildingStaffingProgress } from '../../components/buildings/BuildingStaffingProgress';
import { BuildingClusterCard } from '../../components/buildings/BuildingClusterCard';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { CompactNumber } from '../../components/ui/CompactNumber';
import { FacilityIcon } from '../../components/icons/FacilityIcons';
import { useFacilityRecipeProfitMarkets } from '../../components/facilities/FacilityRecipeProfitContext';
import { FacilityRecipeProfitAnalysis } from '../../components/facilities/FacilityRecipeProfitAnalysis';
import { FacilityOperatingDiagnostics } from '../../components/facilities/FacilityOperatingDiagnostics';
import {
  FacilityAutoOperationControls,
  type FacilityAutoOperationController,
} from '../../components/facilities/FacilityAutoOperationControls';
import { FacilityProductionConfigControls } from '../../components/facilities/FacilityProductionConfigControls';
import { SelectInput } from '../../components/ui/FormControls';
import { GameConcept } from '../../components/ui/GameConcept';
import { MobileDetailSummary } from '../../components/ui/MobileDetailSummary';
import { usePlayerPageNavigation } from '../../components/ui/PageNavigationContext';
import {
  StatusTag,
  SwitchControl,
  type StatusTone,
} from '../../components/ui/layout';
import {
  FacilityProductionFormula,
  currentFormulaScope,
} from '../../components/facilities/FacilityProductionFormula';
import {
  getFacilityEnabledIntent,
  reconcileFacilityEnabledIntent,
  subscribeFacilityEnabledIntent,
} from '../../app/immediateCommandIntent';
import type {
  FacilityGroup,
  FacilityProductionMethodDefinition,
  FacilityProductionMethodGroupDefinition,
  FacilityProductionMethodId,
  FacilityRecipeDefinition,
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
  ProductMarketState,
  ResearchTechnologyDefinition,
} from '../../types';
import { useNow } from '../../hooks/useNow';
import { formatNumber } from '../../utils/formatters';
import { resolveFacilityProfitPresentation } from '../../utils/facilityProfitPresentation';
import { facilityEffectiveCount, projectFacilityStaffingRate } from '../../utils/facilityStaffing';

export interface FacilityClusterEntry {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
}

export interface FacilityClusterDetailSharedProps {
  feedback: OperationFeedback;
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  markets: Record<string, ProductMarketState>;
  credits: number;
  completedTechnologyIds: string[];
  researchTechnologies: ResearchTechnologyDefinition[];
  now: number;
  onToggle: (enabled: boolean) => void;
  onRecipeChange: (recipeId: string) => void;
  onOpenProductMarket: (productId: string) => void;
  onOpenContracts: (productId: string) => void;
}

export interface FacilityDetailRecipeState {
  recipes: FacilityRecipeDefinition[];
  variants: FacilityRecipeDefinition[];
  productionMethodGroup: FacilityProductionMethodGroupDefinition | undefined;
  activeRecipe: FacilityRecipeDefinition;
  activeBaseRecipe: FacilityRecipeDefinition;
  activeProductionMethod: FacilityProductionMethodDefinition | undefined;
  formulaType: FacilityTypeDefinition;
  selectedRecipeId: string;
  selectedBaseRecipeId: string;
  selectedProductionMethodId: FacilityProductionMethodId;
}

export function facilityTone(status: string): StatusTone {
  if (status === 'running') return 'success';
  if (status === 'error') return 'danger';
  return 'neutral';
}

export function facilityStatusLabel(group: FacilityGroup) {
  if (group.status === 'running') return '运行中';
  if (group.status === 'stopped') return '已停止';
  switch (group.statusReason) {
    case 'insufficient_funds':
      return '异常：资金不足';
    case 'insufficient_input':
      return '异常：原料不足';
    case 'no_available_facility':
      return '异常：无可运行工厂';
    case 'maintenance':
      return '异常：维护中';
    default:
      return '异常：生产条件不足';
  }
}

function staffingPercent(rateBps: number | undefined) {
  const normalized = Math.max(0, Math.min(10_000, Math.floor(Number(rateBps ?? 10_000))));
  return Math.round(normalized / 100);
}

export function FacilityStaffingSummary({
  entry,
  now,
}: {
  entry: FacilityClusterEntry;
  now: number;
}) {
  const { group, type } = entry;
  const currentRateBps = projectFacilityStaffingRate(group, now);
  const currentPercent = staffingPercent(currentRateBps);
  const physicalCount = group.status === 'running'
    ? group.participatingCount
    : group.productionAvailableCount ?? group.participatingCount;
  const effectiveCount = facilityEffectiveCount(group, physicalCount, now);
  const directionLabel = group.status === 'running'
    ? currentPercent >= 100 ? '已满员' : '恢复中'
    : currentPercent <= 0 ? '已降至最低' : '下降中';
  const description = `${type.name}当前满员率 ${currentPercent}%，${directionLabel}，当前 ${physicalCount} 座工厂形成 ${effectiveCount} 座整数等效产能；周期完成时按届时满员率结算。`;

  return <BuildingStaffingProgress name={type.name} percent={currentPercent}
    directionLabel={directionLabel} description={description} />;
}

export function recipeVariantsForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  const methodGroup = productionMethodGroupForType(type);
  const defaultMethodId = methodGroup?.defaultMethodId ?? type.recipes?.[0]?.productionMethodId ?? '';
  const currentRecipes = Array.isArray(type.recipes) ? type.recipes : [];
  const defaultRecipes = currentRecipes.filter((recipe) => recipe.productionMethodId === defaultMethodId);
  const baseRecipes = currentRecipes.length > 0
    ? (defaultRecipes.length > 0 ? defaultRecipes : currentRecipes)
    : [
      {
        id: type.defaultRecipeId || `${type.id}-default`,
        name: type.name,
        baseRecipeId: type.defaultRecipeId || `${type.id}-default`,
        productionMethodId: defaultMethodId,
        cycleMs: type.cycleMs,
        operatingCost: type.operatingCost,
        inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
        output: type.output,
      },
    ];
  if (!methodGroup) return baseRecipes;
  const variants = baseRecipes.flatMap((baseRecipe) => methodGroup.methods.flatMap((method) => {
    const plan = method.plansByRecipeId[baseRecipe.id];
    return plan ? [{
      id: plan.recipeId,
      name: baseRecipe.name,
      baseRecipeId: baseRecipe.id,
      productionMethodId: method.id,
      cycleMs: plan.cycleMs,
      operatingCost: plan.operatingCost,
      inputs: plan.inputs,
      input: plan.input,
      output: plan.output,
    }] : [];
  }));
  return variants.length > 0 ? variants : baseRecipes;
}

export function recipesForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  const variants = recipeVariantsForType(type);
  const defaultMethodId = productionMethodGroupForType(type)?.defaultMethodId;
  const defaultRecipes = variants.filter((recipe) => recipe.productionMethodId === defaultMethodId);
  return defaultRecipes.length > 0 ? defaultRecipes : variants;
}

function baseRecipeId(recipe: FacilityRecipeDefinition) {
  return recipe.baseRecipeId ?? recipe.id;
}

function productionMethodId(recipe: FacilityRecipeDefinition): FacilityProductionMethodId {
  return recipe.productionMethodId ?? '';
}

function productionMethodGroupForType(type: FacilityTypeDefinition) {
  return type.productionMethodGroups?.find((group) => group.id === 'operation')
    ?? type.productionMethodGroups?.[0];
}

function variantForSelection(
  variants: FacilityRecipeDefinition[],
  selectedBaseRecipeId: string,
  selectedProductionMethodId: FacilityProductionMethodId,
) {
  return variants.find((recipe) => (
    baseRecipeId(recipe) === selectedBaseRecipeId
    && productionMethodId(recipe) === selectedProductionMethodId
  ));
}

export function typeForRecipe(type: FacilityTypeDefinition, recipe: FacilityRecipeDefinition): FacilityTypeDefinition {
  return {
    ...type,
    cycleMs: recipe.cycleMs,
    operatingCost: recipe.operatingCost,
    inputs: Array.isArray(recipe.inputs) ? recipe.inputs : recipe.input ? [recipe.input] : [],
    input: recipe.input,
    output: recipe.output,
  };
}

export function resolveFacilityDetailRecipeState(entry: FacilityClusterEntry): FacilityDetailRecipeState {
  const { group, type } = entry;
  const variants = recipeVariantsForType(type);
  const recipes = recipesForType(type);
  const activeRecipe =
    variants.find((recipe) => recipe.id === group.activeRecipeId) ??
    variants.find((recipe) => recipe.id === type.defaultRecipeId) ??
    variants[0];
  const productionMethodGroup = productionMethodGroupForType(type);
  const activeBaseRecipeId = baseRecipeId(activeRecipe);
  const activeBaseRecipe = recipes.find((recipe) => recipe.id === activeBaseRecipeId) ?? recipes[0];
  const activeMethodId = productionMethodId(activeRecipe);
  const activeProductionMethod = productionMethodGroup?.methods.find((method) => method.id === activeMethodId);

  return {
    recipes,
    variants,
    productionMethodGroup,
    activeRecipe,
    activeBaseRecipe,
    activeProductionMethod,
    formulaType: typeForRecipe(type, activeRecipe),
    selectedRecipeId: activeRecipe.id,
    selectedBaseRecipeId: activeBaseRecipeId,
    selectedProductionMethodId: activeMethodId,
  };
}

export function productionRecipeVariantId(
  type: FacilityTypeDefinition,
  selectedBaseRecipeId: string,
  selectedProductionMethodId: FacilityProductionMethodId,
) {
  return variantForSelection(
    recipeVariantsForType(type),
    selectedBaseRecipeId,
    selectedProductionMethodId,
  )?.id;
}

export function isMobileFacilityLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

export function FacilityClusterSelectorCard({
  entry,
  products,
  now,
  onSelect,
}: {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  now: number;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { group, type } = entry;
  const liveNow = useNow(now, 10_000);
  const markets = useFacilityRecipeProfitMarkets();
  const recipeState = resolveFacilityDetailRecipeState(entry);
  const profitScope = currentFormulaScope(group, liveNow);
  const profitType = recipeState.formulaType;
  const profit = resolveFacilityProfitPresentation({
    type: profitType,
    scopeCount: profitScope.physicalCount,
    scopeLabel: profitScope.name,
    staffingRateBps: profitScope.staffingRateBps,
    products,
    markets,
  });

  return (
    <BuildingClusterCard
      name={type.name} status={group.status} count={group.count}
      artwork={<FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />}
      profitValue={profit.visibleValue} profitTone={profit.tone}
      profitTitle={`${type.name}单厂平均利润／分钟；${profit.detail}`}
      ariaLabel={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}，每分钟平均利润：${profit.accessibleValue}`}
      onSelect={onSelect}
    />
  );
}

export function FacilityClusterInformation({
  entry,
  products,
  inventories,
  now,
  onToggle,
}: Pick<
  FacilityClusterDetailSharedProps,
  'entry' | 'products' | 'inventories' | 'now' | 'onToggle'
>) {
  const { group, type } = entry;
  const liveNow = useNow(now);
  const recipeState = resolveFacilityDetailRecipeState(entry);
  const profitScope = currentFormulaScope(group, liveNow);
  const subscribeEnabledIntent = useCallback(
    (listener: () => void) => subscribeFacilityEnabledIntent(
      group.provinceId,
      group.facilityTypeId,
      listener,
    ),
    [group.facilityTypeId, group.provinceId],
  );
  const enabledIntent = useSyncExternalStore(
    subscribeEnabledIntent,
    () => getFacilityEnabledIntent(group.provinceId, group.facilityTypeId),
    () => null,
  );
  const displayedEnabled = enabledIntent ?? group.enabled;

  useEffect(() => {
    reconcileFacilityEnabledIntent(
      group.provinceId,
      group.facilityTypeId,
      group.enabled,
    );
  }, [group.enabled, group.facilityTypeId, group.provinceId]);

  return (
    <section
      className="facility-information"
      data-status={group.status}
      aria-label={`${type.name}工厂信息`}
    >
      <MobileDetailSummary
        className="facility-information-summary"
        artworkClassName="facility-detail-artwork facility-information-artwork"
        artwork={<FacilityIcon facilityTypeId={type.id} className="facility-detail-artwork-icon" />}
        title={null}
        meta={
          <>
            <span className="facility-information-total">
              <small>总数量</small>
              <strong>{<CompactNumber value={group.count} />}</strong>
            </span>
            <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
          </>
        }
        action={
          <SwitchControl
            checked={displayedEnabled}
            aria-label={displayedEnabled ? `停止${type.name}生产` : `开启${type.name}生产`}
            title={displayedEnabled ? '停止生产' : '开启自动运行'}
            disabled={group.count < 1}
            onChange={(event) => onToggle(event.target.checked)}
          />
        }
        description={
          <div className="facility-information-details">
            <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
              <span>
                运行中 <strong>{<CompactNumber value={group.participatingCount} />}</strong>
              </span>
              <span>
                冻结中 <strong>{<CompactNumber value={(group.frozenCount ?? group.listedCount) + group.mortgagedCount + (group.contractCollateralCount ?? 0)} />}</strong>
              </span>
            </div>
            <FacilityRecipeProfitAnalysis
              type={recipeState.formulaType}
              scopeCount={profitScope.physicalCount}
              scopeLabel={profitScope.name}
              staffingRateBps={profitScope.staffingRateBps}
              products={products}
              inventories={inventories}
            />
            <FacilityStaffingSummary entry={entry} now={liveNow} />
          </div>
        }
      />
    </section>
  );
}

export function FacilityClusterDetailBody({
  feedback,
  entry,
  products,
  inventories,
  markets,
  credits,
  completedTechnologyIds,
  researchTechnologies,
  now,
  onRecipeChange,
  onOpenProductMarket,
  onOpenContracts,
}: Omit<FacilityClusterDetailSharedProps, 'onToggle'>) {
  const { group, type } = entry;
  const liveNow = useNow(now);
  const pageNavigation = usePlayerPageNavigation();
  const recipeState = resolveFacilityDetailRecipeState(entry);
  const operatingScope = currentFormulaScope(group, liveNow);
  const selectConfiguration = (
    selectedBaseRecipeId: string,
    selectedProductionMethodId: FacilityProductionMethodId,
  ) => {
    const recipeId = productionRecipeVariantId(type, selectedBaseRecipeId, selectedProductionMethodId);
    if (recipeId && recipeId !== recipeState.selectedRecipeId) onRecipeChange(recipeId);
  };
  const openProductDetail = (productId: string) => {
    const currentLocation = pageNavigation?.currentLocation;
    if (currentLocation?.type === 'regional-facility' && pageNavigation) {
      pageNavigation.pushPage({
        type: 'regional-product',
        host: currentLocation.host === 'province' ? 'province' : 'buildings',
        provinceId: currentLocation.provinceId,
        productId,
      });
      return;
    }
    onOpenProductMarket(productId);
  };

  return (
    <>
      <section className="facility-production-settings mobile-detail-section" aria-label="生产配置">
        <FacilityAutoOperationControls group={group} feedback={feedback}>
          {({ policy, saving, updatePolicy }: FacilityAutoOperationController) => (
            <FacilityProductionConfigControls
              className="facility-production-settings-grid"
              typeName={type.name}
              products={products}
              recipes={recipeState.recipes}
              productionMethodGroup={recipeState.productionMethodGroup}
              selectedBaseRecipeId={recipeState.selectedBaseRecipeId}
              selectedProductionMethodId={recipeState.selectedProductionMethodId}
              completedTechnologyIds={completedTechnologyIds}
              researchTechnologies={researchTechnologies}
              disabled={group.count < 1}
              onProductChange={(selectedBaseRecipeId) => {
                selectConfiguration(selectedBaseRecipeId, recipeState.selectedProductionMethodId);
              }}
              onMethodChange={(methodId) => {
                selectConfiguration(recipeState.selectedBaseRecipeId, methodId);
              }}
            >
              <SelectInput
                label={<GameConcept concept="input-coverage">原料保障</GameConcept>}
                aria-label={`${type.name}原料保障`}
                fieldClassName="facility-auto-operation__coverage"
                value={String(policy.inputCoverageCycles)}
                disabled={!policy.enabled || saving || group.count < 1}
                onChange={(event) => updatePolicy({
                  ...policy,
                  inputCoverageCycles: Number(event.target.value) as 1 | 2 | 3 | 5,
                })}
              >
                <option value="1">1 个生产周期</option>
                <option value="2">2 个生产周期</option>
                <option value="3">3 个生产周期</option>
                <option value="5">5 个生产周期</option>
              </SelectInput>
            </FacilityProductionConfigControls>
          )}
        </FacilityAutoOperationControls>
      </section>

      <FacilityProductionFormula
        group={group}
        type={recipeState.formulaType}
        products={products}
        inventories={inventories}
        now={liveNow}
        onOpenProductMarket={openProductDetail}
      />
      <FacilityOperatingDiagnostics
        onOpenProductMarket={openProductDetail}
        recipe={recipeState.activeRecipe}
        productionCount={operatingScope.count}
        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        onOpenContracts={onOpenContracts}
      />
    </>
  );
}


export function FacilityClusterDetailContent({
  feedback,
  entry,
  products,
  inventories,
  markets,
  credits,
  completedTechnologyIds,
  researchTechnologies,
  now,
  onToggle,
  onRecipeChange,
  onOpenProductMarket,
  onOpenContracts,
}: FacilityClusterDetailSharedProps) {
  return (
    <>
      <FacilityClusterInformation
        entry={entry}
        products={products}
        inventories={inventories}
        now={now}
        onToggle={onToggle}
      />
      <FacilityClusterDetailBody
        feedback={feedback}
        entry={entry}
        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        completedTechnologyIds={completedTechnologyIds}
        researchTechnologies={researchTechnologies}
        now={now}
        onRecipeChange={onRecipeChange}
        onOpenProductMarket={onOpenProductMarket}
        onOpenContracts={onOpenContracts}
      />
    </>
  );
}
