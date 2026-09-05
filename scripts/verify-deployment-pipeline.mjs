import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectCiPlan } from './select-ci-tests.mjs';

const root = process.cwd();
const deployPath = resolve(root, '.github/workflows/deploy.yml');
const ciPath = resolve(root, '.github/workflows/ci.yml');
const selectorPath = resolve(root, 'scripts/select-ci-tests.mjs');
const pageContentPath = resolve(root, 'scripts/verify-page-content.mjs');
const pageContentLegacyPath = resolve(root, 'scripts/verify-page-content-base.mjs');
const uiArchitectureRunnerPath = resolve(root, 'scripts/verify-ui-architecture-runner.mjs');
const ciDesignPath = resolve(root, 'docs/CI_EXECUTION_DESIGN.md');
const nginxConfiguratorPath = resolve(root, 'scripts/configure-economy-nginx.py');
const nginxLocationTemplatePath = resolve(root, 'deploy/nginx/game.riversoft.top.economy-location.conf');
const nginxIpFallbackConfiguratorPath = resolve(root, 'scripts/configure-economy-ip-fallback-nginx.py');
const workflow = readFileSync(deployPath, 'utf8');
const ciWorkflow = readFileSync(ciPath, 'utf8');
const selector = readFileSync(selectorPath, 'utf8');
const pageContent = readFileSync(pageContentPath, 'utf8');
const uiArchitectureRunner = readFileSync(uiArchitectureRunnerPath, 'utf8');
const ciDesign = readFileSync(ciDesignPath, 'utf8');
const nginxConfigurator = readFileSync(nginxConfiguratorPath, 'utf8');
const nginxLocationTemplate = readFileSync(nginxLocationTemplatePath, 'utf8');
const nginxIpFallbackConfigurator = readFileSync(nginxIpFallbackConfiguratorPath, 'utf8');
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
const requireCiDesignText = (text, reason) => {
  if (!ciDesign.includes(text)) failures.push(reason ?? `CI 执行设计缺少: ${text}`);
};
const hasDtCommand = (plan, command, args = []) => plan.dt.commands.some((item) => (
  item.command === command && JSON.stringify(item.args) === JSON.stringify(args)
));
const dtCommandCount = (plan, command, args = []) => plan.dt.commands.filter((item) => (
  item.command === command && JSON.stringify(item.args) === JSON.stringify(args)
)).length;

for (const text of [
  'fetch-depth: 0',
  'node scripts/select-ci-tests.mjs plan',
  'git diff --name-only "$PR_BASE_SHA" "$PR_HEAD_SHA"',
  'git merge-base origin/main "$GITHUB_SHA"',
  "if: steps.scope.outputs.dependencies == 'true'",
  "if: steps.scope.outputs.mode == 'full'",
  "if: steps.scope.outputs.mode == 'targeted'",
  'plan_json: ${{ steps.scope.outputs.plan_json }}',
  '--phase dt',
  '--phase it',
  '--phase browser',
  'npm run validate:dt',
  'npm run validate:it',
  'npm run test:browser -- --shard=${{ matrix.shard }}/4',
  'ECONOMY_PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4',
  'Aggregate DT IT ST quality gate',
  'ECONOMY_QUALITY_GATE_OK',
]) requireCiText(text);

const planCalls = ciWorkflow.match(/node scripts\/select-ci-tests\.mjs plan/g) ?? [];
if (planCalls.length !== 3) {
  failures.push('CI 只允许 DT 的三种事件分支调用同一 plan 入口，IT/ST 不得再次计算 changed files');
}
const itSectionStart = ciWorkflow.indexOf('  it:\n');
const browserSectionStart = ciWorkflow.indexOf('  browser-test:\n');
const buildSectionStart = ciWorkflow.indexOf('  build:\n');
if (!(itSectionStart >= 0 && browserSectionStart > itSectionStart && buildSectionStart > browserSectionStart)) {
  failures.push('PR/分支 CI 工作流顺序必须是 DT → IT → ST-browser → build 聚合门禁');
}
const itSection = itSectionStart >= 0 ? ciWorkflow.slice(itSectionStart, browserSectionStart) : '';
const browserSection = browserSectionStart >= 0 ? ciWorkflow.slice(browserSectionStart, buildSectionStart) : '';
if (itSection.includes('git diff --name-only') || itSection.includes('select-ci-tests.mjs plan')) {
  failures.push('IT Job 不得重新计算 changed files 或 CI plan');
}
if (browserSection.includes('git diff --name-only') || browserSection.includes('select-ci-tests.mjs plan')) {
  failures.push('ST-browser Job 不得重新计算 changed files 或 CI plan');
}

