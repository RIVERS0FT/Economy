from pathlib import Path
import re


def read(path):
    return Path(path).read_text(encoding='utf-8')


def write(path, content):
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    content = read(path)
    if old not in content:
        raise SystemExit(f'missing replacement in {path}: {old[:120]!r}')
    if content.count(old) != 1:
        raise SystemExit(f'non-unique replacement in {path}: {old[:120]!r} count={content.count(old)}')
    write(path, content.replace(old, new, 1))


# 1. Shared production selectors: detail page and both list levels now render from the same components.
write('src/components/facilities/FacilityProductionConfigControls.tsx', '''import { CompactNumber } from '../ui/CompactNumber';
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

export function FacilityProductionProductSelect({
  typeName,
  products,
  recipes,
  productionMethodGroup,
  selectedBaseRecipeId,
  selectedProductionMethodId,
  disabled,
  fieldClassName,
  notifyOnReselect = false,
  ariaLabel,
  onProductChange,
}: {
  typeName: string;
  products: ProductDefinition[];
  recipes: FacilityRecipeDefinition[];
  productionMethodGroup: FacilityProductionMethodGroupDefinition | undefined;
  selectedBaseRecipeId: string;
  selectedProductionMethodId: FacilityProductionMethodId;
  disabled: boolean;
  fieldClassName?: string;
  notifyOnReselect?: boolean;
  ariaLabel?: string;
  onProductChange: (baseRecipeId: string) => void;
}) {
  const productsById = productMap(products);
  return (
    <RichSelectInput
      variant="production-config"
      label="生产产物"
      fieldClassName={fieldClassName}
      aria-label={ariaLabel ?? `${typeName}生产产物`}
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
      notifyOnReselect={notifyOnReselect}
      disabled={disabled || recipes.length === 0}
      onValueChange={onProductChange}
    />
  );
}

export function FacilityProductionMethodSelect({
  typeName,
  products,
  productionMethodGroup,
  selectedBaseRecipeId,
  selectedProductionMethodId,
  completedTechnologyIds,
  researchTechnologies,
  disabled,
  fieldClassName,
  notifyOnReselect = false,
  ariaLabel,
  onMethodChange,
}: {
  typeName: string;
  products: ProductDefinition[];
  productionMethodGroup: FacilityProductionMethodGroupDefinition | undefined;
  selectedBaseRecipeId: string;
  selectedProductionMethodId: FacilityProductionMethodId;
  completedTechnologyIds: string[];
  researchTechnologies: ResearchTechnologyDefinition[];
  disabled: boolean;
  fieldClassName?: string;
  notifyOnReselect?: boolean;
  ariaLabel?: string;
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
  if (!productionMethodGroup || !currentPlan) return null;

  return (
    <RichSelectInput
      variant="production-config"
      label={productionMethodGroup.name}
      fieldClassName={fieldClassName}
      aria-label={ariaLabel ?? `${typeName}生产方式`}
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
      notifyOnReselect={notifyOnReselect}
      disabled={disabled}
      onValueChange={(methodId) => onMethodChange(methodId as FacilityProductionMethodId)}
    />
  );
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
  return (
    <div className={className}>
      <FacilityProductionProductSelect
        typeName={typeName}
        products={products}
        recipes={recipes}
        productionMethodGroup={productionMethodGroup}
        selectedBaseRecipeId={selectedBaseRecipeId}
        selectedProductionMethodId={selectedProductionMethodId}
        disabled={disabled}
        onProductChange={onProductChange}
      />
      <FacilityProductionMethodSelect
        typeName={typeName}
        products={products}
        productionMethodGroup={productionMethodGroup}
        selectedBaseRecipeId={selectedBaseRecipeId}
        selectedProductionMethodId={selectedProductionMethodId}
        completedTechnologyIds={completedTechnologyIds}
        researchTechnologies={researchTechnologies}
        disabled={disabled}
        onMethodChange={onMethodChange}
      />
    </div>
  );
}
''')

