import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
}

function requireOrder(path, entries) {
  const content = read(path);
  let previous = -1;
  for (const entry of entries) {
    const current = content.indexOf(entry);
    if (current < 0 || current <= previous) {
      failures.push(`${path} 加载顺序错误: ${entries.join(' -> ')}`);
      return;
    }
    previous = current;
  }
}

function walk(path) {
  const absolute = resolve(root, path);
  return readdirSync(absolute).flatMap((entry) => {
    const relative = `${path}/${entry}`;
    return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

const surfacePath = 'src/components/ui/LiquidGlassSurface.tsx';
const surfaceStylePath = 'src/styles/liquid-glass-surfaces.css';
const statusPath = 'src/components/shell/StatusBar.tsx';
const mobileNavigationComponentPath = 'src/components/shell/MobileBottomNavigation.tsx';
const viewportPath = 'src/styles/viewport.css';
const mobilePath = 'src/styles/mobile-status-navigation.css';
const mobileStatusPath = 'src/styles/mobile-status-layout.css';
const iconStylePath = 'src/styles/icon-system.css';
const gameIconPath = 'src/components/icons/GameIcons.tsx';
const gameAppPath = 'src/app/GameApp.tsx';
const formatterPath = 'src/utils/formatters.ts';
const designPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';

[
  surfacePath,
  surfaceStylePath,
  'src/styles/liquid-glass-chrome.css',
  statusPath,
  mobileNavigationComponentPath,
  viewportPath,
  mobilePath,
  mobileStatusPath,
  iconStylePath,
  gameIconPath,
  gameAppPath,
  formatterPath,
  designPath,
  'src/main.tsx',
  'package.json',
].forEach(requireFile);

const compatibilityStylePath = 'src/styles/liquid-glass-chrome.css';
const compatibilityStyles = read(compatibilityStylePath);
if (!compatibilityStyles.includes("@import './liquid-glass-surfaces.css';")) {
  failures.push('历史 liquid-glass-chrome.css 只能转发到新外壳几何样式');
}
for (const forbidden of ['backdrop-filter:', '-webkit-backdrop-filter:', '--liquid-glass-surface:', '.workspace::before']) {
  if (compatibilityStyles.includes(forbidden)) failures.push(`${compatibilityStylePath} 不得恢复旧玻璃实现: ${forbidden}`);
}

if (existsSync(resolve(root, 'src/components/icons/StatusIcons.tsx'))) {
  failures.push('旧 StatusIcons.tsx 不应与统一 GameIcons.tsx 并存');
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.['liquid-glass-react'] !== '1.1.1') {
  failures.push('liquid-glass-react 必须作为精确版本 1.1.1 的正式依赖');
}

const componentImports = walk('src')
  .filter((path) => /\.(ts|tsx)$/.test(path))
  .filter((path) => read(path).includes("from 'liquid-glass-react'"));
if (componentImports.length !== 1 || componentImports[0] !== surfacePath) {
  failures.push(`只有 ${surfacePath} 可以直接导入 liquid-glass-react，当前: ${componentImports.join(', ')}`);
}

for (const text of [
  "import LiquidGlass from 'liquid-glass-react'",
  "export type LiquidGlassSurfaceVariant = 'statusBar' | 'mobileNavigation'",
  'displacementScale: 28',
  'displacementScale: 20',
  'elasticity={0}',
  'mode="standard"',
  'globalMousePos={STATIC_MOUSE_POSITION}',
  'mouseOffset={STATIC_MOUSE_OFFSET}',
  'data-liquid-glass-variant={variant}',
]) requireText(surfacePath, text);

for (const text of [
  "import { LiquidGlassSurface } from '../ui/LiquidGlassSurface'",
  'className="asset-bar panel"',
  '<LiquidGlassSurface variant="statusBar">',
  'className="asset-bar-content"',
]) requireText(statusPath, text);

for (const text of [
  "import { LiquidGlassSurface } from '../ui/LiquidGlassSurface'",
  'className="sidebar mobile-bottom-navigation panel"',
  '<LiquidGlassSurface variant="mobileNavigation">',
]) requireText(mobileNavigationComponentPath, text);

requireOrder('src/main.tsx', [
  "import './styles/card-system.css'",
  "import './styles/liquid-glass-surfaces.css'",
  "import './styles/mobile-status-navigation.css'",
  "import './styles/icon-system.css'",
  "import './styles/industry-system.css'",
  "import './styles/design-system.css'",
]);
forbidText('src/main.tsx', "import './styles/liquid-glass-chrome.css'");

const surfaceStyles = read(surfaceStylePath);
for (const text of [
  '--desktop-asset-bar-height: 76px;',
  '--desktop-status-gap: var(--space-3);',
  '.asset-bar.panel,',
  '.mobile-bottom-navigation.panel',
  'background: transparent;',
  'padding: 0 !important;',
  '.liquid-glass-surface__effect > .glass',
  '.asset-bar-content',
  'grid-template-columns: repeat(5, minmax(135px, 1fr))',
  '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
  'border-radius: 999px !important;',
  '.mobile-bottom-navigation .liquid-glass-surface__content',
  'padding: .3rem 0;',
]) {
  if (!surfaceStyles.includes(text)) failures.push(`${surfaceStylePath} 缺少: ${text}`);
}
if (/^\s*(?:-webkit-)?backdrop-filter\s*:/m.test(surfaceStyles)) {
  failures.push('项目 CSS 不得重新实现液态玻璃 backdrop-filter 属性');
}
for (const legacyToken of [
  '--liquid-glass-surface:',
  '--liquid-glass-border:',
  '--liquid-glass-highlight:',
  '--liquid-glass-lowlight:',
  '--liquid-glass-shadow:',
  '--liquid-glass-blur:',
  '--liquid-glass-saturation:',
  '--liquid-glass-fade-height:',
  '.workspace::before',
]) {
  if (surfaceStyles.includes(legacyToken)) failures.push(`${surfaceStylePath} 不得恢复旧 CSS 玻璃规则: ${legacyToken}`);
}

for (const rule of [
  '.workspace {',
  'position: relative',
  'isolation: isolate',
  'display: block',
  '.asset-bar {',
  'position: absolute',
  'height: var(--desktop-asset-bar-height)',
  '.page-scroll {',
  'height: 100%',
  'padding-top: calc(var(--desktop-asset-bar-height) + var(--desktop-status-gap))',
  'scroll-padding-top: calc(var(--desktop-asset-bar-height) + var(--desktop-status-gap))',
  'var(--mobile-asset-bar-height)',
  'safe-area-inset-bottom',
]) requireText(viewportPath, rule);
forbidText(viewportPath, 'grid-template-rows: auto minmax(0, 1fr)');

forbidText(mobilePath, '--mobile-liquid-glass');
forbidText(mobilePath, 'backdrop-filter:');
forbidText(mobilePath, '-webkit-backdrop-filter:');
requireText(mobilePath, '--mobile-asset-bar-height: 48px;');
requireText(mobilePath, '--mobile-nav-height: 68px;');
requireText(mobilePath, 'transition: color 140ms ease;');

const mobile = read(mobilePath);
const mobileNavListBlock = mobile.match(/\.mobile-bottom-navigation \.sidebar-nav\s*\{[^{}]*\}/)?.[0] ?? '';
for (const rule of ['align-items: center', 'gap: .16rem', 'overflow-x: auto', 'overflow-y: hidden']) {
  if (!mobileNavListBlock.includes(rule)) failures.push(`移动底部导航列表缺少: ${rule}`);
}
const mobileNavButtonBlock = mobile.match(/\.mobile-bottom-navigation \.sidebar-nav-button\s*\{[^{}]*\}/)?.[0] ?? '';
for (const rule of ['flex: 0 0 48px', 'width: 48px', 'min-width: 48px', 'height: 48px', 'grid-template-rows: 1.35rem min-content', 'align-content: center', 'gap: .06rem', 'border-radius: .85rem']) {
  if (!mobileNavButtonBlock.includes(rule)) failures.push(`移动底部导航按钮缺少: ${rule}`);
}
const mobileHoverBlock = mobile.match(/\.mobile-bottom-navigation \.sidebar-nav-button:hover:not\(:disabled\)\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileHoverBlock.includes('transform: none')) failures.push('移动底部导航必须覆盖通用按钮 hover 位移');
const mobileActiveIconBlock = mobile.match(/\.mobile-bottom-navigation \.sidebar-nav-button\.active > span\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileActiveIconBlock.includes('transform: none') || /translateY\(|scale\(/.test(mobileActiveIconBlock)) {
  failures.push('移动底部导航活动图标必须保持固定几何位置');
}

const mobileStatus = read(mobileStatusPath);
const mobileStatusBarBlock = mobileStatus.match(/\.asset-bar\.panel\s*\{[^{}]*\}/)?.[0] ?? '';
for (const rule of ['right: var(--mobile-status-right-inset)', 'left: var(--mobile-status-left-inset)', 'width: auto', 'max-width: none', 'display: flex', 'justify-content: space-evenly', 'gap: 0', 'overflow-x: hidden', 'transform: none']) {
  if (!mobileStatusBarBlock.includes(rule)) failures.push(`移动顶部状态栏缺少: ${rule}`);
}
const mobileStatusItemBlock = mobileStatus.match(/\.asset-bar-item,\s*\.asset-bar-item:last-child\s*\{[^{}]*\}/)?.[0] ?? '';
for (const rule of ['flex: 0 0 auto', 'width: auto', 'min-width: 0', 'display: inline-flex', 'justify-content: center', 'border: 0', 'padding: 0']) {
  if (!mobileStatusItemBlock.includes(rule)) failures.push(`移动顶部状态项缺少: ${rule}`);
}
forbidText(mobileStatusPath, 'grid-template-columns: repeat(4, minmax(0, 1fr))');
forbidText(mobileStatusPath, 'border-right:');
requireText(mobileStatusPath, 'font-variant-numeric: tabular-nums;');
requireText(mobileStatusPath, '.asset-bar-item-icon > svg');

for (const rule of [
  'viewBox="0 0 24 24"',
  'stroke="currentColor"',
  'strokeWidth={1.9}',
  'export function CreditsIcon',
  'export function AssetsIcon',
  'export function RankIcon',
  'export function WarehouseIcon',
]) requireText(gameIconPath, rule);
requireText(iconStylePath, '.asset-bar-item-icon > .game-icon');
requireText(iconStylePath, '.mobile-bottom-navigation .sidebar-nav-button > span > .game-icon');
requireText(gameAppPath, 'formatRank');
requireText(formatterPath, 'export function formatRank');
requireText(formatterPath, "? `#${value}` : '#--'");

for (const text of [
  '`liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现',
  '`src/components/ui/LiquidGlassSurface.tsx` 是唯一允许直接导入该依赖的文件',
  '`mode="standard"`',
  '`elasticity={0}`',
  'Safari、iOS WebKit 和 Firefox',
  '`src/styles/liquid-glass-chrome.css` 只允许作为历史路径转发入口',
]) requireText(designPath, text);

if (failures.length > 0) {
  console.error('liquid-glass-react 外壳架构验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('liquid-glass-react 唯一材质、全平台降级、外壳布局与防回退验证通过。');
