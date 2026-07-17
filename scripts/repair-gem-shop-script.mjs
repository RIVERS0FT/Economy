import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-gem-shop-change.mjs';
let source = readFileSync(path, 'utf8');

const writePrefix = "write('";
const bodyMarker = "', `";
const closingMarker = "\n`);";
let cursor = 0;
while (cursor < source.length) {
  const writeStart = source.indexOf(writePrefix, cursor);
  if (writeStart < 0) break;
  const markerStart = source.indexOf(bodyMarker, writeStart + writePrefix.length);
  if (markerStart < 0) break;
  const bodyStart = markerStart + bodyMarker.length;
  const blockEnd = source.indexOf(closingMarker, bodyStart);
  const nextWrite = source.indexOf(writePrefix, bodyStart);
  if (blockEnd < 0 || (nextWrite >= 0 && nextWrite < blockEnd)) {
    cursor = bodyStart;
    continue;
  }
  const body = source.slice(bodyStart, blockEnd);
  const escapedBody = body
    .replace(/(?<!\\)`/g, '\\`')
    .replace(/(?<!\\)\$\{/g, '\\${');
  source = `${source.slice(0, bodyStart)}${escapedBody}${source.slice(blockEnd)}`;
  cursor = bodyStart + escapedBody.length + closingMarker.length;
}

source = source
  .replace("import { ECONOMY_CONSTANTS } from './domain-core.js';", "import { ECONOMY_CONSTANTS } from './domain.js';")
  .replaceAll('var(--border-subtle)', 'var(--color-border)')
  .replaceAll('var(--radius-md)', 'var(--radius-control)')
  .replaceAll('var(--surface-soft)', 'rgba(255, 255, 255, 0.035)')
  .replace('`- 隐藏移动端的藏品或拍卖导航;`,', '`- 隐藏移动端的藏品或拍卖导航；`,');

const headingNeedle = `insertBefore(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  \`## 10. 设置\`,
  \`## 10. 宝石商店`;
if (!source.includes(headingNeedle)) throw new Error('找不到宝石商店页面章节插入锚点');

const nextHeading = `replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  \`## 11. 商品与工厂目录扩展规则\`,`;
if (!source.includes(nextHeading)) throw new Error('找不到页面章节编号锚点');
source = source.replace(
  nextHeading,
  `replaceOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  \`## 10. 设置\`,
  \`## 11. 设置\`,
);
${nextHeading}`,
);

writeFileSync(path, source);
console.log('Implementation script repaired.');
