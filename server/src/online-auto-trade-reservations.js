import { dailySupplyContractAvailableHold, isDailySupplyContract } from './daily-supply-contracts.js';
import { DEFAULT_PROVINCE_ID, normalizeProvinceId } from './provinces.js';

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeLegacySupplyContractsFor(world, userId, productId) {
  return (world.productionContracts || []).filter((contract) => (
    contract?.kind === 'supply'
    && !isDailySupplyContract(contract)
    && contract?.status === 'active'
    && Number(contract?.supplierId) === Number(userId)
    && String(contract?.productId || '') === String(productId || '')
    && (contract?.totalDeliveries === null
      || positiveInteger(contract?.completedDeliveries) < positiveInteger(contract?.totalDeliveries))
  ));
}

export function contractAvailableHoldForOnlineTrade(world, userId, productId, provinceId = DEFAULT_PROVINCE_ID) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  let hold = dailySupplyContractAvailableHold(world, userId, productId, selectedProvinceId);
  if (selectedProvinceId !== DEFAULT_PROVINCE_ID) return hold;

  for (const contract of activeLegacySupplyContractsFor(world, userId, productId)) {
    if (contract.supplierAutoReserve !== false) {
      const required = positiveInteger(contract.quantityPerDelivery);
      const frozen = Math.min(required, positiveInteger(contract.supplierReservedQuantity));
      hold += Math.max(0, required - frozen);
    }
    const proposal = contract.renewalProposal;
    if (proposal?.status === 'accepted' && contract.supplierAutoReserve !== false) {
      const required = positiveInteger(proposal.terms?.quantityPerDelivery);
      const frozen = Math.min(required, positiveInteger(proposal.supplierReservedQuantity));
      hold += Math.max(0, required - frozen);
    }
  }
  return hold;
}
