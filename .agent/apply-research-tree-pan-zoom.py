from pathlib import Path

root = Path('.')

def read(path):
    return (root / path).read_text(encoding='utf-8')

def write(path, content):
    target = root / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')

def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one marker, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))

layout = r'''import type { ResearchTechnologyDefinition } from '../types';

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
'''
write('src/research/researchTreeLayout.ts', layout)

viewport = r'''import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react';

interface ViewportPoint {
  x: number;
  y: number;
}

interface ResearchTreeViewportProps {
  width: number;
  height: number;
  focusPoint?: ViewportPoint;
  children: ReactNode;
}

interface ViewportState {
  panX: number;
  panY: number;
  zoom: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.6;
const PAN_VISIBLE_MARGIN = 64;
const FOCUS_VISIBLE_MARGIN = 88;
const DRAG_THRESHOLD = 6;
const KEYBOARD_PAN_STEP = 56;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function defaultZoomForWidth(viewportWidth: number) {
  return clamp(viewportWidth / 980, 0.55, 1);
}

export function clampResearchTreeViewport(
  state: ViewportState,
  viewport: ViewportSize,
  world: ViewportSize,
): ViewportState {
  const scaledWidth = world.width * state.zoom;
  const scaledHeight = world.height * state.zoom;
  let panX = state.panX;
  let panY = state.panY;

  if (scaledWidth <= viewport.width) {
    panX = (viewport.width - scaledWidth) / 2;
  } else {
    panX = clamp(panX, PAN_VISIBLE_MARGIN - scaledWidth, viewport.width - PAN_VISIBLE_MARGIN);
  }

  if (scaledHeight <= viewport.height) {
    panY = (viewport.height - scaledHeight) / 2;
  } else {
    panY = clamp(panY, PAN_VISIBLE_MARGIN - scaledHeight, viewport.height - PAN_VISIBLE_MARGIN);
  }

  return { ...state, panX, panY };
}

export function zoomResearchTreeAtPoint(
  state: ViewportState,
  anchor: ViewportPoint,
  nextZoom: number,
): ViewportState {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
  const worldX = (anchor.x - state.panX) / state.zoom;
  const worldY = (anchor.y - state.panY) / state.zoom;
  return {
    zoom,
    panX: anchor.x - worldX * zoom,
    panY: anchor.y - worldY * zoom,
  };
}

function centeredState(
  point: ViewportPoint,
  zoom: number,
  viewport: ViewportSize,
  world: ViewportSize,
) {
  return clampResearchTreeViewport({
    zoom,
    panX: viewport.width / 2 - point.x * zoom,
    panY: viewport.height * 0.42 - point.y * zoom,
  }, viewport, world);
}

function fitState(viewport: ViewportSize, world: ViewportSize) {
  const padding = 28;
  const zoom = clamp(Math.min(
    (viewport.width - padding * 2) / world.width,
    (viewport.height - padding * 2) / world.height,
  ), MIN_ZOOM, MAX_ZOOM);
  return clampResearchTreeViewport({
    zoom,
    panX: (viewport.width - world.width * zoom) / 2,
    panY: (viewport.height - world.height * zoom) / 2,
  }, viewport, world);
}

function midpoint(points: ViewportPoint[]) {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function distance(points: ViewportPoint[]) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

export function ResearchTreeViewport({ width, height, focusPoint, children }: ResearchTreeViewportProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const viewportSizeRef = useRef<ViewportSize>({ width: 1, height: 1 });
  const initializedRef = useRef(false);
  const pointersRef = useRef(new Map<number, ViewportPoint>());
  const lastSinglePointRef = useRef<ViewportPoint | null>(null);
  const pinchRef = useRef<{ midpoint: ViewportPoint; distance: number } | null>(null);
  const gestureOriginRef = useRef<ViewportPoint | null>(null);
  const gestureMovedRef = useRef(false);
  const suppressClickRef = useRef(false);
  const [isDragging, setDragging] = useState(false);
  const [state, setState] = useState<ViewportState>({ panX: 0, panY: 0, zoom: 1 });
  const world = { width, height };

  const clampState = useCallback((next: ViewportState) => (
    clampResearchTreeViewport(next, viewportSizeRef.current, { width, height })
  ), [height, width]);

  const measureAndClamp = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const size = { width: Math.max(1, rect.width), height: Math.max(1, rect.height) };
    viewportSizeRef.current = size;
    setState((current) => {
      if (!initializedRef.current) {
        initializedRef.current = true;
        const target = focusPoint ?? { x: width / 2, y: height / 2 };
        return centeredState(target, defaultZoomForWidth(size.width), size, { width, height });
      }
      return clampResearchTreeViewport(current, size, { width, height });
    });
  }, [focusPoint, height, width]);

  useLayoutEffect(() => {
    measureAndClamp();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measureAndClamp());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [measureAndClamp]);

  const localPoint = useCallback((clientX: number, clientY: number): ViewportPoint => {
    const rect = viewportRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  }, []);

  const updatePan = useCallback((dx: number, dy: number) => {
    setState((current) => clampState({ ...current, panX: current.panX + dx, panY: current.panY + dy }));
  }, [clampState]);

  const zoomAt = useCallback((anchor: ViewportPoint, zoom: number) => {
    setState((current) => clampState(zoomResearchTreeAtPoint(current, anchor, zoom)));
  }, [clampState]);

  const centerCurrent = useCallback(() => {
    const size = viewportSizeRef.current;
    const point = focusPoint ?? { x: width / 2, y: height / 2 };
    setState((current) => centeredState(point, current.zoom, size, world));
  }, [focusPoint, height, width]);

  const fitTree = useCallback(() => {
    setState(fitState(viewportSizeRef.current, world));
  }, [height, width]);

  const zoomBy = useCallback((factor: number) => {
    const size = viewportSizeRef.current;
    zoomAt({ x: size.width / 2, y: size.height / 2 }, state.zoom * factor);
  }, [state.zoom, zoomAt]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('.research-tree-controls')) return;
    const point = localPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    gestureMovedRef.current = false;
    setDragging(true);

    if (pointersRef.current.size === 1) {
      lastSinglePointRef.current = point;
      gestureOriginRef.current = point;
      pinchRef.current = null;
    } else if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()].slice(0, 2);
      pinchRef.current = { midpoint: midpoint(points), distance: Math.max(1, distance(points)) };
      gestureMovedRef.current = true;
    }

    const startedOnNode = Boolean((event.target as HTMLElement).closest('.research-technology-node'));
    if (!startedOnNode) {
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }
    }
  }, [localPoint]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = localPoint(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()].slice(0, 2);
      const currentMidpoint = midpoint(points);
      const currentDistance = Math.max(1, distance(points));
      const previous = pinchRef.current;
      if (previous) {
        setState((current) => {
          const nextZoom = clamp(current.zoom * (currentDistance / previous.distance), MIN_ZOOM, MAX_ZOOM);
          const worldX = (previous.midpoint.x - current.panX) / current.zoom;
          const worldY = (previous.midpoint.y - current.panY) / current.zoom;
          return clampState({
            zoom: nextZoom,
            panX: currentMidpoint.x - worldX * nextZoom,
            panY: currentMidpoint.y - worldY * nextZoom,
          });
        });
      }
      pinchRef.current = { midpoint: currentMidpoint, distance: currentDistance };
      gestureMovedRef.current = true;
      event.preventDefault();
      return;
    }

    const previous = lastSinglePointRef.current;
    if (!previous) {
      lastSinglePointRef.current = point;
      return;
    }
    const origin = gestureOriginRef.current ?? previous;
    if (Math.hypot(point.x - origin.x, point.y - origin.y) >= DRAG_THRESHOLD) {
      gestureMovedRef.current = true;
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* synthetic pointer events */ }
    }
    updatePan(point.x - previous.x, point.y - previous.y);
    lastSinglePointRef.current = point;
    event.preventDefault();
  }, [clampState, localPoint, updatePan]);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (gestureMovedRef.current) {
      suppressClickRef.current = true;
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    }
    if (pointersRef.current.size === 1) {
      const remaining = [...pointersRef.current.values()][0];
      lastSinglePointRef.current = remaining;
      gestureOriginRef.current = remaining;
      pinchRef.current = null;
    } else if (pointersRef.current.size === 0) {
      lastSinglePointRef.current = null;
      gestureOriginRef.current = null;
      pinchRef.current = null;
      setDragging(false);
    }
  }, []);

  const handleClickCapture = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const anchor = localPoint(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.002);
    zoomAt(anchor, state.zoom * factor);
  }, [localPoint, state.zoom, zoomAt]);

  const handleKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1.15);
    } else if (event.key === '-') {
      event.preventDefault();
      zoomBy(1 / 1.15);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      updatePan(KEYBOARD_PAN_STEP, 0);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      updatePan(-KEYBOARD_PAN_STEP, 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      updatePan(0, KEYBOARD_PAN_STEP);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      updatePan(0, -KEYBOARD_PAN_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      fitTree();
    } else if (event.key === 'Home') {
      event.preventDefault();
      centerCurrent();
    }
  }, [centerCurrent, fitTree, updatePan, zoomBy]);

  const handleFocusCapture = useCallback((event: ReactFocusEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const x = Number(target.dataset.researchNodeX);
    const y = Number(target.dataset.researchNodeY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setState((current) => {
      const size = viewportSizeRef.current;
      const screenX = current.panX + x * current.zoom;
      const screenY = current.panY + y * current.zoom;
      let dx = 0;
      let dy = 0;
      if (screenX < FOCUS_VISIBLE_MARGIN) dx = FOCUS_VISIBLE_MARGIN - screenX;
      else if (screenX > size.width - FOCUS_VISIBLE_MARGIN) dx = size.width - FOCUS_VISIBLE_MARGIN - screenX;
      if (screenY < FOCUS_VISIBLE_MARGIN) dy = FOCUS_VISIBLE_MARGIN - screenY;
      else if (screenY > size.height - FOCUS_VISIBLE_MARGIN) dy = size.height - FOCUS_VISIBLE_MARGIN - screenY;
      return dx || dy ? clampState({ ...current, panX: current.panX + dx, panY: current.panY + dy }) : current;
    });
  }, [clampState]);

  const zoomPercent = Math.round(state.zoom * 100);
  const zoomTier = state.zoom < 0.5 ? 'overview' : 'detail';

  return (
    <div
      ref={viewportRef}
      className="research-tree-viewport"
      data-dragging={isDragging || undefined}
      data-pan-x={Math.round(state.panX * 100) / 100}
      data-pan-y={Math.round(state.panY * 100) / 100}
      data-zoom={Math.round(state.zoom * 1000) / 1000}
      data-zoom-tier={zoomTier}
      role="group"
      aria-label="可平移和缩放的产业科技树"
      tabIndex={0}
      onClickCapture={handleClickCapture}
      onFocusCapture={handleFocusCapture}
      onKeyDown={handleKeyboard}
      onPointerCancel={finishPointer}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onWheel={handleWheel}
    >
      <div
        className="research-tree-transform-layer"
        style={{
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate3d(${state.panX}px, ${state.panY}px, 0) scale(${state.zoom})`,
        } as CSSProperties}
      >
        {children}
      </div>
      <div className="research-tree-controls" aria-label="技术树视图控制">
        <button type="button" className="research-tree-control" aria-label="缩小技术树" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomBy(1 / 1.15)}>−</button>
        <span className="research-tree-zoom-readout" aria-live="polite">{zoomPercent}%</span>
        <button type="button" className="research-tree-control" aria-label="放大技术树" onPointerDown={(event) => event.stopPropagation()} onClick={() => zoomBy(1.15)}>+</button>
        <button type="button" className="research-tree-control research-tree-control--text" aria-label="定位当前科技" onPointerDown={(event) => event.stopPropagation()} onClick={centerCurrent}>当前</button>
        <button type="button" className="research-tree-control research-tree-control--text" aria-label="查看完整技术树" onPointerDown={(event) => event.stopPropagation()} onClick={fitTree}>全部</button>
      </div>
    </div>
  );
}
'''
write('src/research/ResearchTreeViewport.tsx', viewport)