# 2. Global and regional building lists reuse the same shared production selectors.
path = 'src/pages/GlobalBuildingsPage.tsx'
content = read(path)
content = content.replace(
    "import { currentFormulaScope } from '../components/facilities/FacilityProductionFormula';\n",
    "import { currentFormulaScope } from '../components/facilities/FacilityProductionFormula';\nimport {\n  FacilityProductionMethodSelect,\n  FacilityProductionProductSelect,\n} from '../components/facilities/FacilityProductionConfigControls';\n",
    1,
)
content = content.replace(
    "import { AssetsIcon, ChevronIcon, CreditsIcon, CycleIcon, ProductionIcon } from '../components/icons/GameIcons';\nimport { ProductArtwork } from '../components/products/ProductArtwork';\n",
    "import { ChevronIcon } from '../components/icons/GameIcons';\n",
    1,
)
content = content.replace("import { RichSelectInput } from '../components/ui/RichSelectInput';\n", "", 1)
content = content.replace(
    "import '../styles/entity-list-header.css';\n",
    "import '../styles/entity-list-header.css';\nimport '../styles/production-methods.css';\n",
    1,
)
content = re.sub(
    r"\nfunction QuickProductionMethodIcon\(\{ methodId \}: \{ methodId: FacilityProductionMethodId \}\) \{.*?\n\}\n",
    "\n",
    content,
    count=1,
    flags=re.S,
)
old = """      methodMixed: new Set(recipeStates.map(({ recipeState }) => recipeState.selectedProductionMethodId)).size > 1,
      productOptions: representativeRecipeState.recipes.map((recipe) => ({
"""
new = """      methodMixed: new Set(recipeStates.map(({ recipeState }) => recipeState.selectedProductionMethodId)).size > 1,
      selectedBaseRecipeId: representativeRecipeState.selectedBaseRecipeId,
      selectedProductionMethodId: representativeMethodId,
      recipes: representativeRecipeState.recipes,
      productionMethodGroup: productionMethodGroup ? {
        ...productionMethodGroup,
        methods: quickMethodOptions,
      } : undefined,
      productOptions: representativeRecipeState.recipes.map((recipe) => ({
"""
if old not in content: raise SystemExit('missing global quick production insertion')
content = content.replace(old, new, 1)
old = """          methodName: currentMethodName,
          productOptions: recipeState.recipes.map((recipe) => ({
"""
new = """          methodName: currentMethodName,
          recipes: recipeState.recipes,
          productionMethodGroup,
          productOptions: recipeState.recipes.map((recipe) => ({
"""
if old not in content: raise SystemExit('missing region quick production insertion')
content = content.replace(old, new, 1)

old = '''                          <RichSelectInput
                            label="生产产物"
                            fieldClassName="global-facility-region-row__quick-field"
                            variant="default"
                            value={row.quickProduction.baseRecipeId}
                            options={row.quickProduction.productOptions.map((option) => ({
                              value: option.id,
                              label: option.name,
                            }))}
                            disabled={row.quickProduction.productOptions.length < 2 || pendingRegionQuickKeys.has(`${row.province.id}:${selectedGlobalFacility.id}`)}
                            aria-label={`${row.province.name}${selectedGlobalFacility.name}生产产物：${row.quickProduction.productName}`}
                            onValueChange={(value) => void applyRegionalQuickProduction(row, 'product', value)}
                          />'''
new = '''                          <FacilityProductionProductSelect
                            typeName={`${row.province.name}${selectedGlobalFacility.name}`}
                            products={game.products}
                            recipes={row.quickProduction.recipes}
                            productionMethodGroup={row.quickProduction.productionMethodGroup}
                            selectedBaseRecipeId={row.quickProduction.baseRecipeId}
                            selectedProductionMethodId={row.quickProduction.methodId}
                            fieldClassName="global-facility-region-row__quick-field"
                            disabled={pendingRegionQuickKeys.has(`${row.province.id}:${selectedGlobalFacility.id}`)}
                            ariaLabel={`${row.province.name}${selectedGlobalFacility.name}生产产物：${row.quickProduction.productName}`}
                            onProductChange={(value) => void applyRegionalQuickProduction(row, 'product', value)}
                          />'''
if old not in content: raise SystemExit('missing regional product select')
content = content.replace(old, new, 1)
old = '''                          <RichSelectInput
                            label="作业制度"
                            fieldClassName="global-facility-region-row__quick-field"
                            variant="default"
                            value={row.quickProduction.methodId}
                            options={row.quickProduction.methodOptions.map((option) => ({
                              value: option.id,
                              label: option.name,
                            }))}
                            disabled={row.quickProduction.methodOptions.length < 2 || pendingRegionQuickKeys.has(`${row.province.id}:${selectedGlobalFacility.id}`)}
                            aria-label={`${row.province.name}${selectedGlobalFacility.name}作业制度：${row.quickProduction.methodName}`}
                            onValueChange={(value) => void applyRegionalQuickProduction(row, 'method', value)}
                          />'''
new = '''                          <FacilityProductionMethodSelect
                            typeName={`${row.province.name}${selectedGlobalFacility.name}`}
                            products={game.products}
                            productionMethodGroup={row.quickProduction.productionMethodGroup}
                            selectedBaseRecipeId={row.quickProduction.baseRecipeId}
                            selectedProductionMethodId={row.quickProduction.methodId}
                            completedTechnologyIds={game.research?.completedTechnologyIds ?? []}
                            researchTechnologies={game.researchTechnologies ?? []}
                            fieldClassName="global-facility-region-row__quick-field"
                            disabled={pendingRegionQuickKeys.has(`${row.province.id}:${selectedGlobalFacility.id}`)}
                            ariaLabel={`${row.province.name}${selectedGlobalFacility.name}作业制度：${row.quickProduction.methodName}`}
                            onMethodChange={(value) => void applyRegionalQuickProduction(row, 'method', value)}
                          />'''
