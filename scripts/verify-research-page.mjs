import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

for (const path of [
  'src/config/navigation.ts',
  'src/components/icons/GameIcons.tsx',
  'src/pages/PageRouter.tsx',
  'src/pages/ResearchPage.tsx',
  'docs/README.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
]) requireFile(path);

requireText(
  'src/config/navigation.ts',
  "{ id: 'production', label: '生产' },\n  { id: 'research', label: '研发' },\n  { id: 'auction', label: '拍卖' },",
);
for (const text of [
  "const ResearchPage = lazy(() => import('./ResearchPage')",
  "case 'research':",
  '<ResearchPage model={model} />',
]) requireText('src/pages/PageRouter.tsx', text);
for (const text of [
  "'production' | 'research' | 'auction'",
  'export function ResearchIcon',
  "case 'research': return <ResearchIcon",
]) requireText('src/components/icons/GameIcons.tsx', text);
for (const text of [
  'title="研发"',
  '当前产业基础',
  '技术路线',
  '研发功能尚未开放',
  '不扣除资金或宝石',
  '<PagePanel',
  '<DataList>',
  '<EmptyState>',
]) requireText('src/pages/ResearchPage.tsx', text);
for (const text of ['gameActions', 'showResult(', '<Button']) {
  forbidText('src/pages/ResearchPage.tsx', text);
}
for (const text of [
  '概览｜市场｜生产｜研发｜拍卖｜合同｜银行｜排行｜商店｜设置',
  '| 研发 | `research` | `ResearchPage` | 当前产业基础只读摘要、技术路线入口和研发未开放边界 |',
  '玩家导航固定为十项',
  '研发玩法未开放前不得扣除普通货币或宝石',
  '技术路线入口、产业基础只读摘要和研发未开放边界 | 研发',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
requireText('docs/README.md', '十个正式页面、研发只读入口与技术路线边界');

if (failures.length) {
  console.error(`研发页面与导航防回退验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('研发页面、导航顺序、只读边界与设计文档验证通过。');
