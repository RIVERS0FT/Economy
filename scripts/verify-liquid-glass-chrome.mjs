import { existsSync, readFileSync } from 'node:fs';
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
      failures.push(`${path} 样式加载顺序错误: ${entries.join(' -> ')}`);
      return;
    }
    previous = current;
  }
}

const liquidPath = 'src/styles/liquid-glass-chrome.css';
const viewportPath = 'src/styles/viewport.css';
const mobilePath = 'src/styles/mobile-status-navigation.css';
const mobileStatusPath = 'src/styles/mobile-status-layout.css';
const gameAppPath = 'src/app/GameApp.tsx';
const formatterPath = 'src/utils/formatters.ts';
const designPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';

[
  liquidPath,
  viewportPath,
  mobilePath,
  mobileStatusPath,
  gameAppPath,
  formatterPath,
  designPath,
  'src/main.tsx',
].forEach(requireFile);

requireOrder('src/main.tsx', [
  "import './styles/card-system.css'",
  "import './styles/liquid-glass-chrome.css'",
  "import './styles/mobile-status-navigation.css'",
  "import './styles/industry-system.css'",
  "import './styles/design-system.css'",
]);

for (const token of [
  '--liquid-glass-surface:',
  '--liquid-glass-surface-fallback:',
  '--liquid-glass-border:',
  '--liquid-glass-highlight:',
  '--liquid-glass-lowlight:',
  '--liquid-glass-shadow:',
  '--liquid-glass-blur:',
  '--liquid-glass-saturation:',
  '--liquid-glass-fade-height:',
  '--desktop-asset-bar-height:',
  '--desktop-status-gap:',
]) requireText(liquidPath, token);

for (const rule of [
  '.asset-bar.panel,',
  '.mobile-bottom-navigation.panel',
  'background: var(--liquid-glass-surface-fallback)',
  '@supports ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
  'background: var(--liquid-glass-surface)',
  'blur(var(--liquid-glass-blur))',
  'saturate(var(--liquid-glass-saturation))',
  '.asset-bar-item.primary',
  'background: transparent',
  '.workspace::before',
  'height: var(--liquid-glass-fade-height)',
  'pointer-events: none',
  'linear-gradient(to bottom, rgba(5, 15, 10, 0.18), transparent)',
]) requireText(liquidPath, rule);

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
requireText(mobilePath, 'transition: color 140ms ease;');

const mobile = read(mobilePath);
const mobileHoverBlock = mobile.match(/\.mobile-bottom-navigation \.sidebar-nav-button:hover:not\(:disabled\)\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileHoverBlock.includes('transform: none')) {
  failures.push('移动底部导航必须覆盖通用按钮 hover 上浮效果');
}

const mobileActiveIconBlock = mobile.match(/\.mobile-bottom-navigation \.sidebar-nav-button\.active > span\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileActiveIconBlock) {
  failures.push('移动底部导航缺少活动图标样式');
} else {
  if (!mobileActiveIconBlock.includes('transform: none')) {
    failures.push('移动底部导航活动图标必须固定几何位置');
  }
  if (/translateY\(|scale\(/.test(mobileActiveIconBlock)) {
    failures.push('移动底部导航活动图标不得上移或缩放');
  }
}

const mobileStatus = read(mobileStatusPath);
const mobileStatusBarBlock = mobileStatus.match(/\.asset-bar\.panel\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileStatusBarBlock) {
  failures.push('移动顶部状态栏缺少专用布局');
} else {
  for (const rule of [
    'grid-template-columns: repeat(4, minmax(0, 1fr))',
    'overflow-x: hidden',
    'overflow-y: hidden',
    'touch-action: pan-y',
  ]) {
    if (!mobileStatusBarBlock.includes(rule)) failures.push(`移动顶部状态栏缺少: ${rule}`);
  }
  if (mobileStatusBarBlock.includes('overflow-x: auto')) {
    failures.push('移动顶部状态栏不得横向滚动');
  }
  if (mobileStatusBarBlock.includes('grid-auto-columns')) {
    failures.push('移动顶部状态栏不得按内容宽度自动扩列');
  }
}
forbidText(mobileStatusPath, 'grid-auto-columns: minmax(max-content, 1fr)');
requireText(mobileStatusPath, 'min-width: 0;');
requireText(mobileStatusPath, 'font-variant-numeric: tabular-nums;');

for (const rule of [
  'formatCompactNumber, formatCurrency',
  'compactValue: formatCompactNumber(game.credits)',
  'compactValue: formatCompactNumber(derived.totalAssets)',
  'compactValue: <>#{currentRank}</>',
  'compactValue: formatCompactNumber(game.warehouseAvailableCapacity)',
]) requireText(gameAppPath, rule);

for (const rule of [
  'export function formatCompactNumber',
  "suffix: 'K'",
  "suffix: 'M'",
  "suffix: 'B'",
  "suffix: 'T'",
]) requireText(formatterPath, rule);

const liquid = read(liquidPath);
const assetItemBlocks = liquid.match(/\.asset-bar-item[^{}]*\{[^{}]*\}/g) ?? [];
for (const block of assetItemBlocks) {
  if (block.includes('backdrop-filter')) {
    failures.push('状态栏单项不得单独使用 backdrop-filter');
    break;
  }
}

for (const rule of [
  '# Economy 液态玻璃状态栏设计',
  '桌面与移动端必须使用同一材质',
  '不得恢复“状态栏一行、页面一行”的两行网格布局',
  '整个状态栏只应用一次玻璃模糊',
  '`pointer-events: none`',
  '移动顶部状态栏固定显示可用资金、总资产、排行榜和仓库剩余四项',
  '顶部状态栏必须设置 `overflow-x: hidden`',
  '排名在移动端使用 `#1`、`#2` 格式',
  '恢复移动顶部状态栏横向滚动、按内容宽度扩列或“第 N 名”移动格式',
  '移动底部导航活动状态不得改变按钮或图标的几何位置',
  '恢复移动底部导航活动态或 hover 态的位移、缩放与尺寸变化',
  '未更新设计文档和架构检查的液态玻璃回退不应合并',
]) requireText(designPath, rule);

if (failures.length > 0) {
  console.error('液态玻璃状态栏架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('液态玻璃状态栏验证通过：桌面悬浮、移动顶部四等分无滚动、紧凑排名、稳定底栏活动态和无模糊降级均满足设计基线。');