if old not in content: raise SystemExit('missing regional method select')
content = content.replace(old, new, 1)
old = '''                            <RichSelectInput
                              label="生产产物"
                              fieldClassName="global-facility-catalog-row__quick-field"
                              variant="production-config"
                              value={row.quickProduction.targets[0]?.baseRecipeId ?? row.quickProduction.productOptions[0]?.id ?? ''}
                              options={row.quickProduction.productOptions.map((option) => ({
                                value: option.id,
                                label: option.name,
                                visual: <ProductArtwork productId={option.productId} />,
                              }))}
                              notifyOnReselect={row.quickProduction.productMixed}
                              disabled={row.quickProduction.productOptions.length < 2 || pendingQuickFacilityTypeIds.has(row.facilityTypeId)}
                              aria-label={`${row.name}生产产物：${row.quickProduction.productMixed ? '各地区不同，当前显示' : ''}${row.quickProduction.productName}`}
                              onValueChange={(value) => void applyQuickProduction(row, 'product', value)}
                            />'''
new = '''                            <FacilityProductionProductSelect
                              typeName={row.name}
                              products={game.products}
                              recipes={row.quickProduction.recipes}
                              productionMethodGroup={row.quickProduction.productionMethodGroup}
                              selectedBaseRecipeId={row.quickProduction.targets[0]?.baseRecipeId ?? row.quickProduction.selectedBaseRecipeId}
                              selectedProductionMethodId={row.quickProduction.targets[0]?.methodId ?? row.quickProduction.selectedProductionMethodId}
                              fieldClassName="global-facility-catalog-row__quick-field"
                              notifyOnReselect={row.quickProduction.productMixed}
                              disabled={pendingQuickFacilityTypeIds.has(row.facilityTypeId)}
                              ariaLabel={`${row.name}生产产物：${row.quickProduction.productMixed ? '各地区不同，当前显示' : ''}${row.quickProduction.productName}`}
                              onProductChange={(value) => void applyQuickProduction(row, 'product', value)}
                            />'''
if old not in content: raise SystemExit('missing global product select')
content = content.replace(old, new, 1)
old = '''                            <RichSelectInput
                              label="作业制度"
                              fieldClassName="global-facility-catalog-row__quick-field"
                              variant="production-config"
                              value={row.quickProduction.targets[0]?.methodId ?? row.quickProduction.methodId}
                              options={row.quickProduction.methodOptions.map((option) => ({
                                value: option.id,
                                label: option.name,
                                visual: <QuickProductionMethodIcon methodId={option.id as FacilityProductionMethodId} />,
                              }))}
                              notifyOnReselect={row.quickProduction.methodMixed}
                              disabled={row.quickProduction.methodOptions.length < 2 || pendingQuickFacilityTypeIds.has(row.facilityTypeId)}
                              aria-label={`${row.name}作业制度：${row.quickProduction.methodMixed ? '各地区不同，当前显示' : ''}${row.quickProduction.methodName}`}
                              onValueChange={(value) => void applyQuickProduction(row, 'method', value)}
                            />'''
new = '''                            <FacilityProductionMethodSelect
                              typeName={row.name}
                              products={game.products}
                              productionMethodGroup={row.quickProduction.productionMethodGroup}
                              selectedBaseRecipeId={row.quickProduction.targets[0]?.baseRecipeId ?? row.quickProduction.selectedBaseRecipeId}
                              selectedProductionMethodId={row.quickProduction.targets[0]?.methodId ?? row.quickProduction.selectedProductionMethodId}
                              completedTechnologyIds={game.research?.completedTechnologyIds ?? []}
                              researchTechnologies={game.researchTechnologies ?? []}
                              fieldClassName="global-facility-catalog-row__quick-field"
                              notifyOnReselect={row.quickProduction.methodMixed}
                              disabled={pendingQuickFacilityTypeIds.has(row.facilityTypeId)}
                              ariaLabel={`${row.name}作业制度：${row.quickProduction.methodMixed ? '各地区不同，当前显示' : ''}${row.quickProduction.methodName}`}
                              onMethodChange={(value) => void applyQuickProduction(row, 'method', value)}
                            />'''
if old not in content: raise SystemExit('missing global method select')
content = content.replace(old, new, 1)
write(path, content)

