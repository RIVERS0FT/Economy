import { expect, test } from '@playwright/test';

function intersectionArea(a: { left: number; top: number; right: number; bottom: number }, b: { left: number; top: number; right: number; bottom: number }) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

test('game ECharts tooltip remains inside the lower workspace and never covers shell chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (!box) throw new Error('市场行情图几何缺失');
  const plot = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const read = (name: string) => Number(wrapper.dataset[name]);
    return {
      left: read('axisLeft'),
      right: read('axisRight'),
      top: read('priceTop'),
      bottom: read('priceBottom'),
    };
  });
  const x = box.x + plot.left + (box.width - plot.left - plot.right) * 0.62;
  const y = box.y + (plot.top + plot.bottom) / 2;
  await page.mouse.move(x, y);

  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(tooltip).toBeVisible();
  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');
    const tooltip = document.querySelector<HTMLElement>('.economy-chart-tooltip');
    if (!workspace || !status || !sidebar || !tooltip) throw new Error('游戏浮层安全区结构缺失');
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      workspace: rect(workspace),
      status: rect(status),
      sidebar: rect(sidebar),
      tooltip: rect(tooltip),
    };
  });

  expect(geometry.tooltip.left).toBeGreaterThanOrEqual(geometry.workspace.left - 1);
  expect(geometry.tooltip.top).toBeGreaterThanOrEqual(geometry.workspace.top - 1);
  expect(geometry.tooltip.right).toBeLessThanOrEqual(geometry.workspace.right + 1);
  expect(geometry.tooltip.bottom).toBeLessThanOrEqual(geometry.workspace.bottom + 1);
  expect(intersectionArea(geometry.tooltip, geometry.status)).toBe(0);
  expect(intersectionArea(geometry.tooltip, geometry.sidebar)).toBe(0);
});

test('mobile workspace floating layer excludes the top status bar and bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const geometry = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
    if (!layer || !status || !navigation) throw new Error('移动浮层安全区结构缺失');
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return { layer: rect(layer), status: rect(status), navigation: rect(navigation) };
  });

  expect(geometry.layer.top).toBeGreaterThanOrEqual(geometry.status.bottom);
  expect(geometry.layer.bottom).toBeLessThanOrEqual(geometry.navigation.top);
  expect(intersectionArea(geometry.layer, geometry.status)).toBe(0);
  expect(intersectionArea(geometry.layer, geometry.navigation)).toBe(0);
});
