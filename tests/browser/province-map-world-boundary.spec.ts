import { expect, test, type Locator, type Page } from '@playwright/test';

async function dragToEdge(canvas: Locator, direction: 'right' | 'down' | 'left' | 'up', times = 4) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('map bounds missing');
  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  const endX = direction === 'right' ? bounds.x + bounds.width - 8 : direction === 'left' ? bounds.x + 8 : startX;
  const endY = direction === 'down' ? bounds.y + bounds.height - 8 : direction === 'up' ? bounds.y + 8 : startY;
  await canvas.evaluate((element, input) => {
    const target = element as HTMLElement;
    const originalCapture = target.setPointerCapture;
    Object.defineProperty(target, 'setPointerCapture', { configurable: true, value: () => {} });
    try {
      for (let index = 0; index < input.times; index += 1) {
        const pointerId = 700 + index;
        target.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: true,
          pointerId,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: input.startX,
          clientY: input.startY,
        }));
        target.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true,
          pointerId,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: input.endX,
          clientY: input.endY,
        }));
        target.dispatchEvent(new PointerEvent('pointerup', {
          bubbles: true,
          pointerId,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: input.endX,
          clientY: input.endY,
        }));
      }
    } finally {
      if (originalCapture) Object.defineProperty(target, 'setPointerCapture', { configurable: true, value: originalCapture });
      else delete (target as HTMLElement & { setPointerCapture?: (pointerId: number) => void }).setPointerCapture;
    }
  }, { startX, startY, endX, endY, times });
}

async function zoomIn(page: Page, canvas: Locator, times = 5) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('map bounds missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let index = 0; index < times; index += 1) await page.mouse.wheel(0, -420);
}

async function readCameraViewBox(canvas: Locator) {
  return canvas.locator('.province-map-world-svg').evaluate((svg) => new Promise<{ x: number; y: number; width: number; height: number }>((resolve) => {
    requestAnimationFrame(() => {
      const box = (svg as SVGSVGElement).viewBox.baseVal;
      resolve({ x: box.x, y: box.y, width: box.width, height: box.height });
    });
  }));
}

async function waitForSettledCamera(canvas: Locator) {
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
}

function parseWorldBounds(value: string | null) {
  const [minX, minY, maxX, maxY] = String(value || '').split(/\s+/u).map(Number);
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) throw new Error('fixed camera world bounds missing');
  return { minX, minY, maxX, maxY };
}

function expectViewInsideBounds(
  view: { x: number; y: number; width: number; height: number },
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  expect(view.x).toBeGreaterThanOrEqual(bounds.minX - 0.02);
  expect(view.y).toBeGreaterThanOrEqual(bounds.minY - 0.02);
  expect(view.x + view.width).toBeLessThanOrEqual(bounds.maxX + 0.02);
  expect(view.y + view.height).toBeLessThanOrEqual(bounds.maxY + 0.02);
}

