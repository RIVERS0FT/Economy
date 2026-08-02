import { expect, test } from '@playwright/test';

test.describe('production facility selector cards', () => {
  test('uses portrait cover artwork and numeric profit tones', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');

    const cards = page.locator('.facility-cluster-selector-card');
    await expect(cards).toHaveCount(2);

    const positiveProfit = cards.nth(0).locator('.facility-cluster-profit');
    const negativeProfit = cards.nth(1).locator('.facility-cluster-profit');
    await expect(positiveProfit).toHaveText('5.38');
    await expect(positiveProfit).toHaveClass(/is-positive/);
    await expect(negativeProfit).toHaveText('9.00');
    await expect(negativeProfit).toHaveClass(/is-negative/);
    await expect(cards.nth(1)).toHaveAttribute('aria-label', /亏损 9\.00/);
    await expect(cards.locator('.facility-cluster-profit .currency-amount')).toHaveCount(0);
    await expect(positiveProfit).not.toContainText('/分');
    await expect(negativeProfit).not.toContainText('/分');

    const colors = await page.evaluate(() => {
      const positive = document.querySelector<HTMLElement>('.facility-cluster-profit.is-positive');
      const negative = document.querySelector<HTMLElement>('.facility-cluster-profit.is-negative');
      return {
        positive: positive ? getComputedStyle(positive).color : '',
        negative: negative ? getComputedStyle(negative).color : '',
      };
    });
    expect(colors.positive).toBe('rgb(123, 228, 158)');
    expect(colors.negative).toBe('rgb(255, 143, 131)');

    const cardBox = await cards.first().boundingBox();
    const icon = cards.first().locator('.facility-cluster-icon');
    const iconBox = await icon.boundingBox();
    expect(cardBox).not.toBeNull();
    expect(iconBox).not.toBeNull();
    expect((cardBox?.height ?? 0) / (cardBox?.width ?? 1)).toBeCloseTo(1.25, 1);
    expect(Math.abs((iconBox?.x ?? 0) - (cardBox?.x ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((iconBox?.y ?? 0) - (cardBox?.y ?? 0))).toBeLessThanOrEqual(1);
    expect(Math.abs((iconBox?.width ?? 0) - (cardBox?.width ?? 0))).toBeLessThanOrEqual(2);
    expect(Math.abs((iconBox?.height ?? 0) - (cardBox?.height ?? 0))).toBeLessThanOrEqual(2);

    const artworkStyle = await icon.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundImage: style.backgroundImage,
        backgroundPosition: style.backgroundPosition,
        backgroundRepeat: style.backgroundRepeat,
        backgroundSize: style.backgroundSize,
      };
    });
    const overlayBackground = await cards.first().evaluate((element) => (
      getComputedStyle(element, '::before').backgroundImage
    ));
    expect((overlayBackground.match(/linear-gradient/g) ?? []).length).toBe(2);
    expect(overlayBackground).toContain('rgba(0, 0, 0');

    expect(artworkStyle.backgroundImage).toContain('.png');
    expect(artworkStyle.backgroundPosition).toBe('50% 50%');
    expect(artworkStyle.backgroundRepeat).toBe('no-repeat');
    expect(artworkStyle.backgroundSize).toBe('cover');
  });

  test('keeps three portrait columns without horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');

    const grid = page.locator('.facility-cluster-selector-list');
    const columns = await grid.evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    ));
    expect(columns).toBe(3);

    const cardBox = await page.locator('.facility-cluster-selector-card').first().boundingBox();
    expect(cardBox).not.toBeNull();
    expect((cardBox?.height ?? 0) / (cardBox?.width ?? 1)).toBeCloseTo(1.25, 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
