const freezeOptions = (options) => Object.freeze(options.map((option) => Object.freeze(option)));
const freezeClasses = (classes) => Object.freeze(classes.map((demandClass) => Object.freeze({
  ...demandClass,
  products: freezeOptions(demandClass.products),
})));

export const MARKET_DEMAND_MODEL_VERSION = 10;
export const PRICE_WINDOW_MS = 30 * 60 * 1000;
export const ACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const ACTIVE_PLAYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const PLAYER_SCALE_MAX = 6;
export const BUDGET_SMOOTHING = 0.35;
export const BUDGET_MAX_RISE = 0.12;
export const BUDGET_MAX_FALL = 0.15;
export const SHARE_SMOOTHING = 0.30;
export const SHARE_MAX_CHANGE = 0.15;
export const DIRECT_BUDGET_SHARE = 0.70;
export const SYSTEM_ORDER_RETENTION_RATE = 0.35;
export const SYSTEM_ORDER_VALUE_CYCLES = 2.5;
export const PRODUCT_ORDER_VALUE_CYCLES = 1.5;
export const SYSTEM_ORDER_MAX_AGE_CYCLES = 2;
export const DEMAND_CURVE = Object.freeze([
  Object.freeze({ weight: 0.50, multiplier: 1.00 }),
  Object.freeze({ weight: 0.30, multiplier: 0.97 }),
  Object.freeze({ weight: 0.20, multiplier: 0.93 }),
]);
export const DEMAND_CURVE_SHORTAGE_MULTIPLIER = 1.03;
export const DIRECT_DEMAND_UNFILLED_PRICE_STEP = 1.03;
export const DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE = 0.25;
export const DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE = 0.10;
export const DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE = 0.10;
export const DIRECT_DEMAND_PRICE_RECOVERY_RATE = 0.30;
export const DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP = 0.98;
export const DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES = 2;
export const DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO = 0.95;
export const DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE = 0.85;
export const DIRECT_DEMAND_MIN_PRICE = 1;
export const PRODUCT_PRESSURE_SMOOTHING = 0.30;
export const PRODUCT_PRESSURE_MIN = 0.75;
export const PRODUCT_PRESSURE_MAX = 1.35;
export const PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT = 0.08;
export const PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT = 0.10;
export const PRODUCT_PRESSURE_EVIDENCE_TARGET = 8;
export const DERIVED_UNMET_WEIGHT = 0.50;
export const DERIVED_BACKLOG_WEIGHT = 0.15;
export const RELATION_LAG_WEIGHTS = Object.freeze([0.60, 0.30, 0.10]);
export const PRICE_MIN_MULTIPLIER = 0.5;
export const PRICE_MAX_MULTIPLIER = 3;
export const PRICE_RISE_RATE = 0.30;
export const PRICE_FALL_RATE = 0.20;
export const PRICE_BASE_REVERSION = 0.02;
export const LIQUIDITY_BASE_SPREAD = 0.08;
export const LIQUIDITY_MIN_SPREAD = 0.04;
export const LIQUIDITY_MAX_SPREAD = 0.24;
export const LIQUIDITY_INVENTORY_SKEW = 0.10;
export const LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25;
export const LIQUIDITY_MIN_QUOTE_BUDGET_SHARE = 0.05;
export const LIQUIDITY_TRADE_SHARE = 0.25;
export const LIQUIDITY_MIN_TARGET = 2;
export const LIQUIDITY_MAX_TARGET = 30;
export const LIQUIDITY_SIGNAL_WEIGHT = 0.50;

