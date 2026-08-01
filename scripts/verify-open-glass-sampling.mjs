import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const files = {
  viewport: 'src/styles/viewport.css',
  backdrop: 'src/styles/financial-backdrop.css',
  liquidDesign: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  authDesign: 'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  fixture: 'open-glass-sampling-test.html',
  harness: 'tests/browser/open-glass-sampling-harness.tsx',
  browser: 'tests/browser/open-glass-sampling.spec.ts',
  package: 'package.json',
};

Object.values(files).forEach(requireFile);

if (failures.length === 0) {
  const openChainSelectors = `.signed-in-shell,
.signed-in-shell__body,
.signed-in-shell__chrome,
.workspace,
.mobile-page-overlay,
.mobile-chrome-overlay,
.workspace-floating-layer,
.page-scroll-area,
.page-scroll {
  isolation: auto;
  filter: none;
  transform: none;
}`;
  requireText(files.viewport, openChainSelectors);
  requireText(files.viewport, `.workspace {
  position: relative;
  isolation: auto;`);
  forbidText(files.viewport, 'isolation: isolate;');

  for (const text of [
    '#root {',
    'isolation: isolate;',
    'filter: none;',
    'transform: none;',
    '.application-content-root {',
    'z-index: 2;',
    '.game-shell,\n.admin-shell {',
    '.game-state-shell,\n.photographic-state-shell {',
  ]) requireText(files.backdrop, text);
  requireText(files.backdrop, `.application-content-root {
  position: relative;
  z-index: 2;
  isolation: auto;
  filter: none;
  transform: none;`);
  requireText(files.backdrop, `.game-shell,
.admin-shell {
  isolation: auto;
  filter: none;
  transform: none;`);
  requireText(files.backdrop, `.game-state-shell,
.photographic-state-shell {
  isolation: isolate;`);
  forbidText(files.backdrop, `.game-shell,
.game-state-shell,
.admin-shell,
.photographic-state-shell {
  isolation: isolate;`);
  forbidText(files.backdrop, `.game-shell,
.admin-shell {
  isolation: isolate;`);

  for (const text of [
    '`#root` 是全应用唯一允许同时包围摄影层、氛围层与液态玻璃的 `isolation:isolate` 根',
    '桌面和移动端都必须保持 `isolation:auto`、`filter:none` 与 `transform:none`',
    '不得在登录后外壳祖先上建立第二个隔离根',
    '桌面玩家、桌面管理员、移动玩家和移动管理员四种场景保持开放的背景采样链',
    '不得通过状态栏专属填充、描边或氛围副本掩盖根级采样失败',
    '`verify-open-glass-sampling.mjs`',
    '`open-glass-sampling.spec.ts`',
  ]) requireText(files.liquidDesign, text);
  for (const text of [
    '`#root` 是认证、玩家和管理员共同的唯一全应用隔离根',
    '在桌面和移动端都必须保持 `isolation:auto`、`filter:none` 与 `transform:none`',
    '只有不包围 Chrome 的页面局部业务子树可以建立隔离',
    '`scripts/verify-open-glass-sampling.mjs`',
    '`tests/browser/open-glass-sampling.spec.ts`',
  ]) requireText(files.authDesign, text);

  for (const text of [
    'id="root"',
    '/tests/browser/open-glass-sampling-harness.tsx',
  ]) requireText(files.fixture, text);
  for (const text of [
    "import { FinancialBackdrop } from '../../src/components/visual/FinancialBackdrop'",
    "import { LiquidGlassSurface } from '../../src/components/ui/LiquidGlassSurface'",
    "import { ScrollArea } from '../../src/components/ui/ScrollArea'",
    "surface === 'admin'",
    "mode === 'mobile'",
    '<FinancialBackdrop />',
    'className="application-content-root"',
    "'admin-shell' : 'game-shell'",
    "' admin-workspace'",
    'className="mobile-page-overlay"',
    'mobile-chrome-overlay',
    'variant={isMobile ? \'mobileStatusBar\' : \'desktopStatusBar\'}',
    'variant="mobileNavigation"',
  ]) requireText(files.harness, text);

  for (const text of [
    'desktop player chrome uses the unique root sampling chain',
    'desktop administrator chrome uses the unique root sampling chain',
    'mobile player chrome uses the unique root sampling chain',
    'mobile administrator chrome uses the unique root sampling chain',
    "expect(chain.samplingRootIsolation).toBe('isolate')",
    "expect(chain.openIsolations.every((value) => value === 'auto')).toBe(true)",
    "expect(chain.openFilters.every((value) => value === 'none')).toBe(true)",
    "expect(chain.openTransforms.every((value) => value === 'none')).toBe(true)",
    "value.includes('blur(4px)')",
    '/saturate\\((?:140%|1\\.4)\\)/',
    "expect(chain.surfaceVariants).toEqual(['desktopStatusBar'])",
    "expect(chain.surfaceVariants).toEqual(['mobileStatusBar', 'mobileNavigation'])",
    "expect(chain.surfaceVariants).toEqual(['mobileNavigation'])",
  ]) requireText(files.browser, text);

  const packageJson = JSON.parse(read(files.package));
  if (packageJson.scripts?.['verify:open-glass-sampling'] !== 'node scripts/verify-open-glass-sampling.mjs') {
    failures.push('package.json 必须提供 verify:open-glass-sampling');
  }
  if (!packageJson.scripts?.['verify:architecture']?.includes('node scripts/verify-open-glass-sampling.mjs')) {
    failures.push('verify:architecture 必须运行开放玻璃采样链验证');
  }
}

if (failures.length > 0) {
  console.error('登录后液态玻璃开放采样链验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('登录后液态玻璃开放采样链验证通过：唯一根隔离、桌面与移动玩家／管理员祖先开放和四场景浏览器回归均已锁定。');
