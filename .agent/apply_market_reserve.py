from pathlib import Path

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}: {old[:120]!r}')
    write(path, content.replace(old, new, 1))


def insert_after(path, anchor, addition):
    replace_once(path, anchor, anchor + addition)


# New cross-market reserve scheduler.
write('server/src/market-reserve-operations.js', r'''import { createMarketReserveAuction } from './asset-auctions.js';
import { createMarketReserveProcurementContract } from './contracts.js';
import { PRODUCT_CATALOG } from './industry-catalog.js';
import {
  MARKET_DEMAND_GROUP_CATALOG,
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
} from './market-demand/catalog.js';
import { ceilPlayerMoney } from './money.js';

export const MARKET_RESERVE_OPERATION_RULE_VERSION = 1;
export const RESERVE_CONTRACT_ENTRY_RATIO = 0.65;
export const RESERVE_CONTRACT_EXIT_RATIO = 0.90;
export const RESERVE_CONTRACT_ENTRY_CYCLES = 2;
export const RESERVE_AUCTION_ENTRY_RATIO = 1.60;
export const RESERVE_AUCTION_EXIT_RATIO = 1.25;
export const RESERVE_AUCTION_ENTRY_CYCLES = 3;
export const RESERVE_AUCTION_COOLDOWN_MS = 10 * 60 * 1000;

const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const CONTRACT_DELIVERY_INTERVAL_MS = 30 * 60 * 1000;
const CONTRACT_FIRST_DELIVERY_DELAY_MS = 10 * 60 * 1000;
const CONTRACT_OFFER_TTL_MS = 60 * 60 * 1000;
const AUCTION_DURATION_HOURS = 3;

function clamp(minimum, maximum, value) {
  return Math.max(minimum, Math.min(maximum, value));
}

function totalInventory(reserve) {
  return Math.max(0, Number(reserve?.inventory || 0))
    + Math.max(0, Number(reserve?.frozenInventory || 0));
}

function referencePriceFor(world, product) {
  return Math.max(0.01, Number(
    world.marketDemand?.priceTransmission?.products?.[product.id]?.referencePrice
      || world.markets?.[product.id]?.demand?.referencePrice
      || product.basePrice,
  ));
}

function activeReserveContracts(world) {
  return new Set((world.productionContracts || []).flatMap((contract) => (
    contract?.publisherType === 'market_reserve'
      && ['open', 'active'].includes(contract.status)
      && contract.marketReserveGroupId
      && contract.productId
      ? [`${contract.marketReserveGroupId}:${contract.productId}`]
      : []
  )));
}

function activeReserveAuctions(world) {
  return new Set((world.assetAuctions || []).flatMap((auction) => (
    auction?.sellerType === 'market_reserve'
      && auction.status === 'open'
      && auction.marketReserveGroupId
      && auction.productId
      ? [`${auction.marketReserveGroupId}:${auction.productId}`]
      : []
  )));
}

function updateShortageCounter(reserve, ratio) {
  const previous = Math.max(0, Math.floor(Number(reserve.shortageCycles || 0)));
  reserve.shortageCycles = ratio < RESERVE_CONTRACT_ENTRY_RATIO
    ? previous + 1
    : ratio >= RESERVE_CONTRACT_EXIT_RATIO
      ? 0
      : previous;
}

function updateSurplusCounter(reserve, ratio) {
  const previous = Math.max(0, Math.floor(Number(reserve.surplusCycles || 0)));
  reserve.surplusCycles = ratio > RESERVE_AUCTION_ENTRY_RATIO
    ? previous + 1
    : ratio <= RESERVE_AUCTION_EXIT_RATIO
      ? 0
      : previous;
}

function publishProcurementContract(world, group, groupState, product, reserve, now) {
  const total = totalInventory(reserve);
  const target = Math.max(1, Math.ceil(Number(reserve.targetInventory || 1)));
  const targetLevel = Math.ceil(target * RESERVE_CONTRACT_EXIT_RATIO);
  const deficit = Math.max(0, targetLevel - total);
  if (deficit < 1) return null;

  const reference = referencePriceFor(world, product);
  const shortageRate = clamp(0, 1, 1 - total / target);
  const minimum = Math.max(0.01, product.basePrice * PRICE_MIN_MULTIPLIER);
  const maximum = Math.max(minimum, product.basePrice * PRICE_MAX_MULTIPLIER);
  const unitPrice = ceilPlayerMoney(clamp(
    minimum,
    maximum,
    reference * (1.05 + 0.20 * shortageRate),
  ));
  if (!unitPrice) return null;

  const totalDeliveries = Math.min(4, Math.max(2, deficit));
  const plannedQuantity = Math.max(1, Math.ceil(deficit / totalDeliveries));
  const maxBatchBudget = Math.max(0, Number(groupState.credits || 0)) * 0.30;
  const maxQuantityByBudget = Math.floor(maxBatchBudget / unitPrice);
  const quantityPerDelivery = Math.min(plannedQuantity, maxQuantityByBudget);
  if (quantityPerDelivery < 1) return null;

  return createMarketReserveProcurementContract(world, {
    groupId: group.id,
    groupName: group.name,
    productId: product.id,
    quantityPerDelivery,
    unitPrice,
    deliveryIntervalMs: CONTRACT_DELIVERY_INTERVAL_MS,
    totalDeliveries,
    firstDeliveryDelayMs: CONTRACT_FIRST_DELIVERY_DELAY_MS,
    offerTtlMs: CONTRACT_OFFER_TTL_MS,
  }, now);
}

function publishSurplusAuction(world, group, groupState, product, reserve, now) {
  if (now < Math.max(0, Number(reserve.lastAuctionSettledAt || 0)) + RESERVE_AUCTION_COOLDOWN_MS) return null;
  const total = totalInventory(reserve);
  const target = Math.max(1, Math.ceil(Number(reserve.targetInventory || 1)));
  const disposalFloor = Math.ceil(target * RESERVE_AUCTION_EXIT_RATIO);
  const disposable = Math.max(0, total - disposalFloor);
  const lotCap = Math.max(1, Math.floor(target * 0.25));
  const quantity = Math.min(
    Math.max(0, Math.floor(Number(reserve.inventory || 0))),
    disposable,
    lotCap,
  );
  if (quantity < 1) return null;

  const reference = referencePriceFor(world, product);
  const startingBid = ceilPlayerMoney(reference * quantity * 0.85);
  const reservePrice = ceilPlayerMoney(reference * quantity * 0.95);
  if (!startingBid || !reservePrice) return null;
  return createMarketReserveAuction(world, {
    groupId: group.id,
    groupName: group.name,
    productId: product.id,
    quantity,
    startingBid,
    reservePrice: Math.max(startingBid, reservePrice),
    durationHours: AUCTION_DURATION_HOURS,
  }, now);
}

export function processMarketReserveOperations(world, now = Date.now()) {
  const liquidity = world.marketDemand?.liquidity;
  if (!liquidity?.groups) return false;
  world.marketDemand.reserveOperations ||= {
    ruleVersion: MARKET_RESERVE_OPERATION_RULE_VERSION,
    groupCycles: {},
  };
  world.marketDemand.reserveOperations.ruleVersion = MARKET_RESERVE_OPERATION_RULE_VERSION;
  world.marketDemand.reserveOperations.groupCycles ||= {};

  const contracts = activeReserveContracts(world);
  const auctions = activeReserveAuctions(world);
  let changed = false;

  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    const demandCycleId = Number(world.marketDemand?.groups?.[group.id]?.lastCycleId);
    if (!Number.isFinite(demandCycleId)) continue;
    const previousCycleId = Number(world.marketDemand.reserveOperations.groupCycles[group.id]);
    if (Number.isFinite(previousCycleId) && previousCycleId === demandCycleId) continue;
    world.marketDemand.reserveOperations.groupCycles[group.id] = demandCycleId;

    const groupState = liquidity.groups[group.id];
    if (!groupState?.reserves) continue;
    for (const [productId, reserve] of Object.entries(groupState.reserves)) {
      const product = PRODUCTS.get(productId);
      if (!product) continue;
      const target = Math.max(1, Math.ceil(Number(reserve.targetInventory || 1)));
      const ratio = totalInventory(reserve) / target;
      updateShortageCounter(reserve, ratio);
      updateSurplusCounter(reserve, ratio);
      const key = `${group.id}:${productId}`;

      if (reserve.shortageCycles >= RESERVE_CONTRACT_ENTRY_CYCLES && !contracts.has(key)) {
        const contract = publishProcurementContract(world, group, groupState, product, reserve, now);
        if (contract) {
          contracts.add(key);
          changed = true;
        }
      }

      if (reserve.surplusCycles >= RESERVE_AUCTION_ENTRY_CYCLES && !auctions.has(key)) {
        const auction = publishSurplusAuction(world, group, groupState, product, reserve, now);
        if (auction) {
          auctions.add(key);
          changed = true;
        }
      }
    }
  }
  return changed;
}
''')

# Market demand constants and emergency reserve order role.
replace_once(
    'server/src/market-demand/catalog.js',
    "export const LIQUIDITY_SIGNAL_WEIGHT = 0.50;\n",
    "export const LIQUIDITY_SIGNAL_WEIGHT = 0.50;\nexport const LIQUIDITY_EMERGENCY_SIGNAL_WEIGHT = 0.25;\n",
)

