import type { AutoSellPolicyMap } from './autoSellStorage';
import type { AutoBuyPolicyMap } from '../auto-trade/types';

declare module '../types' {
  interface EconomyState {
    onlineAutoBuyPolicies?: AutoBuyPolicyMap;
    onlineAutoBuyManagedOrderIds?: Record<string, string>;
    onlineAutoSellPolicies?: AutoSellPolicyMap;
    onlineAutoSellManagedOrderIds?: Record<string, string>;
  }
}

export {};
