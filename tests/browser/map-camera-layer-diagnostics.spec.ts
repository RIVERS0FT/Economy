import { expect, test } from '@playwright/test';

type LayerSnapshot = {
  layerId: string;
  backendNodeId?: number;
  parentLayerId?: string;
  drawsContent?: boolean;
  paintCount?: number;
  width?: number;
  height?: number;
};

type PaintedLayer = {
  layerId: string;
  clip?: unknown;
};

test('diagnose transient map compositing layers and paint counts', async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect.poll(async () => viewport.getAttribute('data-map-raster-ready'), { timeout: 15_000 }).toBe('true');
  await expect.poll(async () => viewport.getAttribute('data-map-zoom-active')).toBe('false');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('LayerTree.enable');

  let latestLayers: LayerSnapshot[] = [];
  let layerTreeRevision = 0;
  const paintedLayers: PaintedLayer[] = [];
  cdp.on('LayerTree.layerTreeDidChange', (payload) => {
    latestLayers = payload.layers as LayerSnapshot[];
    layerTreeRevision += 1;
  });
  cdp.on('LayerTree.layerPainted', (payload) => {
    paintedLayers.push(payload as PaintedLayer);
  });

  const { root } = await cdp.send('DOM.getDocument', { depth: 1, pierce: true });
  const backendNodeIdFor = async (selector: string) => {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector });
    if (!nodeId) return null;
    const { node } = await cdp.send('DOM.describeNode', { nodeId });
    return node.backendNodeId ?? null;
  };

  const backendNodeIds = {
    viewport: await backendNodeIdFor('.province-map-static-viewport'),
    surface: await backendNodeIdFor('.province-map-camera-surface'),
    svg: await backendNodeIdFor('.province-map-world-svg'),
    raster: await backendNodeIdFor('.province-map-camera-raster'),
  };

  const describeBackendNode = async (backendNodeId?: number) => {
    if (backendNodeId == null) return null;
    try {
      const { node } = await cdp.send('DOM.describeNode', { backendNodeId, depth: 0, pierce: true });
      const attributes = Object.fromEntries(Array.from({ length: Math.floor((node.attributes?.length ?? 0) / 2) }, (_, index) => [
        node.attributes?.[index * 2] ?? '',
        node.attributes?.[index * 2 + 1] ?? '',
      ]));
      return {
        nodeName: node.nodeName,
        localName: node.localName,
        id: attributes.id ?? null,
        class: attributes.class ?? null,
        dataTestId: attributes['data-testid'] ?? null,
      };
    } catch {
      return { nodeName: 'unavailable', localName: '', id: null, class: null, dataTestId: null };
    }
  };

  const frames = await viewport.evaluate(async (container) => {
    const bounds = container.getBoundingClientRect();
    const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const samples: Array<{ index: number; totalMs: number }> = [];
    for (let index = 0; index < 6; index += 1) {
      const started = performance.now();
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width * 0.54,
        clientY: bounds.top + bounds.height * 0.47,
        deltaY: index % 2 === 0 ? -18 : 18,
      }));
      await nextFrame();
      samples.push({ index, totalMs: Number((performance.now() - started).toFixed(3)) });
    }
    return samples;
  });

  await expect.poll(() => layerTreeRevision, { timeout: 3_000 }).toBeGreaterThan(0);
  const activeLayers = [...latestLayers];
  const activeRevision = layerTreeRevision;
  const paintedCounts = new Map<string, number>();
  for (const painted of paintedLayers) paintedCounts.set(painted.layerId, (paintedCounts.get(painted.layerId) ?? 0) + 1);

  const layerById = new Map(activeLayers.map((layer) => [layer.layerId, layer]));
  const targetLayerIds = new Set(activeLayers
    .filter((layer) => layer.backendNodeId != null && Object.values(backendNodeIds).includes(layer.backendNodeId))
    .map((layer) => layer.layerId));
  const includeLayerIds = new Set<string>([
    ...targetLayerIds,
    ...paintedCounts.keys(),
    ...activeLayers.filter((layer) => (layer.paintCount ?? 0) > 0).map((layer) => layer.layerId),
  ]);
  for (const layerId of [...targetLayerIds]) {
    let current = layerById.get(layerId);
    while (current?.parentLayerId) {
      includeLayerIds.add(current.parentLayerId);
      current = layerById.get(current.parentLayerId);
    }
  }

  const describeLayer = async (layer: LayerSnapshot) => {
    let reasons: string[] = [];
    try {
      const response = await cdp.send('LayerTree.compositingReasons', { layerId: layer.layerId });
      reasons = response.compositingReasons ?? [];
    } catch {
      reasons = ['compositing-reasons-unavailable'];
    }
    const targetOwner = Object.entries(backendNodeIds).find(([, backendNodeId]) => backendNodeId === layer.backendNodeId)?.[0] ?? null;
    return {
      targetOwner,
      node: await describeBackendNode(layer.backendNodeId),
      layerId: layer.layerId,
      parentLayerId: layer.parentLayerId ?? null,
      backendNodeId: layer.backendNodeId ?? null,
      drawsContent: layer.drawsContent ?? null,
      paintCount: layer.paintCount ?? null,
      paintedEvents: paintedCounts.get(layer.layerId) ?? 0,
      width: layer.width ?? null,
      height: layer.height ?? null,
      reasons,
    };
  };

  const active = await Promise.all(activeLayers
    .filter((layer) => includeLayerIds.has(layer.layerId))
    .map(describeLayer));

  await expect.poll(async () => viewport.getAttribute('data-map-zoom-active'), { timeout: 3_000 }).toBe('false');
  await page.waitForTimeout(50);
  const settled = await Promise.all(latestLayers
    .filter((layer) => includeLayerIds.has(layer.layerId) || (layer.paintCount ?? 0) > 0)
    .map(describeLayer));

  console.log(`[map-camera-layer-tree] backend=${JSON.stringify(backendNodeIds)} revisions=${JSON.stringify({ active: activeRevision, settled: layerTreeRevision })} painted=${JSON.stringify([...paintedCounts.entries()])} active=${JSON.stringify(active)} settled=${JSON.stringify(settled)} frames=${JSON.stringify(frames)}`);

  await cdp.detach();
  expect(backendNodeIds.raster).not.toBeNull();
  expect(layerTreeRevision).toBeGreaterThan(0);
});
