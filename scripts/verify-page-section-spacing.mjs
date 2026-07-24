import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
  layout: 'src/components/ui/layout.tsx',
  styles: 'src/styles/design-system.css',
  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',
  pageDesign: 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  contractTest: 'tests/browser/contract-layout.spec.ts',
  package: 'package.json',
  admin: 'src/app/AdminApp.tsx',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    '<section className="page-content">',
    '<div className="ui-page-stack">',
    '{children}',
  ]) requireText(paths.layout, text);

  for (const text of [
    '.ui-page-stack {',
    '--page-section-gap: var(--layout-gutter);',
    'display: grid;',
    'align-content: start;',
    'gap: var(--page-section-gap);',
    '.page-content > .ui-page-stack > * {',
    'margin-block: 0 !important;',
  ]) requireText(paths.styles, text);

  const stackDefinitionCount = (read(paths.styles).match(/\.ui-page-stack\s*\{/g) || []).length;
  if (stackDefinitionCount !== 1) {
    failures.push(`design-system.css 中 .ui-page-stack 基础定义数量应为 1，当前为 ${stackDefinitionCount}`);
  }

  const pageDirectory = resolve(root, 'src/pages');
  const formalPages = readdirSync(pageDirectory)
    .filter((name) => name.endsWith('Page.tsx'))
    .sort()
    .map((name) => `src/pages/${name}`);

  if (formalPages.length < 9) failures.push(`正式页面数量异常，当前仅发现 ${formalPages.length} 个 *Page.tsx`);

  for (const path of [...formalPages, paths.admin]) {
    requireText(path, '<PageLayout');
    forbidText(path, 'className="page-content"');
    forbidText(path, 'ui-page-stack');
  }

  const styleDirectory = resolve(root, 'src/styles');
  for (const name of readdirSync(styleDirectory).filter((entry) => entry.endsWith('.css'))) {
    const path = `src/styles/${name}`;
    if (path === paths.styles) continue;
    forbidText(path, '.ui-page-stack');
    forbidText(path, '--page-section-gap');
  }

  for (const text of [
    '### 3.1 `PageLayout` 与页面一级区块间距',
    '自动生成唯一 `.ui-page-stack`',
    '`--page-section-gap` 映射为当前 `var(--layout-gutter)`',
    '不得为特殊页面增加 `disableSpacing`',
    '`scripts/verify-page-section-spacing.mjs`',
  ]) requireText(paths.uiDesign, text);

  requireText(paths.pageDesign, '作为 `PageLayout` 自动生成的 `.ui-page-stack` 直接子元素');

  for (const text of [
    'expectUniformPageSectionGaps',
    "page.locator('.ui-page-stack')",
    'Math.abs(gap - result.expected)',
  ]) requireText(paths.contractTest, text);

  const geometryAssertionCount = (read(paths.contractTest).match(/expectUniformPageSectionGaps\(page\)/g) || []).length;
  if (geometryAssertionCount < 5) {
    failures.push(`合同页真实一级间距断言至少应覆盖 5 个桌面／平板／移动状态，当前为 ${geometryAssertionCount}`);
  }

  for (const text of [
    '"verify:page-spacing": "node scripts/verify-page-section-spacing.mjs"',
    'node scripts/verify-page-section-spacing.mjs',
  ]) requireText(paths.package, text);
}

if (failures.length > 0) {
  console.error(`页面一级区块统一间距验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('页面一级区块统一间距验证通过：PageLayout 自动内容栈、外壳沟槽映射、直接子元素外边距清理、新页面扫描、设计权威与真实几何回归均已锁定。');
