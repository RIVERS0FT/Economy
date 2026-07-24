import { randomUUID } from 'node:crypto';
import { PRODUCT_CATALOG } from './domain.js';
import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';
import { creditPopulationEmployment } from './population-economy.js';
import { ensureWarehouse } from './warehouse.js';

export const PRODUCTION_CONTRACT_SCHEMA_VERSION = 1;
export const PRODUCTION_CONTRACT_INTERVALS = Object.freeze([
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
]);
export const PRODUCTION_CONTRACT_FIRST_DELAYS = Object.freeze([
  0,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
  3 * 60 * 60 * 1000,
  6 * 60 * 60 * 1000,
  12 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
]);

const MAX_OPEN_CONTRACTS_PER_PLAYER = 10;
const MAX_ACTIVE_CONTRACTS_PER_PLAYER = 20;
const MAX_CONTRACTS = 2_000;
const MAX_VISIBLE_OPEN_CONTRACTS = 200;
const MAX_VISIBLE_RECENT_CONTRACTS = 100;
const MAX_QUANTITY = 1_000_000;
const MAX_UNIT_PRICE = 1_000_000;
const MIN_DELIVERIES = 2;
const MAX_DELIVERIES = 100;
const OFFER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BOND_RATE_BPS = 2_000;
const BASIS_POINTS = 10_000;
const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));

function clone(value) {
  return structuredClone(value);
}

function result(ok, message) {
  return { ok, message };
}

function positiveInteger(value, max) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 1 && normalized <= max ? normalized : null;
}

function exactAllowedInteger(value, allowed) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && allowed.includes(normalized) ? normalized : null;
}

function playerFor(world, userId) {
  return world.players?.[String(userId)] || null;
}

function inventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function normalizeStats(player) {
  player.stats ||= {};
  player.stats.contractDeliveriesCompleted = Math.max(0, Math.floor(Number(player.stats.contractDeliveriesCompleted || 0)));
  player.stats.contractGoodsSupplied = Math.max(0, Math.floor(Number(player.stats.contractGoodsSupplied || 0)));
  player.stats.contractGoodsPurchased = Math.max(0, Math.floor(Number(player.stats.contractGoodsPurchased || 0)));
  player.stats.contractCreditsPaid = Math.max(0, Math.floor(Number(player.stats.contractCreditsPaid || 0)));
  player.stats.contractCreditsReceived = Math.max(0, Math.floor(Number(player.stats.contractCreditsReceived || 0)));
  player.stats.contractDefaults = Math.max(0, Math.floor(Number(player.stats.contractDefaults || 0)));
  player.stats.boughtGoods = Math.max(0, Math.floor(Number(player.stats.boughtGoods || 0)));
  player.stats.soldGoods = Math.max(0, Math.floor(Number(player.stats.soldGoods || 0)));
  player.stats.commodityVolume = Math.max(0, Math.floor(Number(player.stats.commodityVolume || 0)));
  player.stats.marketServiceFees = Math.max(0, Math.floor(Number(player.stats.marketServiceFees || 0)));
  player.stats.employmentPayments = Math.max(0, Math.floor(Number(player.stats.employmentPayments || 0)));
  return player.stats;
}

