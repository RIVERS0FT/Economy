import { expect, test } from '@playwright/test';

test('persistent US strategy map exposes 48 states, lenses, and local context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  await expect(page.getByRole('heading', { name: '美国本土地图', exact: true })).toBeVisible();
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-province-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '110000');
  await expect(page.locator('.workspace-background-layer')).toBeVisible();
  await expect(page.locator('.workspace-strategic-chrome')).toBeVisible();
  await expect(page.locator('.province-map-command-panel')).toBeVisible();
  await expect(page.locator('.strategic-province-inspector')).toBeVisible();
  await expect(page.locator('.province-map-meta')).toBeVisible();
  await expect(page.locator('.strategic-map-lens-bar')).toBeVisible();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`missing ${selector}`);
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      workspace: rect('.workspace'),
      background: rect('.workspace-background-layer'),
      map: rect('.strategic-map-stage'),
    };
  });
  expect(geometry.background).toEqual(geometry.workspace);
  expect(geometry.map).toEqual(geometry.workspace);

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
  await expect(page.locator('.strategic-province-inspector').getByRole('heading', { name: '得克萨斯州' })).toBeVisible();
  await expect(page.getByText('当地仓库、市场与工厂保持州级隔离。')).toBeVisible();

  await page.getByRole('combobox', { name: '州级地区' }).click();
  await page.getByRole('listbox', { name: '州级地区' })
    .getByRole('option', { name: '罗得岛州' })
    .click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', 'US-RI');
  await expect(page.locator('.strategic-province-inspector').getByRole('heading', { name: '罗得岛州' })).toBeVisible();

  await page.getByRole('navigation', { name: '地图镜头' }).getByRole('button', { name: '市场', exact: true }).click();
  await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'market');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-lens', 'market');

  await page.getByRole('button', { name: '进入本地市场' }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('market');
  await expect(map.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-instance-id', instanceId || '');
});

test('mobile strategy map stays beneath safe command and province panels without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-feature-count', '48');
  await expect(page.locator('.province-map-command-panel')).toBeVisible();
  await expect(page.locator('.strategic-province-inspector')).toBeVisible();
  await expect(page.locator('.strategic-map-lens-bar')).toBeHidden();

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
      workspace: box('.workspace'),
      background: box('.workspace-background-layer'),
      command: box('.province-map-command-panel'),
      inspector: box('.strategic-province-inspector'),
      navigation: box('.mobile-bottom-navigation'),
      mapLeft: Math.min(...pathRects.map((rect) => rect.left)),
      mapRight: Math.max(...pathRects.map((rect) => rect.right)),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.background.left).toBeGreaterThan(geometry.workspace.left);
  expect(geometry.background.right).toBeLessThan(geometry.workspace.right);
  expect(geometry.background.top).toBeCloseTo(geometry.workspace.top, 0);
  expect(geometry.background.bottom).toBeCloseTo(geometry.workspace.bottom, 0);
  expect(geometry.mapLeft).toBeGreaterThanOrEqual(geometry.background.left - 1);
  expect(geometry.mapRight).toBeLessThanOrEqual(geometry.background.right + 1);
  expect(geometry.command.top).toBeGreaterThanOrEqual(geometry.workspace.top);
  expect(geometry.inspector.bottom).toBeLessThanOrEqual(geometry.navigation.top - 1);
  for (const excludedCode of ['AK', 'HI', 'DC']) {
    await expect(map.locator('svg').getByText(excludedCode, { exact: true })).toHaveCount(0);
  }
});
