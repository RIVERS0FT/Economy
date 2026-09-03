const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_NODE_PRECISION = 5;
const DEFAULT_SIMPLIFY_TOLERANCE = 0.015;
const DEFAULT_MAX_ROUTE_POINTS = 96;

function coordinateKey([longitude, latitude], precision = DEFAULT_NODE_PRECISION) {
  return `${longitude.toFixed(precision)},${latitude.toFixed(precision)}`;
}

export function haversineDistanceKm(left, right) {
  const lat1 = left[1] * DEG_TO_RAD;
  const lat2 = right[1] * DEG_TO_RAD;
  const deltaLat = (right[1] - left[1]) * DEG_TO_RAD;
  const deltaLon = (right[0] - left[0]) * DEG_TO_RAD;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function polylineLengthKm(coordinates) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) total += haversineDistanceKm(coordinates[index - 1], coordinates[index]);
  return total;
}

function featurePaths(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return [];
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

function validCoordinate(value) {
  return Array.isArray(value) && value.length >= 2 && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
}

function normalizePath(path) {
  return Array.isArray(path)
    ? path.filter(validCoordinate).map((point) => [Number(point[0]), Number(point[1])])
    : [];
}

function ensureNode(graph, id, coordinate) {
  if (!graph.nodes.has(id)) graph.nodes.set(id, { id, coordinate, edges: [] });
  return graph.nodes.get(id);
}

function addUndirectedEdge(graph, fromId, toId, coordinates, weightKm) {
  if (fromId === toId || coordinates.length < 2 || !(weightKm > 0)) return;
  const from = ensureNode(graph, fromId, coordinates[0]);
  const to = ensureNode(graph, toId, coordinates[coordinates.length - 1]);
  from.edges.push({ to: toId, weightKm, coordinates });
  to.edges.push({ to: fromId, weightKm, coordinates: [...coordinates].reverse() });
  graph.edgeCount += 1;
}

export function buildTransportNetworkGraph(features, mode, { nodePrecision = DEFAULT_NODE_PRECISION } = {}) {
  const graph = { mode, nodes: new Map(), edgeCount: 0 };
  for (const feature of features) {
    const paths = featurePaths(feature).map(normalizePath).filter((path) => path.length >= 2);
    if (paths.length < 1) continue;
    const featureKm = Number(feature?.properties?.KM);
    const useRailNodes = mode === 'rail'
      && paths.length === 1
      && feature?.properties?.FRFRANODE != null
      && feature?.properties?.TOFRANODE != null;
    paths.forEach((coordinates, pathIndex) => {
      const fromId = useRailNodes
        ? `rail:${feature.properties.FRFRANODE}`
        : `${mode}:${coordinateKey(coordinates[0], nodePrecision)}`;
      const toId = useRailNodes
        ? `rail:${feature.properties.TOFRANODE}`
        : `${mode}:${coordinateKey(coordinates[coordinates.length - 1], nodePrecision)}`;
      const geometricKm = polylineLengthKm(coordinates);
      const weightKm = Number.isFinite(featureKm) && featureKm > 0 && paths.length === 1
        ? featureKm
        : geometricKm;
      addUndirectedEdge(graph, fromId, toId, coordinates, weightKm || geometricKm || (pathIndex + 1) * 1e-6);
    });
  }
  return graph;
}

export function largestConnectedComponent(graph) {
  const visited = new Set();
  let largest = new Set();
  for (const nodeId of graph.nodes.keys()) {
    if (visited.has(nodeId)) continue;
    const component = new Set();
    const queue = [nodeId];
    visited.add(nodeId);
    while (queue.length > 0) {
      const current = queue.pop();
      component.add(current);
      for (const edge of graph.nodes.get(current)?.edges ?? []) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
    if (component.size > largest.size) largest = component;
  }
  return largest;
}

function planarDistanceSquared(left, right) {
  const meanLatRadians = ((left[1] + right[1]) / 2) * DEG_TO_RAD;
  const dx = (left[0] - right[0]) * Math.cos(meanLatRadians);
  const dy = left[1] - right[1];
  return dx * dx + dy * dy;
}

export function snapCapitalToGraph(graph, capitalCoordinate, allowedNodeIds = null) {
  let best = null;
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  for (const [nodeId, node] of graph.nodes) {
    if (allowedNodeIds && !allowedNodeIds.has(nodeId)) continue;
    const distanceSquared = planarDistanceSquared(capitalCoordinate, node.coordinate);
    if (distanceSquared >= bestDistanceSquared) continue;
    bestDistanceSquared = distanceSquared;
    best = { nodeId, coordinate: node.coordinate, distanceKm: haversineDistanceKm(capitalCoordinate, node.coordinate) };
  }
  if (!best) throw new Error(`TRANSPORT_NETWORK_SNAP_FAILED:${graph.mode}`);
  return best;
}

class MinHeap {
  constructor() { this.items = []; }
  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].distance <= item.distance) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop() {
    if (this.items.length === 0) return null;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length === 0) return first;
    let index = 0;
    while (true) {
      let child = index * 2 + 1;
      if (child >= this.items.length) break;
      if (child + 1 < this.items.length && this.items[child + 1].distance < this.items[child].distance) child += 1;
      if (this.items[child].distance >= last.distance) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return first;
  }
}

