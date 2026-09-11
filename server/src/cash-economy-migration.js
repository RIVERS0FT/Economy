import { createHash } from 'node:crypto';
import { PRODUCT_CATALOG, FACILITY_TYPE_CATALOG, commoditySystemPriceFor } from './domain.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { PROVINCE_CATALOG, provinceScopedKey } from './provinces.js';
import { assertCommodityFreezeInvariant, frozenForSource, releaseCommodityFreeze } from './commodity-freezes.js';
import { assertCommodityInvestmentAccount } from './commodity-investments.js';
import { assertCashProductionCycle } from './cash-production-cycles.js';
import { archiveCashPriceDay, cashDateKey, COMMODITY_INDEX_POLICY_ID, officialCashPrice, requireCashProduct, requireCashProvince } from './commodity-investment-prices.js';
import { cashAdd, cashEconomyError, cashMicros, cashMoney, cashProduct, cashQuantity, cashTimestamp } from './cash-economy-money.js';

export const CASH_ECONOMY_MIGRATION_VERSION = 1;
const PLANS = new WeakMap();
const TERMINAL_CONTRACT = new Set(['completed', 'cancelled', 'terminated', 'expired', 'defaulted']);
const ZERO_ALLOWED = { allowZero: true };
const HASH = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quantity = (value, label) => cashQuantity(value ?? 0, label, ZERO_ALLOWED);

function fail(code, message, entity) {
  const error = cashEconomyError(code, message);
  error.entity = String(entity ?? 'world');
  throw error;
}
function account(world, id, label, amount = 1) {
  if (!amount && (id === null || id === undefined)) return null;
  const result = world.players?.[String(id)];
  if (!result) fail('CASH_MIGRATION_PARTICIPANT', `${label}不存在，不能转移托管资产`, id);
  return result;
}
function reserveAccount(world, groupId) {
  const result = world.marketDemand?.liquidity?.groups?.[String(groupId)];
  if (!result) fail('CASH_MIGRATION_RESERVE', '市场储备账户不存在', groupId);
  return result;
}
function releaseMoney(owner, amount, label) {
  const value = cashMicros(amount ?? 0, label);
  if (!value) return 0;
  if (!owner || cashMicros(owner.frozenCredits ?? 0) < value) fail('CASH_MIGRATION_ESCROW', '冻结资金不足，不能以其他资产填补托管差额', label);
  const credits = cashMoney(cashMicros(owner.credits ?? 0) + value, '托管退款后资金');
  owner.frozenCredits = cashMoney(cashMicros(owner.frozenCredits) - value);
  owner.credits = credits;
  return cashMoney(value);
}
function inventory(world, userId, provinceId, productId) {
  requireCashProvince(provinceId); requireCashProduct(productId);
  const owner = account(world, userId, '商品所有者');
  return owner.inventories?.[provinceScopedKey(provinceId, productId)];
}
function releaseGoods(world, userId, provinceId, productId, kind, sourceId, amount) {
  const count = quantity(amount, '托管商品数量');
  if (!count) return;
  const stock = inventory(world, userId, provinceId, productId);
  if (!stock?.freezes || frozenForSource(stock, kind, sourceId) !== count) {
    fail('CASH_MIGRATION_CUSTODY', '商品数量与对应来源冻结不一致，必须先核对来源', `${userId}:${sourceId}`);
  }
  releaseCommodityFreeze(stock, kind, sourceId, count);
}
function heldSupplyMoney(contract) {
  return ['buyerEscrowCredits', 'buyerBondCredits', 'supplierBondCredits'].some((key) => cashMicros(contract[key] ?? 0) > 0n)
    || quantity(contract.supplierReservedQuantity, '合同冻结数量') > 0;
}

