from pathlib import Path


def replace(path, old, new, count=-1):
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'missing anchor in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, count), encoding='utf-8', newline='\n')

replace(
    'server/src/commercial-contracts.js',
    "    contract.lastCompensation = contract.lesseeBondCredits;\n    contract.lesseeEscrowCredits = 0;",
    "    contract.lastCompensation = contract.lesseeBondCredits;\n"
    "    contract.lastCompensationFromId = Number(lessee.userId);\n"
    "    contract.lastCompensationToId = Number(lessor.userId);\n"
    "    contract.lesseeEscrowCredits = 0;",
    1,
)
replace(
    'server/src/commercial-contracts.js',
    "        contract.lastCompensation = contract.lesseeBondCredits;\n      } else {",
    "        contract.lastCompensation = contract.lesseeBondCredits;\n"
    "        contract.lastCompensationFromId = Number(lessee.userId);\n"
    "        contract.lastCompensationToId = Number(lessor.userId);\n"
    "      } else {",
    1,
)
replace(
    'server/src/commercial-contracts.js',
    "        contract.lastCompensation = contract.lessorBondCredits;\n      }\n      contract.lesseeEscrowCredits",
    "        contract.lastCompensation = contract.lessorBondCredits;\n"
    "        contract.lastCompensationFromId = Number(lessor.userId);\n"
    "        contract.lastCompensationToId = Number(lessee.userId);\n"
    "      }\n      contract.lesseeEscrowCredits",
    1,
)

replace(
    'server/src/contract-audit-store.js',
    "      transfer({ assetType: 'credits', quantity: after.lastPaymentFee, fromType: 'player', fromId: after.lenderId, fromAccount: 'loan_interest', toType: 'system', toAccount: 'bank_service_employment', purpose: 'market_service_fee' }),\n    ]);",
    "      transfer({ assetType: 'credits', quantity: after.lastPaymentFee, fromType: 'player', fromId: after.lenderId, fromAccount: 'loan_interest', toType: 'system', toAccount: 'bank_service_employment', purpose: 'market_service_fee' }),\n"
    "      transfer({ assetType: 'commodity', productId: `facility:${after.facilityTypeId}`, quantity: after.collateralQuantity, fromType: 'player', fromId: after.borrowerId, fromAccount: 'contract_collateral', toType: 'player', toId: after.borrowerId, toAccount: 'facility_owned', purpose: 'player_loan_collateral_release' }),\n"
    "    ]);",
    1,
)
old = """    if (eventType === 'lease_terminated' && after.lastCompensation > 0) return compactTransfers([
      transfer({ assetType: 'credits', quantity: after.lastCompensation, fromType: 'player', fromId: before?.terminationReason === 'lessee_default' ? after.lesseeId : null, fromAccount: 'contract_bond', toType: 'player', toId: after.terminationReason === 'lessee_default' ? after.lessorId : null, toAccount: 'available', purpose: 'bond_compensation' }),
    ]);
"""
new = """    if (eventType === 'contract_completed') return compactTransfers([
      transfer({ assetType: 'credits', quantity: before?.lesseeBondCredits, fromType: 'player', fromId: after.lesseeId, fromAccount: 'contract_bond', toType: 'player', toId: after.lesseeId, toAccount: 'available', purpose: 'lease_lessee_bond_release' }),
      transfer({ assetType: 'credits', quantity: before?.lessorBondCredits, fromType: 'player', fromId: after.lessorId, fromAccount: 'contract_bond', toType: 'player', toId: after.lessorId, toAccount: 'available', purpose: 'lease_lessor_bond_release' }),
      transfer({ assetType: 'commodity', productId: `facility-usage:${after.facilityTypeId}`, quantity: after.quantity, fromType: 'player', fromId: after.lesseeId, fromAccount: 'facility_usage', toType: 'player', toId: after.lessorId, toAccount: 'facility_usage', purpose: 'lease_usage_right_return' }),
    ]);
    if (eventType === 'lease_terminated') {
      const compensationFromId = Number.isFinite(Number(after.lastCompensationFromId)) ? Number(after.lastCompensationFromId) : null;
      const compensationToId = Number.isFinite(Number(after.lastCompensationToId)) ? Number(after.lastCompensationToId) : null;
      return compactTransfers([
        transfer({ assetType: 'credits', quantity: before?.lesseeEscrowCredits, fromType: 'player', fromId: after.lesseeId, fromAccount: 'contract_escrow', toType: 'player', toId: after.lesseeId, toAccount: 'available', purpose: 'lease_unused_rent_release' }),
        transfer({ assetType: 'credits', quantity: after.lastCompensation, fromType: 'player', fromId: compensationFromId, fromAccount: 'contract_bond', toType: 'player', toId: compensationToId, toAccount: 'available', purpose: 'bond_compensation' }),
        transfer({ assetType: 'credits', quantity: compensationFromId === Number(after.lesseeId) ? 0 : before?.lesseeBondCredits, fromType: 'player', fromId: after.lesseeId, fromAccount: 'contract_bond', toType: 'player', toId: after.lesseeId, toAccount: 'available', purpose: 'lease_lessee_bond_release' }),
        transfer({ assetType: 'credits', quantity: compensationFromId === Number(after.lessorId) ? 0 : before?.lessorBondCredits, fromType: 'player', fromId: after.lessorId, fromAccount: 'contract_bond', toType: 'player', toId: after.lessorId, toAccount: 'available', purpose: 'lease_lessor_bond_release' }),
        transfer({ assetType: 'commodity', productId: `facility-usage:${after.facilityTypeId}`, quantity: after.quantity, fromType: 'player', fromId: after.lesseeId, fromAccount: 'facility_usage', toType: 'player', toId: after.lessorId, toAccount: 'facility_usage', purpose: 'lease_usage_right_return' }),
      ]);
    }
"""
replace('server/src/contract-audit-store.js', old, new, 1)

replace(
    'server/test/commercial-contracts.test.js',
    "  assert.equal(contractLockedFacilityQuantity(state, 1, facility.id), 2);\n});",
    "  assert.equal(contractLockedFacilityQuantity(state, 1, facility.id), 2);\n"
    "  processProductionContracts(state, contract.graceEndsAt + 1);\n"
    "  const terminated = state.productionContracts[0];\n"
    "  assert.equal(terminated.lastCompensationFromId, 2);\n"
    "  assert.equal(terminated.lastCompensationToId, 1);\n"
    "});",
    1,
)
replace(
    'scripts/verify-contract-types.mjs',
    "'transferableFacilityQuantity']);",
    "'transferableFacilityQuantity', 'lastCompensationFromId']);",
    1,
)
replace(
    'scripts/verify-contract-types.mjs',
    "requireText('server/src/contracts.js'",
    "requireText('server/src/contract-audit-store.js', ['player_loan_collateral_release', 'lease_usage_right_return', 'lastCompensationFromId']);\nrequireText('server/src/contracts.js'",
    1,
)
