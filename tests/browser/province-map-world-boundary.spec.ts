import { expect, test, type Locator, type Page } from '@playwright/test';

async function dragToEdge(canvas: Locator, direction: 'right' | 'down', times = 4) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('map bounds missing');
  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  const endX = direction === 'right' ? bounds.x + bounds.width - 8 : startX;
  const endY = direction === 'down' ? bounds.y + bounds.height - 8 : startY;
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
      areaRatio: ((right - left) * (bottom - top)) / (canvasRect.width * canvasRect.height),
      centerOffsetX: (left + right) / 2 - (canvasRect.left + canvasRect.right) / 2,
      centerOffsetY: (top + bottom) / 2 - (canvasRect.top + canvasRect.bottom) / 2,
    };
  });
}

test('world context uses filled 10m land, filter-free coastline hierarchy and the contiguous-US 10m seam while only states stay interactive', async ({ page }) => {
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
  await expect(canvas).toHaveAttribute('data-map-world-context', 'continents-filled-10m');
  await expect(canvas).toHaveAttribute('data-map-world-resolution', '10m');
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
  await expect(outline).toHaveAttribute('data-world-outline', 'continents-10m');
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

  const outlinePathBefore = await outline.getAttribute('d');
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
  await expect(canvas).toHaveAttribute('data-map-pan-edge-inset', '12');
  await expect(canvas).toHaveAttribute('data-map-focus-area-target', '0.666667');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');

  const fixedBoundsText = await canvas.getAttribute('data-map-camera-world-bounds');
  const fixedBounds = parseWorldBounds(fixedBoundsText);
  const baseline = await mainlandFootprint(page);
  const minimumView = await readCameraViewBox(canvas);
  expectViewInsideBounds(minimumView, fixedBounds);
  expect(baseline.areaRatio).toBeGreaterThan(0.62);
  expect(baseline.areaRatio).toBeLessThan(0.70);
  expect(Math.abs(baseline.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(baseline.centerOffsetY)).toBeLessThan(3);

  await dragToEdge(canvas, 'right', 3);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).x - minimumView.x)).toBeLessThan(0.02);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).y - minimumView.y)).toBeLessThan(0.02);

  await zoomIn(page, canvas, 6);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.5);
  expect(await canvas.getAttribute('data-map-camera-world-bounds')).toBe(fixedBoundsText);
  const zoomedView = await readCameraViewBox(canvas);
  expect(zoomedView.width).toBeLessThan(minimumView.width);
  expect(zoomedView.height).toBeLessThan(minimumView.height);
  expectViewInsideBounds(zoomedView, fixedBounds);

  await dragToEdge(canvas, 'right');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-pan-clamp-count'))).toBeGreaterThan(0);
  const rightBoundary = await readCameraViewBox(canvas);
  expectViewInsideBounds(rightBoundary, fixedBounds);
  await dragToEdge(canvas, 'right', 3);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).x - rightBoundary.x)).toBeLessThan(0.02);

  await canvas.dispatchEvent('dblclick', { clientX: 20, clientY: 20 });
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  expect(await canvas.getAttribute('data-map-camera-world-bounds')).toBe(fixedBoundsText);
  const reset = await mainlandFootprint(page);
  expect(Math.abs(reset.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(reset.centerOffsetY)).toBeLessThan(3);
  expect(Math.abs(reset.areaRatio - baseline.areaRatio)).toBeLessThan(0.01);

  await zoomIn(page, canvas, 6);
  await dragToEdge(canvas, 'down');
  const bottomBoundary = await readCameraViewBox(canvas);
  expectViewInsideBounds(bottomBoundary, fixedBounds);
  await dragToEdge(canvas, 'down', 3);
  await expect.poll(async () => Math.abs((await readCameraViewBox(canvas)).y - bottomBoundary.y)).toBeLessThan(0.02);
});

test('portrait minimum zoom keeps the whole mainland visible and centered instead of cropping to force the two-thirds target', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  const footprint = await mainlandFootprint(page);
  expect(footprint.areaRatio).toBeLessThan(2 / 3);
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