function normalizeContract(contract) {
  const normalized = {
    ...contract,
    id: String(contract?.id || `contract-${randomUUID()}`),
    publisherId: Number(contract?.publisherId),
    publisherName: String(contract?.publisherName || '玩家'),
    publisherRole: contract?.publisherRole === 'supplier' ? 'supplier' : 'buyer',
    buyerId: contract?.buyerId === null || contract?.buyerId === undefined ? null : Number(contract.buyerId),
    buyerName: contract?.buyerName ? String(contract.buyerName) : null,
    supplierId: contract?.supplierId === null || contract?.supplierId === undefined ? null : Number(contract.supplierId),
    supplierName: contract?.supplierName ? String(contract.supplierName) : null,
    productId: String(contract?.productId || ''),
    quantityPerDelivery: Math.max(1, Math.floor(Number(contract?.quantityPerDelivery || 1))),
    unitPrice: Math.max(1, Math.floor(Number(contract?.unitPrice || 1))),
    deliveryIntervalMs: Number(contract?.deliveryIntervalMs || PRODUCTION_CONTRACT_INTERVALS[2]),
    totalDeliveries: Math.max(MIN_DELIVERIES, Math.floor(Number(contract?.totalDeliveries || MIN_DELIVERIES))),
    completedDeliveries: Math.max(0, Math.floor(Number(contract?.completedDeliveries || 0))),
    firstDeliveryDelayMs: Math.max(0, Math.floor(Number(contract?.firstDeliveryDelayMs || 0))),
    createdAt: Math.max(0, Number(contract?.createdAt || Date.now())),
    offerExpiresAt: Math.max(0, Number(contract?.offerExpiresAt || 0)),
    acceptedAt: contract?.acceptedAt === undefined ? undefined : Math.max(0, Number(contract.acceptedAt)),
    nextDueAt: contract?.nextDueAt === null || contract?.nextDueAt === undefined ? null : Math.max(0, Number(contract.nextDueAt)),
    graceEndsAt: contract?.graceEndsAt === undefined ? undefined : Math.max(0, Number(contract.graceEndsAt)),
    buyerEscrowCredits: Math.max(0, Math.floor(Number(contract?.buyerEscrowCredits || 0))),
    supplierReservedQuantity: Math.max(0, Math.floor(Number(contract?.supplierReservedQuantity || 0))),
    buyerBondCredits: Math.max(0, Math.floor(Number(contract?.buyerBondCredits || 0))),
    supplierBondCredits: Math.max(0, Math.floor(Number(contract?.supplierBondCredits || 0))),
    buyerAutoFund: contract?.buyerAutoFund !== false,
    supplierAutoReserve: contract?.supplierAutoReserve !== false,
    marketSellFeeGross: Math.max(0, Math.floor(Number(contract?.marketSellFeeGross || 0))),
    marketSellFeeCharged: Math.max(0, Math.floor(Number(contract?.marketSellFeeCharged || 0))),
    status: ['open', 'active', 'completed', 'cancelled', 'terminated', 'expired'].includes(contract?.status)
      ? contract.status
      : 'open',
    roundStatus: ['preparing', 'ready', 'grace'].includes(contract?.roundStatus)
      ? contract.roundStatus
      : 'preparing',
  };
  if (!normalized.offerExpiresAt) normalized.offerExpiresAt = normalized.createdAt + OFFER_TTL_MS;
  if (normalized.completedDeliveries >= normalized.totalDeliveries && normalized.status === 'active') {
    normalized.status = 'completed';
  }
  return normalized;
}

export function migrateProductionContractWorld(world) {
  world.productionContracts = Array.isArray(world.productionContracts)
    ? world.productionContracts.map(normalizeContract)
    : [];
  world.productionContractSchemaVersion = PRODUCTION_CONTRACT_SCHEMA_VERSION;
  for (const player of Object.values(world.players || {})) normalizeStats(player);
  return world;
}

function openContractsFor(world, userId) {
  return world.productionContracts.filter((contract) => contract.status === 'open' && contract.publisherId === Number(userId));
}

function activeContractsFor(world, userId) {
  return world.productionContracts.filter((contract) => (
    contract.status === 'active'
    && (contract.buyerId === Number(userId) || contract.supplierId === Number(userId))
  ));
}

function storedQuantity(player) {
  return Object.values(player.inventories || {}).reduce((sum, inventory) => (
    sum + Math.max(0, Number(inventory?.available || 0)) + Math.max(0, Number(inventory?.frozen || 0))
  ), 0);
}

function reservedIncomingQuantity(world, userId, exceptContractId = null) {
  return world.productionContracts.reduce((sum, contract) => {
    if (
      contract.status !== 'active'
      || contract.buyerId !== Number(userId)
      || contract.id === exceptContractId
      || contract.completedDeliveries >= contract.totalDeliveries
    ) return sum;
    return sum + contract.quantityPerDelivery;
  }, 0);
}