for (const text of [
  'FULL_TRIGGER_PATTERNS',
  'high-risk:',
  'unclassified-source:',
  "'scripts/verify-deployment-pipeline.mjs'",
  "'scripts/verify-runtime-reliability.mjs'",
  "'scripts/run-code-coverage.mjs'",
  "'tests/dt'",
  "'server/test'",
  "'tests/browser'",
  'verifyCandidates',
  'itDomains',
  'DOMAIN_BROWSER_BASELINES',
  'COMPOSED_VERIFY_ENTRYPOINTS',
  'verificationNeedsDependencies',
  'plan_json=',
  'ECONOMY_PLAYWRIGHT_SHARD',
]) requireSelectorText(text);

if (existsSync(pageContentLegacyPath)) failures.push('旧 page-content base verifier 不得继续存在');
for (const forbidden of ['obsoleteBaseFailures', "['scripts/verify-page-content-base.mjs']", 'spawnSync(']) {
  if (pageContent.includes(forbidden)) failures.push(`page-content 正式 verifier 不得保留旧兼容层: ${forbidden}`);
}

const quotedAvatarLocation = 'location ~ "^/economy-avatars/(?<avatar_id>[1-9][0-9]{0,15})\\.webp$" {';
const healthLocation = 'location = /economy-api/health {';
for (const [source, label] of [
  [nginxConfigurator, 'configure-economy-nginx.py'],
  [nginxLocationTemplate, 'Economy Nginx location 模板'],
]) {
  if (!source.includes(quotedAvatarLocation)) failures.push(`${label} 必须引用含量词的头像正则`);
  if (source.includes('location ~ ^/economy-avatars/')) failures.push(`${label} 不得保留未引用头像正则`);
  if (!source.includes(healthLocation)) failures.push(`${label} 必须公开 Economy exact health 路由`);
  if (!source.includes('proxy_pass http://127.0.0.1:3002/health;')) failures.push(`${label} health 路由必须指向本机 Economy /health`);
}
if (!nginxIpFallbackConfigurator.includes(healthLocation)) failures.push('configure-economy-ip-fallback-nginx.py 必须公开 Economy exact health 路由');
if (!nginxIpFallbackConfigurator.includes('proxy_pass http://127.0.0.1:3002/health;')) failures.push('configure-economy-ip-fallback-nginx.py health 路由必须指向本机 Economy /health');

for (const forbidden of ['readFileSync', '.replace(', 'data:text/javascript', 'Buffer.from(']) {
  if (uiArchitectureRunner.includes(forbidden)) failures.push(`UI 架构 runner 不得改写 verifier 源码: ${forbidden}`);
}

const marketPlan = selectCiPlan(['src/pages/MarketPage.tsx']);
if (marketPlan.mode !== 'targeted') failures.push('市场页面改动必须使用 targeted CI');
if (!marketPlan.needsDependencies) failures.push('前端 targeted CI 必须安装依赖');
if (!hasDtCommand(marketPlan, 'npm', ['run', 'generate:local-preview'])) failures.push('前端 targeted DT 必须从服务器目录生成本地预览状态');
if (!hasDtCommand(marketPlan, 'node', ['scripts/run-code-coverage.mjs', 'dt'])) failures.push('前端 targeted DT 必须执行客户端纯逻辑覆盖率');
if (!hasDtCommand(marketPlan, 'npm', ['run', 'typecheck'])) failures.push('前端 targeted DT 必须执行 TypeScript 检查');
if (!hasDtCommand(marketPlan, './node_modules/.bin/vite', ['build'])) failures.push('前端 targeted DT 必须执行 Vite 生产构建');
if (marketPlan.browser.mode !== 'selected' || marketPlan.browser.tests.length === 0) failures.push('市场页面改动必须选择相关 Playwright ST');
if (hasDtCommand(marketPlan, 'node', ['scripts/verify-market-page-layout-regional.mjs'])) failures.push('targeted DT 不得绕过市场正式组合 verifier 执行内部地区检查');
if (!hasDtCommand(marketPlan, 'node', ['scripts/verify-market-page-layout.mjs'])) failures.push('市场页面改动必须通过正式 market-page-layout 入口验证');

