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
const designSource = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
const browserSource = read('tests/browser/province-map-focus.spec.ts');

requireText(
  mapSource,
  "type ProvinceMapFocusState = 'hover' | 'selected' | 'selected-hover';",
  'province map must keep explicit hover, selected, and selected-hover focus states',
);
requireText(
  mapSource,
  "borderColor: 'var(--color-text-secondary)'",
  'province hover must use the neutral secondary text color rather than a business status color',
);
requireText(
  mapSource,
  "borderColor: 'var(--color-text-primary)'",
  'province selection must use the neutral primary text color rather than a business status color',
);
requireText(
  mapSource,
  'borderWidth: isSelectedHover ? 3 : 2.5',
  'selected hover must remain visually stronger than persistent selection',
);
requireText(
  mapSource,
  'shadowBlur: isSelectedHover ? 7 : 5',
  'selected province focus must retain a low-strength outline glow',
);
requireText(
  mapSource,
  "itemStyle: focusItemStyle(areaColor, selected ? 'selected-hover' : 'hover')",
  'hover emphasis must preserve each province lens areaColor',
);
requireText(
  mapSource,
  "itemStyle: focusItemStyle(areaColor, 'selected')",
  'selected state must preserve each province lens areaColor',
);
requireText(
  mapSource,
  'province.id === selectedProvinceId',
  'selected-hover strength must be derived from the existing selected province state',
);
rejectText(
  mapSource,
  "areaColor: 'var(--color-surface-hover)'",
  'province hover must not replace lens fill with the generic hover surface color',
);
rejectText(
  mapSource,
  "areaColor: 'var(--color-success-strong)'",
  'province selection must not replace lens fill with the success color',
);
rejectText(
  mapSource,
  'useState',
  'province map focus must not introduce React pointer-hover state',
);

requireText(
  designSource,
  '战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层',
  'authoritative chrome design must record the province focus hierarchy',
);
requireText(
  designSource,
  '选中悬浮 > 选中 > 普通悬浮 > 默认',
  'authoritative chrome design must record province focus precedence',
);
requireText(
  designSource,
  '`tests/browser/province-map-focus.spec.ts`',
  'authoritative chrome design must register the browser regression',
);

requireText(
  browserSource,
  "test('province hover and selection preserve lens fill and neutral focus hierarchy'",
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

console.log('province map focus verification passed');
