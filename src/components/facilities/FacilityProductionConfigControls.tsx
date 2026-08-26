import { CompactNumber } from '../ui/CompactNumber';
import { AssetsIcon, ChevronIcon, CreditsIcon, CycleIcon, ProductionIcon } from '../icons/GameIcons';
import { ProductArtwork } from '../products/ProductArtwork';
import { RichSelectInput } from '../ui/RichSelectInput';
import type {
  FacilityProductionMethodGroupDefinition,
  FacilityProductionMethodId,
  FacilityProductionMethodPlan,
  FacilityRecipeDefinition,
  ProductDefinition,
  ResearchTechnologyDefinition,
} from '../../types';
import { formatNumber } from '../../utils/formatters';

type MetricPreference = 'lower' | 'higher';
type MetricTone = 'positive' | 'negative' | 'neutral';

function productMap(products: ProductDefinition[]) {
  return new Map(products.map((product) => [product.id, product]));
}

function productName(productsById: Map<string, ProductDefinition>, productId: string) {
  return productsById.get(productId)?.name ?? productId;
}

function seconds(cycleMs: number) {
  return `${formatNumber(cycleMs / 1000)}s`;
}

function metricTone(next: number, current: number, preference: MetricPreference): MetricTone {
  if (next === current) return 'neutral';
  const improved = preference === 'lower' ? next < current : next > current;
  return improved ? 'positive' : 'negative';
}

