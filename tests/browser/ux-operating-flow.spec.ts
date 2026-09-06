import { expect, test } from '@playwright/test';

test('new factory advances through automatic running and first output without stop/start', async ({ page }) => {
  await page.route('**/tutorial', (route) => route.fulfill({ json: { tutorial: { completedVersion: 0 }, currentVersion: 3 } }));
  await page.goto('runtime-test.html?view=tutorial-progress&scenario=activity');
  const progress = page.locator('[data-tutorial-progress-fixture]');
  await expect(progress).toHaveAttribute('data-step', 'build-facility');
  await page.evaluate(() => (window as any).__tutorialFixture.build(false));
  await expect(progress).toHaveAttribute('data-step', 'build-facility');
  await page.evaluate(() => (window as any).__tutorialFixture.build(true));
  await expect(progress).toHaveAttribute('data-step', 'complete-production');
  await page.evaluate(() => (window as any).__tutorialFixture.selectProvince('120000'));
  await expect(progress).toHaveAttribute('data-target', /"provinceId":"110000"/);
  await page.evaluate(() => (window as any).__tutorialFixture.production('120000', 101));
  await expect(progress).toHaveAttribute('data-step', 'complete-production');
  await page.evaluate(() => (window as any).__tutorialFixture.production('110000', 1));
  await expect(progress).toHaveAttribute('data-step', 'set-auto-sell');
  await page.reload();
  await expect(progress).toHaveAttribute('data-step', 'set-auto-sell');
  await expect(progress).toHaveAttribute('data-target', /"provinceId":"110000"/);
});

test('blocked first factory stays at running confirmation until its own server state recovers', async ({ page }) => {
  await page.route('**/tutorial', (route) => route.fulfill({ json: { tutorial: { completedVersion: 0 }, currentVersion: 3 } }));
  await page.goto('runtime-test.html?view=tutorial-progress&scenario=activity');
  const progress = page.locator('[data-tutorial-progress-fixture]');
  await expect(progress).toHaveAttribute('data-step', 'build-facility');
  await page.evaluate(() => (window as any).__tutorialFixture.build(true, 'error'));
  await expect(progress).toHaveAttribute('data-step', 'start-facility');
  await page.evaluate(() => (window as any).__tutorialFixture.production('120000', 101));
  await expect(progress).toHaveAttribute('data-step', 'start-facility');
  await page.evaluate(() => (window as any).__tutorialFixture.production('110000', 1));
  await expect(progress).toHaveAttribute('data-step', 'set-auto-sell');
});

for (const width of [390, 1440]) {
  test(`overview status drilldown and purchase round trip preserve context at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('?preview=game');
    const navigation = page.locator(width <= 720 ? '.mobile-bottom-navigation' : '.desktop-sidebar');
    await navigation.getByRole('button', { name: /^概览/ }).click();
    await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible();
    await expect(page.getByText('理论日产量', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '查看生产受阻的工厂' }).click();
    await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '清除状态筛选' })).toBeVisible();
    await expect(page.locator('[data-building-kind="commercial"]')).toHaveCount(0);
    await page.getByRole('button', { name: '返回上一页面' }).click();
    await page.getByRole('button', { name: '查看正在运行的工厂' }).click();
    const rows = page.locator('.global-facility-catalog-row__open');
    await expect(rows.first()).toBeVisible();
    await rows.first().click();
    await expect(page.locator('.global-facility-region-row')).not.toHaveCount(0);
    await expect(page.locator('.global-facility-region-list')).not.toContainText('生产异常');
    await page.locator('.global-facility-region-row__open').first().click();
    const region = await page.locator('.regional-entity-title__region').textContent();
    const factory = await page.locator('.regional-entity-title__name').textContent();
    await page.locator('.facility-formula-item-group').first().click();
    await expect(page.locator('.market-detail-surface')).toBeVisible();
    await expect(page.locator('.regional-entity-title__region')).toHaveText(region!);
    await expect(page.locator('.market-detail-trade-summary')).toContainText('今日官方价');
    await page.getByRole('button', { name: '返回上一页面' }).click();
    await expect(page.locator('.regional-entity-title__name')).toHaveText(factory!);
    await page.getByRole('button', { name: '返回上一页面' }).click();
    await expect(page.getByRole('button', { name: '清除状态筛选' })).toBeVisible();
    await page.getByRole('button', { name: '返回上一页面' }).click();
    await expect(page.getByRole('button', { name: '清除状态筛选' })).toBeVisible();
    await page.getByRole('button', { name: '清除状态筛选' }).click();
    await expect(page.getByRole('button', { name: '清除状态筛选' })).toHaveCount(0);
    await expect(page.locator('.global-market-filter-disclosure')).not.toContainText('默认折叠');
    await expect(page.locator('input[type="search"]')).toHaveCount(0);
  });
}