replace_once(
    'server/src/market-demand.js',
    "const LIQUIDITY_TIERS = new Set(['liquidity-buy', 'liquidity-sell']);",
    "const LIQUIDITY_TIERS = new Set(['liquidity-buy', 'liquidity-sell', 'liquidity-emergency-sell']);",
)
replace_once(
    'server/src/market-demand.js',
    "      const expectedSide = order.demandTier === 'liquidity-buy' ? 'buy' : 'sell';",
    "      const expectedSide = order.demandTier === 'liquidity-buy' ? 'buy' : 'sell';",
)

# Market liquidity: empty player sell book -> small expensive reserve ask backed by real inventory.
replace_once(
    'server/src/market-liquidity.js',
    "  ordersForDemandGroup,\n  recordOrderBookReduction,\n} from './order-book-runtime.js';",
    "  getOrderBookSide,\n  ordersForDemandGroup,\n  recordOrderBookReduction,\n} from './order-book-runtime.js';",
)
replace_once(
    'server/src/market-liquidity.js',
    "const LIQUIDITY_BUY = 'liquidity-buy';\nconst LIQUIDITY_SELL = 'liquidity-sell';",
    "const LIQUIDITY_BUY = 'liquidity-buy';\nconst LIQUIDITY_SELL = 'liquidity-sell';\nconst LIQUIDITY_EMERGENCY_SELL = 'liquidity-emergency-sell';",
)
replace_once(
    'server/src/market-liquidity.js',
    "      totalSellValue: 0,\n    };",
    "      totalSellValue: 0,\n      shortageCycles: 0,\n      surplusCycles: 0,\n      lastAuctionSettledAt: 0,\n    };",
)
replace_once(
    'server/src/market-liquidity.js',
    "      totalSellValue: roundMoney(Number(previous?.totalSellValue || 0)),\n    };",
    "      totalSellValue: roundMoney(Number(previous?.totalSellValue || 0)),\n      shortageCycles: Math.max(0, Math.floor(Number(previous?.shortageCycles || 0))),\n      surplusCycles: Math.max(0, Math.floor(Number(previous?.surplusCycles || 0))),\n      lastAuctionSettledAt: Math.max(0, Number(previous?.lastAuctionSettledAt || 0)),\n    };",
)
replace_once(
    'server/src/market-liquidity.js',
    "      && (order.demandTier === LIQUIDITY_BUY || order.demandTier === LIQUIDITY_SELL)\n",
    "      && (order.demandTier === LIQUIDITY_BUY || order.demandTier === LIQUIDITY_SELL || order.demandTier === LIQUIDITY_EMERGENCY_SELL)\n",
)
replace_once(
    'server/src/market-liquidity.js',
    "      const removable = ask?.demandGroupId === groupId && ask?.demandTier === LIQUIDITY_SELL\n        ? ask",
    "      const removable = ask?.demandGroupId === groupId && [LIQUIDITY_SELL, LIQUIDITY_EMERGENCY_SELL].includes(ask?.demandTier)\n        ? ask",
)
replace_once(
    'server/src/market-liquidity.js',
    "  function createOrder(world, group, product, side, price, quantity, cycleId, now) {\n",
    "  function hasPlayerSellOrder(world, productId) {\n    return getOrderBookSide(world, { assetKind: 'commodity', assetId: productId, side: 'sell' })\n      .some((order) => order.ownerType === 'player');\n  }\n\n  function emergencyAskFor(world, product, reserve) {\n    const referencePrice = Math.max(ORDER_PRICE_TICK, Number(\n      world.marketDemand.priceTransmission.products[product.id]?.referencePrice || product.basePrice,\n    ));\n    const target = Math.max(1, Number(reserve.targetInventory || 1));\n    const totalInventory = reserve.inventory + reserve.frozenInventory;\n    const shortageRate = clamp(0, 1, 1 - totalInventory / target);\n    const minimum = Math.max(ORDER_PRICE_TICK, ceilPlayerMoney(product.basePrice * PRICE_MIN_MULTIPLIER) || ORDER_PRICE_TICK);\n    const maximum = Math.max(minimum, floorPlayerMoney(product.basePrice * PRICE_MAX_MULTIPLIER) || minimum);\n    const highestSystemBid = bestSystemPrice(world, product.id, 'buy');\n    const nonCrossingFloor = highestSystemBid === null\n      ? minimum\n      : (ceilPlayerMoney(highestSystemBid + ORDER_PRICE_TICK) || maximum + ORDER_PRICE_TICK);\n    const raw = ceilPlayerMoney(referencePrice * (1.25 + 0.35 * shortageRate)) || minimum;\n    const ask = Math.max(minimum, nonCrossingFloor, raw);\n    return ask <= maximum ? ask : null;\n  }\n\n  function createOrder(world, group, product, side, price, quantity, cycleId, now, demandTier = null) {\n",
)
replace_once(
    'server/src/market-liquidity.js',
    "      demandTier: side === 'buy' ? LIQUIDITY_BUY : LIQUIDITY_SELL,",
    "      demandTier: demandTier || (side === 'buy' ? LIQUIDITY_BUY : LIQUIDITY_SELL),",
)
replace_once(
    'server/src/market-liquidity.js',
    "      let sellQuantity = 0;\n      if (quote.ask !== null) {\n        const safetyStock = Math.max(LIQUIDITY_MIN_TARGET, Math.floor(reserve.targetInventory * 0.20));\n        sellQuantity = Math.max(0, reserve.inventory - safetyStock);\n        if (sellQuantity > 0) {\n          reserve.inventory -= sellQuantity;\n          reserve.frozenInventory += sellQuantity;\n          createOrder(world, group, product, 'sell', quote.ask, sellQuantity, cycleId, now);\n        }\n      }\n\n      repairCrossedSystemBook(world, group.id, product.id);\n      reserve.lastBidPrice = quote.bid ?? 0;\n      reserve.lastAskPrice = quote.ask ?? 0;\n      reserve.lastBidQuantity = buyQuantity;\n      reserve.lastAskQuantity = sellQuantity;",
    "      let sellQuantity = 0;\n      let sellPrice = quote.ask;\n      if (quote.ask !== null) {\n        const safetyStock = Math.max(LIQUIDITY_MIN_TARGET, Math.floor(reserve.targetInventory * 0.20));\n        sellQuantity = Math.max(0, reserve.inventory - safetyStock);\n        if (sellQuantity > 0) {\n          reserve.inventory -= sellQuantity;\n          reserve.frozenInventory += sellQuantity;\n          createOrder(world, group, product, 'sell', quote.ask, sellQuantity, cycleId, now);\n        }\n      }\n\n      if (sellQuantity === 0 && reserve.inventory > 0 && !hasPlayerSellOrder(world, product.id)) {\n        const emergencyAsk = emergencyAskFor(world, product, reserve);\n        const emergencyQuantity = Math.min(\n          reserve.inventory,\n          Math.max(1, Math.ceil(reserve.targetInventory * 0.05)),\n        );\n        if (emergencyAsk !== null && emergencyQuantity > 0) {\n          reserve.inventory -= emergencyQuantity;\n          reserve.frozenInventory += emergencyQuantity;\n          createOrder(\n            world, group, product, 'sell', emergencyAsk, emergencyQuantity, cycleId, now,\n            LIQUIDITY_EMERGENCY_SELL,\n          );\n          sellQuantity = emergencyQuantity;\n          sellPrice = emergencyAsk;\n        }\n      }\n\n      repairCrossedSystemBook(world, group.id, product.id);\n      reserve.lastBidPrice = quote.bid ?? 0;\n      reserve.lastAskPrice = sellPrice ?? 0;\n      reserve.lastBidQuantity = buyQuantity;\n      reserve.lastAskQuantity = sellQuantity;",
)
replace_once(
    'server/src/market-liquidity.js',
    "    LIQUIDITY_BUY,\n    LIQUIDITY_SELL,\n  };",
    "    LIQUIDITY_BUY,\n    LIQUIDITY_SELL,\n    LIQUIDITY_EMERGENCY_SELL,\n  };",
)

