import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const required = [
  'src/pages/SettingsPage.tsx',
  'src/api/game.ts',
  'src/types.ts',
  'server/src/app.js',
  'server/src/runtime-store.js',
  'server/src/runtime-store-core.js',
  'server/src/save-deletion.js',
  'server/test/save-deletion.test.js',
  'tests/browser/settings-layout.spec.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/GIFT_CODE_AND_ADMIN_DESIGN.md',
];

for (const path of required) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const settings = read('src/pages/SettingsPage.tsx');
  const clientApi = read('src/api/game.ts');
  const types = read('src/types.ts');
  const app = read('server/src/app.js');
  const runtime = `${read('server/src/runtime-store-core.js')}\n${read('server/src/runtime-store.js')}`;
  const deletion = read('server/src/save-deletion.js');
  const test = read('server/test/save-deletion.test.js');
  const browser = read('tests/browser/settings-layout.spec.ts');
  const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
  const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
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
    'currentSaveEpoch',
  ]) {
    if (!clientApi.includes(text)) failures.push(`客户端 API 缺少: ${text}`);
  }
  if (!types.includes('saveEpoch: number;')) failures.push('EconomyState 缺少 saveEpoch');

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
    "'cancelOrder'",
    "'cancelAuction'",
    "'cancelProductionContract'",
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
    'active liabilities block save deletion',
    'stale tab writes are rejected after save deletion while the new epoch remains writable',
    '旧标签页请求不得推进世界修订号',
    '旧标签页请求不得扣除资金',
    '旧标签页请求不得创建工厂',
    '旧标签页请求不得启动研发',
    '旧标签页请求不得创建订单',
    '当前存档世代必须保持可写',
    'assertPlayerSaveEpoch',
  ]) {
    if (!test.includes(text)) failures.push(`服务器测试缺少: ${text}`);
  }
  for (const text of ['删除存档', '存档管理']) {
    if (!browser.includes(text)) failures.push(`设置页浏览器回归缺少: ${text}`);
  }

  for (const [name, source, requiredText] of [
    ['产品设计', productDesign, '每个账号只允许使用一次自助删除存档'],
    ['页面设计', pageDesign, '设置页“存档管理”'],
    ['UI 设计', uiDesign, '存档管理'],
    ['服务器设计', serverDesign, 'economy_save_deletions'],
    ['服务器设计', serverDesign, '409 SAVE_EPOCH_MISMATCH'],
    ['服务器设计', serverDesign, '旧标签页把操作写入新存档'],
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

console.log('删除存档的确认、阻断、自动关闭、账号级数据保留、审计、存档世代、旧标签页写入隔离与旧接口墓碑验证通过。');