async function mainlandFootprint(page: Page) {
  return page.getByTestId('us-mainland-map').evaluate((map) => {
    const canvas = map.querySelector<HTMLElement>('.province-map-static-viewport');
    const regions = [...map.querySelectorAll<SVGGraphicsElement>('.province-map-region')];
    if (!canvas || regions.length !== 48) throw new Error('mainland footprint geometry missing');
    const canvasRect = canvas.getBoundingClientRect();
    const rects = regions.map((region) => region.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return {
      widthRatio: (right - left) / canvasRect.width,
      heightRatio: (bottom - top) / canvasRect.height,
      areaRatio: ((right - left) * (bottom - top)) / (canvasRect.width * canvasRect.height),
      centerOffsetX: (left + right) / 2 - (canvasRect.left + canvasRect.right) / 2,
      centerOffsetY: (top + bottom) / 2 - (canvasRect.top + canvasRect.bottom) / 2,
    };
  });
}

test('world context keeps 10m land fill, lightweight 110m strokes and the contiguous-US 10m seam while only states stay interactive', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const shadow = map.locator('.province-map-world-shadow');
  const fill = map.locator('.province-map-world-fill');
  const outline = map.locator('.province-map-world-outline');
  const mainlandOutline = map.locator('.province-map-mainland-outline');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-world-context', 'continents-10m-fill-110m-stroke');
  await expect(canvas).toHaveAttribute('data-map-world-fill-resolution', '10m');
  await expect(canvas).toHaveAttribute('data-map-world-stroke-resolution', '110m');
  await expect(canvas).toHaveAttribute('data-map-mainland-outline-resolution', '10m');
  await expect(canvas).toHaveAttribute('data-map-world-interactive', 'false');
  await expect(canvas).toHaveAttribute('data-map-world-shadow-path-count', '1');
  await expect(canvas).toHaveAttribute('data-map-world-fill-path-count', '1');
  await expect(canvas).toHaveAttribute('data-map-world-outline-path-count', '1');
  await expect(canvas).toHaveAttribute('data-map-mainland-outline-path-count', '1');
  await expect(shadow).toHaveCount(1);
  await expect(fill).toHaveCount(1);
  await expect(outline).toHaveCount(1);
  await expect(mainlandOutline).toHaveCount(1);
  await expect(shadow).toHaveAttribute('data-world-resolution', '110m');
  await expect(fill).toHaveAttribute('data-world-resolution', '10m');
  await expect(outline).toHaveAttribute('data-world-outline', 'continents-110m-stroke');
  await expect(outline).toHaveAttribute('data-world-resolution', '110m');
  await expect(mainlandOutline).toHaveAttribute('data-mainland-outline', 'states-10m-union');
  await expect(mainlandOutline).toHaveAttribute('data-mainland-outline-source', 'us-atlas-states-10m');
  for (const layer of [shadow, fill, outline, mainlandOutline]) {
    await expect(layer).toHaveAttribute('data-interactive', 'false');
    await expect(layer).toHaveCSS('pointer-events', 'none');
    expect(await layer.getAttribute('role')).toBeNull();
    expect(await layer.getAttribute('tabindex')).toBeNull();
  }
  await expect(fill).not.toHaveCSS('fill', 'none');
  await expect(shadow).toHaveCSS('filter', 'none');
  await expect(shadow).toHaveCSS('fill', 'none');
  await expect(shadow).not.toHaveCSS('stroke', 'none');
  await expect(map.locator('.province-map-region')).toHaveCount(48);
  await expect(map.locator('.province-map-region[role="button"]')).toHaveCount(48);

  const pathComplexity = await map.evaluate((element) => {
    const stats = (selector: string) => {
      const path = element.querySelector<SVGPathElement>(selector)?.getAttribute('d') ?? '';
      return {
        path,
        characters: path.length,
        vertices: path.match(/[ML]/g)?.length ?? 0,
      };
    };
    return {
      shadow: stats('.province-map-world-shadow'),
      fill: stats('.province-map-world-fill'),
      outline: stats('.province-map-world-outline'),
    };
  });
  expect(pathComplexity.fill.vertices).toBeGreaterThan(100_000);
  expect(pathComplexity.shadow.vertices).toBeLessThan(2_000);
  expect(pathComplexity.outline.vertices).toBeLessThan(2_000);
  expect(pathComplexity.shadow.characters).toBeLessThan(30_000);
  expect(pathComplexity.outline.characters).toBeLessThan(30_000);
  expect(pathComplexity.shadow.path).toBe(pathComplexity.outline.path);
  expect(pathComplexity.outline.path).not.toBe(pathComplexity.fill.path);

  const outlinePathBefore = pathComplexity.outline.path;
  const mainlandPathBefore = await mainlandOutline.getAttribute('d');
  expect(outlinePathBefore?.length || 0).toBeGreaterThan(100);
  expect(mainlandPathBefore?.length || 0).toBeGreaterThan(100);
  await zoomIn(page, canvas, 3);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.2);
  expect(await outline.getAttribute('d')).toBe(outlinePathBefore);
  expect(await mainlandOutline.getAttribute('d')).toBe(mainlandPathBefore);
});

