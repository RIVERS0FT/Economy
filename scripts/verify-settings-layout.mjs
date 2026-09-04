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
    'nickname-editor',
    'profile-settings-card',
    'game-preferences-card',
    'account-management-card',
    '账号与管理',
    '存档管理',
    '删除存档',
    '<PlayerAvatar',
    '<FileInput',
  ]) {
    if (!page.includes(text)) failures.push(`SettingsPage 缺少设置页结构或文案: ${text}`);
  }

  for (const forbidden of [
    'InvitationSettings',
    'settings-grid unified-settings-grid',
    'settings-primary-column',
    'settings-side-column',
    'profile-settings-card span-2',
    'profile-action-stack',
    'gift-redemption-card',
    '前往主页修改账号资料',
    'riversoft.top/profile',
    'redeemGift',
    '危险区域',
    '当前会话',
    '原图只在浏览器本地处理；服务器只接收并加载 64×64 WebP 缩略图。',
    '恢复为新玩家初始经济状态。普通货币、库存、工厂、研发、银行资产和经营统计将被清空；',
  ]) {
    if (page.includes(forbidden)) failures.push(`SettingsPage 不应包含: ${forbidden}`);
  }

  for (const text of [
    'grid-template-columns: minmax(0, 1fr);',
    'grid-template-columns: repeat(4, minmax(0, 1fr));',
    '@media (max-width: 760px)',
    'grid-template-columns: repeat(2, minmax(0, 1fr));',
  ]) {
    if (!styles.includes(text)) failures.push(`settings.css 缺少: ${text}`);
  }
  for (const forbidden of [
    'grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);',
    '@media (max-width: 1180px)',
    'display: contents;',
    '.profile-settings-card { order: 1; }',
    '.game-preferences-card { order: 2; }',
    '.gift-redemption-card { order: 3; }',
    '.account-management-card { order: 4; }',
    '.settings-primary-column',
    '.settings-side-column',
    '.invite-card',
  ]) {
    if (styles.includes(forbidden)) failures.push(`settings.css 不应包含: ${forbidden}`);
  }

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
    '所有宽度下固定使用单一纵向内容栈',
    '玩家资料／游戏设置／账号与管理',
    '设置页“存档管理”',
    '礼品码兑换唯一归属商店',
    '共享三列网格',
  ]) {
    if (!pageDesign.includes(text)) failures.push(`页面职责设计缺少设置页防回退规则: ${text}`);
  }
  if (pageDesign.includes('桌面设置页固定使用两个互不共享网格行高的纵向内容栈')) {
    failures.push('页面职责设计不得保留设置页桌面双列规则');
  }

  for (const text of [
    '`src/styles/settings.css`',
    '## 14. 设置页布局',
    '所有宽度下固定使用单一纵向内容栈',
    '玩家资料／游戏设置／账号与管理',
    '邀请卡与礼品码兑换不得在设置页重复出现',
    '概览｜市场｜建筑｜运输｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置',
  ]) {
    if (!uiDesign.includes(text)) failures.push(`UI 设计系统缺少设置页规则: ${text}`);
  }
  if (uiDesign.includes('主列 `2fr`、侧列最小 `18rem`')) {
    failures.push('UI 设计系统不得保留设置页桌面双列比例');
  }

  for (const text of [
    'desktop settings remain single-column with save deletion management',
    "name: '邀请好友'",
    'toHaveCount(0)',
  ]) {
    if (!browser.includes(text)) failures.push(`设置页浏览器回归缺少: ${text}`);
  }
}

if (failures.length) {
  console.error(`设置页统一单列、统计密度、账号分组和邀请移除验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('设置页统一单列、四项统计、账号分组、邀请移出与存档管理验证通过。');
