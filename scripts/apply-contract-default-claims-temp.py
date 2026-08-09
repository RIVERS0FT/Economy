from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def replace_all_checked(text, old, new, minimum, label):
    count = text.count(old)
    if count < minimum:
        raise SystemExit(f'{label}: expected at least {minimum} matches, found {count}')
    return text.replace(old, new)


# server/src/contracts.js
path = 'server/src/contracts.js'
text = read(path)
text = replace_once(text, 'export const PRODUCTION_CONTRACT_SCHEMA_VERSION = 6;', 'export const PRODUCTION_CONTRACT_SCHEMA_VERSION = 7;', 'contract schema version')
text = replace_once(
    text,
    "    graceEndsAt: contract?.graceEndsAt === undefined ? undefined : Math.max(0, Number(contract.graceEndsAt)),\n",
    "    graceEndsAt: contract?.graceEndsAt === undefined ? undefined : Math.max(0, Number(contract.graceEndsAt)),\n    breachedAt: contract?.breachedAt === undefined ? undefined : Math.max(0, Number(contract.breachedAt)),\n",
    'normalize supply breachedAt',
)
old = """function terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  runtimeIndex.transition(contract, () => {
    if (defaultParty === 'buyer') {
      releaseMarketReserveCredits(group, contract.buyerEscrowCredits);
      transferMarketReserveBondToPlayer(group, supplier, contract.buyerBondCredits);
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
    } else if (defaultParty === 'supplier') {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      transferPlayerBondToMarketReserve(supplier, group, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    } else {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    }
    contract.buyerEscrowCredits = 0;
    contract.buyerBondCredits = 0;
    contract.supplierBondCredits = 0;
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = `${defaultParty}_default`;
    contract.roundStatus = 'preparing';
    delete contract.graceEndsAt;
  });
}

function processMarketReserveContract(world, contract, now, runtimeIndex) {
"""
new = """function terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  runtimeIndex.transition(contract, () => {
    if (defaultParty === 'buyer') {
      releaseMarketReserveCredits(group, contract.buyerEscrowCredits);
      transferMarketReserveBondToPlayer(group, supplier, contract.buyerBondCredits);
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
    } else if (defaultParty === 'supplier') {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      transferPlayerBondToMarketReserve(supplier, group, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    } else {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    }
    contract.buyerEscrowCredits = 0;
    contract.buyerBondCredits = 0;
    contract.supplierBondCredits = 0;
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = `${defaultParty}_default`;
    contract.roundStatus = 'preparing';
    delete contract.graceEndsAt;
  });
}

function confirmMarketReserveBuyerDefault(world, contract, supplier, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  runtimeIndex.transition(contract, () => {
    releaseMarketReserveCredits(group, contract.buyerEscrowCredits);
    releaseFrozenCredits(supplier, contract.supplierBondCredits);
    releaseSupplierGoods(contract, supplier);
    contract.buyerEscrowCredits = 0;
    contract.supplierBondCredits = 0;
    contract.breachedAt = now;
    contract.terminationReason = 'buyer_default';
    contract.nextDueAt = null;
    contract.roundStatus = 'grace';
    delete contract.graceEndsAt;
  });
}

function isConfirmedDefault(contract) {
  return contract?.status === 'active'
    && Number(contract?.breachedAt || 0) > 0
    && String(contract?.terminationReason || '').endsWith('_default');
}

function processMarketReserveContract(world, contract, now, runtimeIndex) {
  if (isConfirmedDefault(contract)) return;
"""
text = replace_once(text, old, new, 'market reserve default functions')
text = replace_once(
    text,
    """  const defaultParty = goodsReady && !fundsReady
    ? 'buyer'
    : !goodsReady && fundsReady
      ? 'supplier'
      : 'both';
  terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex);
}
""",
    """  const defaultParty = goodsReady && !fundsReady
    ? 'buyer'
    : !goodsReady && fundsReady
      ? 'supplier'
      : 'both';
  if (defaultParty === 'buyer') {
    confirmMarketReserveBuyerDefault(world, contract, supplier, now, runtimeIndex);
    return;
  }
  terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex);
}
""",
    'market reserve default decision',
)
old = """function terminateForDefault(world, contract, defaultParty, now) {
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  releaseRenewalEscrow(contract, buyer, supplier, `${defaultParty}_default`);
  if (!buyer || !supplier) {
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = 'participant_missing';
    return;
  }

  if (defaultParty === 'buyer') {
    releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
    transferFrozenCredits(buyer, supplier, contract.buyerBondCredits);
    releaseFrozenCredits(supplier, contract.supplierBondCredits);
    releaseSupplierGoods(contract, supplier);
    normalizeStats(buyer).contractDefaults += 1;
  } else if (defaultParty === 'supplier') {
    releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
    releaseFrozenCredits(buyer, contract.buyerBondCredits);
    transferFrozenCredits(supplier, buyer, contract.supplierBondCredits);
    releaseSupplierGoods(contract, supplier);
    normalizeStats(supplier).contractDefaults += 1;
  } else {
    releaseAllEscrow(contract, buyer, supplier);
    normalizeStats(buyer).contractDefaults += 1;
    normalizeStats(supplier).contractDefaults += 1;
  }

  contract.buyerEscrowCredits = 0;
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
  contract.status = 'terminated';
  contract.endedAt = now;
  contract.terminationReason = `${defaultParty}_default`;
  contract.roundStatus = 'preparing';
  delete contract.graceEndsAt;
}
"""
new = """function confirmDefault(world, contract, defaultParty, now, runtimeIndex) {
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  runtimeIndex.transition(contract, () => {
    releaseRenewalEscrow(contract, buyer, supplier, `${defaultParty}_default`);
    if (!buyer || !supplier) {
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'participant_missing';
      return;
    }

    if (defaultParty === 'buyer') {
      releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
      contract.buyerEscrowCredits = 0;
      releaseFrozenCredits(supplier, contract.supplierBondCredits);
      contract.supplierBondCredits = 0;
      releaseSupplierGoods(contract, supplier);
      normalizeStats(buyer).contractDefaults += 1;
    } else if (defaultParty === 'supplier') {
      releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
      releaseFrozenCredits(buyer, contract.buyerBondCredits);
      contract.buyerEscrowCredits = 0;
      contract.buyerBondCredits = 0;
      releaseSupplierGoods(contract, supplier);
      normalizeStats(supplier).contractDefaults += 1;
    } else {
      releaseAllEscrow(contract, buyer, supplier);
      normalizeStats(buyer).contractDefaults += 1;
      normalizeStats(supplier).contractDefaults += 1;
    }

    contract.breachedAt = now;
    contract.terminationReason = `${defaultParty}_default`;
    contract.nextDueAt = null;
    contract.roundStatus = 'grace';
    delete contract.graceEndsAt;
  });
}
"""
text = replace_once(text, old, new, 'player supply default confirmation')
text = replace_once(
    text,
    'function processActiveContract(world, contract, now, runtimeIndex) {\n  const buyer = playerFor(world, contract.buyerId);',
    'function processActiveContract(world, contract, now, runtimeIndex) {\n  if (isConfirmedDefault(contract)) return;\n  const buyer = playerFor(world, contract.buyerId);',
    'skip confirmed supply defaults',
)
text = replace_once(
    text,
    '  runtimeIndex.transition(contract, () => terminateForDefault(world, contract, defaultParty, now));',
    '  confirmDefault(world, contract, defaultParty, now, runtimeIndex);',
    'confirm supply default call',
)
# Add pending-default claim function before immediate termination.
marker = 'function terminateNow(world, user, payload, now, runtimeIndex) {'
claim_fn = """function claimConfirmedDefault(world, user, contract, now, runtimeIndex) {
  const reason = String(contract.terminationReason || '');
  const userId = Number(user.id);
  if (!isConfirmedDefault(contract)) return result(false, '合同尚未确认违约');

  if (contract.publisherType === 'market_reserve') {
    const supplier = playerFor(world, contract.supplierId);
    const group = marketReserveGroupFor(world, contract);
    if (reason !== 'buyer_default' || !supplier || !group || Number(contract.supplierId) !== userId) {
      return result(false, '只有受偿供应方可以解除该违约合同');
    }
    const compensation = Math.max(0, Number(contract.buyerBondCredits || 0));
    runtimeIndex.transition(contract, () => {
      transferMarketReserveBondToPlayer(group, supplier, compensation);
      contract.lastCompensation = compensation;
      contract.lastCompensationFromId = null;
      contract.lastCompensationToId = userId;
      contract.buyerBondCredits = 0;
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.roundStatus = 'preparing';
    });
    return result(true, '合同已解除，市场储备违约保证金已领取');
  }

  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) return result(false, '合同参与者不存在');
  if (reason === 'buyer_default' && Number(contract.supplierId) !== userId) return result(false, '只有受偿供应方可以解除合同并领取违约金');
  if (reason === 'supplier_default' && Number(contract.buyerId) !== userId) return result(false, '只有受偿采购方可以解除合同并领取违约金');
  if (reason === 'both_default' && ![contract.buyerId, contract.supplierId].some((id) => Number(id) === userId)) return result(false, '无权解除该合同');
  if (!['buyer_default', 'supplier_default', 'both_default'].includes(reason)) return result(false, '当前违约状态不支持领取');

  runtimeIndex.transition(contract, () => {
    if (reason === 'buyer_default') {
      const compensation = Math.max(0, Number(contract.buyerBondCredits || 0));
      transferFrozenCredits(buyer, supplier, compensation);
      contract.lastCompensation = compensation;
      contract.lastCompensationFromId = Number(contract.buyerId);
      contract.lastCompensationToId = Number(contract.supplierId);
      contract.buyerBondCredits = 0;
    } else if (reason === 'supplier_default') {
      const compensation = Math.max(0, Number(contract.supplierBondCredits || 0));
      transferFrozenCredits(supplier, buyer, compensation);
      contract.lastCompensation = compensation;
      contract.lastCompensationFromId = Number(contract.supplierId);
      contract.lastCompensationToId = Number(contract.buyerId);
      contract.supplierBondCredits = 0;
    }
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.roundStatus = 'preparing';
  });
  return result(true, reason === 'both_default' ? '双方违约合同已解除' : '合同已解除，违约金已领取');
}

"""
text = replace_once(text, marker, claim_fn + marker, 'insert confirmed default claim function')
text = replace_once(
    text,
    """export function applyProductionContractAction(world, user, action, payload = {}, now = Date.now()) {
  const runtimeIndex = processProductionContractsWithIndex(world, now);
  const commercialResult = applyCommercialContractAction(world, user, action, payload, now, runtimeIndex);
""",
    """export function applyProductionContractAction(world, user, action, payload = {}, now = Date.now()) {
  const runtimeIndex = processProductionContractsWithIndex(world, now);
  const pendingSupply = runtimeIndex.contractById(payload.contractId);
  if (pendingSupply?.kind === 'supply' && isConfirmedDefault(pendingSupply)) {
    const participant = [pendingSupply.buyerId, pendingSupply.supplierId].some((id) => Number(id) === Number(user.id));
    if (!participant) return result(false, '无权处理该违约合同');
    if (action === 'terminateProductionContractNow') return claimConfirmedDefault(world, user, pendingSupply, now, runtimeIndex);
    return result(false, '合同已确认违约，不能继续补货、补款、续签或修改自动履约设置');
  }
  const commercialResult = applyCommercialContractAction(world, user, action, payload, now, runtimeIndex);
""",
    'supply pending action gate',
)
text = replace_once(
    text,
    """function issueForContract(world, contract, runtimeIndex, userId = null) {
  if (contract.kind !== 'supply') return commercialIssue(contract);
  if (contract.status !== 'active') return null;
""",
    """function issueForContract(world, contract, runtimeIndex, userId = null) {
  if (contract.kind !== 'supply') return commercialIssue(contract, userId);
  if (contract.status !== 'active') return null;
  if (isConfirmedDefault(contract)) {
    if (contract.terminationReason === 'both_default') return '双方均未满足履约条件，合同等待任一参与方主动解除';
    const claimantId = contract.terminationReason === 'buyer_default' ? contract.supplierId : contract.buyerId;
    return Number(claimantId) === Number(userId)
      ? '合同已确认违约，请主动解除合同并领取违约金'
      : '合同已确认违约，等待受偿方解除合同';
  }
""",
    'supply issue confirmed default',
)
text = replace_once(
    text,
    '    graceEndsAt: contract.graceEndsAt,\n    status: contract.status,',
    '    graceEndsAt: contract.graceEndsAt,\n    breachedAt: contract.breachedAt,\n    status: contract.status,',
    'public supply breachedAt',
)
text = replace_once(
    text,
    "      upcomingWithin24Hours: active.filter((contract) => Number(contract.nextDueAt || 0) <= now + 24 * 60 * 60 * 1000).length,",
    "      upcomingWithin24Hours: active.filter((contract) => contract.nextDueAt !== null && !isConfirmedDefault(contract) && Number(contract.nextDueAt) <= now + 24 * 60 * 60 * 1000).length,",
    'upcoming excludes confirmed defaults',
)
write(path, text)

