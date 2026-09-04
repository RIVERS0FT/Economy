import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requiredFiles = [
  'src/components/provinces/provinceMapRasterSnapshot.ts',
  'src/components/provinces/provinceMapCamera.ts',
  'src/components/provinces/UsMainlandMap.tsx',
  'src/styles/strategic-map-rendering.css',
  'tests/browser/map-zoom-transient.spec.ts',
  'tests/browser/map-zoom-out-boundary.spec.ts',
  'docs/STRATEGIC_MAP_RENDERING_DESIGN.md',
];
for (const path of requiredFiles) assert.equal(existsSync(path), true, `地图栅格快照缺少文件: ${path}`);

const rasterSource = read('src/components/provinces/provinceMapRasterSnapshot.ts');
for (const text of [
  'sourceSvg.cloneNode(true)',
  'getComputedStyle(source)',
  "new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })",
  "typeof createImageBitmap === 'function'",
  'async function decodeSvgImageElement',
  'URL.createObjectURL(blob)',
  'new Image()',
  'return decodeSvgImageElement(blob);',
  "cloneDetailedFill.style.display = 'none'",
  "cloneLodFill.style.fillOpacity = '.78'",
]) assert.ok(rasterSource.includes(text), `地图栅格快照必须从唯一 SVG 派生并具备浏览器解码回退: ${text}`);
for (const forbidden of [
  "from './provinceMapCamera'",
  "from './provinceMapProjection'",
  'centerX:',
  'centerY:',
  'zoom:',
  'addEventListener(',
  'requestAnimationFrame(',
]) assert.equal(rasterSource.includes(forbidden), false, `地图栅格快照不得拥有第二 Camera 或输入热路径: ${forbidden}`);

const mapSource = read('src/components/provinces/UsMainlandMap.tsx');
assert.equal((mapSource.match(/className="province-map-world-svg"/g) || []).length, 1, '战略地图必须继续只保留一个权威 SVG 世界面');
assert.equal((mapSource.match(/className="province-map-camera-raster"/g) || []).length, 1, '战略地图只能保留一个 active 栅格快照 Canvas');
for (const text of [
  "import { createProvinceMapRasterSnapshot } from './provinceMapRasterSnapshot';",
  'const rasterCanvasRef = useRef<HTMLCanvasElement>(null);',
  "container.dataset.mapRasterMode = 'preloaded-full-world-svg-snapshot';",
  "if (container.dataset.mapZoomActive === 'true') return;",
  'createProvinceMapRasterSnapshot(svg, preloadViewBox, pixelWidth, pixelHeight)',
  "container.dataset.mapRasterReady = 'true';",
  '<canvas ref={rasterCanvasRef} className="province-map-camera-raster" aria-hidden="true" />',
]) assert.ok(mapSource.includes(text), `地图宿主缺少 active 栅格快照边界: ${text}`);
for (const forbidden of [
  'data-map-raster-center',
  'data-map-raster-zoom',
  'onPointerDown={() => raster',
  'onWheel={() => raster',
]) assert.equal(mapSource.includes(forbidden), false, `Canvas 快照不得成为第二套交互 Camera: ${forbidden}`);

const cameraSource = read('src/components/provinces/provinceMapCamera.ts');
for (const text of [
  "const raster = surface.querySelector<HTMLCanvasElement>('.province-map-camera-raster');",
  "container.dataset.mapCameraRasterMode = 'settled-svg-active-raster-snapshot';",
  'container.dataset.mapCameraPreloadViewBox = serializeViewBox(preloadViewFor(currentMetrics));',
  'let transientUsesRaster = false;',
  "transientUsesRaster = container.dataset.mapRasterReady === 'true';",
  'const writeTransientTransform = (transform: string) => {',
  'if (transientUsesRaster) raster.style.transform = transform;',
  'else surface.style.transform = transform;',
  "svg.style.opacity = '0';",
  "svg.style.removeProperty('opacity');",
]) assert.ok(cameraSource.includes(text), `单一 Camera 未正确接入 raster-only transient 边界: ${text}`);
assert.equal(cameraSource.includes('createProvinceMapRasterSnapshot'), false, 'Camera 热路径不得直接生成或更新栅格快照');

const writeCameraStart = cameraSource.indexOf('const writeCamera = () => {');
const writeCameraEnd = cameraSource.indexOf('\n  };', writeCameraStart);
assert.ok(writeCameraStart >= 0 && writeCameraEnd > writeCameraStart, '必须能定位地图 Camera RAF');
const writeCamera = cameraSource.slice(writeCameraStart, writeCameraEnd);
for (const text of [
  'if (transientUsesRaster) raster.style.transform = transientTransformFor(current, metrics);',
  'else surface.style.transform = transientTransformFor(current, metrics);',
]) assert.ok(writeCamera.includes(text), `Camera RAF 必须显式保持 raster-ready／live-SVG 二选一 transform 写入: ${text}`);
for (const forbidden of [
  "svg.setAttribute('viewBox'",
  'createProvinceMapRasterSnapshot',
  'container.dataset',
  'getBoundingClientRect(',
  'setTimeout(',
]) assert.equal(writeCamera.includes(forbidden), false, `Camera RAF 不得恢复额外栅格／DOM 热路径: ${forbidden}`);

