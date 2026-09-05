import { expect, test, type Page } from '@playwright/test';

async function outlineGeometry(page: Page) {
  return page.evaluate(() => {
    const paths = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-region')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (!paths.length) throw new Error('map paths missing');
    const left = Math.min(...paths.map((rect) => rect.left));
    const top = Math.min(...paths.map((rect) => rect.top));
    const right = Math.max(...paths.map((rect) => rect.right));
    const bottom = Math.max(...paths.map((rect) => rect.bottom));
    return { left, top, right, bottom, aspect: (right - left) / (bottom - top) };
  });
}

async function labelCenter(page: Page, provinceId: string) {
  return page.locator(`.province-map-label[data-province-id="${provinceId}"]`).evaluate((label) => {
    const x = Number(label.getAttribute('data-label-center-x'));
    const y = Number(label.getAttribute('data-label-center-y'));
    const matrix = label.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) throw new Error('label center missing');
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f,
    };
  });
}

test('persistent strategy map uses one static SVG world for 48 states and Chinese labels', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const svg = map.locator('.province-map-world-svg');
  const cameraSurface = map.locator('.province-map-camera-surface');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-province-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(canvas).toHaveAttribute('data-map-renderer', 'static-svg');
  await expect(canvas).toHaveAttribute('data-map-camera-mode', 'svg-viewbox');
  await expect(canvas).toHaveAttribute('data-map-camera-hot-path', 'single-css-transform-write');
  await expect(canvas).toHaveAttribute('data-map-camera-geometry-mode', 'immutable-svg-world');
  await expect(canvas).toHaveAttribute('data-map-camera-boundary-mode', 'fixed-world-bounds');
  await expect(canvas).toHaveAttribute('data-map-fit-mode', 'mainland-area-target');
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '1440x900');
  await expect(canvas).toHaveAttribute('data-map-world-path-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-count', '48');
  await expect(canvas).toHaveAttribute('data-map-label-camera-mode', 'shared-static-world');
  await expect(svg).toHaveCount(1);
  await expect(cameraSurface).toHaveCount(1);
  await expect(cameraSurface).toHaveCSS('transform', 'none');
  await expect(cameraSurface).toHaveCSS('will-change', 'auto');
  await expect(map.locator('.province-map-region')).toHaveCount(48);
  await expect(map.locator('.province-map-label')).toHaveCount(48);
  await expect(page.locator('.application-map-layer')).toBeVisible();
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.getByLabel('地图图例')).toHaveCount(0);

  const viewportFontFamily = await canvas.evaluate((node) => getComputedStyle(node).fontFamily);
  const labelFontFamily = await map.locator('.province-map-label').first().evaluate((node) => getComputedStyle(node).fontFamily);
  expect(viewportFontFamily).toContain('Playfair Display');
  expect(viewportFontFamily).toContain('Noto Serif SC');
  expect(viewportFontFamily.toLowerCase()).toContain('serif');
  expect(labelFontFamily).toBe(viewportFontFamily);

  const labels = await map.locator('.province-map-label').allTextContents();
  for (const name of ['加利福尼亚', '得克萨斯', '华盛顿', '佛罗里达', '纽约']) {
    expect(labels).toContain(name);
  }
  for (const code of ['CA', 'TX', 'WA', 'FL', 'NY', 'AK', 'HI', 'DC']) {
    expect(labels).not.toContain(code);
  }
  const fitValues = await map.locator('.province-map-label').evaluateAll((nodes) => nodes.map((node) => ({
    fit: node.getAttribute('data-label-fit'),
    mode: node.getAttribute('data-label-glyph-mode'),
    naturalAspect: Number(node.getAttribute('data-label-natural-aspect')),
    usedWidth: Number(node.getAttribute('data-label-used-width')),
    usedHeight: Number(node.getAttribute('data-label-used-height')),
    availableLength: Number(node.getAttribute('data-label-available-length')),
    availableHeight: Number(node.getAttribute('data-label-available-height')),
  })));
  for (const value of fitValues) {
    expect(value.fit).toBe('inside');
    expect(value.mode).toBe('rigid');
    expect(value.usedWidth).toBeGreaterThan(0);
    expect(value.usedHeight).toBeGreaterThan(0);
    expect(value.usedWidth).toBeLessThanOrEqual(value.availableLength + 1);
    expect(value.usedHeight).toBeLessThanOrEqual(value.availableHeight + 1);
    expect(value.naturalAspect).toBeGreaterThan(0);
  }

  const geometry = await outlineGeometry(page);
  expect(geometry.left).toBeGreaterThanOrEqual(-2);
  expect(geometry.top).toBeGreaterThanOrEqual(-2);
  expect(geometry.right).toBeLessThanOrEqual(1442);
  expect(geometry.bottom).toBeLessThanOrEqual(902);
  const california = map.locator('.province-map-region[data-province-id="110000"]');
  await california.hover();
  await expect(page.locator('.province-map-static-tooltip')).toBeVisible();
  await expect(page.locator('.province-map-static-tooltip')).toContainText('加利福尼亚');

  const pathRevision = await canvas.getAttribute('data-map-path-revision');
  const labelRevision = await canvas.getAttribute('data-map-label-layout-revision');
  const viewBoxBeforeLens = await svg.getAttribute('viewBox');
  const lensBar = page.getByRole('navigation', { name: '地图镜头' });
  await expect(lensBar).toHaveCSS('backdrop-filter', 'none');
  await lensBar.getByRole('button', { name: '市场', exact: true }).click();
  await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'market');
  await expect(canvas).toHaveAttribute('data-map-path-revision', pathRevision || '');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', labelRevision || '');
  expect(await svg.getAttribute('viewBox')).toBe(viewBoxBeforeLens);
});