# server/src/commercial-contracts.js
path = 'server/src/commercial-contracts.js'
text = read(path)
text = replace_once(
    text,
    "    contract.supplierReservedQuantity = contract.status === 'active' && !contract.graceEndsAt ? contract.quantity : 0;",
    "    contract.supplierReservedQuantity = contract.status === 'active' && !contract.graceEndsAt && !contract.breachedAt ? contract.quantity : 0;",
    'lease aliases default usage',
)
text = replace_once(
    text,
    "  contract.roundStatus = contract.graceEndsAt ? 'grace' : contract.status === 'active' ? 'ready' : 'preparing';",
    "  contract.roundStatus = contract.breachedAt ? 'grace' : contract.graceEndsAt ? 'grace' : contract.status === 'active' ? 'ready' : 'preparing';",
    'commercial round status',
)
# Both loan and lease normalization get breachedAt; loan additionally gets locked collateral snapshot.
text = replace_once(
    text,
    "    graceEndsAt: contract?.graceEndsAt == null ? undefined : Math.max(0, Number(contract.graceEndsAt)),\n    endedAt: contract?.endedAt == null ? undefined : Math.max(0, Number(contract.endedAt)),",
    "    graceEndsAt: contract?.graceEndsAt == null ? undefined : Math.max(0, Number(contract.graceEndsAt)),\n    breachedAt: contract?.breachedAt == null ? undefined : Math.max(0, Number(contract.breachedAt)),\n    defaultCollateralQuantity: Math.max(0, Math.floor(Number(contract?.defaultCollateralQuantity || 0))),\n    defaultCollateralUnitValue: Math.max(0, Number(contract?.defaultCollateralUnitValue || 0)),\n    endedAt: contract?.endedAt == null ? undefined : Math.max(0, Number(contract.endedAt)),",
    'normalize loan default snapshot',
)
text = replace_once(
    text,
    "    graceEndsAt: contract?.graceEndsAt == null ? undefined : Math.max(0, Number(contract.graceEndsAt)),\n    endedAt: contract?.endedAt == null ? undefined : Math.max(0, Number(contract.endedAt)),",
    "    graceEndsAt: contract?.graceEndsAt == null ? undefined : Math.max(0, Number(contract.graceEndsAt)),\n    breachedAt: contract?.breachedAt == null ? undefined : Math.max(0, Number(contract.breachedAt)),\n    endedAt: contract?.endedAt == null ? undefined : Math.max(0, Number(contract.endedAt)),",
    'normalize lease breachedAt',
)
# Insert loan default confirmation and make actual transfer honor the locked snapshot.
marker = 'function transferLoanCollateral(world, contract, now, runtimeIndex) {'
confirm_loan = """function confirmLoanDefault(world, contract, now, runtimeIndex) {
  const borrower = playerFor(world, contract.borrowerId);
  const lender = playerFor(world, contract.lenderId);
  const borrowerGroup = borrower && groupFor(borrower, contract.facilityTypeId);
  if (!borrower || !lender || !borrowerGroup) {
    transferLoanCollateral(world, contract, now, runtimeIndex);
    return;
  }
  const unitValue = Math.max(0.01, prudentFacilityUnitValue(world, contract.facilityTypeId) * 0.8);
  const due = addMoney(contract.principalOutstanding, contract.interestDue) || 0;
  const required = Math.max(1, Math.ceil(due / unitValue));
  const quantity = Math.min(contract.collateralQuantity, borrowerGroup.count, required);
  runtimeIndex.transition(contract, () => {
    contract.defaultCollateralQuantity = quantity;
    contract.defaultCollateralUnitValue = unitValue;
    contract.breachedAt = now;
    contract.terminationReason = 'borrower_default';
    contract.dueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
}

"""
text = replace_once(text, marker, confirm_loan + marker, 'insert loan default confirmation')
text = replace_once(
    text,
    """  const unitValue = Math.max(0.01, prudentFacilityUnitValue(world, contract.facilityTypeId) * 0.8);
  const due = addMoney(contract.principalOutstanding, contract.interestDue) || 0;
  const required = Math.max(1, Math.ceil(due / unitValue));
  const quantity = Math.min(contract.collateralQuantity, borrowerGroup.count, required);
""",
    """  const unitValue = Math.max(0.01, Number(contract.defaultCollateralUnitValue || 0) || prudentFacilityUnitValue(world, contract.facilityTypeId) * 0.8);
  const due = addMoney(contract.principalOutstanding, contract.interestDue) || 0;
  const required = Math.max(1, Math.ceil(due / unitValue));
  const plannedQuantity = Math.max(0, Math.floor(Number(contract.defaultCollateralQuantity || 0)));
  const quantity = Math.min(contract.collateralQuantity, borrowerGroup.count, plannedQuantity || required);
""",
    'loan claim locked collateral snapshot',
)
old = """function terminateLeaseDefault(contract, lessee, lessor, now, runtimeIndex) {
  runtimeIndex.transition(contract, () => {
    releaseFrozenCredits(lessee, contract.lesseeEscrowCredits);
    transferFrozenCredits(lessee, lessor, contract.lesseeBondCredits);
    releaseFrozenCredits(lessor, contract.lessorBondCredits);
    contract.lastCompensation = contract.lesseeBondCredits;
    contract.lastCompensationFromId = Number(lessee.userId);
    contract.lastCompensationToId = Number(lessor.userId);
    contract.lesseeEscrowCredits = 0;
    contract.lesseeBondCredits = 0;
    contract.lessorBondCredits = 0;
    contract.status = 'terminated';
    contract.terminationReason = 'lessee_default';
    contract.endedAt = now;
    contract.nextDueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
}
"""
new = """function confirmLeaseDefault(contract, lessee, lessor, now, runtimeIndex) {
  runtimeIndex.transition(contract, () => {
    releaseFrozenCredits(lessee, contract.lesseeEscrowCredits);
    releaseFrozenCredits(lessor, contract.lessorBondCredits);
    contract.lesseeEscrowCredits = 0;
    contract.lessorBondCredits = 0;
    contract.breachedAt = now;
    contract.terminationReason = 'lessee_default';
    contract.nextDueAt = null;
    delete contract.graceEndsAt;
    commercialAliases(contract);
  });
}

function claimLeaseDefault(contract, lessee, lessor, now, runtimeIndex) {
  const compensation = Math.max(0, Number(contract.lesseeBondCredits || 0));
  runtimeIndex.transition(contract, () => {
    transferFrozenCredits(lessee, lessor, compensation);
    contract.lastCompensation = compensation;
    contract.lastCompensationFromId = Number(lessee.userId);
    contract.lastCompensationToId = Number(lessor.userId);
    contract.lesseeBondCredits = 0;
    contract.status = 'terminated';
    contract.endedAt = now;
    commercialAliases(contract);
  });
}
"""
text = replace_once(text, old, new, 'lease two phase default')
text = replace_once(
    text,
    'export function processCommercialContract(world, contract, now, runtimeIndex) {\n  if (contract.kind === \'loan\') {',
    "export function processCommercialContract(world, contract, now, runtimeIndex) {\n  if (contract.status === 'active' && contract.breachedAt && String(contract.terminationReason || '').endsWith('_default')) return;\n  if (contract.kind === 'loan') {",
    'skip confirmed commercial default',
)
text = replace_once(text, '    transferLoanCollateral(world, contract, now, runtimeIndex);\n    return;\n  }\n  if (contract.kind === \'facility_lease\') {', '    confirmLoanDefault(world, contract, now, runtimeIndex);\n    return;\n  }\n  if (contract.kind === \'facility_lease\') {', 'loan grace confirms default')
text = replace_once(text, '    terminateLeaseDefault(contract, lessee, lessor, now, runtimeIndex);', '    confirmLeaseDefault(contract, lessee, lessor, now, runtimeIndex);', 'lease grace confirms default')
# Pending default action gate and claims.
text = replace_once(
    text,
    """export function applyCommercialContractAction(world, user, action, payload, now, runtimeIndex) {
  const contract = ownCommercialContract(runtimeIndex, user.id, payload.contractId);
  if (action === 'repayPlayerLoan') {
""",
    """export function applyCommercialContractAction(world, user, action, payload, now, runtimeIndex) {
  const contract = ownCommercialContract(runtimeIndex, user.id, payload.contractId);
  if (contract?.breachedAt && String(contract.terminationReason || '').endsWith('_default')) {
    if (action !== 'terminateProductionContractNow') return result(false, '合同已确认违约，不能再补救、还款或修改自动履约设置');
    if (contract.kind === 'loan') {
      if (Number(contract.lenderId) !== Number(user.id)) return result(false, '只有出借方可以解除违约贷款并处置抵押');
      transferLoanCollateral(world, contract, now, runtimeIndex);
      return result(true, '违约贷款已解除，抵押工厂已按违约确认时快照处置');
    }
    if (contract.kind === 'facility_lease') {
      if (Number(contract.lessorId) !== Number(user.id)) return result(false, '只有出租方可以解除违约租赁并领取违约金');
      const lessee = playerFor(world, contract.lesseeId);
      const lessor = playerFor(world, contract.lessorId);
      if (!lessee || !lessor) return result(false, '合同参与者不存在');
      claimLeaseDefault(contract, lessee, lessor, now, runtimeIndex);
      return result(true, '租赁合同已解除，承租方违约保证金已领取');
    }
  }
  if (action === 'repayPlayerLoan') {
""",
    'commercial pending action gate',
)
text = replace_once(
    text,
    """export function commercialIssue(contract) {
  if (contract.status !== 'active') return null;
  if (contract.graceEndsAt) return contract.kind === 'loan' ? '贷款已进入还款宽限期' : '租金不足，租赁使用权已暂停';
""",
    """export function commercialIssue(contract, userId = null) {
  if (contract.status !== 'active') return null;
  if (contract.breachedAt && String(contract.terminationReason || '').endsWith('_default')) {
    const claimantId = contract.kind === 'loan' ? contract.lenderId : contract.lessorId;
    if (Number(claimantId) === Number(userId)) {
      return contract.kind === 'loan'
        ? '借款方已违约，请主动解除贷款并处置抵押'
        : '承租方已违约，请主动解除租赁并领取违约金';
    }
    return '合同已确认违约，等待受偿方解除合同';
  }
  if (contract.graceEndsAt) return contract.kind === 'loan' ? '贷款已进入还款宽限期' : '租金不足，租赁使用权已暂停';
""",
    'commercial issue confirmed default',
)
text = replace_once(text, '    issue: commercialIssue(contract),', '    issue: commercialIssue(contract, userId),', 'commercial public issue user')
write(path, text)