# Balanced market settlement + lower signal weight for emergency reserve sells.
replace_once(
    'server/src/balanced-market.js',
    "import { LIQUIDITY_SIGNAL_WEIGHT } from './market-demand/catalog.js';",
    "import { LIQUIDITY_EMERGENCY_SIGNAL_WEIGHT, LIQUIDITY_SIGNAL_WEIGHT } from './market-demand/catalog.js';",
)
replace_once(
    'server/src/balanced-market.js',
    "const LIQUIDITY_BUY = 'liquidity-buy';\nconst LIQUIDITY_SELL = 'liquidity-sell';",
    "const LIQUIDITY_BUY = 'liquidity-buy';\nconst LIQUIDITY_SELL = 'liquidity-sell';\nconst LIQUIDITY_EMERGENCY_SELL = 'liquidity-emergency-sell';",
)
replace_once(
    'server/src/balanced-market.js',
    "  const isLiquidityOrder = (order) => order?.ownerType === 'population'\n    && (order?.demandTier === LIQUIDITY_BUY || order?.demandTier === LIQUIDITY_SELL);",
    "  const isLiquidityOrder = (order) => order?.ownerType === 'population'\n    && [LIQUIDITY_BUY, LIQUIDITY_SELL, LIQUIDITY_EMERGENCY_SELL].includes(order?.demandTier);\n  const isEmergencyLiquidityOrder = (order) => order?.ownerType === 'population'\n    && order?.demandTier === LIQUIDITY_EMERGENCY_SELL;",
)
replace_once(
    'server/src/balanced-market.js',
    "        if (sell.demandTier === LIQUIDITY_SELL) settleLiquiditySell(world, sell, quantity, price);",
    "        if ([LIQUIDITY_SELL, LIQUIDITY_EMERGENCY_SELL].includes(sell.demandTier)) settleLiquiditySell(world, sell, quantity, price);",
)
replace_once(
    'server/src/balanced-market.js',
    "        const signalWeight = liquidityTrade ? LIQUIDITY_SIGNAL_WEIGHT : 1;",
    "        const emergencyLiquidityTrade = isEmergencyLiquidityOrder(buy) || isEmergencyLiquidityOrder(sell);\n        const signalWeight = emergencyLiquidityTrade\n          ? LIQUIDITY_EMERGENCY_SIGNAL_WEIGHT\n          : liquidityTrade ? LIQUIDITY_SIGNAL_WEIGHT : 1;",
)

# Contracts: market reserve is a system buyer with real reserve credits and no fake player record.
insert_after(
    'server/src/contracts.js',
    "function playerFor(world, userId) {\n  return world.players?.[String(userId)] || null;\n}\n",
    r'''
function marketReserveGroupFor(world, contract) {
  return world.marketDemand?.liquidity?.groups?.[String(contract?.marketReserveGroupId || '')] || null;
}

function marketReserveProductFor(world, contract) {
  return marketReserveGroupFor(world, contract)?.reserves?.[String(contract?.productId || '')] || null;
}

function holdMarketReserveCredits(group, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  if (target <= 0) return true;
  if (!group || Number(group.credits || 0) + 0.0000001 < target) return false;
  group.credits = Math.max(0, roundInternalMoney(Number(group.credits || 0) - target) || 0);
  group.frozenCredits = Math.max(0, roundInternalMoney(Number(group.frozenCredits || 0) + target) || 0);
  return true;
}

function consumeMarketReserveFrozenCredits(group, amount) {
  const target = Math.max(0, roundInternalMoney(amount || 0) || 0);
  if (!group || target <= 0) return 0;
  const consumed = Math.min(target, Math.max(0, roundInternalMoney(group.frozenCredits || 0) || 0));
  group.frozenCredits = Math.max(0, roundInternalMoney(Number(group.frozenCredits || 0) - consumed) || 0);
  return consumed;
}

function releaseMarketReserveCredits(group, amount) {
  const released = consumeMarketReserveFrozenCredits(group, amount);
  if (group && released > 0) group.credits = Math.max(0, roundInternalMoney(Number(group.credits || 0) + released) || 0);
  return released;
}

function transferMarketReserveBondToPlayer(group, player, amount) {
  const transferred = consumeMarketReserveFrozenCredits(group, amount);
  if (player && transferred > 0) player.credits = Math.max(0, roundInternalMoney(Number(player.credits || 0) + transferred) || 0);
  return transferred;
}

function transferPlayerBondToMarketReserve(player, group, amount) {
  const transferred = consumeFrozenCredits(player, amount);
  if (group && transferred > 0) group.credits = Math.max(0, roundInternalMoney(Number(group.credits || 0) + transferred) || 0);
  return transferred;
}
''',
)
replace_once(
    'server/src/contracts.js',
    "    publisherName: String(contract?.publisherName || '玩家'),\n    kind: 'supply',",
    "    publisherName: String(contract?.publisherName || '玩家'),\n    publisherType: contract?.publisherType === 'market_reserve' ? 'market_reserve' : 'player',\n    fixedTerms: contract?.fixedTerms === true,\n    marketReserveGroupId: contract?.marketReserveGroupId ? String(contract.marketReserveGroupId) : null,\n    kind: 'supply',",
)

# Reserve contract settlement helpers are inserted before the normal player-player active contract path.
insert_after(
    'server/src/contracts.js',
    "function gracePeriodFor(contract) {\n  return Math.max(10 * 60 * 1000, Math.min(Math.floor(contract.deliveryIntervalMs / 2), 6 * 60 * 60 * 1000));\n}\n",
    r'''
function fundMarketReserveBatch(world, contract) {
  const group = marketReserveGroupFor(world, contract);
  const gross = batchGross(contract);
  if (!group || !gross) return false;
  if (contract.buyerEscrowCredits >= gross) return true;
  const required = roundInternalMoney(gross - contract.buyerEscrowCredits) || 0;
  if (!holdMarketReserveCredits(group, required)) return false;
  contract.buyerEscrowCredits = addMoney(contract.buyerEscrowCredits, required) || 0;
  return true;
}

function completeMarketReserveContract(world, contract, supplier, now) {
  const group = marketReserveGroupFor(world, contract);
  releaseMarketReserveCredits(group, contract.buyerBondCredits);
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
  contract.status = 'completed';
  contract.completedAt = now;
  contract.nextDueAt = null;
  contract.roundStatus = 'ready';
  delete contract.graceEndsAt;
}

function releaseMarketReserveContractEscrow(world, contract, supplier) {
  const group = marketReserveGroupFor(world, contract);
  releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
  releaseFrozenCredits(supplier, contract.supplierBondCredits);
  releaseSupplierGoods(contract, supplier);
  contract.buyerEscrowCredits = 0;
  contract.buyerBondCredits = 0;
  contract.supplierBondCredits = 0;
}

function settleMarketReserveBatch(world, contract, supplier, now, runtimeIndex) {
  const group = marketReserveGroupFor(world, contract);
  const reserve = marketReserveProductFor(world, contract);
  const gross = batchGross(contract);
  if (!group || !reserve || !gross) return false;
  if (contract.buyerEscrowCredits < gross || contract.supplierReservedQuantity < contract.quantityPerDelivery) return false;
  const supplierInventory = inventoryFor(supplier, contract.productId);
  if (supplierInventory.frozen < contract.quantityPerDelivery) return false;

  return runtimeIndex.transition(contract, () => {
    supplierInventory.frozen -= contract.quantityPerDelivery;
    contract.supplierReservedQuantity -= contract.quantityPerDelivery;
    reserve.inventory = Math.max(0, Math.floor(Number(reserve.inventory || 0))) + contract.quantityPerDelivery;
    consumeMarketReserveFrozenCredits(group, gross);
    contract.buyerEscrowCredits = Math.max(0, roundInternalMoney(contract.buyerEscrowCredits - gross) || 0);

    const previousGross = contract.marketSellFeeGross;
    const previousFee = contract.marketSellFeeCharged;
    const nextGross = roundInternalMoney(previousGross + gross) || 0;
    const nextFee = calculateCumulativeMarketSellFee(nextGross);
    const fee = Math.max(0, roundInternalMoney(nextFee - previousFee) || 0);
    const net = Math.max(0, roundInternalMoney(gross - fee) || 0);
    contract.marketSellFeeGross = nextGross;
    contract.marketSellFeeCharged = nextFee;
    supplier.credits = roundInternalMoney(Number(supplier.credits || 0) + net) || 0;
    if (fee > 0) creditPopulationEmployment(world, fee, 'marketService');

    const supplierStats = normalizeStats(supplier);
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
      completeMarketReserveContract(world, contract, supplier, now);
      return true;
    }
    if (contract.terminationRequestedBy) {
      releaseMarketReserveContractEscrow(world, contract, supplier);
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
    if (contract.buyerAutoFund) fundMarketReserveBatch(world, contract);
    if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);
    contract.roundStatus = contract.buyerEscrowCredits >= gross
      && contract.supplierReservedQuantity >= contract.quantityPerDelivery
      ? 'ready'
      : 'preparing';
    return true;
  });
}

function terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex) {
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
  const group = marketReserveGroupFor(world, contract);
  const reserve = marketReserveProductFor(world, contract);
  const supplier = playerFor(world, contract.supplierId);
  if (!group || !reserve || !supplier) {
    runtimeIndex.transition(contract, () => {
      if (supplier) {
        releaseFrozenCredits(supplier, contract.supplierBondCredits);
        releaseSupplierGoods(contract, supplier);
      }
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'participant_missing';
    });
    return;
  }
  normalizeStats(supplier);
  if (contract.buyerAutoFund) fundMarketReserveBatch(world, contract);
  if (contract.supplierAutoReserve) reserveSupplierBatch(contract, supplier);

  const gross = batchGross(contract);
  const fundsReady = Boolean(gross && contract.buyerEscrowCredits >= gross);
  const goodsReady = contract.supplierReservedQuantity >= contract.quantityPerDelivery;
  contract.roundStatus = fundsReady && goodsReady ? 'ready' : contract.graceEndsAt ? 'grace' : 'preparing';
  if (now < Number(contract.nextDueAt || Number.POSITIVE_INFINITY)) return;
  if (fundsReady && goodsReady) {
    settleMarketReserveBatch(world, contract, supplier, now, runtimeIndex);
    return;
  }
  if (!contract.graceEndsAt) {
    contract.graceEndsAt = now + gracePeriodFor(contract);
    contract.roundStatus = 'grace';
    return;
  }
  if (now < contract.graceEndsAt) return;
  const defaultParty = goodsReady && !fundsReady
    ? 'buyer'
    : !goodsReady && fundsReady
      ? 'supplier'
      : 'both';
  terminateMarketReserveForDefault(world, contract, supplier, defaultParty, now, runtimeIndex);
}
''',
)
replace_once(
    'server/src/contracts.js',
    "    if (contract.status !== 'active') continue;\n    if (contract.kind !== 'supply') {",
    "    if (contract.status !== 'active') continue;\n    if (contract.kind !== 'supply') {",
)
# Add reserve branch after commercial branch closes.
replace_once(
    'server/src/contracts.js',
    "      processCommercialContract(world, contract, now, runtimeIndex);\n      continue;\n    }\n    if (contract.renewalProposal?.status === 'proposed'",
    "      processCommercialContract(world, contract, now, runtimeIndex);\n      continue;\n    }\n    if (contract.publisherType === 'market_reserve') {\n      processMarketReserveContract(world, contract, now, runtimeIndex);\n      continue;\n    }\n    if (contract.renewalProposal?.status === 'proposed'",
)

