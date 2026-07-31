import { createHash } from 'node:crypto';
import { internalMoneyToMicros, microsToInternalMoney, multiplyMoneyByInteger, roundInternalMoney } from './money.js';

const CONTRACT_AUDIT_BUFFER = Symbol('economy.contractAuditBuffer');
const DEFAULT_HISTORY_LIMIT = 20;
const DEFAULT_EVENT_LIMIT = 50;
const MAX_QUERY_LIMIT = 100;
const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'terminated', 'expired']);
const CONTRACT_STATUSES = new Set(['open', 'active', ...TERMINAL_STATUSES]);
const HISTORY_ROLES = new Set(['any', 'publisher', 'buyer', 'supplier']);
const CONTRACT_AUDIT_MONEY_PRECISION_VERSION = 2;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function safeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : fallback;
}

function nullableInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : null;
}

function safeMoney(value, fallback = 0) {
  const normalized = roundInternalMoney(value);
  return normalized !== null && normalized >= 0 ? normalized : fallback;
}

function storedMoney(value) {
  const micros = internalMoneyToMicros(safeMoney(value));
  if (micros === null || micros > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('合同审计金额超出系统可表示范围');
  return Number(micros);
}

function restoredMoney(value, precisionVersion = CONTRACT_AUDIT_MONEY_PRECISION_VERSION) {
  if (Number(precisionVersion || 0) < CONTRACT_AUDIT_MONEY_PRECISION_VERSION) return safeMoney(value);
  try {
    return microsToInternalMoney(BigInt(value)) || 0;
  } catch {
    return 0;
  }
}

function tableColumns(database, tableName) {
  return new Set(database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String(row.name)));
}

function batchGross(contract) {
  const explicit = safeMoney(contract?.batchGross, 0);
  if (explicit > 0) return explicit;
  return multiplyMoneyByInteger(
    safeMoney(contract?.unitPrice, 0),
    Math.max(0, safeInteger(contract?.quantityPerDelivery, 0)),
  ) || 0;
}

function contractSnapshot(contract) {
  if (!contract) return null;
  return {
    id: String(contract.id || ''),
    publisherId: nullableInteger(contract.publisherId),
    publisherName: String(contract.publisherName || '玩家'),
    publisherRole: contract.publisherRole === 'supplier' ? 'supplier' : 'buyer',
    buyerId: nullableInteger(contract.buyerId),
    buyerName: contract.buyerName ? String(contract.buyerName) : null,
    supplierId: nullableInteger(contract.supplierId),
    supplierName: contract.supplierName ? String(contract.supplierName) : null,
    productId: String(contract.productId || ''),
    quantityPerDelivery: Math.max(0, safeInteger(contract.quantityPerDelivery, 0)),
    unitPrice: safeMoney(contract.unitPrice, 0),
    batchGross: batchGross(contract),
    deliveryIntervalMs: Math.max(0, safeInteger(contract.deliveryIntervalMs, 0)),
    totalDeliveries: Math.max(0, safeInteger(contract.totalDeliveries, 0)),
    completedDeliveries: Math.max(0, safeInteger(contract.completedDeliveries, 0)),
    firstDeliveryDelayMs: Math.max(0, safeInteger(contract.firstDeliveryDelayMs, 0)),
    createdAt: Math.max(0, safeInteger(contract.createdAt, 0)),
    offerExpiresAt: Math.max(0, safeInteger(contract.offerExpiresAt, 0)),
    acceptedAt: nullableInteger(contract.acceptedAt),
    nextDueAt: nullableInteger(contract.nextDueAt),
    graceEndsAt: nullableInteger(contract.graceEndsAt),
    endedAt: nullableInteger(contract.endedAt),
    completedAt: nullableInteger(contract.completedAt),
    lastDeliveryAt: nullableInteger(contract.lastDeliveryAt),
    lastDeliveryGross: safeMoney(contract.lastDeliveryGross, 0),
    lastDeliveryFee: safeMoney(contract.lastDeliveryFee, 0),
    buyerEscrowCredits: safeMoney(contract.buyerEscrowCredits, 0),
    supplierReservedQuantity: Math.max(0, safeInteger(contract.supplierReservedQuantity, 0)),
    buyerBondCredits: safeMoney(contract.buyerBondCredits, 0),
    supplierBondCredits: safeMoney(contract.supplierBondCredits, 0),
    buyerAutoFund: contract.buyerAutoFund !== false,
    supplierAutoReserve: contract.supplierAutoReserve !== false,
    marketSellFeeGross: safeMoney(contract.marketSellFeeGross, 0),
    marketSellFeeCharged: safeMoney(contract.marketSellFeeCharged, 0),
    status: CONTRACT_STATUSES.has(contract.status) ? contract.status : 'open',
    roundStatus: ['preparing', 'ready', 'grace'].includes(contract.roundStatus) ? contract.roundStatus : 'preparing',
    terminationRequestedBy: nullableInteger(contract.terminationRequestedBy),
    terminationRequestedAt: nullableInteger(contract.terminationRequestedAt),
    terminationReason: contract.terminationReason ? String(contract.terminationReason) : null,
    renewalProposal: contract.renewalProposal ? clone(contract.renewalProposal) : null,
    renewedFromContractId: contract.renewedFromContractId ? String(contract.renewedFromContractId) : null,
    renewedToContractId: contract.renewedToContractId ? String(contract.renewedToContractId) : null,
    renewalCancellationReason: contract.renewalCancellationReason ? String(contract.renewalCancellationReason) : null,
  };
}

function inventoryStored(player) {
  return Object.values(player?.inventories || {}).reduce((sum, inventory) => (
    sum + Math.max(0, safeInteger(inventory?.available, 0)) + Math.max(0, safeInteger(inventory?.frozen, 0))
  ), 0);
}

function reservedIncomingByBuyer(world) {
  const reserved = new Map();
  for (const contract of world.productionContracts || []) {
    if (contract?.status !== 'active' || contract.buyerId === null || contract.buyerId === undefined) continue;
    const buyerId = Number(contract.buyerId);
    const renewalQuantity = contract.renewalProposal?.status === 'accepted'
      ? Math.max(0, safeInteger(contract.renewalProposal?.terms?.quantityPerDelivery, 0))
      : 0;
    reserved.set(buyerId, (reserved.get(buyerId) || 0) + Math.max(0, safeInteger(contract.quantityPerDelivery, 0)) + renewalQuantity);
  }
  return reserved;
}

