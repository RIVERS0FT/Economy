export const ORDER_PRICE_DECIMALS = 2;
export const ACCOUNT_MONEY_DECIMALS = 6;
export const PLAYER_MONEY_DECIMALS = ORDER_PRICE_DECIMALS;
export const INTERNAL_MONEY_DECIMALS = ACCOUNT_MONEY_DECIMALS;
export const MONEY_SCALE = 1_000_000;
export const ORDER_PRICE_TICK_MICROS = 10_000;
export const ORDER_PRICE_TICK = 0.01;
export const MONEY_PRECISION_VERSION = 3;

const MONEY_SCALE_BIGINT = 1_000_000n;
const PRICE_TICK_BIGINT = 10_000n;
const MAX_SAFE_SCALED = BigInt(Number.MAX_SAFE_INTEGER);

function expandExponent(value) {
  const source = String(value).trim();
  if (!/[eE]/.test(source)) return source;
  const match = /^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(source);
  if (!match) return source;
  const [, sign, integer, fraction = '', exponentText] = match;
  const exponent = Number.parseInt(exponentText, 10);
  if (!Number.isInteger(exponent)) return source;
  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${'0'.repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function decimalParts(value) {
  if (typeof value === 'bigint') {
    return { negative: value < 0n, integer: String(value < 0n ? -value : value), fraction: '' };
  }
  if (value === null || value === undefined || value === '') return null;
  const source = expandExponent(value);
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(source);
  if (!match) return null;
  return {
    negative: match[1] === '-',
    integer: match[2].replace(/^0+(?=\d)/, '') || '0',
    fraction: match[3] || '',
  };
}

function scaledInteger(value, mode = 'half-up') {
  const parts = decimalParts(value);
  if (!parts) return null;
  const kept = parts.fraction.slice(0, ACCOUNT_MONEY_DECIMALS).padEnd(ACCOUNT_MONEY_DECIMALS, '0');
  const discarded = parts.fraction.slice(ACCOUNT_MONEY_DECIMALS);
  let magnitude = BigInt(parts.integer) * MONEY_SCALE_BIGINT + BigInt(kept || '0');
  const hasDiscarded = /[1-9]/.test(discarded);
  if (mode === 'floor' && parts.negative && hasDiscarded) magnitude += 1n;
  if (mode === 'ceil' && !parts.negative && hasDiscarded) magnitude += 1n;
  if (mode === 'half-up' && discarded && Number(discarded[0] || 0) >= 5) magnitude += 1n;
  return parts.negative ? -magnitude : magnitude;
}

function scaledToNumber(value) {
  if (value === null || value > MAX_SAFE_SCALED || value < -MAX_SAFE_SCALED) return null;
  return Number(value) / MONEY_SCALE;
}

function finiteMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function floorToMultiple(value, multiple) {
  const remainder = value % multiple;
  if (remainder === 0n) return value;
  return value >= 0n ? value - remainder : value - remainder - multiple;
}

function ceilToMultiple(value, multiple) {
  const remainder = value % multiple;
  if (remainder === 0n) return value;
  return value >= 0n ? value - remainder + multiple : value - remainder;
}

function roundToMultiple(value, multiple) {
  const quotient = value / multiple;
  const remainder = value % multiple;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  if (absoluteRemainder * 2n < multiple) return quotient * multiple;
  return (quotient + (value >= 0n ? 1n : -1n)) * multiple;
}

function divideScaled(product, denominator, mode) {
  let quotient = product / denominator;
  const remainder = product % denominator;
  if (mode === 'floor' && remainder !== 0n && product < 0n) quotient -= 1n;
  if (mode === 'ceil' && remainder !== 0n && product > 0n) quotient += 1n;
  if (mode === 'half-up' && (remainder < 0n ? -remainder : remainder) * 2n >= denominator) {
    quotient += product >= 0n ? 1n : -1n;
  }
  return quotient;
}

function exactOrderPriceMicros(value) {
  const parts = decimalParts(value);
  if (!parts || parts.fraction.length > ORDER_PRICE_DECIMALS) return null;
  const micros = scaledInteger(value, 'half-up');
  if (micros === null || micros % PRICE_TICK_BIGINT !== 0n) return null;
  return micros;
}

export function floorPlayerMoney(value) {
  const micros = scaledInteger(value, 'floor');
  return scaledToNumber(micros === null ? null : floorToMultiple(micros, PRICE_TICK_BIGINT));
}

export function ceilPlayerMoney(value) {
  const micros = scaledInteger(value, 'ceil');
  return scaledToNumber(micros === null ? null : ceilToMultiple(micros, PRICE_TICK_BIGINT));
}

export function roundInternalMoney(value) {
  return scaledToNumber(scaledInteger(value, 'half-up'));
}

export function floorInternalMoney(value) {
  return scaledToNumber(scaledInteger(value, 'floor'));
}

export function ceilInternalMoney(value) {
  return scaledToNumber(scaledInteger(value, 'ceil'));
}

export function normalizeAccountMoney(value, { allowNegative = false } = {}) {
  const normalized = roundInternalMoney(value);
  if (normalized === null || !Number.isFinite(normalized)) return null;
  return allowNegative ? normalized : Math.max(0, normalized);
}

export function normalizeOrderPrice(value, options = {}) {
  return normalizePlayerMoneyInput(value, options);
}

export function playerMoneyToCents(value, { liability = false } = {}) {
  const micros = scaledInteger(value, liability ? 'ceil' : 'floor');
  if (micros === null) return null;
  const ticked = liability ? ceilToMultiple(micros, PRICE_TICK_BIGINT) : floorToMultiple(micros, PRICE_TICK_BIGINT);
  return ticked / PRICE_TICK_BIGINT;
}

export function internalMoneyToMicros(value) {
  return scaledInteger(value, 'half-up');
}

export function centsToPlayerMoney(cents) {
  try {
    return scaledToNumber(BigInt(cents) * PRICE_TICK_BIGINT);
  } catch {
    return null;
  }
}

export function microsToInternalMoney(micros) {
  try {
    return scaledToNumber(BigInt(micros));
  } catch {
    return null;
  }
}

export function normalizePlayerMoneyInput(value, {
  min = 0.01,
  max = Number.MAX_SAFE_INTEGER / MONEY_SCALE,
  allowZero = false,
} = {}) {
  if (value === 'all') return 'all';
  const micros = exactOrderPriceMicros(value);
  const normalized = scaledToNumber(micros);
  if (normalized === null || !Number.isFinite(normalized)) return null;
  if (!allowZero && normalized <= 0) return null;
  if (normalized < min || normalized > max) return null;
  return normalized;
}

export function settlePlayerCredit(value) {
  const normalized = roundInternalMoney(value);
  return normalized === null ? 0 : Math.max(0, normalized);
}

export function settlePlayerDebit(value) {
  const normalized = ceilInternalMoney(value);
  return normalized === null ? 0 : Math.max(0, normalized);
}

export function addMoney(left, right) {
  const leftMicros = internalMoneyToMicros(left);
  const rightMicros = internalMoneyToMicros(right);
  if (leftMicros === null || rightMicros === null) return null;
  return microsToInternalMoney(leftMicros + rightMicros);
}

export function subtractMoney(left, right) {
  const leftMicros = internalMoneyToMicros(left);
  const rightMicros = internalMoneyToMicros(right);
  if (leftMicros === null || rightMicros === null) return null;
  return microsToInternalMoney(leftMicros - rightMicros);
}

export function multiplyMoneyByInteger(amount, quantity) {
  const micros = internalMoneyToMicros(amount);
  const count = Number(quantity);
  if (micros === null || !Number.isSafeInteger(count)) return null;
  return microsToInternalMoney(micros * BigInt(count));
}

export function multiplyMoneyRatio(left, right, divisor = 1, mode = 'half-up') {
  const leftMicros = internalMoneyToMicros(left);
  const rightMicros = internalMoneyToMicros(right);
  const normalizedDivisor = Number(divisor);
  if (leftMicros === null || rightMicros === null || !Number.isSafeInteger(normalizedDivisor) || normalizedDivisor <= 0) return null;
  const denominator = MONEY_SCALE_BIGINT * BigInt(normalizedDivisor);
  return microsToInternalMoney(divideScaled(leftMicros * rightMicros, denominator, mode));
}

export function calculateRateMoney(amount, rateNumerator, rateDenominator = 10_000, mode = 'half-up') {
  const micros = internalMoneyToMicros(amount);
  const numeratorNumber = Number(rateNumerator);
  const denominatorNumber = Number(rateDenominator);
  if (
    micros === null
    || !Number.isSafeInteger(numeratorNumber)
    || !Number.isSafeInteger(denominatorNumber)
    || denominatorNumber <= 0
  ) return null;
  return microsToInternalMoney(divideScaled(
    micros * BigInt(numeratorNumber),
    BigInt(denominatorNumber),
    mode,
  ));
}

export function formatPlayerMoney(value) {
  const micros = internalMoneyToMicros(value);
  const normalized = scaledToNumber(micros === null ? null : roundToMultiple(micros, PRICE_TICK_BIGINT));
  if (normalized === null) return '0.00';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: ORDER_PRICE_DECIMALS,
    maximumFractionDigits: ORDER_PRICE_DECIMALS,
    useGrouping: true,
  }).format(normalized);
}

