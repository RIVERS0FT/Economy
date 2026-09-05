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
type Span = { event: TraceEvent; start: number; end: number };
type LayerSnapshot = { layerId: string; backendNodeId?: number };
const OWNER_SELECTORS = [
  ['image', '.application-image-layer img'],
  ['atmosphere', '.application-atmosphere-layer'],
  ['raster', '.province-map-camera-raster'],
  ['vignette', '.strategic-map-vignette'],
  ['status', '.frosted-glass-surface--statusBar'],
  ['workspace-card', '.signed-in-shell__primary-card'],
  ['outliner', '.strategic-outliner'],
] as const;
const roundMs = (microseconds: number) => Number((microseconds / 1000).toFixed(3));

function clippedSpans(events: TraceEvent[], start: number, end: number): Span[] {
  return events.flatMap((event) => {
    if (event.ph !== 'X' || !Number.isFinite(event.ts) || !Number.isFinite(event.dur)) return [];
    const left = Math.max(start, event.ts!);
    const right = Math.min(end, event.ts! + event.dur!);
    return right > left ? [{ event, start: left, end: right }] : [];
  });
}

function unionDuration(spans: Span[]) {
  let duration = 0;
  let right = -Infinity;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    duration += Math.max(0, span.end - Math.max(right, span.start));
    right = Math.max(right, span.end);
  }
  return duration;
}

function stageFor(name = '') {
  if (name === 'RasterTask') return 'raster';
  if (name === 'DirectRenderer::DrawFrame') return 'vizDraw';
  if (name === 'LayerTreeHost::WaitForCommitCompletion') return 'commitWait';
  if (name === 'Commit') return 'commit';
  if (name === 'Paint') return 'paint';
  if (/^(UpdateLayoutTree|Layout|PrePaint|Layerize)$/u.test(name)) return 'styleLayout';
  if (/^(EventDispatch|FunctionCall|FireAnimationFrame)$/u.test(name)) return 'script';
  return null;
}

function summarizeWindow(events: TraceEvent[], start: number, end: number, ownerByLayer: Map<string, string>) {
  const spans = clippedSpans(events, start, end);
  const stages: Record<string, { count: number; wallMs: number; threadSpanMs: number }> = {};
  for (const stage of ['script', 'styleLayout', 'paint', 'raster', 'commit', 'commitWait', 'vizDraw']) {
    const selected = spans.filter(({ event }) => stageFor(event.name) === stage);
    const threads = new Map<string, Span[]>();
    for (const span of selected) {
      const key = `${span.event.pid}:${span.event.tid}`;
      const thread = threads.get(key) ?? [];
      thread.push(span);
      threads.set(key, thread);
    }
    stages[stage] = {
      count: selected.length,
      wallMs: roundMs(unionDuration(selected)),
      // Thread spans may run in parallel; this is NOT a frame duration or CPU time.
      threadSpanMs: roundMs([...threads.values()].reduce((sum, thread) => sum + unionDuration(thread), 0)),
    };
  }
  const rasterLayers = new Map<string, Span[]>();
  for (const span of spans.filter(({ event }) => event.name === 'RasterTask')) {
    const tile = span.event.args?.tileData as { layerId?: number | string } | undefined;
    const id = tile?.layerId == null ? 'unmapped' : String(tile.layerId);
    const group = rasterLayers.get(id) ?? [];
    group.push(span);
    rasterLayers.set(id, group);
  }
  return {
    start,
    end,
    windowMs: roundMs(end - start),
    stages,
    rasterLayers: [...rasterLayers].map(([layerId, group]) => ({
      layerId,
      owner: ownerByLayer.get(layerId) ?? 'unmapped',
      count: group.length,
      wallMs: roundMs(unionDuration(group)),
    })),
    longestEvents: spans
      .filter(({ event }) => stageFor(event.name) !== null)
      .sort((a, b) => (b.end - b.start) - (a.end - a.start))
      .slice(0, 8)
      .map(({ event, start: left, end: right }) => ({
        name: event.name,
        pid: event.pid,
        tid: event.tid,
        overlapMs: roundMs(right - left),
        fullEventMs: roundMs(event.dur!),
        args: event.args,
      })),
  };
}

function summarizeInternals(events: TraceEvent[], start: number, end: number) {
  const threadNames = new Map<string, string>();
  for (const event of events) {
    if (event.ph === 'M' && event.name === 'thread_name' && typeof event.args?.name === 'string') {
      threadNames.set(`${event.pid}:${event.tid}`, event.args.name);
    }
  }
  const groups = new Map<string, Span[]>();
  for (const span of clippedSpans(events, start, end)) {
    const key = `${span.event.pid}:${span.event.tid}:${span.event.name}`;
    const group = groups.get(key) ?? [];
    group.push(span);
    groups.set(key, group);
  }
  return [...groups.values()].map((spans) => {
    const event = spans[0].event;
    return {
      name: event.name, category: event.cat, pid: event.pid, tid: event.tid,
      thread: threadNames.get(`${event.pid}:${event.tid}`) ?? 'unmapped',
      count: spans.length,
      wallMs: roundMs(unionDuration(spans)),
      maxOverlapMs: roundMs(spans.reduce((maximum, span) => Math.max(maximum, span.end - span.start), 0)),
    };
  }).sort((a, b) => b.wallMs - a.wallMs).slice(0, 80);
}

