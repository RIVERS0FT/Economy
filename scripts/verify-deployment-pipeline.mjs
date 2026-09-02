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
const designPath = resolve(root, 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
const ciDesignPath = resolve(root, 'docs/CI_EXECUTION_DESIGN.md');
const facilityDesignPath = resolve(root, 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md');
const nginxConfiguratorPath = resolve(root, 'scripts/configure-economy-nginx.py');
const nginxLocationTemplatePath = resolve(root, 'deploy/nginx/game.riversoft.top.economy-location.conf');
const nginxIpFallbackConfiguratorPath = resolve(root, 'scripts/configure-economy-ip-fallback-nginx.py');
const workflow = readFileSync(deployPath, 'utf8');
const ciWorkflow = readFileSync(ciPath, 'utf8');
const selector = readFileSync(selectorPath, 'utf8');
const pageContent = readFileSync(pageContentPath, 'utf8');
const uiArchitectureRunner = readFileSync(uiArchitectureRunnerPath, 'utf8');
const design = readFileSync(designPath, 'utf8');
const ciDesign = readFileSync(ciDesignPath, 'utf8');
const facilityDesign = readFileSync(facilityDesignPath, 'utf8');
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
const requireDesignText = (text, reason) => {
  if (!design.includes(text)) failures.push(reason ?? `部署设计缺少: ${text}`);
};
const requireCiDesignText = (text, reason) => {
  if (!ciDesign.includes(text)) failures.push(reason ?? `CI 执行设计缺少: ${text}`);
};
const requireFacilityDesignText = (text, reason) => {
  if (!facilityDesign.includes(text)) failures.push(reason ?? `工厂目录设计缺少: ${text}`);
};
const hasCommand = (plan, command, args = []) => plan.checks.some((item) => item.command === command && JSON.stringify(item.args) === JSON.stringify(args));
const commandCount = (plan, command, args = []) => plan.checks.filter((item) => item.command === command && JSON.stringify(item.args) === JSON.stringify(args)).length;

for (const text of [
  'fetch-depth: 0',
  'node scripts/select-ci-tests.mjs plan',
  'git diff --name-only "$PR_BASE_SHA" "$PR_HEAD_SHA"',
  'git merge-base origin/main "$GITHUB_SHA"',
  "if: steps.scope.outputs.dependencies == 'true'",
  "if: steps.scope.outputs.mode == 'full'",
  "if: steps.scope.outputs.mode == 'targeted'",
  "if: needs.build.outputs.browser == 'true'",
  'node scripts/select-ci-tests.mjs run',
  '--phase checks',
  '--phase browser',
  'npm run build 2>&1 | tee build-test.log',
  'npm run test:browser -- --shard=${{ matrix.shard }}/4 2>&1 | tee browser-test.log',
  'ECONOMY_PLAYWRIGHT_SHARD: ${{ matrix.shard }}/4',
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
  'DOMAIN_BROWSER_BASELINES',
  'COMPOSED_VERIFY_ENTRYPOINTS',
  'verificationNeedsDependencies',
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
if (!hasCommand(marketPlan, 'npm', ['run', 'generate:local-preview'])) failures.push('前端 targeted CI 必须从服务器目录生成本地预览状态');
if (!hasCommand(marketPlan, 'npm', ['run', 'typecheck'])) failures.push('前端 targeted CI 必须执行 TypeScript 检查');
if (!hasCommand(marketPlan, './node_modules/.bin/vite', ['build'])) failures.push('前端 targeted CI 必须执行 Vite 生产构建');
if (marketPlan.browser.mode !== 'selected' || marketPlan.browser.tests.length === 0) failures.push('市场页面改动必须选择相关 Playwright 测试');
if (hasCommand(marketPlan, 'node', ['scripts/verify-market-page-layout-regional.mjs'])) failures.push('targeted CI 不得绕过市场正式组合 verifier 执行内部地区检查');
if (!hasCommand(marketPlan, 'node', ['scripts/verify-market-page-layout.mjs'])) failures.push('市场页面改动必须通过正式 market-page-layout 入口验证');

const facilityPlan = selectCiPlan(['src/pages/GlobalBuildingsPage.tsx']);
if (facilityPlan.mode !== 'targeted') failures.push('建筑页面改动必须使用 targeted CI');
if (!hasCommand(facilityPlan, 'npm', ['run', 'generate:facility-artwork'])) failures.push('建筑域 targeted CI 必须先生成工厂运行时缩略图');
if (facilityPlan.browser.mode !== 'selected' || !facilityPlan.browser.tests.includes('tests/browser/all-pages-preview.spec.ts')) {
  failures.push('建筑域 targeted CI 必须包含全页面实体列表几何回归');
}

const productCatalogPlan = selectCiPlan(['server/src/product-catalog.js']);
if (productCatalogPlan.mode !== 'targeted') failures.push('单一商品目录改动必须使用 targeted CI');
if (!productCatalogPlan.reasons.includes('domains:product-catalog')) failures.push('商品目录改动必须只归入独立 product-catalog 域');
if (!hasCommand(productCatalogPlan, 'npm', ['run', 'server:check'])) failures.push('商品目录改动必须执行服务器语法检查');
if (!hasCommand(productCatalogPlan, 'npm', ['run', 'generate:product-artwork'])) failures.push('商品目录改动必须先生成商品运行时缩略图');
if (!hasCommand(productCatalogPlan, 'npm', ['run', 'generate:local-preview'])) failures.push('商品目录改动必须重新生成免登录预览状态');
if (!hasCommand(productCatalogPlan, 'node', ['scripts/verify-industry-catalog.mjs'])) failures.push('商品目录改动必须执行产业目录验证');
if (!productCatalogPlan.browser.tests.includes('tests/browser/all-pages-preview.spec.ts')) failures.push('商品目录改动必须执行全页面预览浏览器基线');

const directRegionalMarketPlan = selectCiPlan(['scripts/verify-market-page-layout-regional.mjs']);
if (hasCommand(directRegionalMarketPlan, 'node', ['scripts/verify-market-page-layout-regional.mjs'])) failures.push('targeted CI 不得绕过市场正式组合 verifier 执行内部地区检查');
if (commandCount(directRegionalMarketPlan, 'node', ['scripts/verify-market-page-layout.mjs']) !== 1) failures.push('直接修改地区市场内部 verifier 时正式组合入口必须且只能执行一次');

const directPageContentPlan = selectCiPlan(['scripts/verify-page-content.mjs']);
if (commandCount(directPageContentPlan, 'node', ['scripts/verify-page-content.mjs']) !== 1) failures.push('直接修改 page-content verifier 时必须且只能执行正式入口一次');

const bankingPlan = selectCiPlan(['server/src/banking.js']);
if (bankingPlan.mode !== 'targeted') failures.push('银行服务端改动必须使用 targeted CI');
if (!hasCommand(bankingPlan, 'npm', ['run', 'server:check'])) failures.push('服务端 targeted CI 必须执行服务器语法检查');
if (!bankingPlan.checks.some((item) => item.command === 'node' && item.args[0] === '--test' && item.args.some((arg) => /bank/i.test(arg)))) {
  failures.push('银行服务端改动必须选择相关 server test');
}

const docsPlan = selectCiPlan(['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md']);
if (docsPlan.mode !== 'targeted') failures.push('纯设计文档改动不应默认触发完整 CI');
if (!hasCommand(docsPlan, 'node', ['scripts/verify-document-authority.mjs'])) failures.push('设计文档改动必须执行文档权威性检查');
if (!docsPlan.needsDependencies) failures.push('选中的 verifier 直接依赖 npm 包时 targeted CI 必须安装依赖');

const pageDocsPlan = selectCiPlan(['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md']);
if (
  hasCommand(pageDocsPlan, 'node', ['scripts/verify-local-game-preview.mjs'])
  && !hasCommand(pageDocsPlan, 'npm', ['run', 'generate:local-preview'])
) {
  failures.push('选中免登录预览 verifier 的 targeted CI 必须先生成忽略跟踪快照');
}

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
  failures.push('无法分类且没有测试引用的新源码必须退化为完整验证');
}

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
requireText('npm run build', 'build 验证 Job 必须执行完整 npm run build');
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

requireCiText('  browser-test:\n    needs: build\n', 'PR/分支 CI 必须把浏览器门禁拆为独立 browser-test Job 并等待 build');
requireCiText('      fail-fast: false\n', 'PR/分支浏览器分片必须保留完整失败诊断');
requireCiText('        shard: [1, 2, 3, 4]\n', 'PR/分支浏览器门禁必须固定为四个 shard');
const ciBuildIndex = ciWorkflow.indexOf('  build:\n');
const ciBrowserIndex = ciWorkflow.indexOf('  browser-test:\n');
if (!(ciBuildIndex >= 0 && ciBrowserIndex > ciBuildIndex)) {
  failures.push('PR/分支 CI 工作流顺序必须是 build → browser-test');
}
const ciBuildSection = ciBuildIndex >= 0
  ? ciWorkflow.slice(ciBuildIndex, ciBrowserIndex >= 0 ? ciBrowserIndex : ciWorkflow.length)
  : '';
if (ciBuildSection.includes('--phase browser') || ciBuildSection.includes('npm run test:browser')) {
  failures.push('PR/分支 build Job 不得重新串行执行浏览器测试');
}

requireDesignText('PR 与非 `main` push 默认使用改动文件选择器', '权威部署设计必须记录增量 CI');
requireDesignText('改动文件选择规则唯一维护在 `scripts/select-ci-tests.mjs`', '权威部署设计必须保持测试选择规则的唯一入口');
requireFacilityDesignText('建筑域的定向浏览器集合必须固定包含 `tests/browser/all-pages-preview.spec.ts`', '工厂目录设计必须记录建筑跨页面几何基线');
requireDesignText('无法分类的源码改动必须退化为完整验证', '权威部署设计必须记录未知影响范围的全量兜底');
requireDesignText('`main` 是唯一自动无条件执行完整 `npm run build` 与完整 Playwright 的分支', '权威部署设计必须记录 main 全量门禁边界');
requireDesignText('完整 `npm run build` 与完整 Playwright 浏览器回归必须作为并行硬门禁', '权威部署设计必须记录完整构建与浏览器回归并行硬门禁');
requireDesignText('独立 `browser-test` Job 固定以四个 shard', '权威部署设计必须记录四分片浏览器回归');
requireDesignText('生产 `deploy` Job 必须同时 `needs` 两者', '权威部署设计必须记录生产写入等待全部验证');
requireDesignText('同步 `server/` 时必须排除 `runtime/`', '权威部署设计必须记录 API 同步保护可复用 runtime');
requireDesignText('完全匹配时必须复用且不得重新下载或上传', '权威部署设计必须记录 Node runtime 精确匹配复用');
requireDesignText('已通过精确校验时复用服务器现有运行时', '权威部署设计必须记录运行时部署包条件');
requireDesignText('Nginx 头像 `location ~` 正则包含 `{m,n}` 量词，必须整体使用引号包裹', '权威部署设计必须记录头像正则的 Nginx 引用规则');
requireDesignText('生产文件同步必须同时受 deploy Job 20 分钟整体上限、单次 rsync 300 秒外层上限、60 秒 I/O 无进展上限与 SSH keepalive 约束', '权威部署设计必须记录文件同步的有限失败边界');
requireCiDesignText('PR 与非 `main` push 的浏览器硬门禁固定拆成四个独立 shard', 'CI 执行设计必须锁定 PR/分支四分片浏览器门禁');
requireCiDesignText('`build` Job 只执行依赖安装、静态/服务器检查、TypeScript、Vite 与完整 fallback build', 'CI 执行设计必须禁止把浏览器回归塞回 build Job');
requireCiDesignText('targeted 模式必须把选择器已经确定的同一组 Playwright spec 交给四个 shard', 'CI 执行设计必须保持 targeted 选择器唯一权威');
requireCiDesignText('不得通过提高 Job 超时', 'CI 执行设计必须禁止通过延长超时掩盖浏览器失败');
requireCiDesignText('透明 Top Layer、Portal、Popover 等共享浮层变更必须至少保留一个真实浏览器命中测试', 'CI 执行设计必须锁定共享浮层真实输入回归');

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

console.log('PR/分支按改动选择验证并以四分片执行所选浏览器门禁；建筑域固定覆盖全页面实体列表几何基线；组合 verifier 保持单一正式入口且不保留旧失败兼容层；main 仍以完整 build 与四分片浏览器回归作为部署硬门禁。');
