import { expect, test } from '@playwright/test';

test('auction bid history is collapsed, lazy, anonymous, and capped at ten rows', async ({ page }) => {
  await page.goto('runtime-test.html?view=auction&scenario=bid-history');

  const panel = page.locator('.asset-auction-bid-history');
  await expect(panel).toHaveCount(1);
  await expect(panel.locator('ol')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __auctionBidHistoryFetches: string[] }).__auctionBidHistoryFetches.length)).toBe(0);

  await panel.getByRole('button', { name: /查看最近 10 条/ }).click();
  await expect(panel.locator('li')).toHaveCount(10);
  await expect(panel).toContainText('仅显示最近 10 条，共 12 次出价');
  await expect(panel).toContainText('竞买人 A01');
  await expect(panel).not.toContainText('买家甲');
  expect(await page.evaluate(() => (window as unknown as { __auctionBidHistoryFetches: string[] }).__auctionBidHistoryFetches.length)).toBe(1);

  await panel.getByRole('button', { name: /收起/ }).click();
  await expect(panel.locator('ol')).toHaveCount(0);
  await panel.getByRole('button', { name: /查看最近 10 条/ }).click();
  await expect(panel.locator('li')).toHaveCount(10);
  expect(await page.evaluate(() => (window as unknown as { __auctionBidHistoryFetches: string[] }).__auctionBidHistoryFetches.length)).toBe(1);
});
