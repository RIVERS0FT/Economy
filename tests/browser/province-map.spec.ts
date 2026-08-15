import { expect, test } from '@playwright/test';

test('persistent US strategy map exposes 48 states, lenses, and local context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-province-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '110000');
  await expect(page.locator('.application-map-layer')).toBeVisible();
  await expect(page.locator('.application-ui-layer')).toBeVisible();
  await expect(page.locator('.workspace-strategic-chrome')).toBeVisible();
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.locator('.strategic-map-lens-bar')).toBeVisible();
  await expect(page.locator('.province-map-page')).toHaveCount(1);
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);
  await expect(page.getByText('战略经营地图', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('地图图例')).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      viewport: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
      mapLayer: rect('.application-map-layer'),
      map: rect('.strategic-map-stage'),
      mapLayerOverflow: getComputedStyle(document.querySelector<HTMLElement>('.application-map-layer')!).overflow,
      mapStageOverflow: getComputedStyle(document.querySelector<HTMLElement>('.strategic-map-stage')!).overflow,
      edgeStyles: [
        '.application-map-layer',
        '.strategic-map-stage',
        '.province-map-chart',
        '.province-map-echart',
        '.province-map-echart .economy-chart__canvas',
      ].map((selector) => {
        const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
        return {
          borderTopWidth: style.borderTopWidth,
          borderRadius: style.borderRadius,
          outlineStyle: style.outlineStyle,
          boxShadow: style.boxShadow,
        };
      }),
      pathBounds: (() => {
        const paths = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-echart svg path')]
          .map((path) => path.getBoundingClientRect())
          .filter((bounds) => bounds.width > 0 && bounds.height > 0);
        return {
          left: Math.min(...paths.map((bounds) => bounds.left)),
          top: Math.min(...paths.map((bounds) => bounds.top)),
          right: Math.max(...paths.map((bounds) => bounds.right)),
          bottom: Math.max(...paths.map((bounds) => bounds.bottom)),
        };
      })(),
    };
  });
  expect(geometry.mapLayer).toEqual(geometry.viewport);
  expect(geometry.map).toEqual(geometry.mapLayer);
  expect(geometry.mapLayerOverflow).toBe('visible');
  expect(geometry.mapStageOverflow).toBe('visible');
  for (const edgeStyle of geometry.edgeStyles) {
    expect(edgeStyle).toEqual({
      borderTopWidth: '0px',
      borderRadius: '0px',
      outlineStyle: 'none',
      boxShadow: 'none',
    });
  }
  expect(geometry.pathBounds.left).toBeGreaterThanOrEqual(geometry.viewport.left + 8);
  expect(geometry.pathBounds.top).toBeGreaterThanOrEqual(geometry.viewport.top + 8);
  expect(geometry.pathBounds.right).toBeLessThanOrEqual(geometry.viewport.right - 8);
  expect(geometry.pathBounds.bottom).toBeLessThanOrEqual(geometry.viewport.bottom - 8);

  const svg = map.locator('svg');
  await expect(svg).toBeVisible();
  expect(await svg.locator('path').count()).toBeGreaterThanOrEqual(48);
  for (const excludedCode of ['AK', 'HI', 'DC']) {
    await expect(svg.getByText(excludedCode, { exact: true })).toHaveCount(0);
  }
  const renderedRegionLabels = await svg.locator('text').allTextContents();
  for (const name of ['CA', 'TX', 'WA', 'FL', 'NY']) expect(renderedRegionLabels).toContain(name);

  const instanceId = await map.locator('.economy-chart__canvas').getAttribute('data-echarts-instance-id');
  await svg.locator('text').filter({ hasText: /^TX$/ }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', 'US-TX');
  await svg.locator('text').filter({ hasText: /^CA$/ }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '110000');

  await page.getByRole('navigation', { name: '地图镜头' }).getByRole('button', { name: '市场', exact: true }).click();
  await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'market');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-lens', 'market');

  await page.getByRole('navigation', { name: '游戏主导航' })
    .getByRole('button', { name: '市场', exact: true })
    .click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('market');
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-instance-id', instanceId || '');
});

test('mobile strategy map fills the root map layer without obsolete map cards or inspector', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.strategic-province-inspector')).toHaveCount(0);
  await expect(page.locator('.strategic-map-lens-bar')).toBeHidden();
  await expect(page.locator('.province-map-page > *')).toHaveCount(0);

  const geometry = await page.evaluate(() => {
    const box = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    };
    const pathRects = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-echart svg path')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    return {
      viewport: { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight },
      mapLayer: box('.application-map-layer'),
      navigation: box('.mobile-bottom-navigation'),
      mapLeft: Math.min(...pathRects.map((rect) => rect.left)),
      mapRight: Math.max(...pathRects.map((rect) => rect.right)),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.mapLayer).toEqual(geometry.viewport);
  expect(geometry.mapLeft).toBeGreaterThanOrEqual(geometry.mapLayer.left - 1);
  expect(geometry.mapRight).toBeLessThanOrEqual(geometry.mapLayer.right + 1);
  expect(geometry.navigation.top).toBeLessThan(geometry.mapLayer.bottom);
  for (const excludedCode of ['AK', 'HI', 'DC']) {
    await expect(map.locator('svg').getByText(excludedCode, { exact: true })).toHaveCount(0);
  }
});