function hasWarehouseCapacity(world, buyer, quantity, exceptContractId = null) {
  ensureWarehouse(buyer);
  const used = storedQuantity(buyer) + reservedIncomingQuantity(world, buyer.userId, exceptContractId);
  return buyer.inventoryCapacity - used >= quantity;
}

function batchGross(contract) {
  const gross = contract.quantityPerDelivery * contract.unitPrice;
  return Number.isSafeInteger(gross) && gross > 0 ? gross : null;
}

function bondFor(gross) {
  const bond = Math.ceil(gross * BOND_RATE_BPS / BASIS_POINTS);
  return Number.isSafeInteger(bond) && bond > 0 ? bond : null;
}

function consumeFrozenCredits(player, amount) {
  const normalized = Math.max(0, Math.floor(Number(amount || 0)));
  const consumed = Math.min(normalized, Math.max(0, Math.floor(Number(player.frozenCredits || 0))));
  player.frozenCredits = Math.max(0, Number(player.frozenCredits || 0) - consumed);
  return consumed;
}

function releaseFrozenCredits(player, amount) {
  const released = consumeFrozenCredits(player, amount);
  player.credits = Math.max(0, Number(player.credits || 0)) + released;
  return released;
}

function transferFrozenCredits(fromPlayer, toPlayer, amount) {
  const transferred = consumeFrozenCredits(fromPlayer, amount);
  toPlayer.credits = Math.max(0, Number(toPlayer.credits || 0)) + transferred;
  return transferred;
}

function releaseSupplierGoods(contract, supplier) {
  const inventory = inventoryFor(supplier, contract.productId);
  const quantity = Math.min(contract.supplierReservedQuantity, Math.max(0, Number(inventory.frozen || 0)));
  inventory.frozen = Math.max(0, Number(inventory.frozen || 0) - quantity);
  inventory.available = Math.max(0, Number(inventory.available || 0)) + quantity;
  contract.supplierReservedQuantity = Math.max(0, contract.supplierReservedQuantity - quantity);
  return quantity;
}

function reserveBuyerBatch(contract, buyer) {
  const gross = batchGross(contract);
  if (!gross) return false;
  if (contract.buyerEscrowCredits >= gross) return true;
  const required = gross - contract.buyerEscrowCredits;
  if (buyer.credits < required) return false;
  buyer.credits -= required;
  buyer.frozenCredits = Math.max(0, Number(buyer.frozenCredits || 0)) + required;
  contract.buyerEscrowCredits += required;
  return true;
}

function reserveSupplierBatch(contract, supplier) {
  const required = contract.quantityPerDelivery - contract.supplierReservedQuantity;
  if (required <= 0) return true;
  const inventory = inventoryFor(supplier, contract.productId);
  if (inventory.available < required) return false;
  inventory.available -= required;
  inventory.frozen = Math.max(0, Number(inventory.frozen || 0)) + required;
  contract.supplierReservedQuantity += required;
  return true;
}

function gracePeriodFor(contract) {
  return Math.max(10 * 60 * 1000, Math.min(Math.floor(contract.deliveryIntervalMs / 2), 6 * 60 * 60 * 1000));
}

function releaseAllEscrow(contract, buyer, supplier) {
  releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
  releaseFrozenCredits(buyer, contract.buyerBondCredits);
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  releaseSupplierGoods(contract, supplier);
  contract.buyerEscrowCredits = 0;
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
}

