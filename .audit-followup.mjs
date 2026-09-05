import { readFileSync, writeFileSync } from 'node:fs';
function replace(path, from, to, count = 1) {
  const source = readFileSync(path, 'utf8');
  if (source.split(from).length !== count + 1) throw new Error('Unexpected source boundary: ' + path + ' / ' + from.slice(0, 70));
  writeFileSync(path, source.split(from).join(to));
}
function append(path, text) { writeFileSync(path, readFileSync(path, 'utf8').trimEnd() + '\n\n' + text.trim() + '\n'); }
replace('server/test/commercial-buildings.test.js',
  "operation: 'build', provinceId: california, commercialTypeId: type.id,\n",
  "operation: 'build', provinceId: california, commercialTypeId: type.id, quantity: 1,\n", 2);
replace('server/test/commercial-buildings.test.js',
  "operation: 'build', provinceId: alabama, commercialTypeId: type.id,\n",
  "operation: 'build', provinceId: alabama, commercialTypeId: type.id, quantity: 1,\n");
replace('src/api/auth.ts', '  beginGameWriteSession(user.id);\n  return user;', '  if (user) beginGameWriteSession(user.id);\n  else endGameWriteSession();\n  return user;');
replace('src/api/game.ts',
  "import { installIdempotentGameWriteFetch } from './idempotentGameWriteFetch';",
  "import { installIdempotentGameWriteFetch } from './idempotentGameWriteFetch';\nimport { assertGameWriteSession, captureGameWriteSession, endGameWriteSession, GameWriteSessionChangedError } from './gameWriteSession';");
replace('src/api/game.ts',
  'function validatePageSaveEpoch(state: EconomyState) {\n  const userId = Number(state.userId);',
  'function validatePageSaveEpoch(state: EconomyState) {\n  const userId = Number(state.userId);\n  const session = captureGameWriteSession();\n  if (session.userId !== null && session.userId !== userId) {\n    endGameWriteSession();\n    throw new GameWriteSessionChangedError();\n  }');
replace('src/api/game.ts',
  'async function request<T>(path: string, init?: RequestInit): Promise<T> {\n  const headers = new Headers(init?.headers);',
  'async function request<T>(path: string, init?: RequestInit): Promise<T> {\n  const requestSession = captureGameWriteSession();\n  const headers = new Headers(init?.headers);');
replace('src/api/game.ts',
  '      signal: timedSignal?.signal ?? init?.signal,\n    });\n    if (!response.ok) {',
  '      signal: timedSignal?.signal ?? init?.signal,\n    });\n    assertGameWriteSession(requestSession);\n    if (!response.ok) {');
replace('src/api/game.ts',
  '    const payload = await response.json() as unknown;\n    if ((path',
  '    const payload = await response.json() as unknown;\n    assertGameWriteSession(requestSession);\n    if ((path');
replace('src/api/idempotentGameWriteFetch.ts',
  '          validateSuccess: isOrder ? isConfirmedActionResult : undefined,',
  '          validateSuccess: isOrder || immediateIntent ? isConfirmedActionResult : undefined,');
replace('src/utils/commercialInputAvailability.ts',
  '    if (frozen > 0 && !entries) { usable[input.productId] = null; continue; }',
  '    const attributed = (entries ?? []).reduce((sum, entry) => sum + (Number.isSafeInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 0), 0);\n    if (frozen > 0 && (!entries || attributed !== frozen)) { usable[input.productId] = null; continue; }');
replace('tests/dt/commercial-input-availability.test.ts',
  "commercialNextCycleAvailability(group(), type, inventories(0, 120), { food: details.food.slice(1) }, now)",
  "commercialNextCycleAvailability(group(), type, inventories(0, 100), { food: details.food.slice(1) }, now)");
replace('tests/dt/commercial-input-availability.test.ts',
  '  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), undefined, now).usable.food, null);',
  "  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), undefined, now).usable.food, null);\n  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), { food: [] }, now).usable.food, null);\n  assert.equal(commercialNextCycleAvailability(group(), type, inventories(0, 20), { food: [entry('commercial', '110000:convenience-store', 10)] }, now).usable.food, null);");
append('tests/browser/write-session-boundaries.spec.ts', `test('a late game state read cannot publish into a new account session', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const apiUrl = '/economy/src/api/game.ts';
    const deliveryUrl = '/economy/src/app/stateDelivery.js';
    const session = await import(sessionUrl);
    const api = await import(apiUrl);
    const delivery = await import(deliveryUrl);
    session.beginGameWriteSession(807);
    let started!: () => void;
    let release!: () => void;
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    window.fetch = async () => { started(); await gate; return Response.json({ state: { userId: 807 }, revision: 1 }); };
    const pending = api.getGameState().then(() => 'incorrect-success', (error: { code: string }) => error.code);
    await firstStarted;
    session.endGameWriteSession();
    session.beginGameWriteSession(808);
    release();
    return { code: await pending, state: delivery.getStateAuthoritySnapshot().state };
  });
  expect(result.code).toBe('WRITE_SESSION_CHANGED');
  expect(result.state).toBeNull();
});`);
append('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md', '状态读取在完整响应解析后同样校验发起时的会话代次；旧账号的迟到读取和写回执均不得发布到新账号的权威缓存。状态中的玩家身份与当前已认证会话不一致时必须中断并要求重新登录，不得通过自动更换页面用户锁接受共享 Cookie 的外部账号切换。');
console.log('AUDIT_FOLLOWUP_APPLIED');
