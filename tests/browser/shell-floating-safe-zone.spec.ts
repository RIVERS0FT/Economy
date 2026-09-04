import { expect, test } from '@playwright/test';

type Rect = { left: number; top: number; right: number; bottom: number };

function intersectionArea(a: Rect, b: Rect) {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
    * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

function expectRectsClose(actual: Rect, expected: Rect) {
  expect(actual.left).toBeCloseTo(expected.left, 0);
  expect(actual.top).toBeCloseTo(expected.top, 0);
  expect(actual.right).toBeCloseTo(expected.right, 0);
  expect(actual.bottom).toBeCloseTo(expected.bottom, 0);
}

test('game ECharts tooltip uses the shared tooltip host and never covers shell chrome', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const chart = page.locator('.market-history-chart.full');
  const economyChart = chart.locator('.economy-chart');
  await expect(economyChart).toHaveAttribute('data-echarts-ready', 'true');
  await expect(economyChart.locator('.economy-chart__canvas')).toHaveAttribute('data-echarts-tooltip-layer', 'workspace');
  const tooltipLayer = page.locator('.workspace-tooltip-layer');
  await expect(tooltipLayer).not.toHaveAttribute('popover', 'manual');
  await expect(tooltipLayer).not.toHaveAttribute('data-top-layer', 'true');
  expect(await tooltipLayer.evaluate((element) => element.matches(':popover-open'))).toBe(false);
  expect(await tooltipLayer.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');

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

  const tooltip = tooltipLayer.locator('.economy-chart-tooltip');
  await expect(tooltip).toBeVisible();
  const tooltipVisual = await tooltip.evaluate((node) => {
    const style = getComputedStyle(node);
    const webkitBackdropFilter = (style as CSSStyleDeclaration & { webkitBackdropFilter?: string }).webkitBackdropFilter;
    return {
      className: node.className,
      backdropFilter: style.backdropFilter || webkitBackdropFilter || '',
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderTopColor: style.borderTopColor,
      boxShadow: style.boxShadow,
      inTooltipLayer: node.parentElement?.matches('.workspace-tooltip-layer') ?? false,
    };
  });
  expect(tooltipVisual.inTooltipLayer).toBe(true);
  expect(tooltipVisual.className).toContain('ui-tooltip-surface');
  expect(tooltipVisual.backdropFilter).toContain('blur(18px)');
  expect(tooltipVisual.backgroundColor).toBe('rgba(5, 20, 14, 0.76)');
  expect(tooltipVisual.backgroundImage).toContain('linear-gradient');
  expect(tooltipVisual.borderTopColor).toBe('rgba(212, 245, 224, 0.18)');
  expect(tooltipVisual.boxShadow).not.toBe('none');

  const geometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const tooltipLayer = document.querySelector<HTMLElement>('.workspace-tooltip-layer');
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');
    const tooltip = document.querySelector<HTMLElement>('.workspace-tooltip-layer .economy-chart-tooltip');
    if (!workspace || !floatingLayer || !tooltipLayer || !status || !sidebar || !tooltip) {
      throw new Error('游戏浮层安全区结构缺失');
    }
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      workspace: rect(workspace),
      floatingLayer: rect(floatingLayer),
      tooltipLayer: rect(tooltipLayer),
      status: rect(status),
      sidebar: rect(sidebar),
      tooltip: rect(tooltip),
    };
  });

  expectRectsClose(geometry.tooltipLayer, geometry.floatingLayer);
  expect(geometry.tooltip.left).toBeGreaterThanOrEqual(geometry.workspace.left - 1);
  expect(geometry.tooltip.top).toBeGreaterThanOrEqual(geometry.workspace.top - 1);
  expect(geometry.tooltip.right).toBeLessThanOrEqual(geometry.workspace.right + 1);
  expect(geometry.tooltip.bottom).toBeLessThanOrEqual(geometry.workspace.bottom + 1);
  expect(intersectionArea(geometry.tooltip, geometry.status)).toBe(0);
  expect(intersectionArea(geometry.tooltip, geometry.sidebar)).toBe(0);

  const quantityInput = page.locator('#market-trade-quantity');
  await expect(quantityInput).toHaveValue('1');
  await page.getByRole('button', { name: '数量增加 1' }).click();
  await expect(quantityInput).toHaveValue('2');
  await expect(page.locator('#market-order-price')).toHaveCount(0);
});

test('mobile workspace floating layer excludes the top status bar and bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const geometry = await page.evaluate(() => {
    const layer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const tooltipLayer = document.querySelector<HTMLElement>('.workspace-tooltip-layer');
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const navigation = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
    if (!layer || !tooltipLayer || !status || !navigation) throw new Error('移动浮层安全区结构缺失');
    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    return {
      layer: rect(layer),
      tooltipLayer: rect(tooltipLayer),
      status: rect(status),
      navigation: rect(navigation),
    };
  });

  expectRectsClose(geometry.tooltipLayer, geometry.layer);
  expect(geometry.layer.top).toBeGreaterThanOrEqual(geometry.status.bottom);
  expect(geometry.layer.bottom).toBeLessThanOrEqual(geometry.navigation.top);
  expect(intersectionArea(geometry.layer, geometry.status)).toBe(0);
  expect(intersectionArea(geometry.layer, geometry.navigation)).toBe(0);
});