page = 'src/pages/ResearchPage.tsx'
replace_once(page,
    "import { buildResearchTreeFocus, buildResearchTreeLayout } from '../research/researchTreeLayout';\n",
    "import { ResearchTreeViewport } from '../research/ResearchTreeViewport';\nimport { buildResearchTreeFocus, buildResearchTreeLayout } from '../research/researchTreeLayout';\n")
replace_once(page,
    "  const researchTreeFocus = useMemo(\n    () => buildResearchTreeFocus(technologies, selectedTechnology?.id ?? ''),\n    [selectedTechnology?.id, technologies],\n  );\n",
    "  const researchTreeFocus = useMemo(\n    () => buildResearchTreeFocus(technologies, selectedTechnology?.id ?? ''),\n    [selectedTechnology?.id, technologies],\n  );\n  const selectedTreeNode = researchTreeLayout.nodes.find((node) => node.id === selectedTechnology?.id);\n")
old_tree = '''          <div className="research-tree-scroll">
            <div
              className="research-tree"
              role="tree"
              aria-label="产业科技树"
              data-layout-direction="downward"
              style={{
                '--research-tree-desktop-width': `${researchTreeLayout.desktopWidth}px`,
                '--research-tree-desktop-height': `${researchTreeLayout.desktopHeight}px`,
                '--research-tree-mobile-height': `${researchTreeLayout.mobileHeight}px`,
              } as CSSProperties}
            >
              <svg
                className="research-tree-connections research-tree-connections--desktop"
                viewBox={`0 0 ${researchTreeLayout.desktopWidth} ${researchTreeLayout.desktopHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {researchTreeLayout.edges.map((edge) => (
                  <path
                    className="research-tree-edge"
                    data-highlighted={researchTreeFocus.upstreamEdgeKeys.has(edge.key) || undefined}
                    data-related={researchTreeFocus.downstreamEdgeKeys.has(edge.key) || undefined}
                    d={edge.desktopPath}
                    key={`desktop:${edge.key}`}
                  />
                ))}
              </svg>
              <svg
                className="research-tree-connections research-tree-connections--mobile"
                viewBox={`0 0 1000 ${researchTreeLayout.mobileHeight}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {researchTreeLayout.edges.map((edge) => (
                  <path
                    className="research-tree-edge"
                    data-highlighted={researchTreeFocus.upstreamEdgeKeys.has(edge.key) || undefined}
                    data-related={researchTreeFocus.downstreamEdgeKeys.has(edge.key) || undefined}
                    d={edge.mobilePath}
                    key={`mobile:${edge.key}`}
                  />
                ))}
              </svg>
              {researchTreeLayout.nodes.map((layoutNode) => {
'''
new_tree = '''          <ResearchTreeViewport
            width={researchTreeLayout.width}
            height={researchTreeLayout.height}
            focusPoint={selectedTreeNode ? { x: selectedTreeNode.x, y: selectedTreeNode.y } : undefined}
          >
            <div
              className="research-tree"
              role="tree"
              aria-label="产业科技树"
              data-layout-direction="downward"
            >
              <svg
                className="research-tree-connections"
                viewBox={`0 0 ${researchTreeLayout.width} ${researchTreeLayout.height}`}
                aria-hidden="true"
              >
                {researchTreeLayout.edges.map((edge) => (
                  <path
                    className="research-tree-edge"
                    data-highlighted={researchTreeFocus.upstreamEdgeKeys.has(edge.key) || undefined}
                    data-related={researchTreeFocus.downstreamEdgeKeys.has(edge.key) || undefined}
                    d={edge.path}
                    key={edge.key}
                  />
                ))}
              </svg>
              {researchTreeLayout.nodes.map((layoutNode) => {
'''
replace_once(page, old_tree, new_tree)
replace_once(page,
'''                const nodeStyle = {
                  '--research-node-progress': `${Math.round(progress * 360)}deg`,
                  '--research-node-desktop-x': `${layoutNode.desktopX}px`,
                  '--research-node-desktop-y': `${layoutNode.desktopY}px`,
                  '--research-node-mobile-x': `${layoutNode.mobileXPercent}%`,
                  '--research-node-mobile-y': `${layoutNode.mobileY}px`,
                } as CSSProperties;
''',
'''                const nodeStyle = {
                  '--research-node-progress': `${Math.round(progress * 360)}deg`,
                  '--research-node-x': `${layoutNode.x}px`,
                  '--research-node-y': `${layoutNode.y}px`,
                } as CSSProperties;
''')
replace_once(page,
'''                    data-depth={layoutNode.depth}
                    data-prerequisites={technology.prerequisiteTechnologyIds.join(',')}
''',
'''                    data-depth={layoutNode.depth}
                    data-prerequisites={technology.prerequisiteTechnologyIds.join(',')}
                    data-research-node-x={layoutNode.x}
                    data-research-node-y={layoutNode.y}
''')
replace_once(page,
'''            </div>
          </div>
        </PagePanel>
''',
'''            </div>
          </ResearchTreeViewport>
        </PagePanel>
''')
replace_once(page,
    '<p>阶段只用于组织难度；节点前置关系决定可研发路线。</p>',
    '<p>拖动浏览 · Ctrl/⌘+滚轮或双指缩放；节点前置关系决定可研发路线。</p>')