function terminateForDefault(world, contract, defaultParty, now) {
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
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

function completeContract(contract, buyer, supplier, now) {
  releaseFrozenCredits(buyer, contract.buyerBondCredits);
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
  contract.status = 'completed';
  contract.completedAt = now;
  contract.nextDueAt = null;
  contract.roundStatus = 'ready';
  delete contract.graceEndsAt;
}

function settleBatch(world, contract, buyer, supplier, now) {
  const gross = batchGross(contract);
  if (!gross || contract.buyerEscrowCredits < gross || contract.supplierReservedQuantity < contract.quantityPerDelivery) return false;
  if (!hasWarehouseCapacity(world, buyer, contract.quantityPerDelivery, contract.id)) return false;

  const supplierInventory = inventoryFor(supplier, contract.productId);
  const buyerInventory = inventoryFor(buyer, contract.productId);
  if (supplierInventory.frozen < contract.quantityPerDelivery || buyer.frozenCredits < gross) return false;

  supplierInventory.frozen -= contract.quantityPerDelivery;
  contract.supplierReservedQuantity -= contract.quantityPerDelivery;
  buyerInventory.available += contract.quantityPerDelivery;

  consumeFrozenCredits(buyer, gross);
  contract.buyerEscrowCredits -= gross;

  const previousGross = contract.marketSellFeeGross;
  const previousFee = contract.marketSellFeeCharged;
  const nextGross = previousGross + gross;
  const nextFee = calculateCumulativeMarketSellFee(nextGross);
  const fee = Math.max(0, nextFee - previousFee);
  const net = gross - fee;
  contract.marketSellFeeGross = nextGross;
  contract.marketSellFeeCharged = nextFee;

  supplier.credits += net;
  if (fee > 0) creditPopulationEmployment(world, fee, 'marketService');

  const buyerStats = normalizeStats(buyer);
  const supplierStats = normalizeStats(supplier);
  buyerStats.contractDeliveriesCompleted += 1;
  buyerStats.contractGoodsPurchased += contract.quantityPerDelivery;
  buyerStats.contractCreditsPaid += gross;
  buyerStats.boughtGoods += contract.quantityPerDelivery;
  buyerStats.commodityVolume += contract.quantityPerDelivery;
  supplierStats.contractDeliveriesCompleted += 1;
  supplierStats.contractGoodsSupplied += contract.quantityPerDelivery;
  supplierStats.contractCreditsReceived += net;
  supplierStats.soldGoods += contract.quantityPerDelivery;
  supplierStats.commodityVolume += contract.quantityPerDelivery;
  supplierStats.marketServiceFees += fee;
  supplierStats.employmentPayments += fee;

  contract.completedDeliveries += 1;
  contract.lastDeliveryAt = now;
  contract.lastDeliveryGross = gross;
  contract.lastDeliveryFee = fee;
  contract.roundStatus = 'preparing';
  delete contract.graceEndsAt;

  if (contract.completedDeliveries >= contract.totalDeliveries) {
    completeContract(contract, buyer, supplier, now);
    return true;
  }

  if (contract.terminationRequestedBy) {
    releaseAllEscrow(contract, buyer, supplier);
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = 'notice_completed';
    contract.nextDueAt = null;
    return true;
  }

  contract.nextDueAt = Math.max(
    Number(contract.nextDueAt || now) + contract.deliveryIntervalMs,
    now + contract.deliveryIntervalMs,
  );
  if (contract.buyerAutoFund) reserveBuyerBatch(contract, buyer);
  if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);
  contract.roundStatus = contract.buyerEscrowCredits >= gross && contract.supplierReservedQuantity >= contract.quantityPerDelivery
    ? 'ready'
    : 'preparing';
  return true;
}

