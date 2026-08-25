import { expect, test } from '@playwright/test';

test('desktop market uses compact order-book rows without duplicate headers', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const tradeCard = page.locator('.market-trade-card');
  await expect(tradeCard).toBeVisible();
  await expect(tradeCard.locator('.market-compact-view-switch')).toHaveCount(0);
  await expect(tradeCard.locator('.market-trade-section-heading small')).toBeHidden();
  await expect(tradeCard.locator('.order-book-columns')).toHaveCount(0);
  await expect(tradeCard.locator('.order-book-midpoint')).toHaveCount(0);
  await expect(page.locator('.market-account-view-switch')).toHaveCount(0);

  await expect(tradeCard.locator('.market-trade-entry')).toBeVisible();
  await expect(tradeCard.locator('.market-trade-book')).toBeVisible();
  await expect(tradeCard.locator('.book-order-row.ask').first()).toBeVisible();
  await expect(tradeCard.locator('.book-order-row.bid').first()).toBeVisible();
});

test('mobile market matches desktop order-book structure and keeps side-by-side trade panels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');

  const tradeCard = page.locator('.market-trade-card');
  await expect(tradeCard.locator('.order-book-columns')).toHaveCount(0);
  await expect(tradeCard.locator('.order-book-midpoint')).toHaveCount(0);
  await expect(tradeCard.locator('.book-order-row.ask').first()).toBeVisible();
  await expect(tradeCard.locator('.book-order-row.bid').first()).toBeVisible();
  await expect(page.locator('.market-account-view-switch')).toHaveCount(0);
  const accountSections = page.locator('.market-account-grid > section');
  await expect(accountSections).toHaveCount(2);
  await expect(accountSections.nth(0)).toContainText('已有订单');
  await expect(accountSections.nth(1)).toContainText('本地成交');
  const ordersBox = await accountSections.nth(0).boundingBox();
  const tradesBox = await accountSections.nth(1).boundingBox();
  expect(ordersBox).not.toBeNull();
  expect(tradesBox).not.toBeNull();
  expect(tradesBox!.y).toBeGreaterThan(ordersBox!.y + ordersBox!.height - 2);

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole('button', { name: '下单', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '盘口', exact: true })).toHaveCount(0);
  await expect(tradeCard.locator('.order-book-columns')).toHaveCount(0);
  await expect(tradeCard.locator('.order-book-midpoint')).toHaveCount(0);
  const orderEntry = tradeCard.locator('.market-trade-entry');
  const orderBook = tradeCard.locator('.market-trade-book');
  await expect(orderEntry).toBeVisible();
  await expect(orderBook).toBeVisible();
  const entryBox = await orderEntry.boundingBox();
  const bookBox = await orderBook.boundingBox();
  expect(entryBox).not.toBeNull();
  expect(bookBox).not.toBeNull();
  expect(Math.abs(entryBox!.y - bookBox!.y)).toBeLessThan(3);
  expect(bookBox!.x).toBeGreaterThan(entryBox!.x + entryBox!.width - 3);
});
