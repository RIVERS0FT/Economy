import { internalMoneyToMicros, microsToInternalMoney } from './money.js';

const MAX_MICROS = BigInt(Number.MAX_SAFE_INTEGER);

export function cashEconomyError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 409;
  return error;
}

export function cashQuantity(value, label = '数量', { allowZero = false } = {}) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw cashEconomyError('CASH_QUANTITY_INVALID', `${label}必须为${allowZero ? '非负' : '正'}安全整数`);
  }
  return value;
}

export function cashMicros(value, label = '金额', { signed = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw cashEconomyError('CASH_AMOUNT_INVALID', `${label}必须为有效金额`);
  }
  const micros = internalMoneyToMicros(value);
  if (micros === null || micros > MAX_MICROS || micros < (signed ? -MAX_MICROS : 0n)
    || microsToInternalMoney(micros) !== value) {
    throw cashEconomyError('CASH_AMOUNT_INVALID', `${label}超出六位精度或系统范围`);
  }
  return micros;
}

export function cashMoney(micros, label = '金额', { signed = false } = {}) {
  if (typeof micros !== 'bigint' || micros > MAX_MICROS || micros < (signed ? -MAX_MICROS : 0n)) {
    throw cashEconomyError('CASH_AMOUNT_RANGE', `${label}超出系统范围`);
  }
  return microsToInternalMoney(micros);
}

export function cashAdd(left, right, label, options) {
  return cashMoney(cashMicros(left, label, options) + cashMicros(right, label, options), label, options);
}

export function cashProduct(price, quantity, label = '商品金额') {
  return cashMoney(cashMicros(price, label) * BigInt(cashQuantity(quantity, '商品数量', { allowZero: true })), label);
}

export function cashTimestamp(now) {
  if (typeof now !== 'number' || !Number.isSafeInteger(now) || now < 0 || now > 8_640_000_000_000_000) {
    throw cashEconomyError('CASH_TIME_INVALID', '服务器结算时间无效');
  }
  return now;
}

export function cashFee(grossMicros, rateBps = 100) {
  cashQuantity(rateBps, '费率', { allowZero: true });
  if (rateBps > 10_000 || grossMicros < 0n) throw cashEconomyError('CASH_FEE_INVALID', '结算费率无效');
  return (grossMicros * BigInt(rateBps) + 5_000n) / 10_000n;
}