css_path = 'src/styles/research-page.css'
css = read(css_path)
start = css.index('.research-tree-scroll {')
end = css.index('.research-facility-node {')
new_css_block = r'''.research-tree-viewport {
  position: relative;
  min-width: 0;
  width: 100%;
  height: clamp(560px, 72dvh, 820px);
  min-height: 480px;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-inset);
  touch-action: none;
  user-select: none;
  cursor: grab;
}

.research-tree-viewport[data-dragging='true'] {
  cursor: grabbing;
}

.research-tree-viewport:focus-visible {
  outline: 2px solid var(--color-focus-ring, var(--color-success));
  outline-offset: 2px;
}

.research-tree-transform-layer {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
  will-change: transform;
}

.research-tree {
  --research-trunk-color: color-mix(in srgb, var(--color-border-strong) 78%, transparent);
  --research-focus-color: var(--color-accent-violet);
  position: relative;
  width: 100%;
  height: 100%;
}

.research-tree-connections {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.research-tree-edge {
  fill: none;
  stroke: var(--research-trunk-color);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  opacity: 0.5;
  transition: opacity 160ms ease, stroke 160ms ease, stroke-width 160ms ease;
}

.research-tree-edge[data-related='true'] {
  stroke: color-mix(in srgb, var(--research-focus-color) 62%, var(--color-border-strong));
  opacity: 0.76;
}

.research-tree-edge[data-highlighted='true'] {
  stroke: var(--research-focus-color);
  stroke-width: 3;
  opacity: 0.95;
}

.research-tree-controls {
  position: absolute;
  right: var(--space-2);
  bottom: var(--space-2);
  z-index: 4;
  display: flex;
  align-items: center;
  gap: var(--space-1);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-control);
  padding: var(--space-1);
  background: color-mix(in srgb, var(--color-surface-panel) 92%, transparent);
  box-shadow: var(--shadow-panel);
  backdrop-filter: blur(12px);
  touch-action: manipulation;
}

.research-tree-control {
  min-width: 2.25rem;
  min-height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 0 var(--space-2);
  color: var(--color-text-primary);
  background: var(--color-surface-control);
  font-size: var(--font-size-sm);
  font-weight: 800;
}

.research-tree-control--text {
  min-width: 3rem;
}

.research-tree-zoom-readout {
  min-width: 3.2rem;
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.research-tree-viewport[data-zoom-tier='overview'] .research-technology-node-meta,
.research-tree-viewport[data-zoom-tier='overview'] .research-technology-node-status {
  opacity: 0;
}

'''
css = css[:start] + new_css_block + css[end:]
css = css.replace('  left: var(--research-node-desktop-x);\n  top: var(--research-node-desktop-y);', '  left: var(--research-node-x);\n  top: var(--research-node-y);', 1)
mobile_old = r'''  .research-tree-heading p {
    display: none;
  }

  .research-tree-scroll {
    overflow-x: visible;
    padding: var(--space-1) 0 var(--space-3);
  }

  .research-tree {
    min-width: 0;
    width: 100%;
    height: var(--research-tree-mobile-height);
    margin-inline: 0;
  }

  .research-tree-connections--desktop {
    display: none;
  }

  .research-tree-connections--mobile {
    display: block;
  }

  .research-technology-node {
    left: var(--research-node-mobile-x);
    top: var(--research-node-mobile-y);
    width: min(8.5rem, calc(50% - var(--space-2)));
    min-height: 6.5rem;
    padding-inline: 0.15rem;
  }

  .research-facility-artwork {
    width: 3rem;
    height: 3rem;
  }

  .research-technology-node-name {
    font-size: 0.7rem;
  }

  .research-technology-node-meta,
  .research-technology-node-status {
    font-size: 0.63rem;
  }
'''
mobile_new = r'''  .research-tree-viewport {
    height: clamp(420px, 62dvh, 620px);
    min-height: 420px;
  }

  .research-tree-heading p {
    display: block;
  }

  .research-tree-controls {
    right: var(--space-1);
    bottom: var(--space-1);
  }

  .research-tree-control {
    min-width: 2.5rem;
    min-height: 2.5rem;
  }
'''
if css.count(mobile_old) != 1:
    raise SystemExit(f'{css_path}: mobile research tree marker mismatch {css.count(mobile_old)}')
