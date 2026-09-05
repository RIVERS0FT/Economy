import { writeFile } from 'node:fs/promises';
import { expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';

type TraceEvent = {
  name?: string; cat?: string; ph?: string; ts?: number; dur?: number;
  pid?: number; tid?: number; args?: Record<string, unknown>;
};
type Span = { event: TraceEvent; start: number; end: number };
type LayerSnapshot = { layerId: string; backendNodeId?: number };
type Control = { name: string; selector: string; property: 'filter' | 'backdrop-filter' };
const OWNER_SELECTORS = [
  ['image', '.application-image-layer img'],
  ['atmosphere', '.application-atmosphere-layer'],
  ['raster', '.province-map-camera-raster'],
  ['vignette', '.strategic-map-vignette'],
  ['status', '.frosted-glass-surface--statusBar'],
  ['workspace-card', '.signed-in-shell__primary-card'],
  ['outliner', '.strategic-outliner'],
] as const;
const CONTROLS: Control[] = [
  { name: 'photography-filter', selector: '.application-image-layer img', property: 'filter' },
  { name: 'status-backdrop', selector: '.frosted-glass-surface--statusBar', property: 'backdrop-filter' },
  { name: 'workspace-backdrop', selector: '.signed-in-shell__primary-card', property: 'backdrop-filter' },
  { name: 'outliner-backdrop', selector: '.strategic-outliner', property: 'backdrop-filter' },
];
const roundMs = (microseconds: number) => Number((microseconds / 1000).toFixed(3));
const distribution = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    count: sorted.length,
    medianMs: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
  };
};

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
      count: selected.length, wallMs: roundMs(unionDuration(selected)),
      // Parallel thread spans and nested stages are not additive frame/CPU time.
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
    start, end, windowMs: roundMs(end - start), stages,
    rasterLayers: [...rasterLayers].map(([layerId, group]) => ({
      layerId, owner: ownerByLayer.get(layerId) ?? 'unmapped',
      count: group.length, wallMs: roundMs(unionDuration(group)),
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
      count: spans.length, wallMs: roundMs(unionDuration(spans)),
      maxOverlapMs: roundMs(spans.reduce((maximum, span) => Math.max(maximum, span.end - span.start), 0)),
    };
  }).sort((a, b) => b.wallMs - a.wallMs).slice(0, 80);
}

