import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registryUrl = new URL('./accounts.json', import.meta.url);

export async function loadStressAccountRegistry() {
  const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
  assert.equal(registry.version, 1, '不支持的压力测试账号池版本');
  assert.equal(typeof registry.passwordEnv, 'string');
  assert.ok(Array.isArray(registry.accounts) && registry.accounts.length > 0, '压力测试账号池为空');
  registry.accounts.forEach((account, index) => {
    assert.equal(account.slot, index + 1, '压力测试账号槽位必须连续且稳定');
    assert.equal(account.role, 'player', '压力测试账号只能使用普通玩家角色');
    assert.equal(typeof account.id, 'string');
    assert.equal(typeof account.email, 'string');
  });
  return registry;
}

export async function loadStressAccounts({ env = process.env, offset = 0, limit } = {}) {
  const registry = await loadStressAccountRegistry();
  const password = env[registry.passwordEnv];
  if (!password) throw new Error(`缺少压力测试账号密码环境变量 ${registry.passwordEnv}`);
  const normalizedOffset = Number(offset);
  const normalizedLimit = limit === undefined ? registry.accounts.length - normalizedOffset : Number(limit);
  assert.ok(Number.isInteger(normalizedOffset) && normalizedOffset >= 0, '压力测试账号 offset 必须是非负整数');
  assert.ok(Number.isInteger(normalizedLimit) && normalizedLimit > 0, '压力测试账号 limit 必须是正整数');
  assert.ok(normalizedOffset < registry.accounts.length, '压力测试账号 offset 超出账号池');
  assert.ok(normalizedOffset + normalizedLimit <= registry.accounts.length, '压力测试账号范围超出账号池');
  return registry.accounts.slice(normalizedOffset, normalizedOffset + normalizedLimit).map((account) => ({
    ...account,
    password,
  }));
}
