export type MoneyDraftOptions = {
  min?: number;
  max?: number;
};

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

function floorToCents(value: string) {
  const source = expandExponent(value.trim());
  const match = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(source);
  if (!match) return null;
  const negative = match[1] === '-';
  const integer = match[2];
  const fraction = match[3] || '';
  let cents = Number.parseInt(integer, 10) * 100 + Number.parseInt(fraction.slice(0, 2).padEnd(2, '0') || '0', 10);
  if (!Number.isSafeInteger(cents)) return null;
  if (negative && /[1-9]/.test(fraction.slice(2))) cents += 1;
  return (negative ? -cents : cents) / 100;
}

export function parseMoneyDraft(value: string, options: MoneyDraftOptions = {}) {
  const parsed = floorToCents(value);
  if (parsed === null || !Number.isFinite(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  return parsed;
}

export function formatMoneyDraft(value: number) {
  const parsed = floorToCents(String(value));
  return (parsed ?? 0).toFixed(2);
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
