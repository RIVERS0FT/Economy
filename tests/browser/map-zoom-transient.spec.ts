import { expect, test } from '@playwright/test';

test('map zoom animates shared SVG surfaces and commits ECharts only after settling', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-zoom-mode', 'interpolated');
  await expect(canvas).toHaveAttribute('data-map-zoom-surface-mode', 'shared-css-transform');
  await expect(canvas).toHaveAttribute('data-map-zoom-hot-path', 'transform-only');
  await expect(canvas).toHaveAttribute('data-map-zoom-surface-count', '2');
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
      transientScale: Number(container.dataset.mapZoomTransientScale || 1),
    };
  });

  expect(duringAnimation.active).toBe('true');
  expect(duringAnimation.current).not.toBe(duringAnimation.committed);
  expect(Number(duringAnimation.target)).toBeGreaterThan(Number(duringAnimation.committed));
  expect(duringAnimation.commits).toBe(commitBefore);
  expect(duringAnimation.transientScale).toBeGreaterThan(1);
  expect(duringAnimation.mapTransform).toMatch(/^matrix\(/);
  expect(duringAnimation.labelTransform).toBe(duringAnimation.mapTransform);
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBefore || '');
  expect(Number(await canvas.getAttribute('data-map-label-camera-sync-count'))).toBe(cameraSyncBefore);

  await expect.poll(async () => canvas.getAttribute('data-map-zoom-active')).toBe('false');
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-commit-count'))).toBe(commitBefore + 1);
  await expect(canvas).toHaveAttribute('data-map-zoom-transient-scale', '1.000000');
  await expect(canvas).toHaveAttribute('data-map-zoom-transient-translate', '0.000,0.000');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', layoutRevisionBefore || '');
  expect(Number(await canvas.getAttribute('data-map-label-camera-sync-count'))).toBeGreaterThan(cameraSyncBefore);

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
