import { expect, test, type Page } from '@playwright/test';

type TraceEvent = {
  name?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  args?: Record<string, unknown>;
};

type LayerSnapshot = {
  layerId: string;
  backendNodeId?: number;
};

type FrameTiming = {
  index: number;
  totalMs: number;
  dispatchMs: number;
  rafWaitMs: number;
};

type LayerOwner = {
  name: string;
  selector: string;
  backendNodeId: number | null;
  layerIds: string[];
};

const OWNER_SELECTORS = [
  ['image', '.application-image-layer img'],
  ['atmosphere', '.application-atmosphere-layer'],
  ['raster', '.province-map-camera-raster'],
  ['vignette', '.strategic-map-vignette'],
  ['status', '.frosted-glass-surface--statusBar'],
  ['workspace-card', '.signed-in-shell__primary-card'],
  ['outliner', '.strategic-outliner'],
] as const;

function median(samples: number[]) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function rasterTaskLayerId(event: TraceEvent) {
  const tileData = event.args?.tileData;
  if (!tileData || typeof tileData !== 'object') return null;
  const layerId = (tileData as Record<string, unknown>).layerId;
  return layerId == null ? null : String(layerId);
}

function eventDurationMs(event: TraceEvent) {
  return Number(((event.dur ?? 0) / 1000).toFixed(3));
}

async function waitForMapReady(page: Page) {
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect.poll(async () => viewport.getAttribute('data-map-raster-ready'), { timeout: 15_000 }).toBe('true');
  await expect.poll(async () => viewport.getAttribute('data-map-zoom-active'), { timeout: 5_000 }).toBe('false');
  return viewport;
}

function markerTimestamp(events: TraceEvent[], name: string) {
  return events.find((event) => event.name === name && typeof event.ts === 'number')?.ts ?? null;
}

function summarizePhase(
  events: TraceEvent[],
  owners: LayerOwner[],
  phase: 'cold' | 'warmup' | 'steady',
  timings: FrameTiming[],
) {
  const start = markerTimestamp(events, `map-camera-${phase}-start`);
  const end = markerTimestamp(events, `map-camera-${phase}-end`);
  if (start == null || end == null) {
    return { phase, start, end, frameMedianMs: Number(median(timings.map((sample) => sample.totalMs)).toFixed(3)), raster: [] };
  }

  const windowEvents = events.filter((event) => (
    typeof event.ts === 'number'
    && event.ts >= start
    && event.ts <= end
  ));
  const rasterTasks = windowEvents.filter((event) => event.ph === 'X' && event.name === 'RasterTask');
  const rasterByLayer = new Map<string, number[]>();
  for (const event of rasterTasks) {
    const layerId = rasterTaskLayerId(event);
    if (layerId == null) continue;
    const durations = rasterByLayer.get(layerId) ?? [];
    durations.push(eventDurationMs(event));
    rasterByLayer.set(layerId, durations);
  }
  const ownerByLayerId = new Map<string, string>();
  for (const owner of owners) for (const layerId of owner.layerIds) ownerByLayerId.set(layerId, owner.name);
  const raster = [...rasterByLayer.entries()]
    .map(([layerId, durations]) => ({
      layerId,
      owner: ownerByLayerId.get(layerId) ?? 'unmapped',
      count: durations.length,
      totalMs: Number(durations.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...durations).toFixed(3)),
    }))
    .sort((left, right) => right.totalMs - left.totalMs);
  const vizDraw = windowEvents.filter((event) => event.ph === 'X' && event.name === 'DirectRenderer::DrawFrame').map(eventDurationMs);
  const commitWait = windowEvents.filter((event) => event.ph === 'X' && event.name === 'LayerTreeHost::WaitForCommitCompletion').map(eventDurationMs);
  const commits = windowEvents.filter((event) => event.ph === 'X' && event.name === 'Commit').map(eventDurationMs);

  return {
    phase,
    durationMs: Number(((end - start) / 1000).toFixed(3)),
    frameMs: timings.map((sample) => sample.totalMs),
    frameMedianMs: Number(median(timings.map((sample) => sample.totalMs)).toFixed(3)),
    dispatchMedianMs: Number(median(timings.map((sample) => sample.dispatchMs)).toFixed(3)),
    raster,
    vizDraw: {
      count: vizDraw.length,
      totalMs: Number(vizDraw.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...vizDraw).toFixed(3)),
    },
    commitWait: {
      count: commitWait.length,
      totalMs: Number(commitWait.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...commitWait).toFixed(3)),
    },
    commit: {
      count: commits.length,
      totalMs: Number(commits.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...commits).toFixed(3)),
    },
  };
}