# server/src/contract-runtime-index.js
path = 'server/src/contract-runtime-index.js'
text = read(path)
text = replace_once(
    text,
    "    graceEndsAt: Number(contract?.graceEndsAt),\n    renewalStatus:",
    "    graceEndsAt: Number(contract?.graceEndsAt),\n    breachedAt: Number(contract?.breachedAt),\n    terminationReason: String(contract?.terminationReason || ''),\n    renewalStatus:",
    'runtime snapshot breach fields',
)
text = replace_once(
    text,
    """    || snapshot.status !== 'active'
    || snapshot.buyerId === null
""",
    """    || snapshot.status !== 'active'
    || (Number.isFinite(snapshot.breachedAt) && snapshot.terminationReason.endsWith('_default'))
    || snapshot.buyerId === null
""",
    'warehouse reservation skips confirmed default',
)
text = replace_once(
    text,
    """function renewalReservationQuantity(snapshot) {
  return snapshot.status === 'active' && snapshot.renewalStatus === 'accepted'
""",
    """function renewalReservationQuantity(snapshot) {
  return snapshot.status === 'active'
    && !(Number.isFinite(snapshot.breachedAt) && snapshot.terminationReason.endsWith('_default'))
    && snapshot.renewalStatus === 'accepted'
""",
    'renewal reservation skips default',
)
text = replace_once(
    text,
    "  if (snapshot.status !== 'active') return null;\n  if (snapshot.kind === 'supply'",
    "  if (snapshot.status !== 'active') return null;\n  if (Number.isFinite(snapshot.breachedAt) && snapshot.terminationReason.endsWith('_default')) return null;\n  if (snapshot.kind === 'supply'",
    'deadline skips confirmed default',
)
write(path, text)

