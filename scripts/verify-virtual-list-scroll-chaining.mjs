import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const component = read('src/components/ui/VirtualList.tsx');
const styles = read('src/styles/virtual-list.css');
const design = read('docs/UI_DESIGN_SYSTEM.md');

assert.ok(
  component.includes('viewportClassName={`virtual-list ${className}`.trim()}'),
  '所有 VirtualList 实例必须继续把 .virtual-list 作为共享滚动视口根类',
);
assert.ok(
  component.includes('className="virtual-list-scroll-area"'),
  'VirtualList 必须通过共享覆盖式 ScrollArea 承载滚动条',
);
assert.ok(
  styles.includes('overscroll-behavior-x: contain;'),
  '虚拟列表必须只隔离横向越界滚动',
);
assert.ok(
  styles.includes('overscroll-behavior-y: auto;'),
  '虚拟列表纵向到顶或到底后必须允许滚动链传递给外层页面',
);
assert.ok(
  !styles.includes('overscroll-behavior: contain;'),
  '不得使用同时吞掉纵向滚动链的 overscroll-behavior: contain 简写',
);
for (const text of [
  '纵向滚动到顶或到底后必须把后续滚动链交给外层 `.page-scroll`',
  '恢复会阻断纵向滚动链的 `overscroll-behavior: contain`',
]) {
  assert.ok(design.includes(text), `UI 设计文档缺少: ${text}`);
}

console.log('Virtual list overlay scrollbar and scroll chaining verification passed.');
