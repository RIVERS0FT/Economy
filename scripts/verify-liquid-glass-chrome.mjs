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
const designPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';

[
  liquidPath,
  viewportPath,
  mobilePath,
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
  '未更新设计文档和架构检查的液态玻璃回退不应合并',
]) requireText(designPath, rule);

if (failures.length > 0) {
  console.error('液态玻璃状态栏架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('液态玻璃状态栏验证通过：桌面悬浮、移动复用、透明下沿和无模糊降级均满足设计基线。');