// Timeline profiling is a separate pass from the performance gate. Never run a
// screenshot screencast alongside either pass; other visual tests keep theirs.
test.use({ trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true } });

test('frame trace accounting clips crossing events and unions nested and parallel spans', () => {
  const events: TraceEvent[] = [
    { name: 'Paint', ph: 'X', ts: 5_000, dur: 30_000, pid: 1, tid: 1 },
    { name: 'Paint', ph: 'X', ts: 12_000, dur: 3_000, pid: 1, tid: 1 },
    { name: 'RasterTask', ph: 'X', ts: 12_000, dur: 6_000, pid: 1, tid: 2 },
    { name: 'RasterTask', ph: 'X', ts: 14_000, dur: 6_000, pid: 1, tid: 3 },
    { name: 'Paint', ph: 'X', ts: 20_000, dur: 5_000, pid: 1, tid: 1 },
    { name: 'Paint', ph: 'X', ts: 9_000, dur: -1_000, pid: 1, tid: 1 },
  ];
  const summary = summarizeWindow(events, 10_000, 20_000, new Map());
  expect(summary.windowMs).toBe(10);
  expect(summary.stages.paint).toEqual({ count: 2, wallMs: 10, threadSpanMs: 10 });
  expect(summary.stages.raster).toEqual({ count: 2, wallMs: 8, threadSpanMs: 12 });
  expect(summary.longestEvents[0]).toMatchObject({ overlapMs: 10, fullEventMs: 30 });
  expect(summarizeWindow(events, 35_000, 40_000, new Map()).stages.paint.count).toBe(0);
});

