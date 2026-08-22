import { expect, test } from '@playwright/test';

const PROBE_PROVINCE_IDS = ['110000', '150000', '420000', 'US-WA'];

async function readLabelHitState(page: import('@playwright/test').Page) {
  return page.evaluate((provinceIds) => {
    const map = document.querySelector<HTMLElement>('[data-testid="us-mainland-map"]');
    if (!map) throw new Error('map is missing');
    return provinceIds.map((provinceId) => {
      const label = map.querySelector<SVGGElement>(`.province-map-label[data-province-id="${provinceId}"]`);
      const path = map.querySelector<SVGPathElement>(`.province-map-region[data-province-id="${provinceId}"]`);
      if (!label || !path) throw new Error(`missing province ${provinceId}`);
      const x = Number(label.dataset.labelCenterX);
      const y = Number(label.dataset.labelCenterY);
      const matrix = label.getScreenCTM();
      if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) throw new Error('invalid label transform');
      const screenX = matrix.a * x + matrix.c * y + matrix.e;
      const screenY = matrix.b * x + matrix.d * y + matrix.f;
      const viewport = map.querySelector<HTMLElement>('.province-map-static-viewport') ?? map;
      const bounds = viewport.getBoundingClientRect();
      const visible = screenX >= bounds.left
        && screenX <= bounds.right
        && screenY >= bounds.top
        && screenY <= bounds.bottom;
      const hit = visible
        ? document.elementsFromPoint(screenX, screenY).some((element) => element === path)
        : false;
      return { provinceId, screenX, screenY, visible, hit };
    });
  }, PROBE_PROVINCE_IDS);
}

test('province paths and labels share one static SVG world and never require camera resynchronization', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-label-camera-mode', 'shared-static-world');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(map.locator('.province-map-camera-surface > .province-map-world-svg')).toHaveCount(1);
  await expect(map.locator('.province-map-world-svg .province-map-regions')).toHaveCount(1);
  await expect(map.locator('.province-map-world-svg .province-map-label-camera')).toHaveCount(1);
  await expect(map.locator('.province-map-region')).toHaveCount(48);
  await expect(map.locator('.province-map-label')).toHaveCount(48);

  const parents = await page.evaluate(() => {
    const path = document.querySelector('.province-map-region');
    const label = document.querySelector('.province-map-label');
    const camera = document.querySelector('.province-map-camera-surface');
    return {
      pathCamera: path?.closest('.province-map-camera-surface') === camera,
      labelCamera: label?.closest('.province-map-camera-surface') === camera,
      labelSvg: label?.closest('.province-map-world-svg') === path?.closest('.province-map-world-svg'),
    };
  });
  expect(parents).toEqual({ pathCamera: true, labelCamera: true, labelSvg: true });
  const baselineHitState = await readLabelHitState(page);
  const baselineVisibleHitState = baselineHitState.filter((entry) => entry.visible);
  expect(baselineVisibleHitState.length).toBeGreaterThan(0);
  expect(baselineVisibleHitState.every((entry) => entry.hit)).toBe(true);

  const baselineGeometry = await canvas.evaluate((container) => ({
    paths: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    labels: [...container.querySelectorAll<SVGGElement>('.province-map-label')].map((label) => ({
      centerX: label.dataset.labelCenterX,
      centerY: label.dataset.labelCenterY,
      glyphs: [...label.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
        .map((glyph) => glyph.getAttribute('transform')),
    })),
  }));

  await canvas.evaluate((container) => {
    const bounds = container.getBoundingClientRect();
    container.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + bounds.width * 0.62,
      clientY: bounds.top + bounds.height * 0.42,
      deltaY: -420,
    }));
  });
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.2);
  const zoomedHitState = await readLabelHitState(page);
  const zoomedVisibleHitState = zoomedHitState.filter((entry) => entry.visible);
  expect(zoomedVisibleHitState.length).toBeGreaterThan(0);
  expect(zoomedVisibleHitState.every((entry) => entry.hit)).toBe(true);

  const zoomedGeometry = await canvas.evaluate((container) => ({
    paths: [...container.querySelectorAll<SVGPathElement>('.province-map-region')].map((path) => path.getAttribute('d')),
    labels: [...container.querySelectorAll<SVGGElement>('.province-map-label')].map((label) => ({
      centerX: label.dataset.labelCenterX,
      centerY: label.dataset.labelCenterY,
      glyphs: [...label.querySelectorAll<SVGTextElement>('.province-map-label-glyph')]
        .map((glyph) => glyph.getAttribute('transform')),
    })),
  }));
  expect(zoomedGeometry).toEqual(baselineGeometry);
  await expect(canvas).not.toHaveAttribute('data-map-label-camera-sync-count', /.+/);
});