export function formatInternalMoney(value) {
  const normalized = roundInternalMoney(value);
  if (normalized === null) return '0.000000';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: ACCOUNT_MONEY_DECIMALS,
    maximumFractionDigits: ACCOUNT_MONEY_DECIMALS,
    useGrouping: true,
  }).format(normalized);
}

const PLAYER_STAT_MONEY_KEYS = Object.freeze([
  'workIssued', 'populationIssued', 'systemSinks', 'giftIssued', 'gemExchangeCredits',
  'populationIncome', 'employmentPayments', 'productionPayroll', 'constructionPayroll',
  'warehousePayroll', 'marketServiceFees', 'bankCreditIssued', 'bankPrincipalRepaid',
  'bankInterestPaid', 'bankDepositInterestEarned', 'contractCreditsPaid',
  'contractCreditsReceived',
]);

const PLAYER_BANK_MONEY_KEYS = Object.freeze([
  'depositCredits', 'dayOpeningDepositCredits', 'dayMinimumDepositCredits',
  'totalDepositInterestEarned', 'lastDepositInterestEarned',
]);

const LIABILITY_KEYS = new Set([
  'principalOriginal', 'principalOutstanding', 'interestOriginal', 'interestOutstanding',
]);

const INTERNAL_MONEY_KEY_PATTERN = /(credits|budget|income|spent|gross|fee|totalBuyValue|totalSellValue|reserveCredits|lastDailyInterestCredits|amount|payment|subsidy|withheld)$/i;

