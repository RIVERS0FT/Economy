import { expect, test } from '@playwright/test';

test('research tree remains draggable after fitting the entire world', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=research&scenario=research-active');

  const viewport = page.locator('.research-tree-viewport');
  await expect(viewport).toBeVisible();
  await page.getByRole('button', { name: '查看完整技术树' }).click();

  const dragPoint = await viewport.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    for (const [rx, ry] of [[0.82, 0.82], [0.18, 0.82], [0.82, 0.2], [0.18, 0.2], [0.5, 0.86]]) {
      const x = rect.left + rect.width * rx;
      const y = rect.top + rect.height * ry;
      const target = document.elementFromPoint(x, y) as HTMLElement | null;
      if (target && element.contains(target) && !target.closest('.research-tree-controls, .research-technology-node')) {
        return { x, y };
      }
    }
    throw new Error('Could not find an empty research-tree interaction point');
  });

  const before = {
    x: Number(await viewport.getAttribute('data-pan-x')),
    y: Number(await viewport.getAttribute('data-pan-y')),
    zoom: Number(await viewport.getAttribute('data-zoom')),
  };

  await page.mouse.move(dragPoint.x, dragPoint.y);
  await page.mouse.down();
  await page.mouse.move(dragPoint.x - 80, dragPoint.y + 60, { steps: 6 });
  await page.mouse.up();

  const after = {
    x: Number(await viewport.getAttribute('data-pan-x')),
    y: Number(await viewport.getAttribute('data-pan-y')),
    zoom: Number(await viewport.getAttribute('data-zoom')),
  };
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);
  expect(after.zoom).toBeCloseTo(before.zoom, 3);

  const visibility = await page.evaluate(() => {
    const viewportRect = document.querySelector<HTMLElement>('.research-tree-viewport')!.getBoundingClientRect();
    const worldRect = document.querySelector<HTMLElement>('.research-tree-transform-layer')!.getBoundingClientRect();
    return {
      intersectionWidth: Math.max(0, Math.min(viewportRect.right, worldRect.right) - Math.max(viewportRect.left, worldRect.left)),
      intersectionHeight: Math.max(0, Math.min(viewportRect.bottom, worldRect.bottom) - Math.max(viewportRect.top, worldRect.top)),
    };
  });
  expect(visibility.intersectionWidth).toBeGreaterThanOrEqual(64);
  expect(visibility.intersectionHeight).toBeGreaterThanOrEqual(64);
});
