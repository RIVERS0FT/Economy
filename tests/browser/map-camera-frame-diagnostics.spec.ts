import { expect, test, type Page } from '@playwright/test';

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

type FrameTiming = {
  index: number;
  totalMs: number;
  dispatchMs: number;
  rafWaitMs: number;
};

function median(samples: number[]) {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function markerTimestamp(events: TraceEvent[], name: string) {
  return events.find((event) => event.name === name && typeof event.ts === 'number')?.ts ?? null;
}

function eventDurationMs(event: TraceEvent) {
  return Number(((event.dur ?? 0) / 1000).toFixed(3));
}

function safeArgs(args: Record<string, unknown> | undefined) {
  if (!args) return null;
  const entries = Object.entries(args).slice(0, 8).map(([key, value]) => {
    if (value == null || typeof value === 'number' || typeof value === 'boolean') return [key, value];
    if (typeof value === 'string') return [key, value.slice(0, 160)];
    if (Array.isArray(value)) return [key, `[array:${value.length}]`];
    if (typeof value === 'object') return [key, `{${Object.keys(value as Record<string, unknown>).slice(0, 8).join(',')}}`];
    return [key, typeof value];
  });
  return Object.fromEntries(entries);
}

async function waitForMapReady(page: Page) {
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect.poll(async () => viewport.getAttribute('data-map-raster-ready'), { timeout: 15_000 }).toBe('true');
  await expect.poll(async () => viewport.getAttribute('data-map-zoom-active'), { timeout: 5_000 }).toBe('false');
  return viewport;
}

function aggregateSteadyEvents(events: TraceEvent[], start: number, end: number) {
  const threadNames = new Map<string, string>();
  for (const event of events) {
    if (event.ph !== 'M' || event.name !== 'thread_name' || event.pid == null || event.tid == null) continue;
    const name = event.args?.name;
    if (typeof name === 'string') threadNames.set(`${event.pid}:${event.tid}`, name);
  }
  const steadyEvents = events.filter((event) => (
    event.ph === 'X'
    && typeof event.ts === 'number'
    && typeof event.dur === 'number'
    && event.ts < end
    && event.ts + event.dur > start
  ));
  const groups = new Map<string, { name: string; thread: string; category: string; count: number; totalMs: number; maxMs: number; sampleArgs: unknown }>();
  for (const event of steadyEvents) {
    const thread = event.pid == null || event.tid == null ? '' : threadNames.get(`${event.pid}:${event.tid}`) ?? `${event.pid}:${event.tid}`;
    if (!/(VizCompositorThread|Compositor|CrGpuMain|GpuMemoryThread|ThreadPoolForegroundWorker)/u.test(thread)) continue;
    const name = event.name ?? '';
    const key = `${thread}\u0000${name}`;
    const durationMs = (event.dur ?? 0) / 1000;
    const current = groups.get(key) ?? {
      name,
      thread,
      category: event.cat ?? '',
      count: 0,
      totalMs: 0,
      maxMs: 0,
      sampleArgs: safeArgs(event.args),
    };
    current.count += 1;
    current.totalMs += durationMs;
    current.maxMs = Math.max(current.maxMs, durationMs);
    if (current.sampleArgs == null) current.sampleArgs = safeArgs(event.args);
    groups.set(key, current);
  }
  return [...groups.values()]
    .map((entry) => ({
      ...entry,
      totalMs: Number(entry.totalMs.toFixed(3)),
      maxMs: Number(entry.maxMs.toFixed(3)),
    }))
    .sort((left, right) => right.totalMs - left.totalMs)
    .slice(0, 80);
}

test('trace steady transient map Viz and GPU draw internals', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = await waitForMapReady(page);

  const warmup = await viewport.evaluate(async (container) => {
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const timings: number[] = [];
    for (let index = 0; index < 18; index += 1) {
      const started = performance.now();
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width * 0.54,
        clientY: bounds.top + bounds.height * 0.47,
        deltaY: index % 2 === 0 ? -18 : 18,
      }));
      await nextFrame();
      timings.push(Number((performance.now() - started).toFixed(3)));
    }
    return { timings, active: container.dataset.mapZoomActive };
  });
  expect(warmup.active).toBe('true');

  const cdp = await page.context().newCDPSession(page);
  const { categories: availableCategories } = await cdp.send('Tracing.getCategories');
  const extraCategories = (availableCategories as string[]).filter((category) => (
    /(viz|gpu|skia|cc)/iu.test(category)
    && !/(memory-infra|capture|video|webrtc)/iu.test(category)
  ));
  const categories = [...new Set([
    'devtools.timeline',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame',
    'disabled-by-default-devtools.timeline.layers',
    'blink.user_timing',
    'cc',
    'gpu',
    'viz',
    ...extraCategories,
  ])];

  const traceEvents: TraceEvent[] = [];
  cdp.on('Tracing.dataCollected', (payload) => traceEvents.push(...(payload.value as TraceEvent[])));
  const tracingComplete = new Promise<void>((resolve) => cdp.once('Tracing.tracingComplete', () => resolve()));
  await cdp.send('Tracing.start', {
    categories: categories.join(','),
    options: 'record-as-much-as-possible',
    transferMode: 'ReportEvents',
  });

  const steady = await viewport.evaluate(async (container) => {
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const samples: FrameTiming[] = [];
    performance.mark('map-camera-viz-steady-start');
    for (let index = 0; index < 8; index += 1) {
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
    performance.mark('map-camera-viz-steady-end');
    return { samples, active: container.dataset.mapZoomActive };
  });

  await page.waitForTimeout(30);
  await cdp.send('Tracing.end');
  await tracingComplete;
  await cdp.detach();

  const start = markerTimestamp(traceEvents, 'map-camera-viz-steady-start');
  const end = markerTimestamp(traceEvents, 'map-camera-viz-steady-end');
  if (start == null || end == null) throw new Error('steady trace markers missing');
  const topEvents = aggregateSteadyEvents(traceEvents, start, end);
  const summary = {
    activeAfterSteady: steady.active,
    categories: categories.filter((category) => /(viz|gpu|skia|cc)/iu.test(category)),
    frameMs: steady.samples.map((sample) => sample.totalMs),
    frameMedianMs: Number(median(steady.samples.map((sample) => sample.totalMs)).toFixed(3)),
    dispatchMedianMs: Number(median(steady.samples.map((sample) => sample.dispatchMs)).toFixed(3)),
    topEvents,
  };
  console.log(`[map-camera-viz-steady] ${JSON.stringify(summary)}`);

  expect(summary.activeAfterSteady).toBe('true');
  expect(summary.topEvents.length).toBeGreaterThan(0);
});
