from pathlib import Path
import re


def replace(path, old, new, label):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing {label}')
    p.write_text(text.replace(old, new, 1))


def sub(path, pattern, replacement, label):
    p = Path(path)
    text = p.read_text()
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'missing {label}')
    p.write_text(next_text)

p = Path('server/src/contract-audit-store.js')
text = p.read_text()
old = """    supplierId: nullableInteger(contract.supplierId),
    supplierName: optionalPlayerDisplayName(world, contract.supplierId),
    productId: String(contract.productId || ''),
    quantityPerDelivery: Math.max(0, safeInteger(contract.quantityPerDelivery, 0)),
"""
new = """    supplierId: nullableInteger(contract.supplierId),
    supplierName: optionalPlayerDisplayName(world, contract.supplierId),
    provinceId: contract.provinceId ? String(contract.provinceId) : null,
    productId: String(contract.productId || ''),
    supplyMode: contract.supplyMode === 'daily' ? 'daily' : null,
    contractSchemaVersion: Math.max(0, safeInteger(contract.contractSchemaVersion, 0)),
    dailyMaxQuantity: contract.supplyMode === 'daily' ? Math.max(0, safeInteger(contract.dailyMaxQuantity, 0)) : null,
    dailyUsedQuantity: contract.supplyMode === 'daily' ? Math.max(0, safeInteger(contract.dailyUsedQuantity, 0)) : null,
    dailyRemainingQuantity: contract.supplyMode === 'daily' ? Math.max(0, safeInteger(contract.dailyRemainingQuantity, 0)) : null,
    dailyGrossLimit: contract.supplyMode === 'daily' ? safeMoney(contract.dailyGrossLimit, 0) : null,
    totalDeliveredQuantity: contract.supplyMode === 'daily' ? Math.max(0, safeInteger(contract.totalDeliveredQuantity, 0)) : null,
    completedDeliveryEvents: contract.supplyMode === 'daily' ? Math.max(0, safeInteger(contract.completedDeliveryEvents, 0)) : null,
    durationDays: contract.supplyMode === 'daily'
      ? (contract.durationDays === null ? null : Math.max(0, safeInteger(contract.durationDays, 0)))
      : null,
    startDelayDays: contract.supplyMode === 'daily' ? Math.max(0, safeInteger(contract.startDelayDays, 0)) : null,
    startsAt: contract.supplyMode === 'daily' ? nullableInteger(contract.startsAt) : null,
    endsAt: contract.supplyMode === 'daily' ? nullableInteger(contract.endsAt) : null,
    prioritySupply: contract.supplyMode === 'daily' && contract.prioritySupply ? clone(contract.prioritySupply) : null,
    quantityPerDelivery: Math.max(0, safeInteger(contract.quantityPerDelivery, 0)),
"""
if old not in text:
    raise SystemExit('missing audit snapshot supply anchor')
text = text.replace(old, new, 1)
text = text.replace(
    "    lastDeliveryAt: nullableInteger(contract.lastDeliveryAt),\n    lastDeliveryGross: safeMoney(contract.lastDeliveryGross, 0),",
    "    lastDeliveryAt: nullableInteger(contract.lastDeliveryAt),\n    lastDeliveryQuantity: Math.max(0, safeInteger(contract.lastDeliveryQuantity, 0)),\n    lastDeliveryGross: safeMoney(contract.lastDeliveryGross, 0),",
    1,
)
# provinceId is now stored once with the supply identity.
text = text.replace("    provinceId: contract.provinceId ? String(contract.provinceId) : null,\n    facilityTypeId:", "    facilityTypeId:", 1)
# Daily contracts do not reserve a fictitious next batch of warehouse capacity.
text = text.replace(
    "  for (const contract of world.productionContracts || []) {\n    if (contract?.status !== 'active' || contract.breachedAt || contract.publisherType === 'market_reserve' || contract.buyerId === null || contract.buyerId === undefined) continue;",
    "  for (const contract of world.productionContracts || []) {\n    if (contract?.supplyMode === 'daily') continue;\n    if (contract?.status !== 'active' || contract.breachedAt || contract.publisherType === 'market_reserve' || contract.buyerId === null || contract.buyerId === undefined) continue;",
    1,
)
# Delivery event metadata records the real partial daily quantity as well as money.
text = text.replace(
    "            deliveredAt: after.lastDeliveryAt || normalizedContext.occurredAt,\n            gross: after.lastDeliveryGross || after.batchGross,",
    "            deliveredAt: after.lastDeliveryAt || normalizedContext.occurredAt,\n            quantity: after.lastDeliveryQuantity || after.quantityPerDelivery,\n            gross: after.lastDeliveryGross || after.batchGross,",
    1,
)
# Summary transferred goods must use the cumulative daily quantity, not event-count × last partial quantity.
old_transfer = "        Math.max(0, after.completedDeliveries * after.quantityPerDelivery),\n        storedMoney(compensationDelta),"
new_transfer = "        after.supplyMode === 'daily'\n          ? Math.max(0, safeInteger(after.totalDeliveredQuantity, 0))\n          : Math.max(0, after.completedDeliveries * after.quantityPerDelivery),\n        storedMoney(compensationDelta),"
if old_transfer not in text:
    raise SystemExit('missing transferred goods summary anchor')
