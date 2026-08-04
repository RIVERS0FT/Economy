import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const config = read('playwright.config.ts');
for (const required of [
  "name: 'chromium'",
  "name: 'mobile-chromium'",
  "name: 'mobile-webkit'",
  "devices['Pixel 7']",
  "devices['iPhone 13']",
  "mobile-critical-smoke.spec.ts",
]) assert.ok(config.includes(required), `Playwright 发布矩阵缺少：${required}`);
assert.ok(existsSync('tests/browser/mobile-critical-smoke.spec.ts'));
const smoke = read('tests/browser/mobile-critical-smoke.spec.ts');
for (const required of [
  'mobile critical path',
  '.mobile-bottom-navigation',
  '.facility-detail-sheet',
  '机械工厂生产方式',
  '前往市场交易该工厂',
  "overflow-y",
]) assert.ok(smoke.includes(required), `移动关键路径回归缺少：${required}`);
for (const workflow of ['.github/workflows/ci.yml', '.github/workflows/deploy.yml']) {
  assert.ok(read(workflow).includes('npx playwright install --with-deps chromium webkit'), `${workflow} 必须安装 Chromium 与 WebKit`);
}
const design = read('docs/UI_DESIGN_SYSTEM.md');
assert.ok(design.includes('## 12. 浏览器发布矩阵'));
assert.ok(design.includes('Mobile WebKit'));
console.log('浏览器发布矩阵验证通过：桌面 Chromium、移动 Chromium 和 Mobile WebKit 均为发布门槛。');