css = css.replace(mobile_old, mobile_new, 1)
write(css_path, css)

test_path = 'tests/browser/research-technology-tree.spec.ts'
test = read(test_path)
test = test.replace("        connectionCount: document.querySelectorAll('.research-tree-connections--desktop .research-tree-edge').length,", "        connectionCount: document.querySelectorAll('.research-tree-connections .research-tree-edge').length,", 1)
test = test.replace("        treeOwnsHorizontalOverflow: (treeScroll?.scrollWidth ?? 0) >= (treeScroll?.clientWidth ?? 0),", "        viewportClipsCanvas: getComputedStyle(document.querySelector<HTMLElement>('.research-tree-viewport')!).overflow === 'hidden',", 1)
test = test.replace('    expect(researchGeometry.treeOwnsHorizontalOverflow).toBe(true);', '    expect(researchGeometry.viewportClipsCanvas).toBe(true);', 1)
test = test.replace("      const treeScroll = document.querySelector<HTMLElement>('.research-tree-scroll');\n", '', 1)
test = test.replace("        return { highlighted: check('.research-tree-connections--desktop [data-highlighted=\\\"true\\\"]'), related: check('.research-tree-connections--desktop [data-related=\\\"true\\\"]') };", "        return { highlighted: check('.research-tree-connections [data-highlighted=\\\"true\\\"]'), related: check('.research-tree-connections [data-related=\\\"true\\\"]') };", 1)
old_mobile_test = r'''  test('keeps every mobile dependency below its prerequisite without horizontal tree scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const geometry = await page.evaluate(() => {
      const treeScroll = document.querySelector<HTMLElement>('.research-tree-scroll');
      const nodes = Array.from(document.querySelectorAll<HTMLElement>('.research-technology-node'));
      const topById = new Map(nodes.map((node) => [node.dataset.technologyId ?? '', node.getBoundingClientRect().top]));
      const allDependenciesDownward = nodes.every((node) => {
        const childTop = node.getBoundingClientRect().top;
        const prerequisiteIds = (node.dataset.prerequisites ?? '').split(',').filter(Boolean);
        return prerequisiteIds.every((parentId) => childTop > (topById.get(parentId) ?? -Infinity) + 20);
      });
      return {
        allDependenciesDownward,
        treeHasNoHorizontalScroll: (treeScroll?.scrollWidth ?? 0) <= (treeScroll?.clientWidth ?? 0) + 1,
        pageFitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        mobileConnectionsVisible: getComputedStyle(document.querySelector<HTMLElement>('.research-tree-connections--mobile')!).display !== 'none',
      };
    });

    expect(geometry.allDependenciesDownward).toBe(true);
    expect(geometry.treeHasNoHorizontalScroll).toBe(true);
    expect(geometry.pageFitsViewport).toBe(true);
    expect(geometry.mobileConnectionsVisible).toBe(true);
  });
'''
new_mobile_test = r'''  test('uses one world geometry on mobile with pan and zoom instead of two-lane reflow', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const desktopWorld = await page.locator('.research-technology-node').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [
      (node as HTMLElement).dataset.technologyId,
      {
        x: (node as HTMLElement).style.getPropertyValue('--research-node-x'),
        y: (node as HTMLElement).style.getPropertyValue('--research-node-y'),
      },
    ])));

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const viewport = page.locator('.research-tree-viewport');
    const mobileWorld = await page.locator('.research-technology-node').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => [
      (node as HTMLElement).dataset.technologyId,
      {
        x: (node as HTMLElement).style.getPropertyValue('--research-node-x'),
        y: (node as HTMLElement).style.getPropertyValue('--research-node-y'),
      },
    ])));
    expect(mobileWorld).toEqual(desktopWorld);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const beforePan = Number(await viewport.getAttribute('data-pan-x'));
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move((box?.x ?? 0) + 120, (box?.y ?? 0) + 180);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + 170, (box?.y ?? 0) + 210, { steps: 4 });
    await page.mouse.up();
    const afterPan = Number(await viewport.getAttribute('data-pan-x'));
    expect(Math.abs(afterPan - beforePan)).toBeGreaterThan(10);

    const beforeZoom = Number(await viewport.getAttribute('data-zoom'));
    await page.getByRole('button', { name: '放大技术树' }).click();
    const afterZoom = Number(await viewport.getAttribute('data-zoom'));
    expect(afterZoom).toBeGreaterThan(beforeZoom);

    await viewport.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const fire = (type: string, pointerId: number, x: number, y: number, buttons: number) => element.dispatchEvent(new PointerEvent(type, {
        bubbles: true,
        pointerId,
        pointerType: 'touch',
        clientX: rect.left + x,
        clientY: rect.top + y,
        buttons,
      }));
      fire('pointerdown', 41, 120, 180, 1);
      fire('pointerdown', 42, 220, 180, 1);
      fire('pointermove', 42, 270, 180, 1);
      fire('pointerup', 42, 270, 180, 0);
      fire('pointerup', 41, 120, 180, 0);
    });
    const pinchZoom = Number(await viewport.getAttribute('data-zoom'));
    expect(pinchZoom).toBeGreaterThan(afterZoom);
  });
'''
if test.count(old_mobile_test) != 1:
    raise SystemExit(f'{test_path}: old mobile test marker mismatch {test.count(old_mobile_test)}')
