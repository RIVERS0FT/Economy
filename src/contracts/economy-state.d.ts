import type {
  ProductionContract,
  ProductionContractSummary,
} from './types';

declare module '../types' {
  interface EconomyState {
    productionContracts?: ProductionContract[];
    productionContractSummary?: ProductionContractSummary;
  }
}

export {};
