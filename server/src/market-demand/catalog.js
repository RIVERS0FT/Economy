export const DIRECT_BUDGET_SHARE = 0.85;
export const DERIVED_BUDGET_SHARE = 0.15;
export const EMPLOYMENT_DIRECT_BUDGET_SHARE = 0.70;
export const EMPLOYMENT_DERIVED_BUDGET_SHARE = 0.30;
export const BASE_PRICE_WEIGHT = 0.35;
export const MARKET_PRICE_WEIGHT = 0.65;
export const DEMAND_PRICE_ELASTICITY = 0.70;
export const MINIMUM_PRICE_MULTIPLIER = 0.35;
export const MAXIMUM_PRICE_MULTIPLIER = 4;
export const DIRECT_ORDER_LEVELS = Object.freeze([0.97, 1.00, 1.03]);
export const DERIVED_ORDER_LEVELS = Object.freeze([0.96, 0.99, 1.02]);
export const DIRECT_ORDER_LEVEL_WEIGHTS = Object.freeze([0.25, 0.50, 0.25]);
export const DERIVED_ORDER_LEVEL_WEIGHTS = Object.freeze([0.30, 0.50, 0.20]);
export const DIRECT_MINIMUM_BUDGET_SHARE = 0.40;
export const DIRECT_MAXIMUM_BUDGET_SHARE = 0.95;
export const DERIVED_MINIMUM_BUDGET_SHARE = 0.05;
export const DERIVED_MAXIMUM_BUDGET_SHARE = 0.60;
export const DEMAND_MIN_BUDGET_SHARE = 0.20;
export const DEMAND_MAX_BUDGET_SHARE = 1.80;
export const DEMAND_MIN_PRICE_MULTIPLIER = 0.30;
export const DEMAND_MAX_PRICE_MULTIPLIER = 4;
export const DEMAND_MIN_ORDER_QUANTITY = 1;
export const DEMAND_MAX_ORDER_QUANTITY = Number.MAX_SAFE_INTEGER;
export const DEMAND_MAX_OPEN_ORDERS_PER_PRODUCT = 6;
export const DEMAND_MAX_OPEN_ORDERS_PER_GROUP = 64;
export const DEMAND_ORDER_TTL_MS = 30 * 60 * 1000;
export const DEMAND_PRICE_LOOKBACK_MS = 24 * 60 * 60 * 1000;
export const DEMAND_PRICE_MIN_SAMPLE_COUNT = 3;
export const DEMAND_PRICE_CONFIDENCE_SAMPLE_COUNT = 24;
export const DEMAND_PRICE_CONFIDENCE_VOLUME = 100;
export const DEMAND_PRICE_CONFIDENCE_MAX = 1;
export const DEMAND_PRICE_CONFIDENCE_MIN = 0;
export const DEMAND_SATISFACTION_MIN = 0;
export const DEMAND_SATISFACTION_MAX = 1;
export const DEMAND_TARGET_SATISFACTION = 0.82;
export const DEMAND_SATISFACTION_WEIGHT = 0.50;
export const DEMAND_BACKLOG_WEIGHT = 0.30;
export const DEMAND_TREND_WEIGHT = 0.20;
export const DEMAND_MAX_INCREASE_RATE = 0.15;
export const DEMAND_MAX_DECREASE_RATE = 0.12;
export const DEMAND_RECENT_PEAK_DECAY = 0.92;
export const DEMAND_INCOME_EMA_PREVIOUS_WEIGHT = 0.85;
export const DEMAND_INCOME_EMA_CURRENT_WEIGHT = 0.15;
export const DEMAND_STABILIZATION_TARGET_CYCLES = 3;
export const DEMAND_STABILIZATION_MAX_CYCLES_PER_CYCLE = 1;
export const DEMAND_STABILIZATION_BASE_SHARE = 0.12;
export const DEMAND_STABILIZATION_BASIC_SHARE = 0.60;
export const DEMAND_STABILIZATION_SKILLED_SHARE = 0.30;
export const DEMAND_STABILIZATION_PROFESSIONAL_SHARE = 0.10;
export const DEMAND_STABILIZATION_DIRECT_SHARE = 0.85;
export const DEMAND_STABILIZATION_DERIVED_SHARE = 0.15;
export const DEMAND_NORMAL_DIRECT_SHARE = 0.70;
export const DEMAND_NORMAL_DERIVED_SHARE = 0.30;
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
export const LIQUIDITY_TARGET_MAX_RISE = 0.50;
export const LIQUIDITY_TARGET_MAX_FALL = 0.25;
export const LIQUIDITY_MIN_TARGET = 2;
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
    derivedBudgetShare: DERIVED_BUDGET_SHARE,
  }),
  Object.freeze({
    id: 'household',
    name: '社会消费市场',
    ownerName: '家庭消费市场需求',
    cycleMs: 5 * 60 * 1000,
    baseBudget: 2_700,
    targetSatisfaction: 0.82,
    directBudgetShare: DIRECT_BUDGET_SHARE,
    derivedBudgetShare: DERIVED_BUDGET_SHARE,
  }),
]);
