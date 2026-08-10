function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeSupplyContractsFor(world, userId, productId) {
  return (world.productionContracts || []).filter((contract) => (
    contract?.kind === 'supply'
    && contract?.status === 'active'
    && Number(contract?.supplierId) === Number(userId)
    && String(contract?.productId || '') === String(productId || '')
    && (contract?.totalDeliveries === null
      || positiveInteger(contract?.completedDeliveries) < positiveInteger(contract?.totalDeliveries))
  ));
}

export function contractAvailableHoldForOnlineTrade(world, userId, productId) {
  let hold = 0;
  for (const contract of activeSupplyContractsFor(world, userId, productId)) {
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