test = test.replace(old_mobile_test, new_mobile_test, 1)
insert_marker = "  test('distinguishes operation research from production research', async ({ page }) => {"
new_desktop_test = r'''  test('supports desktop drag and ctrl-wheel zoom without changing world coordinates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=research&scenario=research-active');
    const viewport = page.locator('.research-tree-viewport');
    const node = page.getByRole('button', { name: /工具作业，可研发，C2 作业科技/ });
    const beforeWorld = await node.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
    }));
    const box = await viewport.boundingBox();
    expect(box).not.toBeNull();
    const panBefore = Number(await viewport.getAttribute('data-pan-y'));
    await page.mouse.move((box?.x ?? 0) + 360, (box?.y ?? 0) + 260);
    await page.mouse.down();
    await page.mouse.move((box?.x ?? 0) + 320, (box?.y ?? 0) + 310, { steps: 4 });
    await page.mouse.up();
    expect(Math.abs(Number(await viewport.getAttribute('data-pan-y')) - panBefore)).toBeGreaterThan(10);

    const zoomBefore = Number(await viewport.getAttribute('data-zoom'));
    await page.keyboard.down('Control');
    await page.mouse.move((box?.x ?? 0) + 420, (box?.y ?? 0) + 300);
    await page.mouse.wheel(0, -180);
    await page.keyboard.up('Control');
    expect(Number(await viewport.getAttribute('data-zoom'))).toBeGreaterThan(zoomBefore);
    const afterWorld = await node.evaluate((element) => ({
      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),
      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),
    }));
    expect(afterWorld).toEqual(beforeWorld);
  });

'''
if test.count(insert_marker) != 1:
    raise SystemExit(f'{test_path}: desktop insert marker mismatch')
