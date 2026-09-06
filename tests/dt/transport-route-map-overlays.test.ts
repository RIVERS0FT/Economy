import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const strategicWorkspace = readFileSync('src/components/shell/StrategicWorkspace.tsx', 'utf8');
const mainlandMap = readFileSync('src/components/provinces/UsMainlandMap.tsx', 'utf8');
const mapStyles = readFileSync('src/styles/province-map.css', 'utf8');
const mapDesign = readFileSync('docs/STRATEGIC_MAP_RENDERING_DESIGN.md', 'utf8');

test('strategic map keeps saved transport routes mounted across player pages', () => {
  assert.ok(strategicWorkspace.includes('for (const route of transportRoutes)'));
  assert.ok(strategicWorkspace.includes("kind: route.id === highlightedRouteId ? 'highlight' : 'saved'"));
  assert.equal(strategicWorkspace.includes("if (model.tab === 'transport')"), false);
  assert.equal(strategicWorkspace.includes('model.tab, routeDraft?.draft, transportRoutes'), false);
  assert.ok(mapDesign.includes('玩家实际保存路线组成战略地图常驻路网'));
  assert.ok(mapDesign.includes('不得用 `model.tab` 或页面位置条件隐藏已保存路线'));
});

test('highlighted transport route renders after saved routes and route draft', () => {
  const savedPushIndex = strategicWorkspace.indexOf('else overlays.push(overlay);');
  const draftPushIndex = strategicWorkspace.indexOf("id: `draft-${routeDraft.draft.mode}-route`");
  const highlightedPushIndex = strategicWorkspace.indexOf('if (highlightedOverlay) overlays.push(highlightedOverlay);');

  assert.ok(savedPushIndex >= 0);
  assert.ok(draftPushIndex > savedPushIndex);
  assert.ok(highlightedPushIndex > draftPushIndex);
  assert.ok(mapDesign.includes('路线 path 层内部继续保持普通 saved → draft → highlight'));
});

test('map stroke widths follow settled zoom without adding Camera RAF writes', () => {
  assert.ok(mainlandMap.includes('function updateSettledStrokeScales(container: HTMLElement)'));
  assert.ok(mainlandMap.includes("container.dataset.mapZoomActive === 'true'"));
  assert.ok(mainlandMap.includes("container.style.setProperty('--province-map-route-stroke-scale', routeValue);"));
  assert.ok(mainlandMap.includes("container.style.setProperty('--province-map-boundary-stroke-scale', boundaryValue);"));
  assert.ok(mapStyles.includes('--province-map-route-stroke-scale: .5;'));
  assert.ok(mapStyles.includes('--province-map-boundary-stroke-scale: .65;'));
  assert.ok(mapStyles.includes('stroke-width: calc(2px * var(--province-map-route-stroke-scale));'));
  assert.ok(mapStyles.includes('stroke-width: calc(1px * var(--province-map-boundary-stroke-scale));'));
  assert.ok(mapDesign.includes('routeStrokeScale = 0.5 + 0.5 × t'));
  assert.ok(mapDesign.includes('boundaryStrokeScale = 0.65 + 0.35 × t'));
});

test('route paths are masked below a dedicated node layer', () => {
  const pathLayerIndex = mainlandMap.indexOf('className="province-map-route-path-layer"');
  const nodeLayerIndex = mainlandMap.indexOf('className="province-map-route-node-layer"');
  assert.ok(mainlandMap.includes('className="province-map-route-node-cutout-mask"'));
  assert.ok(mainlandMap.includes("style={{ maskType: 'luminance' }}"));
  assert.ok(mainlandMap.includes('className="province-map-route-node-cutout"'));
  assert.ok(mainlandMap.includes('const routeNodeCutouts = useMemo(() => {'));
  assert.ok(pathLayerIndex >= 0);
  assert.ok(nodeLayerIndex > pathLayerIndex);
  assert.ok(mapDesign.includes('所有路线 path 必须先进入统一的 path 层'));
  assert.ok(mapDesign.includes('节点层必须最后绘制'));
});
