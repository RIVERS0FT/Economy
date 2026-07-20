import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const registryUrl = new URL('./accounts.json', import.meta.url);

export async function loadStressAccountRegistry() {
  const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
  assert.equal(registry.version, 1, '不支持的压力测试账号池版本');
  assert.equal(typeof registry.passwordEnv, 'string');
  assert.ok(Array.isArray(registry.accounts) && registry.accounts.length > 0, '压力测试账号池为空');
  return registry;
}

export async function loadStressAccounts({ env = process.env, offset = 0, limit } = {}) {
  const registry = await loadStressAccountRegistry();
  const password = env[registry.passwordEnv];
  if (!password) throw new Error(`缺少压力测试账号密码环境变量 ${registry.passwordEnv}`);
  const normalizedOffset = Math.max(0, Math.floor(Number(offset) || 0));
  const normalizedLimit = limit === undefined
    ? registry.accounts.length
    : Math.max(0, Math.floor(Number(limit) || 0));
  return registry.accounts.slice(normalizedOffset, normalizedOffset + normalizedLimit).map((account) => ({
    ...account,
    password,
  }));
}
