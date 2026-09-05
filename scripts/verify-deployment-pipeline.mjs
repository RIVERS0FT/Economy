import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { selectCiPlan } from './select-ci-tests.mjs';

const root = process.cwd();
const deployPath = resolve(root, '.github/workflows/deploy.yml');
const ciPath = resolve(root, '.github/workflows/ci.yml');
const pageContentPath = resolve(root, 'scripts/verify-page-content.mjs');
const pageContentLegacyPath = resolve(root, 'scripts/verify-page-content-base.mjs');
const uiArchitectureRunnerPath = resolve(root, 'scripts/verify-ui-architecture-runner.mjs');
const nginxConfiguratorPath = resolve(root, 'scripts/configure-economy-nginx.py');
const nginxLocationTemplatePath = resolve(root, 'deploy/nginx/game.riversoft.top.economy-location.conf');
const nginxIpFallbackConfiguratorPath = resolve(root, 'scripts/configure-economy-ip-fallback-nginx.py');
const workflow = readFileSync(deployPath, 'utf8');
const ciWorkflow = readFileSync(ciPath, 'utf8');
const pageContent = readFileSync(pageContentPath, 'utf8');
const uiArchitectureRunner = readFileSync(uiArchitectureRunnerPath, 'utf8');
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
  "if: steps.scope.outputs.dependencies == 'true'",
  "if: steps.scope.outputs.mode == 'full'",
  "if: steps.scope.outputs.mode == 'targeted'",
  'plan_json: ${{ steps.scope.outputs.plan_json }}',
  '--phase dt',
  '--phase it',
  '--phase browser',
  'npm run validate:dt',
  'npm run validate:it',
  'ECONOMY_QUALITY_GATE_OK',
]) requireCiText(text);

const planCalls = ciWorkflow.match(/node scripts\/select-ci-tests\.mjs plan/g) ?? [];
if (planCalls.length !== 1) {
  failures.push('CI 必须在 DT 生成一次计划，IT/ST 复用该计划');
}
const jobSection = (source, name) => {
  const marker = `  ${name}:\n`;
  const start = source.indexOf(marker);
  if (start < 0) return '';
  const rest = source.slice(start + marker.length);
  const next = rest.search(/^  [\w-]+:\s*$/m);
  return marker + (next < 0 ? rest : rest.slice(0, next));
};
const requireNeeds = (source, name, expected) => {
  const section = jobSection(source, name);
  const match = /^    needs: *([^\n]*)/m.exec(section);
  const raw = match?.[1]?.trim() ?? '';
  const needs = raw.startsWith('[') ? raw.slice(1, -1).split(',').map((value) => value.trim())
    : raw ? [raw] : [...section.matchAll(/^      - ([\w-]+)$/gm)].map((item) => item[1]);
  if (!section || expected.some((value) => !needs.includes(value))) failures.push(`${name} 缺少必要的依赖门禁: ${expected.join(', ')}`);
};
const checkShards = (source, label) => {
  const section = jobSection(source, 'browser-test');
  const shards = /shard:\s*\[([^\]]+)\]/.exec(section)?.[1]?.split(',').map((value) => Number(value.trim())) ?? [];
  const denominator = /--shard=\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/.exec(section)?.[1];
  if (!shards.length || shards.some((value, index) => value !== index + 1) || Number(denominator) !== shards.length) failures.push(`${label} 必须完整且一致地分配所有浏览器 shard`);
  if (!/fail-fast:\s*false/.test(section) || !/timeout-minutes:\s*[1-9]\d*/.test(section)) failures.push(`${label} 必须保留失败诊断与有限超时`);
  const targeted = /ECONOMY_PLAYWRIGHT_SHARD:\s*\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/.exec(section);
  if (targeted && Number(targeted[1]) !== shards.length) failures.push(`${label} targeted shard 总数不一致`);
};
requireNeeds(ciWorkflow, 'it', ['dt']);
requireNeeds(ciWorkflow, 'browser-test', ['dt', 'it']);
requireNeeds(ciWorkflow, 'build', ['dt', 'it', 'browser-test']);
requireNeeds(workflow, 'deploy', ['build', 'browser-test']);
checkShards(ciWorkflow, 'PR CI');
checkShards(workflow, 'main CI');
if (!/if:\s*always\(\)/.test(jobSection(ciWorkflow, 'build'))) failures.push('required build 必须在依赖结束后报告结果');
if (/^  push:/m.test(ciWorkflow) || ciWorkflow.includes('verify-head-ci-registration') || /^\s+paths(?:-ignore)?:/m.test(ciWorkflow)) failures.push('PR CI 不得要求重复 push 登记或用路径过滤跳过整个 required 工作流');
for (const event of ['pull_request', 'workflow_dispatch']) {
  if (!new RegExp(`^  ${event}:`, 'm').test(ciWorkflow)) failures.push(`CI 缺少事件入口: ${event}`);
}
const itSection = jobSection(ciWorkflow, 'it');
const browserSection = jobSection(ciWorkflow, 'browser-test');
if (itSection.includes('git diff --name-only') || itSection.includes('select-ci-tests.mjs plan')) {
  failures.push('IT Job 不得重新计算 changed files 或 CI plan');
}
if (browserSection.includes('git diff --name-only') || browserSection.includes('select-ci-tests.mjs plan')) {
  failures.push('ST-browser Job 不得重新计算 changed files 或 CI plan');
}


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
if (docsPlan.needsDependencies || docsPlan.it.tests.length || docsPlan.browser.mode !== 'none') failures.push('纯文档计划不得因文档名称或正文引用扩散到业务测试或依赖安装');

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
requireText('timeout 300s rsync --timeout=60 -az -e "$RSYNC_RSH"', '生产主体文件同步必须同时具备 rsync I/O 超时与外层命令超时');
requireText('ServerAliveInterval=10', '生产文件同步 SSH 必须定期发送 keepalive');
requireText('ServerAliveCountMax=3', '生产文件同步 SSH 必须在 keepalive 失联后有限失败');
requireText('timeout 120s rsync --timeout=60 -az -e "$RSYNC_RSH"', '入口 HTML 发布同步必须具备独立有限超时');
requireText('npm run build', '部署 build 验证 Job 必须执行完整 DT/IT/coverage 聚合 build');
requireText("node_version=\"$(node -p 'process.versions.node')\"", '生产 runtime 版本必须从固定 setup-node 运行时读取，避免重复维护版本常量');
requireText('ECONOMY_NODE_RUNTIME_REUSE', '固定 Node runtime 命中时必须跳过重复下载和上传');
requireText('RUNTIME_UPLOAD: ${{ steps.prepare_runtime.outputs.upload }}', 'Node runtime 上传必须由版本探测结果控制');
requireText('--exclude runtime/', '同步 server 目录时必须排除可复用 runtime，避免 --delete-before 误删');
requireText('  report-validation-failure:\n', '验证失败必须写入 deploy/economy 失败状态');
requireText('needs: [build, browser-test]', '验证失败状态 Job 必须等待 build 与 browser-test');
requireText("needs['browser-test'].result", '带连字符的 browser-test Job 必须使用 bracket 语法读取 needs 结果');