function quantizePlayerField(_world, object, key, { liability = false } = {}) {
  if (!object || object[key] === undefined || object[key] === null) return;
  const after = liability ? ceilPlayerMoney(object[key]) : floorPlayerMoney(object[key]);
  object[key] = after === null ? 0 : Math.max(0, after);
}

function quantizeSignedDisplayField(object, key) {
  if (!object || object[key] === undefined || object[key] === null) return;
  const after = roundInternalMoney(object[key]);
  object[key] = after === null ? 0 : after;
}

function quantizeAccountField(object, key, { liability = false } = {}) {
  if (!object || object[key] === undefined || object[key] === null) return;
  const after = liability ? ceilInternalMoney(object[key]) : roundInternalMoney(object[key]);
  object[key] = after === null ? 0 : Math.max(0, after);
}

function quantizeInternalTree(node, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const entry of node) quantizeInternalTree(entry, seen);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === 'object') {
      quantizeInternalTree(value, seen);
      continue;
    }
    if (typeof value !== 'number' || !INTERNAL_MONEY_KEY_PATTERN.test(key)) continue;
    const normalized = roundInternalMoney(value);
    if (normalized !== null) node[key] = normalized;
  }
}

function normalizePlayer(world, player) {
  quantizeAccountField(player, 'credits');
  quantizeAccountField(player, 'frozenCredits');
  player.gems = Math.max(0, Math.floor(Number(player.gems || 0)));
  player.stats ||= {};
  for (const key of PLAYER_STAT_MONEY_KEYS) quantizeAccountField(player.stats, key);
  for (const entry of player.ledger || []) {
    quantizeSignedDisplayField(entry, 'amount');
    quantizeAccountField(entry, 'balanceAfter');
  }
  for (const trade of player.trades || []) {
    quantizePlayerField(world, trade, 'price');
    for (const key of ['total', 'fee', 'netTotal']) quantizeSignedDisplayField(trade, key);
  }
  const account = player.bankAccount;
  if (account && typeof account === 'object') {
    for (const key of PLAYER_BANK_MONEY_KEYS) quantizeAccountField(account, key);
    for (const transaction of account.recentTransactions || []) {
      for (const key of ['amount', 'principalPaid', 'interestPaid', 'proceeds', 'surplus', 'writtenOff']) {
        quantizeSignedDisplayField(transaction, key);
      }
    }
    const loan = account.activeLoan;
    if (loan && typeof loan === 'object') {
      for (const key of LIABILITY_KEYS) quantizeAccountField(loan, key, { liability: true });
      quantizeAccountField(loan, 'collateralValueAtOrigination');
      for (const item of loan.collateral || []) quantizeAccountField(item, 'prudentUnitValue');
    }
  }
}

