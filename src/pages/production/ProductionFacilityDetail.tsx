import { FacilityIcon } from '../../components/icons/FacilityIcons';
import { AssetsIcon, CreditsIcon, CycleIcon, ProductionIcon } from '../../components/icons/GameIcons';
import { ProductArtwork } from '../../components/products/ProductArtwork';
import { useFacilityRecipeProfitMarkets } from '../../components/facilities/FacilityRecipeProfitContext';
import { FacilityRecipeProfitAnalysis } from '../../components/facilities/FacilityRecipeProfitAnalysis';
import { FacilityOperatingDiagnostics } from '../../components/facilities/FacilityOperatingDiagnostics';
import { MobileDetailSummary } from '../../components/ui/MobileDetailSummary';
import { RichSelectInput } from '../../components/ui/RichSelectInput';
import {
  Button,
  StatusTag,
  SwitchControl,
  type StatusTone,
} from '../../components/ui/layout';
import {
  FacilityProductionFormula,
  currentFormulaScope,
} from '../../components/facilities/FacilityProductionFormula';
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
} from '../../types';
import { formatNumber } from '../../utils/formatters';
import { resolveFacilityProfitPresentation } from '../../utils/facilityProfitPresentation';
import { facilityEffectiveCount, projectFacilityStaffingRate } from '../../utils/facilityStaffing';

export interface FacilityClusterEntry {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
}

export interface FacilityClusterDetailSharedProps {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  markets: Record<string, ProductMarketState>;
  credits: number;
  warehouseAvailableCapacity: number;
  now: number;
  onToggle: (enabled: boolean) => void;
  onRecipeChange: (recipeId: string) => void;
  onOpenMarket: () => void;
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
    case 'warehouse_full':
      return '异常：仓库已满';
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

  return (
    <section className="facility-staffing-summary mobile-detail-section" aria-label={description}>
      <div className="facility-staffing-heading">
        <strong>满员率 {formatNumber(currentPercent)}%</strong>
        <span>{directionLabel}</span>
      </div>
      <div
        className="facility-staffing-track"
        role="progressbar"
        aria-label={`${type.name}满员率`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={currentPercent}
      >
        <span className="facility-staffing-fill" style={{ width: `${currentPercent}%` }} />
      </div>
    </section>
  );
}

export function recipeVariantsForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  const baseRecipes = Array.isArray(type.recipes) && type.recipes.length > 0
    ? type.recipes.filter((recipe) => (recipe.productionMethodId ?? 'standard') === 'standard')
    : [
      {
        id: type.defaultRecipeId || `${type.id}-default`,
        name: type.name,
        baseRecipeId: type.defaultRecipeId || `${type.id}-default`,
        productionMethodId: 'standard' as const,
        cycleMs: type.cycleMs,
        operatingCost: type.operatingCost,
        inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
        output: type.output,
      },
    ];
  const methodGroup = productionMethodGroupForType(type);
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
  const standardRecipes = variants.filter((recipe) => (recipe.productionMethodId ?? 'standard') === 'standard');
  return standardRecipes.length > 0 ? standardRecipes : variants;
}

function baseRecipeId(recipe: FacilityRecipeDefinition) {
  return recipe.baseRecipeId ?? recipe.id;
}

function productionMethodId(recipe: FacilityRecipeDefinition): FacilityProductionMethodId {
  return recipe.productionMethodId ?? 'standard';
}