export function shortestPathTree(graph, sourceNodeId, targetNodeIds = null) {
  const distances = new Map([[sourceNodeId, 0]]);
  const previous = new Map();
  const heap = new MinHeap();
  heap.push({ nodeId: sourceNodeId, distance: 0 });
  const remainingTargets = targetNodeIds ? new Set(targetNodeIds) : null;
  remainingTargets?.delete(sourceNodeId);
  while (heap.items.length > 0) {
    const current = heap.pop();
    if (!current || current.distance !== distances.get(current.nodeId)) continue;
    if (remainingTargets?.delete(current.nodeId) && remainingTargets.size === 0) break;
    const node = graph.nodes.get(current.nodeId);
    if (!node) continue;
    for (const edge of node.edges) {
      const nextDistance = current.distance + edge.weightKm;
      if (nextDistance >= (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      distances.set(edge.to, nextDistance);
      previous.set(edge.to, { from: current.nodeId, coordinates: edge.coordinates });
      heap.push({ nodeId: edge.to, distance: nextDistance });
    }
  }
  return { distances, previous };
}

function sameCoordinate(left, right) {
  return Math.abs(left[0] - right[0]) < 1e-9 && Math.abs(left[1] - right[1]) < 1e-9;
}

export function reconstructPathCoordinates(tree, sourceNodeId, targetNodeId) {
  if (sourceNodeId === targetNodeId) return [];
  const segments = [];
  let current = targetNodeId;
  while (current !== sourceNodeId) {
    const step = tree.previous.get(current);
    if (!step) return null;
    segments.push(step.coordinates);
    current = step.from;
  }
  segments.reverse();
  const output = [];
  for (const segment of segments) {
    for (const coordinate of segment) {
      if (output.length > 0 && sameCoordinate(output[output.length - 1], coordinate)) continue;
      output.push(coordinate);
    }
  }
  return output;
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  let dx = end[0] - x;
  let dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const t = ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) { x = end[0]; y = end[1]; }
    else if (t > 0) { x += dx * t; y += dy * t; }
  }
  dx = point[0] - x;
  dy = point[1] - y;
  return dx * dx + dy * dy;
}

function simplifyDouglasPeucker(points, tolerance) {
  if (points.length <= 2) return points;
  const squaredTolerance = tolerance * tolerance;
  const markers = new Uint8Array(points.length);
  markers[0] = 1;
  markers[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    let maxDistance = squaredTolerance;
    let index = -1;
    for (let candidate = first + 1; candidate < last; candidate += 1) {
      const distance = squaredSegmentDistance(points[candidate], points[first], points[last]);
      if (distance <= maxDistance) continue;
      index = candidate;
      maxDistance = distance;
    }
    if (index < 0) continue;
    markers[index] = 1;
    if (index - first > 1) stack.push([first, index]);
    if (last - index > 1) stack.push([index, last]);
  }
  return points.filter((_, index) => markers[index]);
}

export function simplifyRouteCoordinates(
  points,
  { tolerance = DEFAULT_SIMPLIFY_TOLERANCE, maxPoints = DEFAULT_MAX_ROUTE_POINTS } = {},
) {
  if (points.length <= 2) return points;
  let currentTolerance = tolerance;
  let simplified = simplifyDouglasPeucker(points, currentTolerance);
  while (simplified.length > maxPoints && currentTolerance < 2) {
    currentTolerance *= 1.5;
    simplified = simplifyDouglasPeucker(points, currentTolerance);
  }
  if (simplified.length <= maxPoints) return simplified;
  const sampled = [simplified[0]];
  const step = (simplified.length - 1) / (maxPoints - 1);
  for (let index = 1; index < maxPoints - 1; index += 1) sampled.push(simplified[Math.round(index * step)]);
  sampled.push(simplified[simplified.length - 1]);
  return sampled;
}

function roundedCoordinate(coordinate) {
  return [Number(coordinate[0].toFixed(5)), Number(coordinate[1].toFixed(5))];
}

export function capitalPairKey(leftId, rightId) {
  return leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`;
}

export function buildCapitalPairRoutes(graph, provinces, options = {}) {
  const component = largestConnectedComponent(graph);
  if (component.size < 2) throw new Error(`TRANSPORT_NETWORK_COMPONENT_TOO_SMALL:${graph.mode}`);
  const capitals = provinces.map((province) => ({
    id: province.id,
    coordinate: [Number(province.capitalLongitude), Number(province.capitalLatitude)],
  }));
  const snaps = new Map(capitals.map((capital) => [capital.id, snapCapitalToGraph(graph, capital.coordinate, component)]));
  const routes = {};
  let maxSnapDistanceKm = 0;
  for (const snap of snaps.values()) maxSnapDistanceKm = Math.max(maxSnapDistanceKm, snap.distanceKm);

  for (let sourceIndex = 0; sourceIndex < capitals.length - 1; sourceIndex += 1) {
    const source = capitals[sourceIndex];
    const sourceSnap = snaps.get(source.id);
    const targets = capitals.slice(sourceIndex + 1);
    const targetNodeIds = new Set(targets.map((target) => snaps.get(target.id).nodeId));
    const tree = shortestPathTree(graph, sourceSnap.nodeId, targetNodeIds);
    for (const target of targets) {
      const targetSnap = snaps.get(target.id);
      let networkCoordinates = reconstructPathCoordinates(tree, sourceSnap.nodeId, targetSnap.nodeId);
      if (networkCoordinates == null) throw new Error(`TRANSPORT_NETWORK_ROUTE_MISSING:${graph.mode}:${source.id}:${target.id}`);
      if (networkCoordinates.length === 0) networkCoordinates = [sourceSnap.coordinate, targetSnap.coordinate];
      const full = [source.coordinate, ...networkCoordinates, target.coordinate];
      const deduped = full.filter((coordinate, index) => index === 0 || !sameCoordinate(coordinate, full[index - 1]));
      const simplified = simplifyRouteCoordinates(deduped, options).map(roundedCoordinate);
      const key = capitalPairKey(source.id, target.id);
      routes[key] = source.id < target.id ? simplified : [...simplified].reverse();
    }
  }
  return { routes, componentNodeCount: component.size, maxSnapDistanceKm };
}