function graceReasonCode(world, contract, incomingByBuyer) {
  const reasons = [];
  const gross = batchGross(contract);
  if (safeInteger(contract.supplierReservedQuantity, 0) < safeInteger(contract.quantityPerDelivery, 0)) {
    reasons.push('supplier_goods');
  }
  if (safeMoney(contract.buyerEscrowCredits, 0) < gross) reasons.push('buyer_funds');
  const buyer = world.players?.[String(contract.buyerId)];
  if (!buyer) {
    reasons.push('participant_missing');
  } else {
    const capacity = Math.max(0, safeInteger(buyer.inventoryCapacity, 0));
    const used = inventoryStored(buyer) + Math.max(0, safeInteger(incomingByBuyer.get(Number(contract.buyerId)), 0));
    if (used > capacity) reasons.push('buyer_warehouse');
  }
  return reasons.length > 0 ? reasons.join('+') : 'unknown';
}

function transfer({
  assetType,
  productId = null,
  quantity,
  fromType,
  fromId = null,
  fromAccount,
  toType,
  toId = null,
  toAccount,
  purpose,
}) {
  const normalizedQuantity = assetType === 'credits'
    ? safeMoney(quantity, 0)
    : Math.max(0, safeInteger(quantity, 0));
  if (normalizedQuantity <= 0) return null;
  return {
    assetType,
    productId,
    quantity: normalizedQuantity,
    fromType,
    fromId: nullableInteger(fromId),
    fromAccount,
    toType,
    toId: nullableInteger(toId),
    toAccount,
    purpose,
  };
}

function compactTransfers(values) {
  return values.filter(Boolean);
}

function hashText(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function requestKeyHash(requestKey) {
  return requestKey ? hashText(requestKey).slice(0, 24) : null;
}

function queueEvent(world, event) {
  const buffer = world[CONTRACT_AUDIT_BUFFER] || [];
  if (!world[CONTRACT_AUDIT_BUFFER]) {
    Object.defineProperty(world, CONTRACT_AUDIT_BUFFER, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: buffer,
    });
  }
  const stableIdentity = {
    contractId: event.contractId,
    eventType: event.eventType,
    actorType: event.actorType,
    actorUserId: event.actorUserId,
    triggerType: event.triggerType,
    action: event.action,
    batchNumber: event.batchNumber,
    reasonCode: event.reasonCode,
    occurredAt: event.occurredAt,
    requestKeyHash: event.requestKeyHash,
    after: event.after,
  };
  buffer.push({
    ...event,
    sourceKey: event.sourceKey || `contract-audit:${hashText(JSON.stringify(stableIdentity))}`,
  });
}

function drainEvents(world) {
  const events = Array.isArray(world?.[CONTRACT_AUDIT_BUFFER]) ? world[CONTRACT_AUDIT_BUFFER] : [];
  if (world && world[CONTRACT_AUDIT_BUFFER]) delete world[CONTRACT_AUDIT_BUFFER];
  return events;
}

function eventContext(context = {}) {
  const actorUserId = nullableInteger(context.actorUserId);
  return {
    actorType: actorUserId === null ? 'system' : 'player',
    actorUserId,
    triggerType: String(context.triggerType || (actorUserId === null ? 'world_process' : 'player_action')),
    action: context.action ? String(context.action) : null,
    occurredAt: Math.max(0, safeInteger(context.occurredAt ?? context.now, Date.now())),
    requestKeyHash: context.requestKeyHash ? String(context.requestKeyHash) : requestKeyHash(context.requestKey),
  };
}

function queueTransitionEvent(world, context, contract, eventType, {
  before = null,
  after = contract,
  batchNumber = null,
  reasonCode = null,
  transfers = [],
  metadata = {},
  completeness = 'full',
  sourceKey = null,
} = {}) {
  const normalizedContext = eventContext(context);
  const afterSnapshot = contractSnapshot(after);
  queueEvent(world, {
    contractId: String(contract?.id || afterSnapshot?.id || before?.id || ''),
    eventType,
    ...normalizedContext,
    batchNumber: batchNumber === null ? null : Math.max(0, safeInteger(batchNumber, 0)),
    reasonCode,
    before: contractSnapshot(before),
    after: afterSnapshot,
    transfers: compactTransfers(transfers),
    metadata: clone(metadata) || {},
    completeness,
    sourceKey,
  });
}

function acceptedTransfers(contract) {
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: contract.batchGross, fromType: 'player', fromId: contract.buyerId, fromAccount: 'available', toType: 'player', toId: contract.buyerId, toAccount: 'contract_escrow', purpose: 'first_batch_funding' }),
    transfer({ assetType: 'credits', quantity: contract.buyerBondCredits, fromType: 'player', fromId: contract.buyerId, fromAccount: 'available', toType: 'player', toId: contract.buyerId, toAccount: 'contract_bond', purpose: 'buyer_bond' }),
    transfer({ assetType: 'credits', quantity: contract.supplierBondCredits, fromType: 'player', fromId: contract.supplierId, fromAccount: 'available', toType: 'player', toId: contract.supplierId, toAccount: 'contract_bond', purpose: 'supplier_bond' }),
    transfer({ assetType: 'commodity', productId: contract.productId, quantity: contract.supplierReservedQuantity, fromType: 'player', fromId: contract.supplierId, fromAccount: 'inventory_available', toType: 'player', toId: contract.supplierId, toAccount: 'contract_goods_escrow', purpose: 'first_batch_goods' }),
  ]);
}

function renewalAcceptedTransfers(contract) {
  const proposal = contract.renewalProposal;
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: proposal?.buyerEscrowCredits, fromType: 'player', fromId: contract.buyerId, fromAccount: 'available', toType: 'player', toId: contract.buyerId, toAccount: 'renewal_escrow', purpose: 'renewal_first_batch_funding' }),
    transfer({ assetType: 'credits', quantity: proposal?.buyerBondCredits, fromType: 'player', fromId: contract.buyerId, fromAccount: 'available', toType: 'player', toId: contract.buyerId, toAccount: 'renewal_bond', purpose: 'renewal_buyer_bond' }),
    transfer({ assetType: 'credits', quantity: proposal?.supplierBondCredits, fromType: 'player', fromId: contract.supplierId, fromAccount: 'available', toType: 'player', toId: contract.supplierId, toAccount: 'renewal_bond', purpose: 'renewal_supplier_bond' }),
    transfer({ assetType: 'commodity', productId: contract.productId, quantity: proposal?.supplierReservedQuantity, fromType: 'player', fromId: contract.supplierId, fromAccount: 'inventory_available', toType: 'player', toId: contract.supplierId, toAccount: 'renewal_goods_escrow', purpose: 'renewal_first_batch_goods' }),
  ]);
}

