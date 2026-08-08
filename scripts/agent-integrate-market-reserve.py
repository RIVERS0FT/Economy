from pathlib import Path


def replace_once(path, old, new):
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}: {old[:100]!r}')
    target.write_text(source.replace(old, new, 1), encoding='utf-8')


def replace_function(path, name, new_body):
    target = Path(path)
    source = target.read_text(encoding='utf-8')
    start = source.find(f'function {name}(')
    if start < 0:
        raise SystemExit(f'{path}: function {name} not found')
    next_start = source.find('\nfunction ', start + 1)
    if next_start < 0:
        raise SystemExit(f'{path}: next function after {name} not found')
    target.write_text(source[:start] + new_body.rstrip() + '\n' + source[next_start:], encoding='utf-8')


# Preserve PR #502's hot-path checks while adding reserve-specific verification.
replace_once(
    'package.json',
    'node scripts/verify-staple-crops-demand.mjs && node --experimental-strip-types scripts/verify-market-assets.mjs',
    'node scripts/verify-staple-crops-demand.mjs && node scripts/verify-market-reserve-operations.mjs && node --experimental-strip-types scripts/verify-market-assets.mjs',
)

# Integrate reserve operations into PR #502's deadline-domain scheduler.
replace_once(
    'server/src/runtime-store.js',
    "import { createEconomicCalendarClientState } from './economic-events.js';",
    "import { createEconomicCalendarClientState } from './economic-events.js';\nimport { processMarketReserveOperations } from './market-reserve-operations.js';",
)
replace_once(
    'server/src/runtime-store.js',
    "      if (processed) {\n        processProductionContracts(world, now);",
    "      if (processed) {\n        processMarketReserveOperations(world, now);\n        processProductionContracts(world, now);",
)
replace_once(
    'server/src/runtime-store.js',
    "      if (dueDomains.has('bank')) {",
    "      if (dueDomains.has('market')) {\n        const beforeReserveContracts = contractSnapshot(world);\n        processMarketReserveOperations(world, now);\n        this.captureContractAuditTransition(beforeReserveContracts, world, {\n          triggerType: options.auditTrigger || (currentUserId === undefined ? 'scheduler' : 'request_world_process'),\n          now,\n        });\n      }\n      if (dueDomains.has('bank')) {",
)

# Reserve contract audit must use system accounts, never a fake player 0.
audit = Path('server/src/contract-audit-store.js')
audit_source = audit.read_text(encoding='utf-8')
accepted_anchor = 'function acceptedTransfers(contract) {'
if 'function isMarketReserveContract(contract)' not in audit_source:
    if accepted_anchor not in audit_source:
        raise SystemExit('contract audit acceptedTransfers anchor unavailable')
    audit_source = audit_source.replace(
        accepted_anchor,
        "function isMarketReserveContract(contract) {\n  return contract?.publisherType === 'market_reserve';\n}\n\n" + accepted_anchor,
        1,
    )
    audit.write_text(audit_source, encoding='utf-8')

replace_once(
    'server/src/contract-audit-store.js',
    "    if (contract?.status !== 'active' || contract.buyerId === null || contract.buyerId === undefined) continue;",
    "    if (contract?.status !== 'active' || contract.publisherType === 'market_reserve' || contract.buyerId === null || contract.buyerId === undefined) continue;",
)

replace_function('server/src/contract-audit-store.js', 'acceptedTransfers', '''function acceptedTransfers(contract) {
  const reserveBuyer = isMarketReserveContract(contract);
  const buyerType = reserveBuyer ? 'system' : 'player';
  const buyerId = reserveBuyer ? null : contract.buyerId;
  const availableAccount = reserveBuyer ? 'market_reserve_available' : 'available';
  const escrowAccount = reserveBuyer ? 'market_reserve_contract_escrow' : 'contract_escrow';
  const bondAccount = reserveBuyer ? 'market_reserve_contract_bond' : 'contract_bond';
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: contract.batchGross, fromType: buyerType, fromId: buyerId, fromAccount: availableAccount, toType: buyerType, toId: buyerId, toAccount: escrowAccount, purpose: 'first_batch_funding' }),
    transfer({ assetType: 'credits', quantity: contract.buyerBondCredits, fromType: buyerType, fromId: buyerId, fromAccount: availableAccount, toType: buyerType, toId: buyerId, toAccount: bondAccount, purpose: 'buyer_bond' }),
    transfer({ assetType: 'credits', quantity: contract.supplierBondCredits, fromType: 'player', fromId: contract.supplierId, fromAccount: 'available', toType: 'player', toId: contract.supplierId, toAccount: 'contract_bond', purpose: 'supplier_bond' }),
    transfer({ assetType: 'commodity', productId: contract.productId, quantity: contract.supplierReservedQuantity, fromType: 'player', fromId: contract.supplierId, fromAccount: 'inventory_available', toType: 'player', toId: contract.supplierId, toAccount: 'contract_goods_escrow', purpose: 'first_batch_goods' }),
  ]);
}''')

