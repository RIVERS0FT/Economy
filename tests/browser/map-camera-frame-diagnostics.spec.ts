import { expect, test } from '@playwright/test';

type TraceEvent = {
  name?: string;
  cat?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  pid?: number;
  tid?: number;
  args?: Record<string, unknown>;
};

const INTERESTING_RENDER_EVENT = /(layout|style|paint|raster|composite|drawframe|beginframe|commit|activate|layer|gpu|viz)/iu;

function traceEventDetails(event: TraceEvent) {
  if (!event.args) return null;
  const args = event.args as Record<string, unknown>;
  const data = args.data && typeof args.data === 'object' ? args.data as Record<string, unknown> : null;
  const tileData = args.tileData && typeof args.tileData === 'object' ? args.tileData as Record<string, unknown> : null;
  const details: Record<string, unknown> = {};
  if (tileData) details.tileData = tileData;
  if (data) {
    const selectedData: Record<string, unknown> = {};
    for (const key of ['layerId', 'layer_id', 'nodeId', 'backendNodeId', 'frame', 'frameId']) {
      if (key in data) selectedData[key] = data[key];
    }
    if (Object.keys(selectedData).length > 0) details.data = selectedData;
  }
  for (const key of ['layerId', 'layer_id', 'source_frame_number', 'sourceFrameNumber']) {
    if (key in args) details[key] = args[key];
  }
  return Object.keys(details).length > 0 ? details : null;
}

function summarizeTrace(events: TraceEvent[], frameCount: number) {
  const threadNames = new Map<string, string>();
  for (const event of events) {
    if (event.ph !== 'M' || event.name !== 'thread_name') continue;
    const name = typeof event.args?.name === 'string' ? event.args.name : null;
    if (!name || event.pid == null || event.tid == null) continue;
    threadNames.set(`${event.pid}:${event.tid}`, name);
  }

  const markerTimestamp = (name: string) => events.find((event) => event.name === name && typeof event.ts === 'number')?.ts ?? null;
  const summarizeWindow = (start: number, end: number) => events
    .filter((event) => (
      event.ph === 'X'
      && typeof event.ts === 'number'
      && typeof event.dur === 'number'
      && event.ts < end
      && event.ts + event.dur > start
      && INTERESTING_RENDER_EVENT.test(event.name ?? '')
    ))
    .map((event) => ({
      name: event.name ?? '',
      category: event.cat ?? '',
      thread: event.pid == null || event.tid == null ? '' : threadNames.get(`${event.pid}:${event.tid}`) ?? `${event.pid}:${event.tid}`,
      durationMs: Number(((event.dur ?? 0) / 1000).toFixed(3)),
      details: traceEventDetails(event),
    }))
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 20);

  const frames = Array.from({ length: frameCount }, (_, index) => {
    const start = markerTimestamp(`map-camera-diagnostic-frame-${index}-start`);
    const end = markerTimestamp(`map-camera-diagnostic-frame-${index}-end`);
    return {
      index,
      start,
      end,
      durationMs: start == null || end == null ? null : Number(((end - start) / 1000).toFixed(3)),
      events: start == null || end == null ? [] : summarizeWindow(start, end),
    };
  });

  const rasterEvents = events
    .filter((event) => (
      event.ph === 'X'
      && typeof event.dur === 'number'
      && /(raster|paint)/iu.test(event.name ?? '')
    ))
    .map((event) => ({
      name: event.name ?? '',
      thread: event.pid == null || event.tid == null ? '' : threadNames.get(`${event.pid}:${event.tid}`) ?? `${event.pid}:${event.tid}`,
      durationMs: Number(((event.dur ?? 0) / 1000).toFixed(3)),
      details: traceEventDetails(event),
    }))
    .sort((left, right) => right.durationMs - left.durationMs)
    .slice(0, 32);

  return { frames, rasterEvents };
}

test('diagnose transient map frame rendering with Chrome timeline events', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect.poll(async () => canvas.getAttribute('data-map-raster-ready'), { timeout: 15_000 }).toBe('true');
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');

  const cdp = await page.context().newCDPSession(page);
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
  const timings = await canvas.evaluate(async (container, count) => {
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const samples: Array<{ index: number; totalMs: number; dispatchMs: number; rafWaitMs: number }> = [];
    for (let index = 0; index < count; index += 1) {
      performance.mark(`map-camera-diagnostic-frame-${index}-start`);
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
      performance.mark(`map-camera-diagnostic-frame-${index}-end`);
      samples.push({
        index,
        totalMs: Number((finished - started).toFixed(3)),
        dispatchMs: Number((dispatched - started).toFixed(3)),
        rafWaitMs: Number((finished - dispatched).toFixed(3)),
      });
    }
    return samples;
  }, frameCount);

  await cdp.send('Tracing.end');
  await tracingComplete;
  await cdp.detach();

  const summary = summarizeTrace(traceEvents, frameCount);
  console.log(`[map-camera-frame-trace] timings=${JSON.stringify(timings)} trace=${JSON.stringify(summary)}`);
  expect(timings).toHaveLength(frameCount);
  expect(traceEvents.length).toBeGreaterThan(0);
});
