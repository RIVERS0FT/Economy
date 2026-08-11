import type { AutoSellPolicy } from '../auto-sell/autoSellStorage';

export interface AutoBuyPolicy {
  enabled: boolean;
  maxPrice: number;
  targetFreeInventory: number;
}

export type AutoBuyPolicyMap = Record<string, AutoBuyPolicy>;

export interface AutoTradePolicyInput {
  buy: AutoBuyPolicy;
  sell: AutoSellPolicy;
}
