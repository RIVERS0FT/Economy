import { productionOperatingCostForCycle } from '../../../shared/production-settlement.js';
import { BuildingSettlementPanel } from '../buildings/BuildingSettlementPanel';
import { BuildingSettlementProducts as RecipeItems } from '../buildings/BuildingSettlementProducts';
import { GameConcept } from '../ui/GameConcept';
import type {
  FacilityGroup,
  FacilityRecipeItem,
  FacilityTypeDefinition,
  ProductDefinition,
  ProductInventory,
} from '../../types';
import { formatCurrency, formatDuration, formatNumber } from '../../utils/formatters';
import { facilityEffectiveCount, projectFacilityStaffingRate } from '../../utils/facilityStaffing';
import { FacilityGroupProgress } from './FacilityProgress';

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
  group: FacilityGroup,
  physicalCount: number,
  now: number,
  descriptionPrefix: string,
): FormulaScope {
  const normalizedPhysicalCount = Math.max(0, physicalCount);
  const staffingRateBps = projectFacilityStaffingRate(group, now);
  const effectiveCount = facilityEffectiveCount(group, normalizedPhysicalCount, now);
  return {
    name,
    count: effectiveCount,
    physicalCount: normalizedPhysicalCount,
    staffingRateBps,
    description: `${descriptionPrefix}${formatNumber(normalizedPhysicalCount)} 座工厂按完成时预计 ${staffingRateLabel(staffingRateBps)} 满员率形成 ${formatNumber(effectiveCount)} 座整数等效产能，`,
  };
}

export function currentFormulaScope(group: FacilityGroup, now: number): FormulaScope {
  if (group.status === 'running') {
    return formulaScope('本周期', group, group.participatingCount, now, '当前 ');
  }

  const physicalCount = group.productionAvailableCount ?? group.participatingCount;
  if (group.status === 'error') {
    return formulaScope('恢复后', group, physicalCount, now, '条件恢复后 ');
  }

  return formulaScope('启动后', group, physicalCount, now, '启动后 ');
}

function recipeText(items: FacilityRecipeItem[], productNames: ProductNameMap, multiplier: number) {
  return items
    .map((item) => `${formatNumber(item.quantity * multiplier)} ${productNames.get(item.productId) ?? item.productId}`)
    .join('和');
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
  type: catalogType,
  products,
  inventories,
  now,
  onOpenProductMarket,
}: {
  group: FacilityGroup;
  type: FacilityTypeDefinition;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  now: number;
  onOpenProductMarket: (productId: string) => void;
}) {
  const type = { ...catalogType, operatingCost: productionOperatingCostForCycle(group, group.activeRecipeId, catalogType.operatingCost) };
  const inputs = recipeInputs(type);
  const outputs = recipeOutputs(type);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const scope = currentFormulaScope(group, now);
  const currentDescription = clusterRecipeDescription(type, productNames, scope);
  const description = [currentDescription, progressDescription(group, type, now)]
    .filter(Boolean)
    .join('。');

  return (
    <BuildingSettlementPanel title={<GameConcept concept="production-settlement" />} status={group.status} description={description}
      inputLabel={<GameConcept concept="production-input" />} outputLabel={<GameConcept concept="production-output" />}
      inputs={inputs.length > 0 ? <RecipeItems items={inputs} productNames={productNames} inventories={inventories}
        multiplier={scope.count} groupClassName="facility-formula-input-group" itemClassName="facility-formula-input-item"
        onOpenProductMarket={onOpenProductMarket} /> : <span className="facility-formula-empty">无</span>}
      outputs={<RecipeItems items={outputs} productNames={productNames} inventories={inventories}
        multiplier={scope.count} groupClassName="facility-formula-output-group" itemClassName="facility-formula-output-item"
        onOpenProductMarket={onOpenProductMarket} />}
      cycleMs={type.cycleMs} operatingCost={type.operatingCost * scope.count}
      progress={<FacilityGroupProgress group={group} type={type} now={now} />}
    />
  );
}