const frontendProvincePlan = selectCiPlan(['src/components/provinces/UsMainlandMap.tsx']);
if (frontendProvincePlan.mode !== 'targeted') failures.push('纯前端战略地图改动必须使用 targeted CI');
if (frontendProvincePlan.it.tests.length !== 0) failures.push('纯前端战略地图改动不得仅凭 province/map 域扩散服务器 IT');
if (frontendProvincePlan.browser.mode !== 'selected' || frontendProvincePlan.browser.tests.length === 0) failures.push('纯前端战略地图改动必须选择相关 Playwright ST');

const facilityPlan = selectCiPlan(['src/pages/GlobalBuildingsPage.tsx']);
if (facilityPlan.mode !== 'targeted') failures.push('建筑页面改动必须使用 targeted CI');
if (!hasDtCommand(facilityPlan, 'npm', ['run', 'generate:facility-artwork'])) failures.push('建筑域 targeted DT 必须先生成工厂运行时缩略图');
if (facilityPlan.browser.mode !== 'selected' || !facilityPlan.browser.tests.includes('tests/browser/all-pages-preview.spec.ts')) {
  failures.push('建筑域 targeted ST 必须包含全页面实体列表几何回归');
}

const productCatalogPlan = selectCiPlan(['server/src/product-catalog.js']);
if (productCatalogPlan.mode !== 'targeted') failures.push('单一商品目录改动必须使用 targeted CI');
if (!productCatalogPlan.reasons.includes('domains:product-catalog')) failures.push('商品目录改动必须只归入独立 product-catalog 域');
if (!hasDtCommand(productCatalogPlan, 'npm', ['run', 'server:check'])) failures.push('商品目录改动必须执行服务器语法 DT');
if (!hasDtCommand(productCatalogPlan, 'npm', ['run', 'generate:product-artwork'])) failures.push('商品目录改动必须先生成商品运行时缩略图');
if (!hasDtCommand(productCatalogPlan, 'npm', ['run', 'generate:local-preview'])) failures.push('商品目录改动必须重新生成免登录预览状态');
if (!hasDtCommand(productCatalogPlan, 'node', ['scripts/verify-industry-catalog.mjs'])) failures.push('商品目录改动必须执行产业目录 DT');
if (!productCatalogPlan.browser.tests.includes('tests/browser/all-pages-preview.spec.ts')) failures.push('商品目录改动必须执行全页面预览 ST 基线');

const directRegionalMarketPlan = selectCiPlan(['scripts/verify-market-page-layout-regional.mjs']);
if (hasDtCommand(directRegionalMarketPlan, 'node', ['scripts/verify-market-page-layout-regional.mjs'])) failures.push('targeted DT 不得绕过市场正式组合 verifier 执行内部地区检查');
if (dtCommandCount(directRegionalMarketPlan, 'node', ['scripts/verify-market-page-layout.mjs']) !== 1) failures.push('直接修改地区市场内部 verifier 时正式组合入口必须且只能执行一次');

const directPageContentPlan = selectCiPlan(['scripts/verify-page-content.mjs']);
if (dtCommandCount(directPageContentPlan, 'node', ['scripts/verify-page-content.mjs']) !== 1) failures.push('直接修改 page-content verifier 时必须且只能执行正式入口一次');

const bankingPlan = selectCiPlan(['server/src/banking.js']);
if (bankingPlan.mode !== 'targeted') failures.push('银行服务端改动必须使用 targeted CI');
if (!hasDtCommand(bankingPlan, 'npm', ['run', 'server:check'])) failures.push('服务端 targeted DT 必须执行服务器语法检查');
if (!bankingPlan.it.tests.some((path) => /bank/i.test(path))) failures.push('银行服务端改动必须选择相关 IT');

const serverProvincePlan = selectCiPlan(['server/src/provinces.js']);
if (serverProvincePlan.mode !== 'targeted') failures.push('地区服务端改动必须使用 targeted CI');
if (!serverProvincePlan.it.tests.some((path) => /province/i.test(path))) failures.push('地区服务端改动必须继续选择相关 IT');