function normalizeOrders(world) {
  for (const order of world.orders || []) {
    quantizePlayerField(world, order, 'price');
    for (const fill of order.fills || []) {
      quantizePlayerField(world, fill, 'price');
      for (const key of ['total', 'fee', 'netTotal']) quantizeSignedDisplayField(fill, key);
    }
    for (const slice of order.fundingSlices || []) quantizeAccountField(slice, 'reservedAmount');
    for (const key of ['marketSellFeeGross', 'marketSellFeeCharged']) {
      if (order[key] !== undefined) order[key] = Math.max(0, roundInternalMoney(order[key]) || 0);
    }
  }
}

function normalizeMarkets(world) {
  for (const market of Object.values(world.markets || {})) {
    for (const key of ['lastPrice', 'lastTradePrice']) {
      if (market?.[key] !== null && market?.[key] !== undefined) quantizePlayerField(world, market, key);
    }
    for (const point of market?.priceHistory || []) quantizePlayerField(world, point, 'price');
    const demand = market?.demand;
    if (demand) {
      for (const key of ['lastBudget', 'referencePrice', 'observedPrice', 'costAnchor', 'downstreamValueAnchor', 'targetPrice']) {
        if (demand[key] !== null && demand[key] !== undefined) demand[key] = roundInternalMoney(demand[key]) ?? demand[key];
      }
      if (demand.lastPrice !== null && demand.lastPrice !== undefined) quantizePlayerField(world, demand, 'lastPrice');
    }
  }
  for (const market of Object.values(world.facilityMarkets || {})) {
    for (const key of ['lastPrice', 'lastTradePrice']) {
      if (market?.[key] !== null && market?.[key] !== undefined) quantizePlayerField(world, market, key);
    }
    for (const point of market?.priceHistory || []) quantizePlayerField(world, point, 'price');
  }
}

function normalizeAuctions(world) {
  for (const auction of world.assetAuctions || []) {
    for (const key of ['startingBid', 'highestBid', 'minimumBid', 'reservePrice', 'minimumIncrement']) {
      if (auction[key] !== null && auction[key] !== undefined) quantizePlayerField(world, auction, key);
    }
    for (const bid of auction.bids || []) quantizePlayerField(world, bid, 'amount');
    for (const key of ['listingFee', 'sellerFee', 'sellerNetProceeds']) {
      if (auction[key] !== null && auction[key] !== undefined) auction[key] = Math.max(0, roundInternalMoney(auction[key]) || 0);
    }
  }
}

