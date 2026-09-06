const COMMERCIAL_CYCLE_MS = 5 * 60 * 1000;

const rawCommercialTypes = [
  {
    id: 'convenience-store',
    name: '便利店',
    description: '消耗食品和饮料，提供基础社区零售服务。',
    buildCost: 120,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 1.5,
    profitPerCycle: 4,
    consumptionInputs: [
      { productId: 'food', quantity: 1 },
      { productId: 'beverage', quantity: 1 },
    ],
    systemValue: 120,
  },
  {
    id: 'fresh-market',
    name: '生鲜超市',
    description: '持续消耗水果、肉类和奶，形成农业与养殖业终端需求。',
    buildCost: 180,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 2,
    profitPerCycle: 4.2,
    consumptionInputs: [
      { productId: 'fruit', quantity: 2 },
      { productId: 'meat', quantity: 1 },
      { productId: 'milk', quantity: 1 },
    ],
    systemValue: 180,
  },
  {
    id: 'restaurant',
    name: '餐厅',
    description: '消耗预制餐和饮料，提供稳定餐饮服务利润。',
    buildCost: 250,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 3,
    profitPerCycle: 7.5,
    consumptionInputs: [
      { productId: 'prepared-meal', quantity: 2 },
      { productId: 'beverage', quantity: 1 },
    ],
    systemValue: 250,
  },
  {
    id: 'clothing-store',
    name: '服装店',
    description: '消费服装商品，将纺织产业的终端商品转化为稳定商业利润。',
    buildCost: 320,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 3.5,
    profitPerCycle: 9,
    consumptionInputs: [{ productId: 'clothing', quantity: 1 }],
    systemValue: 320,
  },
  {
    id: 'furniture-showroom',
    name: '家具商场',
    description: '消费家具商品，为木材加工产业提供稳定终端需求。',
    buildCost: 420,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 4,
    profitPerCycle: 10,
    consumptionInputs: [{ productId: 'furniture', quantity: 1 }],
    systemValue: 420,
  },
  {
    id: 'appliance-store',
    name: '家电卖场',
    description: '消费家电和电子产品，作为高级制造业的商业终端。',
    buildCost: 560,
    cycleMs: COMMERCIAL_CYCLE_MS,
    operatingCost: 5,
    profitPerCycle: 19.2,
    consumptionInputs: [
      { productId: 'appliance', quantity: 1 },
      { productId: 'electronics', quantity: 1 },
    ],
    systemValue: 560,
  },
];

export const COMMERCIAL_BUILDING_TYPE_CATALOG = Object.freeze(rawCommercialTypes.map((type) => Object.freeze({
  ...type,
  consumptionInputs: Object.freeze(type.consumptionInputs.map((item) => Object.freeze({ ...item }))),
})));
