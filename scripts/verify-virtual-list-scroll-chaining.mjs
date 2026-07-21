import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const hook = read('src/hooks/useVirtualWindow.ts');
const list = read('src/components/ui/VirtualList.tsx');
const table = read('src/components/ui/VirtualRecordTable.tsx');
const styles = read('src/styles/virtual-list.css');
const design = read('docs/UI_DESIGN_SYSTEM.md');

for (const text of [
  'ResizeObserver',
  'measuredSizesRef',
  'requestAnimationFrame',
  'findVisibleRange',
  'visibleEntries',
]) assert.ok(hook.includes(text), `共享窗口化内核缺少: ${text}`);

for (const text of [
  'useVirtualWindow',
  'className="virtual-list-scroll-area"',
  'viewportClassName={`virtual-list',
]) assert.ok(list.includes(text), `VirtualList 缺少: ${text}`);

for (const text of [
  'useVirtualWindow',
  'axis="both"',
  'virtual-record-table',
  'virtual-record-canvas',
]) assert.ok(table.includes(text), `VirtualRecordTable 缺少: ${text}`);

for (const text of [
  'overflow-x: auto;',
  'overflow-y: auto;',
  'overscroll-behavior-x: contain;',
  'overscroll-behavior-y: auto;',
  'touch-action: pan-x pan-y;',
]) assert.ok(styles.includes(text), `虚拟视口样式缺少: ${text}`);

assert.equal(
  styles.includes('overscroll-behavior: contain;'),
  false,
  '不得使用同时吞掉纵向滚动链的 contain 简写',
);

for (const text of [
  '纵向滚动到顶或到底后必须把后续滚动链交给外层 `.page-scroll`',
  '单一双轴原生视口的 `VirtualRecordTable`',
]) assert.ok(design.includes(text), `UI 设计文档缺少: ${text}`);

console.log('Shared virtual windowing, single two-axis record viewport and boundary scroll chaining verification passed.');
