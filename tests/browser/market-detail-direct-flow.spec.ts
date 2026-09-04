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
    const hero = surface.querySelector('.market-detail-hero');
    const chart = surface.querySelector('.market-chart-card');
    const trade = surface.querySelector('.market-trade-card');
    const heroMetrics = Array.from(surface.querySelectorAll('.market-detail-hero__metric'))
      .filter((element) => element.getClientRects().length > 0)
      .map(rect);
    return {
      surface: rect(surface),
      hero: hero ? rect(hero) : null,
      heroMetrics,
      chart: chart ? rect(chart) : null,
      trade: trade ? rect(trade) : null,
    };
  });
}

test('regional commodity detail keeps only compact market facts in direct page flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalWheatDetail(page);

  const visibleHeroMetrics = await page.locator(
    '.market-detail-hero__metric:visible small',
  ).allTextContents();
  expect(visibleHeroMetrics).toEqual(['今日价格', '24h 变化', '可用库存']);

  for (const deletedLabel of [
    '市场价',
    '基准偏离',
    '需求满足率',
    '参考价',
    '上轮需求',
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
    await expect(page.getByText(deletedLabel, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator('.market-fundamentals-grid')).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
  await expect(page.locator('.market-detail-auto-trade')).toHaveCount(0);

  const visibleTradeSummary = await page.locator(
    '.market-trade-summary > span:visible small',
  ).allTextContents();
  expect(visibleTradeSummary).toEqual(['今日价格', '今日成交量', '24h 成交量', '下次调价']);

  for (const selector of [
    '.market-detail-hero',
    '.market-chart-card',
    '.market-trade-card',
    '.market-account-panel',
  ]) {
    await expectDirectSurface(page, selector);
  }
  await expect(page.locator('.market-trade-card')).not.toHaveClass(/ui-primary-surface/);

  const geometry = await readDetailGeometry(page);
  expect(geometry.surface.width).toBeLessThanOrEqual(720);
  expect(geometry.hero).not.toBeNull();
  expect(geometry.heroMetrics).toHaveLength(2);
  expect(geometry.chart).not.toBeNull();
  expect(geometry.trade).not.toBeNull();

  const hero = geometry.hero!;
  for (const metric of geometry.heroMetrics) {
    expect(metric.left).toBeGreaterThanOrEqual(hero.left - 1);
    expect(metric.right).toBeLessThanOrEqual(hero.right + 1);
  }
  expect(Math.max(...geometry.heroMetrics.map((metric) => metric.top))
    - Math.min(...geometry.heroMetrics.map((metric) => metric.top))).toBeLessThanOrEqual(2);
  expect(geometry.chart!.top - hero.bottom).toBeLessThanOrEqual(40);
  expect(geometry.trade!.top).toBeGreaterThan(geometry.chart!.top);
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

  const visibleHeroMetrics = await page.locator(
    '.market-detail-hero__metric:visible small',
  ).allTextContents();
  expect(visibleHeroMetrics).toEqual(['今日价格', '24h 变化', '可用库存']);
  await expect(page.locator('.market-fundamentals-grid')).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
  await expect(page.locator('.market-trade-summary > span:visible')).toHaveCount(2);
  await expect(page.locator('.market-chart-card')).toBeVisible();
  await expect(page.locator('.market-trade-card')).toBeVisible();
  await expect(page.locator('.market-trade-card')).not.toHaveClass(/ui-primary-surface/);

  const geometry = await readDetailGeometry(page);
  expect(geometry.hero).not.toBeNull();
  expect(geometry.heroMetrics).toHaveLength(2);
  const hero = geometry.hero!;
  for (const metric of geometry.heroMetrics) {
    expect(metric.left).toBeGreaterThanOrEqual(hero.left - 1);
    expect(metric.right).toBeLessThanOrEqual(hero.right + 1);
  }
  expect(Math.max(...geometry.heroMetrics.map((metric) => metric.top))
    - Math.min(...geometry.heroMetrics.map((metric) => metric.top))).toBeLessThanOrEqual(2);
});
