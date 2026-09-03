import { expect, test } from '@playwright/test';

test('scrolling page keeps complex business objects distinct without frosted glass', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('runtime-test.html?view=contracts');
  const contractCard = page.locator('.contract-master-detail-panel .contract-card').first();
  const contractSummary = page.locator('.contract-summary-grid .ui-metric-card').first();
  await expect(contractCard).toBeVisible();
  await expect(contractSummary).toBeVisible();

  const contractStyle = await contractCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      radius: style.borderRadius,
      border: style.borderTopWidth,
      backdrop: style.backdropFilter,
    };
  });
  const summaryStyle = await contractSummary.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      radius: style.borderRadius,
      background: style.backgroundColor,
    };
  });

  expect(contractStyle.radius).not.toBe('0px');
  expect(contractStyle.border).not.toBe('0px');
  expect(contractStyle.backdrop).toBe('none');
  expect(summaryStyle.radius).toBe('0px');
  expect(summaryStyle.background).toBe('rgba(0, 0, 0, 0)');

  await page.goto('runtime-test.html?view=auction&scenario=bid-history');
  const auctionCard = page.locator('.asset-auction-card').first();
  const auctionCreate = page.locator('.asset-auction-create').first();
  await expect(auctionCard).toBeVisible();
  await expect(auctionCreate).toBeVisible();

  const auctionStyle = await auctionCard.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      radius: style.borderRadius,
      border: style.borderTopWidth,
      backdrop: style.backdropFilter,
    };
  });
  const createStyle = await auctionCreate.evaluate((element) => ({
    radius: getComputedStyle(element).borderRadius,
  }));

  expect(auctionStyle.radius).not.toBe('0px');
  expect(auctionStyle.border).not.toBe('0px');
  expect(auctionStyle.backdrop).toBe('none');
  expect(createStyle.radius).toBe('0px');
});