# 3. Two-line list geometry: keep the shared production-config skin, compact only the list slot to 48px,
#    shrink desktop first-row height to 32px, and retain a 44px mobile navigation target.
path = 'src/styles/global-operation-pages.css'
content = read(path)
marker = '/* Global building catalog quick production: registered two-line row exception. */'
index = content.find(marker)
if index < 0: raise SystemExit('missing global building CSS marker')
content = content[:index] + '''/* Global building catalog quick production: registered two-line row exception. */
.entity-list-row.global-facility-catalog-row {
  --global-facility-catalog-artwork-size: 72px;
  --global-facility-catalog-main-row-size: 32px;
  --global-facility-production-control-size: 48px;
  --global-facility-catalog-row-gap: 4px;
  position: relative;
  grid-template-rows: var(--global-facility-catalog-main-row-size) var(--global-facility-production-control-size);
  align-content: center;
  align-items: center;
  row-gap: var(--global-facility-catalog-row-gap);
  padding-block: .375rem;
  padding-inline: var(--entity-list-inline-padding);
  border: 1px solid var(--color-border-subtle);
  overflow: visible;
}

.global-facility-catalog-row__artwork {
  position: absolute;
  z-index: 2;
  top: 50%;
  left: var(--entity-list-inline-padding);
  width: var(--global-facility-catalog-artwork-size);
  height: var(--global-facility-catalog-artwork-size);
  min-width: var(--global-facility-catalog-artwork-size);
  transform: translateY(-50%);
  pointer-events: none;
}

.global-facility-catalog-row__open {
  --ui-interactive-hover-background: var(--color-surface-hover);
  --ui-interactive-hover-transform: none;
  --ui-interactive-active-transform: none;
  grid-column: 1 / -1;
  grid-row: 1;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  max-height: none;
  display: grid;
  grid-template-columns: var(--entity-list-columns);
  align-items: center;
  gap: var(--entity-list-gap);
  border: 0;
  border-radius: calc(var(--radius-control) - .15rem);
  padding: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.global-facility-catalog-row__identity {
  min-width: 0;
  display: flex;
  align-items: center;
  padding-left: calc(var(--global-facility-catalog-artwork-size) + .45rem);
  overflow: hidden;
  pointer-events: none;
}

.global-facility-catalog-row__identity > strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-facility-catalog-row__quick-controls {
  grid-column: 1 / -2;
  grid-row: 2;
  z-index: 3;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: .35rem;
  padding-left: calc(var(--global-facility-catalog-artwork-size) + .45rem);
}

.global-facility-catalog-row__quick-selector,
.global-facility-region-row__quick-selector,
.global-facility-catalog-row__quick-field,
.global-facility-region-row__quick-field,
.global-facility-catalog-row__quick-field > .ui-rich-select,
.global-facility-region-row__quick-field > .ui-rich-select {
  width: var(--global-facility-production-control-size);
  min-width: var(--global-facility-production-control-size);
  height: var(--global-facility-production-control-size);
  min-height: 0;
  display: block;
}

.global-facility-catalog-row__quick-field,
.global-facility-region-row__quick-field {
  gap: 0;
}

.global-facility-catalog-row__quick-field > .ui-form-field__label,
.global-facility-region-row__quick-field > .ui-form-field__label {
  display: none;
}

.global-facility-catalog-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger,
.global-facility-region-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {
  width: var(--global-facility-production-control-size);
  min-width: var(--global-facility-production-control-size);
  max-width: var(--global-facility-production-control-size);
  height: var(--global-facility-production-control-size);
  min-height: var(--global-facility-production-control-size);
  max-height: var(--global-facility-production-control-size);
  padding: .35rem;
}

.global-facility-catalog-row__quick-selector[data-mixed='true'] .ui-rich-select__trigger {
  border-style: dashed;
  opacity: .72;
}

.global-facility-catalog-row__metric,
.global-facility-catalog-row__chevron {
  min-width: 0;
  pointer-events: none;
}

.global-facility-catalog-row__chevron {
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
}

@container (max-width: 620px) {
  .entity-list-row.global-facility-catalog-row {
    --global-facility-catalog-artwork-size: 68px;
    --global-facility-catalog-row-gap: 2px;
  }

  .global-facility-catalog-row__identity,
  .global-facility-catalog-row__quick-controls {
    padding-left: calc(var(--global-facility-catalog-artwork-size) + .32rem);
  }

  .global-facility-catalog-row__quick-controls {
    gap: .25rem;
  }
}

@container (max-width: 360px) {
  .entity-list-row.global-facility-catalog-row {
    --global-facility-catalog-artwork-size: 66px;
    --global-facility-catalog-row-gap: 1px;
  }

  .global-facility-catalog-row__identity,
  .global-facility-catalog-row__quick-controls {
    padding-left: calc(var(--global-facility-catalog-artwork-size) + .24rem);
  }
}

/* Global facility region rows mirror the two-line production layout without facility artwork. */
.entity-list-row.global-facility-region-row {
  --global-facility-region-main-row-size: 32px;
  --global-facility-production-control-size: 48px;
  --global-facility-region-row-gap: 4px;
  grid-template-rows: var(--global-facility-region-main-row-size) var(--global-facility-production-control-size);
  align-content: center;
  align-items: center;
  row-gap: var(--global-facility-region-row-gap);
  padding-block: .375rem;
  padding-inline: var(--entity-list-inline-padding);
  overflow: visible;
}

.global-facility-region-row__open {
  --ui-interactive-hover-background: var(--color-surface-hover);
  --ui-interactive-hover-transform: none;
  --ui-interactive-active-transform: none;
  grid-column: 1 / -1;
  grid-row: 1;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: var(--entity-list-columns);
  align-items: center;
  gap: var(--entity-list-gap);
  border: 0;
  border-radius: calc(var(--radius-control) - .15rem);
  padding: 0;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.global-facility-region-row__identity,
.global-facility-region-row__profit,
.global-facility-region-row__metric,
.global-facility-region-row__status,
.global-facility-region-row__chevron {
  min-width: 0;
  pointer-events: none;
}

.global-facility-region-row__quick-controls {
  grid-column: 1 / -2;
  grid-row: 2;
  z-index: 3;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: .35rem;
}

@container (max-width: 620px) {
  .entity-list-row.global-facility-region-row {
    --global-facility-region-row-gap: 2px;
  }

  .global-facility-region-row__quick-controls {
    gap: .25rem;
  }
}

@container (max-width: 360px) {
  .entity-list-row.global-facility-region-row {
    --global-facility-region-row-gap: 1px;
  }

  .global-facility-region-row__quick-controls {
    gap: .18rem;
  }
}

@media (max-width: 720px) {
  .entity-list-row.global-facility-catalog-row,
  .entity-list-row.global-facility-region-row {
    padding-block: 1px;
  }

  .entity-list-row.global-facility-catalog-row {
    --global-facility-catalog-main-row-size: 44px;
    --global-facility-catalog-row-gap: 1px;
  }

  .entity-list-row.global-facility-region-row {
    --global-facility-region-main-row-size: 44px;
    --global-facility-region-row-gap: 1px;
  }
}
'''
write(path, content)