test('minimum zoom centers the mainland and every zoom level stays inside one fixed world boundary', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-zoom-min', '1');
  await expect(canvas).toHaveAttribute('data-map-pan-boundary', 'fixed-world-context');
  await expect(canvas).toHaveAttribute('data-map-pan-clamp-mode', 'fixed-world-viewbox');
  await expect(canvas).toHaveAttribute('data-map-camera-boundary-mode', 'fixed-world-bounds');
  await expect(canvas).toHaveAttribute('data-map-focus-viewport-fraction', '0.5');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');

  const fixedBoundsText = await canvas.getAttribute('data-map-camera-world-bounds');
  const fixedBounds = parseWorldBounds(fixedBoundsText);
  const baseline = await mainlandFootprint(page);
  const minimumView = await readCameraViewBox(canvas);
  expectViewInsideBounds(minimumView, fixedBounds);
  expect(minimumView.x).toBeCloseTo(fixedBounds.minX, 2);
  expect(minimumView.y).toBeCloseTo(fixedBounds.minY, 2);
  expect(minimumView.x + minimumView.width).toBeCloseTo(fixedBounds.maxX, 2);
  expect(minimumView.y + minimumView.height).toBeCloseTo(fixedBounds.maxY, 2);
  expect(Math.max(baseline.widthRatio, baseline.heightRatio)).toBeCloseTo(0.5, 2);
  expect(baseline.widthRatio).toBeLessThanOrEqual(0.501);
  expect(baseline.heightRatio).toBeLessThanOrEqual(0.501);
  expect(Math.abs(baseline.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(baseline.centerOffsetY)).toBeLessThan(3);

  await dragToEdge(canvas, 'right', 3);
  await waitForSettledCamera(canvas);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).x - minimumView.x)).toBeLessThan(0.02);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).y - minimumView.y)).toBeLessThan(0.02);

  await zoomIn(page, canvas, 6);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.5);
  await waitForSettledCamera(canvas);
  expect(await canvas.getAttribute('data-map-camera-world-bounds')).toBe(fixedBoundsText);
  const zoomedView = await readCameraViewBox(canvas);
  expect(zoomedView.width).toBeLessThan(minimumView.width);
  expect(zoomedView.height).toBeLessThan(minimumView.height);
  expectViewInsideBounds(zoomedView, fixedBounds);

  await dragToEdge(canvas, 'right');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-pan-clamp-count'))).toBeGreaterThan(0);
  await waitForSettledCamera(canvas);
  const rightBoundary = await readCameraViewBox(canvas);
  expectViewInsideBounds(rightBoundary, fixedBounds);
  expect(rightBoundary.x).toBeCloseTo(minimumView.x, 2);
  await dragToEdge(canvas, 'right', 3);
  await waitForSettledCamera(canvas);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).x - rightBoundary.x)).toBeLessThan(0.02);

  await canvas.dispatchEvent('dblclick', { clientX: 20, clientY: 20 });
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  expect(await canvas.getAttribute('data-map-camera-world-bounds')).toBe(fixedBoundsText);
  const reset = await mainlandFootprint(page);
  expect(Math.abs(reset.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(reset.centerOffsetY)).toBeLessThan(3);
  expect(Math.abs(reset.areaRatio - baseline.areaRatio)).toBeLessThan(0.01);

  await zoomIn(page, canvas, 6);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.5);
  await waitForSettledCamera(canvas);
  await dragToEdge(canvas, 'down');
  await waitForSettledCamera(canvas);
  const bottomBoundary = await readCameraViewBox(canvas);
  expectViewInsideBounds(bottomBoundary, fixedBounds);
  expect(bottomBoundary.y).toBeCloseTo(minimumView.y, 2);
  await dragToEdge(canvas, 'down', 3);
  await waitForSettledCamera(canvas);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).y - bottomBoundary.y)).toBeLessThan(0.02);

  for (const deltaY of [180, -180]) {
    await canvas.dispatchEvent('wheel', { deltaY, clientX: 720, clientY: 450 });
    await waitForSettledCamera(canvas);
    for (const direction of ['right', 'down', 'left', 'up'] as const) {
      await dragToEdge(canvas, direction, 12);
      await waitForSettledCamera(canvas);
      const edge = await readCameraViewBox(canvas);
      expectViewInsideBounds(edge, fixedBounds);
      expect(await canvas.getAttribute('data-map-camera-world-bounds')).toBe(fixedBoundsText);
      if (direction === 'right') expect(edge.x).toBeCloseTo(minimumView.x, 2);
      if (direction === 'down') expect(edge.y).toBeCloseTo(minimumView.y, 2);
      if (direction === 'left') expect(edge.x + edge.width).toBeCloseTo(minimumView.x + minimumView.width, 2);
      if (direction === 'up') expect(edge.y + edge.height).toBeCloseTo(minimumView.y + minimumView.height, 2);
    }
  }
});

