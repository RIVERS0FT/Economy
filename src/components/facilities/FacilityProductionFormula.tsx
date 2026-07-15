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

type MultiRecipeFacilityType = FacilityTypeDefinition & {
  inputs?: FacilityRecipeItem[];
  outputs?: FacilityRecipeItem[];
};

type ProductNameMap = Map<string, string>;

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

function recipeText(items: FacilityRecipeItem[], productNames: ProductNameMap) {
  return items
    .map((item) => `${formatNumber(item.quantity)} ${productNames.get(item.productId) ?? item.productId}`)
    .join('和');
}

function RecipeItems({
  items,
  productNames,
  inventories,
  showInventory = false,
  groupClassName,
  itemClassName,
}: {
  items: FacilityRecipeItem[];
  productNames: ProductNameMap;
  inventories: Record<string, ProductInventory>;
  showInventory?: boolean;
  groupClassName: string;
  itemClassName: string;
}) {
  return (
    <div className={groupClassName}>
      {items.map((item, index) => {
        const productName = productNames.get(item.productId) ?? item.productId;
        return (
          <Fragment key={`${item.productId}-${index}`}>
            {index > 0 ? <span className="facility-formula-separator">+</span> : null}
            <span className="facility-formula-item-group">
              <span className={itemClassName} title={`${formatNumber(item.quantity)} ${productName}`}>
                <strong>{formatNumber(item.quantity)} ×</strong>
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

function recipeDescription(type: FacilityTypeDefinition, productNames: ProductNameMap) {
  const inputs = recipeInputs(type);
  const outputs = recipeOutputs(type);
  const inputDescription = inputs.length > 0
    ? `消耗${recipeText(inputs, productNames)}`
    : '不消耗原料';
  return `单座配方每${formatDuration(type.cycleMs)}${inputDescription}，产出${recipeText(outputs, productNames)}，成本${formatCurrency(type.operatingCost)}`;
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
  const currentDescription = recipeDescription(type, productNames);
  const nextDescription = showNextCyclePreview
    ? `下一周期${recipeDescription(nextType, productNames)}`
    : '';
  const description = `${currentDescription}。${progressDescription(group, type, now)}。${nextDescription}`;

  return (
    <div className="facility-production-formula" role="group" aria-label={description}>
      <div className="facility-formula-visual" aria-hidden="true">
        <div className="facility-formula-top">
          <div className="facility-formula-input">
            {inputs.length > 0 ? (
              <RecipeItems
                items={inputs}
                productNames={productNames}
                inventories={inventories}
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
              <span>{formatCurrency(type.operatingCost)}</span>
            </span>
          </div>

          <div className="facility-formula-output">
            <RecipeItems
              items={outputs}
              productNames={productNames}
              inventories={inventories}
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
  );
}