const docsPlan = selectCiPlan(['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md']);
if (docsPlan.mode !== 'targeted') failures.push('纯设计文档改动不应默认触发完整 CI');
if (!hasDtCommand(docsPlan, 'node', ['scripts/verify-document-authority.mjs'])) failures.push('设计文档改动必须执行文档权威性 DT');
if (!docsPlan.needsDependencies) failures.push('选中的 verifier 直接依赖 npm 包时 targeted CI 必须安装依赖');

const pageDocsPlan = selectCiPlan(['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md']);
if (
  hasDtCommand(pageDocsPlan, 'node', ['scripts/verify-local-game-preview.mjs'])
  && !hasDtCommand(pageDocsPlan, 'npm', ['run', 'generate:local-preview'])
) failures.push('选中免登录预览 verifier 的 targeted DT 必须先生成忽略跟踪快照');

const directDtPlan = selectCiPlan(['tests/dt/client-runtime-logic.test.ts']);
if (!hasDtCommand(directDtPlan, 'node', ['scripts/run-code-coverage.mjs', 'dt'])) failures.push('直接修改 DT 测试时必须执行 DT coverage');

const directItPlan = selectCiPlan(['server/test/banking.test.js']);
if (directItPlan.mode !== 'targeted' || !directItPlan.it.tests.includes('server/test/banking.test.js')) failures.push('直接修改 server test 时必须执行该 IT');

const directBrowserPlan = selectCiPlan(['tests/browser/bank-runtime.spec.ts']);
if (directBrowserPlan.mode !== 'targeted' || !directBrowserPlan.browser.tests.includes('tests/browser/bank-runtime.spec.ts')) failures.push('直接修改 Playwright spec 时必须执行该 ST');

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
if (selectCiPlan([unclassifiedSourcePath]).mode !== 'full') failures.push('无法分类且没有测试引用的新源码必须退化为完整验证');

requireText('  build:\n', '部署工作流必须保留独立 build 验证 Job');
requireText('  browser-test:\n', '部署工作流必须保留独立 browser-test 验证 Job');
requireText('      fail-fast: false\n', '浏览器分片必须允许其他 shard 完成以保留完整诊断');
requireText('        shard: [1, 2, 3, 4]\n', '浏览器回归必须固定为四个 shard');
requireText('npm run test:browser -- --shard=${{ matrix.shard }}/4', '浏览器验证必须按四分片执行完整 Playwright 集合');
requireText('  deploy:\n    needs:\n      - build\n      - browser-test\n    runs-on: ubuntu-latest\n    timeout-minutes: 20\n', '生产部署必须等待 build 与全部 browser shard 成功并保留整体超时边界');
requireText('timeout 300s rsync --timeout=60 -az -e "$RSYNC_RSH"', '生产主体文件同步必须同时具备 rsync I/O 超时与外层命令超时');
requireText('ServerAliveInterval=10', '生产文件同步 SSH 必须定期发送 keepalive');
requireText('ServerAliveCountMax=3', '生产文件同步 SSH 必须在 keepalive 失联后有限失败');
requireText('timeout 120s rsync --timeout=60 -az -e "$RSYNC_RSH"', '入口 HTML 发布同步必须具备独立有限超时');
requireText('npm run build', '部署 build 验证 Job 必须执行完整 DT/IT/coverage 聚合 build');
requireText('npm run generate:artwork', '部署 Job 必须从同一源码 SHA 重新生成运行时美术资产');
requireText('npm run generate:local-preview', '部署 Job 必须从同一源码 SHA 重新生成免登录预览状态');
requireText('./node_modules/.bin/tsc', '部署 Job 必须在上传前执行 TypeScript 生产构建检查');
requireText('./node_modules/.bin/vite build', '部署 Job 必须从同一源码 SHA 生成生产 dist');
requireText("node_version=\"$(node -p 'process.versions.node')\"", '生产 runtime 版本必须从固定 setup-node 运行时读取，避免重复维护版本常量');
requireText('ECONOMY_NODE_RUNTIME_REUSE', '固定 Node runtime 命中时必须跳过重复下载和上传');
requireText('RUNTIME_UPLOAD: ${{ steps.prepare_runtime.outputs.upload }}', 'Node runtime 上传必须由版本探测结果控制');
requireText('--exclude runtime/', '同步 server 目录时必须排除可复用 runtime，避免 --delete-before 误删');
requireText('  report-validation-failure:\n', '验证失败必须写入 deploy/economy 失败状态');
requireText('needs: [build, browser-test]', '验证失败状态 Job 必须等待 build 与 browser-test');
requireText("needs['browser-test'].result", '带连字符的 browser-test Job 必须使用 bracket 语法读取 needs 结果');

