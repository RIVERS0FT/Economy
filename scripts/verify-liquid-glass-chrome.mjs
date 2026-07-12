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
const statusIconPath = 'src/components/icons/StatusIcons.tsx';
const gameAppPath = 'src/app/GameApp.tsx';
const formatterPath = 'src/utils/formatters.ts';
const designPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';

[
  liquidPath,
  viewportPath,
  mobilePath,
  mobileStatusPath,
  statusIconPath,
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
requireText(mobilePath, '--mobile-asset-bar-height: 48px;');
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
    'right: var(--mobile-status-right-inset)',
    'left: var(--mobile-status-left-inset)',
    'width: auto',
    'max-width: none',
    'display: flex',
    'justify-content: space-evenly',
    'gap: 0',
    'overflow-x: hidden',
    'overflow-y: hidden',
    'transform: none',
    'touch-action: pan-y',
  ]) {
    if (!mobileStatusBarBlock.includes(rule)) failures.push(`移动顶部状态栏缺少: ${rule}`);
  }
  if (mobileStatusBarBlock.includes('overflow-x: auto')) {
    failures.push('移动顶部状态栏不得横向滚动');
  }
  for (const legacyDistribution of [
    'justify-content: flex-start',
    'justify-content: center',
    'justify-content: space-between',
    'justify-content: space-around',
  ]) {
    if (mobileStatusBarBlock.includes(legacyDistribution)) {
      failures.push(`移动顶部状态栏不得使用非等距分布: ${legacyDistribution}`);
    }
  }
  if (mobileStatusBarBlock.includes('grid-template-columns') || mobileStatusBarBlock.includes('grid-auto-columns')) {
    failures.push('移动顶部状态栏不得恢复网格扩列');
  }
  for (const legacyRule of [
    'right: auto',
    'left: 50%',
    'width: max-content',
    'transform: translateX(-50%)',
  ]) {
    if (mobileStatusBarBlock.includes(legacyRule)) failures.push(`移动顶部状态栏不得恢复内容宽度布局: ${legacyRule}`);
  }
}

const mobileStatusItemBlock = mobileStatus.match(/\.asset-bar-item,\s*\.asset-bar-item:last-child\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileStatusItemBlock) {
  failures.push('移动顶部状态项缺少专用布局');
} else {
  for (const rule of [
    'flex: 0 0 auto',
    'width: auto',
    'min-width: 0',
    'display: inline-flex',
    'justify-content: center',
    'border: 0',
    'padding: 0',
    'overflow: visible',
  ]) {
    if (!mobileStatusItemBlock.includes(rule)) failures.push(`移动顶部状态项缺少: ${rule}`);
  }
  if (mobileStatusItemBlock.includes('flex: 1 1 0')) {
    failures.push('移动顶部状态项不得恢复等宽拉伸');
  }
  if (mobileStatusItemBlock.includes('width: 0')) {
    failures.push('移动顶部状态项不得恢复零基础宽度槽位');
  }
}

const mobileStatusIconBlock = mobileStatus.match(/\.asset-bar-item-icon\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileStatusIconBlock.includes('width: clamp(1.15rem, 5vw, 1.3rem)') || !mobileStatusIconBlock.includes('height: clamp(1.15rem, 5vw, 1.3rem)')) {
  failures.push('移动顶部状态图标必须保持至少 18px 的统一尺寸');
}

forbidText(mobileStatusPath, 'grid-template-columns: repeat(4, minmax(0, 1fr))');
forbidText(mobileStatusPath, 'grid-auto-columns:');
forbidText(mobileStatusPath, 'border-right:');
requireText(mobileStatusPath, 'font-variant-numeric: tabular-nums;');
requireText(mobileStatusPath, '.asset-bar-item-icon > svg');

for (const rule of [
  "viewBox: '0 0 24 24'",
  "stroke: 'currentColor'",
  'strokeWidth: 1.9',
  'export function CreditsIcon',
  'export function AssetsIcon',
  'export function RankIcon',
  'export function WarehouseIcon',
]) requireText(statusIconPath, rule);

for (const rule of [
  "import { AssetsIcon, CreditsIcon, RankIcon, WarehouseIcon } from '../components/icons/StatusIcons'",
  'icon: <CreditsIcon />',
  'icon: <AssetsIcon />',
  'icon: <RankIcon />',
  'icon: <WarehouseIcon />',
  'formatCompactNumber, formatCurrency',
  'compactValue: formatCompactNumber(game.credits)',
  'compactValue: formatCompactNumber(derived.totalAssets)',
  'compactValue: <>#{currentRank}</>',
  'compactValue: formatCompactNumber(game.warehouseAvailableCapacity)',
]) requireText(gameAppPath, rule);
for (const legacyIcon of ["icon: '¤'", "icon: '◆'", "icon: '♛'", "icon: '▣'"]) forbidText(gameAppPath, legacyIcon);

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
  '移动顶部状态栏全宽等距布局',
  '容器使用 Flex、`justify-content: space-evenly` 和 `gap: 0`',
  '每个状态项使用 `flex: 0 0 auto` 和 `width: auto`',
  '四项之间的可见间隔一致',
  '首尾项目到状态栏内边缘的间隔与项目间隔一致',
  '状态项之间不增加分隔线',
  '四项必须使用 `StatusIcons.tsx` 提供的本地内联 SVG',
  '排名在移动端使用 `#1`、`#2` 格式',
  '恢复移动顶部状态栏横向滚动、`space-between`、`space-around`、整体居中、非零容器间距或“第 N 名”移动格式',
  '恢复移动状态项 `flex: 1 1 0`、`width: 0`、固定四等分槽位或其他拉伸分布',
  '恢复移动状态栏 `width: max-content`、`left: 50%`、`translateX(-50%)` 或其他内容宽度胶囊布局',
  '删除移动状态栏全宽安全区定位、`space-evenly` 等距分布、紧凑数值格式或内容宽度状态项规则',
  '恢复移动顶部状态栏字符图标、分隔线、独立图标底板或小于 `18px` 的图标',
  '移动底部导航活动状态不得改变按钮或图标的几何位置',
  '恢复移动底部导航活动态或 hover 态的位移、缩放与尺寸变化',
  '未更新设计文档和架构检查的液态玻璃回退不应合并',
]) requireText(designPath, rule);

if (failures.length > 0) {
  console.error('液态玻璃状态栏架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('液态玻璃状态栏验证通过：桌面悬浮、移动全宽四项 space-evenly 等距分布、统一 SVG 图标、无分隔线、稳定底栏活动态和无模糊降级均满足设计基线。');
