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

test('diagnose transient map compositing layers and paint counts', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const viewport = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  await expect.poll(async () => viewport.getAttribute('data-map-raster-ready'), { timeout: 15_000 }).toBe('true');
  await expect.poll(async () => viewport.getAttribute('data-map-zoom-active')).toBe('false');

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  let latestLayers: LayerSnapshot[] = [];
  const initialLayerTree = new Promise<void>((resolve) => {
    const listener = (payload: { layers: LayerSnapshot[] }) => {
      latestLayers = payload.layers;
      cdp.off('LayerTree.layerTreeDidChange', listener);
      resolve();
    };
    cdp.on('LayerTree.layerTreeDidChange', listener);
  });
  cdp.on('LayerTree.layerTreeDidChange', (payload) => { latestLayers = payload.layers as LayerSnapshot[]; });
  await cdp.send('LayerTree.enable');
  await initialLayerTree;

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

  const relevantLayers = () => latestLayers.filter((layer) => (
    layer.backendNodeId != null
    && Object.values(backendNodeIds).includes(layer.backendNodeId)
  ));

  const describeLayers = async () => Promise.all(relevantLayers().map(async (layer) => {
    let reasons: string[] = [];
    try {
      const response = await cdp.send('LayerTree.compositingReasons', { layerId: layer.layerId });
      reasons = response.compositingReasons ?? [];
    } catch {
      reasons = ['compositing-reasons-unavailable'];
    }
    const owner = Object.entries(backendNodeIds).find(([, backendNodeId]) => backendNodeId === layer.backendNodeId)?.[0] ?? 'unknown';
    return {
      owner,
      layerId: layer.layerId,
      parentLayerId: layer.parentLayerId ?? null,
      drawsContent: layer.drawsContent ?? null,
      paintCount: layer.paintCount ?? null,
      width: layer.width ?? null,
      height: layer.height ?? null,
      reasons,
    };
  }));

  await page.waitForTimeout(50);
  const idle = await describeLayers();

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

  await page.waitForTimeout(30);
  const active = await describeLayers();
  console.log(`[map-camera-layer-tree] backend=${JSON.stringify(backendNodeIds)} idle=${JSON.stringify(idle)} active=${JSON.stringify(active)} frames=${JSON.stringify(frames)}`);

  await cdp.detach();
  expect(backendNodeIds.raster).not.toBeNull();
  expect(latestLayers.length).toBeGreaterThan(0);
});
