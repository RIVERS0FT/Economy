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

function curvePath(x1: number, y1: number, x2: number, y2: number) {
  const startY = y1 + EDGE_NODE_OFFSET;
  const endY = y2 - EDGE_NODE_OFFSET;
  const middleY = (startY + endY) / 2;
  return `M ${x1} ${startY} C ${x1} ${middleY}, ${x2} ${middleY}, ${x2} ${endY}`;
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

function orderedLayers(technologies: ResearchTechnologyDefinition[], depths: ReadonlyMap<string, number>) {
  const catalogOrder = new Map(technologies.map((technology, index) => [technology.id, index]));
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

  const maxDepth = Math.max(0, ...depths.values());
  const layers = Array.from({ length: maxDepth + 1 }, (_, depth) => (
    technologies
      .filter((technology) => depths.get(technology.id) === depth)
      .sort((a, b) => (catalogOrder.get(a.id) ?? 0) - (catalogOrder.get(b.id) ?? 0))
  ));

  const normalizedPositions = () => {
    const positions = new Map<string, number>();
    for (const layer of layers) {
      const denominator = Math.max(1, layer.length - 1);
      layer.forEach((technology, index) => positions.set(technology.id, layer.length === 1 ? 0.5 : index / denominator));
    }
    return positions;
  };

  for (let sweep = 0; sweep < 2; sweep += 1) {
    let positions = normalizedPositions();
    for (let depth = 1; depth < layers.length; depth += 1) {
      layers[depth].sort((a, b) => {
        const aScore = average(a.prerequisiteTechnologyIds.map((id) => positions.get(id)).filter((value): value is number => value !== undefined));
        const bScore = average(b.prerequisiteTechnologyIds.map((id) => positions.get(id)).filter((value): value is number => value !== undefined));
        if (aScore !== null && bScore !== null && aScore !== bScore) return aScore - bScore;
        if (aScore !== null && bScore === null) return -1;
        if (aScore === null && bScore !== null) return 1;
        return (catalogOrder.get(a.id) ?? 0) - (catalogOrder.get(b.id) ?? 0);
      });
      positions = normalizedPositions();
    }

    positions = normalizedPositions();
    for (let depth = layers.length - 2; depth >= 0; depth -= 1) {
      layers[depth].sort((a, b) => {
        const aScore = average((children.get(a.id) ?? []).map((id) => positions.get(id)).filter((value): value is number => value !== undefined));
        const bScore = average((children.get(b.id) ?? []).map((id) => positions.get(id)).filter((value): value is number => value !== undefined));
        if (aScore !== null && bScore !== null && aScore !== bScore) return aScore - bScore;
        if (aScore !== null && bScore === null) return -1;
        if (aScore === null && bScore !== null) return 1;
        return (catalogOrder.get(a.id) ?? 0) - (catalogOrder.get(b.id) ?? 0);
      });
      positions = normalizedPositions();
    }
  }

  return layers;
}

export function buildResearchTreeLayout(technologies: ResearchTechnologyDefinition[]): ResearchTreeLayout {
  const depths = technologyDepths(technologies);
  const layers = orderedLayers(technologies, depths);
  const maxLayerSize = Math.max(1, ...layers.map((layer) => layer.length));
  const width = Math.max(MIN_WIDTH, maxLayerSize * NODE_GAP);
  const height = Math.max(220, (layers.length - 1) * LAYER_GAP + 176);
  const nodeById = new Map<string, ResearchTreeLayoutNode>();

  for (const [depth, layer] of layers.entries()) {
    layer.forEach((technology, index) => {
      nodeById.set(technology.id, {
        id: technology.id,
        depth,
        x: width * ((index + 1) / (layer.length + 1)),
        y: 82 + depth * LAYER_GAP,
      });
    });
  }

  const edges: ResearchTreeLayoutEdge[] = [];
  for (const technology of technologies) {
    const child = nodeById.get(technology.id);
    if (!child) continue;
    for (const parentId of technology.prerequisiteTechnologyIds) {
      const parent = nodeById.get(parentId);
      if (!parent) continue;
      edges.push({
        key: `${parentId}->${technology.id}`,
        parentId,
        childId: technology.id,
        path: curvePath(parent.x, parent.y, child.x, child.y),
      });
    }
  }

  return {
    nodes: technologies.map((technology) => nodeById.get(technology.id)).filter((node): node is ResearchTreeLayoutNode => Boolean(node)),
    edges,
    width,
    height,
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
