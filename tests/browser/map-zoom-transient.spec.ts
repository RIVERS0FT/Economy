import { expect, test } from '@playwright/test';

async function readOutlineWidth(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const rects = [...document.querySelectorAll<SVGGraphicsElement>(
      '.province-map-echart svg:not(.province-map-label-overlay) path',
    )]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) throw new Error('map outline paths are missing');
    return Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left));
  });
}

test('map zoom animates the formal ECharts camera without root SVG transforms', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-zoom-mode', 'interpolated');
  await expect(canvas).toHaveAttribute('data-map-zoom-camera-mode', 'echarts-geo-roam');
  await expect(canvas).toHaveAttribute('data-map-zoom-hot-path', 'geo-roam');
  await expect(canvas).toHaveAttribute('data-map-zoom-commit-mode', 'settle-marker');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');

  const commitBefore = Number(await canvas.getAttribute('data-map-zoom-commit-count'));
  const layoutRevisionBefore = await canvas.getAttribute('data-map-label-layout-revision');
  const cameraSyncBefore = Number(await canvas.getAttribute('data-map-label-camera-sync-count'));

  const duringAnimation = await canvas.evaluate(async (container) => {
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < 6; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width * 0.58,
        clientY: bounds.top + bounds.height * 0.46,
        deltaY: -70,
      }));
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const surfaces = [...container.querySelectorAll<SVGSVGElement>('svg')];
    const labelSurface = surfaces.find((surface) => surface.classList.contains('province-map-label-overlay'));
    const mapSurface = surfaces.find((surface) => !surface.classList.contains('province-map-label-overlay'));
    return {
      active: container.dataset.mapZoomActive,
      committed: container.dataset.mapZoomCommitted,
      current: container.dataset.mapZoomCurrent,
      target: container.dataset.mapZoomTarget,
      commits: Number(container.dataset.mapZoomCommitCount || 0),
      mapTransform: mapSurface?.style.transform || '',
      labelTransform: labelSurface?.style.transform || '',
    };
  });

  expect(duringAnimation.active).toBe('true');
  expect(duringAnimation.current).not.toBe(duringAnimation.committed);
  expect(Number(duringAnimation.target)).toBeGreaterThan(Number(duringAnimation.committed));
  expect(duringAnimation.commits).toBe(commitBefore);
  expect(duringAnimation.mapTransform).toBe('');
  expect(duringAnimation.labelTransform).toBe('');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBefore || '');

  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-commit-count'))).toBe(commitBefore + 1);
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBefore || '');
  expect(Number(await canvas.getAttribute('data-map-label-camera-sync-count'))).toBeGreaterThan(cameraSyncBefore);
  expect(Number(await canvas.getAttribute('data-map-zoom-max-step'))).toBeLessThanOrEqual(1.111);

  const settledTransforms = await canvas.evaluate((container) => {
    const surfaces = [...container.querySelectorAll<SVGSVGElement>('svg')];
    const labelSurface = surfaces.find((surface) => surface.classList.contains('province-map-label-overlay'));
    const mapSurface = surfaces.find((surface) => !surface.classList.contains('province-map-label-overlay'));
    return {
      mapTransform: mapSurface?.style.transform || '',
      labelTransform: labelSurface?.style.transform || '',
    };
  });
  expect(settledTransforms.mapTransform).toBe('');
  expect(settledTransforms.labelTransform).toBe('');
});

test('zoom-out geometry stays monotonic through settle without a size jump', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  const initialWidth = await readOutlineWidth(page);

  const samples = await canvas.evaluate(async (container) => {
    const bounds = container.getBoundingClientRect();
    for (let index = 0; index < 8; index += 1) {
      container.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        clientX: bounds.left + bounds.width / 2,
        clientY: bounds.top + bounds.height / 2,
        deltaY: 180,
      }));
    }

    const readWidth = () => {
      const rects = [...container.querySelectorAll<SVGGraphicsElement>(
        'svg:not(.province-map-label-overlay) path',
      )]
        .map((path) => path.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      return rects.length === 0
        ? 0
        : Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left));
    };

    return new Promise<Array<{ width: number; active: string; zoom: number; rootTransform: string }>>((resolve) => {
      const result: Array<{ width: number; active: string; zoom: number; rootTransform: string }> = [];
      let settledFrames = 0;
      const sample = () => {
        const mapSvg = [...container.querySelectorAll<SVGSVGElement>('svg')]
          .find((svg) => !svg.classList.contains('province-map-label-overlay'));
        const active = container.dataset.mapZoomActive || 'false';
        result.push({
          width: readWidth(),
          active,
          zoom: Number(container.dataset.mapZoomCurrent || 1),
          rootTransform: mapSvg?.style.transform || '',
        });
        if (active === 'false' && result.length > 2) settledFrames += 1;
        else settledFrames = 0;
        if (settledFrames >= 2 || result.length >= 90) {
          resolve(result);
          return;
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });

  expect(samples.length).toBeGreaterThan(3);
  expect(samples.every((sample) => sample.rootTransform === '')).toBe(true);
  const positiveWidths = samples.map((sample) => sample.width).filter((width) => width > 0);
  expect(positiveWidths.length).toBeGreaterThan(3);
  for (let index = 1; index < positiveWidths.length; index += 1) {
    expect(positiveWidths[index]).toBeLessThanOrEqual(positiveWidths[index - 1] + 1.5);
    const ratio = Math.max(
      positiveWidths[index] / positiveWidths[index - 1],
      positiveWidths[index - 1] / positiveWidths[index],
    );
    expect(ratio).toBeLessThanOrEqual(1.13);
  }
  const finalWidth = positiveWidths[positiveWidths.length - 1];
  const penultimateWidth = positiveWidths[positiveWidths.length - 2];
  expect(Math.abs(finalWidth - penultimateWidth) / Math.max(1, penultimateWidth)).toBeLessThan(0.02);
  expect(finalWidth).toBeLessThan(initialWidth * 0.7);
  await expect(canvas).toHaveAttribute('data-map-zoom-current', /^0\.5000\d$/);
  await expect(canvas).toHaveAttribute('data-map-zoom-active', 'false');
});
