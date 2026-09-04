import { CompactCurrency, CompactNumber } from '../ui/CompactNumber';
import { CreditsIcon, CycleIcon, WarehouseIcon } from '../icons/GameIcons';
import { ProductArtwork } from '../products/ProductArtwork';
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

function RecipeItems({
  items,
  productNames,
  inventories,
  multiplier,
  groupClassName,
  itemClassName,
  onOpenProductMarket,
}: {
  items: FacilityRecipeItem[];
  productNames: ProductNameMap;
  inventories: Record<string, ProductInventory>;
  multiplier: number;
  groupClassName: string;
  itemClassName: string;
  onOpenProductMarket: (productId: string) => void;
}) {
  return (
    <div className={groupClassName}>
      {items.map((item, index) => {
        const productName = productNames.get(item.productId) ?? item.productId;
        const quantity = item.quantity * multiplier;
        const warehouseQuantity = inventories[item.productId]?.available ?? 0;
        return (
          <button
            type="button"
            className="facility-formula-item-group"
            data-ui-interactive="surface"
            key={`${item.productId}-${index}`}
            aria-label={`查看${productName}本地商品详情，生产数量 ${formatNumber(quantity)}，仓库可用 ${formatNumber(warehouseQuantity)}`}
            title={`查看${productName}本地商品详情 · 生产 ${formatNumber(quantity)} · 仓库可用 ${formatNumber(warehouseQuantity)}`}
            onClick={() => onOpenProductMarket(item.productId)}
          >
            <span className={itemClassName}>
              <ProductArtwork productId={item.productId} className="facility-formula-product-artwork" />
              <strong>{<CompactNumber value={quantity} />}</strong>
              <span className="facility-formula-inventory" title={`${productName}仓库可用数量`}>
                <WarehouseIcon className="facility-formula-meta-icon" />
                <span>{<CompactNumber value={warehouseQuantity} />}</span>
              </span>
            </span>
          </button>
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
  const inputs = recipeInputs(type);
  const outputs = recipeOutputs(type);
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const scope = currentFormulaScope(group, now);
  const currentDescription = clusterRecipeDescription(type, productNames, scope);
  const description = [currentDescription, progressDescription(group, type, now)]
    .filter(Boolean)
    .join('。');

  return (
    <section className="facility-production-formula"
        data-status={group.status}
        role="group"
        aria-label={description}
      >
        <div className="facility-production-formula-heading">
          <strong><GameConcept concept="production-settlement" /></strong>
        </div>
        <div className="facility-formula-visual">
          <div className="facility-formula-top">
            <div className="facility-formula-input-side">
              <span className="facility-formula-side-label"><GameConcept concept="production-input" /></span>
              <div className="facility-formula-input">
                {inputs.length > 0 ? (
                  <RecipeItems
                    items={inputs}
                    productNames={productNames}
                    inventories={inventories}
                    multiplier={scope.count}
                    groupClassName="facility-formula-input-group"
                    itemClassName="facility-formula-input-item"
                    onOpenProductMarket={onOpenProductMarket}
                  />
                ) : <span className="facility-formula-empty">无</span>}
              </div>
            </div>

            <div className="facility-formula-output-side">
              <span className="facility-formula-side-label"><GameConcept concept="production-output" /></span>
              <div className="facility-formula-output">
                <RecipeItems
                  items={outputs}
                  productNames={productNames}
                  inventories={inventories}
                  multiplier={scope.count}
                  groupClassName="facility-formula-output-group"
                  itemClassName="facility-formula-output-item"
                  onOpenProductMarket={onOpenProductMarket}
                />
              </div>
            </div>
          </div>

          <div className="facility-formula-meta" aria-hidden="true">
            <span className="facility-formula-meta-unit is-cycle">
              <CycleIcon className="facility-formula-meta-icon" />
              <span>{formatDuration(type.cycleMs)}</span>
            </span>
            <span className="facility-formula-meta-unit is-cost">
              <CreditsIcon className="facility-formula-meta-icon" />
              <span>{<CompactCurrency value={type.operatingCost * scope.count} />}</span>
            </span>
          </div>

          <div className="facility-formula-progress" aria-hidden="true">
            <FacilityGroupProgress group={group} type={type} now={now} />
          </div>
        </div>
    </section>
  );
}
