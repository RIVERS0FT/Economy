import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const MAP_PERFORMANCE_PATTERN = 'transient raster frames stay close to the same-browser empty-frame budget';
const MAP_PERFORMANCE_FILE = 'tests/browser/map-zoom-transient.spec.ts';
const PLAYWRIGHT_CLI = resolve('node_modules/@playwright/test/cli.js');

function parseShard(args) {
  const values = args.filter((arg) => arg.startsWith('--shard='));
  if (values.length > 1) throw new Error('browser runner 只允许一个 --shard');
  if (values.length === 0) return null;
  const match = /^--shard=(\d+)\/(\d+)$/u.exec(values[0]);
  if (!match) throw new Error(`无效 Playwright shard: ${values[0]}`);
  const index = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 1 || total < 1 || index > total) {
    throw new Error(`无效 Playwright shard: ${values[0]}`);
  }
  return { index, total };
}

function hasExplicitGrep(args) {
  return args.some((arg, index) => (
    arg === '--grep' || arg === '-g' || arg === '--grep-invert'
    || arg.startsWith('--grep=') || arg.startsWith('--grep-invert=')
    || (index > 0 && (args[index - 1] === '--grep' || args[index - 1] === '-g' || args[index - 1] === '--grep-invert'))
  ));
}

export function browserTestPlan(args) {
  if (hasExplicitGrep(args)) return [{ kind: 'direct', args: [...args] }];
  const shard = parseShard(args);
  const selectedSpecs = args.filter((arg) => arg.endsWith('.spec.ts'));
  const includesMapPerformance = selectedSpecs.length === 0 || selectedSpecs.includes(MAP_PERFORMANCE_FILE);
  const runs = [{
    kind: 'functional',
    args: [...args, '--grep-invert', MAP_PERFORMANCE_PATTERN, '--pass-with-no-tests'],
  }];
  if (includesMapPerformance && (!shard || shard.index === shard.total)) {
    runs.push({
      kind: 'map-performance',
      args: [MAP_PERFORMANCE_FILE, '--grep', MAP_PERFORMANCE_PATTERN, '--workers=1'],
    });
  }
  return runs;
}

function runPlaywright(args, kind) {
  if (!existsSync(PLAYWRIGHT_CLI)) throw new Error(`Playwright CLI 不存在: ${PLAYWRIGHT_CLI}`);
  console.log(`ECONOMY_BROWSER_RUN kind=${kind} command=${process.execPath} ${PLAYWRIGHT_CLI} test ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function main(argv = process.argv.slice(2)) {
  for (const run of browserTestPlan(argv)) {
    const status = runPlaywright(run.args, run.kind);
    if (status !== 0) return status;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { process.exitCode = main(); }
  catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  }
}
