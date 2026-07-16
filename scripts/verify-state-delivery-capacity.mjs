import { readFileSync } from 'node:fs';
import { canAcceptRevision } from '../src/app/revisionGate.js';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少状态容量规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 恢复了禁止的状态容量规则: ${fragment}`);
  }
}

requireText('README.md', [
  '游戏状态使用世界修订号轮询',
  '客户端默认每 5 秒轮询状态',
  '客户端只接受不低于当前值的状态修订号',
  '大型 JSON 响应必须使用 gzip 压缩',
]);

requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '?revision=N',
  '{ revision, unchanged: true }',
  '空闲状态读取不得仅因服务器时间推进而修改 `lastProcessedAt`',
  '正式客户端默认每 5 秒轮询一次修订号',
  '轮询和动作响应只有在 `revision` 不低于当前值时才能更新界面',
  '发起任一权威动作时必须使用 `AbortController` 取消正在进行的状态轮询',
  '工作动作必须在请求发出时同步进入本地“处理中”状态',
  'gzip_types application/json',
  '部署脚本必须修补既有游戏 API snippet 或手工 `location`',
]);

requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '默认每 5 秒按服务器修订号轮询',
  '可选 3／5／10 秒',
  '不得恢复每 1 秒完整状态刷新',
  '按钮必须在同一交互周期立即显示“处理中”',
  '任何低于当前修订号的迟到响应不得覆盖工作响应',
]);

requireText('server/src/storage.js', [
  "immediate ? 'BEGIN IMMEDIATE' : 'BEGIN'",
  'saveWorldIfChanged(',
  'if (candidate === previousStateJson) return revision',
  'getStateSnapshot(user, knownRevision',
  'unchanged: true',
]);

requireText('server/src/index.js', [
  "url.searchParams.get('revision')",
  'store.getStateSnapshot(user, knownRevision)',
]);

requireText('src/api/game.ts', [
  'GameStatePollResponse',
  '`?revision=${revision}`',
  'signal?: AbortSignal',
]);

requireText('src/app/gameViewModel.ts', [
  "useState('5')",
  'revisionRef.current',
  'canAcceptRevision(currentRevision, incomingRevision)',
  'getGameState(revisionRef.current, controller.signal)',
  'refreshAbortRef.current?.abort()',
  'actionsInFlightRef.current > 0',
  "action === 'work' && workPendingRef.current",
  'setIsWorking(true)',
  'setIsWorking(false)',
]);

requireText('src/pages/OverviewPage.tsx', [
  "isWorking ? '处理中…'",
  'disabled={isWorking || workRemaining > 0}',
]);

if (!canAcceptRevision(null, 1)
  || !canAcceptRevision(7, 7)
  || !canAcceptRevision(7, 8)
  || canAcceptRevision(7, 6)
  || canAcceptRevision(null, undefined)
  || canAcceptRevision(7, undefined)) {
  failures.push('revision 门禁必须只接受不低于当前值的有效修订号');
}

requireText('src/pages/SettingsPage.tsx', [
  '状态刷新频率',
  '<option value="3">每 3s</option>',
  '<option value="5">每 5s</option>',
  '<option value="10">每 10s</option>',
]);
forbidText('src/pages/SettingsPage.tsx', [
  '<option value="1">每 1s</option>',
  '<option value="3">每 3 秒</option>',
  '<option value="5">每 5 秒</option>',
  '<option value="10">每 10 秒</option>',
]);

for (const path of [
  'deploy/nginx/game.riversoft.top.economy-location.conf',
  'scripts/configure-economy-nginx.py',
]) {
  requireText(path, [
    'gzip on;',
    'gzip_vary on;',
    'gzip_proxied any;',
    'gzip_min_length 1024;',
    'gzip_comp_level 5;',
    'gzip_types application/json;',
  ]);
}

if (failures.length) {
  console.error(`状态交付容量验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('状态交付容量验证通过：修订号门禁、动作轮询互斥、空闲读取不写库、5 秒默认间隔和 JSON gzip 均已锁定。');
