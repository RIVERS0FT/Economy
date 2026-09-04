import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requiredFiles = [
  'src/components/provinces/provinceMapRasterSnapshot.ts',
  'src/components/provinces/provinceMapCamera.ts',
  'src/components/provinces/UsMainlandMap.tsx',
  'src/styles/strategic-map-rendering.css',
  'tests/browser/map-zoom-transient.spec.ts',
  'docs/STRATEGIC_MAP_RENDERING_DESIGN.md',
];
for (const path of requiredFiles) assert.equal(existsSync(path), true, `地图栅格快照缺少文件: ${path}`);

const rasterSource = read('src/components/provinces/provinceMapRasterSnapshot.ts');
for (const text of [
  "sourceSvg.cloneNode(true)",
  'getComputedStyle(source)',
  "new Blob([markup], { type: 'image/svg+xml;charset=utf-8' })",
  "typeof createImageBitmap === 'function'",
  "cloneDetailedFill.style.display = 'none'",
  "cloneLodFill.style.fillOpacity = '.78'",
]) assert.ok(rasterSource.includes(text), `地图栅格快照必须从唯一 SVG 派生并内联最终样式: ${text}`);
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
  "container.dataset.mapCameraRasterMode = 'settled-svg-active-raster-snapshot';",
  'container.dataset.mapCameraPreloadViewBox = serializeViewBox(preloadViewFor(currentMetrics));',
  "const rasterReady = container.dataset.mapRasterReady === 'true';",
  "if (rasterReady) svg.style.opacity = '0';",
  "svg.style.removeProperty('opacity');",
  'surface.style.transform = transientTransformFor(current, metrics);',
]) assert.ok(cameraSource.includes(text), `单一 Camera 未正确接入栅格快照边界: ${text}`);
assert.equal(cameraSource.includes('createProvinceMapRasterSnapshot'), false, 'Camera 热路径不得直接生成或更新栅格快照');
const writeCameraStart = cameraSource.indexOf('const writeCamera = () => {');
const writeCameraEnd = cameraSource.indexOf('\n  };', writeCameraStart);
assert.ok(writeCameraStart >= 0 && writeCameraEnd > writeCameraStart, '必须能定位地图 Camera RAF');
const writeCamera = cameraSource.slice(writeCameraStart, writeCameraEnd);
assert.ok(writeCamera.includes('surface.style.transform = transientTransformFor(current, metrics);'), 'Camera RAF 必须继续只直接写唯一 transform');
for (const forbidden of [
  "svg.setAttribute('viewBox'",
  'createProvinceMapRasterSnapshot',
  'canvas',
  'container.dataset',
  'getBoundingClientRect(',
  'setTimeout(',
]) assert.equal(writeCamera.includes(forbidden), false, `Camera RAF 不得恢复额外栅格／DOM 热路径: ${forbidden}`);

const renderingCss = read('src/styles/strategic-map-rendering.css');
for (const text of [
  '.province-map-camera-raster {',
  'opacity: 0;',
  'pointer-events: none;',
  ".province-map-static-viewport[data-map-zoom-active='true'][data-map-raster-ready='true'] .province-map-camera-raster",
  ".province-map-static-viewport[data-map-zoom-active='true'][data-map-raster-ready='true'] .province-map-world-svg",
  'will-change: transform !important;',
]) assert.ok(renderingCss.includes(text), `战略地图最终 CSS 缺少栅格快照可见性规则: ${text}`);
assert.ok(renderingCss.includes('.province-map-camera-surface {\n  contain: none;'), 'Camera Surface 必须继续禁用重复 paint containment');

const browserSource = read('tests/browser/map-zoom-transient.spec.ts');
for (const text of [
  'waitForRasterReady',
  "data-map-raster-ready",
  "data-map-raster-revision",
  ".province-map-camera-raster",
  "expect(activeBoundary.svgOpacity).toBe('0');",
  "expect(activeBoundary.rasterOpacity).toBe('1');",
  'result.emptyFrameMedianMs * 2 + 8',
  'expect(result.viewBoxMutations).toBe(0)',
  'expect(result.cameraStyleMutations).toBe(1)',
  'expect(result.diagnosticMutations).toBe(0)',
]) assert.ok(browserSource.includes(text), `地图浏览器回归缺少栅格 Camera 门禁: ${text}`);

const designSource = read('docs/STRATEGIC_MAP_RENDERING_DESIGN.md');
for (const text of [
  '`.province-map-camera-raster` 是唯一允许存在的 active 临时栅格层',
  '不得拥有 center、zoom、world bounds、投影、路线几何或独立时间状态',
  'idle／settled 状态必须由最终根 SVG `viewBox`',
  '直接写浏览器内建的 `style.transform` 一次',
  '在 Camera RAF、wheel/pointermove 热路径或运输 `500ms` tick 中序列化 SVG',
]) assert.ok(designSource.includes(text), `权威地图 DESIGN 缺少栅格快照规则: ${text}`);

console.log('地图 active 栅格快照验证通过：唯一逻辑 Camera 与权威 SVG 保持不变；Canvas 只缓存 idle 派生的完整世界画面，active RAF 仍只有一次 transform，settle 后立即恢复最终 SVG viewBox。');