export const MARKET_DEMAND_GROUP_CATALOG = Object.freeze([
  Object.freeze({
    id: 'food',
    name: '食品市场',
    ownerName: '食品市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 3_000,
    targetSatisfaction: 0.82,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    quoteUtilityDepth: 12,
    classes: freezeClasses([
      {
        id: 'staples', name: '主食', budgetShare: 0.40, minBudgetShare: 0.30, maxBudgetShare: 0.55,
        elasticity: 1.8,
        products: [
          { productId: 'wheat', baseWeight: 0.25, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'rice', baseWeight: 0.25, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'flour', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.05 },
          { productId: 'food', baseWeight: 0.30, utilityPerUnit: 3, minShare: 0.10 },
        ],
      },
      {
        id: 'protein', name: '蛋白质', budgetShare: 0.30, minBudgetShare: 0.20, maxBudgetShare: 0.45,
        elasticity: 2.3,
        products: [
          { productId: 'meat', baseWeight: 0.32, utilityPerUnit: 2, minShare: 0.08 },
          { productId: 'eggs', baseWeight: 0.23, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'milk', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.08 },
          { productId: 'fish', baseWeight: 0.25, utilityPerUnit: 2, minShare: 0.08 },
        ],
      },
      {
        id: 'fresh-drinks', name: '新鲜与饮品', budgetShare: 0.15, minBudgetShare: 0.08, maxBudgetShare: 0.25,
        elasticity: 1.4,
        products: [
          { productId: 'fruit', baseWeight: 0.45, utilityPerUnit: 1, minShare: 0.20 },
          { productId: 'milk', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.10 },
          { productId: 'beverage', baseWeight: 0.35, utilityPerUnit: 2, minShare: 0.15 },
        ],
      },
      {
        id: 'convenience', name: '便利食品与糖类', budgetShare: 0.15, minBudgetShare: 0.08, maxBudgetShare: 0.30,
        elasticity: 0.8,
        products: [
          { productId: 'food', baseWeight: 0.30, utilityPerUnit: 3, minShare: 0.12 },
          { productId: 'prepared-meal', baseWeight: 0.35, utilityPerUnit: 3, minShare: 0.12 },
          { productId: 'sugarcane', baseWeight: 0.15, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'sugar', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.08 },
        ],
      },
    ]),
    seedDemandQuantities: Object.freeze({
      wheat: 14, rice: 14, food: 10, meat: 4, eggs: 7, milk: 7, flour: 5,
      fruit: 8, fish: 5, beverage: 5, 'prepared-meal': 4, sugarcane: 8, sugar: 3,
    }),
  }),
  Object.freeze({
    id: 'household',
    name: '社会消费市场',
    ownerName: '家庭消费市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 2_700,
    targetSatisfaction: 0.78,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    quoteUtilityDepth: 8,
    classes: freezeClasses([
      {
        id: 'home', name: '木材、纸品与家居', budgetShare: 0.25, minBudgetShare: 0.15, maxBudgetShare: 0.40,
        elasticity: 0.4,
        products: [
          { productId: 'timber', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'lumber', baseWeight: 0.20, utilityPerUnit: 2, minShare: 0.05 },
          { productId: 'pulp', baseWeight: 0.15, utilityPerUnit: 2, minShare: 0.04 },
          { productId: 'furniture', baseWeight: 0.45, utilityPerUnit: 3, minShare: 0.12 },
        ],
      },
      {
        id: 'wear', name: '穿着与纺织', budgetShare: 0.25, minBudgetShare: 0.15, maxBudgetShare: 0.40,
        elasticity: 0.4,
        products: [
          { productId: 'cotton', baseWeight: 0.15, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'wool', baseWeight: 0.15, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'textile', baseWeight: 0.25, utilityPerUnit: 2, minShare: 0.08 },
          { productId: 'clothing', baseWeight: 0.45, utilityPerUnit: 3, minShare: 0.12 },
        ],
      },
      {
        id: 'daily', name: '能源、包装与日用消耗', budgetShare: 0.20, minBudgetShare: 0.10, maxBudgetShare: 0.35,
        elasticity: 0.9,
        products: [
          { productId: 'paper', baseWeight: 0.45, utilityPerUnit: 2, minShare: 0.15 },
          { productId: 'crude-oil', baseWeight: 0.20, utilityPerUnit: 1, minShare: 0.05 },
          { productId: 'plastic', baseWeight: 0.35, utilityPerUnit: 2, minShare: 0.10 },
        ],
      },
      {
        id: 'durables', name: '金属建设与耐用品', budgetShare: 0.30, minBudgetShare: 0.15, maxBudgetShare: 0.50,
        elasticity: 0.6,
        products: [
          { productId: 'ore', baseWeight: 0.08, utilityPerUnit: 1, minShare: 0.03 },
          { productId: 'copper-ore', baseWeight: 0.08, utilityPerUnit: 1, minShare: 0.03 },
          { productId: 'steel', baseWeight: 0.12, utilityPerUnit: 2, minShare: 0.04 },
          { productId: 'copper', baseWeight: 0.12, utilityPerUnit: 2, minShare: 0.04 },
          { productId: 'machinery', baseWeight: 0.18, utilityPerUnit: 3, minShare: 0.06 },
          { productId: 'electronics', baseWeight: 0.18, utilityPerUnit: 3, minShare: 0.06 },
          { productId: 'appliance', baseWeight: 0.24, utilityPerUnit: 4, minShare: 0.08 },
        ],
      },
    ]),
    seedDemandQuantities: Object.freeze({
      timber: 6, lumber: 3, pulp: 3, furniture: 7,
      cotton: 8, wool: 4, textile: 3, clothing: 5,
      paper: 7, 'crude-oil': 4, plastic: 3,
      ore: 5, 'copper-ore': 5, steel: 2, copper: 2, machinery: 1, electronics: 4, appliance: 3,
    }),
  }),
]);

export const MARKET_DEMAND_PRODUCT_IDS = Object.freeze([...new Set(
  MARKET_DEMAND_GROUP_CATALOG.flatMap((group) => group.classes.flatMap((demandClass) => (
    demandClass.products.map((option) => option.productId)
  ))),
)]);
