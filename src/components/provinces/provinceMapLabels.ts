import type { EChartsType } from '../charts/echartsCore';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_RING_POINTS = 120;
const TEXT_REFERENCE_FONT_SIZE = 100;
const LABEL_FONT_WEIGHT = 600;
const MIN_RENDERABLE_FONT_SIZE = 0.08;
const BASE_MAX_RENDERABLE_FONT_SIZE = 28;
const CORRIDOR_LENGTH_SAFETY = 0.94;
const CORRIDOR_HEIGHT_SAFETY = 0.82;
const CORRIDOR_PROFILE_STEPS = 10;
const MAX_CURVE_TANGENT_DEGREES = 10;
const GLYPH_BOX_SAFETY = 1.04;
const GEOMETRY_EPSILON = 0.001;
const BOUNDARY_EPSILON = 0.08;
const INTERSECTION_MERGE_EPSILON = 0.04;
const CORRIDOR_OFFSET_FRACTIONS = [0.06, 0.14, 0.22, 0.3, 0.38, 0.46, 0.5, 0.54, 0.62, 0.7, 0.78, 0.86, 0.94];
const CORRIDOR_LENGTH_FRACTIONS = [0.94, 0.84, 0.74, 0.64, 0.54, 0.44, 0.34, 0.26];

export interface ProvinceMapLabelSource {
  provinceId: string;
  provinceName: string;
  anchor: [number, number];
  geometry: unknown;
}

interface PreparedProvinceMapLabelSource extends ProvinceMapLabelSource {
  labelRing: Array<[number, number]>;
}

export interface ProvinceMapLabelRenderer {
  refreshLayout: () => void;
  syncCamera: () => void;
  syncCameraImmediately: () => void;
  updateSelection: () => void;
  destroy: () => void;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface NaturalGlyphMetrics {
  value: string;
  advance: number;
  boxWidth: number;
  boxHeight: number;
}

interface NaturalTextMetrics {
  width: number;
  height: number;
  aspectRatio: number;
  glyphs: NaturalGlyphMetrics[];
}

interface CorridorCandidate {
  center: ScreenPoint;
  direction: ScreenPoint;
  normal: ScreenPoint;
  angle: number;
  availableLength: number;
  availableHeight: number;
  centerOffsets: number[];
  fontScale: number;
  usedWidth: number;
  usedHeight: number;
  score: number;
}

interface GlyphPlacement {
  value: string;
  x: number;
  y: number;
  rotation: number;
  boxWidth: number;
  boxHeight: number;
}

interface LabelLayout {
  fontSize: number;
  strokeWidth: number;
  curved: boolean;
  axisAngle: number;
  naturalAspect: number;
  availableLength: number;
  availableHeight: number;
  usedWidth: number;
  usedHeight: number;
  center: ScreenPoint;
  glyphs: GlyphPlacement[];
}

const textMetricsCache = new Map<string, NaturalTextMetrics>();
let measurementContext: CanvasRenderingContext2D | null = null;

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pointOnSegment(point: ScreenPoint, start: ScreenPoint, end: ScreenPoint) {
  const segment = subtract(end, start);
  const relative = subtract(point, start);
  if (Math.abs(cross(segment, relative)) > BOUNDARY_EPSILON) return false;
  const projection = dot(relative, segment);
  if (projection < -BOUNDARY_EPSILON) return false;
  return projection <= dot(segment, segment) + BOUNDARY_EPSILON;
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
    const total = polygon.reduce((sum, point) => add(sum, point), { x: 0, y: 0 });
    return scale(total, 1 / Math.max(1, polygon.length));
  }
  const divisor = areaFactor * 3;
  return { x: centroidX / divisor, y: centroidY / divisor };
}