function normalizeContracts(world) {
  for (const contract of world.productionContracts || []) {
    quantizePlayerField(world, contract, 'unitPrice');
    for (const key of ['buyerEscrowCredits', 'buyerBondCredits', 'supplierBondCredits', 'lastDeliveryGross']) {
      quantizeAccountField(contract, key);
    }
    for (const key of ['lastDeliveryFee', 'marketSellFeeGross', 'marketSellFeeCharged']) {
      if (contract[key] !== undefined) contract[key] = Math.max(0, roundInternalMoney(contract[key]) || 0);
    }
    const proposal = contract.renewalProposal;
    if (proposal) {
      quantizePlayerField(world, proposal.terms || {}, 'unitPrice');
      for (const key of ['buyerEscrowCredits', 'buyerBondCredits', 'supplierBondCredits']) quantizeAccountField(proposal, key);
    }
  }
}

function migrateLegacyInterestCarry(world) {
  if (Number(world.moneyPrecision?.version || 0) >= MONEY_PRECISION_VERSION) return;
  world.bank ||= {};
  let carry = BigInt(Math.max(0, Math.trunc(Number(world.bank.interestPoolMicros || 0))));
  for (const player of Object.values(world.players || {})) {
    const account = player?.bankAccount;
    if (!account) continue;
    carry += BigInt(Math.max(0, Math.trunc(Number(account.depositInterestCarryMicros || 0))));
    account.depositInterestCarryMicros = 0;
  }
  world.bank.interestPoolMicros = carry > MAX_SAFE_SCALED ? Number.MAX_SAFE_INTEGER : Number(carry);
}

export function normalizeWorldMoneyPrecision(world) {
  if (!world || typeof world !== 'object') return world;
  migrateLegacyInterestCarry(world);
  world.moneyPrecision ||= { version: MONEY_PRECISION_VERSION, roundingReserveMicros: 0 };
  world.moneyPrecision.version = MONEY_PRECISION_VERSION;
  world.moneyPrecision.roundingReserveMicros = 0;
  for (const player of Object.values(world.players || {})) normalizePlayer(world, player);
  normalizeOrders(world);
  normalizeMarkets(world);
  normalizeAuctions(world);
  world.auctionFeeEscrowCredits = Math.max(0, roundInternalMoney(world.auctionFeeEscrowCredits || 0) || 0);
  normalizeContracts(world);
  quantizeInternalTree(world.populationEconomy);
  quantizeInternalTree(world.marketDemand);
  if (world.bank) {
    world.bank.interestPoolMicros = Math.max(0, Math.trunc(Number(world.bank.interestPoolMicros || 0)));
    quantizeInternalTree(world.bank);
  }
  return world;
}

const PLAYER_INPUT_MONEY_KEYS = new Set(['price', 'unitPrice', 'startingBid', 'reservePrice', 'amount']);

function normalizePayloadValue(value, key) {
  if (value === 'all') return value;
  if (PLAYER_INPUT_MONEY_KEYS.has(key)) return normalizePlayerMoneyInput(value);
  if (Array.isArray(value)) return value.map((entry) => normalizePayloadValue(entry, ''));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([childKey, childValue]) => [childKey, normalizePayloadValue(childValue, childKey)]));
  }
  return value;
}

export function normalizePlayerMoneyPayload(_action, payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  return normalizePayloadValue(payload, '');
}

export function assertPlayerMoney(value) {
  const numeric = finiteMoney(value);
  return numeric !== null && normalizePlayerMoneyInput(numeric, { min: -Number.MAX_SAFE_INTEGER, allowZero: true }) === numeric;
}

export const assertOrderPrice = assertPlayerMoney;

export function assertInternalMoney(value) {
  const numeric = finiteMoney(value);
  return numeric !== null && roundInternalMoney(numeric) === numeric;
}
