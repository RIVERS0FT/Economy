import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();

const PHASES = Object.freeze({
  dt: {
    directory: 'tests/dt',
    matcher: /\.test\.ts$/,
    stripTypes: true,
    include: [
      'src/app/adaptivePolling.js',
      'src/app/immediateCommandIntent.ts',
      'src/app/revisionGate.js',
      'src/utils/assetAllocation.ts',
      'src/utils/virtualListRange.ts',
    ],
    thresholds: { lines: 95, functions: 95, branches: 90 },
  },
  it: {
    directory: 'server/test',
    matcher: /\.test\.js$/,
    stripTypes: false,
    include: [
      'server/src/**/*.js',
      'server/shared/**/*.js',
      'shared/**/*.js',
    ],
    thresholds: { lines: 60, functions: 55, branches: 50 },
  },
});

function listDefaultTests(config) {
  const directory = resolve(ROOT, config.directory);
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && config.matcher.test(entry.name))
    .map((entry) => `${config.directory}/${entry.name}`)
    .sort();
}

function normalizeTestPath(path, config) {
  const normalized = String(path || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized.startsWith(`${config.directory}/`) || !config.matcher.test(normalized)) {
    throw new Error(`覆盖率测试路径不属于 ${config.directory}: ${normalized}`);
  }
  if (!existsSync(resolve(ROOT, normalized))) throw new Error(`覆盖率测试不存在: ${normalized}`);
  return normalized;
}

function runCoverage(phase, requestedTests) {
  const config = PHASES[phase];
  if (!config) throw new Error(`未知覆盖率阶段: ${phase}`);
  const tests = requestedTests.length > 0
    ? [...new Set(requestedTests.map((path) => normalizeTestPath(path, config)))].sort()
    : listDefaultTests(config);
  if (tests.length === 0) throw new Error(`${phase.toUpperCase()} 没有可执行测试`);

  const args = [];
  if (config.stripTypes) args.push('--experimental-strip-types');
  args.push('--experimental-test-coverage');
  for (const pattern of config.include) args.push(`--test-coverage-include=${pattern}`);
  args.push(`--test-coverage-lines=${config.thresholds.lines}`);
  args.push(`--test-coverage-functions=${config.thresholds.functions}`);
  args.push(`--test-coverage-branches=${config.thresholds.branches}`);
  args.push('--test', ...tests);

  console.log(`ECONOMY_COVERAGE_PHASE=${phase}`);
  console.log(`ECONOMY_COVERAGE_TESTS=${tests.join(',')}`);
  console.log(`ECONOMY_COVERAGE_THRESHOLDS=lines:${config.thresholds.lines},functions:${config.thresholds.functions},branches:${config.thresholds.branches}`);

  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const [, , phase, ...requestedTests] = process.argv;
try {
  runCoverage(phase, requestedTests);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}