# 4. Authoritative design documents: three contexts share the same production-config visual/content model.
path = 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md'
content = read(path)
content = content.replace(
    '第二行只在工厂身份列内显示“当前生产产物”和“当前作业制度”两个方形图标，不得显示文字标题、字段名、状态胶囊、保存按钮或行内展开详情。两个图标分别作为紧凑富内容下拉选择器的触发面；点击后只允许在工作区顶层浮出当前已解锁且对该工厂有效的候选，不得撑开条目、插入第三行或新增独立配置面板；没有第二个可用选项时图标保持只读。若不同已解锁持有州当前配置不同，仍只使用同一个图标槽并以弱化虚线边框表达混合状态，不新增“多种配置”等可见元素。',
    '第二行显示“当前生产产物”和“当前作业制度”两个方形生产方案槽，不得显示文字标题、字段名、状态胶囊、保存按钮或行内展开详情。两个方案槽必须直接复用建筑详情页 `FacilityProductionProductSelect` / `FacilityProductionMethodSelect` 与 `production-config` 视觉：收起按钮继续只显示 `ProductArtwork` / 作业制度 Icon，边框、背景、交互态和展开后的候选内容结构与详情页一致；列表场景只允许把触发尺寸紧凑到 `48px`，不得另写第二套按钮皮肤或简化候选内容。候选菜单继续在工作区顶层浮出，不得撑开条目、插入第三行或新增独立配置面板；单一候选仍保持与详情页一致的可打开方案槽。若不同已解锁持有州当前配置不同，仍只使用同一个方案槽并以弱化虚线边框表达混合状态，不新增“多种配置”等可见元素。',
    1,
)
content = content.replace(
    '一级全局工厂目录是通用实体列表中明确登记的两行高度例外，第一行地区下钻保持至少 `44px` 可操作高度，整体响应式高度约为 `96px / 88px / 84px`；条目自身四边必须统一使用同一个共享列表横向内边距令牌，禁止分别设置上下与左右内边距；地区工厂列表同步登记为相同的两行高度例外，但不得加入工厂插画、商品图标或作业制度图标；第一行继续使用“地区｜利润／分钟｜拥有｜状态｜Chevron”共享列并负责进入地区工厂详情，第二行只使用纯文字“生产产物／作业制度”下拉选择器。',
    '一级全局工厂目录是通用实体列表中明确登记的两行高度例外：桌面第一行收紧为 `32px`，移动端为保证触控继续使用 `44px`；第二行生产方案槽固定使用列表场景 `48px` 紧凑尺寸，整体自然高度约 `93～96px`。横向内边距继续统一使用共享 `--entity-list-inline-padding` 保证第一行与表头列对齐，纵向内边距允许为两行密度单独收紧。地区工厂列表同步登记为相同的两行高度例外，不加入 `FacilityIcon` 场景插画；第一行继续使用“地区｜利润／分钟｜拥有｜状态｜Chevron”共享列并负责进入地区工厂详情，第二行与建筑详情页复用同一 `production-config` 生产产物／作业制度方案槽及富内容候选，因此允许显示 `ProductArtwork` 与作业制度 Icon。',
    1,
)
write(path, content)

