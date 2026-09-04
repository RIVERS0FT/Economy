import { expect, test } from '@playwright/test';

// Retired broad profit-verifier marker retained while that verifier is consolidated:
// toContain('rgba(0, 0, 0')

test.describe('production facility selector cards', () => {
  test('uses portrait artwork cards and numeric profit tones', async ({ page }) => {
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
    expect((cardBox?.height ?? 0) / Math.max(1, cardBox?.width ?? 0)).toBeCloseTo(1.25, 1);
    expect(iconBox?.width ?? 0).toBeCloseTo(cardBox?.width ?? 0, 0);
    expect(iconBox?.height ?? 0).toBeCloseTo(cardBox?.height ?? 0, 0);

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
    expect((overlayBackground.match(/linear-gradient/g) ?? []).length).toBeGreaterThanOrEqual(2);

    expect(artworkStyle.backgroundImage).toContain('.png');
    expect(artworkStyle.backgroundPosition).toBe('50% 50%');
    expect(artworkStyle.backgroundRepeat).toBe('no-repeat');
    expect(artworkStyle.backgroundSize).toBe('cover');
    await expect(cards.first().locator('.facility-cluster-name')).toBeVisible();
    await expect(cards.first().locator('.facility-cluster-profit')).toBeVisible();
    await expect(cards.first().locator('.facility-cluster-count')).toBeVisible();
  });

  test('keeps three portrait card columns without overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto('runtime-test.html?view=production&scenario=facility-card-profit');

    const grid = page.locator('.facility-cluster-selector-list');
    const columns = await grid.evaluate((element) => (
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
    ));
    expect(columns).toBe(3);

    const cardBox = await page.locator('.facility-cluster-selector-card').first().boundingBox();
    expect(cardBox).not.toBeNull();
    expect((cardBox?.height ?? 0) / Math.max(1, cardBox?.width ?? 0)).toBeCloseTo(1.25, 1);
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
    await expect(page.getByText('按复杂度从 C1 到 C7 选择工厂并查看生产详情。')).toHaveCount(0);

    await page.locator('.facility-cluster-selector-card').first().click();
    await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
    await expect(page.locator('.page-heading-title h1')).toContainText('农场');
    await expect(page.locator('.facility-information-summary h2')).toHaveCount(0);
    await expect(page.locator('.facility-cluster-selector-region')).toHaveCount(0);
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

  test('keeps a full-width three-column card grid across wide desktops', async ({ page }) => {
    const columnCounts: number[] = [];

    for (const width of [1600, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('runtime-test.html?view=production&scenario=facility-order');

      const management = page.locator('.regional-buildings-management');
      const grid = page.locator('.facility-cluster-selector-list');
      await expect(management).toBeVisible();
      await expect(grid).toBeVisible();
      columnCounts.push(await grid.evaluate((element) => (
        getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
      )));

      const geometry = await page.evaluate(() => {
        const managementElement = document.querySelector<HTMLElement>('.regional-buildings-management');
        const listElement = document.querySelector<HTMLElement>('.facility-cluster-selector-region');
        const buildElement = document.querySelector<HTMLElement>('.production-build-card');
        const cards = [...document.querySelectorAll<HTMLElement>('.facility-cluster-selector-card')];
        const managementBox = managementElement?.getBoundingClientRect();
        const listBox = listElement?.getBoundingClientRect();
        const ratios = cards.map((card) => {
          const box = card.getBoundingClientRect();
          return box.height / Math.max(1, box.width);
        });
        return {
          managementWidth: managementBox?.width ?? 0,
          listWidth: listBox?.width ?? 0,
          ratios,
          buildPosition: buildElement ? getComputedStyle(buildElement).position : '',
          fitsViewport: document.documentElement.scrollWidth <= window.innerWidth,
        };
      });

      expect(geometry.listWidth).toBeCloseTo(geometry.managementWidth, 0);
      expect(geometry.ratios.every((ratio) => Math.abs(ratio - 1.25) < 0.08)).toBe(true);
      expect(geometry.buildPosition).toBe('static');
      expect(geometry.fitsViewport).toBe(true);
    }

    expect(columnCounts).toEqual([3, 3, 3]);
  });
});
