import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const mobilePath = 'src/styles/mobile-status-navigation.css';
const iconPath = 'src/styles/icon-system.css';
const strategicPath = 'src/styles/strategic-game-shell.css';
const mapRenderingPath = 'src/styles/strategic-map-rendering.css';
const workspacePath = 'src/components/shell/StrategicWorkspace.tsx';
const glassPath = 'src/styles/frosted-glass-surfaces.css';
const designPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';
const mapDesignPath = 'docs/STRATEGIC_MAP_RENDERING_DESIGN.md';
const ciDesignPath = 'docs/CI_EXECUTION_DESIGN.md';
const browserPath = 'tests/browser/navigation-pill-geometry.spec.ts';

for (const text of [
  ".mobile-bottom-navigation[data-navigation-surface='game-mobile-navigation'] .mobile-bottom-navigation__viewport {",
  'gap: .125rem;',
  ".mobile-bottom-navigation[data-navigation-surface='game-mobile-navigation'] .sidebar-nav-button {",
  'flex: 0 0 56px;',
  'width: 56px;',
  'min-width: 56px;',
  'height: 50px;',
  'grid-template-rows: 1.45rem min-content;',
  'border-radius: 999px;',
  'background: rgba(50, 159, 88, .18);',
  'border-color: rgba(123, 228, 158, .34);',
]) requireText(mobilePath, text);

for (const text of [
  ".mobile-bottom-navigation[data-navigation-surface='game-mobile-navigation'] .sidebar-nav-button > span {",
  'width: 1.45rem;',
  'height: 1.45rem;',
  ".mobile-bottom-navigation[data-navigation-surface='game-mobile-navigation'] .sidebar-nav-button > span > .game-icon {",
  'width: 1.35rem;',
  'height: 1.35rem;',
]) requireText(iconPath, text);

for (const text of [
  'const MAP_LENS_BUTTON_STYLE = {',
  'minHeight: 44,',
  'borderRadius: 999,',
  "flexDirection: 'row',",
  "whiteSpace: 'nowrap',",
  'style={MAP_LENS_BUTTON_STYLE}',
]) requireText(workspacePath, text);

for (const text of [
  '.strategic-map-lens-button {',
  'display: inline-flex;',
  'align-items: center;',
  'justify-content: center;',
  'gap: .4rem;',
  'color: var(--color-text-muted);',
  'background: transparent;',
  '.strategic-map-lens-button.is-active {',
  'color: var(--color-text-primary);',
  'border-color: color-mix(in srgb, var(--color-success) 72%, transparent);',
  'background: var(--color-success-soft);',
]) requireText(strategicPath, text);

for (const text of [
  '.application-map-layer > .strategic-map-lens-bar,',
  'background: var(--color-surface-panel);',
  '-webkit-backdrop-filter: none;',
  'backdrop-filter: none;',
]) requireText(mapRenderingPath, text);

for (const text of [
  'solid non-glass map surface',
  'barBackground: barStyle.backgroundColor,',
  "expect(geometry.barBackground).not.toBe('rgba(0, 0, 0, 0)');",
  "expect(geometry.barFilter).toBe('none');",
  'await expect(buttons.nth(2)).toHaveClass(/is-active/);',
  'await expect.poll(async () => {',
  'colorChanged: activeVisual.color !== geometry.color,',
  'borderChanged: activeVisual.border !== geometry.border,',
  'backgroundChanged: activeVisual.background !== geometry.background,',
  "message: '地图镜头激活态必须提交颜色、边框与背景三项视觉变化'",
  'colorChanged: true,',
  'borderChanged: true,',
  'backgroundChanged: true,',
]) requireText(browserPath, text);
for (const text of [
  "expect(geometry.barFilter).toContain('blur(18px)');",
  'expect(activeVisual.color).not.toBe(geometry.color);',
  'expect(activeVisual.border).not.toBe(geometry.border);',
  'expect(activeVisual.background).not.toBe(geometry.background);',
]) forbidText(browserPath, text);

for (const text of [
  '--frosted-glass-background: rgba(5, 20, 14, 0.76);',
  '--frosted-glass-border: rgba(212, 245, 224, 0.18);',
  '--frosted-glass-filter: blur(18px) saturate(128%);',
  '.frosted-glass-surface--mobileNavigation {',
  'border-radius: 40px;',
]) requireText(glassPath, text);

for (const text of [
  '玩家移动底栏的游戏导航项固定使用 `56px × 50px` 胶囊几何',
  '桌面地图镜头切换按钮固定使用单行横向“图标 + 文字”胶囊',
  '`scripts/verify-navigation-pill-geometry.mjs`',
  '`tests/browser/navigation-pill-geometry.spec.ts`',
]) requireText(designPath, text);
for (const text of [
  '战略地图镜头栏和运输地图选路面板属于地图专属操作表面',
  '`backdrop-filter` 与 `-webkit-backdrop-filter` 必须为 `none`',
]) requireText(mapDesignPath, text);

for (const text of [
  '必须先等待权威 DOM 状态',
  '再使用 `expect.poll` 条件轮询读取 computed style',
  '不得用固定 sleep 猜测渲染提交时机',
]) requireText(ciDesignPath, text);

if (failures.length > 0) {
  console.error(`导航胶囊几何验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('玩家移动导航与桌面地图镜头胶囊几何、地图镜头实体无玻璃表面及异步激活视觉验证通过。');