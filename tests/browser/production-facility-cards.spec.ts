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

  test('preserves the full catalog for legacy snapshots without research state', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=facility-order');

    const expectedNames = [
      '农场', '果园', '畜牧场', '渔场', '矿场',
      '冶炼厂', '炼油厂', '机械厂', '电子厂', '家电厂',
    ];
    const facilityTypeSelect = page.getByRole('combobox', { name: '工厂类型' });
    const triggerText = (await facilityTypeSelect.textContent())?.trim() ?? '';
    expect(expectedNames.some((name) => triggerText.includes(name))).toBe(true);
    await facilityTypeSelect.click();
    const options = page.getByRole('listbox', { name: '工厂类型' }).getByRole('option');
    await expect(options.locator('.ui-rich-select__option-label')).toHaveText(expectedNames);
    await page.keyboard.press('Escape');
    await expect(page.locator('.facility-cluster-name')).toHaveText(expectedNames);
    await expect(page.locator('#desktop-facility-detail-title')).toContainText('农场');
    await expect(page.getByText('按复杂度从 C1 到 C7 选择工厂并查看生产详情。')).toBeVisible();
  });

  test('facility build selector shows production outputs in trigger and options', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=facility-order');

    const trigger = page.getByRole('combobox', { name: '工厂类型' });
    await expect(trigger.locator('.facility-build-output-list')).toContainText('机械');
    await expect(trigger.locator('[data-product-artwork="machinery"]')).toBeVisible();
    await expect(page.locator('.facility-type-summary')).toHaveCount(0);
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox?.height ?? 0).toBeGreaterThanOrEqual(63);

    await trigger.click();
    const options = page.getByRole('listbox', { name: '工厂类型' }).getByRole('option');
    await expect(options.locator('.facility-build-output-list')).toHaveCount(10);
    await expect(options.first().locator('.facility-build-output-list')).toContainText('机械');
    await expect(options.first().locator('[data-product-artwork="machinery"]')).toBeVisible();
    const optionBox = await options.first().boundingBox();
    expect(optionBox?.height ?? 0).toBeGreaterThanOrEqual(63);
  });

  test('uses the wider strategic workspace while capping selector cards at six columns', async ({ page }) => {
    const columnCounts: number[] = [];

    for (const width of [1600, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('runtime-test.html?view=production&scenario=facility-order');

      const grid = page.locator('.facility-cluster-selector-list');
      await expect(grid).toBeVisible();
      columnCounts.push(await grid.evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      )));

      const geometry = await page.evaluate(() => {
        const build = document.querySelector<HTMLElement>('.production-build-card')?.getBoundingClientRect();
        const navigation = document.querySelector<HTMLElement>('.facility-cluster-navigation')?.getBoundingClientRect();
        const detail = document.querySelector<HTMLElement>('.facility-cluster-detail-card')?.getBoundingClientRect();
        const cardWidths = [...document.querySelectorAll<HTMLElement>('.facility-cluster-selector-card')]
          .map((card) => card.getBoundingClientRect().width);
        return {
          buildWidth: build?.width ?? 0,
          navigationWidth: navigation?.width ?? 0,
          detailWidth: detail?.width ?? 0,
          minCardWidth: Math.min(...cardWidths),
          maxCardWidth: Math.max(...cardWidths),
          fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        };
      });

      expect(geometry.buildWidth).toBeGreaterThanOrEqual(279.5);
      expect(geometry.buildWidth).toBeLessThanOrEqual(320.5);
      expect(geometry.navigationWidth).toBeGreaterThanOrEqual(479.5);
      expect(geometry.navigationWidth).toBeLessThanOrEqual(1040.5);
      expect(geometry.detailWidth).toBeGreaterThanOrEqual(479.5);
      expect(geometry.detailWidth).toBeLessThanOrEqual(680.5);
      expect(geometry.minCardWidth).toBeGreaterThanOrEqual(131.5);
      expect(geometry.maxCardWidth).toBeLessThanOrEqual(160.5);
      expect(geometry.fitsViewport).toBe(true);
    }

    expect(columnCounts).toEqual([3, 5, 6]);
  });

});
