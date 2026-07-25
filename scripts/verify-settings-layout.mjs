import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const pathFor = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFor(path), 'utf8');
const failures = [];

const requiredFiles = [
  'src/pages/SettingsPage.tsx',
  'src/styles/settings.css',
  'src/main.tsx',
  'tests/browser/settings-layout.spec.ts',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
];
for (const path of requiredFiles) {
  if (!existsSync(pathFor(path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const page = read('src/pages/SettingsPage.tsx');
  const styles = read('src/styles/settings.css');
  const main = read('src/main.tsx');
  const browser = read('tests/browser/settings-layout.spec.ts');
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');

  for (const text of [
    'settings-layout',
    'settings-primary-column',
    'settings-side-column',
    'nickname-editor',
    'game-preferences-card',
    'account-management-card',
    '账号与管理',
    '账号资料',
    '当前会话',
  ]) {
    if (!page.includes(text)) failures.push(`SettingsPage 缺少设置页结构或文案: ${text}`);
  }

  for (const forbidden of [
    'InvitationSettings',
    'settings-grid unified-settings-grid',
    'profile-settings-card span-2',
    'profile-action-stack',
    'settings-danger-zone',
    '重置经济状态',
    '危险区域',
  ]) {
    if (page.includes(forbidden)) failures.push(`SettingsPage 不应包含: ${forbidden}`);
  }

  for (const text of [
    'grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);',
    'grid-template-columns: repeat(4, minmax(0, 1fr));',
    '@media (max-width: 1180px)',
    'display: contents;',
    '.profile-settings-card { order: 1; }',
    '.game-preferences-card { order: 2; }',
    '.gift-redemption-card { order: 3; }',
    '.account-management-card { order: 4; }',
    '@media (max-width: 760px)',
    'grid-template-columns: repeat(2, minmax(0, 1fr));',
  ]) {
    if (!styles.includes(text)) failures.push(`settings.css 缺少: ${text}`);
  }
  if (styles.includes('.invite-card')) failures.push('settings.css 不得继续耦合邀请卡');

  const forbiddenBaseSelectors = [
    ['.ui-button', /(^|\n)\.ui-button\s*\{/],
    ['.ui-switch', /(^|\n)\.ui-switch\s*\{/],
    ['.panel', /(^|\n)\.panel\s*\{/],
    ['input', /(^|\n)input\s*\{/],
    ['select', /(^|\n)select\s*\{/],
  ];
  for (const [selector, pattern] of forbiddenBaseSelectors) {
    if (pattern.test(styles)) failures.push(`settings.css 不得复制基础控件视觉: ${selector}`);
  }

  const settingsImport = "import './styles/settings.css';";
  const designImport = "import './styles/design-system.css';";
  if (!main.includes(settingsImport)) failures.push(`src/main.tsx 缺少: ${settingsImport}`);
  if (main.indexOf(settingsImport) > main.indexOf(designImport)) {
    failures.push('settings.css 必须在 design-system.css 之前加载');
  }

  for (const text of [
    '两个互不共享网格行高的纵向内容栈',
    '玩家资料／游戏设置／礼品兑换／账号与管理',
    '不得提供经济状态重置',
    '共享三列网格',
  ]) {
    if (!pageDesign.includes(text)) failures.push(`页面职责设计缺少设置页防回退规则: ${text}`);
  }

  for (const text of [
    '`src/styles/settings.css`',
    '## 13. 设置页布局',
    '主列 `2fr`、侧列最小 `18rem`',
    '不超过 `1180px`',
    '玩家资料／游戏设置／礼品兑换／账号与管理',
    '邀请卡不得在设置页重复出现',
    '概览｜市场｜生产｜资产｜拍卖｜合同｜排行｜商店｜设置',
  ]) {
    if (!uiDesign.includes(text)) failures.push(`UI 设计系统缺少设置页规则: ${text}`);
  }

  for (const text of [
    'desktop settings columns stack independently without invitation content',
    "name: '邀请好友'",
    'toHaveCount(0)',
  ]) {
    if (!browser.includes(text)) failures.push(`设置页浏览器回归缺少: ${text}`);
  }
}

if (failures.length) {
  console.error(`设置页独立列、统计密度、账号分组和邀请移除验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('设置页独立主列／侧列、四项统计、账号分组、邀请移出与禁用重置验证通过。');
