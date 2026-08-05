function quantity(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeContracts(world) {
  return (world?.productionContracts || []).filter((contract) => contract?.status === 'active');
}

export function playerLoanCollateralQuantity(world, userId, facilityTypeId) {
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'loan'
    && Number(contract.borrowerId ?? contract.buyerId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
      ? sum + quantity(contract.collateralQuantity)
      : sum
  ), 0);
}

export function leasedOutFacilityQuantity(world, userId, facilityTypeId) {
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'facility_lease'
    && !contract.graceEndsAt
    && Number(contract.lessorId ?? contract.supplierId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
      ? sum + quantity(contract.quantity)
      : sum
  ), 0);
}

export function leasedInFacilityQuantity(world, userId, facilityTypeId) {
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'facility_lease'
    && !contract.graceEndsAt
    && Number(contract.lesseeId ?? contract.buyerId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
      ? sum + quantity(contract.quantity)
      : sum
  ), 0);
}

export function contractLockedFacilityQuantity(world, userId, facilityTypeId) {
  return playerLoanCollateralQuantity(world, userId, facilityTypeId)
    + leasedOutFacilityQuantity(world, userId, facilityTypeId);
}

export function playerLoanFinancialPosition(world, userId) {
  let receivable = 0;
  let liability = 0;
  for (const contract of activeContracts(world)) {
    if (contract.kind !== 'loan') continue;
    const principal = Math.max(0, Number(contract.principalOutstanding || 0));
    if (Number(contract.lenderId ?? contract.supplierId) === Number(userId)) receivable += principal;
    if (Number(contract.borrowerId ?? contract.buyerId) === Number(userId)) liability += principal;
  }
  return { receivable, liability };
}