function metricDirection(next: number, current: number) {
  if (next === current) return null;
  return (
    <ChevronIcon
      direction={next > current ? 'up' : 'down'}
      className="production-config-metric-chevron"
    />
  );
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

function MaterialList({
  label,
  items,
  productsById,
}: {
  label: string;
  items: Array<{ productId: string; quantity: number }>;
  productsById: Map<string, ProductDefinition>;
}) {
  return (
    <span className="production-config-material-row">
      <span className="production-config-material-row-label">{label}</span>
      {items.length === 0 ? (
        <span className="production-config-material-empty">无</span>
      ) : items.map((item) => (
        <span className="production-config-material" key={`${label}-${item.productId}`}>
          <ProductArtwork productId={item.productId} />
          <span>{productName(productsById, item.productId)}</span>
          <strong>×{<CompactNumber value={item.quantity} />}</strong>
        </span>
      ))}
    </span>
  );
}

function ProductPlanDetail({
  plan,
  productsById,
}: {
  plan: FacilityProductionMethodPlan | FacilityRecipeDefinition;
  productsById: Map<string, ProductDefinition>;
}) {
  return (
    <span className="production-config-detail production-config-detail--product">
      <span className="production-config-flow-row">
        <MaterialList label="投入" items={plan.inputs ?? []} productsById={productsById} />
        <ChevronIcon direction="right" className="production-config-flow-arrow" />
        <MaterialList label="产出" items={[plan.output]} productsById={productsById} />
      </span>
      <span className="production-config-metric-row">
        <span className="production-config-metric is-neutral">周期 {seconds(plan.cycleMs)}</span>
        <span className="production-config-metric is-neutral">成本 {<CompactNumber value={plan.operatingCost} />}</span>
      </span>
    </span>
  );
}

function MethodPlanDetail({
  plan,
  currentPlan,
  productsById,
}: {
  plan: FacilityProductionMethodPlan;
  currentPlan: FacilityProductionMethodPlan;
  productsById: Map<string, ProductDefinition>;
}) {
  const cycleTone = metricTone(plan.cycleMs, currentPlan.cycleMs, 'lower');
  const costTone = metricTone(plan.operatingCost, currentPlan.operatingCost, 'lower');
  const outputTone = metricTone(plan.output.quantity, currentPlan.output.quantity, 'higher');
  return (
    <span className="production-config-detail production-config-detail--method">
      <span className="production-config-metric-row">
        <span className={`production-config-metric is-${cycleTone}`}>
          周期 {seconds(plan.cycleMs)}{metricDirection(plan.cycleMs, currentPlan.cycleMs)}
        </span>
        <span className={`production-config-metric is-${costTone}`}>
          成本 {<CompactNumber value={plan.operatingCost} />}{metricDirection(plan.operatingCost, currentPlan.operatingCost)}
        </span>
        <span className={`production-config-metric is-${outputTone}`}>
          产出 ×{<CompactNumber value={plan.output.quantity} />}{metricDirection(plan.output.quantity, currentPlan.output.quantity)}
        </span>
      </span>
      <MaterialList label="投入" items={plan.inputs ?? []} productsById={productsById} />
    </span>
  );
}

function planForMethod(
  group: FacilityProductionMethodGroupDefinition | undefined,
  methodId: FacilityProductionMethodId,
  baseRecipeId: string,
) {
  return group?.methods.find((method) => method.id === methodId)?.plansByRecipeId[baseRecipeId];
}

function requiredTechnologyIdsForMethod(method: FacilityProductionMethodGroupDefinition['methods'][number]) {
  const extended = method as typeof method & { requiredTechnologyIds?: string[] };
  return Array.isArray(extended.requiredTechnologyIds) ? extended.requiredTechnologyIds : [];
}

export function FacilityProductionConfigControls({
  typeName,
  products,
  recipes,
  productionMethodGroup,
  selectedBaseRecipeId,
  selectedProductionMethodId,
  completedTechnologyIds,
  researchTechnologies,
  disabled,
  className = 'facility-production-settings-grid',
  onProductChange,
  onMethodChange,
}: {
  typeName: string;
  products: ProductDefinition[];
  recipes: FacilityRecipeDefinition[];
  productionMethodGroup: FacilityProductionMethodGroupDefinition | undefined;
  selectedBaseRecipeId: string;
  selectedProductionMethodId: FacilityProductionMethodId;
  completedTechnologyIds: string[];
  researchTechnologies: ResearchTechnologyDefinition[];
  disabled: boolean;
  className?: string;
  onProductChange: (baseRecipeId: string) => void;
  onMethodChange: (methodId: FacilityProductionMethodId) => void;
}) {
  const productsById = productMap(products);
  const completedTechnologies = new Set(completedTechnologyIds);
  const technologyNamesById = new Map(researchTechnologies.map((technology) => [technology.id, technology.name]));
  const currentPlan = planForMethod(
    productionMethodGroup,
    selectedProductionMethodId,
    selectedBaseRecipeId,
  );

  return (
    <div className={className}>
      <RichSelectInput
        variant="production-config"
        label="生产产物"
        aria-label={`${typeName}生产产物`}
        value={selectedBaseRecipeId}
        options={recipes.map((recipe) => {
          const plan = planForMethod(productionMethodGroup, selectedProductionMethodId, recipe.id) ?? recipe;
          const outputName = productName(productsById, plan.output.productId);
          return {
            value: recipe.id,
            label: recipe.name,
            visual: <ProductArtwork productId={plan.output.productId} />,
            triggerDetail: `${outputName} ×${formatNumber(plan.output.quantity)} · ${seconds(plan.cycleMs)}`,
            detail: <ProductPlanDetail plan={plan} productsById={productsById} />,
          };
        })}
        disabled={disabled || recipes.length === 0}
        onValueChange={onProductChange}
      />

      {productionMethodGroup && currentPlan ? (
        <RichSelectInput
          variant="production-config"
          label={productionMethodGroup.name}
          aria-label={`${typeName}生产方式`}
          value={selectedProductionMethodId}
          options={productionMethodGroup.methods.map((method) => {
            const plan = method.plansByRecipeId[selectedBaseRecipeId];
            const missingTechnologyNames = requiredTechnologyIdsForMethod(method)
              .filter((technologyId) => !completedTechnologies.has(technologyId))
              .map((technologyId) => technologyNamesById.get(technologyId) ?? technologyId);
            const locked = missingTechnologyNames.length > 0;
            return {
              value: method.id,
              label: method.name,
              disabled: !plan || locked,
              visual: <ProductionMethodIcon methodId={method.id} />,
              triggerDetail: plan
                ? `${seconds(plan.cycleMs)} · 成本 ${formatNumber(plan.operatingCost)} · 产出 ×${formatNumber(plan.output.quantity)}`
                : undefined,
              detail: !plan
                ? <span className="production-config-unavailable">当前产物不可用</span>
                : locked
                  ? <span className="production-config-unavailable">需要完成「{missingTechnologyNames.join('」「')}」研发</span>
                  : <MethodPlanDetail plan={plan} currentPlan={currentPlan} productsById={productsById} />,
            };
          })}
          disabled={disabled}
          onValueChange={(methodId) => onMethodChange(methodId as FacilityProductionMethodId)}
        />
      ) : null}
    </div>
  );
}
