import assert from 'node:assert/strict';
import test from 'node:test';
import { buildResearchTreeLayout } from '../../src/research/researchTreeLayout.ts';
import { RESEARCH_TECHNOLOGY_CATALOG } from '../../server/src/research-catalog.js';

function samplePath(path: string) {
  const points: { x: number; y: number }[] = [];
  for (const command of path.matchAll(/([MCL])\s*([^MCL]+)/g)) {
    const values = command[2].match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    if (command[1] !== 'C') {
      points.push({ x: values[0], y: values[1] });
      continue;
    }
    const start = points[points.length - 1];
    for (let step = 1; step <= 40; step += 1) {
      const t = step / 40, u = 1 - t;
      points.push({
        x: u ** 3 * start.x + 3 * u ** 2 * t * values[0] + 3 * u * t ** 2 * values[2] + t ** 3 * values[4],
        y: u ** 3 * start.y + 3 * u ** 2 * t * values[1] + 3 * u * t ** 2 * values[3] + t ** 3 * values[5],
      });
    }
  }
  return points;
}

test('research routes remain deterministic, downward, and clear of unrelated node hit areas', () => {
  const layout = buildResearchTreeLayout(RESEARCH_TECHNOLOGY_CATALOG);
  assert.deepEqual(layout, buildResearchTreeLayout(structuredClone(RESEARCH_TECHNOLOGY_CATALOG)));
  assert.equal(layout.nodes.length, RESEARCH_TECHNOLOGY_CATALOG.length);
  assert.equal(layout.edges.length, RESEARCH_TECHNOLOGY_CATALOG.reduce((sum, tech) => sum + tech.prerequisiteTechnologyIds.length, 0));
  for (const edge of layout.edges) {
    const points = samplePath(edge.path);
    for (let i = 1; i < points.length; i += 1) assert.ok(points[i].y > points[i - 1].y, edge.key);
    for (const node of layout.nodes) {
      if (node.id === edge.parentId || node.id === edge.childId) continue;
      assert.ok(points.every(point => Math.abs(point.x - node.x) >= 64 || Math.abs(point.y - node.y) >= 56), `${edge.key} overlaps ${node.id}`);
    }
  }
});

test('research empty catalog and missing prerequisites do not create phantom nodes', () => {
  assert.deepEqual(buildResearchTreeLayout([]).nodes, []);
  const tech = { ...RESEARCH_TECHNOLOGY_CATALOG[0], prerequisiteTechnologyIds: ['missing'] };
  const layout = buildResearchTreeLayout([tech]);
  assert.equal(layout.edges.length, 0);
  assert.equal(layout.nodes[0].depth, 0);
});

test('research catalog routes limit crossings instead of merely moving them between ranks', () => {
  const paths = buildResearchTreeLayout(RESEARCH_TECHNOLOGY_CATALOG).edges.map(edge => samplePath(edge.path));
  type Point = { x: number; y: number };
  const side = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  let crossings = 0;
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      for (let a = 1; a < paths[i].length; a += 1) {
        for (let b = 1; b < paths[j].length; b += 1) {
          const [p, q] = [paths[i][a - 1], paths[i][a]];
          const [r, s] = [paths[j][b - 1], paths[j][b]];
          if (side(p, q, r) * side(p, q, s) < -0.00001 && side(r, s, p) * side(r, s, q) < -0.00001) crossings += 1;
        }
      }
    }
  }
  assert.ok(crossings <= 1, `catalog has ${crossings} crossings`);
});