# server/src/contract-asset-locks.js
path = 'server/src/contract-asset-locks.js'
text = read(path)
text = replace_once(
    text,
    "function activeContracts(world) {\n  return (world?.productionContracts || []).filter((contract) => contract?.status === 'active');\n}\n",
    "function activeContracts(world) {\n  return (world?.productionContracts || []).filter((contract) => contract?.status === 'active');\n}\n\nfunction confirmedDefault(contract) {\n  return Number(contract?.breachedAt || 0) > 0 && String(contract?.terminationReason || '').endsWith('_default');\n}\n",
    'asset lock confirmed default helper',
)
text = replace_all_checked(text, "    && !contract.graceEndsAt\n", "    && !contract.graceEndsAt\n    && !confirmedDefault(contract)\n", 2, 'lease usage default guard')
text = replace_once(
    text,
    "    contract.kind === 'facility_lease'\n    && Number(contract.lessorId ?? contract.supplierId)",
    "    contract.kind === 'facility_lease'\n    && !confirmedDefault(contract)\n    && Number(contract.lessorId ?? contract.supplierId)",
    'lease ownership lock releases at confirmed default',
)
write(path, text)

# server/src/contract-audit-store.js
path = 'server/src/contract-audit-store.js'
text = read(path)
text = replace_once(
    text,
    "    graceEndsAt: nullableInteger(contract.graceEndsAt),\n    endedAt: nullableInteger(contract.endedAt),",
    "    graceEndsAt: nullableInteger(contract.graceEndsAt),\n    breachedAt: nullableInteger(contract.breachedAt),\n    endedAt: nullableInteger(contract.endedAt),",
    'audit breach timestamp snapshot',
)
text = replace_once(
    text,
    "    collateralQuantity: Math.max(0, safeInteger(contract.collateralQuantity, 0)), collateralTransferredQuantity: Math.max(0, safeInteger(contract.collateralTransferredQuantity, 0)),",
    "    collateralQuantity: Math.max(0, safeInteger(contract.collateralQuantity, 0)), collateralTransferredQuantity: Math.max(0, safeInteger(contract.collateralTransferredQuantity, 0)),\n    defaultCollateralQuantity: Math.max(0, safeInteger(contract.defaultCollateralQuantity, 0)), defaultCollateralUnitValue: safeMoney(contract.defaultCollateralUnitValue, 0),",
    'audit loan default snapshot',
)
text = replace_once(
    text,
    "    if (contract?.status !== 'active' || contract.publisherType === 'market_reserve' || contract.buyerId === null || contract.buyerId === undefined) continue;",
    "    if (contract?.status !== 'active' || contract.breachedAt || contract.publisherType === 'market_reserve' || contract.buyerId === null || contract.buyerId === undefined) continue;",
    'audit warehouse reserved excludes breach',
)
# Add generic confirmation release transfer helper before termination transfers.
marker = 'function terminationTransfers(before, after, actorUserId, completedDelta) {'
helper = """function defaultConfirmationTransfers(before, after) {
  const reserveBuyer = isMarketReserveContract(before);
  const buyerType = reserveBuyer ? 'system' : 'player';
  const buyerId = reserveBuyer ? null : before.buyerId;
  const availableAccount = reserveBuyer ? 'market_reserve_available' : 'available';
  const escrowAccount = reserveBuyer ? 'market_reserve_contract_escrow' : 'contract_escrow';
  const bondAccount = reserveBuyer ? 'market_reserve_contract_bond' : 'contract_bond';
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: Math.max(0, safeMoney(before.buyerEscrowCredits, 0) - safeMoney(after.buyerEscrowCredits, 0)), fromType: buyerType, fromId: buyerId, fromAccount: escrowAccount, toType: buyerType, toId: buyerId, toAccount: availableAccount, purpose: 'unused_escrow_release' }),
    transfer({ assetType: 'commodity', productId: before.productId, quantity: Math.max(0, safeInteger(before.supplierReservedQuantity, 0) - safeInteger(after.supplierReservedQuantity, 0)), fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_goods_escrow', toType: 'player', toId: before.supplierId, toAccount: 'inventory_available', purpose: 'unused_goods_release' }),
    transfer({ assetType: 'credits', quantity: Math.max(0, safeMoney(before.buyerBondCredits, 0) - safeMoney(after.buyerBondCredits, 0)), fromType: buyerType, fromId: buyerId, fromAccount: bondAccount, toType: buyerType, toId: buyerId, toAccount: availableAccount, purpose: 'buyer_bond_release' }),
    transfer({ assetType: 'credits', quantity: Math.max(0, safeMoney(before.supplierBondCredits, 0) - safeMoney(after.supplierBondCredits, 0)), fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'supplier_bond_release' }),
  ]);
}

"""
text = replace_once(text, marker, helper + marker, 'audit default confirmation transfer helper')
# Commercial helper recognizes confirmed-default final claim events.
text = replace_once(text, "    if (eventType === 'loan_defaulted') return compactTransfers([", "    if (eventType === 'loan_defaulted' || eventType === 'loan_default_claimed') return compactTransfers([", 'loan claimed audit transfers')
text = replace_once(
    text,
    """    if (eventType === 'lease_terminated') {
      const compensationFromId = Number.isFinite(Number(after.lastCompensationFromId)) ? Number(after.lastCompensationFromId) : null;
""",
    """    if (eventType === 'lease_default_confirmed') return compactTransfers([
      transfer({ assetType: 'credits', quantity: Math.max(0, safeMoney(before?.lesseeEscrowCredits, 0) - safeMoney(after?.lesseeEscrowCredits, 0)), fromType: 'player', fromId: after.lesseeId, fromAccount: 'contract_escrow', toType: 'player', toId: after.lesseeId, toAccount: 'available', purpose: 'lease_unused_rent_release' }),
      transfer({ assetType: 'credits', quantity: Math.max(0, safeMoney(before?.lessorBondCredits, 0) - safeMoney(after?.lessorBondCredits, 0)), fromType: 'player', fromId: after.lessorId, fromAccount: 'contract_bond', toType: 'player', toId: after.lessorId, toAccount: 'available', purpose: 'lease_lessor_bond_release' }),
      transfer({ assetType: 'commodity', productId: `facility-usage:${after.facilityTypeId}`, quantity: after.quantity, fromType: 'player', fromId: after.lesseeId, fromAccount: 'facility_usage', toType: 'player', toId: after.lessorId, toAccount: 'facility_usage', purpose: 'lease_usage_right_return' }),
    ]);
    if (eventType === 'lease_default_claimed') {
      return compactTransfers([
        transfer({ assetType: 'credits', quantity: after.lastCompensation, fromType: 'player', fromId: after.lastCompensationFromId, fromAccount: 'contract_bond', toType: 'player', toId: after.lastCompensationToId, toAccount: 'available', purpose: 'bond_compensation' }),
      ]);
    }
    if (eventType === 'lease_terminated') {
      const compensationFromId = Number.isFinite(Number(after.lastCompensationFromId)) ? Number(after.lastCompensationFromId) : null;
""",
    'lease confirmed/claimed audit transfers',
)
# Commercial transition splits default confirmation from player claim.
text = replace_once(
    text,
    """  const accepted = before.status === 'open' && after.status === 'active';
  const completed = before.status === 'active' && after.status === 'completed';
  const terminated = before.status === 'active' && after.status === 'terminated';
""",
    """  const accepted = before.status === 'open' && after.status === 'active';
  const completed = before.status === 'active' && after.status === 'completed';
  const terminated = before.status === 'active' && after.status === 'terminated';
  const defaultConfirmed = before.status === 'active' && after.status === 'active' && !before.breachedAt && Boolean(after.breachedAt) && String(after.terminationReason || '').endsWith('_default');
""",
    'commercial transition default confirmed flag',
)
text = replace_once(
    text,
    """  if (!before.graceEndsAt && after.graceEndsAt) queueTransitionEvent(world, context, after, 'grace_started', { before, after, reasonCode: after.kind === 'loan' ? 'borrower_funds' : 'lessee_rent', metadata: { graceEndsAt: after.graceEndsAt } });
  if (after.kind === 'facility_lease' && after.completedPeriods > before.completedPeriods) {
""",
    """  if (!before.graceEndsAt && after.graceEndsAt) queueTransitionEvent(world, context, after, 'grace_started', { before, after, reasonCode: after.kind === 'loan' ? 'borrower_funds' : 'lessee_rent', metadata: { graceEndsAt: after.graceEndsAt } });
  if (defaultConfirmed) {
    const eventType = after.kind === 'loan' ? 'loan_default_confirmed' : 'lease_default_confirmed';
    queueTransitionEvent(world, context, after, eventType, { before, after, reasonCode: after.terminationReason, transfers: commercialTransfersForTransition(before, after, eventType), metadata: { breachedAt: after.breachedAt } });
  }
  if (after.kind === 'facility_lease' && after.completedPeriods > before.completedPeriods) {
""",
    'commercial default confirmed audit event',
)
text = replace_once(
    text,
    """  if (terminated) {
    const eventType = after.kind === 'loan' ? 'loan_defaulted' : 'lease_terminated';
    queueTransitionEvent(world, context, after, eventType, { before, after, reasonCode: after.terminationReason, transfers: commercialTransfersForTransition(before, after, eventType) });
  }
""",
    """  if (terminated) {
    const eventType = after.kind === 'loan'
      ? (before.breachedAt ? 'loan_default_claimed' : 'loan_defaulted')
      : (before.breachedAt && after.terminationReason === 'lessee_default' ? 'lease_default_claimed' : 'lease_terminated');
    queueTransitionEvent(world, context, after, eventType, { before, after, reasonCode: after.terminationReason, transfers: commercialTransfersForTransition(before, after, eventType), metadata: before.breachedAt ? { breachedAt: before.breachedAt, claimedAt: after.endedAt } : {} });
  }
""",
    'commercial final default claim audit',
)
# Supply transition: add confirmed flag and event.
text = replace_once(
    text,
    """const completedDelta = Math.max(0, after.completedDeliveries - before.completedDeliveries);
const accepted = before.status === 'open' && after.status === 'active';
      const terminated = before.status === 'active' && after.status === 'terminated';
      const completed = before.status === 'active' && after.status === 'completed';
""",
    """const completedDelta = Math.max(0, after.completedDeliveries - before.completedDeliveries);
const accepted = before.status === 'open' && after.status === 'active';
      const terminated = before.status === 'active' && after.status === 'terminated';
      const completed = before.status === 'active' && after.status === 'completed';
      const defaultConfirmed = before.status === 'active' && after.status === 'active' && !before.breachedAt && Boolean(after.breachedAt) && String(after.terminationReason || '').endsWith('_default');
""",
    'supply default confirmed flag',
)
text = replace_once(
    text,
    """      if (!before.graceEndsAt && after.graceEndsAt) {
        queueTransitionEvent(world, normalizedContext, after, 'grace_started', {
          before,
          after,
          batchNumber: after.completedDeliveries + 1,
          reasonCode: graceReasonCode(world, after, incomingByBuyer),
          metadata: { graceEndsAt: after.graceEndsAt },
        });
      }

      if (completedDelta > 0) {
""",
    """      if (!before.graceEndsAt && after.graceEndsAt) {
        queueTransitionEvent(world, normalizedContext, after, 'grace_started', {
          before,
          after,
          batchNumber: after.completedDeliveries + 1,
          reasonCode: graceReasonCode(world, after, incomingByBuyer),
          metadata: { graceEndsAt: after.graceEndsAt },
        });
      }
      if (defaultConfirmed) {
        queueTransitionEvent(world, normalizedContext, after, 'contract_default_confirmed', {
          before,
          after,
          batchNumber: after.completedDeliveries + 1,
          reasonCode: after.terminationReason,
          transfers: defaultConfirmationTransfers(before, after),
          metadata: { breachedAt: after.breachedAt },
          sourceKey: `contract-audit:default-confirmed:${after.id}:${after.breachedAt}`,
        });
      }

      if (completedDelta > 0) {
""",
    'supply default confirmed audit event',
)
text = replace_once(
    text,
    """      if (terminated) {
        queueTransitionEvent(world, normalizedContext, after, eventTypeForTermination(after.terminationReason), {
""",
    """      if (terminated) {
        queueTransitionEvent(world, normalizedContext, after, before.breachedAt && String(after.terminationReason || '').endsWith('_default') ? 'contract_default_claimed' : eventTypeForTermination(after.terminationReason), {
""",
    'supply final claim event type',
)
write(path, text)