function readableAngle(angle: number) {
  let normalized = angle;
  while (normalized > Math.PI / 2) normalized -= Math.PI;
  while (normalized < -Math.PI / 2) normalized += Math.PI;
  const limit = Math.PI * 0.39;
  return clamp(normalized, -limit, limit);
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
    index === 0 || Math.abs(value - intersections[index - 1]) > INTERSECTION_MERGE_EPSILON
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

function intervalContainingZero(intervals: Array<[number, number]>) {
  return intervals.find(([start, end]) => start <= 0 && end >= 0) ?? null;
}

function currentMapZoom(chart: EChartsType) {
  const option = chart.getOption() as { series?: Array<{ id?: string; zoom?: number }> };
  const series = option.series?.find((candidate) => candidate.id === 'us-mainland-map') ?? option.series?.[0];
  const zoom = Number(series?.zoom ?? 1);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function getMeasurementContext() {
  if (measurementContext) return measurementContext;
  const canvas = document.createElement('canvas');
  measurementContext = canvas.getContext('2d');
  return measurementContext;
}

function measureNaturalText(fontFamily: string, text: string): NaturalTextMetrics {
  const cacheKey = `${LABEL_FONT_WEIGHT}|${fontFamily}|${text}`;
  const cached = textMetricsCache.get(cacheKey);
  if (cached) return cached;

  const context = getMeasurementContext();
  if (!context) {
    const glyphs = Array.from(text).map((value) => ({
      value,
      advance: TEXT_REFERENCE_FONT_SIZE,
      boxWidth: TEXT_REFERENCE_FONT_SIZE * 0.9,
      boxHeight: TEXT_REFERENCE_FONT_SIZE,
    }));
    const fallback = {
      width: Math.max(1, glyphs.length * TEXT_REFERENCE_FONT_SIZE),
      height: TEXT_REFERENCE_FONT_SIZE,
      aspectRatio: Math.max(1, glyphs.length),
      glyphs,
    };
    textMetricsCache.set(cacheKey, fallback);
    return fallback;
  }

  context.font = `${LABEL_FONT_WEIGHT} ${TEXT_REFERENCE_FONT_SIZE}px ${fontFamily}`;
  context.textBaseline = 'alphabetic';
  const fullMetrics = context.measureText(text);
  const fullHeight = Number(fullMetrics.actualBoundingBoxAscent || 0)
    + Number(fullMetrics.actualBoundingBoxDescent || 0);
  const glyphs = Array.from(text).map((value) => {
    const metrics = context.measureText(value);
    const actualWidth = Number(metrics.actualBoundingBoxLeft || 0)
      + Number(metrics.actualBoundingBoxRight || 0);
    const actualHeight = Number(metrics.actualBoundingBoxAscent || 0)
      + Number(metrics.actualBoundingBoxDescent || 0);
    return {
      value,
      advance: Math.max(1, Number(metrics.width || TEXT_REFERENCE_FONT_SIZE)),
      boxWidth: Math.max(1, actualWidth || Number(metrics.width || TEXT_REFERENCE_FONT_SIZE) * 0.88),
      boxHeight: Math.max(1, actualHeight || fullHeight || TEXT_REFERENCE_FONT_SIZE * 0.92),
    };
  });
  const summedAdvances = glyphs.reduce((sum, glyph) => sum + glyph.advance, 0);
  const naturalWidth = Math.max(1, Number(fullMetrics.width || 0), summedAdvances);
  const advanceScale = summedAdvances > GEOMETRY_EPSILON ? naturalWidth / summedAdvances : 1;
  for (const glyph of glyphs) glyph.advance *= advanceScale;
  const naturalHeight = Math.max(
    1,
    fullHeight || TEXT_REFERENCE_FONT_SIZE * 0.92,
    ...glyphs.map((glyph) => glyph.boxHeight),
  );
  const measured = {
    width: naturalWidth,
    height: naturalHeight,
    aspectRatio: naturalWidth / naturalHeight,
    glyphs,
  };
  textMetricsCache.set(cacheKey, measured);
  return measured;
}

function corridorProfile(
  polygon: ScreenPoint[],
  start: ScreenPoint,
  end: ScreenPoint,
  direction: ScreenPoint,
) {
  const normal = { x: -direction.y, y: direction.x };
  let minimumClearance = Number.POSITIVE_INFINITY;
  const centerOffsets: number[] = [];
  for (let index = 0; index <= CORRIDOR_PROFILE_STEPS; index += 1) {
    const ratio = index / CORRIDOR_PROFILE_STEPS;
    const sample = add(start, scale(subtract(end, start), ratio));
    const interval = intervalContainingZero(lineInteriorIntervals(polygon, sample, normal));
    if (!interval) return null;
    const clearance = Math.min(-interval[0], interval[1]);
    if (!(clearance > GEOMETRY_EPSILON)) return null;
    minimumClearance = Math.min(minimumClearance, clearance);
    centerOffsets.push((interval[0] + interval[1]) / 2);
  }
  const segmentLength = length(subtract(end, start));
  return {
    availableLength: segmentLength * CORRIDOR_LENGTH_SAFETY,
    availableHeight: minimumClearance * 2 * CORRIDOR_HEIGHT_SAFETY,
    centerOffsets,
  };
}

function corridorScore(
  availableLength: number,
  availableHeight: number,
  metrics: NaturalTextMetrics,
  mapZoom: number,
  centerDistance: number,
) {
  const zoomScaledFontCeiling = BASE_MAX_RENDERABLE_FONT_SIZE * mapZoom;
  const fontScale = Math.min(
    availableLength / metrics.width,
    availableHeight / metrics.height,
    zoomScaledFontCeiling / TEXT_REFERENCE_FONT_SIZE,
  );
  if (!(fontScale > 0)) return null;
  const usedWidth = metrics.width * fontScale;
  const usedHeight = metrics.height * fontScale;
  const corridorAspect = availableLength / Math.max(GEOMETRY_EPSILON, availableHeight);
  const aspectError = Math.abs(Math.log(corridorAspect / metrics.aspectRatio));
  const aspectSimilarity = Math.exp(-aspectError);
  const widthUtilization = usedWidth / availableLength;
  const heightUtilization = usedHeight / availableHeight;
  const utilizationBalance = Math.min(widthUtilization, heightUtilization)
    / Math.max(GEOMETRY_EPSILON, Math.max(widthUtilization, heightUtilization));
  const centerPenalty = 1 / (1 + centerDistance / Math.max(24, availableLength) * 0.08);
  const fontSize = TEXT_REFERENCE_FONT_SIZE * fontScale;
  return {
    fontScale,
    usedWidth,
    usedHeight,
    score: fontSize
      * (0.42 + aspectSimilarity * 0.58)
      * (0.9 + utilizationBalance * 0.1)
      * centerPenalty,
  };
}

function findBestLabelCorridor(
  polygon: ScreenPoint[],
  preferredCenter: ScreenPoint,
  metrics: NaturalTextMetrics,
  mapZoom: number,
): CorridorCandidate | null {
  const center = pointInPolygon(preferredCenter, polygon)
    ? preferredCenter
    : polygonCentroid(polygon);
  const angle = principalAngle(polygon, center);
  const direction = normalize({ x: Math.cos(angle), y: Math.sin(angle) });
  const normal = { x: -direction.y, y: direction.x };
  const offsets = polygon.map((point) => dot(subtract(point, center), normal));
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);
  let best: CorridorCandidate | null = null;

  for (const fraction of CORRIDOR_OFFSET_FRACTIONS) {
    const offset = minOffset + (maxOffset - minOffset) * fraction;
    const origin = add(center, scale(normal, offset));
    for (const [startDistance, endDistance] of lineInteriorIntervals(polygon, origin, direction)) {
      const rawLength = endDistance - startDistance;
      if (!(rawLength > GEOMETRY_EPSILON)) continue;
      const intervalMidpoint = add(origin, scale(direction, (startDistance + endDistance) / 2));
      for (const lengthFraction of CORRIDOR_LENGTH_FRACTIONS) {
        const halfLength = rawLength * lengthFraction / 2;
        const start = add(intervalMidpoint, scale(direction, -halfLength));
        const end = add(intervalMidpoint, scale(direction, halfLength));
        const profile = corridorProfile(polygon, start, end, direction);
        if (!profile || !(profile.availableLength > 0) || !(profile.availableHeight > 0)) continue;
        const scored = corridorScore(
          profile.availableLength,
          profile.availableHeight,
          metrics,
          mapZoom,
          length(subtract(intervalMidpoint, center)),
        );
        if (!scored) continue;
        const candidate: CorridorCandidate = {
          center: intervalMidpoint,
          direction,
          normal,
          angle,
          availableLength: profile.availableLength,
          availableHeight: profile.availableHeight,
          centerOffsets: profile.centerOffsets,
          fontScale: scored.fontScale,
          usedWidth: scored.usedWidth,
          usedHeight: scored.usedHeight,
          score: scored.score,
        };
        if (!best || candidate.score > best.score) best = candidate;
      }
    }
  }
  return best;
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

function buildArcLookup(start: ScreenPoint, control: ScreenPoint, end: ScreenPoint) {
  const samples: Array<{ t: number; point: ScreenPoint; distance: number }> = [];
  let previous = start;
  let totalDistance = 0;
  for (let index = 0; index <= 32; index += 1) {
    const t = index / 32;
    const point = quadraticPoint(start, control, end, t);
    if (index > 0) totalDistance += length(subtract(point, previous));
    samples.push({ t, point, distance: totalDistance });
    previous = point;
  }
  return { samples, totalDistance };
}

function arcPointAtFraction(
  lookup: ReturnType<typeof buildArcLookup>,
  start: ScreenPoint,
  control: ScreenPoint,
  end: ScreenPoint,
  fraction: number,
) {
  const target = lookup.totalDistance * clamp(fraction, 0, 1);
  let upperIndex = lookup.samples.findIndex((sample) => sample.distance >= target);
  if (upperIndex <= 0) upperIndex = 1;
  if (upperIndex < 0) upperIndex = lookup.samples.length - 1;
  const lower = lookup.samples[upperIndex - 1];
  const upper = lookup.samples[upperIndex];
  const span = upper.distance - lower.distance;
  const localRatio = span > GEOMETRY_EPSILON ? (target - lower.distance) / span : 0;
  const t = lower.t + (upper.t - lower.t) * localRatio;
  return {
    point: quadraticPoint(start, control, end, t),
    tangent: quadraticTangent(start, control, end, t),
  };
}

function rotatedGlyphBoxInsidePolygon(
  polygon: ScreenPoint[],
  center: ScreenPoint,
  rotation: number,
  width: number,
  height: number,
) {
  const radians = rotation * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const halfWidth = width * GLYPH_BOX_SAFETY / 2;
  const halfHeight = height * GLYPH_BOX_SAFETY / 2;
  const localSamples: Array<[number, number]> = [
    [-halfWidth, -halfHeight],
    [0, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, 0],
    [halfWidth, halfHeight],
    [0, halfHeight],
    [-halfWidth, halfHeight],
    [-halfWidth, 0],
    [0, 0],
  ];
  return localSamples.every(([x, y]) => pointInPolygon({
    x: center.x + x * cosine - y * sine,
    y: center.y + x * sine + y * cosine,
  }, polygon));
}

function shapeCurveOffsets(candidate: CorridorCandidate, usedWidth: number, usedHeight: number) {
  const offsets = candidate.centerOffsets;
  const first = offsets[0] ?? 0;
  const last = offsets[offsets.length - 1] ?? 0;
  const middle = offsets[Math.floor(offsets.length / 2)] ?? 0;
  const average = offsets.reduce((sum, value) => sum + value, 0) / Math.max(1, offsets.length);
  const spareHalfHeight = Math.max(0, (candidate.availableHeight - usedHeight) / 2);
  const baselineShift = clamp(average * 0.25, -spareHalfHeight * 0.32, spareHalfHeight * 0.32);
  const rawBend = (middle - (first + last) / 2) * 0.35;
  const tangentBound = Math.tan(MAX_CURVE_TANGENT_DEGREES * Math.PI / 180) * usedWidth / 2;
  const maxBend = Math.max(0, Math.min(
    candidate.availableHeight * 0.12,
    usedHeight * 0.5,
    tangentBound,
  ));
  const bend = clamp(rawBend, -maxBend, maxBend);
  return {
    baselineShift,
    bend: Math.abs(bend) >= 0.24 ? bend : 0,
  };
}

function glyphPlacements(
  candidate: CorridorCandidate,
  metrics: NaturalTextMetrics,
  fontScale: number,
  curveFactor: number,
) {
  const usedWidth = metrics.width * fontScale;
  const usedHeight = metrics.height * fontScale;
  const { baselineShift, bend } = shapeCurveOffsets(candidate, usedWidth, usedHeight);
  const curveBend = bend * curveFactor;
  const halfWidth = usedWidth / 2;
  const start = add(
    add(candidate.center, scale(candidate.direction, -halfWidth)),
    scale(candidate.normal, baselineShift),
  );
  const end = add(
    add(candidate.center, scale(candidate.direction, halfWidth)),
    scale(candidate.normal, baselineShift),
  );
  const control = add(
    candidate.center,
    scale(candidate.normal, baselineShift + curveBend),
  );
  const lookup = buildArcLookup(start, control, end);
  let cursor = 0;
  const placements = metrics.glyphs.map((glyph) => {
    const centerRatio = (cursor + glyph.advance / 2) / Math.max(GEOMETRY_EPSILON, metrics.width);
    cursor += glyph.advance;
    const sample = arcPointAtFraction(lookup, start, control, end, centerRatio);
    return {
      value: glyph.value,
      x: sample.point.x,
      y: sample.point.y,
      rotation: Math.atan2(sample.tangent.y, sample.tangent.x) * 180 / Math.PI,
      boxWidth: glyph.boxWidth * fontScale,
      boxHeight: glyph.boxHeight * fontScale,
    };
  });
  return {
    placements,
    usedWidth,
    usedHeight,
    curved: Math.abs(curveBend) >= 0.24,
    center: quadraticPoint(start, control, end, 0.5),
  };
}

function fitLabelLayout(
  polygon: ScreenPoint[],
  candidate: CorridorCandidate,
  metrics: NaturalTextMetrics,
  mapZoom: number,
): LabelLayout | null {
  const minimumScale = MIN_RENDERABLE_FONT_SIZE / TEXT_REFERENCE_FONT_SIZE;
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const fontScale = candidate.fontScale * Math.pow(0.92, attempt);
    if (fontScale < minimumScale) break;
    for (const curveFactor of [1, 0.5, 0]) {
      const placed = glyphPlacements(candidate, metrics, fontScale, curveFactor);
      const fits = placed.placements.every((glyph) => rotatedGlyphBoxInsidePolygon(
        polygon,
        { x: glyph.x, y: glyph.y },
        glyph.rotation,
        glyph.boxWidth,
        glyph.boxHeight,
      ));
      if (!fits) continue;
      const fontSize = TEXT_REFERENCE_FONT_SIZE * fontScale;
      return {
        fontSize,
        strokeWidth: Math.max(0.02, Math.min(0.9 * mapZoom, fontSize * 0.065)),
        curved: placed.curved,
        axisAngle: candidate.angle * 180 / Math.PI,
        naturalAspect: metrics.aspectRatio,
        availableLength: candidate.availableLength,
        availableHeight: candidate.availableHeight,
        usedWidth: placed.usedWidth,
        usedHeight: placed.usedHeight,
        center: placed.center,
        glyphs: placed.placements,
      };
    }
  }
  return null;
}

function createSvgElement<K extends keyof SVGElementTagNameMap>(name: K) {
  return document.createElementNS(SVG_NAMESPACE, name);
}

function formatGeometryValue(value: number) {
  return Number(value.toFixed(2));
}

function renderLabels(
  chart: EChartsType,
  sources: PreparedProvinceMapLabelSource[],
  overlay: SVGSVGElement,
  cameraGroup: SVGGElement,
  selectedProvinceId: string | null,
  fontFamily: string,
) {
  const width = chart.getWidth();
  const height = chart.getHeight();
  if (!(width > 0) || !(height > 0)) return;
  const mapZoom = currentMapZoom(chart);
  const container = chart.getDom();
  overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
  overlay.setAttribute('width', String(width));
  overlay.setAttribute('height', String(height));
  cameraGroup.replaceChildren();
  cameraGroup.removeAttribute('transform');
  let renderedCount = 0;
  let curvedCount = 0;

  for (const source of sources) {
    const geoRing = source.labelRing;
    if (geoRing.length < 3) continue;
    const polygon = projectRing(chart, geoRing);
    if (polygon.length < 3) continue;
    const projectedAnchor = projectCoordinate(chart, source.anchor) ?? polygonCentroid(polygon);
    const metrics = measureNaturalText(fontFamily, source.provinceName);
    const corridor = findBestLabelCorridor(polygon, projectedAnchor, metrics, mapZoom);
    if (!corridor) continue;
    const layout = fitLabelLayout(polygon, corridor, metrics, mapZoom);
    if (!layout) continue;

    const group = createSvgElement('g');
    group.classList.add('province-map-label');
    group.dataset.provinceId = source.provinceId;
    group.dataset.mapStateLabel = source.provinceName;
    group.dataset.labelFit = 'inside';
    group.dataset.labelCurved = layout.curved ? 'true' : 'false';
    group.dataset.labelZoom = mapZoom.toFixed(3);
    group.dataset.labelGlyphMode = 'rigid';
    group.dataset.labelNaturalAspect = layout.naturalAspect.toFixed(4);
    group.dataset.labelAvailableLength = layout.availableLength.toFixed(2);
    group.dataset.labelAvailableHeight = layout.availableHeight.toFixed(2);
    group.dataset.labelUsedWidth = layout.usedWidth.toFixed(2);
    group.dataset.labelUsedHeight = layout.usedHeight.toFixed(2);
    group.dataset.labelAxisAngle = layout.axisAngle.toFixed(2);
    group.dataset.labelCenterX = layout.center.x.toFixed(2);
    group.dataset.labelCenterY = layout.center.y.toFixed(2);
    group.dataset.selected = source.provinceId === selectedProvinceId ? 'true' : 'false';
    group.style.fontSize = `${layout.fontSize.toFixed(2)}px`;
    group.style.strokeWidth = `${layout.strokeWidth.toFixed(2)}px`;

    layout.glyphs.forEach((glyph, index) => {
      const text = createSvgElement('text');
      text.classList.add('province-map-label-glyph');
      text.dataset.glyphIndex = String(index);
      text.dataset.glyphRotation = glyph.rotation.toFixed(2);
      text.dataset.glyphBoxWidth = glyph.boxWidth.toFixed(2);
      text.dataset.glyphBoxHeight = glyph.boxHeight.toFixed(2);
      text.setAttribute('x', '0');
      text.setAttribute('y', '0');
      text.setAttribute('dominant-baseline', 'central');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute(
        'transform',
        `translate(${formatGeometryValue(glyph.x)} ${formatGeometryValue(glyph.y)}) rotate(${formatGeometryValue(glyph.rotation)})`,
      );
      text.textContent = glyph.value;
      group.append(text);
    });

    cameraGroup.append(group);
    renderedCount += 1;
    if (layout.curved) curvedCount += 1;
  }

  container.dataset.mapLabelMode = 'curved-chinese-full-name';
  container.dataset.mapLabelGeometryMode = 'natural-ratio-rigid-glyphs';
  container.dataset.mapLabelCount = String(renderedCount);
  container.dataset.mapCurvedLabelCount = String(curvedCount);
  container.dataset.mapLabelZoom = mapZoom.toFixed(3);
}

function chooseCameraReferenceCoordinates(sources: ProvinceMapLabelSource[]) {
  if (sources.length === 0) return null;
  const first = sources[0].anchor;
  let bestFirst: [number, number] = first;
  let bestSecond: [number, number] = sources[1]?.anchor ?? [first[0] + 1, first[1]];
  let bestDistanceSquared = -1;
  for (let left = 0; left < sources.length; left += 1) {
    for (let right = left + 1; right < sources.length; right += 1) {
      const dx = sources[right].anchor[0] - sources[left].anchor[0];
      const dy = sources[right].anchor[1] - sources[left].anchor[1];
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= bestDistanceSquared) continue;
      bestDistanceSquared = distanceSquared;
      bestFirst = sources[left].anchor;
      bestSecond = sources[right].anchor;
    }
  }
  return [bestFirst, bestSecond] as const;
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
  const cameraGroup = createSvgElement('g');
  cameraGroup.classList.add('province-map-label-camera');
  overlay.append(cameraGroup);
  container.append(overlay);

  const preparedSources: PreparedProvinceMapLabelSource[] = sources.map((source) => ({
    ...source,
    labelRing: largestOuterRing(source.geometry),
  }));
  const referenceCoordinates = chooseCameraReferenceCoordinates(preparedSources);
  let baseCameraReference: {
    firstCoordinate: [number, number];
    secondCoordinate: [number, number];
    firstPixel: ScreenPoint;
    secondPixel: ScreenPoint;
  } | null = null;
  let layoutFrame: number | null = null;
  let cameraFrame: number | null = null;
  let layoutRevision = 0;
  let cameraSyncCount = 0;

  container.dataset.mapLabelCameraMode = 'shared-transform';
  container.dataset.mapLabelLayoutRevision = '0';
  container.dataset.mapLabelCameraSyncCount = '0';
  container.dataset.mapLabelCameraScale = '1.00000';

  const updateSelection = () => {
    if (chart.isDisposed()) return;
    const selected = selectedProvinceId();
    for (const group of cameraGroup.querySelectorAll<SVGGElement>('.province-map-label')) {
      group.dataset.selected = group.dataset.provinceId === selected ? 'true' : 'false';
    }
  };

  const captureBaseCameraReference = () => {
    if (!referenceCoordinates) {
      baseCameraReference = null;
      return;
    }
    const firstPixel = projectCoordinate(chart, referenceCoordinates[0]);
    const secondPixel = projectCoordinate(chart, referenceCoordinates[1]);
    if (!firstPixel || !secondPixel || length(subtract(secondPixel, firstPixel)) <= GEOMETRY_EPSILON) {
      baseCameraReference = null;
      return;
    }
    baseCameraReference = {
      firstCoordinate: referenceCoordinates[0],
      secondCoordinate: referenceCoordinates[1],
      firstPixel,
      secondPixel,
    };
    cameraGroup.removeAttribute('transform');
    container.dataset.mapLabelCameraScale = '1.00000';
    container.dataset.mapLabelZoom = '1.000';
  };

  const renderLayout = () => {
    layoutFrame = null;
    if (chart.isDisposed()) return;
    const fontFamily = getComputedStyle(container).fontFamily || 'sans-serif';
    renderLabels(
      chart,
      preparedSources,
      overlay,
      cameraGroup,
      selectedProvinceId(),
      fontFamily,
    );
    captureBaseCameraReference();
    layoutRevision += 1;
    container.dataset.mapLabelLayoutRevision = String(layoutRevision);
    updateSelection();
  };

  const refreshLayout = () => {
    if (chart.isDisposed() || layoutFrame !== null) return;
    if (cameraFrame !== null) {
      cancelAnimationFrame(cameraFrame);
      cameraFrame = null;
    }
    layoutFrame = requestAnimationFrame(renderLayout);
  };

  const syncCameraNow = () => {
    cameraFrame = null;
    if (chart.isDisposed() || layoutFrame !== null || !baseCameraReference) return;
    const currentFirst = projectCoordinate(chart, baseCameraReference.firstCoordinate);
    const currentSecond = projectCoordinate(chart, baseCameraReference.secondCoordinate);
    if (!currentFirst || !currentSecond) return;
    const baseDistance = length(subtract(baseCameraReference.secondPixel, baseCameraReference.firstPixel));
    const currentDistance = length(subtract(currentSecond, currentFirst));
    if (!(baseDistance > GEOMETRY_EPSILON) || !(currentDistance > GEOMETRY_EPSILON)) return;
    const scaleFactor = currentDistance / baseDistance;
    const firstTranslate = {
      x: currentFirst.x - baseCameraReference.firstPixel.x * scaleFactor,
      y: currentFirst.y - baseCameraReference.firstPixel.y * scaleFactor,
    };
    const secondTranslate = {
      x: currentSecond.x - baseCameraReference.secondPixel.x * scaleFactor,
      y: currentSecond.y - baseCameraReference.secondPixel.y * scaleFactor,
    };
    const translateX = (firstTranslate.x + secondTranslate.x) / 2;
    const translateY = (firstTranslate.y + secondTranslate.y) / 2;
    cameraGroup.setAttribute(
      'transform',
      `matrix(${scaleFactor.toFixed(5)} 0 0 ${scaleFactor.toFixed(5)} ${translateX.toFixed(2)} ${translateY.toFixed(2)})`,
    );
    cameraSyncCount += 1;
    container.dataset.mapLabelCameraSyncCount = String(cameraSyncCount);
    container.dataset.mapLabelCameraScale = scaleFactor.toFixed(5);
    container.dataset.mapLabelZoom = scaleFactor.toFixed(3);
  };

  const syncCamera = () => {
    if (chart.isDisposed() || cameraFrame !== null || layoutFrame !== null) return;
    cameraFrame = requestAnimationFrame(syncCameraNow);
  };

  const syncCameraImmediately = () => {
    if (chart.isDisposed() || layoutFrame !== null) return;
    if (cameraFrame !== null) {
      cancelAnimationFrame(cameraFrame);
      cameraFrame = null;
    }
    syncCameraNow();
  };

  const handleGeoRoam = () => {
    syncCamera();
  };
  chart.on('georoam', handleGeoRoam);
  refreshLayout();
  return {
    refreshLayout,
    syncCamera,
    syncCameraImmediately,
    updateSelection,
    destroy: () => {
      if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
      if (cameraFrame !== null) cancelAnimationFrame(cameraFrame);
      layoutFrame = null;
      cameraFrame = null;
      if (!chart.isDisposed()) chart.off('georoam', handleGeoRoam);
      overlay.remove();
      delete container.dataset.mapLabelMode;
      delete container.dataset.mapLabelGeometryMode;
      delete container.dataset.mapLabelCount;
      delete container.dataset.mapCurvedLabelCount;
      delete container.dataset.mapLabelZoom;
      delete container.dataset.mapLabelCameraMode;
      delete container.dataset.mapLabelLayoutRevision;
      delete container.dataset.mapLabelCameraSyncCount;
      delete container.dataset.mapLabelCameraScale;
    },
  };
}
