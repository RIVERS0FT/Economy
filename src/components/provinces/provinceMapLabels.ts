import type { EChartsType } from '../charts/echartsCore';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_RING_POINTS = 120;
const LABEL_PATH_INSET_RATIO = 0.08;
const LABEL_LENGTH_FILL_RATIO = 0.82;
const LABEL_WIDTH_FACTOR = 1.08;
const LABEL_THICKNESS_RATIO = 0.42;
const LABEL_CURVE_RATIO = 0.09;
const LABEL_CURVE_THICKNESS_RATIO = 0.14;
const LABEL_EDGE_SAMPLE_FACTOR = 0.56;
const MIN_RENDERABLE_FONT_SIZE = 0.55;
const MAX_RENDERABLE_FONT_SIZE = 28;
const GEOMETRY_EPSILON = 0.001;

export interface ProvinceMapLabelSource {
  provinceId: string;
  provinceName: string;
  anchor: [number, number];
  geometry: unknown;
}

export interface ProvinceMapLabelRenderer {
  schedule: () => void;
  destroy: () => void;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface InteriorChord {
  start: ScreenPoint;
  end: ScreenPoint;
  midpoint: ScreenPoint;
  length: number;
  thickness: number;
  angle: number;
}

interface LabelLayout {
  path: string;
  fontSize: number;
  strokeWidth: number;
  letterSpacing: number;
  curved: boolean;
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
}

function normalizeRing(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  const points = value.filter(isCoordinate).map((coordinate) => [
    Number(coordinate[0]),
    Number(coordinate[1]),
  ] as [number, number]);
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  if (points.length <= MAX_RING_POINTS) return points;
  const reduced: Array<[number, number]> = [];
  for (let index = 0; index < MAX_RING_POINTS; index += 1) {
    reduced.push(points[Math.floor((index / MAX_RING_POINTS) * points.length)]);
  }
  return reduced;
}

function outerRings(geometry: unknown) {
  if (!geometry || typeof geometry !== 'object') return [] as Array<Array<[number, number]>>;
  const candidate = geometry as { type?: string; coordinates?: unknown };
  if (candidate.type === 'Polygon' && Array.isArray(candidate.coordinates)) {
    return [normalizeRing(candidate.coordinates[0])].filter((ring) => ring.length >= 3);
  }
  if (candidate.type === 'MultiPolygon' && Array.isArray(candidate.coordinates)) {
    return candidate.coordinates
      .map((polygon) => Array.isArray(polygon) ? normalizeRing(polygon[0]) : [])
      .filter((ring) => ring.length >= 3);
  }
  return [] as Array<Array<[number, number]>>;
}

function ringArea(points: Array<[number, number]>) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
}

function largestOuterRing(geometry: unknown) {
  return outerRings(geometry)
    .sort((left, right) => ringArea(right) - ringArea(left))[0] ?? [];
}

function projectCoordinate(chart: EChartsType, coordinate: [number, number]): ScreenPoint | null {
  const result = chart.convertToPixel({ seriesIndex: 0 }, coordinate) as unknown;
  if (!Array.isArray(result) || result.length < 2) return null;
  const x = Number(result[0]);
  const y = Number(result[1]);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function projectRing(chart: EChartsType, ring: Array<[number, number]>) {
  return ring
    .map((coordinate) => projectCoordinate(chart, coordinate))
    .filter((point): point is ScreenPoint => point !== null);
}

function subtract(left: ScreenPoint, right: ScreenPoint): ScreenPoint {
  return { x: left.x - right.x, y: left.y - right.y };
}

function add(left: ScreenPoint, right: ScreenPoint): ScreenPoint {
  return { x: left.x + right.x, y: left.y + right.y };
}

function scale(point: ScreenPoint, factor: number): ScreenPoint {
  return { x: point.x * factor, y: point.y * factor };
}

function dot(left: ScreenPoint, right: ScreenPoint) {
  return left.x * right.x + left.y * right.y;
}

function cross(left: ScreenPoint, right: ScreenPoint) {
  return left.x * right.y - left.y * right.x;
}

function length(point: ScreenPoint) {
  return Math.hypot(point.x, point.y);
}

function normalize(point: ScreenPoint): ScreenPoint {
  const magnitude = length(point);
  return magnitude > GEOMETRY_EPSILON
    ? { x: point.x / magnitude, y: point.y / magnitude }
    : { x: 1, y: 0 };
}

function pointOnSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const segment = subtract(end, start);
  const relative = subtract(point, start);
  if (Math.abs(cross(segment, relative)) > 0.35) return false;
  const projection = dot(relative, segment);
  if (projection < -0.35) return false;
  return projection <= dot(segment, segment) + 0.35;
}

