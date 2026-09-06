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
  nowHook: 'src/hooks/useNow.ts',
  liveTime: 'src/components/time/LiveServerTime.tsx',
  coordinator: 'src/components/system/AuthoritativeCountdownRefresh.tsx',
  model: 'src/app/gameViewModel.ts',
  api: 'src/api/game.ts',
  delivery: 'src/app/stateDelivery.js',
  app: 'src/app/GameApp.tsx',
  production: 'src/pages/BuildingsPage.tsx',
  productionDetail: 'src/pages/production/ProductionFacilityDetail.tsx',
  overview: 'src/pages/OverviewPage.tsx',
  economicEventLog: 'src/components/EconomicEventLogPanel.tsx',
  auction: 'src/pages/AuctionPage.tsx',
  economicEvents: 'server/src/economic-events.js',
  runtimeStore: 'server/src/runtime-store.js',
  runtimeStoreCore: 'server/src/runtime-store-core.js',
  statePartitions: 'server/src/state-partitions.js',
  design: 'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  docsIndex: 'docs/README.md',
  package: 'package.json',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    "group.status !== 'running'",
    'Number(group.cycleStartedAt) + recipe.cycleMs',
    'game.commercialBuildingGroups ?? []',
    'hasCommercialCycle(group)',
    'group.cycleCompletesAt',
    "auction.status === 'open'",
    'auction.endsAt',
    'leaderboardsFromGame(game)?.period.endsAt',
    'return deadlines.sort((left, right) => left - right);',
  ]) requireText(paths.registry, text);
  forbidText(paths.registry, 'facilityConstruction');

  for (const text of [
    'createServerClock',
    'Math.max(incomingServerNow, currentEstimate)',
    'subscribe(listener)',
    'sharedServerClock',
  ]) requireText(paths.clock, text);

  for (const text of [
    'const sharedTickers = new Map',
    'subscribeSharedTicker',
    'useSyncExternalStore',
    'window.setInterval(() => signalTicker(ticker), interval)',
  ]) requireText(paths.nowHook, text);
  for (const text of [
    'export function LiveServerTime',
    'export function LiveDurationUntil',
  ]) requireText(paths.liveTime, text);

  for (const text of [
    'AUTHORITY_CONFIRMATION_RETRY_MS = 1_000',
    'useGameAuthorityDependencies([',
    "'player.production'",
    "'player.progression'",
    "'player.bank'",
    "'auction'",
    "'contract'",
    "'leaderboard'",
    'nextAuthoritativeCountdownDeadline(currentGame)',
    'estimateServerNow(currentGame.lastProcessedAt)',
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
    'getGameAuthoritySnapshot',
    'const onSignedOutRef = useRef(onSignedOut);',
    'onSignedOutRef.current = onSignedOut;',
    'const canReuseAuthority = reloadVersion === 0',
    'authoritySnapshot.state?.userId === user.id',
    'gameRef.current = authoritySnapshot.state;',
    'revisionRef.current = authoritySnapshot.revision;',
    'onSignedOutRef.current();',
  ]) requireText(paths.model, text);

  for (const text of [
    'DEFAULT_READ_TIMEOUT_MS = 8_000',
    'const timedSignal = isWrite ? null : createTimedSignal(init?.signal, DEFAULT_READ_TIMEOUT_MS);',
    'acceptServerNow(payload.serverNow)',
    'resetServerClock()',
    "throw new GameApiError(408, '游戏服务器响应超时，请稍后重试')",
  ]) requireText(paths.api, text);

  for (const text of [
    'validPartitionSnapshot',
    'partitions[name] = { ...patch }',
    'Object.assign(state, partition)',
    'reuseUnchangedSliceReferences',
  ]) requireText(paths.delivery, text);
  forbidText(paths.delivery, 'Object.assign(next, patch)');

  for (const text of [
    "import { AuthoritativeCountdownRefresh } from '../components/system/AuthoritativeCountdownRefresh';",
    '<AuthoritativeCountdownRefresh game={appModel.game} refresh={model.refresh} />',
  ]) requireText(paths.app, text);

  for (const text of [
    'label="建造数量"',
    'label="建造资金"',
    'label="建造材料"',
    'value="无需材料"',
    'label="库存可直接建"',
    "'建造资金' : '资金与建造材料'",
    'const now = game.lastProcessedAt;',
  ]) requireText(paths.production, text);
  for (const text of ['constructionAwaitingConfirmation', '确认完工中', '施工时间', '宝石加速']) forbidText(paths.production, text);
  for (const text of ['const liveNow = useNow(now);', 'useNow(now, 10_000)']) requireText(paths.productionDetail, text);

  forbidText(paths.overview, 'useNow(');
  forbidText(paths.overview, 'EconomicEventLogPanel');
  for (const text of [
    '<LiveServerTime referenceNow={referenceNow}>',
    'formatDuration(Math.max(0, remaining))',
  ]) requireText(paths.economicEventLog, text);

  for (const text of [
    'function AuctionRemainingTime',
    '<LiveDurationUntil deadline={endsAt} referenceNow={referenceNow} zeroText="等待服务器结算" />',
    ".filter((auction) => auction.status === 'open')",
    'const openAuctions = useMemo(() => (',
    'auctionActivityAt(right) - auctionActivityAt(left)',
  ]) requireText(paths.auction, text);
  forbidText(paths.auction, 'const now = useNow(model.game.lastProcessedAt);');

  for (const text of [
    'version: 2',
    'const visibleUntil = normalizedNow + VISIBLE_WINDOW_MS',
    'for (const candidate of [event.startsAt, event.endsAt])',
  ]) requireText(paths.economicEvents, text);
  forbidText(paths.economicEvents, 'visibleUntil,\n    events');
  forbidText(paths.economicEvents, 'event.startsAt - VISIBLE_WINDOW_MS');

  const runtimeStore = `${read(paths.runtimeStoreCore)}\n${read(paths.runtimeStore)}`;
  for (const text of [
    'function stableLegacyLeaderboard(entries)',
    'const { updatedAt: _updatedAt, ...stableEntry } = entry;',
    'function stableRankedLeaderboards(value)',
    'const { generatedAt: _generatedAt, ...stableValue } = value;',
    'delete stats.leaderboards;',
    'stableState.leaderboards = leaderboards;',
  ]) if (!runtimeStore.includes(text)) failures.push(`运行时存储缺少: ${text}`);
  requireText(paths.statePartitions, "const LEADERBOARD_KEYS = new Set(['leaderboard', 'leaderboards'])");
  requireText(paths.statePartitions, 'sliceRevisions');

  for (const text of [
    '本地资格倒计时',
    '权威状态转换倒计时',
    '`serverNow`',
    '共享单调服务器时钟',
    '`src/utils/authoritativeCountdowns.ts`',
    '商业建筑营业周期结束 `commercialBuildingGroups[].cycleCompletesAt`',
    '商业营业周期必须进入统一注册表',
    '每 `1,000ms` 继续确认',
    '浏览器从后台恢复可见时立即重新判断截止时间',
    '游戏启动与已就绪 authority 生命周期',
    '正式玩家入口只允许从启动态单向进入已就绪游戏态',
    '必须复用该 `state + revision`',
    '普通父组件重渲染',
    '同一用户已有 authority 时重新挂载游戏应用不得再次出现启动加载页',
    '到期状态的分区替换语义',
    '完整快照，不是分区对象内部的字段级补丁',
    '整块替换同名分区',
    '对应科技加入 `completedTechnologyIds` 并删除 `research.active`',
    '工厂即时建设不注册权威倒计时',
    '不得等待或恢复 `facilityConstruction`',
    '普通状态读取超时为 8 秒',
    '同一事件可见窗口内连续请求必须产生相同的 `market` 分区哈希',
    '按请求时刻生成的榜单 `generatedAt` 和逐行 `updatedAt` 不得进入状态分区',
    '四榜不得继续嵌入玩家 `stats`',
    '权威倒计时协调器只订阅当前截止时间来源所需的',
    '共享秒级 ticker',
    '页面根组件不得订阅默认 1 秒 ticker',
    '`scripts/verify-authoritative-countdowns.mjs` 必须加入 `verify:architecture`',
  ]) requireText(paths.design, text);
  for (const text of [
    '工厂施工完成 `facilityConstruction.completesAt`',
    '施工倒计时归零后仍长期显示',
    '施工确认文案',
  ]) forbidText(paths.design, text);

  // docs/README only routes this domain to its DESIGN owner. Protocol semantics,
  // snapshot replacement and revision behavior are asserted directly above against
  // AUTHORITATIVE_COUNTDOWN_DESIGN.md and the implementation, never against the index.
  requireText(paths.docsIndex, '`AUTHORITATIVE_COUNTDOWN_DESIGN.md`');

  requireText(paths.package, '"verify:authoritative-countdowns": "node scripts/verify-authoritative-countdowns.mjs"');
  requireText(paths.package, 'node scripts/verify-authoritative-countdowns.mjs && node scripts/verify-primary-surface-insets.mjs');

  let monotonicNow = 1_000;
  const clock = createServerClock(() => monotonicNow);
  clock.accept(10_000);
  monotonicNow = 6_000;
  const beforeStaleRefresh = clock.now(0);
  clock.accept(10_100);
  const afterStaleRefresh = clock.now(0);
  if (afterStaleRefresh < beforeStaleRefresh) failures.push('共享服务器时钟不得因迟到响应倒退');
}

if (failures.length) {
  console.error(`权威倒计时验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('权威倒计时验证通过：本地资格与状态转换分离、稳定状态分区时间字段、共享单调服务器时钟、到期确认、后台恢复、已就绪 authority 复用、页面级子切片订阅和无轮询式完整状态刷新均已锁定。');
