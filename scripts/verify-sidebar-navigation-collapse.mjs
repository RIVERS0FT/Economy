import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireText = (path, values) => {
  const content = read(path);
  for (const value of values) {
    if (!content.includes(value)) failures.push(`${path} 缺少: ${value}`);
  }
};

requireText('src/components/shell/GameShell.tsx', [
  'useLayoutEffect(() => {\n    setSidebarCollapsed(true);\n  }, [model.tab]);',
]);
requireText('src/components/shell/DesktopSidebar.tsx', [
  'interactionResetKey={activeTab}',
]);
requireText('src/components/shell/SidebarFrame.tsx', [
  'interactionResetKey?: string | number;',
  'hoverIntentRef.current = false;',
  "window.addEventListener('pointermove', markHoverIntent, { once: true });",
  '}, [interactionResetKey]);',
]);
requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '正式页面 ID 发生变化时，桌面玩家侧栏的展开状态必须立即恢复为 `78px` 收起态',
  '`tests/browser/sidebar-navigation-collapse.spec.ts`',
]);
requireText('tests/browser/sidebar-navigation-collapse.spec.ts', [
  "test.describe('desktop sidebar navigation collapse'",
  "toHaveAttribute('data-collapsed', 'true')",
  "toHaveAttribute('data-collapsed', 'false')",
  "__lastSelectedTab)).toBe('settings')",
]);

if (failures.length > 0) {
  console.error('侧栏页面切换收起规则验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('侧栏页面切换收起规则验证通过。');