# Export reserve procurement publication helper.
replace_once(
    'server/src/contracts.js',
    "export function processProductionContracts(world, now = Date.now()) {\n  processProductionContractsWithIndex(world, now);\n  return world;\n}\n\nfunction createContract(world, user, payload, now, runtimeIndex) {",
    r'''export function processProductionContracts(world, now = Date.now()) {
  processProductionContractsWithIndex(world, now);
  return world;
}

export function createMarketReserveProcurementContract(world, payload, now = Date.now()) {
  migrateProductionContractWorld(world);
  const groupId = String(payload?.groupId || '');
  const group = world.marketDemand?.liquidity?.groups?.[groupId];
  const productId = PRODUCT_IDS.has(String(payload?.productId || '')) ? String(payload.productId) : null;
  const quantityPerDelivery = positiveInteger(payload?.quantityPerDelivery, MAX_QUANTITY);
  const unitPrice = positiveMoney(payload?.unitPrice, MAX_UNIT_PRICE);
  const deliveryIntervalMs = exactAllowedInteger(payload?.deliveryIntervalMs, PRODUCTION_CONTRACT_INTERVALS);
  const totalDeliveries = positiveInteger(payload?.totalDeliveries, MAX_DELIVERIES);
  const firstDeliveryDelayMs = exactAllowedInteger(payload?.firstDeliveryDelayMs, PRODUCTION_CONTRACT_FIRST_DELAYS);
  if (!group || !productId || !quantityPerDelivery || !unitPrice || !deliveryIntervalMs || !totalDeliveries || firstDeliveryDelayMs === null) return null;
  if (totalDeliveries < MIN_DELIVERIES) return null;
  if ((world.productionContracts || []).some((contract) => (
    contract.publisherType === 'market_reserve'
      && contract.marketReserveGroupId === groupId
      && contract.productId === productId
      && ['open', 'active'].includes(contract.status)
  ))) return null;
  const groupName = String(payload?.groupName || groupId);
  const offerTtlMs = Math.max(10 * 60 * 1000, Number(payload?.offerTtlMs || 60 * 60 * 1000));
  const contract = normalizeContract({
    id: `market-reserve-contract-${randomUUID()}`,
    publisherId: 0,
    publisherName: `${groupName}储备`,
    publisherType: 'market_reserve',
    fixedTerms: true,
    marketReserveGroupId: groupId,
    publisherRole: 'buyer',
    buyerId: 0,
    buyerName: `${groupName}储备`,
    supplierId: null,
    supplierName: null,
    productId,
    quantityPerDelivery,
    unitPrice,
    deliveryIntervalMs,
    totalDeliveries,
    completedDeliveries: 0,
    firstDeliveryDelayMs,
    createdAt: now,
    offerExpiresAt: now + offerTtlMs,
    buyerAutoFund: true,
    supplierAutoReserve: true,
    negotiations: [],
    status: 'open',
  });
  world.productionContracts.push(contract);
  return contract;
}

function createContract(world, user, payload, now, runtimeIndex) {''',
)

# Reserve acceptance.
insert_after(
    'server/src/contracts.js',
    "  return result(true, '长期供货合同已发布');\n}\n",
    r'''
function acceptMarketReserveContract(world, contract, user, now, runtimeIndex) {
  const supplier = playerFor(world, user.id);
  const group = marketReserveGroupFor(world, contract);
  const gross = batchGross(contract);
  const bond = gross ? bondFor(gross) : null;
  if (!supplier || !group || !gross || !bond) return result(false, '市场储备合同状态异常');
  if (Number(group.credits || 0) < gross + bond) return result(false, '市场储备当前可用采购资金不足，请稍后再试');
  if (Number(supplier.credits || 0) < bond) return result(false, `供应方需要至少 ¤${bond} 履约保证金`);

  runtimeIndex.transition(contract, () => {
    if (!holdMarketReserveCredits(group, gross + bond)) return;
    supplier.credits = roundInternalMoney(Number(supplier.credits || 0) - bond) || 0;
    supplier.frozenCredits = addMoney(supplier.frozenCredits, bond) || 0;
    contract.supplierId = Number(supplier.userId);
    contract.supplierName = supplier.playerName;
    contract.buyerEscrowCredits = gross;
    contract.buyerBondCredits = bond;
    contract.supplierBondCredits = bond;
    contract.acceptedAt = now;
    contract.nextDueAt = now + contract.firstDeliveryDelayMs;
    contract.status = 'active';
    contract.roundStatus = 'preparing';
    contract.negotiations = [];
    reserveSupplierBatch(contract, supplier);
    if (contract.supplierReservedQuantity >= contract.quantityPerDelivery) contract.roundStatus = 'ready';
  });
  return result(true, '市场储备采购合同已签订并进入履约');
}
''',
)
replace_once(
    'server/src/contracts.js',
    "  if (runtimeIndex.activeCountForParticipant(contract.publisherId) >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '发布者进行中的合同数量已达上限');",
    "  if (contract.publisherType !== 'market_reserve'\n    && runtimeIndex.activeCountForParticipant(contract.publisherId) >= MAX_ACTIVE_CONTRACTS_PER_PLAYER) return result(false, '发布者进行中的合同数量已达上限');",
)
replace_once(
    'server/src/contracts.js',
    "  if (contract.kind !== 'supply') {\n    return acceptCommercialContract(world, contract, user, now, runtimeIndex) || result(false, '合同类型不存在');\n  }\n\n  const accepter = playerFor(world, user.id);",
    "  if (contract.kind !== 'supply') {\n    return acceptCommercialContract(world, contract, user, now, runtimeIndex) || result(false, '合同类型不存在');\n  }\n  if (contract.publisherType === 'market_reserve') return acceptMarketReserveContract(world, contract, user, now, runtimeIndex);\n\n  const accepter = playerFor(world, user.id);",
)
replace_once(
    'server/src/contracts.js',
    "  return contract?.kind === 'supply' && contract.status === 'open' ? contract : null;",
    "  return contract?.kind === 'supply' && contract.status === 'open' && contract.fixedTerms !== true ? contract : null;",
)
replace_once(
    'server/src/contracts.js',
    "  if (!contract) return result(false, '进行中的合同不存在');\n  const remaining = Math.max(0, contract.totalDeliveries - contract.completedDeliveries);",
    "  if (!contract) return result(false, '进行中的合同不存在');\n  if (contract.fixedTerms) return result(false, '市场储备采购合同使用固定条款，不支持续签议价');\n  const remaining = Math.max(0, contract.totalDeliveries - contract.completedDeliveries);",
)

# Reserve immediate termination by the player supplier pays its bond to the reserve.
replace_once(
    'server/src/contracts.js',
    "function terminateNow(world, user, payload, now, runtimeIndex) {\n  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);\n  if (!contract) return result(false, '进行中的合同不存在');\n  const buyer = playerFor(world, contract.buyerId);",
    r'''function terminateNow(world, user, payload, now, runtimeIndex) {
  const contract = ownActiveContract(runtimeIndex, user.id, payload.contractId);
  if (!contract) return result(false, '进行中的合同不存在');
  if (contract.publisherType === 'market_reserve') {
    const supplier = playerFor(world, contract.supplierId);
    const group = marketReserveGroupFor(world, contract);
    if (!supplier || !group || contract.supplierId !== Number(user.id)) return result(false, '市场储备合同参与者异常');
    runtimeIndex.transition(contract, () => {
      releaseMarketReserveCredits(group, addMoney(contract.buyerEscrowCredits, contract.buyerBondCredits));
      transferPlayerBondToMarketReserve(supplier, group, contract.supplierBondCredits);
      releaseSupplierGoods(contract, supplier);
      contract.buyerEscrowCredits = 0;
      contract.buyerBondCredits = 0;
      contract.supplierBondCredits = 0;
      contract.status = 'terminated';
      contract.endedAt = now;
      contract.terminationReason = 'immediate_by_participant';
      normalizeStats(supplier).contractDefaults += 1;
    });
    return result(true, '合同已立即终止，供应方履约保证金已赔付市场储备');
  }
  const buyer = playerFor(world, contract.buyerId);''',
)

