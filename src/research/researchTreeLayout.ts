import type { ResearchTechnologyDefinition } from '../types';

export interface ResearchTreeLayoutNode {
  id: string;
  depth: number;
  x: number;
  y: number;
}

export interface ResearchTreeLayoutEdge {
  key: string;
  parentId: string;
  childId: string;
  path: string;
}

export interface ResearchTreeLayout {
  nodes: ResearchTreeLayoutNode[];
  edges: ResearchTreeLayoutEdge[];
  width: number;
  height: number;
}

export interface ResearchTreeFocus {
  ancestorIds: ReadonlySet<string>;
  directChildIds: ReadonlySet<string>;
  upstreamEdgeKeys: ReadonlySet<string>;
  downstreamEdgeKeys: ReadonlySet<string>;
}

const LAYER_GAP = 164;
const NODE_GAP = 148;
const MIN_WIDTH = 820;
const EDGE_NODE_OFFSET = 52;

function average(values: number[]) {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function technologyDepths(technologies: ResearchTechnologyDefinition[]) {
  const byId = new Map(technologies.map((technology) => [technology.id, technology]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();

  const resolve = (technologyId: string): number => {
    const cached = depths.get(technologyId);
    if (cached !== undefined) return cached;
    const technology = byId.get(technologyId);
    if (!technology || visiting.has(technologyId)) return 0;
    visiting.add(technologyId);
    const parentDepths = technology.prerequisiteTechnologyIds
      .filter((parentId) => byId.has(parentId))
      .map((parentId) => resolve(parentId));
    visiting.delete(technologyId);
    const depth = parentDepths.length > 0 ? Math.max(...parentDepths) + 1 : 0;
    depths.set(technologyId, depth);
    return depth;
  };

  for (const technology of technologies) resolve(technology.id);
  return depths;
}

interface RoutingVertex { id: string; depth: number }

// Long dependencies reserve slots on intermediate ranks so they cannot run
// through unrelated nodes. Virtual vertices never become technologies.
function orderedLayers(technologies: ResearchTechnologyDefinition[], depths: ReadonlyMap<string, number>) {
  const layers: RoutingVertex[][] = Array.from({ length: Math.max(0, ...depths.values()) + 1 }, () => []);
  const routes = new Map<string, string[]>();
  for (const tech of technologies) {
    const depth = depths.get(tech.id) ?? 0;
    layers[depth].push({ id: tech.id, depth });
  }
  for (const tech of technologies) for (const parentId of tech.prerequisiteTechnologyIds) {
    const parentDepth = depths.get(parentId);
    if (parentDepth === undefined) continue;
    const key = `${parentId}->${tech.id}`;
    const route = [parentId];
    for (let depth = parentDepth + 1; depth < (depths.get(tech.id) ?? 0); depth += 1) {
      const id = `route:${key}:${depth}`;
      layers[depth].push({ id, depth });
      route.push(id);
    }
    route.push(tech.id);
    routes.set(key, route);
  }
  const parents = new Map<string, string[]>(), children = new Map<string, string[]>();
  for (const route of routes.values()) route.slice(1).forEach((to, i) => {
    const from = route[i];
    parents.set(to, [...(parents.get(to) ?? []), from]);
    children.set(from, [...(children.get(from) ?? []), to]);
  });
  const positions = () => new Map(layers.flatMap(layer => layer.map((v, i) => [v.id, i] as const)));
  const crossings = () => {
    const pos = positions();
    let count = 0;
    for (const layer of layers.slice(0, -1)) {
      const segments = layer.flatMap(v => (children.get(v.id) ?? []).map(to => ({ from: v.id, to })));
      for (let i = 0; i < segments.length; i += 1) for (let j = i + 1; j < segments.length; j += 1) {
        const a = segments[i], b = segments[j];
        if ((pos.get(a.from)! - pos.get(b.from)!) * (pos.get(a.to)! - pos.get(b.to)!) < 0) count += 1;
      }
    }
    return count;
  };
  let best = layers.map(layer => [...layer]), bestCount = crossings();
  for (let sweep = 0; sweep < 8; sweep += 1) for (const downward of [true, false]) {
    const ranks = layers.map((_, i) => i);
    if (!downward) ranks.reverse();
    for (const depth of ranks) {
      const neighbors = downward ? parents : children, pos = positions();
      const score = (id: string) => average((neighbors.get(id) ?? []).map(n => pos.get(n)!)) ?? pos.get(id)!;
      layers[depth].sort((a, b) => score(a.id) - score(b.id));
      const count = crossings();
      if (count < bestCount) { bestCount = count; best = layers.map(layer => [...layer]); }
    }
  }
  layers.splice(0, layers.length, ...best);
  // Strict improvements only: later passes cannot undo a better ordering.
  let improved = true;
  while (improved) {
    improved = false;
    for (const layer of layers) for (let i = 0; i < layer.length - 1; i += 1) {
      [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
      const count = crossings();
      if (count < bestCount) { bestCount = count; improved = true; }
      else [layer[i], layer[i + 1]] = [layer[i + 1], layer[i]];
    }
  }
  return { layers, routes };
}

export function buildResearchTreeLayout(technologies: ResearchTechnologyDefinition[]): ResearchTreeLayout {
  const depths = technologyDepths(technologies);
  const { layers, routes } = orderedLayers(technologies, depths);
  const width = Math.max(MIN_WIDTH, (Math.max(1, ...layers.map(layer => layer.length)) + 1) * NODE_GAP);
  const height = Math.max(220, (layers.length - 1) * LAYER_GAP + 176);
  const nodeById = new Map<string, ResearchTreeLayoutNode>();
  for (const [depth, layer] of layers.entries()) layer.forEach((vertex, index) => {
    nodeById.set(vertex.id, {
      id: vertex.id, depth,
      x: width / 2 + (index - (layer.length - 1) / 2) * NODE_GAP,
      y: 82 + depth * LAYER_GAP,
    });
  });
  const port = (id: string, otherId: string, incoming: boolean) => {
    const peers = [...routes.values()]
      .filter(route => (incoming ? route[route.length - 1] : route[0]) === id)
      .map(route => nodeById.get(incoming ? route[route.length - 2] : route[1])!)
      .sort((a, b) => a.x - b.x);
    return peers.length < 2 ? 0 : (peers.findIndex(peer => peer.id === otherId) / (peers.length - 1) - 0.5) * 24;
  };
  const edges: ResearchTreeLayoutEdge[] = [];
  for (const [key, route] of routes) {
    const points = route.map(id => nodeById.get(id)!);
    const first = points[0], last = points[points.length - 1];
    let x = first.x + port(first.id, points[1].id, false), y = first.y + EDGE_NODE_OFFSET;
    // Start just below the label, then keep lateral routing in the layer gap.
    let path = `M ${x} ${first.y + 24} L ${x} ${y}`;
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      const endX = point.x + (i === points.length - 1 ? port(last.id, points[i - 1].id, true) : 0);
      const endY = point.y - EDGE_NODE_OFFSET, middleY = (y + endY) / 2;
      path += ` C ${x} ${middleY}, ${endX} ${middleY}, ${endX} ${endY}`;
      x = endX; y = point.y + EDGE_NODE_OFFSET;
      if (i < points.length - 1) path += ` L ${x} ${y}`;
    }
    edges.push({ key, parentId: first.id, childId: last.id, path });
  }
  return {
    nodes: technologies.map(tech => nodeById.get(tech.id)).filter((node): node is ResearchTreeLayoutNode => Boolean(node)),
    edges, width, height,
  };
}

export function buildResearchTreeFocus(
  technologies: ResearchTechnologyDefinition[],
  selectedTechnologyId: string,
): ResearchTreeFocus {
  const byId = new Map(technologies.map((technology) => [technology.id, technology]));
  const children = new Map<string, string[]>();
  for (const technology of technologies) {
    for (const parentId of technology.prerequisiteTechnologyIds) {
      if (!byId.has(parentId)) continue;
      const list = children.get(parentId) ?? [];
      list.push(technology.id);
      children.set(parentId, list);
    }
  }

  const ancestorIds = new Set<string>();
  const visit = (technologyId: string) => {
    const technology = byId.get(technologyId);
    if (!technology) return;
    for (const parentId of technology.prerequisiteTechnologyIds) {
      if (!byId.has(parentId) || ancestorIds.has(parentId)) continue;
      ancestorIds.add(parentId);
      visit(parentId);
    }
  };
  visit(selectedTechnologyId);

  const directChildIds = new Set(children.get(selectedTechnologyId) ?? []);
  const upstreamEdgeKeys = new Set<string>();
  const upstreamTargets = new Set([...ancestorIds, selectedTechnologyId]);
  for (const technologyId of upstreamTargets) {
    const technology = byId.get(technologyId);
    if (!technology) continue;
    for (const parentId of technology.prerequisiteTechnologyIds) {
      if (ancestorIds.has(parentId)) upstreamEdgeKeys.add(`${parentId}->${technologyId}`);
    }
  }
  const downstreamEdgeKeys = new Set([...directChildIds].map((childId) => `${selectedTechnologyId}->${childId}`));

  return { ancestorIds, directChildIds, upstreamEdgeKeys, downstreamEdgeKeys };
}