test('trace steady transient map Viz and GPU draw internals', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(viewport).toHaveAttribute('data-map-raster-ready', 'true', { timeout: 15_000 });
  await expect(viewport).toHaveAttribute('data-map-zoom-active', 'false');

  const cdp = await page.context().newCDPSession(page);
  const events: TraceEvent[] = [];
  const layerNodes = new Map<string, Set<number>>();
  cdp.on('LayerTree.layerTreeDidChange', (payload: { layers?: LayerSnapshot[] }) => {
    for (const layer of payload.layers ?? []) {
      if (layer.backendNodeId == null) continue;
      const nodes = layerNodes.get(layer.layerId) ?? new Set<number>();
      nodes.add(layer.backendNodeId);
      layerNodes.set(layer.layerId, nodes);
    }
  });
  cdp.on('Tracing.dataCollected', (payload) => {
    for (const event of payload.value as TraceEvent[]) events.push(event);
  });
  const complete = new Promise<{ dataLossOccurred?: boolean }>((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  let tracing = false;
  try {
    await cdp.send('DOM.enable');
    await cdp.send('LayerTree.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 1, pierce: true });
    const owners: Array<{ name: string; selector: string; backendNodeId: number | null }> = [];
    for (const [name, selector] of OWNER_SELECTORS) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
      const node = nodeId ? (await cdp.send('DOM.describeNode', { nodeId })).node : null;
      owners.push({ name, selector, backendNodeId: node?.backendNodeId ?? null });
    }
    // Explicit bounded categories: picture/display-item/quad dumps can overwhelm
    // the trace buffers during the first vector-to-raster transition.
    const categories = [
      'devtools.timeline', 'disabled-by-default-devtools.timeline',
      'blink.user_timing', 'cc', 'gpu', 'viz', 'disabled-by-default-skia',
    ];
    const browserCdp = await browser.newBrowserCDPSession();
    let gpu: unknown;
    try {
      const info = await browserCdp.send('SystemInfo.getInfo');
      gpu = {
        featureStatus: info.gpu.featureStatus,
        renderer: info.gpu.auxAttributes?.glRenderer ?? null,
      };
    } catch (error) {
      gpu = { unavailable: String(error) };
    } finally {
      await browserCdp.detach();
    }
    const environment = {
      categories, gpu,
      browserVersion: browser.version(),
      commit: process.env.GITHUB_SHA ?? null,
      runner: process.env.RUNNER_OS ?? null,
      screenshots: false,
      viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio })),
    };
    await cdp.send('Tracing.start', {
      traceConfig: {
        recordMode: 'recordAsMuchAsPossible',
        includedCategories: categories,
        traceBufferSizeInKb: 32768,
      },
      transferMode: 'ReportEvents',
    });
    tracing = true;
    const phases = await viewport.evaluate(async (container) => {
      const bounds = container.getBoundingClientRect();
      const svg = container.querySelector('.province-map-world-svg');
      const before = { revision: container.dataset.mapRasterRevision, viewBox: svg?.getAttribute('viewBox') };
      let previousRaf: number | null = null;
      const results = [];
      for (const [phase, count] of [['cold', 6], ['warmup', 12], ['steady', 12]] as const) {
        const samples = [];
        performance.mark(`map-camera-${phase}-start`);
        for (let index = 0; index < count; index += 1) {
          const prefix = `map-camera-${phase}-${index}`;
          performance.mark(`${prefix}-start`);
          const started = performance.now();
          container.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true, cancelable: true,
            clientX: bounds.left + bounds.width * 0.54,
            clientY: bounds.top + bounds.height * 0.47,
            deltaY: phase === 'cold' && index === 0 ? -40 : index % 2 === 0 ? -18 : 18,
          }));
          const dispatched = performance.now();
          const rafTimestamp = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
          const finished = performance.now();
          performance.mark(`${prefix}-end`);
          samples.push({
            index, prefix,
            inputToRafMs: finished - started,
            dispatchMs: dispatched - started,
            rafWaitMs: finished - dispatched,
            rafTimestampIntervalMs: previousRaf == null ? null : rafTimestamp - previousRaf,
          });
          previousRaf = rafTimestamp;
        }
        performance.mark(`map-camera-${phase}-end`);
        results.push({ phase, samples });
      }
      return {
        results, before,
        after: { revision: container.dataset.mapRasterRevision, viewBox: svg?.getAttribute('viewBox') },
        active: container.dataset.mapZoomActive,
      };
    });
    await cdp.send('Tracing.end');
    tracing = false;
    const completion = await complete;
    const ownerByNode = new Map(owners.filter((owner) => owner.backendNodeId != null).map((owner) => [owner.backendNodeId!, owner.name]));
    const ownerByLayer = new Map([...layerNodes].map(([id, nodes]) => [
      id, nodes.size === 1 ? ownerByNode.get([...nodes][0]) ?? 'unmapped' : 'ambiguous',
    ]));
    const timestamp = (name: string) => {
      const value = events.find((event) => event.name === name && typeof event.ts === 'number')?.ts;
      if (value == null) throw new Error(`Missing trace marker: ${name}`);
      return value;
    };
    // Preserve raw events even if subsequent marker/consistency assertions fail.
    await testInfo.attach('map-camera-chrome-trace.json', {
      body: Buffer.from(JSON.stringify({ traceEvents: events, metadata: { ...environment, completion, phases } })),
      contentType: 'application/json',
    });
    expect(completion.dataLossOccurred, 'Chrome trace buffer must retain every frame marker').not.toBe(true);
    const summary = {
      environment, completion, owners, layerOwners: [...ownerByLayer],
      accounting: 'X-event overlap with input-to-RAF windows; union per stage; stage/thread values are not additive frame or GPU durations',
      phases: phases.results.map(({ phase, samples }) => ({
        phase,
        ...summarizeWindow(events, timestamp(`map-camera-${phase}-start`), timestamp(`map-camera-${phase}-end`), ownerByLayer),
        topEvents: summarizeInternals(events, timestamp(`map-camera-${phase}-start`), timestamp(`map-camera-${phase}-end`)),
        frames: samples.map((sample) => ({
          ...sample,
          ...summarizeWindow(events, timestamp(`${sample.prefix}-start`), timestamp(`${sample.prefix}-end`), ownerByLayer),
        })),
      })),
    };
    await testInfo.attach('map-camera-frame-analysis.json', {
      body: Buffer.from(JSON.stringify(summary, null, 2)), contentType: 'application/json',
    });
    for (const phase of summary.phases) {
      const sorted = phase.frames.map((frame) => frame.inputToRafMs).sort((a, b) => a - b);
      console.log(`[map-camera-frame-analysis] ${JSON.stringify({ phase: phase.phase, medianMs: sorted[Math.floor(sorted.length / 2)], stages: phase.stages, frames: phase.frames.map((frame) => ({ index: frame.index, inputToRafMs: frame.inputToRafMs, stages: frame.stages })) })}`);
      for (const frame of phase.frames) {
        for (const stage of Object.values(frame.stages)) expect(stage.wallMs).toBeLessThanOrEqual(frame.windowMs + 0.001);
      }
    }
    console.log(`[map-camera-viz-steady] ${JSON.stringify(summary.phases.find((phase) => phase.phase === 'steady')?.topEvents)}`);
    expect(completion.dataLossOccurred).not.toBe(true);
    expect(phases.before).toEqual(phases.after);
    expect(phases.active).toBe('true');
    expect(summary.phases.map((phase) => phase.frames.length)).toEqual([6, 12, 12]);
  } finally {
    if (tracing) await cdp.send('Tracing.end').catch(() => undefined);
    await cdp.detach().catch(() => undefined);
  }
});
