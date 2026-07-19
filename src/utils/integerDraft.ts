export type IntegerDraftOptions = {
  min?: number;
  max?: number;
};

function clampInteger(value: number, options: IntegerDraftOptions) {
  const minimum = options.min ?? Number.MIN_SAFE_INTEGER;
  const maximum = options.max ?? Number.MAX_SAFE_INTEGER;
  return Math.min(maximum, Math.max(minimum, value));
}

export function parseIntegerDraft(value: string, options: IntegerDraftOptions = {}) {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) return null;
  if (options.min !== undefined && parsed < options.min) return null;
  if (options.max !== undefined && parsed > options.max) return null;
  return parsed;
}

export function normalizeIntegerDraft(
  value: string,
  fallbackValue: number,
  options: IntegerDraftOptions = {},
) {
  const normalized = value.trim();
  if (/^-?\d+$/.test(normalized)) {
    const parsed = Number(normalized);
    if (Number.isSafeInteger(parsed)) return String(clampInteger(parsed, options));
  }
  return String(clampInteger(fallbackValue, options));
}