replace_function('server/src/contract-audit-store.js', 'deliveryTransfers', '''function deliveryTransfers(before, after) {
  const gross = safeMoney(after.lastDeliveryGross, 0) || safeMoney(after.batchGross, 0);
  const feeDelta = Math.max(0, roundInternalMoney(safeMoney(after.marketSellFeeCharged, 0) - safeMoney(before.marketSellFeeCharged, 0)) || 0);
  const fee = safeMoney(after.lastDeliveryFee, 0) || feeDelta;
  const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
  const reserveBuyer = isMarketReserveContract(after);
  const buyerType = reserveBuyer ? 'system' : 'player';
  const buyerId = reserveBuyer ? null : after.buyerId;
  const escrowAccount = reserveBuyer ? 'market_reserve_contract_escrow' : 'contract_escrow';
  return compactTransfers([
    transfer({ assetType: 'commodity', productId: after.productId, quantity: after.quantityPerDelivery, fromType: 'player', fromId: after.supplierId, fromAccount: 'contract_goods_escrow', toType: reserveBuyer ? 'system' : 'player', toId: reserveBuyer ? null : after.buyerId, toAccount: reserveBuyer ? 'market_reserve_inventory' : 'inventory_available', purpose: 'delivery_goods' }),
    transfer({ assetType: 'credits', quantity: net, fromType: buyerType, fromId: buyerId, fromAccount: escrowAccount, toType: 'player', toId: after.supplierId, toAccount: 'available', purpose: 'delivery_net_payment' }),
    transfer({ assetType: 'credits', quantity: fee, fromType: buyerType, fromId: buyerId, fromAccount: escrowAccount, toType: 'system', toAccount: 'population_market_service', purpose: 'market_service_fee' }),
  ]);
}''')

replace_function('server/src/contract-audit-store.js', 'completionTransfers', '''function completionTransfers(before) {
  const reserveBuyer = isMarketReserveContract(before);
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: before.buyerBondCredits, fromType: reserveBuyer ? 'system' : 'player', fromId: reserveBuyer ? null : before.buyerId, fromAccount: reserveBuyer ? 'market_reserve_contract_bond' : 'contract_bond', toType: reserveBuyer ? 'system' : 'player', toId: reserveBuyer ? null : before.buyerId, toAccount: reserveBuyer ? 'market_reserve_available' : 'available', purpose: 'buyer_bond_release' }),
    transfer({ assetType: 'credits', quantity: before.supplierBondCredits, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'supplier_bond_release' }),
  ]);
}''')