function processActiveContract(world, contract, now) {
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) {
    contract.status = 'terminated';
    contract.endedAt = now;
    contract.terminationReason = 'participant_missing';
    return;
  }

  ensureWarehouse(buyer);
  ensureWarehouse(supplier);
  normalizeStats(buyer);
  normalizeStats(supplier);
  if (contract.buyerAutoFund) reserveBuyerBatch(contract, buyer);
  if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);

  const gross = batchGross(contract);
  const fundsReady = Boolean(gross && contract.buyerEscrowCredits >= gross);
  const goodsReady = contract.supplierReservedQuantity >= contract.quantityPerDelivery;
  const capacityReady = hasWarehouseCapacity(world, buyer, contract.quantityPerDelivery, contract.id);
  contract.roundStatus = fundsReady && goodsReady && capacityReady ? 'ready' : contract.graceEndsAt ? 'grace' : 'preparing';

  if (now < Number(contract.nextDueAt || Number.POSITIVE_INFINITY)) return;
  if (fundsReady && goodsReady && capacityReady) {
    settleBatch(world, contract, buyer, supplier, now);
    return;
  }

  if (!contract.graceEndsAt) {
    contract.graceEndsAt = now + gracePeriodFor(contract);
    contract.roundStatus = 'grace';
    return;
  }
  if (now < contract.graceEndsAt) return;

  const buyerReady = fundsReady && capacityReady;
  const defaultParty = goodsReady && !buyerReady
    ? 'buyer'
    : !goodsReady && buyerReady
      ? 'supplier'
      : 'both';
  terminateForDefault(world, contract, defaultParty, now);
}

export function processProductionContracts(world, now = Date.now()) {
  migrateProductionContractWorld(world);
  for (const contract of world.productionContracts) {
    if (contract.status === 'open' && now >= contract.offerExpiresAt) {
      contract.status = 'expired';
      contract.endedAt = now;
      continue;
    }
    if (contract.status === 'active') processActiveContract(world, contract, now);
  }
  const activeOrOpen = world.productionContracts.filter((contract) => contract.status === 'open' || contract.status === 'active');
  const ended = world.productionContracts
    .filter((contract) => contract.status !== 'open' && contract.status !== 'active')
    .sort((left, right) => Number(right.endedAt || right.createdAt) - Number(left.endedAt || left.createdAt))
    .slice(0, Math.max(0, MAX_CONTRACTS - activeOrOpen.length));
  world.productionContracts = [...activeOrOpen, ...ended].slice(0, MAX_CONTRACTS);
  return world;
}

function createContract(world, user, payload, now) {
  migrateProductionContractWorld(world);
  const publisherRole = payload.publisherRole === 'supplier' ? 'supplier' : payload.publisherRole === 'buyer' ? 'buyer' : null;
  const productId = PRODUCT_IDS.has(String(payload.productId || '')) ? String(payload.productId) : null;
  const quantityPerDelivery = positiveInteger(payload.quantityPerDelivery, MAX_QUANTITY);
  const unitPrice = positiveInteger(payload.unitPrice, MAX_UNIT_PRICE);
  const deliveryIntervalMs = exactAllowedInteger(payload.deliveryIntervalMs, PRODUCTION_CONTRACT_INTERVALS);
  const totalDeliveries = positiveInteger(payload.totalDeliveries, MAX_DELIVERIES);
  const firstDeliveryDelayMs = exactAllowedInteger(payload.firstDeliveryDelayMs, PRODUCTION_CONTRACT_FIRST_DELAYS);
  if (!publisherRole || !productId || !quantityPerDelivery || !unitPrice || !deliveryIntervalMs || !totalDeliveries || firstDeliveryDelayMs === null) {
    return result(false, '合同参数无效');
  }
  if (totalDeliveries < MIN_DELIVERIES) return result(false, `合同至少需要 ${MIN_DELIVERIES} 批交付`);
  const gross = quantityPerDelivery * unitPrice;
  if (!Number.isSafeInteger(gross)) return result(false, '单批货款超出安全范围');
  if (openContractsFor(world, user.id).length >= MAX_OPEN_CONTRACTS_PER_PLAYER) return result(false, '公开合同数量已达上限');

  const publisher = playerFor(world, user.id);
  if (!publisher) return result(false, '玩家不存在');
  world.productionContracts.push(normalizeContract({
    id: `production-contract-${randomUUID()}`,
    publisherId: Number(user.id),
    publisherName: publisher.playerName,
    publisherRole,
    buyerId: publisherRole === 'buyer' ? Number(user.id) : null,
    buyerName: publisherRole === 'buyer' ? publisher.playerName : null,
    supplierId: publisherRole === 'supplier' ? Number(user.id) : null,
    supplierName: publisherRole === 'supplier' ? publisher.playerName : null,
    productId,
    quantityPerDelivery,
    unitPrice,
    deliveryIntervalMs,
    totalDeliveries,
    completedDeliveries: 0,
    firstDeliveryDelayMs,
    createdAt: now,
    offerExpiresAt: now + OFFER_TTL_MS,
    status: 'open',
  }));
  return result(true, '长期供货合同已发布');
}

