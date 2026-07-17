import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatDuration, formatRank } from '../src/utils/formatters.ts';

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

requireText('src/app/GameApp.tsx', ['formatRank(', 'aria-label={rankLabel}']);
requireText('src/pages/OverviewPage.tsx', [
  '固定 10s 冷却',
  'formatDuration(workRemaining)',
]);
requireText('src/pages/LeaderboardPage.tsx', [
  'formatRank(currentRank)',
  'formatRank(entry.rank)',
  'aria-label={`排名第 ${entry.rank} 名`}',
]);
requireText('src/pages/AuctionPage.tsx', [
  'formatDuration(remaining)',
  '最长 168h',
  '时长（h）',
]);
requireText('src/pages/SettingsPage.tsx', [
  '<option value="3">每 3s</option>',
  '<option value="5">每 5s</option>',
  '<option value="10">每 10s</option>',
]);
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '只使用小写 `s`、`m`、`h`',
  '所有排名数值统一通过 `formatRank` 显示为 `#N`',
  '恢复中文“秒／分钟／小时”的玩家时长展示',
  '恢复“第 N 名”或裸数字排名展示',
  '不得重复状态栏已经显示的总资产和排名',
]);

forbidText('src/pages/LeaderboardPage.tsx', [
  'value={`第 ${',
  '>{entry.rank}</span>',
]);
forbidText('src/app/GameApp.tsx', ['<>第 {currentRank} 名</>']);
forbidText('src/pages/OverviewPage.tsx', [
  'formatRank(',
  '排名第 ${currentRank} 名',
  '第 {derived.currentRank?.rank ?? \'--\'} 名',
  '工作冷却固定为 10 秒',
]);
forbidText('src/pages/AuctionPage.tsx', [
  'const hours = Math.floor',
  ' 小时 ',
  ' 分钟',
  '最长 168 小时',
  '时长（小时）',
]);
forbidText('src/pages/SettingsPage.tsx', [
  '每 3 秒',
  '每 5 秒',
  '每 10 秒',
]);

if (failures.length) {
  console.error(`时间与排名格式验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('时间与排名格式验证通过：持续时间统一使用 s/m/h，排名统一由状态栏和排行榜使用 #N。');
