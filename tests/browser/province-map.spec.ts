import { expect, test } from '@playwright/test';

test('province map exposes 34 clickable regions and switches local operating context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: '中国地图', exact: true })).toBeVisible();
  const map = page.getByTestId('china-province-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-province-count', '34');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '34');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '110000');
  const fullPageGeometry = await page.locator('.province-map-page').evaluate((element) => {
    const stage = element.getBoundingClientRect();
    const canvas = element.querySelector('.province-map-canvas')?.getBoundingClientRect();
    return {
      stage: { left: stage.left, top: stage.top, width: stage.width, height: stage.height },
      canvas: canvas ? { left: canvas.left, top: canvas.top, width: canvas.width, height: canvas.height } : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  expect(fullPageGeometry.stage.width).toBeGreaterThanOrEqual(fullPageGeometry.viewport.width - 1);
  expect(fullPageGeometry.stage.height).toBeGreaterThanOrEqual(fullPageGeometry.viewport.height - 1);
  expect(fullPageGeometry.canvas).toEqual(fullPageGeometry.stage);
  await expect(page.locator('.province-map-command-panel')).toBeVisible();
  await expect(page.locator('.province-detail-panel')).toBeVisible();
  await expect(page.locator('.province-map-meta')).toBeVisible();
  const svg = map.locator('svg');
  await expect(svg).toBeVisible();
  expect(await svg.locator('path').count()).toBeGreaterThanOrEqual(34);
  await expect(svg.getByText('南海诸岛', { exact: true })).toHaveCount(0);
  const renderedRegionLabels = await svg.locator('text').allTextContents();
  for (const name of ['北京', '广东', '新疆', '西藏', '黑龙江']) {
    expect(renderedRegionLabels).toContain(name);
  }
  const labelOverlaps = await svg.locator('text').evaluateAll((nodes) => nodes.flatMap((node, index) => {
    const left = node.getBoundingClientRect();
    if (!node.textContent?.trim() || left.width <= 0 || left.height <= 0) return [];
    return nodes.slice(index + 1).flatMap((candidate) => {
      const right = candidate.getBoundingClientRect();
      if (!candidate.textContent?.trim() || right.width <= 0 || right.height <= 0) return [];
      const overlapsHorizontally = left.left < right.right && left.right > right.left;
      const overlapsVertically = left.top < right.bottom && left.bottom > right.top;
      return overlapsHorizontally && overlapsVertically
        ? [`${node.textContent} / ${candidate.textContent}`]
        : [];
    });
  }));
  expect(labelOverlaps).toEqual([]);

  await svg.locator('text').filter({ hasText: /^广东$/ }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '440000');
  await expect(page.getByRole('heading', { name: '广东省' })).toBeVisible();
  await expect(page.getByText('当地商品只进入本地仓库，订单只与当地盘口撮合。')).toBeVisible();

  await page.getByRole('combobox', { name: '省级地区' }).click();
  await page.getByRole('listbox', { name: '省级地区' })
    .getByRole('option', { name: '澳门特别行政区' })
    .click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '820000');
  await expect(page.getByRole('heading', { name: '澳门特别行政区' })).toBeVisible();

  await page.getByRole('button', { name: '进入本地市场' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('market');
});

test('mobile grand-map layout keeps the country between safe overlay panels without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const stage = page.locator('.province-map-page');
  const map = page.getByTestId('china-province-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '34');
  const geometry = await stage.evaluate((element) => {
    const command = element.querySelector('.province-map-command-panel')?.getBoundingClientRect();
    const meta = element.querySelector('.province-map-meta')?.getBoundingClientRect();
    const pathRects = [...element.querySelectorAll('.province-map-echart svg path')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    return {
      commandBottom: command?.bottom ?? 0,
      metaTop: meta?.top ?? Number.POSITIVE_INFINITY,
      mapTop: Math.min(...pathRects.map((rect) => rect.top)),
      mapRight: Math.max(...pathRects.map((rect) => rect.right)),
      mapBottom: Math.max(...pathRects.map((rect) => rect.bottom)),
      mapLeft: Math.min(...pathRects.map((rect) => rect.left)),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.mapLeft).toBeGreaterThanOrEqual(-1);
  expect(geometry.mapRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.mapTop).toBeGreaterThanOrEqual(geometry.commandBottom - 2);
  expect(geometry.mapBottom).toBeLessThanOrEqual(geometry.metaTop + 2);
  await expect(map.locator('svg').getByText('南海诸岛', { exact: true })).toHaveCount(0);
});
