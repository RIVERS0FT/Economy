export type MoneyDraftOptions = {
  min?: number;
  max?: number;
};

const MONEY_SCALE = 1_000_000;
const PRICE_TICK_MICROS = 10_000n;

function expandExponent(value: string) {
  if (!/[eE]/.test(value)) return value;
  const match = /^([+-]?)(\d+)(?:\.(\d*))?[eE]([+-]?\d+)$/.exec(value);
  if (!match) return value;
  const [, sign, integer, fraction = '', exponentText] = match;
  const exponent = Number.parseInt(exponentText, 10);
  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;
  if (decimalIndex <= 0) return `${sign}0.${'0'.repeat(-decimalIndex)}${digits}`;
  if (decimalIndex >= digits.length) return `${sign}${digits}${'0'.repeat(decimalIndex - digits.length)}`;
  return `${sign}${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function exactCents(value: string) {
  const source = expandExponent(value.trim());
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(source);
  if (!match) return null;
  const fraction = match[3] || '';
  if (fraction.length > 2) return null;
  const magnitude = BigInt(match[2]) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
  const signed = match[1] === '-' ? -magnitude : magnitude;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) || signed < BigInt(Number.MIN_SAFE_INTEGER)) return null;
  return Number(signed) / 100;
}

function roundToCents(value: number) {
  if (!Number.isFinite(value)) return 0;
  const scaled = Math.round(value * MONEY_SCALE);
  if (!Number.isSafeInteger(scaled)) return 0;
  const micros = BigInt(scaled);
  const quotient = micros / PRICE_TICK_MICROS;
  const remainder = micros % PRICE_TICK_MICROS;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const rounded = absoluteRemainder * 2n < PRICE_TICK_MICROS
    ? quotient
    : quotient + (micros >= 0n ? 1n : -1n);
  return Number(rounded) / 100;
}

export function parseMoneyDraft(value: string, options: MoneyDraftOptions = {}) {
  const parsed = exactCents(value);
  if (parsed === null || !Number.isFinite(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  return parsed;
}

export function formatMoneyDraft(value: number) {
  return roundToCents(value).toFixed(2);
}

export function normalizeMoneyDraft(
  value: string,
  fallbackValue: number,
  options: MoneyDraftOptions = {},
) {
  const parsed = parseMoneyDraft(value, options);
  if (parsed !== null) return formatMoneyDraft(parsed);
  const minimum = options.min ?? Number.MIN_SAFE_INTEGER;
  const maximum = options.max ?? Number.MAX_SAFE_INTEGER;
  const fallback = Math.min(maximum, Math.max(minimum, fallbackValue));
  return formatMoneyDraft(fallback);
}