# Public contract issue and fixed-term identity.
replace_once(
    'server/src/contracts.js',
    "  if (contract.status !== 'active') return null;\n  const buyer = playerFor(world, contract.buyerId);",
    r'''  if (contract.status !== 'active') return null;
  if (contract.publisherType === 'market_reserve') {
    const supplier = playerFor(world, contract.supplierId);
    const group = marketReserveGroupFor(world, contract);
    const reserve = marketReserveProductFor(world, contract);
    const gross = batchGross(contract) || 0;
    if (!supplier || !group || !reserve) return '市场储备合同参与者异常';
    if (contract.graceEndsAt) {
      if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '供应方商品不足，正在宽限期';
      if (contract.buyerEscrowCredits < gross) return '市场储备采购资金不足，正在宽限期';
      return '宽限期内等待结算';
    }
    if (contract.supplierReservedQuantity < contract.quantityPerDelivery) return '等待供应方准备商品';
    if (contract.buyerEscrowCredits < gross) return '等待市场储备补充本批采购资金';
    return null;
  }
  const buyer = playerFor(world, contract.buyerId);''',
)
replace_once(
    'server/src/contracts.js',
    "function publicNegotiations(world, contract, userId) {\n  if (contract.kind !== 'supply' || contract.status !== 'open') return [];",
    "function publicNegotiations(world, contract, userId) {\n  if (contract.kind !== 'supply' || contract.status !== 'open' || contract.fixedTerms) return [];",
)
replace_once(
    'server/src/contracts.js',
    "    publisherName: contract.publisherName,\n    publisherRole: contract.publisherRole,",
    "    publisherName: contract.publisherName,\n    publisherType: contract.publisherType,\n    fixedTerms: contract.fixedTerms,\n    publisherRole: contract.publisherRole,",
)

# Auctions: reserve may be a commodity-only seller backed by frozen reserve inventory.
insert_after(
    'server/src/asset-auctions.js',
    "function playerName(world, id, fallback = '未分配') { return player(world, id)?.playerName || fallback; }\n",
    r'''
function marketReserveGroup(world, groupId) {
  return world.marketDemand?.liquidity?.groups?.[String(groupId || '')] || null;
}
function marketReserveProduct(world, groupId, productId) {
  return marketReserveGroup(world, groupId)?.reserves?.[String(productId || '')] || null;
}
function holdMarketReserveAuctionInventory(world, groupId, productId, quantity) {
  const reserve = marketReserveProduct(world, groupId, productId);
  if (!reserve || Number(reserve.inventory || 0) < quantity) return false;
  reserve.inventory = Math.max(0, Math.floor(Number(reserve.inventory || 0)) - quantity);
  reserve.frozenInventory = Math.max(0, Math.floor(Number(reserve.frozenInventory || 0))) + quantity;
  return true;
}
function releaseMarketReserveAuctionInventory(world, groupId, productId, quantity) {
  const reserve = marketReserveProduct(world, groupId, productId);
  if (!reserve) return 0;
  const released = Math.min(Math.max(0, Math.floor(Number(reserve.frozenInventory || 0))), quantity);
  reserve.frozenInventory -= released;
  reserve.inventory = Math.max(0, Math.floor(Number(reserve.inventory || 0))) + released;
  return released;
}
''',
)
replace_once(
    'server/src/asset-auctions.js',
    "  auction.sellerId = integer(auction.sellerId) || 0;\n  auction.sellerName = text(auction.sellerName, 64, `玩家 ${auction.sellerId}`);",
    "  auction.sellerType = auction.sellerType === 'market_reserve' ? 'market_reserve' : 'player';\n  auction.marketReserveGroupId = auction.sellerType === 'market_reserve' ? String(auction.marketReserveGroupId || '') : null;\n  auction.sellerId = auction.sellerType === 'market_reserve' ? 0 : (integer(auction.sellerId) || 0);\n  auction.sellerName = text(auction.sellerName, 64, auction.sellerType === 'market_reserve' ? '市场储备' : `玩家 ${auction.sellerId}`);",
)
replace_once(
    'server/src/asset-auctions.js',
    "function releaseAuctionAsset(world, auction, now) {\n  if (auction.escrowStatus !== 'held') return;\n  releaseItems(world, auction.sellerId, auctionItems(auction), now);\n  auction.escrowStatus = 'released';\n}",
    r'''function releaseAuctionAsset(world, auction, now) {
  if (auction.escrowStatus !== 'held') return;
  if (auction.sellerType === 'market_reserve') {
    for (const item of auctionItems(auction)) {
      if (item.assetKind === 'commodity') {
        releaseMarketReserveAuctionInventory(
          world, auction.marketReserveGroupId, item.assetId, item.quantity,
        );
      }
    }
  } else {
    releaseItems(world, auction.sellerId, auctionItems(auction), now);
  }
  auction.escrowStatus = 'released';
}''',
)
replace_once(
    'server/src/asset-auctions.js',
    "function validateAuctionTransfer(world, auction, bidder) {\n  const seller = player(world, auction.sellerId);\n  if (!seller) return result(false, '卖家不存在');\n  for (const item of auctionItems(auction)) {\n    if (item.assetKind === 'commodity') {\n      if (inventoryFor(seller, item.assetId).frozen < item.quantity) return result(false, '拍卖商品冻结数量不足');",
    r'''function validateAuctionTransfer(world, auction, bidder) {
  const reserveSeller = auction.sellerType === 'market_reserve';
  const seller = reserveSeller ? null : player(world, auction.sellerId);
  if (!seller && !reserveSeller) return result(false, '卖家不存在');
  for (const item of auctionItems(auction)) {
    if (reserveSeller && item.assetKind !== 'commodity') return result(false, '市场储备只能拍卖商品');
    if (item.assetKind === 'commodity') {
      const frozen = reserveSeller
        ? Number(marketReserveProduct(world, auction.marketReserveGroupId, item.assetId)?.frozenInventory || 0)
        : Number(inventoryFor(seller, item.assetId).frozen || 0);
      if (frozen < item.quantity) return result(false, '拍卖商品冻结数量不足');''',
)
replace_once(
    'server/src/asset-auctions.js',
    "function transferAuctionAsset(world, auction, bidder, now) {\n  const seller = player(world, auction.sellerId);\n  const validation = validateAuctionTransfer(world, auction, bidder);\n  if (!seller || !validation.ok) return validation;\n  const sellerSnapshot = structuredClone(seller);\n  const bidderSnapshot = structuredClone(bidder);",
    r'''function transferAuctionAsset(world, auction, bidder, now) {
  const reserveSeller = auction.sellerType === 'market_reserve';
  const seller = reserveSeller ? null : player(world, auction.sellerId);
  const validation = validateAuctionTransfer(world, auction, bidder);
  if ((!seller && !reserveSeller) || !validation.ok) return validation;
  const sellerSnapshot = seller ? structuredClone(seller) : null;
  const reserveSnapshot = reserveSeller ? structuredClone(marketReserveGroup(world, auction.marketReserveGroupId)) : null;
  const bidderSnapshot = structuredClone(bidder);''',
)
replace_once(
    'server/src/asset-auctions.js',
    "      if (item.assetKind === 'commodity') {\n        const sellerInventory = inventoryFor(seller, item.assetId);\n        sellerInventory.frozen -= item.quantity;\n        inventoryFor(bidder, item.assetId).available += item.quantity;\n        seller.stats ||= {};\n        bidder.stats ||= {};\n        seller.stats.commodityVolume = Number(seller.stats.commodityVolume || 0) + item.quantity;\n        bidder.stats.commodityVolume = Number(bidder.stats.commodityVolume || 0) + item.quantity;\n        seller.stats.soldGoods = Number(seller.stats.soldGoods || 0) + item.quantity;\n        bidder.stats.boughtGoods = Number(bidder.stats.boughtGoods || 0) + item.quantity;\n      }",
    r'''      if (item.assetKind === 'commodity') {
        if (reserveSeller) {
          const reserve = marketReserveProduct(world, auction.marketReserveGroupId, item.assetId);
          reserve.frozenInventory -= item.quantity;
        } else {
          const sellerInventory = inventoryFor(seller, item.assetId);
          sellerInventory.frozen -= item.quantity;
          seller.stats ||= {};
          seller.stats.commodityVolume = Number(seller.stats.commodityVolume || 0) + item.quantity;
          seller.stats.soldGoods = Number(seller.stats.soldGoods || 0) + item.quantity;
        }
        inventoryFor(bidder, item.assetId).available += item.quantity;
        bidder.stats ||= {};
        bidder.stats.commodityVolume = Number(bidder.stats.commodityVolume || 0) + item.quantity;
        bidder.stats.boughtGoods = Number(bidder.stats.boughtGoods || 0) + item.quantity;
      }''',
)
replace_once(
    'server/src/asset-auctions.js',
    "  } catch (error) {\n    world.players[String(auction.sellerId)] = sellerSnapshot;\n    world.players[String(auction.highestBidderId)] = bidderSnapshot;",
    "  } catch (error) {\n    if (sellerSnapshot) world.players[String(auction.sellerId)] = sellerSnapshot;\n    if (reserveSnapshot) world.marketDemand.liquidity.groups[auction.marketReserveGroupId] = reserveSnapshot;\n    world.players[String(auction.highestBidderId)] = bidderSnapshot;",
)
replace_once(
    'server/src/asset-auctions.js',
    "function finalizeAuction(world, auction, now, status, reason) {\n  auction.status = status;\n  auction.settlementReason = reason;\n  auction.settledAt = now;\n}",
    r'''function finalizeAuction(world, auction, now, status, reason) {
  auction.status = status;
  auction.settlementReason = reason;
  auction.settledAt = now;
  if (auction.sellerType === 'market_reserve') {
    const reserve = marketReserveProduct(world, auction.marketReserveGroupId, auction.productId);
    if (reserve) reserve.lastAuctionSettledAt = now;
  }
}''',
)
replace_once(
    'server/src/asset-auctions.js',
    "  const seller = player(world, auction.sellerId);\n  if (!seller) {\n    cancelBrokenAuction(world, auction, now, '卖家不存在');\n    return;\n  }",
    "  const reserveSeller = auction.sellerType === 'market_reserve';\n  const seller = reserveSeller ? null : player(world, auction.sellerId);\n  if (!seller && !reserveSeller) {\n    cancelBrokenAuction(world, auction, now, '卖家不存在');\n    return;\n  }",
)
replace_once(
    'server/src/asset-auctions.js',
    "  bidder.frozenCredits = subtractMoney(bidder.frozenCredits, auction.highestBid);\n  seller.credits = addMoney(seller.credits, net);\n  if (sellerFee > 0) {\n    creditPopulationEmployment(world, sellerFee, 'marketService');\n    seller.stats ||= {};\n    seller.stats.marketServiceFees = addMoney(seller.stats.marketServiceFees, sellerFee);\n    seller.stats.employmentPayments = addMoney(seller.stats.employmentPayments, sellerFee);\n  }",
    r'''  bidder.frozenCredits = subtractMoney(bidder.frozenCredits, auction.highestBid);
  if (reserveSeller) {
    const group = marketReserveGroup(world, auction.marketReserveGroupId);
    if (!group) {
      cancelBrokenAuction(world, auction, now, '市场储备账户不存在');
      return;
    }
    group.credits = addMoney(group.credits, net);
  } else {
    seller.credits = addMoney(seller.credits, net);
  }
  if (sellerFee > 0) {
    creditPopulationEmployment(world, sellerFee, 'marketService');
    if (seller) {
      seller.stats ||= {};
      seller.stats.marketServiceFees = addMoney(seller.stats.marketServiceFees, sellerFee);
      seller.stats.employmentPayments = addMoney(seller.stats.employmentPayments, sellerFee);
    }
  }''',
)

