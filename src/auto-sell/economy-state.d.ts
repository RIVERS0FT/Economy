import type { AutoSellPolicyMap } from './autoSellStorage';

declare module '../types' {
  interface EconomyState {
    onlineAutoSellPolicies?: AutoSellPolicyMap;
    onlineAutoSellManagedOrderIds?: Record<string, string>;
  }
}

export {};