/** This is cold, all-or-nothing planning, never a hot-path repair or a way to guess legacy ownership. */
function retireSupplyContracts(world, at, events) {
  const seen = new Set();
  for (const contract of world.productionContracts ?? []) {
    if (contract.kind !== 'supply') continue;
    if (typeof contract.id !== 'string' || !contract.id || seen.has(contract.id)) fail('CASH_MIGRATION_DUPLICATE', '商品合同身份缺失或重复', contract.id);
    seen.add(contract.id);
    if (TERMINAL_CONTRACT.has(contract.status)) {
      if (heldSupplyMoney(contract) || (contract.renewalProposal?.status === 'accepted' && heldSupplyMoney(contract.renewalProposal))) {
        fail('CASH_MIGRATION_TERMINAL_ESCROW', '已结束商品合同仍有未核对托管', contract.id);
      }
      continue;
    }
    if (!['open', 'active', 'grace', 'terminating'].includes(contract.status)) fail('CASH_MIGRATION_CONTRACT_STATUS', '商品合同状态未知', contract.id);
    requireCashProvince(contract.provinceId); requireCashProduct(contract.productId);
    const refunds = [];
    const obligations = [{ entry: contract, sourceId: contract.id }];
    if (contract.renewalProposal?.status === 'accepted') obligations.push({ entry: contract.renewalProposal, sourceId: `${contract.id}:renewal` });
    for (const { entry, sourceId } of obligations) {
      const buyerAmount = cashAdd(entry.buyerEscrowCredits ?? 0, entry.buyerBondCredits ?? 0);
      const supplierAmount = entry.supplierBondCredits ?? 0;
      const buyer = contract.publisherType === 'market_reserve'
        ? reserveAccount(world, contract.marketReserveGroupId) : account(world, contract.buyerId, '采购方', buyerAmount);
      const supplier = account(world, contract.supplierId, '供货方', (cashMicros(supplierAmount) > 0n || quantity(entry.supplierReservedQuantity, '供货冻结') > 0) ? 1 : 0);
      refunds.push({ sourceId, buyer: releaseMoney(buyer, buyerAmount, sourceId), supplier: releaseMoney(supplier, supplierAmount, sourceId) });
      releaseGoods(world, contract.supplierId, contract.provinceId, contract.productId, 'contract', sourceId, entry.supplierReservedQuantity);
      entry.buyerEscrowCredits = 0; entry.buyerBondCredits = 0; entry.supplierBondCredits = 0; entry.supplierReservedQuantity = 0;
    }
    if (contract.renewalProposal) {
      contract.renewalProposal.status = 'cancelled';
      contract.renewalCancellationReason = 'cash_economy_retirement';
    }
    const previousStatus = contract.status;
    contract.status = 'terminated'; contract.terminatedAt = at; contract.nextDueAt = null;
    contract.terminationReason = 'cash_economy_retirement'; contract.buyerAutoFund = false; contract.supplierAutoReserve = false;
    contract.roundStatus = 'closed';
    events.push({ kind: 'supply-retirement', id: contract.id, previousStatus, refunds });
  }
}

function retireCommodityAuctions(world, at, events) {
  const seen = new Set();
  for (const auction of world.assetAuctions ?? []) {
    if (auction.status !== 'open') continue;
    if (!Array.isArray(auction.items) || !auction.items.length) fail('CASH_MIGRATION_AUCTION_ITEMS', '拍卖项目尚未完成旧结构迁移', auction.id);
    if (!auction.items.some((item) => item.assetKind === 'commodity')) continue;
    if (typeof auction.id !== 'string' || !auction.id || seen.has(auction.id)) fail('CASH_MIGRATION_DUPLICATE', '拍卖身份缺失或重复', auction.id);
    seen.add(auction.id);
    if (auction.escrowStatus !== 'held') fail('CASH_MIGRATION_AUCTION_ESCROW', '开放商品拍卖不具有完整托管', auction.id);
    // Mixed bundles remain blocked until the factory-availability transition is wired; do not release only their goods.
    if (auction.items.some((item) => item.assetKind !== 'commodity')) fail('CASH_MIGRATION_MIXED_AUCTION', '混合资产拍卖需按工厂运行状态一并解除托管', auction.id);
    let refundedBid = 0;
    if (cashMicros(auction.highestBid ?? 0) > 0n) {
      const bidder = account(world, auction.highestBidderId, '最高竞价人');
      refundedBid = releaseMoney(bidder, auction.highestBid, auction.id);
    } else if (auction.highestBidderId != null) fail('CASH_MIGRATION_BID', '最高竞价人和冻结金额不一致', auction.id);
    for (const item of auction.items) {
      requireCashProvince(item.provinceId); requireCashProduct(item.assetId);
      const count = cashQuantity(item.quantity, '拍卖商品数量');
      if (auction.sellerType === 'market_reserve') {
        const reserve = reserveAccount(world, auction.marketReserveGroupId).reserves?.[item.assetId];
        if (!reserve || quantity(reserve.frozenInventory, '储备冻结') < count) fail('CASH_MIGRATION_RESERVE_ESCROW', '储备拍卖冻结不足', auction.id);
        reserve.inventory = quantity(quantity(reserve.inventory, '储备数量') + count, '储备数量');
        reserve.frozenInventory -= count;
      } else releaseGoods(world, auction.sellerId, item.provinceId, item.assetId, 'auction', auction.id, count);
    }
    let listingRefund = 0;
    if (auction.listingFeeStatus === 'held') {
      listingRefund = auction.listingFee ?? 0;
      const held = cashMicros(world.auctionFeeEscrowCredits ?? 0);
      const refund = cashMicros(listingRefund);
      if (held < refund) fail('CASH_MIGRATION_LISTING_FEE', '拍卖发布费托管不足', auction.id);
      if (refund > 0n) {
        const seller = account(world, auction.sellerId, '拍卖发布人');
        seller.credits = cashAdd(seller.credits, listingRefund);
      }
      world.auctionFeeEscrowCredits = cashMoney(held - refund);
      auction.listingFeeStatus = 'refunded';
    }
    auction.status = 'cancelled'; auction.escrowStatus = 'released'; auction.settledAt = at;
    auction.settlementReason = 'migration_cancelled';
    events.push({ kind: 'auction-retirement', id: auction.id, refundedBid, listingRefund });
  }
}