function renewalReleaseTransfers(contract, proposal) {
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: proposal?.buyerEscrowCredits, fromType: 'player', fromId: contract.buyerId, fromAccount: 'renewal_escrow', toType: 'player', toId: contract.buyerId, toAccount: 'available', purpose: 'renewal_escrow_release' }),
    transfer({ assetType: 'credits', quantity: proposal?.buyerBondCredits, fromType: 'player', fromId: contract.buyerId, fromAccount: 'renewal_bond', toType: 'player', toId: contract.buyerId, toAccount: 'available', purpose: 'renewal_escrow_release' }),
    transfer({ assetType: 'credits', quantity: proposal?.supplierBondCredits, fromType: 'player', fromId: contract.supplierId, fromAccount: 'renewal_bond', toType: 'player', toId: contract.supplierId, toAccount: 'available', purpose: 'renewal_escrow_release' }),
    transfer({ assetType: 'commodity', productId: contract.productId, quantity: proposal?.supplierReservedQuantity, fromType: 'player', fromId: contract.supplierId, fromAccount: 'renewal_goods_escrow', toType: 'player', toId: contract.supplierId, toAccount: 'inventory_available', purpose: 'renewal_escrow_release' }),
  ]);
}

function deliveryTransfers(before, after) {
  const gross = safeMoney(after.lastDeliveryGross, 0) || safeMoney(after.batchGross, 0);
  const feeDelta = Math.max(0, roundInternalMoney(safeMoney(after.marketSellFeeCharged, 0) - safeMoney(before.marketSellFeeCharged, 0)) || 0);
  const fee = safeMoney(after.lastDeliveryFee, 0) || feeDelta;
  const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
  return compactTransfers([
    transfer({ assetType: 'commodity', productId: after.productId, quantity: after.quantityPerDelivery, fromType: 'player', fromId: after.supplierId, fromAccount: 'contract_goods_escrow', toType: 'player', toId: after.buyerId, toAccount: 'inventory_available', purpose: 'delivery_goods' }),
    transfer({ assetType: 'credits', quantity: net, fromType: 'player', fromId: after.buyerId, fromAccount: 'contract_escrow', toType: 'player', toId: after.supplierId, toAccount: 'available', purpose: 'delivery_net_payment' }),
    transfer({ assetType: 'credits', quantity: fee, fromType: 'player', fromId: after.buyerId, fromAccount: 'contract_escrow', toType: 'system', toAccount: 'population_market_service', purpose: 'market_service_fee' }),
  ]);
}

function completionTransfers(before) {
  return compactTransfers([
    transfer({ assetType: 'credits', quantity: before.buyerBondCredits, fromType: 'player', fromId: before.buyerId, fromAccount: 'contract_bond', toType: 'player', toId: before.buyerId, toAccount: 'available', purpose: 'buyer_bond_release' }),
    transfer({ assetType: 'credits', quantity: before.supplierBondCredits, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'supplier_bond_release' }),
  ]);
}

