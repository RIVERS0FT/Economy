import { expect, test, type Page } from '@playwright/test';

async function openRegionalWheatDetail(page: Page) {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();
  await page.getByRole('button', { name: '打开小麦全局详情' }).click();
  await page.getByRole('button', { name: '打开加利福尼亚小麦详情' }).click();
  await expect(page.locator('.market-detail-surface')).toBeVisible();
}

async function expectDirectSurface(page: Page, selector: string) {
  const style = await page.locator(selector).evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      backgroundColor: computed.backgroundColor,
      borderTopWidth: computed.borderTopWidth,
      boxShadow: computed.boxShadow,
    };
  });
  expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(style.borderTopWidth).toBe('0px');
  expect(style.boxShadow).toBe('none');
}

async function readDetailGeometry(page: Page) {
  return page.locator('.market-detail-surface').evaluate((surface) => {
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return {
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        left: bounds.left,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const visibleMetricCards = Array.from(surface.querySelectorAll('.market-fundamentals-grid .ui-metric-card'))
      .filter((element) => element.getClientRects().length > 0)
      .map(rect);
    const hero = surface.querySelector('.market-detail-hero');
    const fundamentals = surface.querySelector('.market-fundamentals-grid');
    const chart = surface.querySelector('.market-chart-card');
    const heroMetrics = Array.from(surface.querySelectorAll('.market-detail-hero__metric'))
      .filter((element) => element.getClientRects().length > 0)
      .map(rect);
    return {
      surface: rect(surface),
      hero: hero ? rect(hero) : null,
      heroMetrics,
      fundamentals: fundamentals ? rect(fundamentals) : null,
      visibleMetricCards,
      chart: chart ? rect(chart) : null,
    };
  });
}

test('regional commodity detail keeps only non-duplicate context in direct page flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalWheatDetail(page);

  const visibleFundamentals = await page.locator(
    '.market-fundamentals-grid .ui-metric-card:visible > span',
  ).allTextContents();
  expect(visibleFundamentals).toEqual(['需求满足率', '参考价', '上轮需求', '可用库存']);

  for (const hiddenLabel of [
    '官方系统价',
    '卖单量',
    '买单量',
    '挂单差额',
    '周期系统买卖量',
    '冻结库存',
    '发运在途',
    '预计生产速度',
    '预计等效产能',
  ]) {
    await expect(page.getByText(hiddenLabel, { exact: true })).toBeHidden();
  }
  await expect(page.locator('.market-fundamentals-balance')).toBeHidden();
  await expect(page.locator('.market-fundamentals-card > .widget-heading')).toBeHidden();
  await expect(page.locator('.market-inventory-production-card > .widget-heading')).toBeHidden();

  const visibleTradeSummary = await page.locator(
    '.market-trade-summary > span:visible small',
  ).allTextContents();
  expect(visibleTradeSummary).toEqual(['最近成交', '24h 成交量']);

  for (const selector of [
    '.market-detail-hero',
    '.market-fundamentals-card',
    '.market-inventory-production-card',
    '.market-chart-card',
    '.market-account-panel',
  ]) {
    await expectDirectSurface(page, selector);
  }

  await expect(page.locator('.market-trade-card')).toHaveClass(/ui-primary-surface/);
  await expect(page.locator('.market-detail-auto-trade')).toBeVisible();

  const geometry = await readDetailGeometry(page);
  expect(geometry.surface.width).toBeLessThanOrEqual(720);
  expect(geometry.hero).not.toBeNull();
  expect(geometry.heroMetrics).toHaveLength(3);
  expect(geometry.visibleMetricCards).toHaveLength(4);
  expect(geometry.fundamentals).not.toBeNull();
  expect(geometry.chart).not.toBeNull();

  const hero = geometry.hero!;
  for (const metric of geometry.heroMetrics) {
    expect(metric.left).toBeGreaterThanOrEqual(hero.left - 1);
    expect(metric.right).toBeLessThanOrEqual(hero.right + 1);
  }
  expect(Math.max(...geometry.heroMetrics.map((metric) => metric.top))
    - Math.min(...geometry.heroMetrics.map((metric) => metric.top))).toBeLessThanOrEqual(2);

  const summary = geometry.fundamentals!;
  const [demand, reference, previousDemand, inventory] = geometry.visibleMetricCards;
  expect(Math.abs(demand.top - reference.top)).toBeLessThanOrEqual(2);
  expect(previousDemand.top).toBeGreaterThan(demand.top + 2);
  expect(Math.abs(previousDemand.top - inventory.top)).toBeLessThanOrEqual(2);
  expect(inventory.right).toBeGreaterThanOrEqual(summary.right - 2);
  expect(summary.bottom - Math.max(...geometry.visibleMetricCards.map((metric) => metric.bottom)))
    .toBeLessThanOrEqual(20);
  expect(geometry.chart!.top - summary.bottom).toBeLessThanOrEqual(40);
});

test('regional commodity direct detail flow stays readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalWheatDetail(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const surface = page.locator('.market-detail-surface');
  await expect(surface).toBeVisible();
  const widthGeometry = await surface.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(widthGeometry.scrollWidth).toBeLessThanOrEqual(widthGeometry.clientWidth + 1);

  const visibleFundamentals = await page.locator(
    '.market-fundamentals-grid .ui-metric-card:visible > span',
  ).allTextContents();
  expect(visibleFundamentals).toEqual(['需求满足率', '参考价', '上轮需求', '可用库存']);
  await expect(page.locator('.market-trade-summary > span:visible')).toHaveCount(2);
  await expect(page.locator('.market-chart-card')).toBeVisible();
  await expect(page.locator('.market-trade-card')).toBeVisible();

  const geometry = await readDetailGeometry(page);
  expect(geometry.hero).not.toBeNull();
  expect(geometry.heroMetrics).toHaveLength(3);
  expect(geometry.visibleMetricCards).toHaveLength(4);
  const hero = geometry.hero!;
  for (const metric of geometry.heroMetrics) {
    expect(metric.left).toBeGreaterThanOrEqual(hero.left - 1);
    expect(metric.right).toBeLessThanOrEqual(hero.right + 1);
  }
  const [demand, reference, previousDemand, inventory] = geometry.visibleMetricCards;
  expect(Math.abs(demand.top - reference.top)).toBeLessThanOrEqual(2);
  expect(previousDemand.top).toBeGreaterThan(demand.top + 2);
  expect(Math.abs(previousDemand.top - inventory.top)).toBeLessThanOrEqual(2);
});
