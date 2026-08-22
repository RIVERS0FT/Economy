import { expect, test, type Page } from '@playwright/test';

const EDGE_PROVINCE_IDS = ['110000', '230000', '420000', 'US-WA'];

async function readEdgeProvinceHits(page: Page) {
  return page.evaluate((provinceIds) => {
    const canvas = document.querySelector<HTMLElement>('[data-testid="us-mainland-map"] .economy-chart__canvas');
    if (!canvas) throw new Error('map canvas is missing');
    const overlay = canvas.querySelector<SVGSVGElement>(':scope > .province-map-label-overlay');
    const mapSvg = [...canvas.querySelectorAll<SVGSVGElement>('svg')]
      .find((svg) => !svg.classList.contains('province-map-label-overlay'));
    if (!overlay || !mapSvg) throw new Error('map SVG surfaces are missing');
    const canvasBounds = canvas.getBoundingClientRect();
    const previousPointerEvents = overlay.style.pointerEvents;
    overlay.style.pointerEvents = 'none';
    try {
      return provinceIds.map((provinceId) => {
        const label = overlay.querySelector<SVGGElement>(`.province-map-label[data-province-id="${provinceId}"]`);
        if (!label) throw new Error(`province label ${provinceId} is missing`);
        const localX = Number(label.dataset.labelCenterX);
        const localY = Number(label.dataset.labelCenterY);
        const matrix = label.getScreenCTM();
        if (!Number.isFinite(localX) || !Number.isFinite(localY) || !matrix) {
          throw new Error(`province label ${provinceId} has no screen transform`);
        }
        const x = matrix.a * localX + matrix.c * localY + matrix.e;
        const y = matrix.b * localX + matrix.d * localY + matrix.f;
        const statePathVisibleAtLabel = x >= canvasBounds.left
          && x <= canvasBounds.right
          && y >= canvasBounds.top
          && y <= canvasBounds.bottom
          && document.elementsFromPoint(x, y).some((element) => (
            element instanceof SVGPathElement
            && element.ownerSVGElement === mapSvg
            && !element.closest('defs')
          ));
        return {
          provinceId,
          x,
          y,
          insideCanvas: x >= canvasBounds.left
            && x <= canvasBounds.right
            && y >= canvasBounds.top
            && y <= canvasBounds.bottom,
          statePathVisibleAtLabel,
        };
      });
    } finally {
      overlay.style.pointerEvents = previousPointerEvents;
    }
  }, EDGE_PROVINCE_IDS);
}

async function wheelBurst(page: Page, deltaY: number, count: number) {
  const canvas = page.getByTestId('us-mainland-map').locator('.economy-chart__canvas');
  await canvas.evaluate((container, input) => {
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
  }, { deltaY, count });
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

test('states that leave the viewport while zoomed in re-enter when the formal map camera zooms out', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-zoom-camera-mode', 'echarts-geo-roam');
  await expect(canvas).toHaveAttribute('data-map-zoom-commit-mode', 'settle-marker');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');

  const initialHits = await readEdgeProvinceHits(page);
  expect(initialHits.every((entry) => entry.insideCanvas)).toBe(true);
  expect(initialHits.every((entry) => entry.statePathVisibleAtLabel)).toBe(true);

  await wheelBurst(page, -180, 6);
  expect(Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(2.5);
  const zoomedInHits = await readEdgeProvinceHits(page);
  const offscreenBeforeZoomOut = zoomedInHits.filter((entry) => !entry.insideCanvas).length;
  expect(offscreenBeforeZoomOut).toBeGreaterThanOrEqual(2);

  const commitBefore = Number(await canvas.getAttribute('data-map-zoom-commit-count'));
  await canvas.evaluate((container) => {
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < 12; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        deltaY: 180,
      }));
    }
  });

  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-target'))).toBeLessThanOrEqual(0.501);
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-commit-count'))).toBe(commitBefore + 1);
  await expect(canvas).toHaveAttribute('data-map-zoom-current', /^0\.5000\d$/);
  await expect(canvas).toHaveAttribute('data-map-zoom-committed', /^0\.5000\d$/);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  const transforms = await canvas.evaluate((container) => {
    const surfaces = [...container.querySelectorAll<SVGSVGElement>('svg')];
    const labelSurface = surfaces.find((surface) => surface.classList.contains('province-map-label-overlay'));
    const mapSurface = surfaces.find((surface) => !surface.classList.contains('province-map-label-overlay'));
    return {
      mapTransform: mapSurface?.style.transform || '',
      labelTransform: labelSurface?.style.transform || '',
    };
  });
  expect(transforms.mapTransform).toBe('');
  expect(transforms.labelTransform).toBe('');

  const restored = await readEdgeProvinceHits(page);
  expect(restored.every((entry) => entry.insideCanvas)).toBe(true);
  expect(restored.every((entry) => entry.statePathVisibleAtLabel)).toBe(true);

  const california = restored.find((entry) => entry.provinceId === '110000');
  if (!california) throw new Error('California edge probe is missing');
  await page.mouse.click(california.x, california.y);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '110000');
});
