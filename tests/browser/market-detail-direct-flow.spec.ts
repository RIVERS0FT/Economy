import { expect, test, type Page } from '@playwright/test';

async function openRegionalWheatDetail(page: Page) {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();
  await page.getByRole('button', { name: '打开小麦全局详情' }).click();
  await page.getByRole('button', { name: '打开加利福尼亚州小麦详情' }).click();
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
});

test('regional commodity direct detail flow stays readable on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRegionalWheatDetail(page);

  const surface = page.locator('.market-detail-surface');
  const geometry = await surface.evaluate((node) => ({
    clientWidth: node.clientWidth,
    scrollWidth: node.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);

  const visibleFundamentals = await page.locator(
    '.market-fundamentals-grid .ui-metric-card:visible > span',
  ).allTextContents();
  expect(visibleFundamentals).toEqual(['需求满足率', '参考价', '上轮需求', '可用库存']);
  await expect(page.locator('.market-trade-summary > span:visible')).toHaveCount(2);
  await expect(page.locator('.market-chart-card')).toBeVisible();
  await expect(page.locator('.market-trade-card')).toBeVisible();
});