export function pointInPolygon(point: ScreenPoint, polygon: ScreenPoint[]) {
  let inside = false;
  for (let index = 0, previousIndex = polygon.length - 1; index < polygon.length; previousIndex = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[previousIndex];
    if (pointOnSegment(point, previous, current)) return true;
    const crossesRay = ((current.y > point.y) !== (previous.y > point.y))
      && point.x < ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y) + current.x;
    if (crossesRay) inside = !inside;
  }
  return inside;
}

function polygonCentroid(polygon: ScreenPoint[]) {
  let areaFactor = 0;
  let centroidX = 0;
  let centroidY = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index];
    const next = polygon[(index + 1) % polygon.length];
    const factor = current.x * next.y - next.x * current.y;
    areaFactor += factor;
    centroidX += (current.x + next.x) * factor;
    centroidY += (current.y + next.y) * factor;
  }
  if (Math.abs(areaFactor) <= GEOMETRY_EPSILON) {
    return polygon.reduce((total, point) => add(total, point), { x: 0, y: 0 });
  }
  const divisor = areaFactor * 3;
  return { x: centroidX / divisor, y: centroidY / divisor };
}

function readableAngle(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI / 2) normalized -= Math.PI;
  while (normalized < -Math.PI / 2) normalized += Math.PI;
  const limit = Math.PI * 0.39;
  return Math.max(-limit, Math.min(limit, normalized));
}

function principalAngle(polygon: ScreenPoint[], center: ScreenPoint) {
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const point of polygon) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  return readableAngle(0.5 * Math.atan2(2 * xy, xx - yy));
}

function lineInteriorIntervals(
  polygon: ScreenPoint[],
  origin: ScreenPoint,
  direction: ScreenPoint,
) {
  const intersections: number[] = [];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const edge = subtract(end, start);
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) <= GEOMETRY_EPSILON) continue;
    const relative = subtract(start, origin);
    const edgeRatio = cross(relative, direction) / denominator;
    if (edgeRatio < -GEOMETRY_EPSILON || edgeRatio > 1 + GEOMETRY_EPSILON) continue;
    intersections.push(cross(relative, edge) / denominator);
  }
  intersections.sort((left, right) => left - right);
  const unique = intersections.filter((value, index) => (
    index === 0 || Math.abs(value - intersections[index - 1]) > 0.45
  ));
  const intervals: Array<[number, number]> = [];
  for (let index = 0; index + 1 < unique.length; index += 1) {
    const start = unique[index];
    const end = unique[index + 1];
    if (end - start <= GEOMETRY_EPSILON) continue;
    const midpoint = add(origin, scale(direction, (start + end) / 2));
    if (pointInPolygon(midpoint, polygon)) intervals.push([start, end]);
  }
  return intervals;
}

function intervalContainingOrigin(intervals: Array<[number, number]>) {
  return intervals.find(([start, end]) => start <= 0 && end >= 0)
    ?? intervals.sort((left, right) => (right[1] - right[0]) - (left[1] - left[0]))[0]
    ?? null;
}

function chordThickness(polygon: ScreenPoint[], midpoint: ScreenPoint, direction: ScreenPoint) {
  const normal = { x: -direction.y, y: direction.x };
  const interval = intervalContainingOrigin(lineInteriorIntervals(polygon, midpoint, normal));
  return interval ? Math.max(0, interval[1] - interval[0]) : 0;
}

function chordForAngle(polygon: ScreenPoint[], center: ScreenPoint, angle: number): InteriorChord | null {
  const direction = normalize({ x: Math.cos(angle), y: Math.sin(angle) });
  const normal = { x: -direction.y, y: direction.x };
  const offsets = polygon.map((point) => dot(subtract(point, center), normal));
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);
  let best: InteriorChord | null = null;
  for (const fraction of [0.12, 0.24, 0.36, 0.5, 0.64, 0.76, 0.88]) {
    const offset = minOffset + (maxOffset - minOffset) * fraction;
    const origin = add(center, scale(normal, offset));
    for (const [startDistance, endDistance] of lineInteriorIntervals(polygon, origin, direction)) {
      const chordLength = endDistance - startDistance;
      if (chordLength <= GEOMETRY_EPSILON) continue;
      const start = add(origin, scale(direction, startDistance));
      const end = add(origin, scale(direction, endDistance));
      const midpoint = add(origin, scale(direction, (startDistance + endDistance) / 2));
      const thickness = chordThickness(polygon, midpoint, direction);
      const candidate = { start, end, midpoint, length: chordLength, thickness, angle };
      const candidateScore = chordLength * Math.sqrt(Math.max(1, thickness));
      const bestScore = best ? best.length * Math.sqrt(Math.max(1, best.thickness)) : -1;
      if (candidateScore > bestScore) best = candidate;
    }
  }
  return best;
}

