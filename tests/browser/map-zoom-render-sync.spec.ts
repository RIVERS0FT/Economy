import { expect, test, type Page } from '@playwright/test';

const EDGE_PROVINCE_IDS = ['110000', '230000', '420000', 'US-WA'];
const SYNC_PROVINCE_ID = '150000';

async function readEdgeProvinceHits(page: Page) {
  return page.evaluate((provinceIds) => {
    const container = document.querySelector<HTMLElement>('[data-testid="us-mainland-map"] .economy-chart__canvas');
    if (!container) throw new Error('map canvas is missing');
    const overlay = container.querySelector<SVGSVGElement>(':scope > .province-map-label-overlay');
    const mapSvg = [...container.querySelectorAll<SVGSVGElement>('svg')]
      .find((svg) => !svg.classList.contains('province-map-label-overlay'));
    if (!overlay || !mapSvg) throw new Error('map SVG surfaces are missing');
    const canvasBounds = container.getBoundingClientRect();
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
      const insideCanvas = x >= canvasBounds.left
        && x <= canvasBounds.right
        && y >= canvasBounds.top
        && y <= canvasBounds.bottom;
      const statePathVisibleAtLabel = insideCanvas
        && document.elementsFromPoint(x, y).some((element) => (
          element instanceof SVGPathElement
          && element.ownerSVGElement === mapSvg
          && !element.closest('defs')
        ));
      return { provinceId, insideCanvas, statePathVisibleAtLabel };
    });
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
}

test('zoom keeps map paths and province labels in one frame cadence while offscreen states re-enter before settle', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-camera-mode', 'shared-transform');
  await expect(canvas).toHaveAttribute('data-map-zoom-camera-mode', 'echarts-geo-roam');

  const baseline = await canvas.evaluate((container, provinceId) => {
    const mapSvg = [...container.querySelectorAll<SVGSVGElement>('svg')]
      .find((svg) => !svg.classList.contains('province-map-label-overlay'));
    const label = container.querySelector<SVGGElement>(`.province-map-label[data-province-id="${provinceId}"]`);
    if (!mapSvg || !label) throw new Error('baseline map or label is missing');
    const rects = [...mapSvg.querySelectorAll<SVGGraphicsElement>('path')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    return {
      outlineWidth: right - left,
      labelWidth: label.getBoundingClientRect().width,
      cameraSyncCount: Number(container.dataset.mapLabelCameraSyncCount || 0),
    };
  }, SYNC_PROVINCE_ID);

  await wheelBurst(page, -90, 7);
  const samples = await canvas.evaluate(async (container, input) => {
    const mapSvg = [...container.querySelectorAll<SVGSVGElement>('svg')]
      .find((svg) => !svg.classList.contains('province-map-label-overlay'));
    const label = container.querySelector<SVGGElement>(`.province-map-label[data-province-id="${input.provinceId}"]`);
    if (!mapSvg || !label) throw new Error('sample map or label is missing');

    return new Promise<Array<{
      active: boolean;
      zoom: number;
      mapScale: number;
      labelScale: number;
      cameraSyncCount: number;
    }>>((resolve) => {
      const result: Array<{
        active: boolean;
        zoom: number;
        mapScale: number;
        labelScale: number;
        cameraSyncCount: number;
      }> = [];
      let settledFrames = 0;
      const sample = () => {
        const rects = [...mapSvg.querySelectorAll<SVGGraphicsElement>('path')]
          .map((path) => path.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.height > 0);
        const left = Math.min(...rects.map((rect) => rect.left));
        const right = Math.max(...rects.map((rect) => rect.right));
        const active = container.dataset.mapZoomActive === 'true';
        result.push({
          active,
          zoom: Number(container.dataset.mapZoomCurrent || 1),
          mapScale: (right - left) / input.outlineWidth,
          labelScale: label.getBoundingClientRect().width / input.labelWidth,
          cameraSyncCount: Number(container.dataset.mapLabelCameraSyncCount || 0),
        });
        settledFrames = active ? 0 : settledFrames + 1;
        if (settledFrames >= 2 || result.length >= 80) {
          resolve(result);
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }, {
    provinceId: SYNC_PROVINCE_ID,
    outlineWidth: baseline.outlineWidth,
    labelWidth: baseline.labelWidth,
  });

  const activeSamples = samples.filter((sample) => sample.active && sample.zoom > 1.01);
  expect(activeSamples.length).toBeGreaterThanOrEqual(3);
  for (const sample of activeSamples) {
    const relativeError = Math.abs(sample.labelScale - sample.mapScale) / Math.max(0.001, sample.mapScale);
    expect(relativeError).toBeLessThan(0.07);
  }
  expect(samples[samples.length - 1].cameraSyncCount).toBeGreaterThan(baseline.cameraSyncCount);
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');

  await wheelBurst(page, -180, 6);
  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  expect(Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(2.5);
  const zoomedInHits = await readEdgeProvinceHits(page);
  expect(zoomedInHits.filter((entry) => !entry.insideCanvas).length).toBeGreaterThanOrEqual(2);

  await wheelBurst(page, 180, 12);
  const transientRestored = await canvas.evaluate(async (container, provinceIds) => {
    const overlay = container.querySelector<SVGSVGElement>(':scope > .province-map-label-overlay');
    const mapSvg = [...container.querySelectorAll<SVGSVGElement>('svg')]
      .find((svg) => !svg.classList.contains('province-map-label-overlay'));
    if (!overlay || !mapSvg) throw new Error('map SVG surfaces are missing');
    const canvasBounds = container.getBoundingClientRect();

    const read = () => provinceIds.map((provinceId) => {
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
      const insideCanvas = x >= canvasBounds.left
        && x <= canvasBounds.right
        && y >= canvasBounds.top
        && y <= canvasBounds.bottom;
      const statePathVisibleAtLabel = insideCanvas
        && document.elementsFromPoint(x, y).some((element) => (
          element instanceof SVGPathElement
          && element.ownerSVGElement === mapSvg
          && !element.closest('defs')
        ));
      return { provinceId, insideCanvas, statePathVisibleAtLabel };
    });

    return new Promise<{
      zoom: number;
      active: boolean;
      hits: ReturnType<typeof read>;
    } | null>((resolve) => {
      let frames = 0;
      const sample = () => {
        frames += 1;
        const zoom = Number(container.dataset.mapZoomCurrent || 1);
        const active = container.dataset.mapZoomActive === 'true';
        if (active && zoom <= 0.9) {
          resolve({ zoom, active, hits: read() });
          return;
        }
        if ((!active && frames > 2) || frames >= 90) {
          resolve(null);
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  }, EDGE_PROVINCE_IDS);

  expect(transientRestored).not.toBeNull();
  expect(transientRestored?.active).toBe(true);
  expect(transientRestored?.zoom).toBeLessThanOrEqual(0.9);
  expect(transientRestored?.hits.every((entry) => entry.insideCanvas)).toBe(true);
  expect(transientRestored?.hits.every((entry) => entry.statePathVisibleAtLabel)).toBe(true);

  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', /^0\.5000\d$/);
  const settledRestored = await readEdgeProvinceHits(page);
  expect(settledRestored.every((entry) => entry.insideCanvas)).toBe(true);
  expect(settledRestored.every((entry) => entry.statePathVisibleAtLabel)).toBe(true);
});