requireCiText('      fail-fast: false\n', 'PR/分支浏览器分片必须保留完整失败诊断');

const ciBuildSection = jobSection(ciWorkflow, 'build');
for (const forbidden of ['npm run validate:dt', 'npm run validate:it', 'npm run test:browser', 'select-ci-tests.mjs run']) {
  if (ciBuildSection.includes(forbidden)) failures.push(`PR/分支 build 聚合 Job 不得重新执行验证: ${forbidden}`);
}


const deploySection = jobSection(workflow, 'deploy');
if (deploySection.includes('npm run test:browser')) failures.push('deploy Job 不得重新串行执行完整浏览器测试');
if (deploySection.includes('npm run build\n')) failures.push('deploy Job 不得重新串行执行完整 npm run build');

for (const forbidden of ['npm run generate:artwork', 'npm run generate:local-preview', './node_modules/.bin/tsc', './node_modules/.bin/vite build']) {
  if (deploySection.includes(forbidden)) failures.push(`deploy 不得重新编译已验证产物: ${forbidden}`);
}
for (const required of ['actions/download-artifact@', 'artifact-ids: ${{ needs.build.outputs.artifact_id }}', 'SOURCE_SHA: ${{ needs.build.outputs.source_sha }}', 'EXPECTED_SHA256: ${{ needs.build.outputs.artifact_sha256 }}', 'sha256sum -c -']) {
  if (!deploySection.includes(required)) failures.push(`部署产物缺少来源或完整性验证: ${required}`);
}
if (/^\s+(?:github-token|repository|run-id):/m.test(deploySection)) failures.push('正式产物只允许来自同一次受信任工作流');
const buildProducer = jobSection(workflow, 'build');
for (const required of ['npm run build', 'id: package_dist', 'id: upload_dist', 'actions/upload-artifact@']) {
  if (!buildProducer.includes(required)) failures.push(`生产 build 必须验证并提供部署产物: ${required}`);
}

if (failures.length > 0) {
  console.error(`部署与分层 CI 验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('CI 计划、聚合门禁、浏览器分片与同运行部署产物边界检查通过；完整 DT/IT/ST 与线上验收保持有效。');