export function longestInteriorChord(polygon: ScreenPoint[], preferredCenter: ScreenPoint) {
  const center = pointInPolygon(preferredCenter, polygon)
    ? preferredCenter
    : polygonCentroid(polygon);
  const principal = principalAngle(polygon, center);
  const angles = [
    principal,
    principal - Math.PI / 18,
    principal + Math.PI / 18,
    principal - Math.PI / 10,
    principal + Math.PI / 10,
    0,
    -Math.PI / 12,
    Math.PI / 12,
  ].map(readableAngle);
  const uniqueAngles = angles.filter((angle, index) => (
    index === 0 || angles.slice(0, index).every((candidate) => Math.abs(candidate - angle) > 0.035)
  ));
  return uniqueAngles
    .map((angle) => chordForAngle(polygon, center, angle))
    .filter((candidate): candidate is InteriorChord => candidate !== null)
    .sort((left, right) => (
      right.length * Math.sqrt(Math.max(1, right.thickness))
      - left.length * Math.sqrt(Math.max(1, left.thickness))
    ))[0] ?? null;
}

function quadraticPoint(start: ScreenPoint, control: ScreenPoint, end: ScreenPoint, t: number) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

function quadraticTangent(start: ScreenPoint, control: ScreenPoint, end: ScreenPoint, t: number) {
  return normalize({
    x: 2 * (1 - t) * (control.x - start.x) + 2 * t * (end.x - control.x),
    y: 2 * (1 - t) * (control.y - start.y) + 2 * t * (end.y - control.y),
  });
}

export function quadraticPathInsidePolygon(
  polygon: ScreenPoint[],
  start: ScreenPoint,
  control: ScreenPoint,
  end: ScreenPoint,
  fontSize: number,
) {
  const edgeOffset = fontSize * LABEL_EDGE_SAMPLE_FACTOR;
  for (let index = 0; index <= 18; index += 1) {
    const t = index / 18;
    const point = quadraticPoint(start, control, end, t);
    const tangent = quadraticTangent(start, control, end, t);
    const normal = { x: -tangent.y, y: tangent.x };
    if (!pointInPolygon(point, polygon)) return false;
    if (!pointInPolygon(add(point, scale(normal, edgeOffset)), polygon)) return false;
    if (!pointInPolygon(add(point, scale(normal, -edgeOffset)), polygon)) return false;
  }
  return true;
}

function pathData(start: ScreenPoint, control: ScreenPoint, end: ScreenPoint) {
  const value = (number: number) => Number(number.toFixed(2));
  return `M ${value(start.x)} ${value(start.y)} Q ${value(control.x)} ${value(control.y)} ${value(end.x)} ${value(end.y)}`;
}

function fitLabelLayout(polygon: ScreenPoint[], anchor: ScreenPoint, provinceName: string): LabelLayout | null {
  const chord = longestInteriorChord(polygon, anchor);
  if (!chord || chord.length <= GEOMETRY_EPSILON || chord.thickness <= GEOMETRY_EPSILON) return null;
  const direction = normalize(subtract(chord.end, chord.start));
  const normal = { x: -direction.y, y: direction.x };
  const characterCount = Math.max(1, Array.from(provinceName).length);
  let fontSize = Math.min(
    MAX_RENDERABLE_FONT_SIZE,
    chord.length * LABEL_LENGTH_FILL_RATIO / (characterCount * LABEL_WIDTH_FACTOR),
    chord.thickness * LABEL_THICKNESS_RATIO,
  );
  if (!(fontSize > 0)) return null;
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const inset = Math.min(
      chord.length * 0.18,
      Math.max(chord.length * LABEL_PATH_INSET_RATIO, fontSize * 0.65),
    );
    let start = add(chord.start, scale(direction, inset));
    let end = add(chord.end, scale(direction, -inset));
    if (end.x < start.x) [start, end] = [end, start];
    const midpoint = scale(add(start, end), 0.5);
    const amplitude = Math.min(
      chord.length * LABEL_CURVE_RATIO,
      chord.thickness * LABEL_CURVE_THICKNESS_RATIO,
    );
    for (const curveFactor of [1, -1, 0.6, -0.6, 0.3, -0.3, 0]) {
      const control = add(midpoint, scale(normal, amplitude * curveFactor));
      if (!quadraticPathInsidePolygon(polygon, start, control, end, fontSize)) continue;
      return {
        path: pathData(start, control, end),
        fontSize: Math.max(MIN_RENDERABLE_FONT_SIZE, fontSize),
        strokeWidth: Math.max(0.14, Math.min(0.9, fontSize * 0.065)),
        letterSpacing: Math.max(0, fontSize * 0.025),
        curved: Math.abs(amplitude * curveFactor) >= 0.45,
      };
    }
    fontSize *= 0.82;
  }
  return null;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K) {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}

