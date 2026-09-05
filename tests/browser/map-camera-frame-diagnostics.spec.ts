import { expect, test, type Page } from '@playwright/test';

type TraceEvent = {
  name?: string;
  ph?: string;
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

type AtmosphereVariant = {
  name: string;
  css: string;
};

const VARIANTS: AtmosphereVariant[] = [
  { name: 'baseline', css: '' },
  {
    name: 'noise-disabled',
    css: '.application-atmosphere-layer::after { content: none !important; }',
  },
  {
    name: 'noise-blend-normal',
    css: '.application-atmosphere-layer::after { mix-blend-mode: normal !important; }',
  },
  {
    name: 'noise-texture-disabled',
    css: '.application-atmosphere-layer::after { background-image: none !important; }',
  },
  {
    name: 'grid-disabled',
    css: '.application-atmosphere-layer::before { content: none !important; }',
  },
  {
    name: 'flat-background',
    css: '.application-atmosphere-layer { background: rgb(2 10 6 / 90%) !important; }',
  },
];

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

async function runVariant(page: Page, variant: AtmosphereVariant) {
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = await waitForMapReady(page);
  if (variant.css) await page.addStyleTag({ content: variant.css });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  let latestLayers: LayerSnapshot[] = [];
  cdp.on('LayerTree.layerTreeDidChange', (payload) => {
    latestLayers = payload.layers as LayerSnapshot[];
  });
  await cdp.send('LayerTree.enable');

  const { root } = await cdp.send('DOM.getDocument', { depth: 1, pierce: true });
  const { nodeId: atmosphereNodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: '.application-atmosphere-layer',
  });
  if (!atmosphereNodeId) throw new Error('application atmosphere layer is missing');
  const { node: atmosphereNode } = await cdp.send('DOM.describeNode', { nodeId: atmosphereNodeId });
  const atmosphereBackendNodeId = atmosphereNode.backendNodeId;

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

  const frameCount = 6;
  const timings = await viewport.evaluate(async (container, count) => {
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const samples: FrameTiming[] = [];
    for (let index = 0; index < count; index += 1) {
      performance.mark(`map-atmosphere-ab-${index}-start`);
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
      performance.mark(`map-atmosphere-ab-${index}-end`);
      samples.push({
        index,
        totalMs: Number((finished - started).toFixed(3)),
        dispatchMs: Number((dispatched - started).toFixed(3)),
        rafWaitMs: Number((finished - dispatched).toFixed(3)),
      });
    }
    return samples;
  }, frameCount);

  await page.waitForTimeout(40);
  await cdp.send('Tracing.end');
  await tracingComplete;

  const atmosphereLayerIds = [...new Set(latestLayers
    .filter((layer) => layer.backendNodeId === atmosphereBackendNodeId)
    .map((layer) => layer.layerId))];
  const allRasterTasks = traceEvents.filter((event) => event.ph === 'X' && event.name === 'RasterTask');
  const atmosphereRasterTasks = allRasterTasks.filter((event) => {
    const layerId = rasterTaskLayerId(event);
    return layerId != null && atmosphereLayerIds.includes(layerId);
  });
  const atmosphereRasterDurations = atmosphereRasterTasks.map(eventDurationMs);
  const allLayerRasterCounts = new Map<string, number>();
  for (const event of allRasterTasks) {
    const layerId = rasterTaskLayerId(event);
    if (layerId == null) continue;
    allLayerRasterCounts.set(layerId, (allLayerRasterCounts.get(layerId) ?? 0) + 1);
  }
  const vizDrawDurations = traceEvents
    .filter((event) => event.ph === 'X' && event.name === 'DirectRenderer::DrawFrame')
    .map(eventDurationMs);
  const commitWaitDurations = traceEvents
    .filter((event) => event.ph === 'X' && event.name === 'LayerTreeHost::WaitForCommitCompletion')
    .map(eventDurationMs);

  await cdp.detach();
  return {
    name: variant.name,
    atmosphereBackendNodeId,
    atmosphereLayerIds,
    frameMs: timings.map((sample) => sample.totalMs),
    frameMedianMs: Number(median(timings.map((sample) => sample.totalMs)).toFixed(3)),
    dispatchMedianMs: Number(median(timings.map((sample) => sample.dispatchMs)).toFixed(3)),
    atmosphereRaster: {
      count: atmosphereRasterDurations.length,
      totalMs: Number(atmosphereRasterDurations.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...atmosphereRasterDurations).toFixed(3)),
    },
    allRasterTaskLayers: [...allLayerRasterCounts.entries()].sort((left, right) => right[1] - left[1]),
    vizDraw: {
      count: vizDrawDurations.length,
      totalMs: Number(vizDrawDurations.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...vizDrawDurations).toFixed(3)),
    },
    commitWait: {
      count: commitWaitDurations.length,
      totalMs: Number(commitWaitDurations.reduce((sum, value) => sum + value, 0).toFixed(3)),
      maxMs: Number(Math.max(0, ...commitWaitDurations).toFixed(3)),
    },
  };
}

test('A/B traces atmosphere components during transient map frames', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const results = [];
  for (const variant of VARIANTS) results.push(await runVariant(page, variant));

  console.log(`[map-atmosphere-ab] ${JSON.stringify(results)}`);
  expect(results).toHaveLength(VARIANTS.length);
  for (const result of results) expect(result.atmosphereLayerIds.length, result.name).toBeGreaterThan(0);
});