replace_function('server/src/contract-audit-store.js', 'terminationTransfers', '''function terminationTransfers(before, after, actorUserId, completedDelta) {
  const deliveredGross = multiplyMoneyByInteger(before.batchGross, Math.max(0, completedDelta)) || 0;
  const deliveredGoods = Math.max(0, completedDelta) * before.quantityPerDelivery;
  const escrow = Math.max(0, roundInternalMoney(before.buyerEscrowCredits - deliveredGross) || 0);
  const goods = Math.max(0, before.supplierReservedQuantity - deliveredGoods);
  const reserveBuyer = isMarketReserveContract(before);
  const buyerType = reserveBuyer ? 'system' : 'player';
  const buyerId = reserveBuyer ? null : before.buyerId;
  const availableAccount = reserveBuyer ? 'market_reserve_available' : 'available';
  const escrowAccount = reserveBuyer ? 'market_reserve_contract_escrow' : 'contract_escrow';
  const bondAccount = reserveBuyer ? 'market_reserve_contract_bond' : 'contract_bond';
  const commonReleases = {
    buyerEscrowRelease: transfer({ assetType: 'credits', quantity: escrow, fromType: buyerType, fromId: buyerId, fromAccount: escrowAccount, toType: buyerType, toId: buyerId, toAccount: availableAccount, purpose: 'unused_escrow_release' }),
    goodsRelease: transfer({ assetType: 'commodity', productId: before.productId, quantity: goods, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_goods_escrow', toType: 'player', toId: before.supplierId, toAccount: 'inventory_available', purpose: 'unused_goods_release' }),
  };
  const reason = after.terminationReason;
  let defaultParty = null;
  if (reason === 'buyer_default') defaultParty = 'buyer';
  if (reason === 'supplier_default') defaultParty = 'supplier';
  if (reason === 'both_default') defaultParty = 'both';
  if (reason === 'immediate_by_participant') {
    defaultParty = Number(actorUserId) === Number(before.buyerId) && !reserveBuyer ? 'buyer' : 'supplier';
  }
  if (reason === 'notice_completed') {
    return compactTransfers([
      commonReleases.buyerEscrowRelease,
      commonReleases.goodsRelease,
      ...completionTransfers(before),
    ]);
  }
  if (defaultParty === 'buyer') {
    return compactTransfers([
      commonReleases.buyerEscrowRelease,
      commonReleases.goodsRelease,
      transfer({ assetType: 'credits', quantity: before.buyerBondCredits, fromType: buyerType, fromId: buyerId, fromAccount: bondAccount, toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'bond_compensation' }),
      transfer({ assetType: 'credits', quantity: before.supplierBondCredits, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'supplier_bond_release' }),
    ]);
  }
  if (defaultParty === 'supplier') {
    return compactTransfers([
      commonReleases.buyerEscrowRelease,
      commonReleases.goodsRelease,
      transfer({ assetType: 'credits', quantity: before.buyerBondCredits, fromType: buyerType, fromId: buyerId, fromAccount: bondAccount, toType: buyerType, toId: buyerId, toAccount: availableAccount, purpose: 'buyer_bond_release' }),
      transfer({ assetType: 'credits', quantity: before.supplierBondCredits, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: buyerType, toId: buyerId, toAccount: availableAccount, purpose: 'bond_compensation' }),
    ]);
  }
  if (defaultParty === 'both') {
    return compactTransfers([
      commonReleases.buyerEscrowRelease,
      commonReleases.goodsRelease,
      ...completionTransfers(before),
    ]);
  }
  return [];
}''')

# Keep one authoritative conservation formula instead of two competing current rules.
full_formula = """```text
当前储备库存 = 一次性种子库存 + 订单簿买入数量 + 储备采购合同交付数量 - 普通储备卖出数量 - 紧急储备卖出数量 - 储备拍卖成交数量
当前储备资金 = 一次性种子资金 + 普通／紧急储备卖出收入 + 储备拍卖净收入 - 订单簿买入支出 - 储备采购合同货款 - 储备拍卖发布费 - 储备拍卖卖方手续费
```"""
replace_once(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    """```text
当前储备库存 = 一次性种子库存 + 流动性买入数量 - 流动性卖出数量
当前储备资金 = 一次性种子资金 + 流动性卖出收入 - 流动性买入支出
```""",
    full_formula,
)
replace_once(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    "\n扩展后的守恒关系为：\n\n" + full_formula + "\n",
    "\n",
)
replace_once(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    '价格观察中玩家之间和玩家与消费需求的成交使用 100% 权重，玩家与市场储备的成交使用 50% 权重；',
    '价格观察中玩家之间和玩家与消费需求的成交使用 100% 权重，玩家与普通市场储备的成交使用 50% 权重，玩家与紧急储备卖单的成交使用 25% 权重；',
)
replace_once(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    "demandTier?: 'direct' | 'derived-liquidity' | 'liquidity-buy' | 'liquidity-sell';",
    "demandTier?: 'direct' | 'derived-liquidity' | 'liquidity-buy' | 'liquidity-sell' | 'liquidity-emergency-sell';",
)
replace_once(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    "`demandTier = 'direct' | 'derived-liquidity' | 'liquidity-buy' | 'liquidity-sell'`；",
    "`demandTier = 'direct' | 'derived-liquidity' | 'liquidity-buy' | 'liquidity-sell' | 'liquidity-emergency-sell'`；",
)

verify = Path('scripts/verify-market-reserve-operations.mjs')
verify_source = verify.read_text(encoding='utf-8')
anchor = "requireText('server/src/runtime-store.js', 'processMarketReserveOperations(world, now)');\n"
addition = "for (const text of ['isMarketReserveContract', 'market_reserve_contract_escrow', 'market_reserve_contract_bond', 'market_reserve_inventory', \"publisherType: contract.publisherType === 'market_reserve'\"]) requireText('server/src/contract-audit-store.js', text);\n"
if addition not in verify_source:
    if anchor not in verify_source:
        raise SystemExit('market reserve verifier audit anchor unavailable')
    verify_source = verify_source.replace(anchor, anchor + addition, 1)
verify.write_text(verify_source, encoding='utf-8')

print('latest-main market reserve integration corrections applied')