function assertRetainedCashFunding(world) {
  const bids = new Map(); let listingFees = 0n;
  for (const auction of world.assetAuctions ?? []) {
    if (auction.status !== 'open') continue;
    const amount = cashMicros(auction.highestBid ?? 0);
    if (amount) {
      const id = String(auction.highestBidderId);
      bids.set(id, (bids.get(id) ?? 0n) + amount);
    }
    if (auction.listingFeeStatus === 'held') listingFees += cashMicros(auction.listingFee ?? 0);
  }
  for (const contract of world.productionContracts ?? []) {
    if (contract.kind !== 'facility_lease') continue;
    const lessee = cashMicros(contract.lesseeEscrowCredits ?? contract.buyerEscrowCredits ?? 0)
      + cashMicros(contract.lesseeBondCredits ?? contract.buyerBondCredits ?? 0);
    const lessor = cashMicros(contract.lessorBondCredits ?? contract.supplierBondCredits ?? 0);
    for (const [ownerId, held] of [[contract.lesseeId ?? contract.buyerId, lessee], [contract.lessorId ?? contract.supplierId, lessor]]) {
      if (!held) continue;
      const id = String(ownerId);
      bids.set(id, (bids.get(id) ?? 0n) + held);
    }
  }
  for (const [id, amount] of bids) {
    const owner = account(world, id, '保留业务资金所有者');
    if (cashMicros(owner.frozenCredits ?? 0) < amount) fail('CASH_MIGRATION_ESCROW', '托管退款将挪用保留工厂拍卖或租赁合同的资金', id);
  }
  if (cashMicros(world.auctionFeeEscrowCredits ?? 0) < listingFees) fail('CASH_MIGRATION_LISTING_FEE', '发布费退款将挪用保留工厂拍卖的托管', 'world');
}