# Export automatic reserve auction creation before minimumBidFor.
replace_once(
    'server/src/asset-auctions.js',
    "  return result(true, `${label}拍卖已发布，已支付发布费 ¤${listingFee.toFixed(2)}，资产已冻结`);\n}\n\nfunction minimumBidFor(auction) {",
    r'''  return result(true, `${label}拍卖已发布，已支付发布费 ¤${listingFee.toFixed(2)}，资产已冻结`);
}

export function createMarketReserveAuction(world, payload, now = Date.now()) {
  migrateAssetAuctionWorld(world, now);
  const groupId = String(payload?.groupId || '');
  const group = marketReserveGroup(world, groupId);
  const productId = String(payload?.productId || '');
  const product = PRODUCTS.get(productId);
  const quantity = integer(payload?.quantity, MAX_AUCTION_QUANTITY);
  const startingBid = money(payload?.startingBid, MAX_BID);
  const reservePrice = optionalMoney(payload?.reservePrice, MAX_BID);
  const durationHours = integer(payload?.durationHours || 3, MAX_AUCTION_HOURS);
  if (!group || !product || !quantity || !startingBid || !durationHours) return null;
  if (reservePrice !== null && reservePrice < startingBid) return null;
  if ((world.assetAuctions || []).some((auction) => (
    auction.sellerType === 'market_reserve'
      && auction.marketReserveGroupId === groupId
      && auction.productId === productId
      && auction.status === 'open'
  ))) return null;
  const listingFee = calculateAuctionListingFee(startingBid, reservePrice);
  const minimumIncrement = calculateAuctionMinimumIncrement(startingBid);
  if (listingFee === null || minimumIncrement === null || Number(group.credits || 0) < listingFee) return null;
  if (!holdMarketReserveAuctionInventory(world, groupId, productId, quantity)) return null;

  group.credits = subtractMoney(group.credits, listingFee);
  world.auctionFeeEscrowCredits = addMoney(world.auctionFeeEscrowCredits, listingFee);
  const originalEndsAt = now + durationHours * 60 * 60 * 1_000;
  const groupName = String(payload?.groupName || groupId);
  const auction = applyAuctionAliases({
    id: `market-reserve-auction-${randomUUID()}`,
    auctionRuleVersion: ASSET_AUCTION_RULE_VERSION,
    items: [{ assetKind: 'commodity', assetId: productId, quantity }],
    sellerType: 'market_reserve',
    marketReserveGroupId: groupId,
    sellerId: 0,
    sellerName: `${groupName}储备`,
    startingBid,
    reservePrice,
    minimumIncrement,
    highestBid: null,
    highestBidderId: null,
    bidderAliases: {},
    bidCount: 0,
    latestBidAt: null,
    status: 'open',
    escrowStatus: 'held',
    createdAt: now,
    originalEndsAt,
    endsAt: originalEndsAt,
    extensionWindowMs: AUCTION_EXTENSION_WINDOW_MS,
    extensionDurationMs: AUCTION_EXTENSION_DURATION_MS,
    maxExtensionMs: AUCTION_MAX_EXTENSION_MS,
    extensionCount: 0,
    listingFeeRuleVersion: 1,
    listingFee,
    listingFeeStatus: 'held',
    sellerFeeBps: AUCTION_SELLER_FEE_BPS,
    buyerFeeBps: AUCTION_BUYER_FEE_BPS,
    sellerFee: null,
    sellerNetProceeds: null,
    settlementReason: null,
    bids: [],
  });
  world.assetAuctions.push(auction);
  world.assetAuctions = world.assetAuctions.slice(-MAX_AUCTIONS);
  queueAuctionAuditEvent(world, {
    auctionId: auction.id,
    eventType: 'created',
    actorUserId: null,
    amount: listingFee,
    metadata: { marketReserveGroupId: groupId, startingBid, reservePrice, minimumIncrement, listingFee },
    createdAt: now,
  });
  return auction;
}

function minimumBidFor(auction) {''',
)
replace_once(
    'server/src/asset-auctions.js',
    "    sellerName: auction.sellerName,\n    startingBid: auction.startingBid,",
    "    sellerName: auction.sellerName,\n    sellerType: auction.sellerType,\n    startingBid: auction.startingBid,",
)

# Runtime scheduler: evaluate reserve cross-market actions after the market demand cycle is advanced.
replace_once(
    'server/src/runtime-store.js',
    "import { createEconomicCalendarClientState } from './economic-events.js';",
    "import { createEconomicCalendarClientState } from './economic-events.js';\nimport { processMarketReserveOperations } from './market-reserve-operations.js';",
)
replace_once(
    'server/src/runtime-store.js',
    "    if (processed) {\n      processProductionContracts(world, now);",
    "    if (processed) {\n      processMarketReserveOperations(world, now);\n      processProductionContracts(world, now);",
)

# Contract audit: reserve is a system buyer, not a missing player.
replace_once(
    'server/src/contract-audit-store.js',
    "    publisherName: String(contract.publisherName || '玩家'),\n    publisherRole: contract.publisherRole === 'supplier' ? 'supplier' : 'buyer',",
    "    publisherName: String(contract.publisherName || '玩家'),\n    publisherType: contract.publisherType === 'market_reserve' ? 'market_reserve' : 'player',\n    fixedTerms: contract.fixedTerms === true,\n    marketReserveGroupId: contract.marketReserveGroupId ? String(contract.marketReserveGroupId) : null,\n    publisherRole: contract.publisherRole === 'supplier' ? 'supplier' : 'buyer',",
)
replace_once(
    'server/src/contract-audit-store.js',
    "  const buyer = world.players?.[String(contract.buyerId)];\n  if (!buyer) {\n    reasons.push('participant_missing');\n  } else {",
    "  const reserveBuyer = contract.publisherType === 'market_reserve';\n  const buyer = reserveBuyer ? null : world.players?.[String(contract.buyerId)];\n  if (!reserveBuyer && !buyer) {\n    reasons.push('participant_missing');\n  } else if (!reserveBuyer) {",
)