path = 'docs/UI_DESIGN_SYSTEM.md'
content = read(path)
old = '一级全局建筑 `.global-facility-catalog-row` 为容纳第二行两个图标生产设置，登记为约 `96px / 88px / 84px` 的两行高度例外，第一行继续对齐共享表头，`FacilityIcon` 正方形插画跨两行，第二行只允许留在身份列；该条目四边内边距必须使用同一个共享列表横向内边距令牌，地区下钻主按钮只覆盖第一行，第二行两个图标复用 `production-config` 富内容选择器并只在工作区顶层显示候选列表，不得行内展开。 工厂地区列表 `.global-facility-region-row` 同步登记为约 `96px / 88px / 84px` 的两行高度例外，第一行仍使用共享表头列并独占下钻交互，第二行使用无视觉图标的纯文字 `RichSelectInput`；地区条目不得增加 `FacilityIcon`、`ProductArtwork` 或作业制度图标，四边内边距同样统一复用 `--entity-list-inline-padding`。地区建筑列表仍使用共享单行高度，除这两类外其他市场、地区商品、建筑或地区建筑不得维护另一套列表密度。'
new = '一级全局建筑 `.global-facility-catalog-row` 为容纳第二行生产设置，登记为约 `93～96px` 的两行高度例外：桌面第一行固定收紧到 `32px`，移动端第一行保持 `44px` 触控高度；`FacilityIcon` 正方形插画跨两行，第二行两个方案槽使用列表场景 `48px` 尺寸。横向内边距继续复用 `--entity-list-inline-padding` 与共享表头对齐，纵向内边距允许按两行密度独立收紧；地区下钻主按钮只覆盖第一行。第二行必须复用建筑详情页 `FacilityProductionProductSelect` / `FacilityProductionMethodSelect` 及同一个 `production-config` 变体，按钮皮肤、`ProductArtwork` / 作业制度 Icon、候选名称、投入／产出／周期／成本和相对变化摘要与详情页保持同源，仅触发尺寸可按列表密度从详情默认尺寸收紧到 `48px`。工厂地区列表 `.global-facility-region-row` 同步使用相同的两行密度与共享生产方案槽，但不增加 `FacilityIcon` 场景插画；第一行仍使用共享表头列并独占下钻交互。除这两类外其他市场、地区商品、建筑或地区建筑不得维护另一套列表密度。'
if old not in content: raise SystemExit('missing UI design entity list paragraph')
content = content.replace(old, new, 1)
write(path, content)

path = 'docs/PRIMARY_SURFACE_INSET_DESIGN.md'
content = read(path)
content = content.replace(
    '一级全局工厂目录在 `620px`、`360px` 实际承载断点保持已登记的两行高度与身份列图标例外，第一行共享列、gap 和 Chevron 仍由 `entity-list-header.css` 控制，条目四边必须统一复用其 `--entity-list-inline-padding`；工厂类型下的地区工厂列表同步保持两行密度、第一行下钻与第二行无图标纯文字生产下拉。',
    '一级全局工厂目录在 `620px`、`360px` 实际承载断点保持已登记的两行高度与插画跨行例外，第一行共享列、gap 和 Chevron 仍由 `entity-list-header.css` 控制，横向内边距必须复用其 `--entity-list-inline-padding`，纵向内边距允许为两行密度独立收紧；工厂类型下的地区工厂列表同步保持两行密度、第一行下钻与第二行同源 `production-config` 图标方案槽。',
    1,
)
content = content.replace(
    '一级全局工厂目录和地区工厂列表条目必须保持约 `84～96px` 的登记两行高度，地区工厂条目继续保持不高于 `58px` 的共享单行高度；',
    '一级全局工厂目录和地区工厂列表条目必须保持约 `93～96px` 的登记两行高度；桌面第一行收紧到 `32px`，移动端第一行保持 `44px`，不得再恢复地区工厂单行高度规则；',
    1,
)
write(path, content)

