import './verify-province-map-raster-snapshot.mjs';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
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
const uiDesignSource = read('docs/UI_DESIGN_SYSTEM.md');
const browserSource = read('tests/browser/province-map-focus.spec.ts');
const mapBrowserSource = read('tests/browser/province-map.spec.ts');
const mapFontGeneratorSource = read('scripts/generate-map-font-subset.py');
const mapFontLicenseSource = read('public/licenses/source-han-serif-OFL-1.1.txt');
const mapFontManifest = JSON.parse(read('src/assets/fonts/economy-map-serif-600.manifest.json'));
const provinces = JSON.parse(read('shared/provinces.json'));
const expectedMapFontCharacters = [...new Set(provinces.map((province) => province.name).join(''))].sort().join('');
const mapFontPath = resolve(root, 'src/assets/fonts/economy-map-serif-600.woff2');
const mapFontBytes = readFileSync(mapFontPath);
const mapFontSha256 = createHash('sha256').update(mapFontBytes).digest('hex');

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
  styleSource,
  '@font-face {',
  'province map must declare the self-hosted map font face',
);
requireText(
  styleSource,
  'url("../assets/fonts/economy-map-serif-600.woff2") format("woff2")',
  'province map must bundle the generated WOFF2 subset through Vite',
);
requireText(
  styleSource,
  'font-family: "Economy Map Serif", "Source Han Serif SC", "思源宋体", "Noto Serif CJK SC", "Noto Serif SC", "Songti SC", STSong, SimSun, serif;',
  'province map labels must prefer the bundled Economy Map Serif subset',
);
requireText(
  styleSource,
  'font-weight: 600;',
  'province map labels must retain Source Han Serif SemiBold weight 600',
);
rejectText(
  styleSource,
  'Playfair Display',
  'province map labels must not fall back to the retired Playfair map font',
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
  '二选一直接写一次浏览器内建 `style.transform`',
  'authoritative strategic map design must prohibit transient custom-property indirection while preserving one built-in transform write per frame',
);
requireText(
  designSource,
  '`province-map-focus.spec.ts`',
  'authoritative strategic map design must register the browser regression',
);
requireText(
  uiDesignSource,
  '自托管 `"Economy Map Serif"`',
  'authoritative UI design must record the bundled strategic map font subset',
);
requireText(
  uiDesignSource,
  '不得把完整 CJK 字体打入网页包',
  'authoritative UI design must prohibit bundling the complete CJK font',
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
requireText(
  mapBrowserSource,
  "expect(bundledMapFont).toEqual({ family: 'Economy Map Serif', weight: '600', status: 'loaded' });",
  'province map browser regression must assert the bundled font is actually loaded',
);
requireText(
  mapBrowserSource,
  "expect(viewportFontFamily.split(',')[0]).toContain('Economy Map Serif');",
  'province map browser regression must assert the bundled font is first in the map stack',
);
requireText(
  mapBrowserSource,
  "expect(viewportFontFamily).not.toContain('Playfair Display');",
  'province map browser regression must reject the retired Playfair font',
);
requireText(
  mapBrowserSource,
  "expect(labelFont.weight).toBe('600');",
  'province map browser regression must assert SemiBold weight 600',
);


if (mapFontManifest.family !== 'Economy Map Serif' || mapFontManifest.weight !== 600) {
  throw new Error('地图字体 manifest 必须保持 Economy Map Serif / 600');
}
if (mapFontManifest.characters !== expectedMapFontCharacters || mapFontManifest.characterCount !== expectedMapFontCharacters.length) {
  throw new Error('地图字体子集字符必须与 shared/provinces.json 当前州名字符完全一致');
}
if (mapFontManifest.sourceVersion !== '2.003R' || mapFontManifest.sourceGitBlobSha !== '44d7f0c522ee7e9c6cb373a5ef7e851f30b558a1') {
  throw new Error('地图字体必须保持固定 Source Han Serif 2.003R 来源');
}
if (mapFontManifest.generator?.fonttools !== '4.59.2' || mapFontManifest.generator?.brotli !== '1.1.0') {
  throw new Error('地图字体生成工具版本必须保持固定');
}
if (statSync(mapFontPath).size !== mapFontManifest.sizeBytes || mapFontManifest.sizeBytes > 64 * 1024) {
  throw new Error('地图 WOFF2 子集大小必须与 manifest 一致且不超过 64 KiB');
}
if (mapFontSha256 !== mapFontManifest.sha256) {
  throw new Error('地图 WOFF2 子集 SHA-256 与 manifest 不一致');
}
for (const expected of [
  'SOURCE_VERSION = "2.003R"',
  'SOURCE_GIT_BLOB_SHA = "44d7f0c522ee7e9c6cb373a5ef7e851f30b558a1"',
  'font["head"].modified = font["head"].created',
]) requireText(mapFontGeneratorSource, expected, `地图字体生成器缺少固定约束: ${expected}`);
requireText(mapFontLicenseSource, 'SIL OPEN FONT LICENSE Version 1.1', '地图字体必须随站点发布 OFL 1.1 许可证');

console.log('province map focus verification passed');
