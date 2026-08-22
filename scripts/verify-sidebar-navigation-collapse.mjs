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
const forbidText = (path, values) => {
  const content = read(path);
  for (const value of values) {
    if (content.includes(value)) failures.push(`${path} 不应包含: ${value}`);
  }
};

forbidText('src/components/shell/GameShell.tsx', [
  'useLayoutEffect(() => {\n    setSidebarCollapsed(true);\n  }, [model.tab]);',
]);
forbidText('src/components/shell/DesktopSidebar.tsx', [
  'interactionResetKey={activeTab}',
]);
requireText('src/components/shell/SidebarFrame.tsx', [
  'hoverIntentRef.current = false;',
  'foregroundIntentRef.current = false;',
  "if (event.key === 'Tab') foregroundIntentRef.current = true;",
  "window.addEventListener('pointermove', markPointerIntent, { capture: true, passive: true });",
  "window.addEventListener('pointerdown', markPointerDownIntent, { capture: true, passive: true });",
  "window.addEventListener('blur', suspendInteraction);",
  "document.addEventListener('visibilitychange', handleVisibilityChange);",
  "if (event.type === 'focus' && !foregroundIntentRef.current) return;",
  'onFocusCapture={expand}',
  '}, []);',
]);
forbidText('src/components/shell/SidebarFrame.tsx', [
  'interactionResetKey',
  "window.addEventListener('pointermove', markHoverIntent, { once: true });",
]);
requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '正式页面 ID 变化只切换页面内容，不得写入桌面玩家侧栏的展开状态',
  '浏览器标签页或窗口失焦、进入后台时，共享桌面侧栏必须立即恢复为收起态',
  '`tests/browser/sidebar-navigation-collapse.spec.ts`',
]);
forbidText('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '正式页面 ID 发生变化时，桌面玩家侧栏的展开状态必须立即恢复为 `78px` 收起态',
]);
requireText('tests/browser/sidebar-navigation-collapse.spec.ts', [
  "test.describe('desktop sidebar navigation collapse'",
  'hovered navigation survives page changes while browser restore still requires fresh foreground interaction intent',
  "window.dispatchEvent(new Event('blur'))",
  "overviewButton.focus()",
  "page.keyboard.press('Tab')",
  'expandedBox.width + 80',
  "toHaveAttribute('data-collapsed', 'true')",
  "toHaveAttribute('data-collapsed', 'false')",
  "__lastSelectedTab)).toBe('settings')",
]);

if (failures.length > 0) {
  console.error('侧栏导航与前台输入意图验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('侧栏导航与前台输入意图验证通过。');
