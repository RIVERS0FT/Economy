export const PLAYER_MONEY_DECIMALS = 2;
export const INTERNAL_MONEY_DECIMALS = 6;
export const PLAYER_MONEY_SCALE = 100;
export const INTERNAL_MONEY_SCALE = 1_000_000;
export const MONEY_PRECISION_VERSION = 1;

const PLAYER_SCALE_BIGINT = 100n;
const INTERNAL_SCALE_BIGINT = 1_000_000n;
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
  if (typeof value === 'bigint') return { negative: value < 0n, integer: String(value < 0n ? -value : value), fraction: '' };
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

function scaledInteger(value, decimals, mode = 'floor') {
  const parts = decimalParts(value);
  if (!parts) return null;
  const scale = 10n ** BigInt(decimals);
  const kept = parts.fraction.slice(0, decimals).padEnd(decimals, '0');
  const discarded = parts.fraction.slice(decimals);
  let magnitude = BigInt(parts.integer) * scale + BigInt(kept || '0');
  const hasDiscarded = /[1-9]/.test(discarded);
  if (mode === 'floor' && parts.negative && hasDiscarded) magnitude += 1n;
  if (mode === 'ceil' && !parts.negative && hasDiscarded) magnitude += 1n;
  if (mode === 'half-up' && discarded) {
    const first = Number(discarded[0] || 0);
    if (first >= 5) magnitude += 1n;
  }
  return parts.negative ? -magnitude : magnitude;
}

function scaledToNumber(value, scale) {
  if (value === null) return null;
  if (value > MAX_SAFE_SCALED || value < -MAX_SAFE_SCALED) return null;
  return Number(value) / Number(scale);
}