function terminationTransfers(before, after, actorUserId, completedDelta) {
  const deliveredGross = multiplyMoneyByInteger(before.batchGross, Math.max(0, completedDelta)) || 0;
  const deliveredGoods = Math.max(0, completedDelta) * before.quantityPerDelivery;
  const escrow = Math.max(0, roundInternalMoney(before.buyerEscrowCredits - deliveredGross) || 0);
  const goods = Math.max(0, before.supplierReservedQuantity - deliveredGoods);
  const commonReleases = {
    buyerEscrowRelease: transfer({ assetType: 'credits', quantity: escrow, fromType: 'player', fromId: before.buyerId, fromAccount: 'contract_escrow', toType: 'player', toId: before.buyerId, toAccount: 'available', purpose: 'unused_escrow_release' }),
    goodsRelease: transfer({ assetType: 'commodity', productId: before.productId, quantity: goods, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_goods_escrow', toType: 'player', toId: before.supplierId, toAccount: 'inventory_available', purpose: 'unused_goods_release' }),
  };
  const reason = after.terminationReason;
  let defaultParty = null;
  if (reason === 'buyer_default') defaultParty = 'buyer';
  if (reason === 'supplier_default') defaultParty = 'supplier';
  if (reason === 'both_default') defaultParty = 'both';
  if (reason === 'immediate_by_participant') {
    defaultParty = Number(actorUserId) === Number(before.buyerId) ? 'buyer' : 'supplier';
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
      transfer({ assetType: 'credits', quantity: before.buyerBondCredits, fromType: 'player', fromId: before.buyerId, fromAccount: 'contract_bond', toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'bond_compensation' }),
      transfer({ assetType: 'credits', quantity: before.supplierBondCredits, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: 'player', toId: before.supplierId, toAccount: 'available', purpose: 'supplier_bond_release' }),
    ]);
  }
  if (defaultParty === 'supplier') {
    return compactTransfers([
      commonReleases.buyerEscrowRelease,
      commonReleases.goodsRelease,
      transfer({ assetType: 'credits', quantity: before.buyerBondCredits, fromType: 'player', fromId: before.buyerId, fromAccount: 'contract_bond', toType: 'player', toId: before.buyerId, toAccount: 'available', purpose: 'buyer_bond_release' }),
      transfer({ assetType: 'credits', quantity: before.supplierBondCredits, fromType: 'player', fromId: before.supplierId, fromAccount: 'contract_bond', toType: 'player', toId: before.buyerId, toAccount: 'available', purpose: 'bond_compensation' }),
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
}

function eventTypeForTermination(reason) {
  if (reason === 'notice_completed') return 'contract_terminated_after_batch';
  if (reason === 'immediate_by_participant') return 'contract_terminated_immediate';
  if (String(reason || '').endsWith('_default')) return 'contract_defaulted';
  if (reason === 'participant_missing') return 'contract_terminated_participant_missing';
  return 'contract_terminated';
}

function parseLimit(value, fallback) {
  const normalized = safeInteger(value, fallback);
  return Math.max(1, Math.min(MAX_QUERY_LIMIT, normalized));
}

function encodeCursor(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    return decoded && typeof decoded === 'object' ? decoded : null;
  } catch {
    return null;
  }
}

function visibleHistoryWhere(userId, options) {
  const clauses = ["status NOT IN ('open', 'active')"];
  const values = [];
  const role = HISTORY_ROLES.has(options.role) ? options.role : 'any';
  if (role === 'publisher') {
    clauses.push('publisher_id = ?');
    values.push(userId);
  } else if (role === 'buyer') {
    clauses.push('buyer_id = ?');
    values.push(userId);
  } else if (role === 'supplier') {
    clauses.push('supplier_id = ?');
    values.push(userId);
  } else {
    clauses.push('(publisher_id = ? OR buyer_id = ? OR supplier_id = ?)');
    values.push(userId, userId, userId);
  }
  if (options.status && TERMINAL_STATUSES.has(options.status)) {
    clauses.push('status = ?');
    values.push(options.status);
  }
  if (options.productId) {
    clauses.push('product_id = ?');
    values.push(String(options.productId));
  }
  if (options.from !== null) {
    clauses.push('sort_at >= ?');
    values.push(options.from);
  }
  if (options.to !== null) {
    clauses.push('sort_at <= ?');
    values.push(options.to);
  }
  const cursor = decodeCursor(options.cursor);
  if (cursor && Number.isSafeInteger(cursor.sortAt) && typeof cursor.contractId === 'string') {
    clauses.push('(sort_at < ? OR (sort_at = ? AND contract_id < ?))');
    values.push(cursor.sortAt, cursor.sortAt, cursor.contractId);
  }
  return { clauses, values };
}

function publicHistoryRow(row, userId) {
  const contract = JSON.parse(String(row.contract_json));
  return {
    ...contract,
    auditCompleteness: String(row.audit_completeness),
    lastEventSequence: Number(row.last_event_sequence),
    lastEventAt: Number(row.last_event_at),
    grossTotal: restoredMoney(row.gross_total, row.money_precision_version),
    feeTotal: restoredMoney(row.fee_total, row.money_precision_version),
    netTotal: restoredMoney(row.net_total, row.money_precision_version),
    transferredGoods: Number(row.transferred_goods),
    compensationTotal: restoredMoney(row.compensation_total, row.money_precision_version),
    isPublisher: Number(row.publisher_id) === userId,
    isBuyer: Number(row.buyer_id) === userId,
    isSupplier: Number(row.supplier_id) === userId,
  };
}

function publicTransfer(row) {
  return {
    assetType: String(row.asset_type),
    productId: row.product_id === null ? null : String(row.product_id),
    quantity: String(row.asset_type) === 'credits'
      ? restoredMoney(row.quantity, row.money_precision_version)
      : Number(row.quantity),
    fromType: String(row.from_type),
    fromId: row.from_id === null ? null : Number(row.from_id),
    fromAccount: String(row.from_account),
    toType: String(row.to_type),
    toId: row.to_id === null ? null : Number(row.to_id),
    toAccount: String(row.to_account),
    purpose: String(row.purpose),
  };
}

function eventMetadata(row) {
  try {
    return JSON.parse(String(row.metadata_json || '{}'));
  } catch {
    return {};
  }
}

export function configureContractAuditStore(store) {
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_contract_audit_contracts (
      contract_id TEXT PRIMARY KEY,
      publisher_id INTEGER NOT NULL,
      buyer_id INTEGER,
      supplier_id INTEGER,
      product_id TEXT NOT NULL,
      status TEXT NOT NULL,
      audit_completeness TEXT NOT NULL CHECK (audit_completeness IN ('full', 'legacy_partial')),
      created_at INTEGER NOT NULL,
      accepted_at INTEGER,
      ended_at INTEGER,
      sort_at INTEGER NOT NULL,
      completed_deliveries INTEGER NOT NULL CHECK (completed_deliveries >= 0),
      total_deliveries INTEGER NOT NULL CHECK (total_deliveries >= 0),
      quantity_per_delivery INTEGER NOT NULL CHECK (quantity_per_delivery >= 0),
      unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
      batch_gross INTEGER NOT NULL CHECK (batch_gross >= 0),
      gross_total INTEGER NOT NULL CHECK (gross_total >= 0),
      fee_total INTEGER NOT NULL CHECK (fee_total >= 0),
      net_total INTEGER NOT NULL CHECK (net_total >= 0),
      transferred_goods INTEGER NOT NULL CHECK (transferred_goods >= 0),
      compensation_total INTEGER NOT NULL DEFAULT 0 CHECK (compensation_total >= 0),
      last_event_sequence INTEGER NOT NULL CHECK (last_event_sequence >= 1),
      last_event_at INTEGER NOT NULL,
      contract_json TEXT NOT NULL,
      money_precision_version INTEGER NOT NULL DEFAULT 2
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_contract_audit_publisher ON economy_contract_audit_contracts(publisher_id, sort_at DESC, contract_id DESC);
    CREATE INDEX IF NOT EXISTS idx_contract_audit_buyer ON economy_contract_audit_contracts(buyer_id, sort_at DESC, contract_id DESC);
    CREATE INDEX IF NOT EXISTS idx_contract_audit_supplier ON economy_contract_audit_contracts(supplier_id, sort_at DESC, contract_id DESC);
    CREATE INDEX IF NOT EXISTS idx_contract_audit_status_product ON economy_contract_audit_contracts(status, product_id, sort_at DESC);

    CREATE TABLE IF NOT EXISTS economy_contract_audit_events (
      event_id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_id TEXT NOT NULL,
      sequence INTEGER NOT NULL CHECK (sequence >= 1),
      event_type TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('player', 'system')),
      actor_user_id INTEGER,
      trigger_type TEXT NOT NULL,
      action TEXT,
      batch_number INTEGER,
      reason_code TEXT,
      occurred_at INTEGER NOT NULL,
      revision_before INTEGER NOT NULL,
      revision_after INTEGER NOT NULL,
      before_json TEXT,
      after_json TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      source_key TEXT NOT NULL UNIQUE,
      UNIQUE(contract_id, sequence)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_contract_audit_events_contract ON economy_contract_audit_events(contract_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_contract_audit_events_time ON economy_contract_audit_events(occurred_at DESC, event_id DESC);

    CREATE TABLE IF NOT EXISTS economy_contract_audit_transfers (
      transfer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES economy_contract_audit_events(event_id) ON DELETE RESTRICT,
      transfer_index INTEGER NOT NULL CHECK (transfer_index >= 0),
      asset_type TEXT NOT NULL CHECK (asset_type IN ('credits', 'commodity')),
      product_id TEXT,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      from_type TEXT NOT NULL,
      from_id INTEGER,
      from_account TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_id INTEGER,
      to_account TEXT NOT NULL,
      purpose TEXT NOT NULL,
      money_precision_version INTEGER NOT NULL DEFAULT 2,
      UNIQUE(event_id, transfer_index)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_contract_audit_transfers_event ON economy_contract_audit_transfers(event_id, transfer_index);

    CREATE TRIGGER IF NOT EXISTS prevent_contract_audit_event_update
    BEFORE UPDATE ON economy_contract_audit_events BEGIN
      SELECT RAISE(ABORT, 'contract audit events are append-only');
    END;
    CREATE TRIGGER IF NOT EXISTS prevent_contract_audit_event_delete
    BEFORE DELETE ON economy_contract_audit_events BEGIN
      SELECT RAISE(ABORT, 'contract audit events are append-only');
    END;
    CREATE TRIGGER IF NOT EXISTS prevent_contract_audit_transfer_update
    BEFORE UPDATE ON economy_contract_audit_transfers BEGIN
      SELECT RAISE(ABORT, 'contract audit transfers are append-only');
    END;
    CREATE TRIGGER IF NOT EXISTS prevent_contract_audit_transfer_delete
    BEFORE DELETE ON economy_contract_audit_transfers BEGIN
      SELECT RAISE(ABORT, 'contract audit transfers are append-only');
    END;
  `);

  const summaryColumns = tableColumns(store.database, 'economy_contract_audit_contracts');
  if (!summaryColumns.has('money_precision_version')) {
    store.database.exec(`
      ALTER TABLE economy_contract_audit_contracts
        ADD COLUMN money_precision_version INTEGER NOT NULL DEFAULT 1;
      UPDATE economy_contract_audit_contracts SET
        unit_price = unit_price * 1000000,
        batch_gross = batch_gross * 1000000,
        gross_total = gross_total * 1000000,
        fee_total = fee_total * 1000000,
        net_total = net_total * 1000000,
        compensation_total = compensation_total * 1000000,
        money_precision_version = 2
      WHERE money_precision_version < 2;
    `);
  }
  const transferColumns = tableColumns(store.database, 'economy_contract_audit_transfers');
  if (!transferColumns.has('money_precision_version')) {
    store.database.exec(`
      DROP TRIGGER IF EXISTS prevent_contract_audit_transfer_update;
      ALTER TABLE economy_contract_audit_transfers
        ADD COLUMN money_precision_version INTEGER NOT NULL DEFAULT 1;
      UPDATE economy_contract_audit_transfers SET
        quantity = CASE WHEN asset_type = 'credits' THEN quantity * 1000000 ELSE quantity END,
        money_precision_version = 2
      WHERE money_precision_version < 2;
      CREATE TRIGGER prevent_contract_audit_transfer_update
      BEFORE UPDATE ON economy_contract_audit_transfers BEGIN
        SELECT RAISE(ABORT, 'contract audit transfers are append-only');
      END;
    `);
  }

  store.selectContractAuditSummary = store.database.prepare(`
    SELECT * FROM economy_contract_audit_contracts WHERE contract_id = ?
  `);
  store.selectNextContractAuditSequence = store.database.prepare(`
    SELECT COALESCE(MAX(sequence), 0) + 1 AS next_sequence
    FROM economy_contract_audit_events WHERE contract_id = ?
  `);
  store.insertContractAuditEvent = store.database.prepare(`
    INSERT INTO economy_contract_audit_events (
      contract_id, sequence, event_type, actor_type, actor_user_id, trigger_type, action,
      batch_number, reason_code, occurred_at, revision_before, revision_after,
      before_json, after_json, metadata_json, source_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  store.insertContractAuditTransfer = store.database.prepare(`
    INSERT INTO economy_contract_audit_transfers (
      event_id, transfer_index, asset_type, product_id, quantity,
      from_type, from_id, from_account, to_type, to_id, to_account, purpose
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  store.upsertContractAuditSummary = store.database.prepare(`
    INSERT INTO economy_contract_audit_contracts (
      contract_id, publisher_id, buyer_id, supplier_id, product_id, status,
      audit_completeness, created_at, accepted_at, ended_at, sort_at,
      completed_deliveries, total_deliveries, quantity_per_delivery, unit_price,
      batch_gross, gross_total, fee_total, net_total, transferred_goods,
      compensation_total, last_event_sequence, last_event_at, contract_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(contract_id) DO UPDATE SET
      publisher_id = excluded.publisher_id,
      buyer_id = excluded.buyer_id,
      supplier_id = excluded.supplier_id,
      product_id = excluded.product_id,
      status = excluded.status,
      audit_completeness = CASE
        WHEN economy_contract_audit_contracts.audit_completeness = 'legacy_partial' THEN 'legacy_partial'
        ELSE excluded.audit_completeness
      END,
      created_at = excluded.created_at,
      accepted_at = excluded.accepted_at,
      ended_at = excluded.ended_at,
      sort_at = excluded.sort_at,
      completed_deliveries = excluded.completed_deliveries,
      total_deliveries = excluded.total_deliveries,
      quantity_per_delivery = excluded.quantity_per_delivery,
      unit_price = excluded.unit_price,
      batch_gross = excluded.batch_gross,
      gross_total = excluded.gross_total,
      fee_total = excluded.fee_total,
      net_total = excluded.net_total,
      transferred_goods = excluded.transferred_goods,
      compensation_total = economy_contract_audit_contracts.compensation_total + excluded.compensation_total,
      last_event_sequence = excluded.last_event_sequence,
      last_event_at = excluded.last_event_at,
      contract_json = excluded.contract_json
  `);

  store.captureContractAuditTransition = (beforeContracts, world, context = {}) => {
    const beforeMap = new Map((beforeContracts || []).map((contract) => [String(contract.id), contractSnapshot(contract)]));
    const afterContracts = (world.productionContracts || []).map(contractSnapshot);
    const afterMap = new Map(afterContracts.map((contract) => [contract.id, contract]));
    const incomingByBuyer = reservedIncomingByBuyer(world);
    const normalizedContext = eventContext(context);

    for (const after of afterContracts) {
      const before = beforeMap.get(after.id) || null;
      if (!before) {
        queueTransitionEvent(world, normalizedContext, after, 'contract_published', {
          after,
          metadata: { originalTerms: clone(after) },
          sourceKey: normalizedContext.requestKeyHash
            ? `contract-audit:request:${normalizedContext.requestKeyHash}:published:${after.id}`
            : null,
        });
        continue;
      }


const beforeRenewal = before.renewalProposal;
const afterRenewal = after.renewalProposal;
if (!beforeRenewal && afterRenewal?.status === 'proposed') {
  queueTransitionEvent(world, normalizedContext, after, 'renewal_proposed', {
    before,
    after,
    metadata: { proposal: clone(afterRenewal) },
  });
}
if (beforeRenewal?.status === 'proposed' && afterRenewal?.status === 'accepted') {
  queueTransitionEvent(world, normalizedContext, after, 'renewal_accepted', {
    before,
    after,
    transfers: renewalAcceptedTransfers(after),
    metadata: { proposal: clone(afterRenewal) },
  });
}
if (beforeRenewal?.status === 'proposed' && !afterRenewal) {
  const eventType = normalizedContext.action === 'rejectProductionContractRenewal'
    ? 'renewal_rejected'
    : normalizedContext.action === 'revokeProductionContractRenewal'
      ? 'renewal_revoked'
      : 'renewal_expired';
  queueTransitionEvent(world, normalizedContext, after, eventType, { before, after });
}
if (beforeRenewal?.status === 'accepted' && afterRenewal?.status === 'activated') {
  queueTransitionEvent(world, normalizedContext, after, 'renewal_activated', {
    before,
    after,
    metadata: { activatedContractId: afterRenewal.activatedContractId },
  });
}
if (beforeRenewal?.status === 'accepted' && !afterRenewal) {
  queueTransitionEvent(world, normalizedContext, after, 'renewal_cancelled_parent_ended', {
    before,
    after,
    transfers: renewalReleaseTransfers(before, beforeRenewal),
    reasonCode: after.renewalCancellationReason,
  });
}

const completedDelta = Math.max(0, after.completedDeliveries - before.completedDeliveries);
const accepted = before.status === 'open' && after.status === 'active';
      const terminated = before.status === 'active' && after.status === 'terminated';
      const completed = before.status === 'active' && after.status === 'completed';

      if (accepted) {
        queueTransitionEvent(world, normalizedContext, after, 'contract_accepted', {
          before,
          after,
          batchNumber: 1,
          transfers: acceptedTransfers(after),
          sourceKey: normalizedContext.requestKeyHash
            ? `contract-audit:request:${normalizedContext.requestKeyHash}:accepted:${after.id}`
            : null,
        });
      }

      if (before.status === 'open' && after.status === 'cancelled') {
        queueTransitionEvent(world, normalizedContext, after, 'contract_cancelled', { before, after });
      }
      if (before.status === 'open' && after.status === 'expired') {
        queueTransitionEvent(world, normalizedContext, after, 'contract_expired', { before, after });
      }

      if (!accepted && completedDelta === 0 && after.buyerEscrowCredits > before.buyerEscrowCredits) {
        const amount = after.buyerEscrowCredits - before.buyerEscrowCredits;
        const manual = normalizedContext.action === 'fundProductionContract';
        queueTransitionEvent(world, normalizedContext, after, manual ? 'buyer_funds_reserved_manual' : 'buyer_funds_reserved_auto', {
          before,
          after,
          batchNumber: after.completedDeliveries + 1,
          transfers: [transfer({ assetType: 'credits', quantity: amount, fromType: 'player', fromId: after.buyerId, fromAccount: 'available', toType: 'player', toId: after.buyerId, toAccount: 'contract_escrow', purpose: manual ? 'manual_batch_funding' : 'automatic_batch_funding' })],
        });
      }

      if (!accepted && completedDelta === 0 && after.supplierReservedQuantity > before.supplierReservedQuantity) {
        const amount = after.supplierReservedQuantity - before.supplierReservedQuantity;
        const manual = normalizedContext.action === 'prepareProductionContract';
        queueTransitionEvent(world, normalizedContext, after, manual ? 'supplier_goods_reserved_manual' : 'supplier_goods_reserved_auto', {
          before,
          after,
          batchNumber: after.completedDeliveries + 1,
          transfers: [transfer({ assetType: 'commodity', productId: after.productId, quantity: amount, fromType: 'player', fromId: after.supplierId, fromAccount: 'inventory_available', toType: 'player', toId: after.supplierId, toAccount: 'contract_goods_escrow', purpose: manual ? 'manual_goods_reservation' : 'automatic_goods_reservation' })],
        });
      }

      if (before.buyerAutoFund !== after.buyerAutoFund) {
        queueTransitionEvent(world, normalizedContext, after, 'buyer_auto_fund_changed', {
          before,
          after,
          metadata: { previous: before.buyerAutoFund, enabled: after.buyerAutoFund },
        });
      }
      if (before.supplierAutoReserve !== after.supplierAutoReserve) {
        queueTransitionEvent(world, normalizedContext, after, 'supplier_auto_reserve_changed', {
          before,
          after,
          metadata: { previous: before.supplierAutoReserve, enabled: after.supplierAutoReserve },
        });
      }
      if (!before.terminationRequestedBy && after.terminationRequestedBy) {
        queueTransitionEvent(world, normalizedContext, after, 'termination_requested', {
          before,
          after,
          metadata: { requestedBy: after.terminationRequestedBy },
        });
      }

      if (!before.graceEndsAt && after.graceEndsAt) {
        queueTransitionEvent(world, normalizedContext, after, 'grace_started', {
          before,
          after,
          batchNumber: after.completedDeliveries + 1,
          reasonCode: graceReasonCode(world, after, incomingByBuyer),
          metadata: { graceEndsAt: after.graceEndsAt },
        });
      }

      if (completedDelta > 0) {
        queueTransitionEvent(world, normalizedContext, after, 'delivery_completed', {
          before,
          after,
          batchNumber: after.completedDeliveries,
          transfers: deliveryTransfers(before, after),
          metadata: {
            plannedAt: before.nextDueAt,
            deliveredAt: after.lastDeliveryAt || normalizedContext.occurredAt,
            gross: after.lastDeliveryGross || after.batchGross,
            fee: after.lastDeliveryFee || Math.max(0, after.marketSellFeeCharged - before.marketSellFeeCharged),
          },
          sourceKey: `contract-audit:delivery:${after.id}:${after.completedDeliveries}`,
        });
        if (after.status === 'active' && after.buyerAutoFund && after.buyerEscrowCredits >= after.batchGross) {
          queueTransitionEvent(world, normalizedContext, after, 'buyer_funds_reserved_auto', {
            before,
            after,
            batchNumber: after.completedDeliveries + 1,
            transfers: [transfer({ assetType: 'credits', quantity: after.batchGross, fromType: 'player', fromId: after.buyerId, fromAccount: 'available', toType: 'player', toId: after.buyerId, toAccount: 'contract_escrow', purpose: 'automatic_batch_funding' })],
            sourceKey: `contract-audit:auto-fund:${after.id}:${after.completedDeliveries + 1}`,
          });
        }
        if (after.status === 'active' && after.supplierAutoReserve && after.supplierReservedQuantity >= after.quantityPerDelivery) {
          queueTransitionEvent(world, normalizedContext, after, 'supplier_goods_reserved_auto', {
            before,
            after,
            batchNumber: after.completedDeliveries + 1,
            transfers: [transfer({ assetType: 'commodity', productId: after.productId, quantity: after.quantityPerDelivery, fromType: 'player', fromId: after.supplierId, fromAccount: 'inventory_available', toType: 'player', toId: after.supplierId, toAccount: 'contract_goods_escrow', purpose: 'automatic_goods_reservation' })],
            sourceKey: `contract-audit:auto-reserve:${after.id}:${after.completedDeliveries + 1}`,
          });
        }
      }

      if (completed) {
        queueTransitionEvent(world, normalizedContext, after, 'contract_completed', {
          before,
          after,
          batchNumber: after.completedDeliveries,
          transfers: completionTransfers(before),
          sourceKey: `contract-audit:completed:${after.id}`,
        });
      }

      if (terminated) {
        queueTransitionEvent(world, normalizedContext, after, eventTypeForTermination(after.terminationReason), {
          before,
          after,
          batchNumber: after.completedDeliveries + (completedDelta > 0 ? 0 : 1),
          reasonCode: after.terminationReason,
          transfers: terminationTransfers(before, after, normalizedContext.actorUserId, completedDelta),
          sourceKey: `contract-audit:terminated:${after.id}:${after.terminationReason || 'unknown'}:${after.endedAt || normalizedContext.occurredAt}`,
        });
      }
    }

    for (const before of beforeMap.values()) {
      if (!afterMap.has(before.id)) {
        queueTransitionEvent(world, normalizedContext, before, 'contract_removed_unexpectedly', {
          before,
          after: before,
          reasonCode: 'missing_from_world',
        });
      }
    }
  };

  store.flushContractAuditEvents = (world, revisionBefore, revisionAfter) => {
    const events = drainEvents(world);
    if (events.length === 0) return;
    if (revisionAfter <= revisionBefore) {
      throw new Error('合同审计事件存在但世界修订号未推进');
    }
    for (const event of events) {
      const existing = store.selectContractAuditSummary.get(event.contractId);
      const sequence = Number(store.selectNextContractAuditSequence.get(event.contractId)?.next_sequence || 1);
      const after = event.after;
      const insertion = store.insertContractAuditEvent.run(
        event.contractId,
        sequence,
        event.eventType,
        event.actorType,
        event.actorUserId,
        event.triggerType,
        event.action,
        event.batchNumber,
        event.reasonCode,
        event.occurredAt,
        revisionBefore,
        revisionAfter,
        event.before ? JSON.stringify(event.before) : null,
        JSON.stringify(after),
        JSON.stringify(event.metadata || {}),
        event.sourceKey,
      );
      const eventId = Number(insertion.lastInsertRowid);
      event.transfers.forEach((item, index) => {
        store.insertContractAuditTransfer.run(
          eventId,
          index,
          item.assetType,
          item.productId,
          item.assetType === 'credits' ? storedMoney(item.quantity) : safeInteger(item.quantity),
          item.fromType,
          item.fromId,
          item.fromAccount,
          item.toType,
          item.toId,
          item.toAccount,
          item.purpose,
        );
      });
      const compensationDelta = event.transfers
        .filter((item) => item.purpose === 'bond_compensation')
        .reduce((sum, item) => sum + item.quantity, 0);
      const endedAt = after.endedAt || after.completedAt || null;
      const sortAt = endedAt || event.occurredAt || after.createdAt;
      const grossTotal = safeMoney(after.marketSellFeeGross, 0)
        || multiplyMoneyByInteger(after.batchGross, after.completedDeliveries)
        || 0;
      const feeTotal = safeMoney(after.marketSellFeeCharged, 0);
      store.upsertContractAuditSummary.run(
        after.id,
        after.publisherId,
        after.buyerId,
        after.supplierId,
        after.productId,
        after.status,
        existing?.audit_completeness === 'legacy_partial' ? 'legacy_partial' : event.completeness,
        after.createdAt,
        after.acceptedAt,
        endedAt,
        sortAt,
        after.completedDeliveries,
        after.totalDeliveries,
        after.quantityPerDelivery,
        storedMoney(after.unitPrice),
        storedMoney(after.batchGross),
        storedMoney(grossTotal),
        storedMoney(feeTotal),
        storedMoney(Math.max(0, roundInternalMoney(grossTotal - feeTotal) || 0)),
        Math.max(0, after.completedDeliveries * after.quantityPerDelivery),
        storedMoney(compensationDelta),
        sequence,
        event.occurredAt,
        JSON.stringify(after),
      );
    }
  };

  store.listContractAuditHistory = (user, options = {}) => store.transaction(() => {
    const userId = Number(user.id);
    const normalized = {
      cursor: options.cursor || null,
      limit: parseLimit(options.limit, DEFAULT_HISTORY_LIMIT),
      status: options.status ? String(options.status) : null,
      productId: options.productId ? String(options.productId) : null,
      role: options.role ? String(options.role) : 'any',
      from: nullableInteger(options.from),
      to: nullableInteger(options.to),
    };
    const { clauses, values } = visibleHistoryWhere(userId, normalized);
    const rows = store.database.prepare(`
      SELECT * FROM economy_contract_audit_contracts
      WHERE ${clauses.join(' AND ')}
      ORDER BY sort_at DESC, contract_id DESC
      LIMIT ?
    `).all(...values, normalized.limit + 1);
    const hasMore = rows.length > normalized.limit;
    const pageRows = hasMore ? rows.slice(0, normalized.limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => publicHistoryRow(row, userId)),
      nextCursor: hasMore && last ? encodeCursor({ sortAt: Number(last.sort_at), contractId: String(last.contract_id) }) : null,
    };
  }, { immediate: false });

  store.getContractAuditDetail = (user, contractId, options = {}) => store.transaction(() => {
    const userId = Number(user.id);
    const summary = store.database.prepare(`
      SELECT * FROM economy_contract_audit_contracts
      WHERE contract_id = ? AND (publisher_id = ? OR buyer_id = ? OR supplier_id = ?)
    `).get(String(contractId), userId, userId, userId);
    if (!summary) {
      const error = new Error('合同审计记录不存在');
      error.statusCode = 404;
      throw error;
    }
    const limit = parseLimit(options.limit, DEFAULT_EVENT_LIMIT);
    const cursor = Math.max(0, safeInteger(options.cursor, 0));
    const rows = store.database.prepare(`
      SELECT * FROM economy_contract_audit_events
      WHERE contract_id = ? AND sequence > ?
      ORDER BY sequence ASC
      LIMIT ?
    `).all(String(contractId), cursor, limit + 1);
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const eventIds = pageRows.map((row) => Number(row.event_id));
    const transfers = eventIds.length === 0
      ? []
      : store.database.prepare(`
          SELECT * FROM economy_contract_audit_transfers
          WHERE event_id IN (${eventIds.map(() => '?').join(', ')})
          ORDER BY event_id ASC, transfer_index ASC
        `).all(...eventIds);
    const transfersByEvent = new Map();
    for (const row of transfers) {
      const eventId = Number(row.event_id);
      const items = transfersByEvent.get(eventId) || [];
      items.push(publicTransfer(row));
      transfersByEvent.set(eventId, items);
    }
    return {
      contract: publicHistoryRow(summary, userId),
      events: pageRows.map((row) => ({
        sequence: Number(row.sequence),
        eventType: String(row.event_type),
        actorType: String(row.actor_type),
        actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
        triggerType: String(row.trigger_type),
        action: row.action === null ? null : String(row.action),
        batchNumber: row.batch_number === null ? null : Number(row.batch_number),
        reasonCode: row.reason_code === null ? null : String(row.reason_code),
        occurredAt: Number(row.occurred_at),
        metadata: eventMetadata(row),
        transfers: transfersByEvent.get(Number(row.event_id)) || [],
      })),
      nextCursor: hasMore && pageRows.length > 0 ? String(pageRows.at(-1).sequence) : null,
    };
  }, { immediate: false });

  store.bootstrapLegacyContractAudit = () => {
    const row = store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    if (!row) return;
    let world;
    try {
      world = JSON.parse(String(row.state_json));
    } catch {
      return;
    }
    const contracts = Array.isArray(world.productionContracts) ? world.productionContracts : [];
    for (const contract of contracts) {
      const snapshot = contractSnapshot(contract);
      if (!snapshot?.id || store.selectContractAuditSummary.get(snapshot.id)) continue;
      queueTransitionEvent(world, { triggerType: 'migration', now: Number(row.updated_at || snapshot.endedAt || snapshot.completedAt || snapshot.createdAt || Date.now()) }, snapshot, 'legacy_snapshot_imported', {
        after: snapshot,
        completeness: 'legacy_partial',
        reasonCode: 'history_before_audit_unavailable',
        metadata: { importedRevision: Number(row.revision) },
        sourceKey: `contract-audit:legacy:${snapshot.id}`,
      });
    }
    const events = Array.isArray(world[CONTRACT_AUDIT_BUFFER]) ? world[CONTRACT_AUDIT_BUFFER] : [];
    if (events.length === 0) return;
    // Bootstrap rows do not change the world, so persist them against the current revision directly.
    for (const event of events) {
      const sequence = Number(store.selectNextContractAuditSequence.get(event.contractId)?.next_sequence || 1);
      const insertion = store.insertContractAuditEvent.run(
        event.contractId,
        sequence,
        event.eventType,
        event.actorType,
        event.actorUserId,
        event.triggerType,
        event.action,
        event.batchNumber,
        event.reasonCode,
        event.occurredAt,
        Number(row.revision),
        Number(row.revision),
        null,
        JSON.stringify(event.after),
        JSON.stringify(event.metadata || {}),
        event.sourceKey,
      );
      void insertion;
      const after = event.after;
      const endedAt = after.endedAt || after.completedAt || null;
      const sortAt = endedAt || after.createdAt;
      const grossTotal = safeMoney(after.marketSellFeeGross, 0)
        || multiplyMoneyByInteger(after.batchGross, after.completedDeliveries)
        || 0;
      const feeTotal = safeMoney(after.marketSellFeeCharged, 0);
      store.upsertContractAuditSummary.run(
        after.id, after.publisherId, after.buyerId, after.supplierId, after.productId, after.status,
        'legacy_partial', after.createdAt, after.acceptedAt, endedAt, sortAt,
        after.completedDeliveries, after.totalDeliveries, after.quantityPerDelivery, storedMoney(after.unitPrice),
        storedMoney(after.batchGross), storedMoney(grossTotal), storedMoney(feeTotal),
        storedMoney(Math.max(0, roundInternalMoney(grossTotal - feeTotal) || 0)),
        Math.max(0, after.completedDeliveries * after.quantityPerDelivery), storedMoney(0),
        sequence, event.occurredAt, JSON.stringify(after),
      );
    }
    delete world[CONTRACT_AUDIT_BUFFER];
  };

  store.transaction(() => store.bootstrapLegacyContractAudit());
}
