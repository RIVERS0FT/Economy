import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectCiPlan } from './select-ci-tests.mjs';

const root = process.cwd();
const deployPath = resolve(root, '.github/workflows/deploy.yml');
const ciPath = resolve(root, '.github/workflows/ci.yml');
const selectorPath = resolve(root, 'scripts/select-ci-tests.mjs');
const designPath = resolve(root, 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const workflow = readFileSync(deployPath, 'utf8');
const ciWorkflow = readFileSync(ciPath, 'utf8');
const selector = readFileSync(selectorPath, 'utf8');
const design = readFileSync(designPath, 'utf8');
const failures = [];

const requireText = (text, reason) => {
  if (!workflow.includes(text)) failures.push(reason ?? `deploy.yml 缺少: ${text}`);
};
const requireCiText = (text, reason) => {
  if (!ciWorkflow.includes(text)) failures.push(reason ?? `ci.yml 缺少: ${text}`);
};
const requireSelectorText = (text, reason) => {
  if (!selector.includes(text)) failures.push(reason ?? `select-ci-tests.mjs 缺少: ${text}`);
};
const requireDesignText = (text, reason) => {
  if (!design.includes(text)) failures.push(reason ?? `部署设计缺少: ${text}`);
};
const hasCommand = (plan, command, args = []) => plan.checks.some((item) => item.command === command && JSON.stringify(item.args) === JSON.stringify(args));

for (const text of [
  'fetch-depth: 0',
  'node scripts/select-ci-tests.mjs plan',
  'git diff --name-only "$PR_BASE_SHA" "$PR_HEAD_SHA"',
  'git merge-base origin/main "$GITHUB_SHA"',
  "if: steps.scope.outputs.dependencies == 'true'",
  "if: steps.scope.outputs.mode == 'full'",
  "if: steps.scope.outputs.mode == 'targeted'",
  "if: steps.scope.outputs.browser == 'true'",
  'node scripts/select-ci-tests.mjs run',
  '--phase checks',
  '--phase browser',
  'npm run build 2>&1 | tee build-test.log',
  'npm run test:browser 2>&1 | tee browser-test.log',
]) requireCiText(text);

for (const text of [
  'FULL_TRIGGER_PATTERNS',
  'high-risk:',
  'unclassified-source:',
  "'scripts/verify-deployment-pipeline.mjs'",
  "'scripts/verify-runtime-reliability.mjs'",
  "'server/test'",
  "'tests/browser'",
  'verifyCandidates',
]) requireSelectorText(text);

const marketPlan = selectCiPlan(['src/pages/MarketPage.tsx']);
if (marketPlan.mode !== 'targeted') failures.push('市场页面改动必须使用 targeted CI');
if (!marketPlan.needsDependencies) failures.push('前端 targeted CI 必须安装依赖');
if (!hasCommand(marketPlan, 'npm', ['run', 'typecheck'])) failures.push('前端 targeted CI 必须执行 TypeScript 检查');
if (!hasCommand(marketPlan, './node_modules/.bin/vite', ['build'])) failures.push('前端 targeted CI 必须执行 Vite 生产构建');
if (marketPlan.browser.mode !== 'selected' || marketPlan.browser.tests.length === 0) failures.push('市场页面改动必须选择相关 Playwright 测试');

const bankingPlan = selectCiPlan(['server/src/banking.js']);
if (bankingPlan.mode !== 'targeted') failures.push('银行服务端改动必须使用 targeted CI');
if (!hasCommand(bankingPlan, 'npm', ['run', 'server:check'])) failures.push('服务端 targeted CI 必须执行服务器语法检查');
if (!bankingPlan.checks.some((item) => item.command === 'node' && item.args[0] === '--test' && item.args.some((arg) => /bank/i.test(arg)))) {
  failures.push('银行服务端改动必须选择相关 server test');
}

const docsPlan = selectCiPlan(['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md']);
if (docsPlan.mode !== 'targeted') failures.push('纯设计文档改动不应默认触发完整 CI');
if (!hasCommand(docsPlan, 'node', ['scripts/verify-document-authority.mjs'])) failures.push('设计文档改动必须执行文档权威性检查');

const directBrowserPlan = selectCiPlan(['tests/browser/bank-runtime.spec.ts']);
if (directBrowserPlan.mode !== 'targeted' || !directBrowserPlan.browser.tests.includes('tests/browser/bank-runtime.spec.ts')) {
  failures.push('直接修改 Playwright spec 时必须执行该 spec');
}

for (const highRiskPath of [
  '.github/workflows/ci.yml',
  'package-lock.json',
  'src/app/gameViewModel.ts',
  'server/src/runtime-store.js',
  'shared/provinces.json',
]) {
  if (selectCiPlan([highRiskPath]).mode !== 'full') failures.push(`高风险改动必须退化为完整 CI: ${highRiskPath}`);
}
const unclassifiedSourcePath = `src/utils/${['new', 'CrossCutting', 'Helper'].join('')}.ts`;
if (selectCiPlan([unclassifiedSourcePath]).mode !== 'full') {
  failures.push('无法分类且没有测试引用的新源码必须退化为完整 CI');
}

requireText('  build:\n', '部署工作流必须保留独立 build 验证 Job');
requireText('  browser-test:\n', '部署工作流必须保留独立 browser-test 验证 Job');
requireText('      fail-fast: false\n', '浏览器分片必须允许其他 shard 完成以保留完整诊断');
requireText('        shard: [1, 2, 3, 4]\n', '浏览器回归必须固定为四个 shard');
requireText('npm run test:browser -- --shard=${{ matrix.shard }}/4', '浏览器验证必须按四分片执行完整 Playwright 集合');
requireText('  deploy:\n    needs:\n      - build\n      - browser-test\n', '生产部署必须等待 build 与全部 browser shard 成功');
requireText('npm run build', 'build 验证 Job 必须执行完整 npm run build');
requireText('npm run generate:artwork', '部署 Job 必须从同一源码 SHA 重新生成运行时美术资产');
requireText('./node_modules/.bin/tsc', '部署 Job 必须在上传前执行 TypeScript 生产构建检查');
requireText('./node_modules/.bin/vite build', '部署 Job 必须从同一源码 SHA 生成生产 dist');
requireText("node_version=\"$(node -p 'process.versions.node')\"", '生产 runtime 版本必须从固定 setup-node 运行时读取，避免重复维护版本常量');
requireText('ECONOMY_NODE_RUNTIME_REUSE', '固定 Node runtime 命中时必须跳过重复下载和上传');
requireText('RUNTIME_UPLOAD: ${{ steps.prepare_runtime.outputs.upload }}', 'Node runtime 上传必须由版本探测结果控制');
requireText('--exclude runtime/', '同步 server 目录时必须排除可复用 runtime，避免 --delete-before 误删');
requireText('  report-validation-failure:\n', '验证失败必须写入 deploy/economy 失败状态');
requireText('needs: [build, browser-test]', '验证失败状态 Job 必须等待 build 与 browser-test');
requireText("needs['browser-test'].result", '带连字符的 browser-test Job 必须使用 bracket 语法读取 needs 结果');

requireDesignText('PR 与非 `main` push 默认使用改动文件选择器', '权威部署设计必须记录增量 CI');
requireDesignText('无法分类的源码改动必须退化为完整验证', '权威部署设计必须记录未知影响范围的全量兜底');
requireDesignText('`main` 是唯一自动无条件执行完整 `npm run build` 与完整 Playwright 的分支', '权威部署设计必须记录 main 全量门禁边界');
requireDesignText('完整 `npm run build` 与完整 Playwright 浏览器回归必须作为并行硬门禁', '权威部署设计必须记录完整构建与浏览器回归并行硬门禁');
requireDesignText('独立 `browser-test` Job 固定以四个 shard', '权威部署设计必须记录四分片浏览器回归');
requireDesignText('生产 `deploy` Job 必须同时 `needs` 两者', '权威部署设计必须记录生产写入等待全部验证');
requireDesignText('同步 `server/` 时必须排除 `runtime/`', '权威部署设计必须记录 API 同步保护可复用 runtime');
requireDesignText('完全匹配时必须复用且不得重新下载或上传', '权威部署设计必须记录 Node runtime 精确匹配复用');
requireDesignText('已通过精确校验时复用服务器现有运行时', '权威部署设计必须记录运行时部署包条件');

const browserIndex = workflow.indexOf('  browser-test:\n');
const deployIndex = workflow.indexOf('  deploy:\n');
const reportIndex = workflow.indexOf('  report-validation-failure:\n');
if (!(browserIndex >= 0 && deployIndex > browserIndex && reportIndex > deployIndex)) {
  failures.push('部署工作流顺序必须是并行验证定义 → deploy → 验证失败状态报告');
}

const deploySection = deployIndex >= 0
  ? workflow.slice(deployIndex, reportIndex >= 0 ? reportIndex : workflow.length)
  : '';
if (deploySection.includes('npm run test:browser')) {
  failures.push('deploy Job 不得重新串行执行完整浏览器测试');
}
if (deploySection.includes('npm run build\n')) {
  failures.push('deploy Job 不得重新串行执行完整 npm run build');
}

if (failures.length > 0) {
  console.error(`部署与增量 CI 验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('PR/分支按改动选择验证，未知高风险改动自动全量；main 仍以完整 build 与四分片浏览器回归作为部署硬门禁。');