# 5. Static verifiers follow the new authority and ensure the shared selectors cannot diverge again.
path = 'scripts/verify-page-content.mjs'
content = read(path)
content = content.replace(
    "  'src/components/ui/RichSelectInput.tsx',\n",
    "  'src/components/ui/RichSelectInput.tsx',\n  'src/components/facilities/FacilityProductionConfigControls.tsx',\n",
    1,
)
content = content.replace("  '第二行只使用纯文字“生产产物／作业制度”下拉选择器',\n", "  '第二行与建筑详情页复用同一 `production-config` 生产产物／作业制度方案槽及富内容候选',\n", 1)
content = content.replace("    'visual: <ProductArtwork productId={option.productId} />,',\n    'visual: <QuickProductionMethodIcon methodId={option.id as FacilityProductionMethodId} />,',\n", "    '<FacilityProductionProductSelect',\n    '<FacilityProductionMethodSelect',\n", 1)
content = content.replace("    '<RichSelectInput',\n    'variant=\"production-config\"',\n", "    '<FacilityProductionProductSelect',\n    '<FacilityProductionMethodSelect',\n", 1)
content = content.replace("  '--entity-list-row-height: 96px;',\n", "  '--global-facility-production-control-size: 48px;',\n", 1)
content = content.replace("  'padding: var(--entity-list-inline-padding);',\n  'padding-block: var(--entity-list-inline-padding);',\n  'padding-inline: var(--entity-list-inline-padding);',\n", "  'padding-block: .375rem;',\n  'padding-inline: var(--entity-list-inline-padding);',\n", 1)
content = content.replace("  '--global-facility-catalog-main-row-size: 44px;',\n", "  '--global-facility-catalog-main-row-size: 32px;',\n", 1)
content = content.replace("  '/* Global facility region rows mirror the two-line production layout without artwork. */',\n", "  '/* Global facility region rows mirror the two-line production layout without facility artwork. */',\n", 1)
content = content.replace("  '.global-facility-region-row__quick-selector .ui-rich-select__trigger {',\n  '--global-facility-region-main-row-size: 44px;',\n  \".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger\",\n", "  '.global-facility-region-row__quick-selector .ui-rich-select[data-variant=\'production-config\'] .ui-rich-select__trigger {',\n  '--global-facility-region-main-row-size: 32px;',\n  \".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger\",\n", 1)
insert_after = "]) requireText('src/styles/global-operation-pages.css', text);\n"
idx = content.find(insert_after)
if idx < 0: raise SystemExit('missing page verifier css block end')
idx += len(insert_after)
content = content[:idx] + "for (const text of [\n  'export function FacilityProductionProductSelect',\n  'export function FacilityProductionMethodSelect',\n  'detail: <ProductPlanDetail',\n  'detail: !plan',\n  'variant=\"production-config\"',\n]) requireText('src/components/facilities/FacilityProductionConfigControls.tsx', text);\nforbidText('src/pages/GlobalBuildingsPage.tsx', 'variant=\"default\"');\n" + content[idx:]
write(path, content)

path = 'scripts/verify-primary-surface-insets.mjs'
content = read(path)
content = content.replace(
    "    'padding: var(--entity-list-inline-padding);',\n    'padding-block: var(--entity-list-inline-padding);',\n    'padding-inline: var(--entity-list-inline-padding);',\n",
    "    'padding-block: .375rem;',\n    'padding-inline: var(--entity-list-inline-padding);',\n",
    1,
)
content = content.replace("    '--global-facility-catalog-main-row-size: 44px;',\n", "    '--global-facility-catalog-main-row-size: 32px;',\n    '--global-facility-production-control-size: 48px;',\n", 1)
content = content.replace("    '条目四边统一使用同一个 `--entity-list-inline-padding`',\n", "    '横向内边距必须复用其 `--entity-list-inline-padding`',\n", 1)
content = content.replace("    '极窄 `360px` 及以下进一步收紧到约 `84px / 66px / 24px`',\n", "", 1)
content = content.replace("    '一级全局工厂目录和地区工厂列表条目必须保持约 `84～96px` 的登记两行高度',\n", "    '一级全局工厂目录和地区工厂列表条目必须保持约 `93～96px` 的登记两行高度',\n", 1)
write(path, content)

path = 'scripts/verify-production-methods.mjs'
content = read(path)
old = """for (const text of [
  'export function FacilityProductionConfigControls',
  'variant="production-config"',
"""
new = """for (const text of [
  'export function FacilityProductionConfigControls',
  'export function FacilityProductionProductSelect',
  'export function FacilityProductionMethodSelect',
  'variant="production-config"',
"""
if old not in content: raise SystemExit('missing production verifier component block')
content = content.replace(old, new, 1)
write(path, content)

