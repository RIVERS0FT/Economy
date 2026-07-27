import { FactoryIcon } from '../../components/icons/GameIcons';
import { SelectInput } from '../../components/ui/FormControls';
import {
  Button,
  StatusTag,
  SwitchControl,
  type StatusTone,
} from '../../components/ui/layout';
import { FacilityProductionFormula } from '../../components/facilities/FacilityProductionFormula';
import type {
  FacilityGroup,
  FacilityRecipeDefinition,
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { formatNumber } from '../../utils/formatters';

export interface FacilityClusterEntry {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
}

export interface FacilityClusterDetailSharedProps {
  entry: FacilityClusterEntry;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
  onToggle: (enabled: boolean) => void;
  onRecipeChange: (recipeId: string) => void;
  onOpenMarket: () => void;
}

export interface FacilityDetailRecipeState {
  recipes: FacilityRecipeDefinition[];
  activeRecipe: FacilityRecipeDefinition;
  pendingRecipe: FacilityRecipeDefinition | undefined;
  formulaType: FacilityTypeDefinition;
  nextFormulaType: FacilityTypeDefinition;
  showNextCyclePreview: boolean;
  selectedRecipeId: string;
}

export interface FacilitySheetDragSession {
  pointerId?: number;
  startX: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
  offset: number;
  source: 'header' | 'content';
  active: boolean;
}

export const FACILITY_SHEET_AXIS_THRESHOLD = 8;
export const FACILITY_SHEET_AXIS_DOMINANCE = 1.2;
export const FACILITY_SHEET_MIN_FLING_DISTANCE = 40;
export const FACILITY_SHEET_CLOSE_VELOCITY = 0.75;
export const FACILITY_SHEET_SETTLE_DURATION = 200;

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

export function recipesForType(type: FacilityTypeDefinition): FacilityRecipeDefinition[] {
  if (Array.isArray(type.recipes) && type.recipes.length > 0) return type.recipes;
  return [
    {
      id: type.defaultRecipeId || `${type.id}-default`,
      name: type.name,
      cycleMs: type.cycleMs,
      operatingCost: type.operatingCost,
      inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
      output: type.output,
    },
  ];
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
  const recipes = recipesForType(type);
  const activeRecipe =
    recipes.find((recipe) => recipe.id === group.activeRecipeId) ??
    recipes.find((recipe) => recipe.id === type.defaultRecipeId) ??
    recipes[0];
  const pendingRecipe = recipes.find((recipe) => recipe.id === group.pendingRecipeId);
  const nextRecipe = pendingRecipe ?? activeRecipe;

  return {
    recipes,
    activeRecipe,
    pendingRecipe,
    formulaType: typeForRecipe(type, activeRecipe),
    nextFormulaType: typeForRecipe(type, nextRecipe),
    showNextCyclePreview: Boolean(pendingRecipe),
    selectedRecipeId: pendingRecipe?.id ?? activeRecipe.id,
  };
}

export function isMobileFacilityLayout() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
}

export function isReducedMotionPreferred() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isFacilitySheetInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, a, input, select, textarea, [role="scrollbar"], .ui-scrollbar, [data-facility-sheet-no-drag]',
    ),
  );
}

export function FacilityClusterSelectorCard({
  entry,
  onSelect,
}: {
  entry: FacilityClusterEntry;
  onSelect: (trigger: HTMLButtonElement) => void;
}) {
  const { group, type } = entry;

  return (
    <button
      type="button"
      className="facility-cluster-selector-card"
      data-ui-interactive="surface"
      data-status={group.status}
      aria-label={`${type.name}，数量 ${formatNumber(group.count)}，${facilityStatusLabel(group)}`}
      onClick={(event) => onSelect(event.currentTarget)}
    >
      <strong className="facility-cluster-name">{type.name}</strong>
      <FactoryIcon className="facility-cluster-icon" />
      <span className="facility-cluster-count">{formatNumber(group.count)}</span>
    </button>
  );
}

export function FacilityClusterDetailHeader({
  entry,
  onToggle,
  titleId,
}: {
  entry: FacilityClusterEntry;
  onToggle: (enabled: boolean) => void;
  titleId: string;
}) {
  const { group, type } = entry;

  return (
    <div className="facility-card-head facility-status-header">
      <div className="facility-card-title-row">
        <div className="facility-card-title-block facility-cluster-selector-heading">
          <h2 id={titleId}>
            {type.name} × {formatNumber(group.count)}
          </h2>
          <StatusTag tone={facilityTone(group.status)}>{facilityStatusLabel(group)}</StatusTag>
        </div>
        <SwitchControl
          checked={group.enabled}
          aria-label={group.enabled ? `停止${type.name}生产` : `开启${type.name}生产`}
          title={group.enabled ? '停止生产' : '开启自动运行'}
          disabled={group.count < 1}
          onChange={(event) => onToggle(event.target.checked)}
        />
      </div>
      <div className="facility-count-summary" aria-label={`${type.name}运行数量`}>
        <span>
          运行中 <strong>{formatNumber(group.participatingCount)}</strong>
        </span>
        <span>
          下一周期加入 <strong>{formatNumber(group.pendingJoinCount)}</strong>
        </span>
        <span>
          冻结中 <strong>{formatNumber(group.frozenCount ?? group.listedCount)}</strong>
        </span>
        <span>
          抵押中 <strong>{formatNumber(group.mortgagedCount)}</strong>
        </span>
      </div>
    </div>
  );
}

export function FacilityClusterDetailBody({
  entry,
  products,
  inventories,
  now,
  onRecipeChange,
}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {
  const { group, type } = entry;
  const recipeState = resolveFacilityDetailRecipeState(entry);

  return (
    <>
      <div className="facility-recipe-section">
        <div className="facility-recipe-heading">
          <strong>生产配方</strong>
          {recipeState.pendingRecipe ? (
            <small className="facility-recipe-status" aria-live="polite">
              下一周期切换为：{recipeState.pendingRecipe.name}
            </small>
          ) : null}
        </div>
        <SelectInput
          label={<span className="sr-only">{type.name}生产配方</span>}
          aria-label={`${type.name}生产配方`}
          value={recipeState.selectedRecipeId}
          disabled={group.count < 1 || recipeState.recipes.length === 0}
          onChange={(event) => {
            if (event.target.value !== recipeState.selectedRecipeId) onRecipeChange(event.target.value);
          }}
        >
          {recipeState.recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.name}
            </option>
          ))}
        </SelectInput>
      </div>

      <FacilityProductionFormula
        group={group}
        type={recipeState.formulaType}
        nextType={recipeState.nextFormulaType}
        showNextCyclePreview={recipeState.showNextCyclePreview}
        products={products}
        inventories={inventories}
        now={now}
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
  now,
  onToggle,
  onRecipeChange,
  onOpenMarket,
  titleId,
}: FacilityClusterDetailSharedProps & {
  titleId: string;
}) {
  return (
    <>
      <FacilityClusterDetailHeader entry={entry} onToggle={onToggle} titleId={titleId} />
      <FacilityClusterDetailBody
        entry={entry}
        products={products}
        inventories={inventories}
        now={now}
        onRecipeChange={onRecipeChange}
      />
      <FacilityMarketAction onOpenMarket={onOpenMarket} />
    </>
  );
}
