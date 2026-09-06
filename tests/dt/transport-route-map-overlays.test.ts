import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const strategicWorkspace = readFileSync('src/components/shell/StrategicWorkspace.tsx', 'utf8');
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
  assert.ok(mapDesign.includes('路线绘制层级固定为普通 saved → draft → highlight'));
});
