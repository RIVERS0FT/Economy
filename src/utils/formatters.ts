let compactNumbersEnabled = false;

function formatFullNumber(value: number) {
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatAbbreviatedNumber(value: number) {
  const absolute = Math.abs(value);
  const units = [
    { threshold: 1_000_000_000_000, suffix: 'T' },
    { threshold: 1_000_000_000, suffix: 'B' },
    { threshold: 1_000_000, suffix: 'M' },
    { threshold: 1_000, suffix: 'K' },
  ];
  const unit = units.find(({ threshold }) => absolute >= threshold);
  if (!unit) return formatFullNumber(value);

  const scaled = value / unit.threshold;
  const maximumFractionDigits = Math.abs(scaled) >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(scaled)}${unit.suffix}`;
}

export function setCompactNumbersEnabled(enabled: boolean) {
  compactNumbersEnabled = enabled;
}

export function formatNumber(value: number) {
  return compactNumbersEnabled ? formatAbbreviatedNumber(value) : formatFullNumber(value);
}

export function formatCurrency(value: number) {
  return formatNumber(value);
}

export function formatCompactNumber(value: number) {
  return formatNumber(value);
}

export function formatRank(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? `#${value}` : '#--';
}

export function formatTime(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(value);
}

export function formatDate(value: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function formatDuration(ms: number) {
  if (ms <= 0) return '已完成';
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) return `${hours}h ${minutes}m`;
    if (seconds > 0) return `${hours}h ${seconds.toString().padStart(2, '0')}s`;
    return `${hours}h`;
  }
  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds.toString().padStart(2, '0')}s` : `${minutes}m`;
  }
  return `${seconds}s`;
}