function assertNoUnfinishedLegacyWork(world, at) {
  if (cashTimestamp(world.lastProcessedAt) !== at) fail('CASH_MIGRATION_WORLD_STALE', '切换时点必须与当前权威世界截止时间一致，不能回填历史价格迁移', 'world');
  for (const [id, player] of Object.entries(world.players ?? {})) {
    for (const group of player.facilityGroups ?? []) {
      if (group.cashCycle) { assertCashProductionCycle(group); continue; }
      if (group.status === 'running' || group.cycleStartedAt != null) {
        fail('CASH_MIGRATION_ACTIVE_PRODUCTION', '旧生产周期需先按原条款完成，不能清空其投入或重置进度', `${id}:${group.provinceId}:${group.facilityTypeId}`);
      }
    }
    for (const task of player.transportTaskState?.tasks ?? []) {
      if (task.kind === 'supply' && ['active', 'cancelling'].includes(task.status)) fail('CASH_MIGRATION_ACTIVE_SUPPLY', '产业补给任务需先完成在途交付和预算核对', `${id}:${task.id}`);
    }
  }
  for (const shipment of world.transportShipments ?? []) {
    if (shipment.status === 'arrived') continue;
    if ((shipment.cargoLots ?? []).some((lot) => quantity(lot.quantity, '在途数量') > 0)
      || (shipment.taskCargo ?? []).some((lot) => lot.kind === 'supply' && quantity(lot.quantity, '在途补给') > 0)) {
      fail('CASH_MIGRATION_IN_TRANSIT', '玩家自有在途商品需先完成来源与卸货结算', shipment.id);
    }
  }
  for (const order of world.orders ?? []) {
    if (order.ownerId > 0 && ['open', 'partial'].includes(order.status) && (order.assetKind ?? 'commodity') === 'commodity') {
      fail('CASH_MIGRATION_OPEN_ORDER', '必须先按旧订单条款释放真实托管，不能把旧订单转换为期货', order.id);
    }
  }
}

function validateRemainingFreeze(player, key, entry) {
  const [provinceId, productId, extra] = key.split(':');
  requireCashProvince(provinceId); requireCashProduct(productId);
  if (extra !== undefined) fail('CASH_MIGRATION_INVENTORY_KEY', '商品地区键无效', key);
  const list = entry.kind === 'production' ? player.facilityGroups : entry.kind === 'commercial' ? player.commercialBuildingGroups : null;
  const typeField = entry.kind === 'production' ? 'facilityTypeId' : 'commercialTypeId';
  const group = list?.find((row) => row.provinceId === provinceId && entry.sourceId === `${provinceId}:${row[typeField]}`);
  if (group) {
    const type = (entry.kind === 'production' ? FACILITY_TYPE_CATALOG : COMMERCIAL_BUILDING_TYPE_CATALOG)
      .find((candidate) => candidate.id === group[typeField]);
    const inputs = entry.kind === 'production'
      ? type?.recipes?.find((recipe) => recipe.id === group.activeRecipeId)?.inputs : type?.consumptionInputs;
    if (inputs?.some((input) => input.productId === productId)) return;
  }
  if (entry.kind === 'transport' && entry.sourceId.startsWith('fuel:') && productId === 'industrial-fuel') {
    const route = (player.transportRoutes ?? []).find((row) => row.id === entry.sourceId.slice(5));
    if (route?.sourceProvinceId === provinceId) return;
  }
  fail('CASH_MIGRATION_UNKNOWN_FREEZE', '冻结来源仍未结束、无法解释或不属于该地区，禁止折现', `${player.userId}:${key}:${entry.kind}:${entry.sourceId}`);
}

function liquidateInventory(world, at, reports) {
  for (const [id, player] of Object.entries(world.players ?? {})) {
    assertCommodityInvestmentAccount(player);
    const creditsBefore = player.credits;
    let value = 0n; const items = [];
    for (const [key, stock] of Object.entries(player.inventories ?? {})) {
      const [provinceId, productId, extra] = key.split(':');
      if (extra !== undefined) fail('CASH_MIGRATION_INVENTORY_KEY', '商品地区键无效', key);
      requireCashProvince(provinceId); requireCashProduct(productId);
      try { assertCommodityFreezeInvariant(stock); } catch (error) { fail('CASH_MIGRATION_CUSTODY', error.message, `${id}:${key}`); }
      if (quantity(stock.inTransit, '在途库存') > 0) fail('CASH_MIGRATION_IN_TRANSIT', '在途资产不能同时作为本地库存折现', `${id}:${key}`);
      if (quantity(stock.frozen, '冻结库存') > 0 && !stock.freezes) fail('CASH_MIGRATION_UNKNOWN_FREEZE', '历史冻结缺少可信来源', `${id}:${key}`);
      for (const entry of Object.values(stock.freezes ?? {})) validateRemainingFreeze(player, key, entry);
      const count = quantity(quantity(stock.available, '可用库存') + quantity(stock.frozen, '冻结库存'), '折现数量');
      if (!count) continue;
      const quote = officialCashPrice(world, provinceId, productId, at);
      const amount = cashProduct(quote.price, count, '库存折现金额');
      value += cashMicros(amount);
      items.push({ provinceId, productId, quantity: count, price: quote.price, amount });
    }
    const liquidationCredits = cashMoney(value, '玩家折现合计');
    player.credits = cashMoney(cashMicros(player.credits) + value, '迁移后可用资金');
    // This is an accounting adjustment, not production, trade, investment profit or a weekly cash windfall.
    player.cashInventoryMigration = { version: 1, at, priceDateKey: cashDateKey(at), liquidationCredits, items };
    player.inventories = {};
    reports.push({ userId: Number(id), creditsBefore, creditsAfter: player.credits, liquidationCredits, commodityKinds: items.length });
  }
}