# src/contracts/types.ts
path = 'src/contracts/types.ts'
text = read(path)
text = replace_once(
    text,
    '  graceEndsAt?: number;\n  status: ProductionContractStatus;',
    '  graceEndsAt?: number;\n  breachedAt?: number;\n  status: ProductionContractStatus;',
    'client breachedAt type',
)
text = replace_once(
    text,
    '  collateralTransferredQuantity?: number;\n  autoRepay?: boolean;',
    '  collateralTransferredQuantity?: number;\n  defaultCollateralQuantity?: number;\n  defaultCollateralUnitValue?: number;\n  autoRepay?: boolean;',
    'client loan default snapshot types',
)
write(path, text)

# src/pages/ContractPage.tsx
path = 'src/pages/ContractPage.tsx'
text = read(path)
text = replace_once(
    text,
    """function statusTone(contract: Pick<ProductionContract, 'status'> & Partial<Pick<ProductionContract, 'graceEndsAt' | 'issue'>>) {
  if (contract.status === 'completed') return 'success' as const;
""",
    """function isConfirmedDefault(contract: Pick<ProductionContract, 'status' | 'terminationReason'> & Partial<Pick<ProductionContract, 'breachedAt'>>) {
  return contract.status === 'active'
    && Boolean(contract.breachedAt)
    && ['buyer_default', 'supplier_default', 'both_default', 'borrower_default', 'lessee_default'].includes(String(contract.terminationReason || ''));
}

function canClaimConfirmedDefault(contract: ProductionContract) {
  if (!isConfirmedDefault(contract)) return false;
  if (contract.terminationReason === 'buyer_default') return Boolean(contract.isSupplier);
  if (contract.terminationReason === 'supplier_default') return Boolean(contract.isBuyer);
  if (contract.terminationReason === 'both_default') return Boolean(contract.isParticipant || contract.isBuyer || contract.isSupplier);
  if (contract.terminationReason === 'borrower_default') return Boolean(contract.isLender);
  if (contract.terminationReason === 'lessee_default') return Boolean(contract.isLessor);
  return false;
}

function defaultClaimLabel(contract: ProductionContract) {
  if (contract.kind === 'loan') return '解除合同并处置抵押';
  if (contract.terminationReason === 'both_default') return '解除合同';
  return '解除合同并领取违约金';
}

function statusTone(contract: Pick<ProductionContract, 'status' | 'terminationReason'> & Partial<Pick<ProductionContract, 'graceEndsAt' | 'issue' | 'breachedAt'>>) {
  if (contract.status === 'completed') return 'success' as const;
""",
    'contract page default helpers',
)
text = replace_once(text, "  if (contract.status === 'terminated') return 'danger' as const;\n", "  if (contract.status === 'terminated' || isConfirmedDefault(contract)) return 'danger' as const;\n", 'status tone confirmed default')
text = replace_once(
    text,
    '  return Boolean(\n    contract.graceEndsAt\n',
    '  return Boolean(\n    isConfirmedDefault(contract)\n    || contract.graceEndsAt\n',
    'attention includes confirmed default',
)
text = replace_once(text, '    && !contract.graceEndsAt\n    && !contract.terminationRequestedBy;', '    && !contract.graceEndsAt\n    && !isConfirmedDefault(contract)\n    && !contract.terminationRequestedBy;', 'renewal unavailable after breach')
# Commercial active card: local flags, status, controls and footer.
text = replace_once(
    text,
    """  const totalLoanDue = Number(contract.principalOutstanding || 0) + Number(contract.interestDue || 0);
  const canFundLease = !isLoan && contract.isLessee && Number(contract.lesseeEscrowCredits || 0) < Number(contract.rentPerPeriod || 0);
  return (
    <PagePanel className={`contract-card contract-commercial-card contract-card--${contract.graceEndsAt ? 'danger' : contract.issue ? 'attention' : 'normal'}`}>
""",
    """  const totalLoanDue = Number(contract.principalOutstanding || 0) + Number(contract.interestDue || 0);
  const confirmedDefault = isConfirmedDefault(contract);
  const canClaimDefault = canClaimConfirmedDefault(contract);
  const canFundLease = !confirmedDefault && !isLoan && contract.isLessee && Number(contract.lesseeEscrowCredits || 0) < Number(contract.rentPerPeriod || 0);
  return (
    <PagePanel className={`contract-card contract-commercial-card contract-card--${confirmedDefault || contract.graceEndsAt ? 'danger' : contract.issue ? 'attention' : 'normal'}`}>
""",
    'commercial active flags',
)
text = replace_once(
    text,
    "<div className=\"contract-card-tags\"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{contract.graceEndsAt ? '宽限期' : contractKindLabel(contract)}</StatusTag>{contract.issue ? <StatusTag tone=\"warning\">待处理</StatusTag> : null}</div>",
    "<div className=\"contract-card-tags\"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{confirmedDefault ? '已违约 · 待解除' : contract.graceEndsAt ? '宽限期' : contractKindLabel(contract)}</StatusTag>{contract.issue ? <StatusTag tone={confirmedDefault ? 'danger' : 'warning'}>待处理</StatusTag> : null}</div>",
    'commercial status tag',
)
text = replace_once(
    text,
    "            {contract.graceEndsAt ? <DataRow label=\"宽限期结束\" value={dateTimeLabel(contract.graceEndsAt)} tone=\"danger\" /> : null}",
    "            {confirmedDefault ? <DataRow label=\"违约确认时间\" value={dateTimeLabel(contract.breachedAt)} tone=\"danger\" /> : contract.graceEndsAt ? <DataRow label=\"宽限期结束\" value={dateTimeLabel(contract.graceEndsAt)} tone=\"danger\" /> : null}",
    'commercial breach timestamp',
)
old = """        <div className="contract-primary-actions">
          {isLoan && contract.isBorrower ? <Button disabled={busy} onClick={() => void run(`${contract.id}:repay`, () => productionContractActions.repayLoan(contract.id))}>偿还本金和利息</Button> : null}
          {canFundLease ? <Button disabled={busy} onClick={() => void run(`${contract.id}:lease-fund`, () => productionContractActions.fundLease(contract.id))}>补充本期租金</Button> : null}
          {!((isLoan && contract.isBorrower) || canFundLease) ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '等待责任方处理' : '当前无需手动处理'}</StatusTag> : null}
        </div>
        <div className="contract-automation">
          {isLoan && contract.isBorrower ? <ToggleField label="自动还款" description="到期优先使用可用资金一次性结清。" checked={contract.autoRepay !== false} disabled={busy} onChange={() => void run(`${contract.id}:auto-repay`, () => productionContractActions.setLoanAutoRepay(contract.id, contract.autoRepay === false))} /> : null}
          {!isLoan && contract.isLessee ? <ToggleField label="自动补充租金" description="每期从当前可用资金补足托管租金。" checked={contract.autoFund !== false} disabled={busy} onChange={() => void run(`${contract.id}:lease-auto-fund`, () => productionContractActions.setLeaseAutoFund(contract.id, contract.autoFund === false))} /> : null}
        </div>
"""
new = """        <div className="contract-primary-actions">
          {confirmedDefault ? (
            canClaimDefault
              ? <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:default-claim`, () => productionContractActions.terminateNow(contract.id))}>{defaultClaimLabel(contract)}</Button>
              : <StatusTag tone="danger">等待受偿方处理</StatusTag>
          ) : (
            <>
              {isLoan && contract.isBorrower ? <Button disabled={busy} onClick={() => void run(`${contract.id}:repay`, () => productionContractActions.repayLoan(contract.id))}>偿还本金和利息</Button> : null}
              {canFundLease ? <Button disabled={busy} onClick={() => void run(`${contract.id}:lease-fund`, () => productionContractActions.fundLease(contract.id))}>补充本期租金</Button> : null}
              {!((isLoan && contract.isBorrower) || canFundLease) ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '等待责任方处理' : '当前无需手动处理'}</StatusTag> : null}
            </>
          )}
        </div>
        {!confirmedDefault ? <div className="contract-automation">
          {isLoan && contract.isBorrower ? <ToggleField label="自动还款" description="到期优先使用可用资金一次性结清。" checked={contract.autoRepay !== false} disabled={busy} onChange={() => void run(`${contract.id}:auto-repay`, () => productionContractActions.setLoanAutoRepay(contract.id, contract.autoRepay === false))} /> : null}
          {!isLoan && contract.isLessee ? <ToggleField label="自动补充租金" description="每期从当前可用资金补足托管租金。" checked={contract.autoFund !== false} disabled={busy} onChange={() => void run(`${contract.id}:lease-auto-fund`, () => productionContractActions.setLeaseAutoFund(contract.id, contract.autoFund === false))} /> : null}
        </div> : null}
"""
text = replace_once(text, old, new, 'commercial confirmed default actions')
text = replace_once(text, '      {!isLoan ? <footer className="contract-management-actions">', '      {!isLoan && !confirmedDefault ? <footer className="contract-management-actions">', 'hide commercial normal termination after breach')
# Supply active card flags/status/actions.
text = replace_once(
    text,
    """  const canPrepare = contract.isSupplier && contract.supplierReservedQuantity < contract.quantityPerDelivery;
  const canFund = contract.isBuyer && contract.buyerEscrowCredits < contract.batchGross;
  const counterparty = contract.isBuyer ? contract.supplierName : contract.buyerName;
  const statusLabel = contract.graceEndsAt ? '宽限期' : STATUS_LABELS[contract.status];
  const needsAttention = contractNeedsAttention(contract);

  return (
    <PagePanel className={`contract-card contract-card--${contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`}>
""",
    """  const confirmedDefault = isConfirmedDefault(contract);
  const canClaimDefault = canClaimConfirmedDefault(contract);
  const canPrepare = !confirmedDefault && contract.isSupplier && contract.supplierReservedQuantity < contract.quantityPerDelivery;
  const canFund = !confirmedDefault && contract.isBuyer && contract.buyerEscrowCredits < contract.batchGross;
  const counterparty = contract.isBuyer ? contract.supplierName : contract.buyerName;
  const statusLabel = confirmedDefault ? '已违约 · 待解除' : contract.graceEndsAt ? '宽限期' : STATUS_LABELS[contract.status];
  const needsAttention = contractNeedsAttention(contract);

  return (
    <PagePanel className={`contract-card contract-card--${confirmedDefault || contract.graceEndsAt ? 'danger' : needsAttention ? 'attention' : 'normal'}`}>
""",
    'supply active flags',
)
text = replace_once(
    text,
    "<div className=\"contract-card-tags\"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{statusLabel}</StatusTag>{needsAttention && !contract.graceEndsAt ? <StatusTag tone=\"warning\">待处理</StatusTag> : null}</div>",
    "<div className=\"contract-card-tags\"><RoleTag contract={contract} /><StatusTag tone={statusTone(contract)}>{statusLabel}</StatusTag>{needsAttention && !contract.graceEndsAt ? <StatusTag tone={confirmedDefault ? 'danger' : 'warning'}>待处理</StatusTag> : null}</div>",
    'supply status tags',
)
text = replace_once(
    text,
    "            {contract.graceEndsAt ? <DataRow label=\"宽限期结束\" value={dateTimeLabel(contract.graceEndsAt)} tone=\"danger\" /> : null}",
    "            {confirmedDefault ? <DataRow label=\"违约确认时间\" value={dateTimeLabel(contract.breachedAt)} tone=\"danger\" /> : contract.graceEndsAt ? <DataRow label=\"宽限期结束\" value={dateTimeLabel(contract.graceEndsAt)} tone=\"danger\" /> : null}",
    'supply breach timestamp',
)
old = """        <div className="contract-primary-actions">
          {canPrepare ? <Button disabled={busy} onClick={() => void run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>准备本批商品</Button> : null}
          {canFund ? <Button disabled={busy} onClick={() => void run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>补充本批货款</Button> : null}
          {!canPrepare && !canFund ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '请先处理上方异常' : '当前无需手动处理'}</StatusTag> : null}
        </div>
        <div className="contract-automation">
"""
new = """        <div className="contract-primary-actions">
          {confirmedDefault ? (
            canClaimDefault
              ? <Button variant="danger" disabled={busy} onClick={() => void run(`${contract.id}:default-claim`, () => productionContractActions.terminateNow(contract.id))}>{defaultClaimLabel(contract)}</Button>
              : <StatusTag tone="danger">等待受偿方处理</StatusTag>
          ) : (
            <>
              {canPrepare ? <Button disabled={busy} onClick={() => void run(`${contract.id}:prepare`, () => productionContractActions.prepare(contract.id))}>准备本批商品</Button> : null}
              {canFund ? <Button disabled={busy} onClick={() => void run(`${contract.id}:fund`, () => productionContractActions.fund(contract.id))}>补充本批货款</Button> : null}
              {!canPrepare && !canFund ? <StatusTag tone={contract.issue ? 'warning' : 'success'}>{contract.issue ? '请先处理上方异常' : '当前无需手动处理'}</StatusTag> : null}
            </>
          )}
        </div>
        {!confirmedDefault ? <div className="contract-automation">
"""
text = replace_once(text, old, new, 'supply confirmed default primary actions')
text = replace_once(text, '        </div>\n      </div>\n\n      <ContractRenewalSection contract={contract}', '        </div> : null}\n      </div>\n\n      <ContractRenewalSection contract={contract}', 'close conditional supply automation')
text = replace_once(text, '      <footer className="contract-management-actions">\n        {!contract.terminationRequestedBy ? (', '      {!confirmedDefault ? <footer className="contract-management-actions">\n        {!contract.terminationRequestedBy ? (', 'conditional supply footer start')
text = replace_once(text, '      </footer>\n    </PagePanel>\n  );\n}\n\nfunction OpenContractCard', '      </footer> : null}\n    </PagePanel>\n  );\n}\n\nfunction OpenContractCard', 'conditional supply footer end')
write(path, text)

