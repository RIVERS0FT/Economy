import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const required = [
  'src/pages/SettingsPage.tsx',
  'src/api/game.ts',
  'src/auto-trade/useOnlineAutoTrade.ts',
  'src/types.ts',
  'server/src/app.js',
  'server/src/runtime-store.js',
  'server/src/runtime-store-core.js',
  'server/src/save-deletion.js',
  'server/src/player-action-registry.js',
  'server/src/world-storage-v2.js',
  'server/test/save-deletion.test.js',
  'server/test/client-save-epoch-page-lifecycle.test.js',
  'tests/browser/settings-layout.spec.ts',
  'tests/browser/save-epoch-lifecycle.spec.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];

for (const path of required) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const settings = read('src/pages/SettingsPage.tsx');
  const clientApi = read('src/api/game.ts');
  const autoTrade = read('src/auto-trade/useOnlineAutoTrade.ts');
  const types = read('src/types.ts');
  const app = read('server/src/app.js');
  const runtime = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
  const deletion = read('server/src/save-deletion.js');
  const actionRegistry = read('server/src/player-action-registry.js');
  const worldStorage = read('server/src/world-storage-v2.js');
  const test = read('server/test/save-deletion.test.js');
  const lifecycleTest = read('server/test/client-save-epoch-page-lifecycle.test.js');
  const browser = read('tests/browser/settings-layout.spec.ts');
  const lifecycleBrowser = read('tests/browser/save-epoch-lifecycle.spec.ts');
  const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
  const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
  const countdownDesign = read('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md');
  const adminDesign = read('docs/GIFT_CODE_AND_ADMIN_DESIGN.md');

  for (const text of [
    '存档管理',
    '删除存档',
    'variant="danger"',
    "getSaveDeletionPreflight",
    "deleteGameSave",
    "window.prompt",
    "clearTutorialRun(user.id)",
    "notificationStorageKey(user.id)",
    "navigationBadgeStorageKey(user.id)",
  ]) {
    if (!settings.includes(text)) failures.push(`设置页缺少: ${text}`);
  }

  for (const text of [
    '/save-deletion/preflight',
    '/save-deletion',
    'X-Economy-Save-Epoch',
    'pageSaveEpoch',
    'validatePageSaveEpoch',
    'requiredPageSaveEpoch',
    'resetGameSession',
    'SAVE_EPOCH_PAGE_MISMATCH',
  ]) {
    if (!clientApi.includes(text)) failures.push(`客户端 API 缺少: ${text}`);
  }
  if (clientApi.includes('currentSaveEpoch')) failures.push('客户端不得恢复与状态发布分离的 currentSaveEpoch 竞态缓存');
  if (!types.includes('saveEpoch: number;')) failures.push('EconomyState 缺少 saveEpoch');

  for (const text of [
    'getStateAuthoritySnapshot',
    'state.cycleAutoSaleCounts',
    'state.userId !== userId',
    'state.saveEpoch !== saveEpoch',
    'if (!previous) return;',
  ]) {
    if (!autoTrade.includes(text)) failures.push(`自动交易存档世代门禁缺少: ${text}`);
  }

  for (const text of [
    "path === '/api/game/save-deletion/preflight'",
    "path === '/api/game/save-deletion'",
    'getPlayerSaveDeletionPreflight',
    'deletePlayerSave',
    'assertPlayerSaveEpoch',
    "path === '/api/game/reset'",
    "sendError(response, 410, '经济状态重置功能已永久移除')",
  ]) {
    if (!app.includes(text)) failures.push(`服务器路由缺少: ${text}`);
  }
  const actionBoundaryStart = app.indexOf('const actionResponse = await enqueueAuthoritativeWrite');
  const actionBoundaryEnd = app.indexOf('const knownPartitions = readKnownPartitionRevisionsFromHeader', actionBoundaryStart);
  const actionBoundary = actionBoundaryStart >= 0 && actionBoundaryEnd > actionBoundaryStart
    ? app.slice(actionBoundaryStart, actionBoundaryEnd)
    : '';
  if (!actionBoundary.includes("assertPlayerSaveEpoch(store, user, request.headers['x-economy-save-epoch']);")) {
    failures.push('普通写请求必须在权威写队列内校验 X-Economy-Save-Epoch');
  }
  if (
    actionBoundary.indexOf('assertPlayerSaveEpoch') < 0
    || actionBoundary.indexOf('return store.apply') < 0
    || actionBoundary.indexOf('assertPlayerSaveEpoch') > actionBoundary.indexOf('return store.apply')
  ) {
    failures.push('存档世代校验必须发生在 store.apply 之前，旧标签页不得进入经济事务');
  }

  for (const text of [
    'economy_save_deletions',
    'SAVE_DELETION_CONFIRMATION',
    'activeLoanLiability',
    'weeklySettlementLiability',
    "'cancelAuction'",
    'delete world.players',
    'ensurePlayer(world, user, now)',
    'player.registeredAt = registeredAt',
    'player.gems = gems',
    'player.saveEpoch = saveEpochAfter',
    'deleteTutorialCompletion',
    'SAVE_EPOCH_MISMATCH',
  ]) {
    if (!deletion.includes(text)) failures.push(`删档领域缺少: ${text}`);
  }
  for (const text of [
    'economy_save_deletions_repeatable',
    'idx_economy_save_deletions_user_deleted',
    'assertExpectedSaveEpoch',
  ]) {
    if (!deletion.includes(text)) failures.push(`重复删档迁移或世代保护缺少: ${text}`);
  }
  for (const text of [
    'saveDeletionPreflight:',
    'saveDeletion:',
    "mutationScope: 'save-deletion'",
  ]) {
    if (!actionRegistry.includes(text)) failures.push(`删档特殊写路由未登记交互元数据: ${text}`);
  }
  for (const text of [
    'saveDeletionMutationScope',
    "case 'save-deletion'",
    "label: preflight ? 'save-deletion:preflight' : 'save-deletion:commit'",
  ]) {
    if (!worldStorage.includes(text)) failures.push(`删档局部 Mutation Scope 缺少: ${text}`);
  }
  for (const text of [
    'createRuntimeMutationScope',
    "'saveDeletionPreflight'",
    "'saveDeletion'",
    'store.loadWorld(now, mutationScope)',
    'store.saveWorldIfChanged(revision, world, now, stateJson, mutationScope)',
    'store.saveWorld(revision, world, now, mutationScope)',
    'processWorld: !store.scheduledProcessing',
    '{ migrate: false, process: false }',
    'cancelOpenProductionContractForSaveDeletion',
    'player.facilityGroups = [];',
    'ensurePlayerResearch',
    '{ migrate: !store.scheduledProcessing }',
  ]) {
    if (!deletion.includes(text)) failures.push(`删档局部事务或即时路径缺少: ${text}`);
  }
  for (const forbidden of [
    'applyFacilityGroupAction',
    'migrateFacilityGroupWorld',
    'migrateResearchWorld',
  ]) {
    if (deletion.includes(forbidden)) failures.push(`删档事务不得恢复全局玩家处理: ${forbidden}`);
  }
  const preparedStart = deletion.indexOf('function loadPreparedWorld');
  const preparedEnd = deletion.indexOf('export function getPlayerSaveDeletionPreflight', preparedStart);
  const prepared = preparedStart >= 0 && preparedEnd > preparedStart ? deletion.slice(preparedStart, preparedEnd) : '';
  if (!prepared.includes('if (!store.scheduledProcessing)')) failures.push('正式删档不得在自身事务内重复强制推进全世界');

  for (const forbidden of [
    'already_used',
    '当前账号已经使用过一次自助删除存档',
    'user_id INTEGER NOT NULL UNIQUE,',
  ]) {
    if (deletion.includes(forbidden)) failures.push(`删档领域不得恢复单次限制: ${forbidden}`);
  }
  if (clientApi.includes('alreadyUsed: boolean;')) failures.push('客户端预检查不得恢复 alreadyUsed 单次删档字段');
  if (settings.includes('saveDeletionPreflight?.alreadyUsed')) failures.push('设置页不得按历史删档次数禁用删除按钮');
  if (!app.includes("expectedSaveEpoch: request.headers['x-economy-save-epoch']")) {
    failures.push('删档请求必须把页面存档世代传入删档事务校验');
  }

  for (const forbidden of ['resetPlayer', "return { action: 'resetPlayer'"]) {
    if ([deletion, app, runtime].some((source) => source.includes(forbidden))) {
      failures.push(`不得恢复旧重置动作: ${forbidden}`);
    }
  }

  for (const text of [
    'saveCreatedAt',
    'saveEpoch',
    'currentSaveWorld',
    'filterStateForCurrentSave',
  ]) {
    if (!runtime.includes(text)) failures.push(`运行时存档隔离缺少: ${text}`);
  }

  for (const text of [
    'delete save recreates the player baseline',
    'repeat delete creates a new save epoch and appends audit history',
    'legacy single-use save deletion audit migrates without blocking another deletion',
    'active liabilities block save deletion',
    'stale tab writes are rejected after save deletion while the new epoch remains writable',
    '旧标签页请求不得推进世界修订号',
    '旧标签页请求不得扣除资金',
    '旧标签页请求不得创建工厂',
    '旧标签页请求不得启动研发',
    '旧标签页请求不得创建订单',
    '当前存档世代必须保持可写',
    'scheduled save deletion keeps unrelated players and markets shared',
    '删档不得复制无关玩家',
    '删档不得复制无关市场',
    'assertPlayerSaveEpoch',
  ]) {
    if (!test.includes(text)) failures.push(`服务器测试缺少: ${text}`);
  }
  for (const text of [
    'page save epoch is validated before authority publication',
    'writes require a locked page epoch',
    'cycle sale observations respect the current player and save epoch without issuing automatic writes',
    'production settlement rejection no longer turns a valid state GET into a load failure loop',
  ]) {
    if (!lifecycleTest.includes(text)) failures.push(`客户端世代生命周期测试缺少: ${text}`);
  }
  for (const text of ['删除存档', '存档管理']) {
    if (!browser.includes(text)) failures.push(`设置页浏览器回归缺少: ${text}`);
  }
  for (const text of [
    'authority publication locks saveEpoch before synchronous background writes',
    'same-user epoch change invalidates the document before publication',
    'production settlement 409 keeps the accepted state',
    'x-economy-save-epoch',
  ]) {
    if (!lifecycleBrowser.includes(text)) failures.push(`页面世代浏览器回归缺少: ${text}`);
  }

  for (const [name, source, requiredText] of [
    ['产品设计', productDesign, '每个账号可以重复使用自助删除存档'],
    ['页面设计', pageDesign, '设置页“存档管理”'],
    ['UI 设计', uiDesign, '存档管理'],
    ['服务器设计', serverDesign, 'economy_save_deletions'],
    ['服务器设计', serverDesign, '409 SAVE_EPOCH_MISMATCH'],
    ['服务器设计', serverDesign, '旧标签页作用于后续世代'],
    ['权威倒计时设计', countdownDesign, '浏览器文档生命周期内的页面存档世代锁'],
    ['权威倒计时设计', countdownDesign, '状态发布前完成世代校验'],
    ['管理员设计', adminDesign, '删除存档不得删除或重置'],
  ]) {
    if (!source.includes(requiredText)) failures.push(`${name}缺少: ${requiredText}`);
  }
}

if (existsSync(resolve(root, 'scripts/verify-reset-disabled.mjs'))) {
  failures.push('旧 verify-reset-disabled.mjs 应由存档删除验证替代');
}

if (failures.length) {
  console.error(`删除存档验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('删除存档的确认、阻断、自动关闭、局部 Mutation Scope、账号级数据保留、页面存档世代锁、后台自动写 authority 门禁、旧标签页写入隔离与旧接口墓碑验证通过。');