function acceptContract(world, user, payload, now) {
  migrateProductionContractWorld(world);
  const contract = world.productionContracts.find((item) => item.id === String(payload.contractId || ''));
  if (!contract || contract.status !== 'open') return result(false, '合同不存在或已被承接');
  if (contract.publisherId === Number(user.id)) return result(false, '不能承接自己发布的合同');
  if (activeContractsFor(world, user.id).length >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '进行中的合同数量已达上限');
  if (activeContractsFor(world, contract.publisherId).length >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '发布者进行中的合同数量已达上限');

  const accepter = playerFor(world, user.id);
  const publisher = playerFor(world, contract.publisherId);
  if (!accepter || !publisher) return result(false, '合同参与者不存在');
  const buyer = contract.publisherRole === 'buyer' ? publisher : accepter;
  const supplier = contract.publisherRole === 'supplier' ? publisher : accepter;
  const gross = batchGross(contract);
  const bond = gross ? bondFor(gross) : null;
  if (!gross || !bond) return result(false, '合同金额超出安全范围');
  if (buyer.credits < gross + bond) return result(false, `采购方需要至少 ¤${gross + bond} 用于首批货款和保证金`);
  if (supplier.credits < bond) return result(false, `供应方需要至少 ¤${bond} 履约保证金`);
  if (!hasWarehouseCapacity(world, buyer, contract.quantityPerDelivery)) return result(false, '采购方仓库无法容纳下一批商品');

  buyer.credits -= gross + bond;
  buyer.frozenCredits = Math.max(0, Number(buyer.frozenCredits || 0)) + gross + bond;
  supplier.credits -= bond;
  supplier.frozenCredits = Math.max(0, Number(supplier.frozenCredits || 0)) + bond;

  contract.buyerId = Number(buyer.userId);
  contract.buyerName = buyer.playerName;
  contract.supplierId = Number(supplier.userId);
  contract.supplierName = supplier.playerName;
  contract.buyerEscrowCredits = gross;
  contract.buyerBondCredits = bond;
  contract.supplierBondCredits = bond;
  contract.buyerAutoFund = true;
  contract.supplierAutoReserve = true;
  contract.acceptedAt = now;
  contract.nextDueAt = now + contract.firstDeliveryDelayMs;
  contract.status = 'active';
  contract.roundStatus = 'preparing';
  reserveSupplierBatch(contract, supplier);
  if (contract.supplierReservedQuantity >= contract.quantityPerDelivery) contract.roundStatus = 'ready';
  return result(true, '合同已签订并进入履约');
}

function ownActiveContract(world, userId, contractId) {
  const contract = world.productionContracts.find((item) => item.id === String(contractId || ''));
  if (!contract || contract.status !== 'active') return null;
  return contract.buyerId === Number(userId) || contract.supplierId === Number(userId) ? contract : null;
}

function cancelOpenContract(world, user, payload, now) {
  const contract = world.productionContracts.find((item) => item.id === String(payload.contractId || ''));
  if (!contract || contract.status !== 'open' || contract.publisherId !== Number(user.id)) return result(false, '可取消的公开合同不存在');
  contract.status = 'cancelled';
  contract.endedAt = now;
  return result(true, '公开合同已取消');
}

function prepareContract(world, user, payload) {
  const contract = ownActiveContract(world, user.id, payload.contractId);
  if (!contract || contract.supplierId !== Number(user.id)) return result(false, '只有供应方可以准备商品');
  const supplier = playerFor(world, user.id);
  if (!reserveSupplierBatch(contract, supplier)) return result(false, '可用商品库存不足');
  contract.roundStatus = contract.buyerEscrowCredits >= batchGross(contract) ? 'ready' : contract.roundStatus;
  return result(true, '本批商品已进入合同托管');
}

