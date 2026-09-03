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
      return { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left, width: bounds.width, height: bounds.height };
    };
    const hero = surface.querySelector('.market-detail-hero');
    const chart = surface.querySelector('.market-chart-card');
    const trade = surface.querySelector('.market-trade-card');
    const heroMetrics = Array.from(surface.querySelectorAll('.market-detail-hero__metrics > span'))
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

test('regional commodity detail keeps daily price and immediate trade in direct page flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalWheatDetail(page);

  const visibleHeroMetrics = await page.locator('.market-detail-hero__metrics > span:visible small').allTextContents();
  expect(visibleHeroMetrics).toEqual(['今日价格', '24h 变化', '可用库存']);
  const visibleTradeSummary = await page.locator('.market-trade-summary > span:visible small').allTextContents();
  expect(visibleTradeSummary).toEqual(['今日价格', '今日成交量', '24h 成交量', '下次调价']);

  await expect(page.locator('.market-immediate-trade-card')).toBeVisible();
  await expect(page.locator('#market-trade-quantity')).toBeVisible();
  await expect(page.locator('.local-trades-section')).toBeVisible();
  for (const selector of ['.market-fundamentals-grid', '.market-auto-trade-execution', '.market-detail-auto-trade', '.market-trade-book', '.book-order-row', '.own-open-orders-table', '.market-order-price']) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(page.getByText('已有订单', { exact: true })).toHaveCount(0);

  for (const selector of ['.market-detail-hero', '.market-chart-card', '.market-trade-card', '.market-account-panel']) {
    await expectDirectSurface(page, selector);
  }
  await expect(page.locator('.market-trade-card')).not.toHaveClass(/ui-primary-surface/);

  const geometry = await readDetailGeometry(page);
  expect(geometry.surface.width).toBeLessThanOrEqual(720);
  expect(geometry.hero).not.toBeNull();
  expect(geometry.heroMetrics).toHaveLength(3);
  expect(geometry.chart).not.toBeNull();
  expect(geometry.trade).not.toBeNull();
  expect(geometry.chart!.top).toBeGreaterThanOrEqual(geometry.hero!.bottom - 2);
  expect(geometry.trade!.top).toBeGreaterThan(geometry.chart!.top);
});

test('regional commodity daily-price detail stays readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalWheatDetail(page);
  await page.setViewportSize({ width: 390, height: 844 });

  const surface = page.locator('.market-detail-surface');
  const widthGeometry = await surface.evaluate((node) => ({ clientWidth: node.clientWidth, scrollWidth: node.scrollWidth }));
  expect(widthGeometry.scrollWidth).toBeLessThanOrEqual(widthGeometry.clientWidth + 1);
  await expect(page.locator('#market-trade-quantity')).toBeVisible();
  await expect(page.locator('.market-quantity-stepper')).toBeVisible();
  await expect(page.locator('.market-trade-book')).toHaveCount(0);
  await expect(page.locator('.own-open-orders-table')).toHaveCount(0);
  const heroMetrics = await page.locator('.market-detail-hero__metrics > span:visible small').allTextContents();
  expect(heroMetrics).toEqual(['今日价格', '24h 变化', '可用库存']);
  const tradeSummary = await page.locator('.market-trade-summary > span:visible small').allTextContents();
  expect(tradeSummary).toEqual(['今日价格', '今日成交量', '24h 成交量', '下次调价']);
});
