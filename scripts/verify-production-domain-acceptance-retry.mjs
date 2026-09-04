import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const verifier = read('scripts/verify-production-deployment.sh');
const design = read('docs/CI_EXECUTION_DESIGN.md');
const failures = [];

const requireText = (source, text, label) => {
  if (!source.includes(text)) failures.push(`${label} 缺少: ${text}`);
};

for (const text of [
  'FORMAL_DOMAIN_MAX_ATTEMPTS=3',
  'FORMAL_DOMAIN_RETRY_DELAY_SECONDS=1',
  'FORMAL_DOMAIN_CONNECT_TIMEOUT_SECONDS=2',
  'FORMAL_DOMAIN_MAX_TIME_SECONDS=3',
  'check_formal_domain_status() {',
  'ECONOMY_FORMAL_DOMAIN_RETRY check=%s attempt=%s max_attempts=%s status=%s',
  'ECONOMY_FORMAL_DOMAIN_RECOVERED check=%s attempt=%s status=%s',
  'ECONOMY_FORMAL_DOMAIN_RETRY_EXHAUSTED check=%s attempts=%s status=%s',
  'if [ "$status" != "000" ] || [ "$attempt" -ge "$FORMAL_DOMAIN_MAX_ATTEMPTS" ]; then',
  'check_formal_domain_status formal-domain-page',
  'check_formal_domain_status formal-domain-health-api',
  'check_formal_domain_status formal-domain-game-api',
]) requireText(verifier, text, '生产部署验收脚本');

const formalFunctionStart = verifier.indexOf('check_formal_domain_status() {');
const formalFunctionEnd = verifier.indexOf('\nverify_remote() {', formalFunctionStart);
const formalFunction = formalFunctionStart >= 0 && formalFunctionEnd > formalFunctionStart
  ? verifier.slice(formalFunctionStart, formalFunctionEnd)
  : '';
if (!formalFunction) failures.push('无法定位正式域名公网验收函数');
for (const forbidden of ['--resolve', '--connect-to']) {
  if (formalFunction.includes(forbidden)) failures.push(`正式域名公网验收不得使用 ${forbidden} 绕过真实 DNS`);
}

for (const text of [
  '真实 `game.riversoft.top` DNS 与 HTTPS 验证',
  '仅当 `curl` 未获得任何 HTTP 状态（`000`',
  '最多 3 次、间隔 1 秒',
  '单次连接超时 2 秒、总耗时 3 秒',
  '非预期 HTTP 状态必须立即失败',
  '`ECONOMY_DEPLOY_VERIFY_START` 后 45 秒真实健康检查门槛',
]) requireText(design, text, 'CI 执行设计');

const behavior = spawnSync('bash', ['scripts/test-production-domain-acceptance-retry.sh'], {
  cwd: root,
  encoding: 'utf8',
});
if (behavior.status !== 0) {
  failures.push(`正式域名重试行为测试失败:\n${behavior.stdout || ''}${behavior.stderr || ''}`.trim());
}

if (failures.length) {
  console.error(`正式域名公网验收防回退失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('正式域名公网验收防回退通过：DNS/传输瞬时失败有界重试，真实域名与 45 秒门槛保持不变。');
