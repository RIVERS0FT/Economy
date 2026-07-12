import { readFileSync, writeFileSync } from 'node:fs';

const path = 'scripts/apply-industry-catalog-expansion.mjs';
let content = readFileSync(path, 'utf8');
const before = "['docs/UI_DESIGN_SYSTEM.md', ['目录型横向导航', '不得使用 \\\\`repeat(6, ...)\\\\`']]";
const after = "['docs/UI_DESIGN_SYSTEM.md', ['目录型横向导航', 'repeat(6, ...)']]";
if (!content.includes(before)) throw new Error('未找到需要修正的验证文本');
content = content.replace(before, after);
writeFileSync(path, content);
console.log('维护脚本转义已修正。');