function ProductionMethodIcon({ methodId }: { methodId: FacilityProductionMethodId }) {
  const icon = methodId === 'rapid' || methodId === 'assisted'
    ? <CycleIcon />
    : methodId === 'economical' || methodId === 'intensive'
      ? <CreditsIcon />
      : methodId === 'high-yield' || methodId === 'mechanized'
        ? <AssetsIcon />
        : <ProductionIcon />;
  return (
    <span className="production-method-icon" data-production-method-icon={methodId}>
      {icon}
    </span>
  );
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
  const markets = useFacilityRecipeProfitMarkets();
  const recipeState = resolveFacilityDetailRecipeState(entry);
  const profitScope = currentFormulaScope(group, now);
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
    <button
      type="button"
      className="facility-cluster-selector-card"
      data-ui-interactive="surface"
      data-status={group.status}
      aria-label={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}，每分钟平均利润：${profit.accessibleValue}`}
      onClick={(event) => onSelect(event.currentTarget)}
    >
      <strong className="facility-cluster-name">{type.name}</strong>
      <FacilityIcon facilityTypeId={type.id} className="facility-cluster-icon" />
      <span
        className={`facility-cluster-profit is-${profit.tone}`}
        title={`${type.name}单厂平均利润／分钟；${profit.detail}`}
      >
        {profit.visibleValue}
      </span>
      <span className="facility-cluster-count">{formatNumber(group.count)}</span>
    </button>
  );
}

export function FacilityClusterInformation({
  entry,
  products,
  inventories,
  now,
  onToggle,
  titleId,
}: Pick<
  FacilityClusterDetailSharedProps,
  'entry' | 'products' | 'inventories' | 'now' | 'onToggle'
> & {
  titleId: string;
}) {
  const { group, type } = entry;
  const recipeState = resolveFacilityDetailRecipeState(entry);
  const profitScope = currentFormulaScope(group, now);

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
        title={<h2 id={titleId}>{type.name}</h2>}
        meta={
          <>
            <span className="facility-information-total">
              <small>总数量</small>
              <strong>{formatNumber(group.count)}</strong>
            </span>
            <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
          </>
        }
        action={
          <SwitchControl
            checked={group.enabled}
            aria-label={group.enabled ? `停止${type.name}生产` : `开启${type.name}生产`}
            title={group.enabled ? '停止生产' : '开启自动运行'}
            disabled={group.count < 1}
            onChange={(event) => onToggle(event.target.checked)}
          />
        }
      />

      <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
        <span>
          运行中 <strong>{formatNumber(group.participatingCount)}</strong>
        </span>
        <span>
          冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>
        </span>
        <span>
          抵押中 <strong>{formatNumber(group.mortgagedCount)}</strong>
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
    </section>
  );
}

export function FacilityClusterDetailBody({
  entry,
  products,
  inventories,
  markets,
  credits,
  warehouseAvailableCapacity,
  now,
  onRecipeChange,
  onOpenContracts,
}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {
  const { group, type } = entry;
  const recipeState = resolveFacilityDetailRecipeState(entry);
  const operatingScope = currentFormulaScope(group, now);
  const selectConfiguration = (
    selectedBaseRecipeId: string,
    selectedProductionMethodId: FacilityProductionMethodId,
  ) => {
    const recipeId = productionRecipeVariantId(type, selectedBaseRecipeId, selectedProductionMethodId);
    if (recipeId && recipeId !== recipeState.selectedRecipeId) onRecipeChange(recipeId);
  };

  return (
    <>
      <FacilityStaffingSummary entry={entry} now={now} />

      <section className="facility-production-settings mobile-detail-section">
        <div className="facility-production-settings-heading">
          <strong>生产设置</strong>
        </div>

        <div className="facility-production-settings-grid">
          <RichSelectInput
            label="生产产物"
            aria-label={`${type.name}生产产物`}
            value={recipeState.selectedBaseRecipeId}
            options={recipeState.recipes.map((recipe) => ({
              value: recipe.id,
              label: recipe.name,
              visual: <ProductArtwork productId={recipe.output.productId} />,
            }))}
            disabled={group.count < 1 || recipeState.recipes.length === 0}
            onValueChange={(baseRecipeId) => {
              selectConfiguration(baseRecipeId, recipeState.selectedProductionMethodId);
            }}
          />

          {recipeState.productionMethodGroup ? (
            <RichSelectInput
              label={recipeState.productionMethodGroup.name}
              aria-label={`${type.name}生产方式`}
              value={recipeState.selectedProductionMethodId}
              options={recipeState.productionMethodGroup.methods.map((method) => ({
                value: method.id,
                label: method.name,
                disabled: !method.plansByRecipeId[recipeState.selectedBaseRecipeId],
                visual: <ProductionMethodIcon methodId={method.id} />,
              }))}
              disabled={group.count < 1}
              onValueChange={(methodId) => {
                selectConfiguration(
                  recipeState.selectedBaseRecipeId,
                  methodId as FacilityProductionMethodId,
                );
              }}
            />
          ) : null}
        </div>
      </section>

      <FacilityProductionFormula
        group={group}
        type={recipeState.formulaType}
        products={products}
        inventories={inventories}
        now={now}
      />
      <FacilityOperatingDiagnostics
        recipe={recipeState.activeRecipe}
        productionCount={operatingScope.count}
        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        warehouseAvailableCapacity={warehouseAvailableCapacity}
        onOpenContracts={onOpenContracts}
      />
    </>
  );
}

export function FacilityMarketAction({ onOpenMarket }: { onOpenMarket: () => void }) {
  return (
    <div className="facility-market-link-row">
      <Button variant="text" className="facility-market-link" onClick={onOpenMarket}>
        前往市场交易该工厂 →
      </Button>
    </div>
  );
}

export function FacilityClusterDetailContent({
  entry,
  products,
  inventories,
  markets,
  credits,
  warehouseAvailableCapacity,
  now,
  onToggle,
  onRecipeChange,
  onOpenMarket,
  onOpenContracts,
  titleId,
}: FacilityClusterDetailSharedProps & {
  titleId: string;
}) {
  return (
    <>

<FacilityClusterInformation
  entry={entry}
  products={products}
  inventories={inventories}
  now={now}
  onToggle={onToggle}
  titleId={titleId}
/>
      <FacilityClusterDetailBody
        entry={entry}
        products={products}
        inventories={inventories}
        markets={markets}
        credits={credits}
        warehouseAvailableCapacity={warehouseAvailableCapacity}
        now={now}
        onRecipeChange={onRecipeChange}
        onOpenContracts={onOpenContracts}
      />
      <FacilityMarketAction onOpenMarket={onOpenMarket} />
    </>
  );
}
