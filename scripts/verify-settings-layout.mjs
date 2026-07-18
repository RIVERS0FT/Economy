import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const pathFor = (path) => resolve(root, path);
const read = (path) => readFileSync(pathFor(path), 'utf8');
const failures = [];

const requiredFiles = [
  'src/pages/SettingsPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/styles/settings.css',
  'src/main.tsx',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
];

for (const path of requiredFiles) {
  if (!existsSync(pathFor(path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  const page = read('src/pages/SettingsPage.tsx');
  const invitation = read('src/components/InvitationSettings.tsx');
  const styles = read('src/styles/settings.css');
  const main = read('src/main.tsx');
  const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
  const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');

  for (const text of [
    'settings-layout',
    'settings-primary-column',
    'settings-side-column',
    'nickname-editor',
    'game-preferences-card',
    'account-management-card',
    'account-action-group',
    'settings-danger-zone',
    '账号与管理',
    '账号资料',
    '当前会话',
    '危险区域',
    '清空资金、统计、订单和工厂；宝石、邀请关系和封禁记录将保留。',
  ]) {
    if (!page.includes(text)) failures.push(`SettingsPage 缺少设置页结构或文案: ${text}`);
  }

  for (const forbidden of [
    'settings-grid unified-settings-grid',
    'profile-settings-card span-2',
    'profile-action-stack',
  ]) {
    if (page.includes(forbidden)) failures.push(`SettingsPage 不应恢复旧布局: ${forbidden}`);
  }

  if (!invitation.includes('className="widget invite-card"')) {
    failures.push('邀请卡必须由页面容器决定列宽，不得携带跨列类');
  }
  if (invitation.includes('invite-card span-2')) {
    failures.push('邀请卡不得恢复 span-2 布局耦合');
  }

  for (const text of [
    'grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);',
    'grid-template-columns: repeat(4, minmax(0, 1fr));',
    '@media (max-width: 1180px)',
    'display: contents;',
    '@media (max-width: 760px)',
    'grid-template-columns: repeat(2, minmax(0, 1fr));',
    '.settings-danger-zone',
  ]) {
    if (!styles.includes(text)) failures.push(`settings.css 缺少: ${text}`);
  }

  for (const forbidden of [
    '.ui-button {',
    '.ui-switch {',
    '.panel {',
    'input {',
    'select {',
  ]) {
    if (styles.includes(forbidden)) failures.push(`settings.css 不得复制基础控件视觉: ${forbidden}`);
  }

  const settingsImport = "import './styles/settings.css';";
  const designImport = "import './styles/design-system.css';";
  if (!main.includes(settingsImport)) failures.push(`src/main.tsx 缺少: ${settingsImport}`);
  if (main.indexOf(settingsImport) > main.indexOf(designImport)) {
    failures.push('settings.css 必须在 design-system.css 之前加载');
  }

  for (const text of [
    '两个互不共享网格行高的纵向内容栈',
    '玩家资料／游戏设置／邀请好友／礼品兑换／账号与管理',
    '危险区域',
    '共享三列网格',
  ]) {
    if (!pageDesign.includes(text)) failures.push(`页面职责设计缺少设置页防回退规则: ${text}`);
  }

  for (const text of [
    '`src/styles/settings.css`',
    '## 13. 设置页布局',
    '主列 `2fr`、侧列最小 `18rem`',
    '不超过 `1180px`',
    '概览｜市场｜生产｜资产｜藏品｜拍卖｜排行｜宝石商店｜设置',
  ]) {
    if (!uiDesign.includes(text)) failures.push(`UI 设计系统缺少设置页规则: ${text}`);
  }
}

if (failures.length) {
  console.error(`设置页独立列、统计密度、账号分组和危险区域验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('设置页独立主列／侧列、四项统计、账号分组、危险区域与设计文档验证通过。');
