import type { LedgerCategory } from '../types';

export const ledgerCategoryNames: Record<LedgerCategory, string> = {
  work_income: '工作收入',
  population_income: '人口交易收入',
  market_trade: '商品交易',
  facility_trade: '设施交易',
  facility_construction: '设施建造',
  facility_operation: '设施运营',
  facility_sale: '设施出售',
  inventory: '库存变化',
  system: '系统调整',
};
