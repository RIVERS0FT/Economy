const freezeOptions = (options) => Object.freeze(options.map((option) => Object.freeze(option)));
const freezeClasses = (classes) => Object.freeze(classes.map((demandClass) => Object.freeze({
  ...demandClass,
  products: freezeOptions(demandClass.products),
})));

export const PRICE_WINDOW_MS = 30 * 60 * 1000;
export const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ACTIVE_PLAYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const PLAYER_SCALE_MAX = 6;
export const BUDGET_SMOOTHING = 0.35;
export const BUDGET_MAX_RISE = 0.20;
export const BUDGET_MAX_FALL = 0.20;
export const SHARE_SMOOTHING = 0.30;
export const SHARE_MAX_CHANGE = 0.15;
export const DIRECT_BUDGET_SHARE = 0.85;
export const RELATION_LAG_WEIGHTS = Object.freeze([0.60, 0.30, 0.10]);
export const PRICE_MIN_MULTIPLIER = 0.5;
export const PRICE_MAX_MULTIPLIER = 3;
export const PRICE_RISE_RATE = 0.30;
export const PRICE_FALL_RATE = 0.20;
export const PRICE_BASE_REVERSION = 0.02;

export const MARKET_DEMAND_GROUP_CATALOG = Object.freeze([
  Object.freeze({
    id: 'food',
    name: '食品市场',
    ownerName: '食品市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 1_000,
    targetSatisfaction: 0.82,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    quoteUtilityDepth: 12,
    classes: freezeClasses([
      {
        id: 'staples', name: '主食', budgetShare: 0.50, minBudgetShare: 0.35, maxBudgetShare: 0.65,
        elasticity: 1.8,
        products: [
          { productId: 'wheat', baseWeight: 0.25, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'rice', baseWeight: 0.25, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'flour', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.05 },
          { productId: 'food', baseWeight: 0.30, utilityPerUnit: 3, minShare: 0.10 },
        ],
      },
      {
        id: 'protein', name: '蛋白质', budgetShare: 0.35, minBudgetShare: 0.20, maxBudgetShare: 0.50,
        elasticity: 2.5,
        products: [
          { productId: 'meat', baseWeight: 0.40, utilityPerUnit: 2, minShare: 0.08 },
          { productId: 'eggs', baseWeight: 0.30, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'milk', baseWeight: 0.30, utilityPerUnit: 1, minShare: 0.08 },
        ],
      },
      {
        id: 'convenience', name: '便利食品', budgetShare: 0.15, minBudgetShare: 0.05, maxBudgetShare: 0.30,
        elasticity: 0.8,
        products: [{ productId: 'food', baseWeight: 1, utilityPerUnit: 3, minShare: 1 }],
      },
    ]),
    seedDemandQuantities: Object.freeze({ food: 12, meat: 5, eggs: 8, milk: 8, flour: 6 }),
  }),
  Object.freeze({
    id: 'household',
    name: '家庭消费市场',
    ownerName: '家庭消费市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 900,
    targetSatisfaction: 0.78,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    quoteUtilityDepth: 8,
    classes: freezeClasses([
      {
        id: 'home', name: '家居', budgetShare: 0.30, minBudgetShare: 0.15, maxBudgetShare: 0.45,
        elasticity: 0.4,
        products: [{ productId: 'furniture', baseWeight: 1, utilityPerUnit: 1, minShare: 1 }],
      },
      {
        id: 'wear', name: '穿着', budgetShare: 0.35, minBudgetShare: 0.20, maxBudgetShare: 0.50,
        elasticity: 0.4,
        products: [{ productId: 'clothing', baseWeight: 1, utilityPerUnit: 2, minShare: 1 }],
      },
      {
        id: 'durables', name: '耐用消费', budgetShare: 0.35, minBudgetShare: 0.15, maxBudgetShare: 0.50,
        elasticity: 0.4,
        products: [{ productId: 'electronics', baseWeight: 1, utilityPerUnit: 2, minShare: 1 }],
      },
    ]),
    seedDemandQuantities: Object.freeze({ furniture: 8, clothing: 5, electronics: 4 }),
  }),
]);

export const MARKET_DEMAND_PRODUCT_IDS = Object.freeze([...new Set(
  MARKET_DEMAND_GROUP_CATALOG.flatMap((group) => group.classes.flatMap((demandClass) => (
    demandClass.products.map((option) => option.productId)
  ))),
)]);