# Client contract identity and fixed term presentation.
replace_once(
    'src/contracts/types.ts',
    "  publisherName: string;\n  publisherRole: ProductionContractRole;",
    "  publisherName: string;\n  publisherType?: 'player' | 'market_reserve';\n  fixedTerms?: boolean;\n  publisherRole: ProductionContractRole;",
)
replace_once(
    'src/pages/ContractPage.tsx',
    "function RoleTag({ contract }: { contract: ProductionContract }) {\n  if (contract.kind === 'loan') {",
    "function RoleTag({ contract }: { contract: ProductionContract }) {\n  if (contract.publisherType === 'market_reserve') return <StatusTag tone=\"info\">市场储备采购</StatusTag>;\n  if (contract.kind === 'loan') {",
)
replace_once(
    'src/pages/ContractPage.tsx',
    "function ContractRenewalSection({ contract, busy, run }: ContractCardProps) {\n  const proposal = contract.renewalProposal;",
    "function ContractRenewalSection({ contract, busy, run }: ContractCardProps) {\n  if (contract.fixedTerms) return null;\n  const proposal = contract.renewalProposal;",
)
replace_once(
    'src/pages/ContractPage.tsx',
    "      <p className=\"contract-offer-note\">合同不会控制你的工厂或配方；你需要自行保证每批商品、资金和仓库条件。</p>\n      <ContractNegotiationSection contract={contract} busy={busy} run={run} />",
    "      <p className=\"contract-offer-note\">{contract.fixedTerms\n        ? '市场储备采购使用固定条款，不参与议价；承接后仍按正式托管、履约保证金和交付规则结算。'\n        : '合同不会控制你的工厂或配方；你需要自行保证每批商品、资金和仓库条件。'}</p>\n      {contract.fixedTerms ? null : <ContractNegotiationSection contract={contract} busy={busy} run={run} />}",
)

# Dedicated server tests.
write('server/test/market-reserve-operations.test.js', r'''import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer, processWorld } from '../src/domain.js';
import { applyAssetAuctionAction, processAssetAuctions } from '../src/asset-auctions.js';
import { applyProductionContractAction, processProductionContracts } from '../src/contracts.js';
import { processMarketReserveOperations } from '../src/market-reserve-operations.js';

const now = 1_800_000_000_000;
const cycleMs = 5 * 60 * 1000;
const supplierUser = { id: 701, email: 'reserve-supplier@example.com', name: 'Reserve Supplier' };
const bidderUser = { id: 702, email: 'reserve-bidder@example.com', name: 'Reserve Bidder' };

function forceDemandCycle(world, groupId, cycleId) {
  world.marketDemand.groups[groupId].lastCycleId = cycleId;
}

function reserveFor(world, groupId = 'food', productId = 'wheat') {
  return world.marketDemand.liquidity.groups[groupId].reserves[productId];
}

function reserveGroup(world, groupId = 'food') {
  return world.marketDemand.liquidity.groups[groupId];
}

test('empty player sell book receives a small expensive emergency reserve ask backed by real inventory', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, bidderUser, now);
  player.credits = 100_000;
  const reserve = reserveFor(world);
  reserve.inventory = 1;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 20;
  for (const state of Object.values(world.demandGroups)) {
    state.nextDemandAt = now;
    state.lastCycleId = Math.floor(now / cycleMs) - 1;
  }
  processWorld(world, now + 1);

  const emergency = world.orders.find((order) => (
    order.productId === 'wheat'
      && order.demandTier === 'liquidity-emergency-sell'
      && ['open', 'partial'].includes(order.status)
  ));
  assert.ok(emergency);
  assert.ok(emergency.price > Number(world.marketDemand.priceTransmission.products.wheat.referencePrice || 0));
  assert.ok(emergency.quantity <= Math.max(1, Math.ceil(reserve.targetInventory * 0.05)));
  assert.equal(reserve.inventory + reserve.frozenInventory >= 1, true);

  const result = applyAction(world, bidderUser, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: emergency.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  const latest = world.markets.wheat.priceHistory.at(-1);
  assert.equal(latest.marketRole, 'liquidity');
  assert.equal(latest.signalWeight, 0.25);
});

test('two shortage cycles publish a fixed-term market reserve procurement contract and settle into reserve inventory', () => {
  const world = createWorld(now);
  const supplier = ensurePlayer(world, supplierUser, now);
  supplier.credits = 10_000;
  supplier.inventories.wheat.available = 100;
  const reserve = reserveFor(world);
  reserve.inventory = 1;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 20;
  reserveGroup(world).credits = 20_000;
  reserveGroup(world).frozenCredits = 0;

  forceDemandCycle(world, 'food', 100);
  processMarketReserveOperations(world, now);
  assert.equal(world.productionContracts?.some((contract) => contract.publisherType === 'market_reserve'), false);
  forceDemandCycle(world, 'food', 101);
  processMarketReserveOperations(world, now + cycleMs);

  const contract = world.productionContracts.find((item) => item.publisherType === 'market_reserve' && item.productId === 'wheat');
  assert.ok(contract);
  assert.equal(contract.fixedTerms, true);
  assert.equal(contract.publisherId, 0);
  assert.equal(world.players['0'], undefined);
  const fundsBefore = reserveGroup(world).credits + reserveGroup(world).frozenCredits;
  const inventoryBefore = reserve.inventory + reserve.frozenInventory;

  const accepted = applyProductionContractAction(world, supplierUser, 'acceptProductionContract', {
    contractId: contract.id,
  }, now + cycleMs + 1);
  assert.equal(accepted.ok, true);
  assert.equal(contract.status, 'active');
  assert.ok(reserveGroup(world).frozenCredits >= contract.batchGross + contract.buyerBondCredits);
  assert.equal(contract.negotiations.length, 0);

  processProductionContracts(world, Number(contract.nextDueAt) + 1);
  assert.equal(contract.completedDeliveries, 1);
  assert.equal(reserve.inventory + reserve.frozenInventory, inventoryBefore + contract.quantityPerDelivery);
  assert.ok(reserveGroup(world).credits + reserveGroup(world).frozenCredits < fundsBefore);
  assert.ok(supplier.stats.contractGoodsSupplied >= contract.quantityPerDelivery);
});

test('three surplus cycles publish a real-inventory reserve auction and return net proceeds to reserve credits', () => {
  const world = createWorld(now);
  const bidder = ensurePlayer(world, bidderUser, now);
  bidder.credits = 100_000;
  const reserve = reserveFor(world);
  reserve.inventory = 40;
  reserve.frozenInventory = 0;
  reserve.targetInventory = 10;
  const group = reserveGroup(world);
  group.credits = 10_000;
  group.frozenCredits = 0;

  for (let index = 0; index < 3; index += 1) {
    forceDemandCycle(world, 'food', 200 + index);
    processMarketReserveOperations(world, now + index * cycleMs);
  }
  const auction = world.assetAuctions.find((item) => item.sellerType === 'market_reserve' && item.productId === 'wheat');
  assert.ok(auction);
  assert.equal(auction.sellerId, 0);
  assert.equal(world.players['0'], undefined);
  assert.ok(reserve.frozenInventory >= auction.quantity);
  assert.ok(auction.quantity <= Math.max(1, Math.floor(reserve.targetInventory * 0.25)));

  const bid = applyAssetAuctionAction(world, bidderUser, 'placeAuctionBid', {
    auctionId: auction.id,
    amount: auction.reservePrice,
  }, now + 2 * cycleMs + 1);
  assert.equal(bid.ok, true);
  const reserveCreditsBeforeSettlement = group.credits;
  processAssetAuctions(world, Number(auction.endsAt) + 1);
  assert.equal(auction.status, 'sold');
  assert.ok(bidder.inventories.wheat.available >= auction.quantity);
  assert.ok(group.credits > reserveCreditsBeforeSettlement);
  assert.ok(reserve.lastAuctionSettledAt >= auction.endsAt);
});
''')

# Static anti-regression verification.
write('scripts/verify-market-reserve-operations.mjs', r'''import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requiredFiles = [
  'server/src/market-reserve-operations.js',
  'server/src/market-liquidity.js',
  'server/src/balanced-market.js',
  'server/src/contracts.js',
  'server/src/asset-auctions.js',
  'server/src/runtime-store.js',
  'server/test/market-reserve-operations.test.js',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of requiredFiles) if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
for (const text of [
  'RESERVE_CONTRACT_ENTRY_RATIO = 0.65',
  'RESERVE_CONTRACT_ENTRY_CYCLES = 2',
  'RESERVE_AUCTION_ENTRY_RATIO = 1.60',
  'RESERVE_AUCTION_ENTRY_CYCLES = 3',
  'createMarketReserveProcurementContract',
  'createMarketReserveAuction',
]) requireText('server/src/market-reserve-operations.js', text);
for (const text of ['liquidity-emergency-sell', 'referencePrice * (1.25 + 0.35 * shortageRate)', 'Math.ceil(reserve.targetInventory * 0.05)']) requireText('server/src/market-liquidity.js', text);
requireText('server/src/market-demand/catalog.js', 'LIQUIDITY_EMERGENCY_SIGNAL_WEIGHT = 0.25');
for (const text of ["publisherType: 'market_reserve'", 'fixedTerms: true', '市场储备采购合同已签订并进入履约']) requireText('server/src/contracts.js', text);
for (const text of ["sellerType: 'market_reserve'", 'market-reserve-auction-', 'group.credits = addMoney(group.credits, net)']) requireText('server/src/asset-auctions.js', text);
requireText('server/src/runtime-store.js', 'processMarketReserveOperations(world, now)');
for (const path of ['server/src/contracts.js', 'server/src/asset-auctions.js', 'server/src/market-reserve-operations.js']) {
  const source = read(path);
  if (source.includes("world.players['0']") || source.includes('world.players[\"0\"]')) failures.push(`${path} 不得创建伪市场储备玩家`);
}
for (const text of ['紧急储备卖单', '市场储备采购合同', '储备清仓拍卖']) requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', text);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log('market reserve operations verification passed');
''')

