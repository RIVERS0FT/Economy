import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/verify-page-content.mjs';
let content = readFileSync(path, 'utf8').replace(/\r\n?/g, '\n');
const stale = "requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '未解锁州只显示该分区自己的地区解锁信息与解锁按钮');";
const semantic = "requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '仅已解锁州显示本地库存内容');\nrequireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '建筑与仓库只有已解锁州才显示经营内容');";
if (!content.includes(stale)) throw new Error('stale warehouse unlock verifier not found');
content = content.replace(stale, semantic);
writeFileSync(path, content, 'utf8');
console.log('Page-content verifier now checks warehouse unlock semantics instead of duplicate wording.');