function assertMigrationVersion(world) {
  if (world.cashEconomy === undefined) return false;
  const state = world.cashEconomy;
  if (!state || state.version !== CASH_ECONOMY_MIGRATION_VERSION || state.indexPolicyId !== COMMODITY_INDEX_POLICY_ID) {
    throw cashEconomyError('CASH_MIGRATION_VERSION', '现金经济版本或价格政策不兼容，不能重复迁移或降级');
  }
  cashTimestamp(state.activatedAt);
  return true;
}

/** Returns an opaque server-only plan. No input object, market counter, audit or balance is changed. */
export function planCashEconomyMigration(world, at) {
  cashTimestamp(at);
  if (assertMigrationVersion(world)) {
    return Object.freeze({ ready: true, alreadyApplied: true, at: world.cashEconomy.activatedAt, players: [], events: [], blockers: [] });
  }
  const fingerprint = HASH(world);
  const draft = structuredClone(world);
  const events = []; const players = [];
  try {
    assertNoUnfinishedLegacyWork(draft, at);
    retireSupplyContracts(draft, at, events);
    retireCommodityAuctions(draft, at, events);
    assertRetainedCashFunding(draft);
    liquidateInventory(draft, at, players);
    // Cold initialization is explicit. It creates no trades and never changes a published region's price.
    for (const province of PROVINCE_CATALOG) {
      for (const product of PRODUCT_CATALOG) {
        const key = provinceScopedKey(province.id, product.id);
        if (!draft.markets?.[key]) commoditySystemPriceFor(draft, product.id, province.id, at);
        officialCashPrice(draft, province.id, product.id, at);
      }
    }
    archiveCashPriceDay(draft, at);
    draft.cashEconomy = { version: CASH_ECONOMY_MIGRATION_VERSION, activatedAt: at, indexPolicyId: COMMODITY_INDEX_POLICY_ID };
    draft.cashEconomyMigrationAudit = { version: 1, at, sourceFingerprint: fingerprint, players, events };
    const plan = Object.freeze({ ready: true, alreadyApplied: false, at, planId: HASH({ fingerprint, at }),
      players: structuredClone(players), events: structuredClone(events), blockers: [] });
    PLANS.set(plan, { fingerprint, draft, at });
    return plan;
  } catch (error) {
    if (!error?.code?.startsWith('CASH_') && !error?.code?.startsWith('INVESTMENT_')) throw error;
    return Object.freeze({ ready: false, alreadyApplied: false, at, players: [], events: [],
      blockers: [{ code: error.code, message: error.message, entity: error.entity ?? 'world' }] });
  }
}

/** Caller owns the cold SQLite transaction and cache invalidation. Never call this from a state read or a client action. */
export function applyCashEconomyMigration(world, plan) {
  if (assertMigrationVersion(world)) return { applied: false, alreadyApplied: true };
  const saved = PLANS.get(plan);
  if (!saved || !plan.ready) throw cashEconomyError('CASH_MIGRATION_PLAN_INVALID', '迁移计划无效或尚有资产阻塞');
  if (HASH(world) !== saved.fingerprint) throw cashEconomyError('CASH_MIGRATION_PLAN_STALE', '迁移计划之后世界状态已变化，必须重新核对');
  // All potentially throwing validation/allocation occurs before replacing a single authoritative field.
  const next = structuredClone(saved.draft);
  for (const key of Object.keys(world)) if (!Object.hasOwn(next, key)) delete world[key];
  Object.assign(world, next);
  PLANS.delete(plan);
  return { applied: true, alreadyApplied: false, at: saved.at };
}
