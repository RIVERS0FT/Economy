import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadStressAccounts, loadStressAccountRegistry } from '../tests/stress/loadAccounts.mjs';

const root = process.cwd();
const manifestPath = resolve(root, 'tests/stress/accounts.json');
const raw = readFileSync(manifestPath, 'utf8');
const registry = await loadStressAccountRegistry();

assert.equal(registry.version, 1);
assert.equal(registry.passwordEnv, 'ECONOMY_STRESS_TEST_PASSWORD');
assert.equal(registry.accounts.length, 24, '固定压力测试账号池必须保持 24 个槽位');
assert.equal(new Set(registry.accounts.map((account) => account.id)).size, registry.accounts.length);
assert.equal(new Set(registry.accounts.map((account) => account.email)).size, registry.accounts.length);
assert.equal(/"password"\s*:|"cookie"\s*:|"token"\s*:|"session"\s*:/i.test(raw), false, '账号池不得保存密码、Cookie、Token 或 Session');
assert.equal(readFileSync(resolve(root, 'tests/stress/loadAccounts.mjs'), 'utf8').includes('/registration/'), false, '压力测试账号加载器不得注册新账号');

registry.accounts.forEach((account, index) => {
  const suffix = String(index + 1).padStart(2, '0');
  assert.deepEqual(account, {
    slot: index + 1,
    id: `stress-player-${suffix}`,
    email: `economy-stress-${suffix}@riversoft.top`,
    role: 'player',
  });
});

await assert.rejects(() => loadStressAccounts({ env: {} }), /ECONOMY_STRESS_TEST_PASSWORD/);
const loaded = await loadStressAccounts({ env: { ECONOMY_STRESS_TEST_PASSWORD: 'runtime-only-secret' }, offset: 2, limit: 3 });
assert.deepEqual(loaded.map(({ id, email, password }) => ({ id, email, password })), [
  { id: 'stress-player-03', email: 'economy-stress-03@riversoft.top', password: 'runtime-only-secret' },
  { id: 'stress-player-04', email: 'economy-stress-04@riversoft.top', password: 'runtime-only-secret' },
  { id: 'stress-player-05', email: 'economy-stress-05@riversoft.top', password: 'runtime-only-secret' },
]);

console.log('Fixed reusable stress-test account registry and secret boundary verification passed.');