text = text.replace(old_transfer, new_transfer, 1)
p.write_text(text)

# Daily history completion is factual delivered quantity, with no invented target or ratio.
sub(
    'server/src/contract-audit-store.js',
    r"function historyCompletion\(contract\) \{\n  if \(contract\.kind === 'loan'\) \{.*?\n\}\n\nfunction publicHistoryRow",
    """function historyCompletion(contract) {
  if (contract.kind === 'loan') {
    const completed = contract.status === 'completed' ? 1 : 0;
    return { completed, total: 1, unit: 'repayment', ratioBps: completed ? 10_000 : 0 };
  }
  if (contract.kind === 'supply' && contract.supplyMode === 'daily') {
    return {
      completed: Math.max(0, safeInteger(contract.totalDeliveredQuantity, 0)),
      total: null,
      unit: 'quantity',
      ratioBps: null,
    };
  }
  const completed = contract.kind === 'facility_lease'
    ? Math.max(0, safeInteger(contract.completedPeriods ?? contract.completedDeliveries, 0))
    : Math.max(0, safeInteger(contract.completedDeliveries, 0));
  const total = contract.kind === 'facility_lease'
    ? Math.max(0, safeInteger(contract.totalPeriods ?? contract.totalDeliveries, 0))
    : contract.totalDeliveries === null
      ? null
      : Math.max(0, safeInteger(contract.totalDeliveries, 0));
  return {
    completed,
    total,
    unit: contract.kind === 'facility_lease' ? 'lease_period' : 'delivery',
    ratioBps: total === null
      ? null
      : total > 0 ? Math.min(10_000, Math.floor(completed * 10_000 / total)) : 0,
  };
}

function publicHistoryRow""",
    'history completion function',
)

# Client types and legacy renderer understand factual quantity completion.
replace(
    'src/contracts/types.ts',
    "export type ContractCompletionUnit = 'delivery' | 'repayment' | 'lease_period';",
    "export type ContractCompletionUnit = 'delivery' | 'quantity' | 'repayment' | 'lease_period';",
    'completion unit type',
)
replace(
    'src/contracts/types.ts',
    "  completedDeliveryEvents?: number;\n  durationDays?: number | null;",
    "  completedDeliveryEvents?: number;\n  lastDeliveryQuantity?: number;\n  durationDays?: number | null;",
    'last delivery quantity type',
)
replace(
    'src/pages/ContractPage.tsx',
    "  if (unit === 'lease_period') return '期';\n  return '批';",
    "  if (unit === 'lease_period') return '期';\n  if (unit === 'quantity') return '个';\n  return '批';",
    'legacy completion unit label',
)

# Dedicated verifier locks audit-specific daily facts.
p = Path('scripts/verify-daily-supply-contracts.mjs')
text = p.read_text()
if "const audit = read('server/src/contract-audit-store.js');" not in text:
    text = text.replace("const unified = read('server/src/unified-contracts.js');", "const unified = read('server/src/unified-contracts.js');\nconst audit = read('server/src/contract-audit-store.js');", 1)
anchor = "requireText(runtime, 'return executeRuntimeAction(this, user, requestMeta, now);', '无到期生产输入需求的普通动作必须保留既有单事务 fast path。');"
addition = """requireText(audit, "supplyMode: contract.supplyMode === 'daily' ? 'daily' : null", '每日合同审计快照必须保留 daily 模式。');
requireText(audit, "totalDeliveredQuantity: contract.supplyMode === 'daily'", '每日合同审计快照必须保留累计真实交付数量。');
requireText(audit, "unit: 'quantity'", '每日合同历史完成事实必须按实际交付数量表达。');
requireText(audit, "if (contract?.supplyMode === 'daily') continue;", '每日合同不得进入旧下一批仓库预占审计计算。');
"""
if addition.strip() not in text:
    if anchor not in text:
        raise SystemExit('missing daily verifier audit anchor')
    text = text.replace(anchor, anchor + '\n' + addition, 1)
p.write_text(text)
