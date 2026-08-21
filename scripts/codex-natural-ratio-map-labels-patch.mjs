import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content, 'utf8');
}

function replaceOnce(path, from, to) {
  const source = read(path);
  const first = source.indexOf(from);
  assert.notEqual(first, -1, `${path} missing expected text: ${from.slice(0, 120)}`);
  assert.equal(source.indexOf(from, first + from.length), -1, `${path} expected text is not unique`);
  write(path, source.slice(0, first) + to + source.slice(first + from.length));
}

function replaceRegexOnce(path, pattern, replacement) {
  const source = read(path);
  const matches = [...source.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`))];
  assert.equal(matches.length, 1, `${path} regex expected exactly one match, got ${matches.length}: ${pattern}`);
  write(path, source.replace(pattern, replacement));
}

replaceRegexOnce(
  'docs/UI_DESIGN_SYSTEM.md',
  /ECharts Map 默认 `label` 固定关闭，由同一地图实例上的 SVG `textPath` 非交互标签层绘制；[\s\S]*?小州允许使用极小字号并在放大后自然变大，但不得隐藏为英文简称、移到州外或使用引线。/,
  'ECharts Map 默认 `label` 固定关闭，由同一地图实例上的 SVG 非交互逐字标签层绘制。标签布局必须先只依据当前投影后的州多边形确定州内几何主轴和可读方向，再沿该主轴扫描完整位于州面内部的候选文字走廊并得到可用长度与可用高度；随后使用实际地图字体和固定字重测量中文州全名的自然宽度、自然高度与自然长宽比，以 `min(可用长度 / 自然宽度, 可用高度 / 自然高度)` 为核心等比确定字号，并优先选择走廊长宽比与文字自然长宽比接近且可获得更大等比字号的区域。文字使用长度与高度必须始终保持字体自然长宽比，允许保留州内空白，不得通过 `textLength`、`lengthAdjust="spacingAndGlyphs"`、`scaleX`、`scaleY` 或其他非等比变换把名称强行铺满地块。曲线只允许轻微改变整串名称中各汉字中心的位置和朝向：每个汉字必须作为独立刚性 SVG `text` 字形，只做 `translate + rotate`，自身轮廓不得弯曲、横向压缩或纵向拉伸；相邻汉字转角应平缓，规则州优先直排，细长或弯折州才使用低曲率排布。每个汉字按实际字形包围盒放大安全边距后都必须完整落在州面内部，越界时按“降低曲率 → 整体等比缩小字号”处理，不得单独缩放某个汉字。标签层使用 `pointer-events: none`，不得遮挡州面点击、拖动或 Tooltip；`georoam`、Contain 重置与尺寸变化后必须随地图缩放和平移同步重新投影主轴、走廊和刚性字形，使名称像直接画在地图上一样与地块共同缩放。小州允许使用极小字号并在放大后自然变大，但不得隐藏为英文简称、移到州外或使用引线。',
);

replaceRegexOnce(
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  /ECharts Map 默认 `label` 必须关闭，州名由绑定同一 ECharts 实例的 SVG `textPath` 标签层绘制：[\s\S]*?小州在全图视角允许使用很小字号并随放大自然变大，但不得改回英文州缩写、把名称移到州外、使用引线标签或因移动端断点隐藏整批州名。/,
  'ECharts Map 默认 `label` 必须关闭，州名由绑定同一 ECharts 实例的 SVG 非交互逐字标签层绘制。标签层先根据当前投影后的州多边形独立确定州内主轴和可读方向，再沿主轴扫描完全位于州面内部的文字走廊，分别记录可用长度与可用高度；之后用实际地图字体测量中文州全名的自然宽度、自然高度和自然长宽比，按可用长高共同限制的统一比例等比确定字号，并在候选走廊中优先选择与文字自然长宽比接近的区域。使用的文字长度与高度必须保持自然长宽比，不要求铺满走廊；禁止 `textLength`、`lengthAdjust="spacingAndGlyphs"`、`scaleX`／`scaleY` 和任何会改变汉字自身比例的非等比变换。整体名称需要顺应州形时，只允许把每个汉字作为独立刚性 SVG `text` 沿低曲率中心线重新定位并轻微旋转；单个汉字自身不得弯曲、压扁或拉长，相邻汉字方向变化必须平缓。每个汉字扩大安全边距后的旋转字形盒都必须完整落在州面内部；发生越界时先降低曲率，再统一等比缩小整串字号，不得单独缩放字符。标签层继续设置 `pointer-events: none`，不得拦截州面点击、拖动或 Tooltip，也不得维护第二套地图／相机状态。ECharts `georoam`、Contain 重置和容器尺寸变化后必须重新投影州边界并同步计算主轴、可用走廊、字号和逐字位置，使名称随地图缩放和平移同步变化，视觉上像直接绘制在地图地块上。小州在全图视角允许使用很小字号并随放大自然变大，但不得改回英文州缩写、把名称移到州外、使用引线标签或因移动端断点隐藏整批州名。',
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  `for (const text of [\n  'export function pointInPolygon',\n  'export function longestInteriorChord',\n  'export function quadraticPathInsidePolygon',\n  'export function createProvinceMapLabelRenderer',\n  "document.createElementNS(SVG_NAMESPACE, name)",\n  "createSvgElement('textPath')",\n  "text.dataset.labelFit = 'inside'",\n  "chart.on('georoam', handleGeoRoam)",\n  "container.dataset.mapLabelMode = 'curved-chinese-full-name'",\n  'container.dataset.mapLabelCount',\n  'container.dataset.mapCurvedLabelCount',\n]) assert.ok(mapLabels.includes(text), \`州内中文曲线标签缺少: \${text}\`);\nfor (const forbidden of ['shortName', 'mapName', 'foreignObject', 'pointerdown']) {\n  assert.equal(mapLabels.includes(forbidden), false, \`地图标签层不得恢复英文简称或独立交互: \${forbidden}\`);\n}`,
  `for (const text of [\n  'export function pointInPolygon',\n  'function principalAngle',\n  'function measureNaturalText',\n  'function corridorProfile',\n  'function findBestLabelCorridor',\n  'function rotatedGlyphBoxInsidePolygon',\n  'function glyphPlacements',\n  'export function createProvinceMapLabelRenderer',\n  "document.createElementNS(SVG_NAMESPACE, name)",\n  "createSvgElement('g')",\n  "createSvgElement('text')",\n  "group.dataset.labelFit = 'inside'",\n  "group.dataset.labelGlyphMode = 'rigid'",\n  'group.dataset.labelNaturalAspect',\n  'group.dataset.labelAvailableLength',\n  'group.dataset.labelAvailableHeight',\n  'group.dataset.labelUsedWidth',\n  'group.dataset.labelUsedHeight',\n  'group.dataset.labelAxisAngle',\n  "chart.on('georoam', handleGeoRoam)",\n  "container.dataset.mapLabelMode = 'curved-chinese-full-name'",\n  "container.dataset.mapLabelGeometryMode = 'natural-ratio-rigid-glyphs'",\n  'container.dataset.mapLabelCount',\n  'container.dataset.mapCurvedLabelCount',\n]) assert.ok(mapLabels.includes(text), \`州内中文自然比例标签缺少: \${text}\`);\nfor (const forbidden of [\n  'shortName',\n  'mapName',\n  'foreignObject',\n  'pointerdown',\n  'textPath',\n  'textLength',\n  'lengthAdjust',\n  'spacingAndGlyphs',\n  'scaleX',\n  'scaleY',\n]) {\n  assert.equal(mapLabels.includes(forbidden), false, \`地图标签层不得恢复英文简称、字形拉伸或独立交互: \${forbidden}\`);\n}`,
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  `  '.province-map-label',\n  'pointer-events: none;',`,
  `  '.province-map-label',\n  '.province-map-label-glyph',\n  'pointer-events: none;',`,
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  `  'SVG \`textPath\`',\n  '完整落在州面内部',\n  '随地图缩放和平移同步重算',`,
  `  '州内几何主轴和可读方向',\n  '自然宽度、自然高度与自然长宽比',\n  '每个汉字必须作为独立刚性 SVG \`text\` 字形',\n  '禁止 \`textLength\`',\n  '完整落在州面内部',\n  '随地图缩放和平移同步重新投影',`,
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  `  'SVG \`textPath\` 标签层',\n  '名称与字号随地图缩放和平移同步变化',`,
  `  'SVG 非交互逐字标签层',\n  '自然宽度、自然高度和自然长宽比',\n  '禁止 \`textLength\`',\n  '单个汉字自身不得弯曲、压扁或拉长',\n  '名称随地图缩放和平移同步变化',`,
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  `  'provinceLabelFontSize',\n  'clickProvinceLabel',\n  "getAttribute('data-label-fit')",`,
  `  'provinceLabelFontSize',\n  'clickProvinceLabel',\n  'data-map-label-geometry-mode',\n  'data-label-glyph-mode',\n  'data-label-natural-aspect',\n  'data-label-available-length',\n  'data-label-used-width',\n  "getAttribute('data-label-fit')",`,
);

replaceOnce(
  'scripts/verify-provincial-economy.mjs',
  `for (const forbidden of ["hasText: /^CO$/", "toContain('CA')", "toContain('TX')"]) {`,
  `for (const forbidden of [\n  "hasText: /^CO$/",\n  "toContain('CA')",\n  "toContain('TX')",\n  "locator('textPath')",\n  'spacingAndGlyphs',\n]) {`,
);

const provinceTestPath = 'tests/browser/province-map.spec.ts';
replaceRegexOnce(
  provinceTestPath,
  /async function clickProvinceLabel\(page: Page, provinceId: string\) \{[\s\S]*?\n\}\n\nasync function provinceLabelFontSize/,
  `async function clickProvinceLabel(page: Page, provinceId: string) {\n  const label = page.locator(\`.province-map-label[data-province-id="\${provinceId}"]\`);\n  await expect(label).toBeVisible();\n  const point = await label.evaluate((element) => {\n    const x = Number(element.getAttribute('data-label-center-x'));\n    const y = Number(element.getAttribute('data-label-center-y'));\n    const matrix = element.ownerSVGElement?.getScreenCTM();\n    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {\n      throw new Error('province label center transform is missing');\n    }\n    return {\n      x: matrix.a * x + matrix.c * y + matrix.e,\n      y: matrix.b * x + matrix.d * y + matrix.f,\n    };\n  });\n  await page.mouse.click(point.x, point.y);\n}\n\nasync function provinceLabelFontSize`,
);

replaceOnce(
  provinceTestPath,
  `  await expect(labels.locator('textPath')).toHaveCount(48);`,
  `  await expect(canvas).toHaveAttribute('data-map-label-geometry-mode', 'natural-ratio-rigid-glyphs');\n  await expect(labelOverlay.locator('textPath')).toHaveCount(0);\n  expect(await labels.locator('.province-map-label-glyph').count()).toBeGreaterThan(48);`,
);

replaceOnce(
  provinceTestPath,
  `  expect(fitValues.every((value) => value === 'inside')).toBe(true);\n  const renderedRegionLabels = await labels.allTextContents();`,
  `  expect(fitValues.every((value) => value === 'inside')).toBe(true);\n  const labelGeometry = await labels.evaluateAll((nodes) => nodes.map((node) => ({\n    glyphMode: node.getAttribute('data-label-glyph-mode'),\n    naturalAspect: Number(node.getAttribute('data-label-natural-aspect')),\n    availableLength: Number(node.getAttribute('data-label-available-length')),\n    availableHeight: Number(node.getAttribute('data-label-available-height')),\n    usedWidth: Number(node.getAttribute('data-label-used-width')),\n    usedHeight: Number(node.getAttribute('data-label-used-height')),\n    axisAngle: Number(node.getAttribute('data-label-axis-angle')),\n    glyphTransforms: [...node.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]\n      .map((glyph) => glyph.getAttribute('transform') || ''),\n  })));\n  expect(labelGeometry).toHaveLength(48);\n  for (const geometry of labelGeometry) {\n    expect(geometry.glyphMode).toBe('rigid');\n    expect(Number.isFinite(geometry.axisAngle)).toBe(true);\n    expect(geometry.availableLength).toBeGreaterThan(0);\n    expect(geometry.availableHeight).toBeGreaterThan(0);\n    expect(geometry.usedWidth).toBeGreaterThan(0);\n    expect(geometry.usedHeight).toBeGreaterThan(0);\n    expect(geometry.usedWidth).toBeLessThanOrEqual(geometry.availableLength + 0.6);\n    expect(geometry.usedHeight).toBeLessThanOrEqual(geometry.availableHeight + 0.6);\n    const usedAspect = geometry.usedWidth / geometry.usedHeight;\n    expect(Math.abs(usedAspect - geometry.naturalAspect) / geometry.naturalAspect).toBeLessThan(0.035);\n    expect(geometry.glyphTransforms.length).toBeGreaterThan(0);\n    expect(geometry.glyphTransforms.every((transform) => /^translate\\([^)]*\\) rotate\\([^)]*\\)$/.test(transform))).toBe(true);\n    expect(geometry.glyphTransforms.some((transform) => /scale/i.test(transform))).toBe(false);\n  }\n  const renderedRegionLabels = await labels.allTextContents();`,
);

replaceOnce(
  provinceTestPath,
  `  expect(curvedLabelCount).toBeGreaterThanOrEqual(24);`,
  `  expect(curvedLabelCount).toBeGreaterThan(0);`,
);

const compactHelper = `async function clickMapProvinceLabel(page: import('@playwright/test').Page, provinceName: string) {\n  const label = page.locator('.province-map-label').filter({ hasText: new RegExp(\`^\${provinceName}$\`) });\n  await expect(label).toBeVisible();\n  const point = await label.evaluate((element) => {\n    const x = Number(element.getAttribute('data-label-center-x'));\n    const y = Number(element.getAttribute('data-label-center-y'));\n    const matrix = element.ownerSVGElement?.getScreenCTM();\n    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {\n      throw new Error('province label center transform is missing');\n    }\n    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };\n  });\n  await page.mouse.click(point.x, point.y);\n}`;

for (const path of ['tests/browser/all-pages-preview.spec.ts', 'tests/browser/warehouse-auto-sell.spec.ts']) {
  replaceRegexOnce(
    path,
    /async function clickMapProvinceLabel\(page: import\('@playwright\/test'\)\.Page, provinceName: string\) \{[\s\S]*?\n\}/,
    compactHelper,
  );
}

console.log('natural-ratio state label patch applied');
