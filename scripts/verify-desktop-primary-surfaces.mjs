import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const failures = [];
const read = (path) => readFileSync(resolve(process.cwd(), path), 'utf8');
const requireText = (path, texts) => {
  if (!existsSync(resolve(process.cwd(), path))) {
    failures.push(`缺少文件: ${path}`);
    return;
  }
  const source = read(path);
  for (const text of texts) if (!source.includes(text)) failures.push(`${path} 缺少: ${text}`);
};

requireText('src/styles/design-system.css', [
  '--radius-card: 1.5rem;',
  'border-radius: var(--radius-card);',
  'background: var(--frosted-glass-background, var(--gradient-panel));',
  'backdrop-filter: var(--frosted-glass-filter, blur(18px));',
]);
requireText('src/components/ui/FrostedGlassSurface.tsx', [
  'export function FrostedGlassSurface',
  "'statusBar' | 'mobileNavigation' | 'authCard' | 'workspaceCard'",
]);
requireText('src/components/shell/SignedInShell.tsx', [
  'integratedPrimaryCard = false',
  '<FrostedGlassSurface variant="workspaceCard" className="signed-in-shell__primary-card">',
]);
requireText('src/components/shell/StatusBar.tsx', ['<FrostedGlassSurface variant="statusBar">']);
requireText('src/components/shell/AdminDesktopBar.tsx', ['<FrostedGlassSurface variant="statusBar">']);
requireText('src/styles/frosted-glass-surfaces.css', [
  '--frosted-glass-filter: blur(18px) saturate(128%);',
  '.frosted-glass-surface--statusBar,',
  '.frosted-glass-surface--authCard {',
  '.frosted-glass-surface--workspaceCard {',
  'border-radius: 24px;',
]);
requireText('tests/browser/frosted-glass-layout.spec.ts', [
  'desktop chrome and page panels use CSS frosted glass without Liquid Glass DOM',
  'player desktop uses one workspaceCard host for the sidebar and active page',
  "toHaveCSS('border-radius', '24px')",
  "toContain('blur(18px)')",
]);
requireText('tests/browser/admin-runtime.spec.ts', [
  '.admin-command-bar .frosted-glass-surface--statusBar',
]);
requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '`src/styles/frosted-glass-surfaces.css`',
  '`blur(18px) saturate(128%)`',
  '桌面状态栏和认证卡片圆角为 `24px`',
]);

if (failures.length) {
  console.error('桌面一级表面与毛玻璃材质验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('桌面一级卡片、玩家状态栏与管理员工作栏的共享毛玻璃材质验证通过。');
