import { expect, test, type Locator, type Page } from '@playwright/test';

async function openCommodityDetail(page: Page) {
  await page.goto('/market-runtime-test.html');
  const wheat = page.getByRole('button', { name: /查看.*详情/ }).first();
  await expect(wheat).toBeVisible();
  await wheat.click();
  await expect(page.getByText('即时交易', { exact: true })).toBeVisible();
}

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function inspectChartAxis(chart: Locator) {
  return chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const svg = wrapper.querySelector<SVGSVGElement>('.economy-chart__canvas svg');
    if (!svg) throw new Error('ECharts SVG is not ready');
    const readTicks = (name: string) => (wrapper.dataset[name] || '').split(',').filter(Boolean).map(Number);
    return {
      priceTicks: readTicks('priceTicks'),
      volumeTicks: readTicks('volumeTicks'),
      footerVisible: Boolean(wrapper.querySelector('.market-chart-footer')),
    };
  });
}

test('commodity detail uses the daily server price and has no resting-order UI', async ({ page }) => {
  await openCommodityDetail(page);
  await expect(page.getByText('今日成交价')).toBeVisible();
  await expect(page.getByText('下次调价')).toBeVisible();
  await expect(page.getByLabel('调整交易数量')).toBeVisible();
  await expect(page.getByRole('button', { name: /立即买入/ })).toBeVisible();
  await expect(page.locator('#market-order-price')).toHaveCount(0);
  await expect(page.getByText('实时五档')).toHaveCount(0);
  await expect(page.getByText('已有订单')).toHaveCount(0);
  await expect(page.getByText('撤单', { exact: true })).toHaveCount(0);
});

test('commodity quantity shortcuts remain available for immediate trading', async ({ page }) => {
  await openCommodityDetail(page);
  await expect(page.getByRole('button', { name: '25%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '50%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '最大' })).toBeVisible();
  const quantity = page.locator('#market-trade-quantity');
  await expect(quantity).toBeVisible();
  await page.getByRole('button', { name: '50%' }).click();
  await expect(quantity).not.toHaveValue('');
});

test('recent local trades remain separate from retired resting orders', async ({ page }) => {
  await openCommodityDetail(page);
  await expect(page.getByText(/最近成交/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '清除全部本地成交' })).toBeVisible();
});

test('market chart uses one linked hover state and keeps the price line protected', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await openCommodityDetail(page);

  const chart = page.locator('.market-history-chart.full');
  await expect(chart.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
  await expect(chart).toHaveAttribute('data-axis-pointer-linked', 'true');
  await expect(chart).toHaveAttribute('data-hover-emphasis-disabled', 'true');
  await chart.scrollIntoViewIfNeeded();

  const axis = await inspectChartAxis(chart);
  expect(axis.priceTicks.length).toBeGreaterThanOrEqual(3);
  expect(axis.volumeTicks.length).toBeGreaterThanOrEqual(3);
  expect(axis.footerVisible).toBe(true);

  const bounds = await requireBox(chart);
  const geometry = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const read = (name: string) => Number(wrapper.dataset[name]);
    return {
      left: read('axisLeft'),
      right: read('axisRight'),
      priceTop: read('priceTop'),
      priceBottom: read('priceBottom'),
      volumeTop: read('volumeTop'),
      volumeBottom: read('volumeBottom'),
    };
  });
  const x = bounds.x + geometry.left + (bounds.width - geometry.left - geometry.right) * 0.44;
  const tooltip = page.locator('.workspace-tooltip-layer .economy-chart-tooltip');

  await page.mouse.move(x, bounds.y + (geometry.priceTop + geometry.priceBottom) / 2);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('价格');
  await expect(tooltip).toContainText('总成交量');
  const priceHoverText = await tooltip.innerText();

  await page.mouse.move(x, bounds.y + (geometry.volumeTop + geometry.volumeBottom) / 2);
  await expect(tooltip).toBeVisible();
  const volumeHoverText = await tooltip.innerText();
  expect(volumeHoverText.replace(/\s+/g, ' ').trim()).toBe(priceHoverText.replace(/\s+/g, ' ').trim());
});