# server/test/contracts.test.js - update default test only.
path = 'server/test/contracts.test.js'
text = read(path)
old = """  processProductionContracts(world, contract.graceEndsAt + 1);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'terminated');
  assert.equal(contract.terminationReason, 'supplier_default');
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(supplier.frozenCredits, 0);
  assert.equal(buyer.credits, 100_100, '采购方收回货款与自己的保证金，并获得供应方保证金');
  assert.equal(supplier.stats.contractDefaults, 1);
"""
new = """  processProductionContracts(world, contract.graceEndsAt + 1);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'active');
  assert.equal(contract.terminationReason, 'supplier_default');
  assert.ok(contract.breachedAt);
  assert.equal(buyer.frozenCredits, 0, '采购方货款与自身保证金应在违约确认时释放');
  assert.equal(supplier.frozenCredits, 100, '供应方违约保证金保持冻结，等待采购方主动领取');
  assert.equal(buyer.credits, 100_000, '违约确认时不得自动领取供应方保证金');
  assert.equal(supplier.stats.contractDefaults, 1);
  assert.equal(applyProductionContractAction(world, supplierUser, 'terminateProductionContractNow', { contractId: contract.id }, contract.breachedAt + 1).ok, false, '责任方不能主动解除逃避赔付');
  assert.equal(applyProductionContractAction(world, buyerUser, 'terminateProductionContractNow', { contractId: contract.id }, contract.breachedAt + 2).ok, true);
  contract = contractById(world, contract.id);
  assert.equal(contract.status, 'terminated');
  assert.equal(buyer.credits, 100_100, '采购方主动解除后才领取供应方保证金');
  assert.equal(supplier.frozenCredits, 0);
"""
text = replace_once(text, old, new, 'supply default server test')
write(path, text)

