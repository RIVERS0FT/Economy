import { Fragment } from 'react';
import { CreditsIcon, CycleIcon, WarehouseIcon } from '../icons/GameIcons';
import { ProductIcon } from '../icons/ProductIcons';
import type {
  FacilityGroup,
  FacilityRecipeItem,
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
import { FacilityGroupProgress } from './FacilityProgress';
import { FacilityRecipeProfitAnalysis } from './FacilityRecipeProfitAnalysis';

type MultiRecipeFacilityType = FacilityTypeDefinition & {
  inputs?: FacilityRecipeItem[];
  outputs?: FacilityRecipeItem[];
};

type ProductNameMap = Map<string, string>;

export type FormulaScope = {
  name: string;
  count: number;
  physicalCount: number;
  staffingRateBps: number;
  label: string;
  description: string;
};

function recipeInputs(type: FacilityTypeDefinition) {
  const extendedType = type as MultiRecipeFacilityType;
  if (extendedType.inputs?.length) return extendedType.inputs;
  return extendedType.input ? [extendedType.input] : [];
}

function recipeOutputs(type: FacilityTypeDefinition) {
  const extendedType = type as MultiRecipeFacilityType;
  if (extendedType.outputs?.length) return extendedType.outputs;
  return [extendedType.output];
}

function normalizedStaffingRate(rateBps: number | undefined) {
  return Math.max(0, Math.min(10_000, Math.floor(Number(rateBps ?? 10_000))));
}

function staffingRateLabel(rateBps: number) {
  return `${Math.round(rateBps / 100)}%`;
}

function formulaScope(
  name: string,
  physicalCount: number,
  effectiveCount: number,
  staffingRateBps: number,
  descriptionPrefix: string,
): FormulaScope {
  const normalizedPhysicalCount = Math.max(0, physicalCount);
  const normalizedEffectiveCount = Math.max(0, effectiveCount);
  const normalizedRate = normalizedStaffingRate(staffingRateBps);
  return {
    name,
    count: normalizedEffectiveCount,
    physicalCount: normalizedPhysicalCount,
    staffingRateBps: normalizedRate,
    label: `${name} ${formatNumber(normalizedPhysicalCount)} 座 · 满员率 ${staffingRateLabel(normalizedRate)} · 等效 × ${formatNumber(normalizedEffectiveCount)}`,
    description: `${descriptionPrefix}${formatNumber(normalizedPhysicalCount)} 座工厂按 ${staffingRateLabel(normalizedRate)} 满员率形成 ${formatNumber(normalizedEffectiveCount)} 座等效产能`,
  };
}

export function currentFormulaScope(group: FacilityGroup): FormulaScope {
  if (group.status === 'running') {
    return formulaScope(
      '本周期',
      group.participatingCount,
      group.cycleEffectiveCount ?? group.participatingCount,
      group.cycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
      '本周期 ',
    );
  }

  if (group.status === 'error') {
    return formulaScope(
      '恢复后',
      group.nextCycleCount,
      group.nextCycleEffectiveCount ?? group.nextCycleCount,
      group.nextCycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
      '条件恢复后 ',
    );
  }

  return formulaScope(
    '启动后',
    group.nextCycleCount,
    group.nextCycleEffectiveCount ?? group.nextCycleCount,
    group.nextCycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
    '启动后 ',
  );
}

export function nextFormulaScope(group: FacilityGroup): FormulaScope {
  return formulaScope(
    '下一周期',
    group.nextCycleCount,
    group.nextCycleEffectiveCount ?? group.nextCycleCount,
    group.nextCycleStaffingRateBps ?? group.staffingRateBps ?? 10_000,
    '下一周期 ',
  );
}

function recipeText(items: FacilityRecipeItem[], productNames: ProductNameMap, multiplier: number) {
  return items
    .map((item) => `${formatNumber(item.quantity * multiplier)} ${productNames.get(item.productId) ?? item.productId}`)
    .join('和');
}

function RecipeItems({
  items,
  productNames,
  inventories,
  multiplier,
  showInventory = false,
  groupClassName,
  itemClassName,
}: {
  items: FacilityRecipeItem[];
  productNames: ProductNameMap;
  inventories: Record<string, ProductInventory>;
  multiplier: number;
  showInventory?: boolean;
  groupClassName: string;
  itemClassName: string;
}) {
  return (
    <div className={groupClassName}>
      {items.map((item, index) => {
        const productName = productNames.get(item.productId) ?? item.productId;
        const quantity = item.quantity * multiplier;
        return (
          <Fragment key={`${item.productId}-${index}`}>
            {index > 0 ? <span className="facility-formula-separator">+</span> : null}
            <span className="facility-formula-item-group">
              <span className={itemClassName} title={`${formatNumber(quantity)} ${productName}`}>
                <strong>{formatNumber(quantity)} ×</strong>
                <ProductIcon productId={item.productId} />
              </span>
              {showInventory ? (
                <span className="facility-formula-inventory" title={`${productName}库存`}>
                  <WarehouseIcon className="facility-formula-meta-icon" />
                  <span>{formatNumber(inventories[item.productId]?.available ?? 0)}</span>
                </span>
              ) : null}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

function progressDescription(group: FacilityGroup, type: FacilityTypeDefinition, now: number) {
  if (group.status !== 'running' || !group.cycleStartedAt) {
    return group.status === 'error' ? '当前等待条件恢复' : '当前未运行';
  }

  const elapsed = Math.max(0, now - group.cycleStartedAt);
  const cycleElapsed = elapsed % type.cycleMs;
  const progress = Math.max(0, Math.min(100, (cycleElapsed / type.cycleMs) * 100));
  return `当前生产进度 ${Math.round(progress)}%`;
}

function clusterRecipeDescription(
  type: FacilityTypeDefinition,
  productNames: ProductNameMap,
  scope: FormulaScope,
) {
  const inputs = recipeInputs(type);
  const outputs = recipeOutputs(type);
  const inputDescription = inputs.length > 0
    ? `消耗${recipeText(inputs, productNames, scope.count)}`
    : '不消耗原料';
  return `${scope.description}每${formatDuration(type.cycleMs)}${inputDescription}，产出${recipeText(outputs, productNames, scope.count)}，成本${formatCurrency(type.operatingCost * scope.count)}`;
}

export function FacilityProductionFormula({
  group,
  type,
  nextType,
  showNextCyclePreview,
  products,
  inventories,
  now,
}: {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
  nextType: FacilityTypeDefinition;
  showNextCyclePreview: boolean;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
}) {
  const inputs = recipeInputs(type);
  const outputs = recipeOutputs(type);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const scope = currentFormulaScope(group);
  const nextScope = nextFormulaScope(group);
  const currentDescription = clusterRecipeDescription(type, productNames, scope);
  const nextDescription = showNextCyclePreview
    ? clusterRecipeDescription(nextType, productNames, nextScope)
    : '';
  const description = [currentDescription, progressDescription(group, type, now), nextDescription]
    .filter(Boolean)
    .join('。');
  const profitScope = showNextCyclePreview ? nextScope : scope;
  const profitType = showNextCyclePreview ? nextType : type;
  const profitScopeLabel = profitScope.name;

  return (
    <>
      <div className="facility-production-formula" role="group" aria-label={description}>
        <div className="facility-formula-scope" aria-hidden="true">{scope.label}</div>
        <div className="facility-formula-visual" aria-hidden="true">
          <div className="facility-formula-top">
            <div className="facility-formula-input">
              {inputs.length > 0 ? (
                <RecipeItems
                  items={inputs}
                  productNames={productNames}
                  inventories={inventories}
                  multiplier={scope.count}
                  showInventory
                  groupClassName="facility-formula-input-group"
                  itemClassName="facility-formula-input-item"
                />
              ) : <span className="facility-formula-empty">无</span>}
            </div>

            <div className="facility-formula-center">
              <span className="facility-formula-meta-unit">
                <CycleIcon className="facility-formula-meta-icon" />
                <span>{formatDuration(type.cycleMs)}</span>
              </span>
              <span className="facility-formula-meta-divider">·</span>
              <span className="facility-formula-meta-unit">
                <CreditsIcon className="facility-formula-meta-icon" />
                <span>{formatCurrency(type.operatingCost * scope.count)}</span>
              </span>
            </div>

            <div className="facility-formula-output">
              <RecipeItems
                items={outputs}
                productNames={productNames}
                inventories={inventories}
                multiplier={scope.count}
                groupClassName="facility-formula-output-group"
                itemClassName="facility-formula-output-item"
              />
            </div>
          </div>

          <div className="facility-formula-progress">
            <FacilityGroupProgress group={group} type={type} now={now} />
          </div>
        </div>
      </div>

      <FacilityRecipeProfitAnalysis
        type={profitType}
        scopeCount={profitScope.physicalCount}
        scopeLabel={profitScopeLabel}
        staffingRateBps={profitScope.staffingRateBps}
        products={products}
        inventories={inventories}
      />
    </>
  );
}