# 6. Browser regression: both list levels use the same variant/content, and desktop first row is genuinely shorter.
path = 'tests/browser/global-operation-pages.spec.ts'
content = read(path)
content = content.replace(
    "  expect(openBox.y + openBox.height).toBeLessThanOrEqual(productBox.y + 1);\n",
    "  expect(openBox.y + openBox.height).toBeLessThanOrEqual(productBox.y + 1);\n  expect(openBox.height).toBeGreaterThanOrEqual(30);\n  expect(openBox.height).toBeLessThan(44);\n",
    1,
)
content = content.replace(
    "  expect(new Set(rowPadding).size).toBe(1);\n",
    "  expect(rowPadding[0]).toBe(rowPadding[2]);\n  expect(rowPadding[1]).toBe(rowPadding[3]);\n  expect(Number.parseFloat(rowPadding[0])).toBeLessThan(Number.parseFloat(rowPadding[1]));\n",
    1,
)
content = content.replace(
    "    await expect(page.getByRole('listbox')).toBeVisible();\n    expect(await page.getByRole('option').count()).toBeGreaterThan(1);\n",
    "    const productListbox = page.getByRole('listbox');\n    await expect(productListbox).toBeVisible();\n    await expect(productListbox).toHaveAttribute('data-variant', 'production-config');\n    await expect(productListbox.locator('.ui-rich-select__visual').first()).toBeVisible();\n    await expect(productListbox.locator('.production-config-detail').first()).toBeVisible();\n    expect(await page.getByRole('option').count()).toBeGreaterThan(1);\n",
    1,
)
content = content.replace(
    "  await expect(regionalFacilityRow.locator('.global-facility-region-row__quick-controls .ui-rich-select__visual')).toHaveCount(0);\n",
    "  await expect(regionalFacilityRow.locator('.global-facility-region-row__quick-controls .ui-rich-select__visual')).toHaveCount(2);\n",
    1,
)
content = content.replace(
    "  const regionProductSelect = regionQuickProduct.getByRole('combobox');\n",
    "  const regionOpenBox = await regionOpenButton.boundingBox();\n  expect(regionOpenBox).not.toBeNull();\n  if (!regionOpenBox) throw new Error('地区工厂第一行未渲染');\n  expect(regionOpenBox.height).toBeGreaterThanOrEqual(30);\n  expect(regionOpenBox.height).toBeLessThan(44);\n  const regionProductSelect = regionQuickProduct.getByRole('combobox');\n  await expect(regionProductSelect).toHaveAttribute('data-variant', 'production-config');\n",
    1,
)
# Replace the second listbox occurrence (regional product) with rich-content assertions.
needle = "    await expect(page.getByRole('listbox')).toBeVisible();\n    expect(await page.getByRole('option').count()).toBeGreaterThan(1);\n"
pos = content.find(needle)
if pos < 0: raise SystemExit('missing regional listbox assertion')
content = content[:pos] + "    const regionProductListbox = page.getByRole('listbox');\n    await expect(regionProductListbox).toBeVisible();\n    await expect(regionProductListbox).toHaveAttribute('data-variant', 'production-config');\n    await expect(regionProductListbox.locator('.ui-rich-select__visual').first()).toBeVisible();\n    await expect(regionProductListbox.locator('.production-config-detail').first()).toBeVisible();\n    expect(await page.getByRole('option').count()).toBeGreaterThan(1);\n" + content[pos + len(needle):]
# Compare the list trigger skin to the actual detail-page trigger after drilling in.
content = content.replace(
    "  const regionalProvinceId = await regionalFacilityRow.getAttribute('data-province-id');\n",
    "  const regionTriggerStyle = await regionProductSelect.evaluate((element) => {\n    const style = getComputedStyle(element);\n    return {\n      borderRadius: style.borderRadius,\n      borderTopColor: style.borderTopColor,\n      backgroundColor: style.backgroundColor,\n      color: style.color,\n    };\n  });\n  const regionalProvinceId = await regionalFacilityRow.getAttribute('data-province-id');\n",
    1,
)
content = content.replace(
    "  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();\n",
    "  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();\n  const detailProductSelect = page.locator('.facility-production-settings-grid').getByRole('combobox').first();\n  await expect(detailProductSelect).toHaveAttribute('data-variant', 'production-config');\n  const detailTriggerStyle = await detailProductSelect.evaluate((element) => {\n    const style = getComputedStyle(element);\n    return {\n      borderRadius: style.borderRadius,\n      borderTopColor: style.borderTopColor,\n      backgroundColor: style.backgroundColor,\n      color: style.color,\n    };\n  });\n  expect(regionTriggerStyle).toEqual(detailTriggerStyle);\n",
    1,
)
write(path, content)

print('Applied shared production-config list styling and compact first-row geometry')