test = test.replace(insert_marker, new_desktop_test + insert_marker, 1)
# Stable-selection test now checks unified world coordinates.
test = test.replace("      x: (element as HTMLElement).style.getPropertyValue('--research-node-desktop-x'),\n      y: (element as HTMLElement).style.getPropertyValue('--research-node-desktop-y'),", "      x: (element as HTMLElement).style.getPropertyValue('--research-node-x'),\n      y: (element as HTMLElement).style.getPropertyValue('--research-node-y'),", 2)
write(test_path, test)

verifier_path = 'scripts/verify-research-page.mjs'
verifier = read(verifier_path)
verifier = verifier.replace("  'src/research/researchTreeLayout.ts',\n", "  'src/research/researchTreeLayout.ts',\n  'src/research/ResearchTreeViewport.tsx',\n", 1)
verifier = verifier.replace("  'MOBILE_COLUMNS = 2',\n  'desktopPath',\n  'mobilePath',", "  'x: number',\n  'y: number',\n  'path: string',", 1)
verifier = verifier.replace("  '.research-tree-connections',\n", "  '.research-tree-viewport',\n  '.research-tree-transform-layer',\n  '.research-tree-connections',\n  'touch-action: none;',\n", 1)
verifier = verifier.replace("  'opens technology details in the shared mobile sheet',\n", "  'uses one world geometry on mobile with pan and zoom instead of two-lane reflow',\n  'supports desktop drag and ctrl-wheel zoom without changing world coordinates',\n  'opens technology details in the shared mobile sheet',\n", 1)
verifier = verifier.replace("  '最多两条横向节点轨道',\n", "  '同一确定性 DAG 世界坐标',\n  '单指平移',\n  '双指缩放',\n", 1)
# Add viewport implementation checks before API checks.
marker = "requireText('src/api/game.ts', \"postAction('/research/start', { technologyId })\");"
viewport_checks = '''for (const text of [\n  'clampResearchTreeViewport',\n  'zoomResearchTreeAtPoint',\n  'translate3d(',\n  'data-pan-x',\n  'data-zoom',\n  '定位当前科技',\n  '查看完整技术树',\n]) requireText('src/research/ResearchTreeViewport.tsx', text);\n\n'''
if verifier.count(marker) != 1:
    raise SystemExit('verifier API marker mismatch')
