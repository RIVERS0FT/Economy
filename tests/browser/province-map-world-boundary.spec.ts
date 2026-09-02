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

test('world context is outline-only while contiguous US remains the only interactive geography', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const outline = map.locator('.province-map-world-outline');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-world-context', 'continents-only');
  await expect(canvas).toHaveAttribute('data-map-world-interactive', 'false');
  await expect(canvas).toHaveAttribute('data-map-world-outline-path-count', '1');
  await expect(outline).toHaveCount(1);
  await expect(outline).toHaveAttribute('data-world-outline', 'continents-only');
  await expect(outline).toHaveAttribute('data-interactive', 'false');
  await expect(outline).toHaveCSS('pointer-events', 'none');
  expect(await outline.getAttribute('role')).toBeNull();
  expect(await outline.getAttribute('tabindex')).toBeNull();
  await expect(map.locator('.province-map-region')).toHaveCount(48);
  await expect(map.locator('.province-map-region[role="button"]')).toHaveCount(48);

  const outlinePathBefore = await outline.getAttribute('d');
  expect(outlinePathBefore?.length || 0).toBeGreaterThan(100);
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('map bounds missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -360);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.05);
  expect(await outline.getAttribute('d')).toBe(outlinePathBefore);
});

test('single compositor camera clamps panning continuously to the world boundary', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const camera = map.locator('.province-map-camera-surface');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-pan-boundary', 'world');
  await expect(canvas).toHaveAttribute('data-map-pan-clamp-mode', 'continuous');
  await expect(canvas).toHaveAttribute('data-map-pan-edge-inset', '12');

  await dragToEdge(page, canvas, 'right');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-pan-clamp-count'))).toBeGreaterThan(0);
  const rightBoundaryX = Number(await canvas.getAttribute('data-map-camera-x'));
  expect(Number.isFinite(rightBoundaryX)).toBe(true);
  await dragToEdge(page, canvas, 'right', 3);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-map-camera-x')) - rightBoundaryX)).toBeLessThan(1);

  await page.dblclick('.province-map-static-viewport', { position: { x: 20, y: 20 } });
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');
  await expect(camera).toHaveCSS('transform', /matrix\(1, 0, 0, 1, 0, 0\)|none/);

  await dragToEdge(page, canvas, 'down');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-pan-clamp-count'))).toBeGreaterThan(0);
  const bottomBoundaryY = Number(await canvas.getAttribute('data-map-camera-y'));
  expect(Number.isFinite(bottomBoundaryY)).toBe(true);
  await dragToEdge(page, canvas, 'down', 3);
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-map-camera-y')) - bottomBoundaryY)).toBeLessThan(1);
});
