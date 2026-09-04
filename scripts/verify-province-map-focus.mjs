import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function requireText(source, expected, message) {
  if (!source.includes(expected)) throw new Error(message);
}

function rejectText(source, rejected, message) {
  if (source.includes(rejected)) throw new Error(message);
}

const mapSource = read('src/components/provinces/UsMainlandMap.tsx');
const styleSource = read('src/styles/province-map.css');
const renderingSource = read('src/styles/strategic-map-rendering.css');
const designSource = read('docs/STRATEGIC_MAP_RENDERING_DESIGN.md');
const browserSource = read('tests/browser/province-map-focus.spec.ts');

requireText(
  mapSource,
  'className="province-map-region"',
  'province map focus must be applied to the single static SVG state path',
);
requireText(
  mapSource,
  "'--province-map-area-color': datum.areaColor",
  'province path must retain the lens-derived area color as a CSS variable',
);
requireText(
  mapSource,
  "data-selected={selected ? 'true' : 'false'}",
  'persistent province selection must remain a path data state rather than a second geometry layer',
);
requireText(
  styleSource,
  '.province-map-region:hover',
  'desktop province hover must use native SVG/CSS hover instead of React pointer-move state',
);
requireText(
  styleSource,
  'stroke: var(--color-text-secondary);',
  'province hover must use the neutral secondary text color rather than a business status color',
);
requireText(
  styleSource,
  'stroke-width: 1.5;',
  'province hover must retain the 1.5px neutral outline',
);
requireText(
  styleSource,
  ".province-map-region[data-selected='true']",
  'province selection must use the existing static path data-selected state',
);
requireText(
  styleSource,
  'stroke: var(--color-text-primary);',
  'province selection must use the neutral primary text color rather than a business status color',
);
requireText(
  styleSource,
  'stroke-width: 2.5;',
  'persistent province selection must retain the 2.5px neutral outline',
);
requireText(
  styleSource,
  ".province-map-region[data-selected='true']:hover",
  'selected-hover must remain visually distinct from persistent selection',
);
requireText(
  styleSource,
  'stroke-width: 3;',
  'selected-hover must remain visually stronger than persistent selection',
);
requireText(
  renderingSource,
  ".province-map-region[data-selected='true']",
  'final strategic map rendering must explicitly own the filter-free selected state',
);
requireText(
  renderingSource,
  'filter: none;',
  'viewBox settle must not rerun SVG drop-shadow filters for province selection',
);
rejectText(
  renderingSource,
  '--province-map-camera-transform',
  'transient camera must write the built-in transform property directly instead of routing every frame through a CSS custom property',
);
requireText(
  styleSource,
  'fill: var(--province-map-area-color, var(--color-map-region-default));',
  'hover and selection must preserve each province lens area color',
);
rejectText(
  styleSource,
  'fill: var(--color-surface-hover)',
  'province hover must not replace lens fill with the generic hover surface color',
);
rejectText(
  styleSource,
  'fill: var(--color-success-strong)',
  'province selection must not replace lens fill with the success color',
);
rejectText(
  mapSource,
  'onPointerMove={(event) => setHoveredProvinceId',
  'province visual hover must not be driven by pointer-move React state',
);

requireText(
  designSource,
  '战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层',
  'authoritative strategic map design must record the province focus hierarchy',
);
requireText(
  designSource,
  '选中悬浮 > 选中 > 普通悬浮 > 默认',
  'authoritative strategic map design must record province focus precedence',
);
requireText(
  designSource,
  '静态 SVG',
  'authoritative strategic map design must record the static SVG implementation boundary',
);
requireText(
  designSource,
  '直接写浏览器内建的 `style.transform`',
  'authoritative strategic map design must prohibit transient custom-property indirection',
);
requireText(
  designSource,
  '`province-map-focus.spec.ts`',
  'authoritative strategic map design must register the browser regression',
);

requireText(
  browserSource,
  "test('province hover and selection preserve lens fill and neutral focus hierarchy without changing the SVG viewBox'",
  'province focus browser regression must exist',
);
requireText(
  browserSource,
  "const hoverBorder = await resolveCssColor(page, '--color-text-secondary');",
  'province focus browser regression must inspect the neutral hover border',
);
requireText(
  browserSource,
  "const selectedBorder = await resolveCssColor(page, '--color-text-primary');",
  'province focus browser regression must inspect the neutral selected border',
);
requireText(
  browserSource,
  "data-map-camera-mode', 'svg-viewbox'",
  'province focus regression must confirm focus changes do not replace the SVG viewBox camera',
);

console.log('province map focus verification passed');
