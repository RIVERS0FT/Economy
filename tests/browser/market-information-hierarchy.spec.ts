import { expect, test, type Page } from '@playwright/test';

async function openGlobalMarket(page: Page) {
  await page.route('**/api/game/community-link**', async (route) => {
    await route.fulfill({ json: { communityLink: null } });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '市场' })).toBeVisible();
}

async function openGlobalProductRegions(page: Page) {
  await openGlobalMarket(page);
  const row = page.getByRole('button', { name: '打开小麦全局详情' });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.locator('.global-market-product-region-list')).toBeVisible();
}

test('market catalog shows daily price and real trade metrics without orderbook columns', async ({ page }) => {
  await openGlobalMarket(page);
  const header = page.locator('.global-market-goods-header');
  await expect(header).toBeVisible();
  for (const label of ['商品', '24h成交量', '今日价格', '24h价格变化']) {
    await expect(header.getByText(label, { exact: true })).toBeVisible();
  }
  for (const label of ['卖单量', '买单量', '挂单差额', '挂单状态']) {
    await expect(header.getByText(label, { exact: true })).toHaveCount(0);
  }

  const row = page.getByRole('button', { name: '打开小麦全局详情' });
  await expect(row).toBeVisible();
  await expect(row.locator('.global-market-goods-row__chevron .game-icon')).toHaveCount(1);
  const geometry = await row.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});

test('global product detail keeps one sortable regional daily-price list', async ({ page }) => {
  await openGlobalProductRegions(page);
  const header = page.locator('.global-market-product-region-surface > .market-commodity-row-header');
  await expect(header).toBeVisible();
  for (const label of ['地区', '今日价格', '24h成交量', '24h价格变化']) {
    await expect(header.getByText(label, { exact: true })).toBeVisible();
  }
  for (const label of ['卖单量', '买单量']) {
    await expect(header.getByText(label, { exact: true })).toHaveCount(0);
  }

  const row = page.getByRole('button', { name: '打开加利福尼亚小麦详情' });
  await expect(row).toBeVisible();
  await expect(row.locator('.market-commodity-row__name strong')).toHaveText('加利福尼亚');
  const priceSort = header.getByRole('button', { name: '今日价格' });
  await priceSort.click();
  await expect(header.locator('[aria-sort="descending"]')).toHaveText('今日价格');
});

test('regional market detail exposes daily-price immediate trading only', async ({ page }) => {
  await openGlobalProductRegions(page);
  const row = page.getByRole('button', { name: '打开加利福尼亚小麦详情' });
  await row.click();

  const detail = page.locator('.market-detail-surface');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.market-detail-hero')).toHaveCount(0);
  await expect(detail.locator('.market-immediate-trade-card')).toBeVisible();
  await expect(detail.locator('.market-detail-trade-summary')).toHaveClass(/ui-entity-card/);
  for (const label of ['今日价格', '今日成交量', '可用库存', '冻结库存']) {
    await expect(detail.locator('.market-detail-trade-summary').getByText(label, { exact: true })).toBeVisible();
  }
  await expect(detail.locator('.market-contract-summary-card')).toHaveCount(0);
  for (const label of ['合同简要', '采购合同', '供应合同', '今日采购额度', '最低采购合同价', '查看相关合同']) {
    await expect(detail.getByText(label, { exact: true })).toHaveCount(0);
  }
  for (const retired of ['自动经营执行', '预计自动采购', '预计自动出售', '采购价格上限', '出售价格下限', '当前自由库存']) {
    await expect(detail.getByText(retired, { exact: true })).toHaveCount(0);
  }
  await expect(detail.locator('#market-trade-quantity')).toBeVisible();
  await expect(detail.locator('.local-trades-section')).toBeVisible();
  await expect(page.locator('.market-trade-book')).toHaveCount(0);
  await expect(page.locator('.book-order-row')).toHaveCount(0);
  await expect(page.getByText('已有订单', { exact: true })).toHaveCount(0);
  await expect(page.locator('.market-order-price')).toHaveCount(0);
});
