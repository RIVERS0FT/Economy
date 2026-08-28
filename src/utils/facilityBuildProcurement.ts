export interface FacilityBuildMaterialNeed {
  productId: string;
  quantity: number;
}

export interface FacilityBuildProcurementQuote {
  complete: boolean;
  estimatedTotal: number;
  missingQuantity: number;
  materialPriceCaps: Record<string, number>;
  materialOrderPrices: Record<string, number>;
  unavailableProductIds: string[];
  selfCrossingProductIds: string[];
}