const prepareStart = cameraSource.indexOf('const prepareTransientSurface = () => {');
const prepareEnd = cameraSource.indexOf('\n  };', prepareStart);
assert.ok(prepareStart >= 0 && prepareEnd > prepareStart, '必须能定位 Camera active 准备边界');
const prepareTransient = cameraSource.slice(prepareStart, prepareEnd);
for (const text of [
  "transientUsesRaster = container.dataset.mapRasterReady === 'true';",
  'if (transientUsesRaster) {',
  "svg.style.opacity = '0';",
  'writeTransientTransform(transform);',
  'return;',
  "svg.setAttribute('viewBox', serializeViewBox(transientBasisView));",
]) assert.ok(prepareTransient.includes(text), `Camera active 准备缺少 raster-ready／SVG fallback 分流: ${text}`);

const renderingCss = read('src/styles/strategic-map-rendering.css');
for (const text of [
  '.province-map-camera-raster {',
  'transform-origin: 0 0;',
  'opacity: 0;',
  'pointer-events: none;',
  ".province-map-static-viewport[data-map-zoom-active='true']:not([data-map-raster-ready='true']) .province-map-camera-surface",
  ".province-map-static-viewport[data-map-zoom-active='true'][data-map-raster-ready='true'] .province-map-camera-raster",
  'will-change: transform;',
  ".province-map-static-viewport[data-map-zoom-active='true'][data-map-raster-ready='true'] .province-map-world-svg",
  'opacity: 0;',
]) assert.ok(renderingCss.includes(text), `战略地图最终 CSS 缺少 raster-only transient 规则: ${text}`);
assert.ok(renderingCss.includes('.province-map-camera-surface {\n  contain: none;'), 'Camera Surface 必须继续禁用重复 paint containment');
assert.equal(
  renderingCss.includes(".province-map-static-viewport[data-map-zoom-active='true'][data-map-raster-ready='true'] .province-map-world-svg {\n  display: none;"),
  false,
  'raster active 时权威 SVG 必须保留 settled 几何，不得从渲染树移除',
);

const browserSource = read('tests/browser/map-zoom-transient.spec.ts');
for (const text of [
  'waitForRasterReady',
  'data-map-raster-ready',
  'data-map-raster-revision',
  '.province-map-camera-raster',
  "expect(activeBoundary.cameraTransform).toBe('none')",
  "expect(activeBoundary.rasterTransform).not.toBe('none')",
  "expect(activeBoundary.rasterWillChange).toBe('transform')",
  'expect(activeBoundary.viewBox).toBe(baseline.viewBox)',
  "expect(activeBoundary.svgOpacity).toBe('0')",
  "expect(activeBoundary.rasterOpacity).toBe('1')",
  'result.emptyFrameMedianMs * 2 + 8',
  'expect(result.viewBoxMutations).toBe(0)',
  'expect(result.cameraStyleMutations).toBe(0)',
  'expect(result.rasterStyleMutations).toBe(1)',
  'expect(result.diagnosticMutations).toBe(0)',
]) assert.ok(browserSource.includes(text), `地图浏览器回归缺少 raster-only Camera 门禁: ${text}`);

const zoomOutSource = read('tests/browser/map-zoom-out-boundary.spec.ts');
for (const text of [
  'rasterActive',
  'rasterTransform',
  'expect(zoomedInFrame.viewBox).toBe(initialViewBox)',
  'expect(zoomOutActiveFrame.viewBox).toBe(zoomedSettledViewBox)',
  "expect(zoomOutActiveFrame.cameraTransform).toBe('none')",
  "expect(zoomOutActiveFrame.rasterTransform).not.toBe('none')",
  'toHaveCount(48)',
  "toHaveAttribute('data-map-zoom-current', '1.00000')",
]) assert.ok(zoomOutSource.includes(text), `地图 zoom-out 回归缺少 settled SVG + active raster 边界: ${text}`);

const designSource = read('docs/STRATEGIC_MAP_RENDERING_DESIGN.md');
for (const text of [
  '`.province-map-camera-raster` 是唯一允许存在的 active 临时栅格层',
  '不得拥有 center、zoom、world bounds、投影、路线几何或独立时间状态',
  'idle／settled 状态必须由最终根 SVG `viewBox`',
  '直接写浏览器内建的 `style.transform` 一次',
  '在 Camera RAF、wheel/pointermove 热路径或运输 `500ms` tick 中序列化 SVG',
]) assert.ok(designSource.includes(text), `权威地图 DESIGN 缺少栅格快照规则: ${text}`);

console.log('地图 active 栅格快照验证通过：唯一逻辑 Camera 与权威 SVG 保持不变；snapshot ready 时 active RAF 只变换 Canvas，SVG 保持 settled 几何，snapshot 缺失时才回退 live SVG，settle 后提交最终 SVG viewBox。');
