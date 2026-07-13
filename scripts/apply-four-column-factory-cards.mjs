import { readFileSync, writeFileSync } from 'node:fs';

function replaceExact(path, from, to, expectedCount = 1) {
  const current = readFileSync(path, 'utf8');
  const count = current.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(`${path}: expected ${expectedCount} occurrence(s), found ${count}: ${from}`);
  }
  writeFileSync(path, current.split(from).join(to), 'utf8');
}

function replaceAtLeast(path, from, to, minimumCount = 1) {
  const current = readFileSync(path, 'utf8');
  const count = current.split(from).length - 1;
  if (count < minimumCount) {
    throw new Error(`${path}: expected at least ${minimumCount} occurrence(s), found ${count}: ${from}`);
  }
  writeFileSync(path, current.split(from).join(to), 'utf8');
}

replaceAtLeast(
  'src/styles/industry-system.css',
  `.facility-group-list {\n  grid-template-columns: repeat(2, minmax(0, 1fr));\n  align-items: start;\n}`,
  `.facility-group-list {\n  grid-template-columns: repeat(4, minmax(0, 1fr));\n  align-items: start;\n}`,
  2,
);

replaceExact(
  'README.md',
  '- 桌面生产管理区由左侧常驻建设卡和右侧工厂列表组成；工厂卡固定高度 384px，移动端恢复自然高度。',
  '- 桌面生产管理区由左侧常驻建设卡和右侧工厂列表组成；大于 1380px 时工厂卡固定四列，961px–1380px 单列，卡片高度保持 384px，移动端恢复自然高度。',
);

replaceExact(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '- 宽屏右侧双列，中等桌面单列，顶部对齐。',
  '- 大于 1380px 时右侧固定四列，961px–1380px 单列，顶部对齐。',
);

replaceExact(
  'docs/UI_DESIGN_SYSTEM.md',
  '- 工厂卡宽屏双列、中等桌面单列、顶部对齐。',
  '- 工厂卡大于 1380px 时固定四列，961px–1380px 单列、顶部对齐。',
);

replaceExact(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  '每种工厂类型最多一张卡。桌面卡片固定高度 384px，移动端使用自然高度。',
  '每种工厂类型最多一张卡。桌面卡片固定高度 384px，移动端使用自然高度。大于 1380px 时工厂列表固定四列，961px–1380px 与移动端均为单列。',
);

replaceExact(
  'scripts/verify-warehouse-expansion.mjs',
  "  'height: 384px',\n  '.facility-count-summary',",
  "  'height: 384px',\n  '@media (min-width: 1381px) {\\n  .facility-group-list {\\n    grid-template-columns: repeat(4, minmax(0, 1fr));',\n  '.facility-count-summary',",
);

replaceExact(
  'scripts/verify-warehouse-expansion.mjs',
  "  '固定高度 384px',\n  'position: sticky',",
  "  '固定高度 384px',\n  '大于 1380px 时右侧固定四列',\n  'position: sticky',",
);

replaceExact(
  'scripts/verify-warehouse-expansion.mjs',
  "  '桌面卡片固定高度 384px',\n  '无限扩容信息',",
  "  '桌面卡片固定高度 384px',\n  '大于 1380px 时工厂列表固定四列',\n  '无限扩容信息',",
);

replaceExact(
  'scripts/verify-warehouse-expansion.mjs',
  "  '工厂卡桌面固定高度',\n  '建设新工厂卡桌面独占',",
  "  '工厂卡桌面固定高度',\n  '工厂卡大于 1380px 时固定四列',\n  '建设新工厂卡桌面独占',",
);

replaceExact(
  'scripts/verify-page-content.mjs',
  "  '建设新工厂卡独占左侧列并在桌面滚动时常驻',\n]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);",
  "  '建设新工厂卡独占左侧列并在桌面滚动时常驻',\n  '大于 1380px 时工厂列表固定四列',\n]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);",
);

for (const [path, forbidden] of [
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '宽屏右侧双列'],
  ['docs/UI_DESIGN_SYSTEM.md', '工厂卡宽屏双列'],
]) {
  if (readFileSync(path, 'utf8').includes(forbidden)) {
    throw new Error(`${path}: obsolete rule remains: ${forbidden}`);
  }
}

console.log('工厂卡宽屏四列规则已应用。');