# server/test/commercial-contracts.test.js
path = 'server/test/commercial-contracts.test.js'
text = read(path)
old = """  processProductionContracts(state, contract.graceEndsAt + 1);
  const terminated = state.productionContracts[0];
  assert.equal(terminated.lastCompensationFromId, 2);
  assert.equal(terminated.lastCompensationToId, 1);
});
"""
new = """  processProductionContracts(state, contract.graceEndsAt + 1);
  let breached = state.productionContracts[0];
  assert.equal(breached.status, 'active');
  assert.equal(breached.terminationReason, 'lessee_default');
  assert.ok(breached.breachedAt);
  assert.equal(breached.lastCompensationFromId, undefined);
  assert.equal(contractLockedFacilityQuantity(state, 1, facility.id), 0, '违约确认后出租方资产不再被租赁锁定');
  assert.ok(state.players['2'].frozenCredits > 0, '承租方违约保证金保持冻结等待出租方领取');
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 1).ok, false);
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 2).ok, true);
  breached = state.productionContracts[0];
  assert.equal(breached.status, 'terminated');
  assert.equal(breached.lastCompensationFromId, 2);
  assert.equal(breached.lastCompensationToId, 1);
});
"""
text = replace_once(text, old, new, 'lease manual default claim test')
old = """  processProductionContracts(state, grace.graceEndsAt + 1);
  const terminated = state.productionContracts[0];
  assert.equal(terminated.status, 'terminated');
  assert.equal(terminated.collateralTransferredQuantity, 1);
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 0);
  assert.equal(state.players['1'].facilityGroups[0].count, 9);
  assert.equal(state.players['2'].facilityGroups[0].count, 11);
});

test('schema 6 migrates legacy supply contracts without changing roles', () => {
"""
new = """  processProductionContracts(state, grace.graceEndsAt + 1);
  let breached = state.productionContracts[0];
  assert.equal(breached.status, 'active');
  assert.equal(breached.terminationReason, 'borrower_default');
  assert.ok(breached.breachedAt);
  assert.equal(breached.defaultCollateralQuantity, 1);
  assert.equal(breached.collateralTransferredQuantity, 0, '违约确认时不得自动转移抵押工厂');
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 2, '等待出借方处置期间抵押仍保持锁定');
  assert.equal(state.players['1'].facilityGroups[0].count, 10);
  assert.equal(state.players['2'].facilityGroups[0].count, 10);
  assert.equal(applyProductionContractAction(state, { id: 1 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 1).ok, false);
  assert.equal(applyProductionContractAction(state, { id: 2 }, 'terminateProductionContractNow', { contractId }, breached.breachedAt + 2).ok, true);
  breached = state.productionContracts[0];
  assert.equal(breached.status, 'terminated');
  assert.equal(breached.collateralTransferredQuantity, 1);
  assert.equal(playerLoanCollateralQuantity(state, 1, facility.id), 0);
  assert.equal(state.players['1'].facilityGroups[0].count, 9);
  assert.equal(state.players['2'].facilityGroups[0].count, 11);
});

test('schema 7 migrates legacy supply contracts without changing roles', () => {
"""
text = replace_once(text, old, new, 'loan manual collateral claim test')
text = replace_once(text, '  assert.equal(state.productionContractSchemaVersion, 6);', '  assert.equal(state.productionContractSchemaVersion, 7);', 'commercial schema test')
write(path, text)

# scripts/verify-contract-types.mjs
path = 'scripts/verify-contract-types.mjs'
text = read(path)
text = replace_once(text, "requireText('server/src/contracts.js', ['PRODUCTION_CONTRACT_SCHEMA_VERSION = 6', 'processCommercialContract', 'publicCommercialContract']);", "requireText('server/src/contracts.js', ['PRODUCTION_CONTRACT_SCHEMA_VERSION = 7', 'confirmDefault', 'confirmMarketReserveBuyerDefault', 'claimConfirmedDefault', 'breachedAt', 'processCommercialContract', 'publicCommercialContract']);", 'contract type verifier schema')
text = replace_once(text, "requireText('server/src/contract-asset-locks.js', ['playerLoanCollateralQuantity', 'leasedOutFacilityQuantity', 'leasedInFacilityQuantity', 'playerLoanFinancialPosition']);", "requireText('server/src/contract-asset-locks.js', ['playerLoanCollateralQuantity', 'leasedOutFacilityQuantity', 'leasedInFacilityQuantity', 'playerLoanFinancialPosition', 'confirmedDefault']);", 'contract type verifier locks')
text = replace_once(text, "requireText('server/src/contract-audit-store.js', ['player_loan_collateral_release', 'player_loan_collateral_remainder_release', 'lease_usage_right_return', 'lastCompensationFromId', 'lastCompensationToId']);", "requireText('server/src/contract-audit-store.js', ['player_loan_collateral_release', 'player_loan_collateral_remainder_release', 'lease_usage_right_return', 'contract_default_confirmed', 'contract_default_claimed', 'loan_default_confirmed', 'loan_default_claimed', 'lastCompensationFromId', 'lastCompensationToId']);", 'contract type verifier audit')
text = replace_once(text, "requireText('src/pages/ContractPage.tsx', ['供应合同', '采购合同', '放贷合同', '贷款合同', '出租合同', '租赁合同']);", "requireText('src/pages/ContractPage.tsx', ['供应合同', '采购合同', '放贷合同', '贷款合同', '出租合同', '租赁合同', '已违约 · 待解除', '解除合同并领取违约金', '解除合同并处置抵押', '等待受偿方处理']);", 'contract type verifier ui')
text = replace_once(text, "requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['三类合同领域', '玩家抵押借贷', '工厂使用权租赁']);", "requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['三类合同领域', '玩家抵押借贷', '工厂使用权租赁', '已违约待解除', '宽限结束只确认违约']);\nrequireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', ['已违约待解除', '解除合同并领取违约金', '解除合同并处置抵押']);", 'contract type verifier docs')
write(path, text)

# scripts/verify-contract-audit.mjs
path = 'scripts/verify-contract-audit.mjs'
text = read(path)
text = replace_once(text, "  'contractHistorySettlementSummaries', 'endSummary', 'compensationReceivedByMe', 'compensationPaidByMe',\n", "  'contractHistorySettlementSummaries', 'endSummary', 'compensationReceivedByMe', 'compensationPaidByMe',\n  'contract_default_confirmed', 'contract_default_claimed', 'loan_default_confirmed', 'loan_default_claimed',\n", 'audit verifier events')
write(path, text)

# docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md
path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
text = read(path)
text = replace_once(text, '> 更新时间：2026-08-09', '> 更新时间：2026-08-10', 'page design date')
text = replace_once(text, '待处理判定统一包含宽限期、当前批次异常、批次后结束申请和等待本人确认的续签提议；', '待处理判定统一包含已违约待解除、宽限期、当前批次异常、批次后结束申请和等待本人确认的续签提议；', 'page attention design')
old = '到期结算必须由服务器执行。供应方冻结商品、采购方冻结货款和采购方仓库空间全部满足时，服务器原子转移整批商品与货款；任一条件不足不得部分交付，并进入宽限期。宽限结束后由责任方保证金赔付对方。申请结束在当前批次成功交付后生效；立即终止由发起方承担违约责任。'
new = '到期结算必须由服务器执行。供应方冻结商品、采购方冻结货款和采购方仓库空间全部满足时，服务器原子转移整批商品与货款；任一条件不足不得部分交付，并进入宽限期。**宽限结束只确认违约，不得直接解除玩家合同。** 宽限结束仍不满足时，服务器记录责任方与 `breachedAt`，停止后续批次并进入“已违约待解除”；与违约赔偿无关的本批托管货款、商品和无责方保证金立即原路释放，责任方保证金继续冻结作为唯一待领取赔偿。违约确认后不得通过事后补货、补款、还款或重新开启自动履约恢复合同。受偿玩家必须主动执行“解除合同并领取违约金”，服务器在同一幂等事务中划转责任方保证金并写入终态；责任方不能自行解除来逃避赔付。双方均违约时双方保证金各自退回，任一参与方均可主动解除且不发生单方赔付。玩家抵押借贷在宽限结束后只锁定当时的审慎处置单价与最少足额抵押数量，由出借方主动执行“解除合同并处置抵押”；工厂租赁在违约确认时立即停止使用权并解除出租方工厂锁定，由出租方主动领取承租方保证金。市场储备不是玩家：当玩家是受偿方时同样必须主动领取；当受偿主体是市场储备时允许系统自动执行违约处置，避免无玩家操作主体的合同永久占用。申请结束在当前批次成功交付后生效；立即终止仍由主动发起方承担违约责任。'
text = replace_once(text, old, new, 'page default lifecycle design')
text = replace_once(text, '结束原因和结束时间来自服务器终态摘要，客户端不得根据余额或本地时间推断；', '结束原因和结束时间来自服务器终态摘要，客户端不得根据余额或本地时间推断；已违约待解除的合同另以服务器 `breachedAt` 保存违约确认时间，最终 `endedAt` 只记录受偿方实际解除时间，两者不得互相覆盖；', 'history breach/end timestamps')
text = replace_once(text, '- 由客户端倒计时直接结算合同、判定违约或转移保证金；', '- 由客户端倒计时直接结算合同、判定违约或转移保证金；\n- 恢复宽限结束后自动把玩家合同改为 `terminated`、自动把责任方保证金划给玩家，或允许责任方自行解除已违约待解除合同逃避赔付；市场储备作为受偿主体的系统自动处置例外不得扩大到玩家受偿合同；', 'page anti regression default lifecycle')
write(path, text)

# docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md
path = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
text = read(path)
text = replace_once(text, '> 更新时间：2026-08-09', '> 更新时间：2026-08-10', 'server design date')
text = replace_once(text, '- `contracts.js`：三类合同的统一门面、生命周期、状态交付与供货合同结算；商品供货公开合同的结构化议价线程也由该模块权威维护，议价不冻结资产，接受最终报价后复用正式签约校验；', '- `contracts.js`：三类合同的统一门面、生命周期、状态交付与供货合同结算；商品供货公开合同的结构化议价线程也由该模块权威维护，议价不冻结资产，接受最终报价后复用正式签约校验；合同 schema 7 同时在本模块维护“宽限结束只确认违约 → 已违约待解除 → 受偿方主动解除/领取”的两阶段违约状态机；', 'server module design')
old = '正式世界处理先结算到期生产周期，再执行合同自动准备、到期结算和宽限期终止。每批结算在一个事务中同时检查供应方冻结商品、采购方冻结货款和采购方统一仓库空间；仓库空间必须同时计入实物库存、未完成商品买单、最高出价拍卖和其他进行中采购合同的下一批预占，并在检查当前合同时排除该合同自身旧预占后加入本批数量。随后原子转移整批商品、扣除整批货款、支付扣费后收入并推进批次。任一条件不足不得部分交付，并进入宽限期；宽限结束后由责任方保证金赔付对方。'
new = '正式世界处理先结算到期生产周期，再执行合同自动准备、到期结算和宽限期违约确认。每批结算在一个事务中同时检查供应方冻结商品、采购方冻结货款和采购方统一仓库空间；仓库空间必须同时计入实物库存、未完成商品买单、最高出价拍卖和其他进行中采购合同的下一批预占，并在检查当前合同时排除该合同自身旧预占后加入本批数量。随后原子转移整批商品、扣除整批货款、支付扣费后收入并推进批次。任一条件不足不得部分交付，并进入宽限期；**宽限结束只确认违约**：服务器写入 `breachedAt` 与责任代码，清除下一到期时间并进入“已违约待解除”，释放与赔偿无关的当前货款、商品和无责方保证金，只继续冻结责任方保证金。已违约待解除合同不得继续自动准备、自动补款、手动补救、续签或恢复履约；合同运行时索引不得继续为其创建下一批仓库预占或截止时间。受偿玩家随后通过既有终止动作主动解除并原子领取违约金，责任方提交同一动作必须被拒绝；双方违约允许任一参与方关闭且不发生赔付。市场储备作为受偿主体时没有玩家操作入口，因此仍由系统自动完成处置；市场储备自身违约而玩家为受偿方时必须等待玩家主动领取。'
text = replace_once(text, old, new, 'server supply default lifecycle')
text = replace_once(text, '合同审计必须覆盖发布、承接、手动或自动准备商品、手动或自动补充货款、自动履约设置变化、取消、公开过期、进入宽限、逐批成功交付、申请批次后结束、正常完成、立即终止和宽限期违约。', '合同审计必须覆盖发布、承接、手动或自动准备商品、手动或自动补充货款、自动履约设置变化、取消、公开过期、进入宽限、逐批成功交付、申请批次后结束、正常完成、立即终止、违约确认以及受偿方主动解除／领取。违约确认事件记录 `breachedAt`、责任代码和当时释放的非赔偿托管资产；最终领取事件记录实际赔偿或抵押转移和 `endedAt`，不得把两个时点压成同一事件。', 'server audit default lifecycle')
old = '玩家贷款承接时从出借方可用资金原子转移本金到借款方，并锁定借款方抵押工厂；抵押工厂继续生产，但不得出售、拍卖、银行抵押、重复借贷抵押或出租。到期优先按自动还款设置从可用资金结清本金和固定利息；宽限结束仍不足时，按当前审慎价格的 80% 转移最少足额抵押数量给出借方。未偿本金分别计入出借方合同应收和借款方合同负债，未支付利息不提前计入净资产。'
new = '玩家贷款承接时从出借方可用资金原子转移本金到借款方，并锁定借款方抵押工厂；抵押工厂继续生产，但不得出售、拍卖、银行抵押、重复借贷抵押或出租。到期优先按自动还款设置从可用资金结清本金和固定利息；宽限结束仍不足时只确认借款方违约，并按当时审慎价格的 80% 锁定处置单价与“足以覆盖欠款的最少抵押数量”快照，不得立即转移工厂。抵押在等待期间继续锁定且不得通过迟到还款恢复合同；只有出借方主动执行“解除合同并处置抵押”时才按已锁快照转移对应数量并结束合同。未偿本金在最终处置前继续分别计入出借方合同应收和借款方合同负债，未支付利息不提前计入净资产。'
text = replace_once(text, old, new, 'server player loan default lifecycle')
text = replace_once(text, '欠租时使用权立即暂停并进入宽限；当前服务器时间前已经完成的生产周期先结算，合同变化不得回滚产量。每期租金和玩家贷款利息分别按累计口径收取 1% 服务费。', '欠租时使用权立即暂停并进入宽限；当前服务器时间前已经完成的生产周期先结算，合同变化不得回滚产量。宽限结束仍欠租时只确认承租方违约：未使用租金与出租方保证金立即退回，租赁使用权和出租方资产锁定立即解除，承租方保证金继续冻结；只有出租方主动执行“解除合同并领取违约金”后才划转该保证金并结束合同。每期租金和玩家贷款利息分别按累计口径收取 1% 服务费。', 'server lease default lifecycle')
write(path, text)

print('contract default claim patch applied')