test('trace cold versus steady transient map frames', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = await waitForMapReady(page);

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  let latestLayers: LayerSnapshot[] = [];
  cdp.on('LayerTree.layerTreeDidChange', (payload) => {
    latestLayers = payload.layers as LayerSnapshot[];
  });
  await cdp.send('LayerTree.enable');

  const { root } = await cdp.send('DOM.getDocument', { depth: 1, pierce: true });
  const owners: LayerOwner[] = [];
  for (const [name, selector] of OWNER_SELECTORS) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    let backendNodeId: number | null = null;
    if (nodeId) {
      const { node } = await cdp.send('DOM.describeNode', { nodeId });
      backendNodeId = node.backendNodeId ?? null;
    }
    owners.push({ name, selector, backendNodeId, layerIds: [] });
  }

  const traceEvents: TraceEvent[] = [];
  cdp.on('Tracing.dataCollected', (payload) => traceEvents.push(...(payload.value as TraceEvent[])));
  const tracingComplete = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
  await cdp.send('Tracing.start', {
    categories: [
      'devtools.timeline',
      'disabled-by-default-devtools.timeline',
      'disabled-by-default-devtools.timeline.frame',
      'disabled-by-default-devtools.timeline.layers',
      'blink.user_timing',
      'cc',
      'gpu',
      'viz',
    ].join(','),
    options: 'record-as-much-as-possible',
    transferMode: 'ReportEvents',
  });

  const phaseTimings = await viewport.evaluate(async (container) => {
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const runPhase = async (phase: 'cold' | 'warmup' | 'steady', count: number) => {
      const samples: FrameTiming[] = [];
      performance.mark(`map-camera-${phase}-start`);
      for (let index = 0; index < count; index += 1) {
        const started = performance.now();
        container.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: bounds.left + bounds.width * 0.54,
          clientY: bounds.top + bounds.height * 0.47,
          deltaY: index % 2 === 0 ? -18 : 18,
        }));
        const dispatched = performance.now();
        await nextFrame();
        const finished = performance.now();
        samples.push({
          index,
          totalMs: Number((finished - started).toFixed(3)),
          dispatchMs: Number((dispatched - started).toFixed(3)),
          rafWaitMs: Number((finished - dispatched).toFixed(3)),
        });
      }
      performance.mark(`map-camera-${phase}-end`);
      return samples;
    };

    const cold = await runPhase('cold', 6);
    const warmup = await runPhase('warmup', 12);
    const steady = await runPhase('steady', 12);
    return { cold, warmup, steady, active: container.dataset.mapZoomActive };
  });

  await page.waitForTimeout(50);
  await cdp.send('Tracing.end');
  await tracingComplete;

  for (const owner of owners) {
    owner.layerIds = [...new Set(latestLayers
      .filter((layer) => layer.backendNodeId != null && layer.backendNodeId === owner.backendNodeId)
      .map((layer) => layer.layerId))];
  }
  const summary = {
    activeAfterPhases: phaseTimings.active,
    owners,
    cold: summarizePhase(traceEvents, owners, 'cold', phaseTimings.cold),
    warmup: summarizePhase(traceEvents, owners, 'warmup', phaseTimings.warmup),
    steady: summarizePhase(traceEvents, owners, 'steady', phaseTimings.steady),
  };
  console.log(`[map-camera-cold-steady] ${JSON.stringify(summary)}`);

  await cdp.detach();
  expect(traceEvents.length).toBeGreaterThan(0);
  expect(summary.activeAfterPhases).toBe('true');
  expect(summary.cold.frameMs).toHaveLength(6);
  expect(summary.steady.frameMs).toHaveLength(12);
});