requireCiText('  it:\n    needs: dt\n', 'PR/分支 CI 必须让 IT 等待 DT');
requireCiText('  browser-test:\n    needs: [dt, it]\n', 'PR/分支 ST-browser 必须等待 DT 与 IT');
requireCiText('  build:\n    if: always()\n    needs: [verify-head-ci-registration, dt, it, browser-test]\n', 'required build 必须是 DT/IT/ST 聚合门禁');
requireCiText('      fail-fast: false\n', 'PR/分支浏览器分片必须保留完整失败诊断');
requireCiText('        shard: [1, 2, 3, 4]\n', 'PR/分支浏览器门禁必须固定为四个 shard');

const ciDtIndex = ciWorkflow.indexOf('  dt:\n');
const ciItIndex = ciWorkflow.indexOf('  it:\n');
const ciBrowserIndex = ciWorkflow.indexOf('  browser-test:\n');
const ciBuildIndex = ciWorkflow.indexOf('  build:\n');
if (!(ciDtIndex >= 0 && ciItIndex > ciDtIndex && ciBrowserIndex > ciItIndex && ciBuildIndex > ciBrowserIndex)) {
  failures.push('PR/分支 CI 工作流定义必须按 DT → IT → browser-test → build 聚合排列');
}
const ciBuildSection = ciBuildIndex >= 0 ? ciWorkflow.slice(ciBuildIndex) : '';
for (const forbidden of ['npm run validate:dt', 'npm run validate:it', 'npm run test:browser', 'select-ci-tests.mjs run']) {
  if (ciBuildSection.includes(forbidden)) failures.push(`PR/分支 build 聚合 Job 不得重新执行验证: ${forbidden}`);
}

requireCiDesignText('DT（Development Test）', 'CI 执行设计必须定义 DT');
requireCiDesignText('IT（Integration Test）', 'CI 执行设计必须定义 IT');
requireCiDesignText('ST（System Test）', 'CI 执行设计必须定义 ST');
requireCiDesignText('DT 最低覆盖率固定为', 'CI 执行设计必须锁定 DT coverage');
requireCiDesignText('IT 最低覆盖率固定为', 'CI 执行设计必须锁定 IT coverage');
requireCiDesignText('Targeted IT 的领域扩散只允许从本次变更中的', 'CI 执行设计必须锁定 targeted IT 的服务端领域来源');
requireCiDesignText('最终 `build` 聚合 Job 只做门禁汇总', 'CI 执行设计必须锁定稳定 required build 聚合门禁');
requireCiDesignText('targeted 模式必须把选择器已经确定的同一组 Playwright spec 交给四个 shard', 'CI 执行设计必须保持 targeted ST 选择器唯一权威');
requireCiDesignText('不得通过提高 Job 超时', 'CI 执行设计必须禁止通过延长超时掩盖浏览器失败');
requireCiDesignText('透明 Top Layer、Portal、Popover 等共享浮层变更必须至少保留一个真实浏览器命中测试', 'CI 执行设计必须锁定共享浮层真实输入回归');

const browserIndex = workflow.indexOf('  browser-test:\n');
const deployIndex = workflow.indexOf('  deploy:\n');
const reportIndex = workflow.indexOf('  report-validation-failure:\n');
if (!(browserIndex >= 0 && deployIndex > browserIndex && reportIndex > deployIndex)) failures.push('部署工作流顺序必须是并行验证定义 → deploy → 验证失败状态报告');

const deploySection = deployIndex >= 0 ? workflow.slice(deployIndex, reportIndex >= 0 ? reportIndex : workflow.length) : '';
if (deploySection.includes('npm run test:browser')) failures.push('deploy Job 不得重新串行执行完整浏览器测试');
if (deploySection.includes('npm run build\n')) failures.push('deploy Job 不得重新串行执行完整 npm run build');

if (failures.length > 0) {
  console.error(`部署与分层 CI 验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('DT/IT/ST 已按同一 changed-file 计划分层执行，DT/IT coverage 为硬门禁，四分片 ST-browser 通过后由稳定 build 状态统一聚合；main 仍以完整 build 与四分片浏览器回归作为部署硬门禁。');