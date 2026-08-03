import { expect, test } from '@playwright/test';

test('desktop market hides auxiliary trade switches and order-book rows', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');

  const tradeCard = page.locator('.market-trade-card');
  await expect(tradeCard).toBeVisible();
  await expect(tradeCard.locator('.market-compact-view-switch')).toHaveCount(0);
  await expect(tradeCard.locator('.market-trade-section-heading small')).toBeHidden();
  await expect(tradeCard.locator('.order-book-columns')).toBeHidden();
  await expect(tradeCard.locator('.order-book-midpoint')).toBeHidden();
  await expect(page.locator('.market-account-view-switch')).toBeHidden();

  await expect(tradeCard.locator('.market-trade-entry')).toBeVisible();
  await expect(tradeCard.locator('.market-trade-book')).toBeVisible();
  await expect(tradeCard.locator('.book-order-row.ask').first()).toBeVisible();
  await expect(tradeCard.locator('.book-order-row.bid').first()).toBeVisible();
});

test('mobile market keeps order-book details and side-by-side trade panels', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');

  const tradeCard = page.locator('.market-trade-card');
  await expect(tradeCard.locator('.order-book-columns')).toBeVisible();
  await expect(tradeCard.locator('.order-book-midpoint')).toBeVisible();
  await expect(page.getByRole('button', { name: '挂单', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '成交', exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 720 });
  await expect(page.getByRole('button', { name: '下单', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '盘口', exact: true })).toHaveCount(0);
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