function fundContract(world, user, payload) {
  const contract = ownActiveContract(world, user.id, payload.contractId);
  if (!contract || contract.buyerId !== Number(user.id)) return result(false, '只有采购方可以补充货款');
  const buyer = playerFor(world, user.id);
  if (!reserveBuyerBatch(contract, buyer)) return result(false, '可用资金不足');
  contract.roundStatus = contract.supplierReservedQuantity >= contract.quantityPerDelivery ? 'ready' : contract.roundStatus;
  return result(true, '本批货款已进入合同托管');
}

function setAutoMode(world, user, payload, field, role) {
  const contract = ownActiveContract(world, user.id, payload.contractId);
  if (!contract || contract[`${role}Id`] !== Number(user.id)) return result(false, '无权修改该合同的自动设置');
  contract[field] = payload.enabled === true;
  if (field === 'buyerAutoFund' && contract[field]) reserveBuyerBatch(contract, playerFor(world, user.id));
  if (field === 'supplierAutoReserve' && contract[field]) reserveSupplierBatch(contract, playerFor(world, user.id));
  return result(true, contract[field] ? '自动履约已开启' : '自动履约已关闭');
}

function requestTermination(world, user, payload) {
  const contract = ownActiveContract(world, user.id, payload.contractId);
  if (!contract) return result(false, '进行中的合同不存在');
  contract.terminationRequestedBy = Number(user.id);
  contract.terminationRequestedAt = Date.now();
  return result(true, '合同将在当前批次完成后结束');
}

function terminateNow(world, user, payload, now) {
  const contract = ownActiveContract(world, user.id, payload.contractId);
  if (!contract) return result(false, '进行中的合同不存在');
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  if (!buyer || !supplier) return result(false, '合同参与者不存在');

  if (contract.buyerId === Number(user.id)) {
    releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
    transferFrozenCredits(buyer, supplier, contract.buyerBondCredits);
    releaseFrozenCredits(supplier, contract.supplierBondCredits);
    releaseSupplierGoods(contract, supplier);
  } else {
    releaseFrozenCredits(buyer, contract.buyerEscrowCredits);
    releaseFrozenCredits(buyer, contract.buyerBondCredits);
    transferFrozenCredits(supplier, buyer, contract.supplierBondCredits);
    releaseSupplierGoods(contract, supplier);
  }
  contract.buyerEscrowCredits = 0;
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
  contract.status = 'terminated';
  contract.endedAt = now;
  contract.terminationReason = 'immediate_by_participant';
  normalizeStats(playerFor(world, user.id)).contractDefaults += 1;
  return result(true, '合同已立即终止，违约保证金已支付给对方');
}

export function applyProductionContractAction(world, user, action, payload = {}, now = Date.now()) {
  processProductionContracts(world, now);
  if (action === 'createProductionContract') return createContract(world, user, payload, now);
  if (action === 'acceptProductionContract') return acceptContract(world, user, payload, now);
  if (action === 'cancelProductionContract') return cancelOpenContract(world, user, payload, now);
  if (action === 'prepareProductionContract') return prepareContract(world, user, payload);
  if (action === 'fundProductionContract') return fundContract(world, user, payload);
  if (action === 'setProductionContractAutoReserve') return setAutoMode(world, user, payload, 'supplierAutoReserve', 'supplier');
  if (action === 'setProductionContractAutoFund') return setAutoMode(world, user, payload, 'buyerAutoFund', 'buyer');
  if (action === 'requestProductionContractTermination') return requestTermination(world, user, payload);
  if (action === 'terminateProductionContractNow') return terminateNow(world, user, payload, now);
  return result(false, '合同操作不存在');
}

