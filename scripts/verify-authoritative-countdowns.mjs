import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServerClock } from '../src/utils/serverClock.js';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不得包含: ${text}`);
};

const paths = {
  registry: 'src/utils/authoritativeCountdowns.ts',
  clock: 'src/utils/serverClock.js',
  coordinator: 'src/components/system/AuthoritativeCountdownRefresh.tsx',
  model: 'src/app/gameViewModel.ts',
  api: 'src/api/game.ts',
  delivery: 'src/app/stateDelivery.js',
  app: 'src/app/GameApp.tsx',
  production: 'src/pages/ProductionPage.tsx',
  overview: 'src/pages/OverviewPage.tsx',
  auction: 'src/pages/AuctionPage.tsx',
  design: 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  docsIndex: 'docs/README.md',
  package: 'package.json',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    'game.facilityConstruction?.completesAt',
    "group.status !== 'running'",
    'Number(group.cycleStartedAt) + recipe.cycleMs',
    "auction.status === 'open'",
    'auction.endsAt',
    'leaderboardsFromGame(game)?.period.endsAt',
    'return deadlines.sort((left, right) => left - right);',
  ]) requireText(paths.registry, text);

  for (const text of [
    'createServerClock',
    'Math.max(incomingServerNow, currentEstimate)',
    'subscribe(listener)',
    'sharedServerClock',
  ]) requireText(paths.clock, text);

  for (const text of [
    'AUTHORITY_CONFIRMATION_RETRY_MS = 1_000',
    'nextAuthoritativeCountdownDeadline(game)',
    'estimateServerNow(game.lastProcessedAt)',
    'subscribeServerClock(scheduleDeadline)',
    "mode: 'authoritative'",
    'expectedDeadline: deadline',
    'window.setTimeout(beginConfirmation, remaining)',
    'window.setTimeout(() => void confirmAuthority(), AUTHORITY_CONFIRMATION_RETRY_MS)',
    "document.addEventListener('visibilitychange', handleVisibilityChange)",
    'window.clearTimeout(deadlineTimer)',
    'window.clearTimeout(confirmationTimer)',
  ]) requireText(paths.coordinator, text);
  forbidText(paths.coordinator, 'game.lastProcessedAt + Math.max(0, Date.now() - receivedAt)');
  forbidText(paths.coordinator, 'window.setInterval(confirmAuthority');

  for (const text of [
    "export type RefreshMode = 'normal' | 'authoritative'",
    'refreshTaskRef.current',
    "mode === 'normal' && actionsInFlightRef.current > 0",
    'existing.controller.abort()',
  ]) requireText(paths.model, text);

  for (const text of [
    'DEFAULT_READ_TIMEOUT_MS = 8_000',
    'DEFAULT_WRITE_TIMEOUT_MS = 12_000',
    'acceptServerNow(payload.serverNow)',
    'resetServerClock()',
    "throw new GameApiError(408, '游戏服务器响应超时，请稍后重试')",
  ]) requireText(paths.api, text);

  for (const text of [
    'validPartitionSnapshot',
    'partitions[name] = { ...patch }',
    'Object.assign(state, partition)',
  ]) requireText(paths.delivery, text);
  forbidText(paths.delivery, 'Object.assign(next, patch)');

  for (const text of [
    "import { AuthoritativeCountdownRefresh } from '../components/system/AuthoritativeCountdownRefresh';",
    '<AuthoritativeCountdownRefresh game={game} refresh={model.refresh} />',
  ]) requireText(paths.app, text);

  for (const text of [
    'constructionAwaitingConfirmation',
    "constructionRemaining === 0",
    '确认完工中…',
    '正在同步服务器结算结果',
    'disabled={hasConstruction || game.credits < selectedType.buildCost}',
  ]) requireText(paths.production, text);

  for (const text of [
    'const workRemaining = Math.max(0, game.work.cooldownUntil - now);',
    'disabled={isWorking || workRemaining > 0}',
  ]) requireText(paths.overview, text);

  for (const text of [
    "return remaining === 0 ? '等待服务器结算' : formatDuration(remaining);",
    "const openAuctions = assetAuctions.filter((auction) => auction.status === 'open');",
  ]) requireText(paths.auction, text);

  for (const text of [
    '本地资格倒计时',
    '权威状态转换倒计时',
    '`serverNow`',
    '共享单调服务器时钟',
    '`src/utils/authoritativeCountdowns.ts`',
    '每 `1,000ms` 继续确认',
    '浏览器从后台恢复可见时立即重新判断截止时间',
    '到期状态的分区替换语义',
    '完整快照，不是分区对象内部的字段级补丁',
    '整块替换同名分区',
    '从 11 增加到 12',
    '施工卡固定在归零后显示“确认完工中…”',
    '普通状态读取超时为 8 秒',
    '`scripts/verify-authoritative-countdowns.mjs` 必须加入 `verify:architecture`',
  ]) requireText(paths.design, text);

  for (const text of [
    '`AUTHORITATIVE_COUNTDOWN_DESIGN.md`',
    '所有可见倒计时必须先区分本地资格到期与服务器权威状态转换',
    '共享单调服务器时钟',
    '每个返回分区内部都是完整快照',
    '`scripts/verify-authoritative-countdowns.mjs`',
  ]) requireText(paths.docsIndex, text);

  requireText(paths.package, '"verify:authoritative-countdowns": "node scripts/verify-authoritative-countdowns.mjs"');
  requireText(paths.package, 'node scripts/verify-authoritative-countdowns.mjs && node scripts/verify-primary-surface-insets.mjs');

  let monotonicNow = 1_000;
  const clock = createServerClock(() => monotonicNow);
  clock.accept(10_000);
  monotonicNow = 6_000;
  const beforeStaleRefresh = clock.now(0);
  clock.accept(10_100);
  const afterStaleRefresh = clock.now(0);
  monotonicNow = 7_000;
  const afterAnotherSecond = clock.now(0);
  if (beforeStaleRefresh !== 15_000 || afterStaleRefresh !== 15_000 || afterAnotherSecond !== 16_000) {
    failures.push('共享服务器时钟必须拒绝较旧状态响应造成的时间回退，并继续单调前进');
  }
}

if (failures.length > 0) {
  console.error('权威倒计时验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('权威倒计时验证通过：GET state 使用独立 serverNow 校准共享单调服务器时钟，轮询不得重置工作冷却；权威刷新可抢占普通轮询，请求具备超时，施工、生产周期、拍卖和排行榜到期采用串行每秒确认，状态分区使用完整快照替换。');
