from pathlib import Path
import json

runner = Path('scripts/run-browser-tests.mjs')
runner.write_text(r'''import { spawnSync } from 'node:child_process';
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
''')

# package.json: all existing workflow commands automatically use the isolating runner.
package_path = Path('package.json')
package_data = json.loads(package_path.read_text())
assert package_data['scripts']['test:browser'] == 'playwright test'
package_data['scripts']['test:browser'] = 'node scripts/run-browser-tests.mjs'
package_path.write_text(json.dumps(package_data, ensure_ascii=False, indent=2) + '\n')

# Deterministic runner plan tests.
Path('tests/dt/browser-test-runner.test.ts').write_text(r'''import assert from 'node:assert/strict';
import test from 'node:test';
import { browserTestPlan, MAP_PERFORMANCE_PATTERN } from '../../scripts/run-browser-tests.mjs';

const perfFile = 'tests/browser/map-zoom-transient.spec.ts';

test('full browser run isolates map performance after functional tests', () => {
  const plan = browserTestPlan([]);
  assert.equal(plan.length, 2);
  assert.equal(plan[0].kind, 'functional');
  assert.deepEqual(plan[0].args, ['--grep-invert', MAP_PERFORMANCE_PATTERN, '--pass-with-no-tests']);
  assert.deepEqual(plan[1], {
    kind: 'map-performance',
    args: [perfFile, '--grep', MAP_PERFORMANCE_PATTERN, '--workers=1'],
  });
});

test('only final full shard owns the isolated performance gate', () => {
  const first = browserTestPlan(['--shard=1/4']);
  assert.equal(first.length, 1);
  assert.equal(first[0].kind, 'functional');
  const final = browserTestPlan(['--shard=4/4']);
  assert.equal(final.length, 2);
  assert.equal(final[1].kind, 'map-performance');
});

test('targeted non-map browser selection does not add an unrelated performance gate', () => {
  const plan = browserTestPlan(['tests/browser/bank-runtime.spec.ts', '--shard=4/4']);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].kind, 'functional');
});

test('targeted map selection keeps performance isolated on the final shard', () => {
  const plan = browserTestPlan([perfFile, '--shard=4/4']);
  assert.equal(plan.length, 2);
  assert.equal(plan[1].kind, 'map-performance');
});

test('explicit grep remains a direct developer-controlled Playwright run', () => {
  const args = [perfFile, '--grep', MAP_PERFORMANCE_PATTERN, '--workers=1'];
  assert.deepEqual(browserTestPlan(args), [{ kind: 'direct', args }]);
});
''')

# Runtime verifier owns the package-level runner entry.
path = Path('scripts/verify-runtime-reliability.mjs')
text = path.read_text()
old = "if (packageJson.scripts?.['test:browser'] !== 'playwright test') failures.push('缺少固定的 Playwright 浏览器测试脚本');"
new = "if (packageJson.scripts?.['test:browser'] !== 'node scripts/run-browser-tests.mjs') failures.push('浏览器测试必须通过隔离定量性能门禁的统一 runner');"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = "  'scripts/prepare-playwright-chromium.sh',\n"
new = old + "  'scripts/run-browser-tests.mjs',\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
path.write_text(text)

# Deployment verifier locks isolation without changing workflow topology.
path = Path('scripts/verify-deployment-pipeline.mjs')
text = path.read_text()
old = "const uiArchitectureRunnerPath = resolve(root, 'scripts/verify-ui-architecture-runner.mjs');\n"
new = old + "const browserRunnerPath = resolve(root, 'scripts/run-browser-tests.mjs');\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = "const uiArchitectureRunner = readFileSync(uiArchitectureRunnerPath, 'utf8');\n"
new = old + "const browserRunner = readFileSync(browserRunnerPath, 'utf8');\n"
assert text.count(old) == 1
text = text.replace(old, new, 1)
anchor = "checkShards(workflow, 'main CI');\n"
addition = anchor + "for (const token of [\n  'MAP_PERFORMANCE_PATTERN',\n  \"'--grep-invert'\",\n  \"'--pass-with-no-tests'\",\n  \"'--workers=1'\",\n  \"shard.index === shard.total\",\n  \"selectedSpecs.includes(MAP_PERFORMANCE_FILE)\",\n]) {\n  if (!browserRunner.includes(token)) failures.push(`浏览器统一 runner 缺少性能隔离边界: ${token}`);\n}\n"
assert text.count(anchor) == 1
text = text.replace(anchor, addition, 1)
path.write_text(text)

# CI execution authority: functional sharding and quantitative performance sampling are separate scheduling concerns.
path = Path('docs/CI_EXECUTION_DESIGN.md')
text = path.read_text()
old = "- targeted 浏览器 runner 通过 `ECONOMY_PLAYWRIGHT_SHARD=N/总数` 控制 Playwright 分片；该变量只允许控制分片，不得改变选择器计划本身。"
new = old + "\n- `npm run test:browser` 必须通过统一 Node runner 执行。普通功能／视觉测试继续按既有 shard 并发，但定量 Camera 性能门禁必须从并发集合排除，并在包含该地图 spec 的无 shard 完整运行或最终 shard 结束后，以独立 Playwright 进程和 `workers=1` 执行一次。targeted 计划不包含该地图 spec 时不得额外扩散性能测试。`non-obvious reason`：同一 GitHub runner 上其他 Playwright worker 会竞争软件 Viz/compositor 线程，对变化帧的影响显著大于空帧，从而污染 `empty` 对照；隔离只改变采样调度，不改变场景、断言、预算、浏览器或产品代码。"
assert text.count(old) == 1
text = text.replace(old, new, 1)
old = "- 部署 `browser-test` 四分片执行完整 ST-browser；"
new = "- 部署 `browser-test` 四分片执行完整 ST-browser；统一浏览器 runner 在最终 shard 中把定量 Camera 性能门禁独立为 `workers=1` 的 Playwright 进程，预算与场景保持不变；"
assert text.count(old) == 1
text = text.replace(old, new, 1)
path.write_text(text)

# Strategic map authority: fixed budget remains untouched; only contamination-free scheduling is added.
path = Path('docs/STRATEGIC_MAP_RENDERING_DESIGN.md')
text = path.read_text()
old = "- 性能门禁和瓶颈剖析是两个独立采样过程。`map-zoom-transient.spec.ts` 保持真实场景、既有视口和输入序列，等待 raster-ready 后比较空帧与交互采样；预算固定为 `empty×2+8ms`，不得通过隐藏摄影、氛围、Chrome、关闭正式毛玻璃、降低视口或剔除慢样本获得通过。"
new = old + " 定量门禁不得与其他 Playwright worker 并发采样；标准浏览器 runner 必须先完成同 shard 的功能／视觉测试，再在独立 Playwright 进程中以 `workers=1` 运行该门禁。该隔离不得替代或放宽固定预算，也不得改变正式场景；其目的仅是移除同机测试 worker 对软件 Viz/compositor 的非产品竞争。"
assert text.count(old) == 1
path.write_text(text.replace(old, new, 1))