verifier = verifier.replace(marker, viewport_checks + marker, 1)
# Extend CSS forbidden list.
old_forbid = "for (const forbidden of [\n  'grid-template-columns: repeat(7',\n  '.research-stage-node',\n]) forbidText('src/styles/research-page.css', forbidden);"
new_forbid = "for (const forbidden of [\n  'grid-template-columns: repeat(7',\n  '.research-stage-node',\n  '.research-tree-scroll',\n  '.research-tree-connections--mobile',\n  '--research-node-mobile-x',\n  '--research-node-desktop-x',\n]) forbidText('src/styles/research-page.css', forbidden);\nfor (const forbidden of [\n  'MOBILE_COLUMNS',\n  'mobileXPercent',\n  'mobileY',\n  'mobilePath',\n  'desktopX',\n  'desktopPath',\n]) forbidText('src/research/researchTreeLayout.ts', forbidden);\nfor (const forbidden of [\n  'research-tree-connections--mobile',\n  'research-tree-connections--desktop',\n]) forbidText('src/pages/ResearchPage.tsx', forbidden);"
if verifier.count(old_forbid) != 1:
    raise SystemExit('verifier forbidden marker mismatch')
verifier = verifier.replace(old_forbid, new_forbid, 1)
write(verifier_path, verifier)