function renderLabels(
  chart: EChartsType,
  sources: ProvinceMapLabelSource[],
  overlay: SVGSVGElement,
  selectedProvinceId: string | null,
) {
  const width = chart.getWidth();
  const height = chart.getHeight();
  if (!(width > 0) || !(height > 0)) return;
  overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
  overlay.setAttribute('width', String(width));
  overlay.setAttribute('height', String(height));
  overlay.replaceChildren();
  const defs = createSvgElement('defs');
  overlay.append(defs);
  let renderedCount = 0;
  let curvedCount = 0;
  for (const source of sources) {
    const geoRing = largestOuterRing(source.geometry);
    if (geoRing.length < 3) continue;
    const polygon = projectRing(chart, geoRing);
    if (polygon.length < 3) continue;
    const projectedAnchor = projectCoordinate(chart, source.anchor) ?? polygonCentroid(polygon);
    const layout = fitLabelLayout(polygon, projectedAnchor, source.provinceName);
    if (!layout) continue;
    const pathId = `province-map-label-${safeId(source.provinceId)}`;
    const path = createSvgElement('path');
    path.setAttribute('id', pathId);
    path.setAttribute('d', layout.path);
    defs.append(path);

    const text = createSvgElement('text');
    text.classList.add('province-map-label');
    text.dataset.provinceId = source.provinceId;
    text.dataset.labelFit = 'inside';
    text.dataset.labelCurved = layout.curved ? 'true' : 'false';
    text.dataset.selected = source.provinceId === selectedProvinceId ? 'true' : 'false';
    text.style.fontSize = `${layout.fontSize.toFixed(2)}px`;
    text.style.strokeWidth = `${layout.strokeWidth.toFixed(2)}px`;
    text.style.letterSpacing = `${layout.letterSpacing.toFixed(2)}px`;
    text.setAttribute('dominant-baseline', 'central');

    const textPath = createSvgElement('textPath');
    textPath.setAttribute('href', `#${pathId}`);
    textPath.setAttribute('startOffset', '50%');
    textPath.setAttribute('text-anchor', 'middle');
    textPath.setAttribute('method', 'align');
    textPath.setAttribute('spacing', 'auto');
    textPath.textContent = source.provinceName;
    text.append(textPath);
    overlay.append(text);
    renderedCount += 1;
    if (layout.curved) curvedCount += 1;
  }
  const container = chart.getDom();
  container.dataset.mapLabelMode = 'curved-chinese-full-name';
  container.dataset.mapLabelCount = String(renderedCount);
  container.dataset.mapCurvedLabelCount = String(curvedCount);
}

export function createProvinceMapLabelRenderer(
  chart: EChartsType,
  sources: ProvinceMapLabelSource[],
  selectedProvinceId: () => string | null,
): ProvinceMapLabelRenderer {
  const container = chart.getDom();
  const existing = container.querySelector<SVGSVGElement>(':scope > .province-map-label-overlay');
  existing?.remove();
  const overlay = createSvgElement('svg');
  overlay.classList.add('province-map-label-overlay');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('focusable', 'false');
  container.append(overlay);
  let frame: number | null = null;
  const render = () => {
    frame = null;
    if (chart.isDisposed()) return;
    renderLabels(chart, sources, overlay, selectedProvinceId());
  };
  const schedule = () => {
    if (frame !== null || chart.isDisposed()) return;
    frame = requestAnimationFrame(render);
  };
  const handleGeoRoam = () => schedule();
  chart.on('georoam', handleGeoRoam);
  schedule();
  return {
    schedule,
    destroy: () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (!chart.isDisposed()) chart.off('georoam', handleGeoRoam);
      overlay.remove();
      delete container.dataset.mapLabelMode;
      delete container.dataset.mapLabelCount;
      delete container.dataset.mapCurvedLabelCount;
    },
  };
}
