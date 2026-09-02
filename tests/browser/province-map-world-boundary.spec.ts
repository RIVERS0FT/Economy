import { expect, test, type Locator, type Page } from '@playwright/test';

async function dragToEdge(page: Page, canvas: Locator, direction: 'right' | 'down', times = 16) {
  for (let index = 0; index < times; index += 1) {
    const bounds = await canvas.boundingBox();
    if (!bounds) throw new Error('map bounds missing');
    const startX = bounds.x + bounds.width / 2;
    const startY = bounds.y + bounds.height / 2;
    const endX = direction === 'right' ? bounds.x + bounds.width - 8 : startX;
    const endY = direction === 'down' ? bounds.y + bounds.height - 8 : startY;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 4 });
    await page.mouse.up();
  }
}

async function zoomIn(page: Page, canvas: Locator, times = 5) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('map bounds missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let index = 0; index < times; index += 1) await page.mouse.wheel(0, -420);
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

test('world context uses filled 10m land, coastline shadow and the contiguous-US 10m seam while only states stay interactive', async ({ page }) => {
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
  await expect(shadow).not.toHaveCSS('filter', 'none');
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

test('minimum logical zoom centers the mainland near two thirds of the map and pan stays inside the mainland context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(map).toHaveAttribute('data-map-zoom-min', '1');
  await expect(canvas).toHaveAttribute('data-map-pan-boundary', 'mainland-context');
  await expect(canvas).toHaveAttribute('data-map-pan-clamp-mode', 'continuous');
  await expect(canvas).toHaveAttribute('data-map-pan-edge-inset', '12');
  await expect(canvas).toHaveAttribute('data-map-focus-area-target', '0.666667');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');

  const baseline = await mainlandFootprint(page);
  expect(baseline.areaRatio).toBeGreaterThan(0.62);
  expect(baseline.areaRatio).toBeLessThan(0.70);
  expect(Math.abs(baseline.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(baseline.centerOffsetY)).toBeLessThan(3);
  const minimumX = Number(await canvas.getAttribute('data-map-camera-x'));
  const minimumY = Number(await canvas.getAttribute('data-map-camera-y'));

  await dragToEdge(page, canvas, 'right', 3);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-map-camera-x')) - minimumX)).toBeLessThan(1);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-map-camera-y')) - minimumY)).toBeLessThan(1);

  await zoomIn(page, canvas, 6);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.5);
  await dragToEdge(page, canvas, 'right');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-pan-clamp-count'))).toBeGreaterThan(0);
  const rightBoundaryX = Number(await canvas.getAttribute('data-map-camera-x'));
  await dragToEdge(page, canvas, 'right', 3);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-map-camera-x')) - rightBoundaryX)).toBeLessThan(1);

  await canvas.dispatchEvent('dblclick', { clientX: 20, clientY: 20 });
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  const reset = await mainlandFootprint(page);
  expect(Math.abs(reset.centerOffsetX)).toBeLessThan(3);
  expect(Math.abs(reset.centerOffsetY)).toBeLessThan(3);
  expect(Math.abs(reset.areaRatio - baseline.areaRatio)).toBeLessThan(0.01);

  await zoomIn(page, canvas, 6);
  await dragToEdge(page, canvas, 'down');
  const bottomBoundaryY = Number(await canvas.getAttribute('data-map-camera-y'));
  await dragToEdge(page, canvas, 'down', 3);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-map-camera-y')) - bottomBoundaryY)).toBeLessThan(1);
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
    return rect.right >= canvasRect.left - 1
      && rect.left <= canvasRect.right + 1
      && rect.bottom >= canvasRect.top - 1
      && rect.top <= canvasRect.bottom + 1;
  }));
  expect(visibleStates).toBe(true);
});
