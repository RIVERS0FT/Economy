import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const forbidFile = (path) => { if (existsSync(resolve(root, path))) failures.push(`不应存在文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const path of [
  'package-lock.json',
  'playwright.config.ts',
  'scripts/prepare-playwright-chromium.sh',
  'scripts/run-browser-tests.mjs',
  'runtime-test.html',
  'shared/provinces.json',
  'scripts/check-server-syntax.mjs',
  'scripts/install-economy-api.py',
  'scripts/verify-production-deployment.sh',
  'tests/browser/runtime-harness.tsx',
  'tests/browser/runtime.spec.ts',
  'src/app/AppErrorBoundary.tsx',
  'src/components/AdminGiftCodesSection.tsx',
  'server/src/admin-summary.js',
  'server/src/provinces.js',
  'server/src/verification-retention.js',
  'server/test/admin-pagination.test.js',
  'server/test/admin-summary.test.js',
  'server/test/facility-cold-compatibility.test.js',
  'server/test/http.test.js',
  'server/test/rate-limit.test.js',
  'server/test/verification-retention.test.js',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/configure-registration-email.yml',
  'docs/CI_EXECUTION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
]) requireFile(path);
forbidFile('.github/workflows/web-build.yml');
forbidText('.github/workflows/deploy.yml', 'ssh-keyscan -p "$SERVER_PORT" "$SERVER_HOST"');
forbidText('.github/workflows/deploy.yml', 'cat /tmp/economy-install-dependencies.log 2>/dev/null || true');
forbidText('.github/workflows/ci.yml', 'npx playwright install --with-deps chromium');
forbidText('.github/workflows/deploy.yml', 'npx playwright install --with-deps chromium');

const packageJson = JSON.parse(read('package.json'));
for (const [group, dependencies] of Object.entries({
  dependencies: packageJson.dependencies || {},
  devDependencies: packageJson.devDependencies || {},
})) {
  for (const [name, version] of Object.entries(dependencies)) {
    if (version === 'latest' || /^[~^]/.test(String(version))) {
      failures.push(`${group}.${name} 必须使用精确版本，当前为 ${version}`);
    }
  }
}
if (packageJson.engines?.node !== '>=24.4.0 <25') failures.push('package.json 必须固定 Node 24.4.0 主版本范围');
if (packageJson.scripts?.['test:browser'] !== 'node scripts/run-browser-tests.mjs') failures.push('浏览器测试必须通过隔离定量性能门禁的统一 runner');
if (packageJson.scripts?.['server:check'] !== 'node scripts/check-server-syntax.mjs') failures.push('服务器语法检查必须使用跨平台 Node 枚举脚本');
for (const text of [
  'google-chrome',
  'google-chrome-stable',
  'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH',
  'ECONOMY_PLAYWRIGHT_BROWSER_SOURCE=runner',
  'ECONOMY_PLAYWRIGHT_BROWSER_SOURCE=download',
  'npx playwright install --with-deps chromium',
  'GITHUB_ENV',
]) requireText('scripts/prepare-playwright-chromium.sh', text);

for (const text of ['readdirSync', "entry.name.endsWith('.js')", "spawnSync(process.execPath, ['--check', sourceFile]"]) {
  requireText('scripts/check-server-syntax.mjs', text);
}

for (const text of ['界面音效', '画面性能']) forbidText('src/pages/SettingsPage.tsx', text);
requireText('src/pages/SettingsPage.tsx', '状态刷新频率');
forbidText('src/pages/SettingsPage.tsx', '紧凑数字');
for (const text of ['function readStorageItem', 'window.localStorage.getItem', 'catch {', 'return null']) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['MAX_BUCKETS = 10_000', 'sweepExpiredBuckets', 'rateLimitBucketCount']) requireText('server/src/rateLimit.js', text);
for (const text of ['getStableAdminSummary', 'cleanupEmailVerificationRecords', 'listGiftCodePage', 'listGiftRedemptionPage']) requireText('server/src/app.js', text);
for (const text of ['DEFAULT_ADMIN_PAGE_SIZE = 100', 'MAX_ADMIN_PAGE_SIZE = 200', 'nextCursor']) requireText('server/src/gift-code-batch.js', text);
for (const text of ['加载更多礼品码', '加载更多兑换记录', 'giftCodeTotal', 'redemptionTotal']) requireText('src/components/AdminGiftCodesSection.tsx', text);
requireText('src/app/gameViewModel.ts', 'useOperationNotifications(user.id)');
for (const text of ['timerRef', 'clearTimeout(timerRef.current)', 'activeUserRef.current = null']) requireText('src/hooks/useOperationNotifications.ts', text);
forbidText('src/app/GameApp.tsx', 'setCompactNumbersEnabled');
forbidText('src/app/gameViewModel.ts', 'compactNumbers');
requireText('src/main.tsx', '<AppErrorBoundary>');
requireText('server/src/provinces.js', "import provinceCatalog from '../../shared/provinces.json' with { type: 'json' };");
for (const text of ['Storage.prototype', '界面音效', '画面性能', '__localActivityResult']) requireText('tests/browser/runtime.spec.ts', text);
for (const text of [
  'const HTTP_API_READY_TIMEOUT_MS = 15_000;',
  'const HTTP_API_PROBE_TIMEOUT_MS = 1_000;',
  'const HTTP_API_RETRY_INTERVAL_MS = 50;',
  'AbortSignal.timeout(Math.min(HTTP_API_PROBE_TIMEOUT_MS, remaining))',
  'child stdout:',
  'child stderr:',
]) requireText('server/test/http.test.js', text);
forbidText('server/test/http.test.js', 'async function waitFor(url, attempts = 50)');

// Workflow topology and shard completeness belong to verify-deployment-pipeline.
// This verifier only owns runtime preparation and failure diagnostics.
for (const text of [
  'group: economy-ci-',
  'cancel-in-progress: true',
  'bash scripts/prepare-playwright-chromium.sh',
  '--phase browser 2>&1 | tee browser-test.log',
  'name: economy-browser-test-artifacts-',
  'if: failure()',
  'retention-days: 3',
]) requireText('.github/workflows/ci.yml', text);
for (const text of [
  'const readBrowserShard = () => {',
  'process.env.ECONOMY_PLAYWRIGHT_SHARD?.trim()',
  'ECONOMY_PLAYWRIGHT_SHARD 格式无效',
  'ECONOMY_PLAYWRIGHT_SHARD 超出范围',
  'if (shard) browserArgs.push(`--shard=${shard}`);',
]) requireText('scripts/select-ci-tests.mjs', text);
for (const text of [
  'node-version: 24.4.0',
  'cache: npm',
  'economy-install-dependencies.log',
  'npm run build',
  'bash scripts/prepare-playwright-chromium.sh',
  'Ensure rsync is available',
  'if ! command -v rsync >/dev/null 2>&1; then',
  'StrictHostKeyChecking=accept-new',
  'BatchMode=yes',
  'ConnectTimeout=15',
  'for attempt in 1 2 3 4 5; do',
  'ECONOMY_SSH_PREFLIGHT_RETRY attempt=$attempt',
  'ECONOMY_SSH_PREFLIGHT_FAILED attempts=5',
  '/var/www/game/shared',
  'ECONOMY_SHARED_DIRECTORY_NOT_WRITABLE',
  'shared/ "$SERVER_USER@$ECONOMY_PRODUCTION_PUBLIC_IP:/var/www/game/shared/"',
  'Collect failed step log',
  'collect_failed_log',
  'if [ "$outcome" != "failure" ]; then',
  'actions/upload-artifact@v7',
  'name: economy-deploy-failure-${{ github.run_id }}-${{ github.run_attempt }}',
  'path: ${{ runner.temp }}/economy-failure-log',
  'retention-days: 3',
  'compression-level: 9',
  'Verify production host before publishing entry',
  'Verify public website, account routes, and game API',
  'economy-pre-publish-verify.log',
  'economy-post-publish-verify.log',
  'economy-failure-summary.txt',
  'cat /tmp/economy-failure-summary.txt',
]) requireText('.github/workflows/deploy.yml', text);

for (const text of [
  'SERVICE_LISTEN_HOST = "127.0.0.1"',
  'SERVICE_LISTEN_PORT = 3002',
  'SERVICE_READY_TIMEOUT_SECONDS = 45',
  'SERVICE_LISTEN_CONNECT_TIMEOUT_SECONDS = 1.0',
  'def api_service_listening()',
  'socket.create_connection(',
  'def wait_for_service_ready()',
  'ECONOMY_API_SERVICE_LISTEN_RETRY',
  'ECONOMY_API_SERVICE_LISTEN_TIMEOUT',
  'ECONOMY_API_SERVICE_DIAGNOSTICS_BEGIN',
  '["systemctl", "status", SERVICE_NAME, "--no-pager", "--full"]',
  '["journalctl", "-u", SERVICE_NAME, "-n", "80", "--no-pager"]',
  'release_dir.parent / "shared" / "provinces.json"',
  'wait_for_service_ready()',
]) requireText('scripts/install-economy-api.py', text);

for (const text of [
  'trap report_unexpected_failure ERR',
  'ECONOMY_DEPLOY_VERIFY_START',
  'ECONOMY_DEPLOY_VERIFY_OK',
  'ECONOMY_DEPLOY_VERIFY_FAILED',
  'verify_remote',
  'verify_public',
  'database-incremental',
  'API_HEALTH_MAX_ATTEMPTS=15',
  'ECONOMY_API_HEALTH_RETRY',
  'ECONOMY_API_HEALTH_RETRY_EXHAUSTED',
  'ECONOMY_API_HEALTH_DIAGNOSTICS_BEGIN',
  'ECONOMY_HEALTH_PROXY_UNAVAILABLE',
  'https://${PUBLIC_IP}/economy-api/health',
  'FORMAL_DOMAIN="game.riversoft.top"',
  'formal-domain-page',
  'formal-domain-health-api',
  'formal-domain-game-api',
  'systemctl status riversoft-economy-api.service --no-pager --full',
  'journalctl -u riversoft-economy-api.service -n 80 --no-pager',
]) requireText('scripts/verify-production-deployment.sh', text);

for (const path of [
  'scripts/configure-economy-nginx.py',
  'scripts/configure-economy-registration-nginx.py',
  'scripts/configure-economy-static-cache.py',
]) {
  for (const text of [
    'NGINX_BACKUP_DIRECTORY = Path("/var/tmp/economy-nginx-backups")',
    'def create_nginx_backup(path: Path) -> Path:',
  ]) requireText(path, text);
  for (const text of [
    '.with_suffix(changed_path.suffix + ".economy-proxy.bak")',
    '.with_suffix(path.suffix + ".economy-registration-proxy.bak")',
    '.with_name(path.name + ".economy-static-cache.bak")',
  ]) forbidText(path, text);
}
requireText('scripts/configure-economy-nginx.py', 'ECONOMY_NGINX_ENABLED_BACKUP_CONFLICT');
requireText('deploy/nginx/game.riversoft.top.economy-location.conf', 'proxy_read_timeout 90s;');
forbidText('deploy/nginx/game.riversoft.top.economy-location.conf', 'proxy_read_timeout 3s;');

for (const text of [
  'RETIRED_FACILITY_GROUP_FIELDS',
  'needsFacilityColdCompatibilityMigration',
  'this.migrateLoadedWorld(loaded.world, now)',
  'this.saveWorldIfChanged(loaded.revision, world, now, loaded.stateJson)',
]) requireText('server/src/runtime-store.js', text);
for (const text of [
  'current V2 cold load migrates retired facility transition state exactly once',
  'pendingJoinCount: Number.MAX_SAFE_INTEGER + 1',
  'Number(metaAfter.revision), Number(metaBefore.revision) + 1',
  'assert.deepEqual(metaReopened, metaAfter)',
]) requireText('server/test/facility-cold-compatibility.test.js', text);

const deployWorkflow = read('.github/workflows/deploy.yml');
const prePublishVerificationIndex = deployWorkflow.indexOf('Verify production host before publishing entry');
const publishEntryIndex = deployWorkflow.indexOf('Publish website entry and prune expired assets');
const postPublishVerificationIndex = deployWorkflow.indexOf('Verify public website, account routes, and game API');
if (!(prePublishVerificationIndex >= 0 && prePublishVerificationIndex < publishEntryIndex && publishEntryIndex < postPublishVerificationIndex)) {
  failures.push('部署验收必须保持发布前远端验收 → 原子入口发布 → 发布后公网验收的顺序');
}

for (const [path, text] of [
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '读取、写入或删除 localStorage 失败'],
  ['docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '默认每页 100 条、最多 200 条'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '验证码终态记录保留 30 天'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'Node 24.4.0'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '不得依赖单次 `ssh-keyscan`'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '最多尝试 5 次'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '数据库备份、文件上传和服务变更之前终止'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '成功步骤日志不得上传'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '发布前远端验收和发布后公网验收'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'ECONOMY_DEPLOY_VERIFY_START'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'economy-failure-summary.txt'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '禁止重新扫描或拼接成功步骤日志'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '不得再为单次构建失败创建临时诊断工作流'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '服务器语法检查由 Node 枚举'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '浏览器 CDN'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '服务安装阶段只确认 `systemd active + 127.0.0.1:3002 TCP` 已监听'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '安装器不得用 HTTP `/health` 复制正式健康门禁'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '45 秒真实健康检查门槛保持不变'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'exact `location = /economy-api/health`'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得显示没有实际运行效果的“界面音效”或“画面性能”控件'],
  ['docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '礼品码列表和兑换记录可能持续增长'],
]) requireText(path, text);

if (failures.length) {
  console.error(`运行时可靠性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('依赖锁、浏览器运行环境、失败步骤日志 Artifact、API 就绪与共享运行时数据、浏览器存储容错、管理员分页、验证码保留、限流清理、冷加载兼容迁移和浏览器测试均符合当前设计。');
