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
.application-map-layer,
.application-ui-layer,
.signed-in-shell__body,
.signed-in-shell__chrome,
.workspace,
.workspace-strategic-chrome,
.mobile-page-overlay,
.mobile-chrome-overlay,
.workspace-floating-layer,
.workspace-dialog-layer,
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
    'z-index: auto;',
    '--application-layer-image: 0;',
    '--application-layer-atmosphere: 10;',
    '--application-layer-map: 20;',
    '--application-layer-ui: 30;',
    '.application-map-layer {',
    '.application-ui-layer {',
    '.game-shell,\n.admin-shell {',
    '.game-state-shell,\n.photographic-state-shell {',
  ]) requireText(files.backdrop, text);
  requireText(files.backdrop, `.application-content-root {
  position: relative;
  z-index: auto;
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
    '根级 `#root` 使用唯一 `isolation:isolate`',
    '地图层、UI 层、内容根、登录后外壳、工作区、页面滚动区和 Chrome Overlay 必须保持 `isolation:auto`、`filter:none`、`transform:none`',
    '毛玻璃宿主自身不得创建新的隔离根',
    '四种玩家／管理员、桌面／移动场景的根级采样链',
    '`src/components/ui/FrostedGlassSurface.tsx`',
    '`tests/browser/open-glass-sampling.spec.ts`',
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
    'ApplicationLayerRoot,',
    'ApplicationMapLayerPortal,',
    "import { FrostedGlassSurface } from '../../src/components/ui/FrostedGlassSurface'",
    "import { ScrollArea } from '../../src/components/ui/ScrollArea'",
    "surface === 'admin'",
    "mode === 'mobile'",
    '<ApplicationLayerRoot><SamplingApp /></ApplicationLayerRoot>',
    '<ApplicationMapLayerPortal>',
    'data-sampling-map-layer="true"',
    "'admin-shell' : 'game-shell'",
    "' admin-workspace'",
    'className="mobile-page-overlay"',
    'className="workspace-strategic-chrome"',
    'mobile-chrome-overlay',
    'variant="statusBar"',
    'variant="mobileNavigation"',
  ]) requireText(files.harness, text);

  for (const text of [
    'signed-in frosted-glass backdrop sampling',
    '`${mode} ${surface} chrome uses the unique root sampling chain`',
    "page.locator('.frosted-glass-surface')",
    "page.locator('.liquid-glass-surface, .glass__warp')",
    "expect(chain.samplingRootIsolation).toBe('isolate')",
    "expect(chain.openIsolations.every((value) => value === 'auto')).toBe(true)",
    "expect(chain.openFilters.every((value) => value === 'none')).toBe(true)",
    "expect(chain.openTransforms.every((value) => value === 'none')).toBe(true)",
    'const openNodes = [mapLayer, uiLayer, contentRoot, shell, workspace',
    "expect(chain.imageLayerZIndex).toBe('0')",
    "expect(chain.atmosphereLayerZIndex).toBe('10')",
    "expect(chain.mapLayerZIndex).toBe('20')",
    "expect(chain.uiLayerZIndex).toBe('30')",
    "value.includes('blur(18px)')",
    "expect(chain.surfaceVariants).toEqual(['statusBar'])",
    "expect(chain.surfaceVariants).toEqual(['statusBar', 'mobileNavigation'])",
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
  console.error('登录后毛玻璃开放采样链验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('登录后毛玻璃开放采样链验证通过：唯一四层根隔离、桌面与移动玩家／管理员祖先和四场景浏览器回归均已锁定。');