test('portrait minimum zoom fits the mainland inside the centered half-width half-height box', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  const footprint = await mainlandFootprint(page);
  expect(Math.max(footprint.widthRatio, footprint.heightRatio)).toBeCloseTo(0.5, 2);
  expect(footprint.widthRatio).toBeLessThanOrEqual(0.501);
  expect(footprint.heightRatio).toBeLessThanOrEqual(0.501);
  expect(Math.abs(footprint.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(footprint.centerOffsetY)).toBeLessThan(3);
  const visibleStates = await map.locator('.province-map-region').evaluateAll((regions) => regions.every((region) => {
    const canvas = region.closest('.province-map-static-viewport') as HTMLElement | null;
    if (!canvas) return false;
    const canvasRect = canvas.getBoundingClientRect();
    const rect = (region as SVGGraphicsElement).getBoundingClientRect();
    return rect.left >= canvasRect.left - 1
      && rect.right <= canvasRect.right + 1
      && rect.top >= canvasRect.top - 1
      && rect.bottom <= canvasRect.bottom + 1;
  }));
  expect(visibleStates).toBe(true);
});

for (const rasterReady of [true, false]) {
  test(`active and settled views share the same screen clip and world extent with raster ${rasterReady}`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
    for (const viewport of [{ width: 1440, height: 900 }, { width: 900, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
      await expect(canvas).toHaveAttribute('data-map-raster-ready', 'true', { timeout: 15_000 });
      const footprint = await mainlandFootprint(page);
      expect(Math.max(footprint.widthRatio, footprint.heightRatio)).toBeCloseTo(0.5, 2);
      expect(footprint.widthRatio).toBeLessThanOrEqual(0.501);
      expect(footprint.heightRatio).toBeLessThanOrEqual(0.501);
      const baseView = await readCameraViewBox(canvas);
      for (const deltaY of [-180, 180]) {
        const activeView = await canvas.evaluate((element, input) => new Promise<{ x: number; y: number; width: number; height: number; clip: string; rasterActive: string | undefined }>((resolve) => {
          const container = element as HTMLElement;
          container.dataset.mapRasterReady = String(input.rasterReady);
          const bounds = container.getBoundingClientRect();
          container.dispatchEvent(new WheelEvent('wheel', {
            bubbles: true, cancelable: true, deltaY: input.deltaY,
            clientX: bounds.left + bounds.width * 0.65,
            clientY: bounds.top + bounds.height * 0.4,
          }));
          requestAnimationFrame(() => {
            const layer = container.querySelector(input.rasterReady ? '.province-map-camera-raster' : '.province-map-camera-surface')!;
            const matrix = new DOMMatrix(getComputedStyle(layer).transform);
            const [x, y, width, height] = container.dataset.mapCameraPreloadViewBox!.split(' ').map(Number);
            resolve({
              x: x - matrix.e * width / (bounds.width * matrix.a),
              y: y - matrix.f * height / (bounds.height * matrix.d),
              width: width / matrix.a,
              height: height / matrix.d,
              clip: getComputedStyle(container).overflow,
              rasterActive: container.dataset.mapRasterActive,
            });
          });
        }), { deltaY, rasterReady });
        expect(activeView.clip).toBe('hidden');
        expect(activeView.rasterActive).toBe(String(rasterReady));
        await waitForSettledCamera(canvas);
        const settled = await readCameraViewBox(canvas);
        for (const key of ['x', 'y', 'width', 'height'] as const) {
          expect(Math.abs(activeView[key] - settled[key])).toBeLessThan(0.1);
        }
        await expect(canvas).toHaveCSS('overflow', 'hidden');
      }
      const restored = await readCameraViewBox(canvas);
      for (const key of ['x', 'y', 'width', 'height'] as const) expect(restored[key]).toBeCloseTo(baseView[key], 2);
    }
  });
}
