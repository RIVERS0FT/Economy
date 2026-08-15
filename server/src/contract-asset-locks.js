import { DEFAULT_PROVINCE_ID, normalizeProvinceId } from './provinces.js';

function quantity(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeContracts(world) {
  return (world?.productionContracts || []).filter((contract) => contract?.status === 'active');
}

function confirmedDefault(contract) {
  return Number(contract?.breachedAt || 0) > 0 && String(contract?.terminationReason || '').endsWith('_default');
}

export function playerLoanCollateralQuantity(world, userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'loan'
    && Number(contract.borrowerId ?? contract.buyerId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
    && normalizeProvinceId(contract.provinceId) === selectedProvinceId
      ? sum + quantity(contract.collateralQuantity)
      : sum
  ), 0);
}

export function leasedOutFacilityQuantity(world, userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'facility_lease'
    && !contract.graceEndsAt
    && !confirmedDefault(contract)
    && Number(contract.lessorId ?? contract.supplierId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
    && normalizeProvinceId(contract.provinceId) === selectedProvinceId
      ? sum + quantity(contract.quantity)
      : sum
  ), 0);
}

export function leasedOutLockedFacilityQuantity(world, userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'facility_lease'
    && !confirmedDefault(contract)
    && Number(contract.lessorId ?? contract.supplierId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
    && normalizeProvinceId(contract.provinceId) === selectedProvinceId
      ? sum + quantity(contract.quantity)
      : sum
  ), 0);
}

export function leasedInFacilityQuantity(world, userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  return activeContracts(world).reduce((sum, contract) => (
    contract.kind === 'facility_lease'
    && !contract.graceEndsAt
    && !confirmedDefault(contract)
    && Number(contract.lesseeId ?? contract.buyerId) === Number(userId)
    && String(contract.facilityTypeId) === String(facilityTypeId)
    && normalizeProvinceId(contract.provinceId) === selectedProvinceId
      ? sum + quantity(contract.quantity)
      : sum
  ), 0);
}

export function contractLockedFacilityQuantity(world, userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  return playerLoanCollateralQuantity(world, userId, facilityTypeId, provinceId)
    + leasedOutLockedFacilityQuantity(world, userId, facilityTypeId, provinceId);
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
