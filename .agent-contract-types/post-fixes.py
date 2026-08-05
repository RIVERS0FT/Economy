from pathlib import Path
import runpy

source = Path('server/src/commercial-contracts.js')
source.write_text(
    source.read_text(encoding='utf-8').replace(
        "creditPopulationEmployment(world, fee, 'bankService')",
        "creditPopulationEmployment(world, fee, 'banking')",
    ),
    encoding='utf-8',
    newline='\n',
)

page = Path('src/pages/ContractPage.tsx')
page_text = page.read_text(encoding='utf-8')
page_text = page_text.replace(
    "Pick<ProductionContract, 'kind' | 'publisherSide'>",
    "Pick<ProductionContract, 'kind' | 'publisherSide' | 'publisherRole'>",
    1,
)
page_text = page_text.replace(
    "principal, interestRateBps: Math.round(interestPercent * 100), loanTerm,",
    "principal, interestRateBps: Math.round(interestPercent * 100), termMs: loanTerm,",
    1,
)
page_text = page_text.replace(
    'Number(event.target.value)',
    'Number.parseInt(event.target.value, 10)',
)
page.write_text(page_text, encoding='utf-8', newline='\n')

types = Path('src/contracts/types.ts')
types.write_text(
    types.read_text(encoding='utf-8').replace(
        '  issue?: string | null;\n  auditCompleteness:',
        '  issue: string | null;\n  auditCompleteness:',
        1,
    ),
    encoding='utf-8',
    newline='\n',
)

test_path = Path('server/test/commercial-contracts.test.js')
text = test_path.read_text(encoding='utf-8')
text = text.replace('principal: 100,', 'principal: 10,')
text = text.replace(
    '  const contract = state.productionContracts[0];\n  const totalBefore',
    '  let contract = state.productionContracts[0];\n  const totalBefore',
    1,
)
text = text.replace(
    "  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);\n  assert.equal(playerLoanCollateralQuantity",
    "  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);\n  contract = state.productionContracts[0];\n  assert.equal(playerLoanCollateralQuantity",
    1,
)
text = text.replace(
    "  assert.equal(applyProductionContractAction(state, { id: 1 }, 'repayPlayerLoan', { contractId: contract.id }, now + 1).ok, true);\n  assert.equal(contract.status",
    "  assert.equal(applyProductionContractAction(state, { id: 1 }, 'repayPlayerLoan', { contractId: contract.id }, now + 1).ok, true);\n  contract = state.productionContracts[0];\n  assert.equal(contract.status",
    1,
)
text = text.replace(
    "  const contract = state.productionContracts[0];\n  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract'",
    "  let contract = state.productionContracts[0];\n  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract'",
    1,
)
text = text.replace(
    "  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);\n  assert.equal(leasedOutFacilityQuantity",
    "  assert.equal(applyProductionContractAction(state, { id: 2 }, 'acceptProductionContract', { contractId: contract.id }, now).ok, true);\n  contract = state.productionContracts[0];\n  assert.equal(leasedOutFacilityQuantity",
    1,
)
text = text.replace(
    '  processProductionContracts(state, now + 1);\n  assert.equal(contract.completedPeriods',
    '  processProductionContracts(state, now + 1);\n  contract = state.productionContracts[0];\n  assert.equal(contract.completedPeriods',
    1,
)
text = text.replace(
    '  processProductionContracts(state, now + 60 * 60 * 1000 + 2);\n  assert.equal(contract.status',
    '  processProductionContracts(state, now + 60 * 60 * 1000 + 2);\n  contract = state.productionContracts[0];\n  assert.equal(contract.status',
    1,
)
test_path.write_text(text, encoding='utf-8', newline='\n')

runpy.run_path('.agent-contract-types/fix-current-versions.py', run_name='__main__')