test('state selection opens local context without resetting the static camera', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  const svg = map.locator('.province-map-world-svg');
  await expect(map).toHaveAttribute('data-map-ready', 'true');

  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error('map bounds missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -320);
  await expect.poll(async () => Number(await canvas.getAttribute('data-map-zoom-current'))).toBeGreaterThan(1.05);
  const viewBoxBeforeSelection = await svg.getAttribute('viewBox');
  const labelBefore = await labelCenter(page, '150000');

  await map.locator('.province-map-region[data-province-id="150000"]').click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '150000');
  await expect(page.getByRole('heading', { name: '科罗拉多', exact: true })).toBeVisible();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-presentation', 'building');
  expect(await svg.getAttribute('viewBox')).toBe(viewBoxBeforeSelection);
  const labelAfter = await labelCenter(page, '150000');
  expect(Math.hypot(labelAfter.x - labelBefore.x, labelAfter.y - labelBefore.y)).toBeLessThan(1.5);

  const tabs = page.getByRole('tablist', { name: '科罗拉多页面分区' });
  await expect(tabs.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(tabs.getByRole('tab', { name: '市场', exact: true })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: '商业', exact: true })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: '工业', exact: true })).toBeVisible();
  await expect(tabs.getByRole('tab', { name: '仓库', exact: true })).toBeVisible();

  await tabs.getByRole('tab', { name: '工业', exact: true }).click();
  await expect(tabs.getByRole('tab', { name: '工业', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.production-build-card')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-list')).toBeVisible();
  await expect(page.locator('.buildings-summary-panel')).toHaveCount(0);
  await expect(page.locator('.buildings-list-filters')).toHaveCount(0);

  await tabs.getByRole('tab', { name: '仓库', exact: true }).click();
  await expect(page.locator('.province-warehouse-section')).toBeVisible();

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  expect(await svg.getAttribute('viewBox')).toBe(viewBoxBeforeSelection);
});

test('mobile static map keeps labels, touch gestures and hidden tooltip behavior', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.province-map-static-viewport');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '390x844');
  await expect(canvas).toHaveAttribute('data-map-tooltip-mode', 'hidden-mobile');
  await expect(canvas).toHaveCSS('touch-action', 'none');
  await expect(map.locator('.province-map-region')).toHaveCount(48);
  await expect(map.locator('.province-map-label')).toHaveCount(48);
  await expect(page.locator('.province-map-static-tooltip')).toHaveCount(0);
  await expect(page.locator('.application-map-layer > .strategic-map-lens-bar')).toBeHidden();

  const pathRevision = await canvas.getAttribute('data-map-path-revision');
  const labelRevision = await canvas.getAttribute('data-map-label-layout-revision');
  await page.setViewportSize({ width: 430, height: 844 });
  await expect(canvas).toHaveAttribute('data-map-contain-viewport', '430x844');
  await expect(canvas).toHaveAttribute('data-map-path-revision', pathRevision || '');
  await expect(canvas).toHaveAttribute('data-map-label-layout-revision', labelRevision || '');
  await expect(canvas).toHaveAttribute('data-map-zoom-current', '1.00000');

  await map.locator('.province-map-region[data-province-id="150000"]').click();
  await expect(page.getByRole('heading', { name: '科罗拉多', exact: true })).toBeVisible();
});
