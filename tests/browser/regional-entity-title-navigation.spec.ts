import { expect, test } from '@playwright/test';

for (const kind of ['product', 'commercial', 'facility'] as const) {
  test(`${kind} regional title pushes the matching province overview`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`regional-entity-title-runtime-test.html?kind=${kind}`);

    const title = page.locator('.regional-entity-title');
    const regionButton = page.getByRole('button', { name: '前往加利福尼亚地区页面' });
    await expect(regionButton).toBeVisible();
    await expect(regionButton).toHaveAttribute('data-regional-entity-region-link', 'true');
    const expectedEntityName = kind === 'facility' ? '农场' : kind === 'commercial' ? '便利店' : '小麦';
    await expect(page.locator('.regional-entity-title__name')).toHaveText(expectedEntityName);
    await expect(regionButton).toHaveText('加利福尼亚');

    const geometry = await title.evaluate((element) => {
      const region = element.querySelector<HTMLElement>('.regional-entity-title__region-button');
      if (!region) throw new Error('regional title button is missing');
      return {
        titleHeight: element.getBoundingClientRect().height,
        regionHeight: region.getBoundingClientRect().height,
      };
    });
    expect(geometry.titleHeight).toBe(40);
    expect(geometry.regionHeight).toBeLessThan(44);

    await regionButton.focus();
    await expect(regionButton).toBeFocused();
    await regionButton.press('Enter');

    await expect(page.getByTestId('last-action')).toHaveText('push');
    await expect(page.getByTestId('current-location')).toHaveText(
      '{"type":"province","provinceId":"US-CA","section":"overview"}',
    );
    await expect(page.getByRole('button', { name: '前往加利福尼亚地区页面' })).toHaveCount(0);
    await expect(page.locator('.regional-entity-title__region')).toHaveText('加利福尼亚');
  });
}

test('global commodity detail region title opens province overview and back restores detail', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();
  await page.getByRole('button', { name: '打开小麦全局详情' }).click();
  await page.getByRole('button', { name: '打开加利福尼亚小麦详情' }).click();

  const regionButton = page.getByRole('button', { name: '前往加利福尼亚地区页面' });
  await expect(regionButton).toBeVisible();
  await regionButton.click();

  await expect(page.getByRole('heading', { level: 1, name: '加利福尼亚', exact: true })).toBeVisible();
  await expect(page.locator('.province-overview-content')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();

  await expect(page.locator('.regional-entity-title__name')).toHaveText('小麦');
  await expect(page.getByRole('button', { name: '前往加利福尼亚地区页面' })).toBeVisible();
  await expect(page.locator('.market-trade-card')).toBeVisible();
});
