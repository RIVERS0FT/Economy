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

test('auction facility artwork fills the main and summary slots within a 256px tile', async ({ page }) => {
  await page.setViewportSize({ width: 476, height: 900 });
  await page.goto('runtime-test.html?view=auction&scenario=bid-history');

  await page.locator('.asset-auction-card .product-icon').evaluateAll((icons) => {
    for (const icon of icons) {
      icon.classList.remove('product-icon');
      icon.classList.add('facility-icon');
      icon.removeAttribute('data-product-icon');
      icon.setAttribute('data-facility-icon', 'machine-factory');
    }
  });

  const mainTile = page.locator('.asset-auction-bundle-tile').first();
  await mainTile.scrollIntoViewIfNeeded();
  const mainGeometry = await mainTile.evaluate((slot) => {
    const artwork = slot.querySelector(':scope > .facility-icon');
    if (!(artwork instanceof SVGElement)) throw new Error('missing main facility artwork');
    const slotRect = slot.getBoundingClientRect();
    const artworkRect = artwork.getBoundingClientRect();
    const style = getComputedStyle(artwork);
    return {
      slotWidth: slotRect.width,
      slotHeight: slotRect.height,
      contentWidth: (slot as HTMLElement).clientWidth,
      contentHeight: (slot as HTMLElement).clientHeight,
      artworkWidth: artworkRect.width,
      artworkHeight: artworkRect.height,
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
    };
  });

  expect(mainGeometry.slotWidth).toBeLessThanOrEqual(256.5);
  expect(mainGeometry.slotHeight).toBeLessThanOrEqual(256.5);
  expect(Math.abs(mainGeometry.contentWidth - mainGeometry.artworkWidth)).toBeLessThan(0.5);
  expect(Math.abs(mainGeometry.contentHeight - mainGeometry.artworkHeight)).toBeLessThan(0.5);
  expect(mainGeometry.backgroundImage).not.toBe('none');
  expect(mainGeometry.backgroundSize).toBe('cover');

  const summarySlot = page.locator('.asset-auction-summary-icon').first();
  const summaryGeometry = await summarySlot.evaluate((slot) => {
    const artwork = slot.querySelector(':scope > .facility-icon');
    if (!(artwork instanceof SVGElement)) throw new Error('missing summary facility artwork');
    const artworkRect = artwork.getBoundingClientRect();
    const style = getComputedStyle(artwork);
    return {
      contentWidth: (slot as HTMLElement).clientWidth,
      contentHeight: (slot as HTMLElement).clientHeight,
      artworkWidth: artworkRect.width,
      artworkHeight: artworkRect.height,
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
    };
  });

  expect(Math.abs(summaryGeometry.contentWidth - summaryGeometry.artworkWidth)).toBeLessThan(0.5);
  expect(Math.abs(summaryGeometry.contentHeight - summaryGeometry.artworkHeight)).toBeLessThan(0.5);
  expect(summaryGeometry.backgroundImage).not.toBe('none');
  expect(summaryGeometry.backgroundSize).toBe('cover');
});

test('auction asset matrix tiles show name and quantity while the main visual remains static', async ({ page }) => {
  await page.setViewportSize({ width: 476, height: 900 });
  await page.goto('runtime-test.html?view=auction&scenario=bid-history');

  const tooltip = page.locator('.safe-tooltip');
  const mainTile = page.locator('.asset-auction-bundle-tile').first();
  await mainTile.scrollIntoViewIfNeeded();
  await mainTile.hover();
  await expect(tooltip).toHaveCount(0);
  expect(await mainTile.getAttribute('tabindex')).toBeNull();
  expect(await mainTile.evaluate((node) => node.closest('.safe-tooltip-anchor') === null)).toBe(true);

  const summaryTile = page.locator('.asset-auction-summary-icon').first();
  await summaryTile.hover();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText('机械 ×5');

  await page.mouse.move(0, 0);
  await expect(tooltip).toHaveCount(0);

  await summaryTile.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toHaveText('机械 ×5');
  expect(await summaryTile.getAttribute('title')).toBeNull();

  await page.keyboard.press('Tab');
  await expect(tooltip).toHaveCount(0);
  await expect(page.locator('.asset-auction-item-tooltip-anchor')).toHaveCount(1);
  await expect(page.locator('.asset-auction-summary-placeholder')).toHaveCount(19);
});