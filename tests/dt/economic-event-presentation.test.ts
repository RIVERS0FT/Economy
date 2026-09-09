import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  ECONOMIC_EVENT_TEMPLATE_IDS, GLOBAL_EVENT_MAP_COORDINATE, economicEventAnchor,
  economicEventMapVisible, economicEventPhase, economicEventScopeLabel,
  layoutEconomicEventMarkers, presentEconomicEvents,
  type PresentedEconomicEvent,
} from '../../src/economic-events/presentation.ts';
import type { PublicProjectView } from '../../src/public-projects/types.ts';

function event(id = 'event', extra: Partial<PresentedEconomicEvent> = {}): PresentedEconomicEvent {
  return { id, templateId: 'festival-catering', title: '节庆餐饮季', description: '公开事件',
    announcedAt: 100, startsAt: 200, endsAt: 300, rampMs: 0, classLabels: ['食品'], productIds: ['fruit'], ...extra };
}
const capitals = new Map([['US-TX', { x: 100, y: 200 }], ['US-NY', { x: 500, y: 50 }]]);
const globalPoint = { x: 300, y: 100 };

test('each demand template and public project has a distinct approved illustration and a fallback', () => {
  const source = readFileSync(new URL('../../src/economic-events/artwork.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../../server/src/economic-events.js', import.meta.url), 'utf8');
  for (const id of ECONOMIC_EVENT_TEMPLATE_IDS) {
    assert.ok(server.includes(`id: '${id}'`));
    assert.ok(source.includes(`'${id}':`));
  }
  assert.ok(source.includes("'public-project': project"));
  assert.ok(source.includes('ECONOMIC_EVENT_FALLBACK_ARTWORK'));
  const paths = [...source.matchAll(/from '(\.\.\/assets\/facility-icons\/[^']+\.png)'/g)].map((match) => match[1]);
  assert.equal(new Set(paths).size, 7);
  for (const path of paths) {
    const png = readFileSync(new URL(`../../src/economic-events/${path}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 1024);
  }
});

test('announcement and start/end boundaries only control presentation', () => {
  const source = event();
  const before = structuredClone(source);
  assert.equal(economicEventMapVisible(source, 99), false);
  assert.equal(economicEventMapVisible(source, 100), true);
  assert.equal(economicEventPhase(source, 199), 'upcoming');
  assert.equal(economicEventPhase(source, 200), 'active');
  assert.equal(economicEventMapVisible(source, 299), true);
  assert.equal(economicEventMapVisible(source, 300), false);
  assert.equal(economicEventPhase(source, 300), 'completed');
  for (const value of [NaN, Infinity, 100]) assert.equal(economicEventMapVisible(event('bad', { endsAt: value }), 150), false);
  assert.deepEqual(source, before);
});

test('global display anchor never changes the nationwide scope; missing regions do not get fake coordinates', () => {
  assert.deepEqual(GLOBAL_EVENT_MAP_COORDINATE, [-98.5, 38.5]);
  assert.deepEqual(economicEventAnchor(event(), capitals, globalPoint), globalPoint);
  assert.equal(economicEventScopeLabel(event()), '全国生效');
  const regional = event('regional', { scope: 'regional', provinceId: 'US-TX', provinceName: '得克萨斯州' });
  assert.deepEqual(economicEventAnchor(regional, capitals, globalPoint), capitals.get('US-TX'));
  assert.equal(economicEventScopeLabel(regional), '得克萨斯州');
  assert.equal(economicEventAnchor({ ...regional, provinceId: 'missing' }, capitals, globalPoint), null);
});

test('more than four collocated markers remain reachable, deterministic and separated at every scale', () => {
  const events = Array.from({ length: 24 }, (_, index) => event(`event-${index}`));
  for (const scale of [0.25, 1, 3, NaN]) {
    const markers = layoutEconomicEventMarkers(events, capitals, globalPoint, scale);
    const unit = Number.isFinite(scale) ? scale : 1;
    assert.equal(markers.length, 24);
    assert.deepEqual(markers, layoutEconomicEventMarkers([...events].reverse(), capitals, globalPoint, scale));
    for (let i = 0; i < markers.length; i += 1) {
      assert.deepEqual(markers[i].anchor, globalPoint);
      for (const other of markers.slice(i + 1)) assert.ok(
        Math.abs(markers[i].position.x - other.position.x) >= 48 * unit - 0.00001
        || Math.abs(markers[i].position.y - other.position.y) >= 48 * unit - 0.00001,
      );
    }
  }
});

test('project rows reuse their existing ID and authoritative province rather than duplicating a nationwide event', () => {
  const project = { id: 'project-1', provinceId: 'US-TX', provinceName: '得克萨斯州', title: '公共工程',
    description: '项目说明', announcedAt: 100, startsAt: 200, endsAt: 300, status: 'active', goals: [{ productId: 'steel' }] } as PublicProjectView;
  const row = event('public-project-event:project-1', { templateId: 'public-project' });
  const presented = presentEconomicEvents([row, row], [project]);
  assert.equal(presented.length, 1);
  assert.equal(presented[0].id, row.id);
  assert.deepEqual(economicEventAnchor(presented[0], capitals, globalPoint), capitals.get('US-TX'));
  assert.equal(economicEventScopeLabel(presented[0]), '得克萨斯州 · 全服参与');
  assert.equal(presentEconomicEvents([], [project]).length, 1);
  assert.equal(economicEventMapVisible({ ...presented[0], project: { ...project, status: 'completed' } }, 220), false);
  assert.equal(economicEventAnchor(row, capitals, globalPoint), null);
  assert.equal(economicEventScopeLabel(row), '公共项目 · 地点待同步');
  assert.deepEqual(presentEconomicEvents([]), []);
});