function finiteMoney(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function floorPlayerMoney(value) {
  return scaledToNumber(scaledInteger(value, PLAYER_MONEY_DECIMALS, 'floor'), PLAYER_SCALE_BIGINT);
}

export function ceilPlayerMoney(value) {
  return scaledToNumber(scaledInteger(value, PLAYER_MONEY_DECIMALS, 'ceil'), PLAYER_SCALE_BIGINT);
}

export function roundInternalMoney(value) {
  return scaledToNumber(scaledInteger(value, INTERNAL_MONEY_DECIMALS, 'half-up'), INTERNAL_SCALE_BIGINT);
}

export function floorInternalMoney(value) {
  return scaledToNumber(scaledInteger(value, INTERNAL_MONEY_DECIMALS, 'floor'), INTERNAL_SCALE_BIGINT);
}

export function playerMoneyToCents(value, { liability = false } = {}) {
  return scaledInteger(value, PLAYER_MONEY_DECIMALS, liability ? 'ceil' : 'floor');
}

export function internalMoneyToMicros(value) {
  return scaledInteger(value, INTERNAL_MONEY_DECIMALS, 'half-up');
}

export function centsToPlayerMoney(cents) {
  try {
    return scaledToNumber(BigInt(cents), PLAYER_SCALE_BIGINT);
  } catch {
    return null;
  }
}

export function microsToInternalMoney(micros) {
  try {
    return scaledToNumber(BigInt(micros), INTERNAL_SCALE_BIGINT);
  } catch {
    return null;
  }
}

export function normalizePlayerMoneyInput(value, {
  min = 0.01,
  max = Number.MAX_SAFE_INTEGER / PLAYER_MONEY_SCALE,
  allowZero = false,
} = {}) {
  if (value === 'all') return 'all';
  const normalized = floorPlayerMoney(value);
  if (normalized === null || !Number.isFinite(normalized)) return null;
  if (!allowZero && normalized <= 0) return null;
  if (normalized < min || normalized > max) return null;
  return normalized;
}

export function settlePlayerCredit(value) {
  const normalized = floorPlayerMoney(value);
  return normalized === null ? 0 : Math.max(0, normalized);
}

export function settlePlayerDebit(value) {
  const normalized = ceilPlayerMoney(value);
  return normalized === null ? 0 : Math.max(0, normalized);
}

export function multiplyMoneyByInteger(amount, quantity) {
  const micros = internalMoneyToMicros(amount);
  const count = Number(quantity);
  if (micros === null || !Number.isSafeInteger(count)) return null;
  const result = micros * BigInt(count);
  return microsToInternalMoney(result);
}

export function calculateRateMoney(amount, rateNumerator, rateDenominator = 10_000, mode = 'half-up') {
  const micros = internalMoneyToMicros(amount);
  const numerator = BigInt(Math.trunc(Number(rateNumerator)));
  const denominator = BigInt(Math.trunc(Number(rateDenominator)));
  if (micros === null || denominator <= 0n) return null;
  const product = micros * numerator;
  let quotient = product / denominator;
  const remainder = product % denominator;
  if (mode === 'floor' && remainder !== 0n && product < 0n) quotient -= 1n;
  if (mode === 'ceil' && remainder !== 0n && product > 0n) quotient += 1n;
  if (mode === 'half-up' && (remainder < 0n ? -remainder : remainder) * 2n >= denominator) {
    quotient += product >= 0n ? 1n : -1n;
  }
  return microsToInternalMoney(quotient);
}

export function formatPlayerMoney(value) {
  const normalized = floorPlayerMoney(value);
  if (normalized === null) return '0.00';
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: PLAYER_MONEY_DECIMALS,
    maximumFractionDigits: PLAYER_MONEY_DECIMALS,
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

function addRoundingReserve(world, decimalDifference) {
  const micros = internalMoneyToMicros(decimalDifference);
  if (micros === null || micros <= 0n) return;
  world.moneyPrecision ||= { version: MONEY_PRECISION_VERSION, roundingReserveMicros: 0 };
  const previous = BigInt(Math.max(0, Math.trunc(Number(world.moneyPrecision.roundingReserveMicros || 0))));
  const next = previous + micros;
  world.moneyPrecision.roundingReserveMicros = next > MAX_SAFE_SCALED ? Number.MAX_SAFE_INTEGER : Number(next);
}

function quantizePlayerField(world, object, key, { liability = false, reserve = true } = {}) {
  if (!object || object[key] === undefined || object[key] === null) return;
  const before = roundInternalMoney(object[key]);
  const after = liability ? ceilPlayerMoney(object[key]) : floorPlayerMoney(object[key]);
  if (before === null || after === null) {
    object[key] = 0;
    return;
  }
  object[key] = Math.max(0, after);
  if (reserve) addRoundingReserve(world, liability ? after - before : before - after);
}

function quantizeSignedDisplayField(object, key) {
  if (!object || object[key] === undefined || object[key] === null) return;
  const after = floorPlayerMoney(object[key]);
  object[key] = after === null ? 0 : after;
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
  quantizePlayerField(world, player, 'credits');
  quantizePlayerField(world, player, 'frozenCredits');
  player.gems = Math.max(0, Math.floor(Number(player.gems || 0)));
  player.stats ||= {};
  for (const key of PLAYER_STAT_MONEY_KEYS) quantizePlayerField(world, player.stats, key, { reserve: false });
  for (const entry of player.ledger || []) {
    quantizeSignedDisplayField(entry, 'amount');
    quantizePlayerField(world, entry, 'balanceAfter', { reserve: false });
  }
  for (const trade of player.trades || []) {
    for (const key of ['price', 'total', 'fee', 'netTotal']) quantizeSignedDisplayField(trade, key);
  }
  const account = player.bankAccount;
  if (account && typeof account === 'object') {
    for (const key of PLAYER_BANK_MONEY_KEYS) quantizePlayerField(world, account, key);
    for (const transaction of account.recentTransactions || []) {
      for (const key of ['amount', 'principalPaid', 'interestPaid', 'proceeds', 'surplus', 'writtenOff']) {
        quantizeSignedDisplayField(transaction, key);
      }
    }
    const loan = account.activeLoan;
    if (loan && typeof loan === 'object') {
      for (const key of LIABILITY_KEYS) quantizePlayerField(world, loan, key, { liability: true });
      for (const key of ['collateralValueAtOrigination']) quantizePlayerField(world, loan, key, { reserve: false });
      for (const item of loan.collateral || []) quantizePlayerField(world, item, 'prudentUnitValue', { reserve: false });
    }
  }
}

function normalizeOrders(world) {
  for (const order of world.orders || []) {
    quantizePlayerField(world, order, 'price', { reserve: false });
    for (const fill of order.fills || []) {
      for (const key of ['price', 'total', 'fee', 'netTotal']) quantizeSignedDisplayField(fill, key);
    }
    for (const key of ['marketSellFeeGross', 'marketSellFeeCharged']) {
      if (order[key] !== undefined) order[key] = Math.max(0, roundInternalMoney(order[key]) || 0);
    }
  }
}

function normalizeMarkets(world) {
  for (const market of Object.values(world.markets || {})) {
    for (const key of ['lastPrice', 'lastTradePrice']) {
      if (market?.[key] !== null && market?.[key] !== undefined) quantizePlayerField(world, market, key, { reserve: false });
    }
    for (const point of market?.priceHistory || []) quantizePlayerField(world, point, 'price', { reserve: false });
    const demand = market?.demand;
    if (demand) {
      for (const key of ['lastBudget', 'lastPrice', 'referencePrice', 'observedPrice', 'costAnchor', 'downstreamValueAnchor', 'targetPrice']) {
        if (demand[key] !== null && demand[key] !== undefined) demand[key] = roundInternalMoney(demand[key]) ?? demand[key];
      }
    }
  }
  for (const market of Object.values(world.facilityMarkets || {})) {
    for (const key of ['lastPrice', 'lastTradePrice']) {
      if (market?.[key] !== null && market?.[key] !== undefined) quantizePlayerField(world, market, key, { reserve: false });
    }
    for (const point of market?.priceHistory || []) quantizePlayerField(world, point, 'price', { reserve: false });
  }
}

function normalizeAuctions(world) {
  for (const auction of world.assetAuctions || []) {
    for (const key of ['startingBid', 'highestBid', 'minimumBid']) {
      if (auction[key] !== null && auction[key] !== undefined) quantizePlayerField(world, auction, key, { reserve: false });
    }
    for (const bid of auction.bids || []) quantizePlayerField(world, bid, 'amount', { reserve: false });
  }
}

function normalizeContracts(world) {
  for (const contract of world.productionContracts || []) {
    for (const key of ['unitPrice', 'buyerEscrowCredits', 'buyerBondCredits', 'supplierBondCredits', 'lastDeliveryGross']) {
      quantizePlayerField(world, contract, key, { reserve: false });
    }
    for (const key of ['lastDeliveryFee', 'marketSellFeeGross', 'marketSellFeeCharged']) {
      if (contract[key] !== undefined) contract[key] = Math.max(0, roundInternalMoney(contract[key]) || 0);
    }
    const proposal = contract.renewalProposal;
    if (proposal) {
      quantizePlayerField(world, proposal.terms || {}, 'unitPrice', { reserve: false });
      for (const key of ['buyerEscrowCredits', 'buyerBondCredits', 'supplierBondCredits']) {
        quantizePlayerField(world, proposal, key, { reserve: false });
      }
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
  world.moneyPrecision.roundingReserveMicros = Math.max(0, Math.trunc(Number(world.moneyPrecision.roundingReserveMicros || 0)));
  for (const player of Object.values(world.players || {})) normalizePlayer(world, player);
  normalizeOrders(world);
  normalizeMarkets(world);
  normalizeAuctions(world);
  normalizeContracts(world);
  quantizeInternalTree(world.populationEconomy);
  quantizeInternalTree(world.marketDemand);
  if (world.bank) {
    world.bank.interestPoolMicros = Math.max(0, Math.trunc(Number(world.bank.interestPoolMicros || 0)));
    quantizeInternalTree(world.bank);
  }
  return world;
}

const PLAYER_INPUT_MONEY_KEYS = new Set(['price', 'unitPrice', 'startingBid', 'amount']);

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
  return numeric !== null && floorPlayerMoney(numeric) === numeric;
}

export function assertInternalMoney(value) {
  const numeric = finiteMoney(value);
  return numeric !== null && roundInternalMoney(numeric) === numeric;
}
