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
  'runtime-test.html',
  'tests/browser/runtime-harness.tsx',
  'tests/browser/runtime.spec.ts',
  'src/app/AppErrorBoundary.tsx',
  'server/src/admin-summary.js',
  'server/src/verification-retention.js',
  'server/test/admin-pagination.test.js',
  'server/test/admin-summary.test.js',
  'server/test/rate-limit.test.js',
  'server/test/verification-retention.test.js',
  '.github/workflows/ci.yml',
  '.github/workflows/deploy.yml',
  '.github/workflows/configure-registration-email.yml',
]) requireFile(path);
forbidFile('.github/workflows/web-build.yml');

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
if (packageJson.scripts?.['test:browser'] !== 'playwright test') failures.push('缺少固定的 Playwright 浏览器测试脚本');

for (const text of ['界面音效', '画面性能']) forbidText('src/pages/SettingsPage.tsx', text);
for (const text of ['紧凑数字', '状态刷新频率']) requireText('src/pages/SettingsPage.tsx', text);
for (const text of ['function readStorageItem', 'window.localStorage.getItem', 'catch {', 'return null']) requireText('src/utils/localActivityStore.ts', text);
for (const text of ['MAX_BUCKETS = 10_000', 'sweepExpiredBuckets', 'rateLimitBucketCount']) requireText('server/src/rateLimit.js', text);
for (const text of ['getStableAdminSummary', 'cleanupEmailVerificationRecords', 'listGiftCodePage', 'listGiftRedemptionPage']) requireText('server/src/app.js', text);
for (const text of ['DEFAULT_ADMIN_PAGE_SIZE = 100', 'MAX_ADMIN_PAGE_SIZE = 200', 'nextCursor']) requireText('server/src/gift-code-batch.js', text);
for (const text of ['加载更多礼品码', '加载更多兑换记录', 'giftCodeTotal', 'redemptionTotal']) requireText('src/app/AdminApp.tsx', text);
for (const text of ['noticeTimerRef', 'window.clearTimeout']) requireText('src/app/gameViewModel.ts', text);
requireText('src/app/GameApp.tsx', 'setCompactNumbersEnabled(compactNumbers);');
requireText('src/main.tsx', '<AppErrorBoundary>');
for (const text of ['Storage.prototype', '界面音效', '画面性能', '__localActivityResult']) requireText('tests/browser/runtime.spec.ts', text);

for (const text of [
  'group: economy-ci-${{ github.event.pull_request.number || github.ref }}',
  'cancel-in-progress: true',
  'npm run build',
  'npx playwright install --with-deps chromium',
  'npm run test:browser 2>&1 | tee browser-test.log',
  'if: failure()',
  'retention-days: 3',
]) requireText('.github/workflows/ci.yml', text);
for (const text of [
  'node-version: 24.4.0',
  'cache: npm',
  'economy-install-dependencies.log',
  'npm run build',
  'Ensure rsync is available',
  'if ! command -v rsync >/dev/null 2>&1; then',
  'Collect failed step log',
  'collect_failed_log',
  'if [ "$outcome" != "failure" ]; then',
  'actions/upload-artifact@v7',
  'name: economy-deploy-failure-${{ github.run_id }}-${{ github.run_attempt }}',
  'path: ${{ runner.temp }}/economy-failure-log',
  'retention-days: 3',
  'compression-level: 9',
]) requireText('.github/workflows/deploy.yml', text);

for (const [path, text] of [
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', '读取、写入或删除 localStorage 失败'],
  ['docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '默认每页 100 条、最多 200 条'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '验证码终态记录保留 30 天'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'Node 24.4.0'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '不保留第二个重复的 PR Web Build 工作流'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '成功步骤日志不得上传'],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '不得再为单次构建失败创建临时诊断工作流'],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不得显示没有实际运行效果的“界面音效”或“画面性能”控件'],
  ['docs/README.md', '运行时可靠性、依赖锁、浏览器测试'],
  ['README.md', '管理员礼品码与兑换记录按游标分页'],
]) requireText(path, text);

if (failures.length) {
  console.error(`运行时可靠性验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('依赖锁、CI 去重、失败步骤日志 Artifact、浏览器存储容错、管理员分页、验证码保留、限流清理和浏览器测试均符合当前设计。');
