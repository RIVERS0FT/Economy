import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatCompactCurrency, formatCurrency, formatDuration, formatFullNumber, formatNumber, formatRank } from '../src/utils/formatters.ts';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

for (const [value, expected] of [
  [8_000, '8s'],
  [60_000, '1m'],
  [125_000, '2m 05s'],
  [3_600_000, '1h'],
  [4_800_000, '1h 20m'],
  [3_630_000, '1h 30s'],
  [0, '已完成'],
]) {
  try {
    assert.equal(formatDuration(value), expected);
  } catch {
    failures.push(`formatDuration(${value}) 应为 ${expected}，实际为 ${formatDuration(value)}`);
  }
}

for (const [value, expected] of [
  [1, '#1'],
  [25, '#25'],
  [undefined, '#--'],
  [null, '#--'],
  [0, '#--'],
]) {
  try {
    assert.equal(formatRank(value), expected);
  } catch {
    failures.push(`formatRank(${String(value)}) 应为 ${expected}，实际为 ${formatRank(value)}`);
  }
}

for (const [value, expected] of [[999, '999'], [1_000, '1K'], [12_500, '12.5K'], [1_000_000, '1M']]) {
  try {
    assert.equal(formatNumber(value), expected);
  } catch {
    failures.push(`formatNumber(${value}) 应为 ${expected}，实际为 ${formatNumber(value)}`);
  }
}

try {
  assert.equal(formatFullNumber(12_500), '12,500');
  assert.equal(formatCompactCurrency(1_280), '1.3K');
} catch {
  failures.push('完整数字或紧凑货币格式异常');
}

try {
  assert.equal(formatCurrency(1_280), '1,280.00');
} catch {
  failures.push(`formatCurrency(1280) 应继续保持货币两位精度，实际为 ${formatCurrency(1_280)}`);
}

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少显示格式规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 恢复了禁止的显示格式: ${fragment}`);
  }
}

requireText('src/components/shell/GameShell.tsx', [
  '<CompactRank',
  'ariaLabel={rankLabel}',
  'compactValue: formatCompactCurrency(game.credits)',
  'compactValue: formatCompactCurrency(derived.totalAssets)',
]);
requireText('src/components/ui/CompactNumber.tsx', ['SafeTooltip', 'formatFullNumber(value)', 'formatCompactCurrency(value)']);
requireText('src/components/ui/CurrencyAmount.tsx', ['SafeTooltip', 'formatCompactCurrency(primitive.value)']);
forbidText('src/pages/OverviewPage.tsx', ['固定 3s 冷却', '<OverviewWorkButton']);
requireText('src/components/EconomicEventLogPanel.tsx', ['formatDuration(Math.max(0, remaining))']);
requireText('src/pages/LeaderboardPage.tsx', [
  '<CompactRank value={currentRank}',
  '<CompactRank value={entry.rank}',
  'aria-label={`排名第 ${entry.rank} 名`}',
]);
requireText('src/pages/AuctionPage.tsx', [
  'function AuctionRemainingTime',
  '最长 168h',
  '时长（h）',
]);
requireText('src/components/time/LiveServerTime.tsx', [
  'formatDuration(remaining)',
  'zeroText',
]);
requireText('src/pages/SettingsPage.tsx', [
  '<option value="3">每 3s</option>',
  '<option value="5">每 5s</option>',
  '<option value="10">每 10s</option>',
]);
requireText('docs/UI_DESIGN_SYSTEM.md', [
  '只使用小写 `s`、`m`、`h`',
  '所有排名数值统一通过 `formatRank` 显示为 `#N`',
  '恢复中文“秒／分钟／小时”的玩家时长展示',
  '恢复“第 N 名”或裸数字排名展示',
  '不得重复状态栏已经显示的净资产和排名',
  '普通金额统一显示两位',
]);

forbidText('src/pages/LeaderboardPage.tsx', [
  'value={`第 ${',
  '>{entry.rank}</span>',
]);
forbidText('src/components/shell/GameShell.tsx', [
  '<>第 {currentRank} 名</>',
  'compactValue: formatCompactNumber(game.credits)',
  'compactValue: formatCompactNumber(derived.totalAssets)',
]);
forbidText('src/pages/OverviewPage.tsx', [
  'formatRank(',
  '排名第 ${currentRank} 名',
  '第 {derived.currentRank?.rank ?? \'--\'} 名',
  '工作冷却固定为 3 秒',
]);
forbidText('src/pages/AuctionPage.tsx', [
  'const hours = Math.floor',
  ' 小时 ',
  ' 分钟',
  '最长 168 小时',
  '时长（小时）',
]);
forbidText('src/pages/SettingsPage.tsx', [
  '紧凑数字',
  '每 3 秒',
  '每 5 秒',
  '每 10 秒',
]);
requireText('docs/UI_DESIGN_SYSTEM.md', [
  '“紧凑数字”是全局固定显示规则',
  '完整数字 Tooltip',
]);

if (failures.length) {
  console.error(`显示格式验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('显示格式验证通过：只读数量、货币与排名统一紧凑显示并提供完整数字 Tooltip，输入继续使用精确值。');
