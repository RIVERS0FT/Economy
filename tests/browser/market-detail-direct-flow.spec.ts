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

async function expectEntityCardSurface(page: Page, selector: string) {
  const style = await page.locator(selector).evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      backgroundColor: computed.backgroundColor,
      borderTopWidth: computed.borderTopWidth,
      borderRadius: computed.borderRadius,
      boxShadow: computed.boxShadow,
    };
  });
  expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(style.borderTopWidth).toBe('1px');
  expect(style.borderRadius).not.toBe('0px');
  expect(style.boxShadow).toBe('none');
}

async function readDetailGeometry(page: Page) {
  return page.locator('.market-detail-surface').evaluate((surface) => {
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return { top: bounds.top, right: bounds.right, bottom: bounds.bottom, left: bounds.left, width: bounds.width, height: bounds.height };
    };
    const hero = surface.querySelector('.market-detail-hero');
    const iconCard = surface.querySelector('.market-detail-product-icon-card');
    const summary = surface.querySelector('.market-detail-trade-summary');
    const chart = surface.querySelector('.market-chart-card');
    const trade = surface.querySelector('.market-trade-card');
    return {
      surface: rect(surface),
      hero: hero ? rect(hero) : null,
      iconCard: iconCard ? rect(iconCard) : null,
      summary: summary ? rect(summary) : null,
      chart: chart ? rect(chart) : null,
      trade: trade ? rect(trade) : null,
    };
  });
}

test('regional commodity detail keeps daily price and immediate trade in direct page flow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openRegionalWheatDetail(page);

  await expect(page.locator('.market-detail-hero')).toHaveCount(0);
  await expect(page.locator('.market-detail-product-artwork[data-product-artwork="wheat"]')).toBeVisible();
  await expectEntityCardSurface(page, '.market-detail-product-icon-card');
  await expectEntityCardSurface(page, '.market-detail-trade-summary');
  const visibleTradeSummary = await page.locator('.market-detail-trade-summary > span:visible small').allTextContents();
  expect(visibleTradeSummary).toEqual(['今日价格', '今日成交量', '可用库存', '冻结库存']);

  await expect(page.locator('.market-immediate-trade-card')).toBeVisible();
  await expect(page.locator('.market-immediate-trade-card .widget-heading')).toHaveCount(0);
  await expect(page.locator('.market-chart-card .widget-heading')).toHaveCount(0);
  await expect(page.getByText('小麦近 24h 成交趋势', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('交易摘要')).toBeVisible();
  await expect(page.locator('#market-trade-quantity')).toBeVisible();
  await expect(page.locator('.local-trades-section')).toBeVisible();
  for (const selector of ['.market-fundamentals-grid', '.market-auto-trade-execution', '.market-detail-auto-trade', '.market-trade-book', '.book-order-row', '.own-open-orders-table', '.market-order-price']) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(page.getByText('已有订单', { exact: true })).toHaveCount(0);

  for (const selector of ['.market-trade-card', '.market-account-panel']) {
    await expectDirectSurface(page, selector);
  }
  await expectEntityCardSurface(page, '.market-chart-card');
  await expect(page.locator('.market-trade-card')).not.toHaveClass(/ui-primary-surface/);

  const geometry = await readDetailGeometry(page);
  expect(geometry.surface.width).toBeLessThanOrEqual(720);
  expect(geometry.hero).toBeNull();
  expect(geometry.iconCard).not.toBeNull();
  expect(geometry.summary).not.toBeNull();
  expect(geometry.chart).not.toBeNull();
  expect(geometry.trade).not.toBeNull();
  expect(geometry.iconCard!.height).toBeCloseTo(geometry.summary!.height, 0);
  expect(geometry.iconCard!.width).toBeCloseTo(geometry.iconCard!.height, 0);
  expect(geometry.chart!.top).toBeGreaterThanOrEqual(geometry.summary!.bottom - 2);
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
  await expect(page.locator('.market-detail-hero')).toHaveCount(0);
  await expect(page.locator('.market-detail-product-artwork[data-product-artwork="wheat"]')).toBeVisible();
  await expectEntityCardSurface(page, '.market-detail-trade-summary');
  const tradeSummary = await page.locator('.market-detail-trade-summary > span:visible small').allTextContents();
  expect(tradeSummary).toEqual(['今日价格', '今日成交量', '可用库存', '冻结库存']);
});

test('regional commodity detail keeps snapshot trend when its detail request fails', async ({ page }) => {
  await page.route('**/economy-api/game/market-detail**', (route) => route.fulfill({ status: 503 }));
  await openRegionalWheatDetail(page);

  const chartCard = page.locator('.market-chart-card');
  await expect(chartCard.locator('.market-chart-card__content')).not.toHaveAttribute('aria-disabled', 'true');
  await expect(chartCard.getByText('成交趋势图不可用', { exact: true })).toHaveCount(0);
  await expect(chartCard.locator('.market-history-chart')).toBeVisible();
  await expect(chartCard.locator('.economy-chart')).toHaveAttribute('data-echarts-ready', 'true');
});