function renderBatches(events: TraceEvent[], start: number, end: number) {
  const spans = clippedSpans(events, start, end);
  // Parentage uses original timestamps and pid/tid, not clipped window edges.
  // RenderPass ids are not LayerTree ids; no DOM attribution is invented here.
  const inside = (child: Span, parent: Span) => child.event !== parent.event
    && child.event.pid === parent.event.pid && child.event.tid === parent.event.tid
    && child.event.ts! >= parent.event.ts!
    && child.event.ts! + child.event.dur! <= parent.event.ts! + parent.event.dur!;
  const describe = (span: Span) => ({
    name: span.event.name, pid: span.event.pid, tid: span.event.tid,
    ts: span.event.ts, fullEventMs: roundMs(span.event.dur!),
    overlapMs: roundMs(span.end - span.start), args: span.event.args ?? null,
  });
  return spans.filter(({ event }) => event.name === 'DirectRenderer::DrawFrame').map((frame) => ({
    ...describe(frame),
    renderPasses: spans.filter((span) => span.event.name === 'DirectRenderer::DrawRenderPass' && inside(span, frame)).map((pass) => ({
      ...describe(pass),
      quads: spans.filter((span) => /::DoDrawQuad$/u.test(span.event.name ?? '') && inside(span, pass)).map((quad) => ({
        ...describe(quad),
        skiaCalls: spans.filter((span) => /^SkCanvas::/u.test(span.event.name ?? '') && inside(span, quad)).map(describe),
      })),
    })),
  }));
}
async function artifact(testInfo: TestInfo, name: string, value: unknown) {
  const path = testInfo.outputPath(name);
  await writeFile(path, JSON.stringify(value, null, name.includes('chrome-trace') ? undefined : 2));
  await testInfo.attach(name, { path, contentType: 'application/json' });
}
async function profile(page: Page, browser: Browser, testInfo: TestInfo, label: string, control?: Control) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect(viewport).toHaveAttribute('data-map-raster-ready', 'true', { timeout: 15_000 });
  await expect(viewport).toHaveAttribute('data-map-zoom-active', 'false');
  if (control) {
    await expect(page.locator(control.selector)).toHaveCount(1);
    const prefix = control.property === 'backdrop-filter' ? '-webkit-backdrop-filter: none !important;' : '';
    await page.addStyleTag({ content: `${control.selector} { ${control.property}: none !important; ${prefix} }` });
    await expect(page.locator(control.selector)).toHaveCSS(control.property, 'none');
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll<HTMLImageElement>('.application-image-layer img')].map((image) => image.decode()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const scene = await page.evaluate((selectors) => selectors.map(([name, selector]) => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing profile surface: ${selector}`);
    const css = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      name, x: box.x, y: box.y, width: box.width, height: box.height,
      filter: css.filter, backdropFilter: css.backdropFilter,
      background: css.background, shadow: css.boxShadow, opacity: css.opacity,
    };
  }), OWNER_SELECTORS);
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
  cdp.on('Tracing.dataCollected', (payload) => { for (const event of payload.value as TraceEvent[]) events.push(event); });
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
    const categories = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'blink.user_timing', 'cc', 'gpu', 'viz', 'disabled-by-default-skia'];
    const browserCdp = await browser.newBrowserCDPSession();
    let gpu: unknown;
    try {
      const info = await browserCdp.send('SystemInfo.getInfo');
      gpu = { featureStatus: info.gpu.featureStatus, renderer: info.gpu.auxAttributes?.glRenderer ?? null };
    } catch (error) { gpu = { unavailable: String(error) }; }
    finally { await browserCdp.detach(); }
    const environment = {
      categories, gpu, label, control: control ?? null, scene,
      browserVersion: browser.version(), commit: process.env.GITHUB_SHA ?? null,
      runner: process.env.RUNNER_OS ?? null, screenshots: false,
      viewport: await page.evaluate(() => ({ width: innerWidth, height: innerHeight, devicePixelRatio })),
    };
    await cdp.send('Tracing.start', {
      traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: categories, traceBufferSizeInKb: 32768 },
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
            clientX: bounds.left + bounds.width * 0.54, clientY: bounds.top + bounds.height * 0.47,
            deltaY: phase === 'cold' && index === 0 ? -40 : index % 2 === 0 ? -18 : 18,
          }));
          const dispatched = performance.now();
          const rafTimestamp = await new Promise<number>((resolve) => requestAnimationFrame(resolve));
          const finished = performance.now();
          performance.mark(`${prefix}-end`);
          samples.push({ index, prefix, inputToRafMs: finished - started, dispatchMs: dispatched - started,
            rafWaitMs: finished - dispatched, rafTimestampIntervalMs: previousRaf == null ? null : rafTimestamp - previousRaf });
          previousRaf = rafTimestamp;
        }
        performance.mark(`map-camera-${phase}-end`);
        results.push({ phase, samples });
      }
      return { results, before,
        after: { revision: container.dataset.mapRasterRevision, viewBox: svg?.getAttribute('viewBox') },
        active: container.dataset.mapZoomActive };
    });
    await cdp.send('Tracing.end');
    tracing = false;
    const completion = await complete;
    await artifact(testInfo, `${label}-chrome-trace.json`, { traceEvents: events, metadata: { ...environment, completion, phases } });
    expect(completion.dataLossOccurred, 'Chrome trace buffer must retain every frame marker').not.toBe(true);
    const ownerByNode = new Map(owners.filter((owner) => owner.backendNodeId != null).map((owner) => [owner.backendNodeId!, owner.name]));
    const ownerByLayer = new Map([...layerNodes].map(([id, nodes]) => [id, nodes.size === 1 ? ownerByNode.get([...nodes][0]) ?? 'unmapped' : 'ambiguous']));
    const timestamp = (name: string) => {
      const value = events.find((event) => event.name === name && typeof event.ts === 'number')?.ts;
      if (value == null) throw new Error(`Missing trace marker: ${name}`);
      return value;
    };
    const summary = {
      environment, completion, owners, layerOwners: [...ownerByLayer],
      accounting: 'X-event window intersections; unions per stage; nested stages and parallel threads are NOT additive frame/GPU durations; renderPass ids are NOT DOM layer ids',
      phases: phases.results.map(({ phase, samples }) => ({
        phase, ...distribution(samples.map((sample) => sample.inputToRafMs)),
        ...summarizeWindow(events, timestamp(`map-camera-${phase}-start`), timestamp(`map-camera-${phase}-end`), ownerByLayer),
        topEvents: summarizeInternals(events, timestamp(`map-camera-${phase}-start`), timestamp(`map-camera-${phase}-end`)),
        frames: samples.map((sample) => ({ ...sample,
          ...summarizeWindow(events, timestamp(`${sample.prefix}-start`), timestamp(`${sample.prefix}-end`), ownerByLayer),
          renderBatches: renderBatches(events, timestamp(`${sample.prefix}-start`), timestamp(`${sample.prefix}-end`)),
        })),
      })),
    };
    await artifact(testInfo, `${label}-frame-analysis.json`, summary);
    for (const phase of summary.phases) {
      for (const frame of phase.frames) {
        for (const stage of Object.values(frame.stages)) expect(stage.wallMs).toBeLessThanOrEqual(frame.windowMs + 0.001);
      }
    }
    expect(phases.before).toEqual(phases.after);
    expect(phases.active).toBe('true');
    expect(summary.phases.map((phase) => phase.frames.length)).toEqual([6, 12, 12]);
    const compact = {
      label, control: control?.name ?? 'baseline', scene,
      phases: summary.phases.map((phase) => ({ phase: phase.phase, medianMs: phase.medianMs, p95Ms: phase.p95Ms,
        maxMs: phase.maxMs, stages: phase.stages, drawPasses: phase.topEvents.filter((event) => /DrawFrame|DrawRenderPass|DoDrawQuad|SkCanvas::drawImage/u.test(event.name ?? '')) })),
    };
    console.log(`[map-compositor-control] ${JSON.stringify(compact)}`);
    return compact;
  } finally {
    if (tracing) await cdp.send('Tracing.end').catch(() => undefined);
    await cdp.detach().catch(() => undefined);
  }
}

// File-scope worker fixture: no screenshot readbacks contaminate these controls.
// The unprofiled performance gate lives in map-zoom-transient.spec.ts unchanged.
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
  expect(summarizeWindow(events, 35_000, 40_000, new Map()).stages.paint.count).toBe(0);
  const draw: TraceEvent[] = [
    { name: 'DirectRenderer::DrawFrame', ph: 'X', ts: 5_000, dur: 30_000, pid: 1, tid: 1 },
    { name: 'DirectRenderer::DrawRenderPass', ph: 'X', ts: 6_000, dur: 25_000, pid: 1, tid: 1, args: { render_pass_id: 99 } },
    { name: 'SoftwareRenderer::DoDrawQuad', ph: 'X', ts: 7_000, dur: 20_000, pid: 1, tid: 1 },
    { name: 'SkCanvas::drawImage', ph: 'X', ts: 8_000, dur: 18_000, pid: 1, tid: 1 },
    { name: 'SoftwareRenderer::DoDrawQuad', ph: 'X', ts: 7_000, dur: 20_000, pid: 2, tid: 1 },
  ];
  const batch = renderBatches(draw, 10_000, 20_000)[0];
  expect(batch).toMatchObject({ fullEventMs: 30, overlapMs: 10 });
  expect(batch.renderPasses).toHaveLength(1);
  expect(batch.renderPasses[0].quads).toHaveLength(1);
  expect(batch.renderPasses[0].quads[0].skiaCalls[0].overlapMs).toBe(10);
});

test('trace steady transient map Viz and GPU draw internals', async ({ page, browser }, testInfo) => {
  test.setTimeout(120_000);
  await profile(page, browser, testInfo, 'map-camera');
});

for (const control of CONTROLS) {
  test(`single-surface compositor attribution: ${control.name}`, async ({ page, browser }, testInfo) => {
    test.setTimeout(120_000);
    const results = [];
    // Repeat matched baseline/control/baseline triplets, retaining every sample.
    // These temporary removals locate costs; they NEVER qualify the product gate.
    for (let round = 0; round < 2; round += 1) {
      for (const phase of ['before', 'control', 'after'] as const) {
        results.push(await profile(page, browser, testInfo, `${control.name}-${round}-${phase}`, phase === 'control' ? control : undefined));
      }
    }
    await artifact(testInfo, 'map-compositor-comparison.json', results);
    expect(results).toHaveLength(6);
    const geometry = (result: typeof results[number]) => result.scene.map(({ name, x, y, width, height }) => ({ name, x, y, width, height }));
    for (const result of results) expect(geometry(result)).toEqual(geometry(results[0]));
  });
}
