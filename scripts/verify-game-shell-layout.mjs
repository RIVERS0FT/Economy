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

const paths = {
  main: 'src/main.tsx',
  layout: 'src/styles/game-shell-layout.css',
  shell: 'src/components/shell/GameShell.tsx',
  design: 'docs/GAME_SHELL_LAYOUT_DESIGN.md',
  browser: 'tests/browser/game-shell-layout.spec.ts',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireText(paths.main, "import './styles/viewport.css';");
  requireText(paths.main, "import './styles/game-shell-layout.css';");

  const main = read(paths.main);
  if (main.indexOf("import './styles/viewport.css';") >= main.indexOf("import './styles/game-shell-layout.css';")) {
    failures.push('game-shell-layout.css 必须在 viewport.css 之后加载');
  }

  const layout = read(paths.layout);
  const requiredLayoutPatterns = [
    /\.game-shell\.sidebar-layout\s*\{[\s\S]*?grid-template-columns:/,
    /\.game-shell\.sidebar-layout\s*\{[\s\S]*?gap:\s*0;/,
    /\.game-shell\.sidebar-layout\s*\{[\s\S]*?padding:\s*0;/,
    /\.desktop-sidebar\s*\{[\s\S]*?margin:/,
    /\.workspace\s*\{[\s\S]*?margin:\s*0;/,
    /\.workspace\s*\{[\s\S]*?padding:\s*0;/,
    /\.asset-bar\s*\{[\s\S]*?width:\s*100%;/,
    /\.page-scroll\s*\{[\s\S]*?padding-right:\s*0;/,
    /\.page-scroll\s*\{[\s\S]*?padding-left:\s*0;/,
    /\.page-content\s*\{[\s\S]*?width:\s*100%;/,
    /\.page-content\s*\{[\s\S]*?max-width:\s*none;/,
    /\.page-content\s*\{[\s\S]*?margin:\s*0;/,
    /\.page-content\s*\{[\s\S]*?padding:\s*0 0 var\(--space-4\);/,
    /border-radius:\s*0 0 18px 18px !important;/,
  ];
  for (const pattern of requiredLayoutPatterns) {
    if (!pattern.test(layout)) failures.push(`game-shell-layout.css 缺少规则: ${pattern}`);
  }

  forbidText(paths.layout, 'margin-inline: auto');
  forbidText(paths.layout, '--content-max-width');
  forbidText(paths.layout, 'ResizeObserver');

  requireText(paths.shell, "sidebarCollapsed ? 'game-shell sidebar-layout sidebar-collapsed' : 'game-shell sidebar-layout'");

  for (const text of [
    '覆盖整个视口的水平双列结构',
    '`src/styles/game-shell-layout.css` 是登录后游戏外壳最终几何权威',
    '只有 `.desktop-sidebar` 拥有桌面外边距',
    '`.page-content` 在游戏表面中必须',
    '给桌面 `.game-shell` 恢复 padding 或 grid gap',
    '绕过浏览器几何测试合并布局回退',
  ]) {
    requireText(paths.design, text);
  }

  for (const text of [
    'game shell keeps only the sidebar inset while the workspace stays flush',
    'sidebar collapse keeps the status bar and page on the same workspace track',
    "page.locator('.game-shell')",
    "page.locator('.workspace')",
    "page.locator('.asset-bar')",
    "page.locator('.page-scroll')",
    "page.locator('.page-content')",
  ]) {
    requireText(paths.browser, text);
  }
}

if (failures.length > 0) {
  console.error('游戏外壳布局架构验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('游戏外壳布局架构验证通过。');