# Package verification chain.
replace_once(
    'package.json',
    "node scripts/verify-staple-crops-demand.mjs && node --experimental-strip-types scripts/verify-market-assets.mjs",
    "node scripts/verify-staple-crops-demand.mjs && node scripts/verify-market-reserve-operations.mjs && node --experimental-strip-types scripts/verify-market-assets.mjs",
)

# Authoritative design updates. Keep rules in existing authorities only.
insert_after(
    'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
    "储备买入商品进入储备库存，不被消费；储备卖出商品减少储备库存并把玩家支付资金归入储备资金池。玩家卖给储备买单仍按统一卖单手续费规则收费，但成交额不计入 `populationIssued`；玩家从储备卖单买入时系统不是玩家卖方，不产生卖方手续费。\n",
    r'''

市场储备在订单簿之外还承担受约束的跨市场库存调节，但所有行为继续使用同一真实储备资金与库存，不创建系统玩家、无限商品或额外货币：

- **市场储备采购合同**：某商品总储备库存（可用 + 全部冻结）低于目标库存 65% 且连续两个完整五分钟周期后，储备可以在合同页发布固定条款采购合同；库存恢复到目标库存 90% 后短缺计数清零。合同目标只补向 90% 目标位，拆为 2～4 批，首批 10 分钟后交付、之后每 30 分钟一批；单位采购价为 `clamp(基础价 50%, 基础价 300%, 参考价 × (1.05 + 0.20 × 短缺率))` 并向上量化到两位小数。单批货款最多使用发布时可用储备资金的 30%，实际承接时仍必须从真实储备可用资金冻结首批货款和 20% 采购方保证金，供应方仍冻结 20% 履约保证金并按现有商品合同规则缴纳累计 1% 市场服务费。储备合同不参与议价、续签或自由文本协商；同组同商品最多同时存在一份公开或履约中的储备采购合同。
- **紧急储备卖单**：商品不存在任何玩家卖单、正常储备卖单也无法形成且储备仍有真实可用库存时，储备可以突破正常 20% 安全库存，额外挂出一小档 `liquidity-emergency-sell`。单档数量为 `min(可用库存, max(1, ceil(目标库存 × 5%)))`，价格为 `max(合法非交叉价, 参考价 × (1.25 + 0.35 × 短缺率))`，仍必须处于基础价 50%～300% 且严格高于系统最高买价。库存为 0 时不得生成卖单。紧急储备成交继续是真实储备库存换取玩家已有资金，但价格传导权重固定为 25%，低于普通储备成交的 50%，避免最后供应者高价形成自激式参考价上涨。
- **储备清仓拍卖**：总储备库存高于目标库存 160% 且连续三个完整周期后，储备可以在拍卖页发布单商品清仓拍卖；库存回落到 125% 后过剩计数清零。单次只冻结高于 125% 目标位的可处置库存，并且最多为目标库存 25%，不得动用已经冻结给订单簿或其他拍卖的商品。默认起拍总价为当前参考总价值 85%，隐藏保留价为 95%，时长 3 小时；最低加价、发布费、自动延时和卖方成交手续费完全复用正式拍卖规则。发布费与 1% 卖方手续费进入人口市场服务就业收入，成交净收入返回储备资金；流拍或未达保留价时商品原额回到储备库存，并至少等待 10 分钟后才允许重新清仓。市场储备不得参与玩家拍卖竞价。

储备跨市场行为沿用聚合冻结字段：`frozenCredits` 同时包含订单簿与已签储备采购合同冻结资金，`frozenInventory` 同时包含订单簿与储备拍卖冻结商品；每个订单、合同和拍卖只释放或消费自身记录的冻结数量。目标库存、库存率和守恒统计始终读取可用与冻结之和，因此资产从订单簿转入合同或拍卖不会被误判为凭空减少。

扩展后的守恒关系为：

```text
当前储备库存 = 一次性种子库存 + 订单簿买入数量 + 储备采购合同交付数量 - 普通储备卖出数量 - 紧急储备卖出数量 - 储备拍卖成交数量
当前储备资金 = 一次性种子资金 + 普通／紧急储备卖出收入 + 储备拍卖净收入 - 订单簿买入支出 - 储备采购合同货款 - 储备拍卖发布费 - 储备拍卖卖方手续费
```

合同、拍卖流拍、违约、服务重启和模型迁移都不得重新播种储备资产或通过补差方式恢复目标库存/目标资金。
''',
)

# Order book design: emergency tier and stale directory count correction.
replace_once(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    "每名玩家的商品和工厂订单合计最多同时存在 `PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length` 笔未完成订单；当前目录为 32 种商品加 22 种工厂类型，因此当前上限为 52 笔，目录增减时自动变化。",
    "每名玩家的商品和工厂订单合计最多同时存在 `PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length` 笔未完成订单；上限必须始终由正式目录动态计算，不得在业务逻辑或防回退检查中固化旧目录数量。当前权威目录为 36 种商品与 26 种工厂类型，即当前上限 62 笔；目录增减时自动变化。",
)
insert_after(
    'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
    "- 市场储备卖单创建时从储备可用库存转入冻结库存，成交扣除真实冻结库存并增加储备资金，撤单释放未成交部分。\n",
    "- 当玩家卖盘为空、正常储备卖单无法形成且储备仍有真实可用库存时，允许创建内部 `liquidity-emergency-sell` 紧急储备卖单；其冻结、成交、撤单与普通储备卖单共用真实 `frozenInventory`，单档最多为目标库存 5% 且仍受基础价 50%～300% 与系统盘口非交叉约束。紧急储备成交的价格传导权重固定 25%，不得用于扩大预算或制造额外商品。\n",
)

# Page responsibilities.
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    "独立资产页面已经永久删除，资产总览唯一归属银行页；不得恢复 `assets` 路由、`AssetsPage`、资产导航或兼容重定向。不得恢复独立订单页、成交记录页、仓库页、工厂实例页、`records` 路由或设施槽位页面。拍卖和合同是正式独立页面；拍卖不得合并进商品与工厂订单簿，合同不得塞入市场订单簿或生产页。`collections` 路由、`CollectionsPage` 和艺术资产导航已永久删除，不提供兼容页面。\n",
    "\n市场储备跨市场行为继续使用现有两个正式页面：储备采购合同只作为合同广场中的固定条款采购卡片展示，明确标记“市场储备采购”，不显示议价或续签入口；储备清仓只作为拍卖页中的普通商品拍卖展示，卖家名称明确为对应市场储备。不得为市场储备新增页面、导航、独立订单簿或专用轮询。\n",
)

# Auction authority.
insert_after(
    'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
    "## 4. 商品／工厂资产拍卖\n",
    r'''

市场储备可以作为显式 `market_reserve` 系统卖方发布**单商品**储备清仓拍卖，但不得伪造玩家账号、发布工厂拍卖、参与竞买或绕过现行收费与结算规则。储备拍卖只能冻结对应需求组真实 `frozenInventory`；发布时从真实储备可用资金支付正式发布费，成交时继续收取 1% 卖方手续费并将费用转为人口市场服务就业收入，净成交款返回对应储备资金；无人出价、未达隐藏保留价或结算失败时只释放该拍卖自身冻结的真实库存。储备拍卖继续使用隐藏保留价、2% 最低加价、末两分钟自动延时与最长 30 分钟延时，不进入订单簿成交价、价格曲线或订单簿成交量。
''',
)

# Server authority.
insert_after(
    'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
    "## 1. 权威边界\n",
    r'''

市场储备不是玩家。服务器不得通过 `userId = 0`、负数 ID 或隐藏玩家档案模拟储备主体；储备采购合同使用 `publisherType = market_reserve` 与内部 `marketReserveGroupId`，储备清仓拍卖使用 `sellerType = market_reserve` 与同一需求组 ID，所有资金和商品直接结算到 `marketDemand.liquidity.groups` 的真实储备账户。普通玩家索引、排行榜、仓库、玩家统计和登录身份不得出现储备伪账号。

跨市场储备调节只在对应五分钟需求周期 `lastCycleId` 变化后评估一次，不新增每秒全商品扫描器；服务器现有权威世界推进先完成市场需求/储备订单重挂，再评估短缺合同和过剩拍卖，随后处理合同到期与履约。合同与拍卖的冻结必须与订单簿共享储备真实 `frozenCredits` / `frozenInventory` 总量且逐实体释放，审计事件把储备侧记录为系统账户。紧急储备卖单仍由订单簿周期创建，不新增独立定时器。
''',
)

# docs index wording makes cross-market reserve authority explicit.
replace_once(
    'docs/README.md',
    "库存与资金守恒的双边市场储备、生产链双向滞后价格传导",
    "库存与资金守恒且可通过订单簿、固定采购合同与储备清仓拍卖跨市场调节的市场储备、生产链双向滞后价格传导",
)

print('market reserve patch applied')