doc_path = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
doc = read(doc_path)
old_mobile_rule = '移动端 `<=720px` 不复用桌面宽树横向滚动，固定压缩为最多两条横向节点轨道；同一纵向深度超过两个节点时在该深度内部增加子行，下一深度必须排在前一深度全部子行之后，因此任何子节点仍严格位于全部前置节点下方。移动技术树使用页面统一纵向滚动，不建立树级纵向滚动，也不得产生页面或树级横向滚动。点击节点继续打开共享底部详情面板，关闭后焦点返回原节点。默认选择进行中的科技，其次选择第一个满足前置关系的可研发科技，全部完成时选择最终科技。'
new_mobile_rule = '研发技术树在桌面、平板和移动端必须复用同一确定性 DAG 世界坐标、同一节点尺寸和同一依赖连接线，不得按设备重新压缩、重排科技节点，也不得维护第二套移动坐标或连接路径。所有屏幕宽度统一通过有限尺寸二维视口浏览技术树：鼠标或单指平移，`Ctrl/Command + 滚轮`、触控板 pinch 或双指缩放围绕当前指针／手势中心缩放，并提供缩小、放大、定位当前科技和查看完整技术树的显式控制；普通滚轮继续用于页面滚动。技术树画布允许宽于视口，但视口必须裁剪画布且不得造成页面级横向溢出；平移边界必须始终保留部分画布可见。服务器状态刷新、科技选择和详情面板开关不得重置玩家当前 `pan + zoom` 视图；首次进入时以进行中的科技、其次第一个可研发科技为关注点。移动端点击节点继续打开共享底部详情面板，拖动超过点击阈值不得误触详情，关闭后焦点返回原节点且视图保持。科技节点的世界坐标、结构居中和画布视图变换必须分层实现，禁止重新用节点自身 `transform` 承担世界平移或缩放。'
if doc.count(old_mobile_rule) != 1:
    raise SystemExit(f'{doc_path}: old mobile rule marker mismatch {doc.count(old_mobile_rule)}')
doc = doc.replace(old_mobile_rule, new_mobile_rule, 1)
# Desktop overflow paragraph becomes viewport-based rather than scrollbar-based.
old_desktop_sentence = '技术树从上向下自然增加页面高度；最宽层超出右侧工作区时只允许技术树区域自身横向滚动，不得让整个页面横向溢出。'
new_desktop_sentence = '技术树世界坐标继续从上向下增长，但玩家页面只展示有限高度的二维技术树视口；最宽层或最深层超出视口时通过平移和缩放浏览，不显示传统树级横向滚动条，也不得让整个页面横向溢出。'
if doc.count(old_desktop_sentence) != 1:
    raise SystemExit(f'{doc_path}: desktop sentence mismatch')
doc = doc.replace(old_desktop_sentence, new_desktop_sentence, 1)
write(doc_path, doc)

print('research tree pan/zoom implementation applied')
