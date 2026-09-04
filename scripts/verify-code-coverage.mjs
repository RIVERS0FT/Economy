import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const packageJson = JSON.parse(read('package.json'));
const runner = read('scripts/run-code-coverage.mjs');
const ciDesign = read('docs/CI_EXECUTION_DESIGN.md');

for (const [script, expected] of Object.entries({
  'test:dt': 'node --experimental-strip-types --test tests/dt/*.test.ts',
  'test:it': 'node --test server/test/*.test.js',
  'test:coverage:dt': 'node scripts/run-code-coverage.mjs dt',
  'test:coverage:it': 'node scripts/run-code-coverage.mjs it',
  'test:coverage': 'npm run test:coverage:dt && npm run test:coverage:it',
  'test:st': 'npm run test:browser',
})) {
  check(packageJson.scripts?.[script] === expected, `package.json ${script} 必须固定为 ${expected}`);
}

for (const token of [
  "'src/app/adaptivePolling.js'",
  "'src/app/immediateCommandIntent.ts'",
  "'src/app/revisionGate.js'",
  "'src/utils/assetAllocation.ts'",
  "'src/utils/virtualListRange.ts'",
  "coverageMode: 'explicit'",
  "coverageMode: 'loaded'",
  "'server/test/*.test.js'",
  "'server/test/**/*.test.js'",
  "thresholds: { lines: 95, functions: 95, branches: 90 }",
  "thresholds: { lines: 60, functions: 55, branches: 50 }",
  '--experimental-test-coverage',
  "config.coverageMode === 'explicit'",
  '--test-coverage-include=',
  '--test-coverage-exclude=',
  '--test-coverage-lines=',
  '--test-coverage-functions=',
  '--test-coverage-branches=',
]) check(runner.includes(token), `覆盖率执行器缺少边界: ${token}`);

check(!runner.includes("it: {\n    directory: 'server/test',\n    matcher: /\\.test\\.js$/,\n    stripTypes: false,\n    include:"), 'IT 不得恢复显式 include，把未加载服务器源码按零覆盖计入 targeted 分母');

for (const path of [
  'tests/dt/client-runtime-logic.test.ts',
  'server/test/banking.test.js',
  'server/test/asset-auctions.test.js',
  'server/test/contract-audit.test.js',
  'server/test/state-polling.test.js',
  'server/test/runtime-hot-path.test.js',
]) check(existsSync(resolve(root, path)), `覆盖率关键测试缺失: ${path}`);

for (const source of [
  'server/src/runtime-action-executor.js',
  'server/src/runtime-store.js',
  'server/src/economic-mutation.js',
  'server/src/order-book-runtime.js',
  'server/src/production-settlement.js',
  'server/src/banking.js',
  'server/src/asset-auctions.js',
  'server/src/state-partitions.js',
]) check(existsSync(resolve(root, source)), `覆盖率关键源码缺失: ${source}`);

for (const token of [
  'DT（Development Test）',
  'IT（Integration Test）',
  'ST（System Test）',
  'Lines ≥ 95%',
  'Lines ≥ 60%',
  'IT 覆盖率执行器不得使用 `--test-coverage-include`',
  '`build` 聚合 Job',
]) check(ciDesign.includes(token), `CI 设计缺少覆盖率或分层规则: ${token}`);

if (failures.length > 0) {
  console.error(`代码覆盖率边界验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('代码覆盖率边界验证通过：DT/IT/ST 分层、DT 与 IT 覆盖范围及最低阈值均已锁定。');