function issueForContract(world, contract) {
  if (contract.status !== 'active') return null;
  const buyer = playerFor(world, contract.buyerId);
  const supplier = playerFor(world, contract.supplierId);
  const gross = batchGross(contract) || 0;
  if (!buyer || !supplier) return '合同参与者异常';
  if (contract.graceEndsAt) {
    if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '供应方商品不足，正在宽限期';
    if (contract.buyerEscrowCredits < gross) return '采购方货款不足，正在宽限期';
    if (!hasWarehouseCapacity(world, buyer, contract.quantityPerDelivery, contract.id)) return '采购方仓库空间不足，正在宽限期';
    return '宽限期内等待结算';
  }
  if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '等待供应方准备商品';
  if (contract.buyerEscrowCredits < gross) return '等待采购方补充货款';
  if (!hasWarehouseCapacity(world, buyer, contract.quantityPerDelivery, contract.id)) return '采购方仓库空间不足';
  return null;
}

function publicContract(world, contract, userId) {
  const gross = batchGross(contract) || 0;
  return {
    id: contract.id,
    publisherId: contract.publisherId,
    publisherName: contract.publisherName,
    publisherRole: contract.publisherRole,
    buyerId: contract.buyerId,
    buyerName: contract.buyerName,
    supplierId: contract.supplierId,
    supplierName: contract.supplierName,
    productId: contract.productId,
    quantityPerDelivery: contract.quantityPerDelivery,
    unitPrice: contract.unitPrice,
    batchGross: gross,
    deliveryIntervalMs: contract.deliveryIntervalMs,
    totalDeliveries: contract.totalDeliveries,
    completedDeliveries: contract.completedDeliveries,
    firstDeliveryDelayMs: contract.firstDeliveryDelayMs,
    createdAt: contract.createdAt,
    offerExpiresAt: contract.offerExpiresAt,
    acceptedAt: contract.acceptedAt,
    nextDueAt: contract.nextDueAt,
    graceEndsAt: contract.graceEndsAt,
    status: contract.status,
    roundStatus: contract.roundStatus,
    buyerEscrowCredits: contract.buyerEscrowCredits,
    supplierReservedQuantity: contract.supplierReservedQuantity,
    buyerBondCredits: contract.buyerBondCredits,
    supplierBondCredits: contract.supplierBondCredits,
    buyerAutoFund: contract.buyerAutoFund,
    supplierAutoReserve: contract.supplierAutoReserve,
    terminationRequestedBy: contract.terminationRequestedBy,
    terminationReason: contract.terminationReason,
    endedAt: contract.endedAt,
    completedAt: contract.completedAt,
    issue: issueForContract(world, contract),
    isPublisher: contract.publisherId === Number(userId),
    isBuyer: contract.buyerId === Number(userId),
    isSupplier: contract.supplierId === Number(userId),
  };
}

export function createProductionContractClientState(world, userId, now = Date.now()) {
  processProductionContracts(world, now);
  const visibleOpen = world.productionContracts
    .filter((contract) => contract.status === 'open')
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_VISIBLE_OPEN_CONTRACTS);
  const own = world.productionContracts.filter((contract) => (
    contract.publisherId === Number(userId)
    || contract.buyerId === Number(userId)
    || contract.supplierId === Number(userId)
  ));
  const active = own.filter((contract) => contract.status === 'active');
  const recent = own
    .filter((contract) => !['open', 'active'].includes(contract.status))
    .sort((left, right) => Number(right.endedAt || right.createdAt) - Number(left.endedAt || left.createdAt))
    .slice(0, MAX_VISIBLE_RECENT_CONTRACTS);
  const ownOpen = own.filter((contract) => contract.status === 'open');
  const byId = new Map([...visibleOpen, ...active, ...recent, ...ownOpen].map((contract) => [contract.id, contract]));
  const productionContracts = [...byId.values()].map((contract) => publicContract(world, contract, userId));
  return {
    productionContracts,
    productionContractSummary: {
      active: active.length,
      open: ownOpen.length,
      needsAttention: active.filter((contract) => Boolean(issueForContract(world, contract))).length,
      upcomingWithin24Hours: active.filter((contract) => Number(contract.nextDueAt || 0) <= now + 24 * 60 * 60 * 1000).length,
    },
  };
}
