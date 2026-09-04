import { expect, test, type Page } from '@playwright/test';

const EDGE_PROVINCE_IDS = ['110000', '230000', '420000', 'US-WA'];

async function readEdgeProvinceHits(page: Page) {
  return page.evaluate((provinceIds) => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="us-mainland-map"] .province-map-static-viewport');
    if (!canvas) throw new Error('map canvas is missing');
    const canvasBounds = canvas.getBoundingClientRect();
    return provinceIds.map((provinceId) => {
      const label = canvas.querySelector<SVGGElement>(`.province-map-label[data-province-id="${provinceId}"]`);
      const path = canvas.querySelector<SVGPathElement>(`.province-map-region[data-province-id="${provinceId}"]`);
      if (!label || !path) throw new Error(`province ${provinceId} is missing`);
      const localX = Number(label.dataset.labelCenterX);
      const localY = Number(label.dataset.labelCenterY);
      const matrix = label.getScreenCTM();
      if (!Number.isFinite(localX) || !Number.isFinite(localY) || !matrix) throw new Error('label transform missing');
      const x = matrix.a * localX + matrix.c * localY + matrix.e;
      const y = matrix.b * localX + matrix.d * localY + matrix.f;
      const insideCanvas = x >= canvasBounds.left
        && x <= canvasBounds.right
        && y >= canvasBounds.top
        && y <= canvasBounds.bottom;
      const statePathVisibleAtLabel = insideCanvas
        && document.elementsFromPoint(x, y).some((element) => element === path);
      return { provinceId, x, y, insideCanvas, statePathVisibleAtLabel };
    });
  }, EDGE_PROVINCE_IDS);
}

async function wheelBurst(page: Page, deltaY: number, count: number) {
  const canvas = page.getByTestId('us-mainland-map').locator('.province-map-static-viewport');
  return canvas.evaluate((container, input) => new Promise<{ active: string | undefined; viewBox: string }>((resolve) => {
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < input.count; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        deltaY: input.deltaY,
      }));
    }
    requestAnimationFrame(() => resolve({
      active: container.dataset.mapZoomActive,
      viewBox: container.querySelector<SVGSVGElement>('.province-map-world-svg')?.getAttribute('viewBox') ?? '',
    }));
  }), { deltaY, count });
}

test('states outside the viewport re-enter during zoom-out because all 48 paths remain mounted', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const svg = map.locator('.province-map-world-svg');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');
  await expect(canvas).toHaveAttribute('data-map-world-path-count', '48');
  await expect(map.locator('.province-map-region')).toHaveCount(48);

  const initialHits = await readEdgeProvinceHits(page);
  expect(initialHits.every((entry) => entry.insideCanvas)).toBe(true);
  expect(initialHits.every((entry) => entry.statePathVisibleAtLabel)).toBe(true);
  const initialViewBox = await svg.getAttribute('viewBox');

  const pathsBefore = await map.locator('.province-map-region').evaluateAll((paths) => (
    paths.map((path) => path.getAttribute('d'))
  ));
  const zoomedInFrame = await wheelBurst(page, -180, 8);
  expect(zoomedInFrame.viewBox).not.toBe(initialViewBox);
  const zoomedInHits = await readEdgeProvinceHits(page);
  const offscreenBeforeZoomOut = zoomedInHits.filter((entry) => !entry.insideCanvas).length;
  expect(offscreenBeforeZoomOut).toBeGreaterThanOrEqual(2);
  await expect(map.locator('.province-map-region')).toHaveCount(48);

  const zoomOutActiveFrame = await wheelBurst(page, 180, 16);
  expect(zoomOutActiveFrame.active).toBe('true');
  expect(zoomOutActiveFrame.viewBox).toBe(initialViewBox);
  const restoredDuringActiveZoom = await readEdgeProvinceHits(page);
  expect(restoredDuringActiveZoom.every((entry) => entry.insideCanvas)).toBe(true);
  expect(restoredDuringActiveZoom.every((entry) => entry.statePathVisibleAtLabel)).toBe(true);

  const pathsAfter = await map.locator('.province-map-region').evaluateAll((paths) => (
    paths.map((path) => path.getAttribute('d'))
  ));
  expect(pathsAfter).toEqual(pathsBefore);
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');

  const california = restoredDuringActiveZoom.find((entry) => entry.provinceId === '110000');
  if (!california) throw new Error('California probe missing');
  await page.mouse.click(california.x, california.y);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '110000');
});
