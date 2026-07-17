import { expect, test } from '@playwright/test';

async function capturePageErrors(page: import('@playwright/test').Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

test('storage denial does not block the settings runtime', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException('Storage disabled for runtime test', 'SecurityError');
        },
      });
    }
  });
  await page.route('**/economy-api/game/invitations', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: '测试环境未连接邀请服务' }),
    });
  });

  await page.goto('runtime-test.html');
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '紧凑数字' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '状态刷新频率' })).toHaveValue('5');
  await expect(page.getByText('界面音效', { exact: true })).toHaveCount(0);
  await expect(page.getByText('画面性能', { exact: true })).toHaveCount(0);

  const localActivity = await page.evaluate(() => (
    window as typeof window & { __localActivityResult: { assetEvents: unknown[]; trades: unknown[] } }
  ).__localActivityResult);
  expect(localActivity).toEqual({ assetEvents: [], trades: [] });
  expect(pageErrors).toEqual([]);
});

test('overview prioritizes business decisions and uses a compact market empty state', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  await expect(page.getByRole('heading', { name: '晚上好，MEVIUS', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日经营', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '机械市场', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '生产摘要', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资产构成', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '当前挂单', exact: true })).toBeVisible();
  await expect(page.getByTestId('overview-market-empty')).toBeVisible();
  await expect(page.getByText('暂无有效挂单或近期成交', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: '近 24 小时价格、成交量与主动买卖方向趋势图' })).toHaveCount(0);
  await expect(page.getByText('当前总资产', { exact: true })).toHaveCount(0);
  await expect(page.locator('.overview-assets-card').getByText('#1', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始工作' })).toBeVisible();

  const workButtonWidth = await page.getByRole('button', { name: '开始工作' }).evaluate((element) => element.getBoundingClientRect().width);
  const todayPanelWidth = await page.locator('.overview-today-panel').evaluate((element) => element.getBoundingClientRect().width);
  expect(workButtonWidth).toBeLessThan(todayPanelWidth * 0.55);
  expect(pageErrors).toEqual([]);
});

test('overview renders the real market chart only when activity exists', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const chart = page.getByRole('img', { name: '近 24 小时价格、成交量与主动买卖方向趋势图' });
  await expect(chart).toBeVisible();
  await expect(page.getByTestId('overview-market-empty')).toHaveCount(0);
  await expect(page.getByText(/24h 净主动买入/)).toBeVisible();
  const rotatedCompactLabels = await chart.locator('text[transform*="rotate(-45"]').count();
  expect(rotatedCompactLabels).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('overview keeps the decision rows visible and adapts to a narrower desktop', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=alerts');

  const productionHeading = page.getByRole('heading', { name: '生产摘要', exact: true });
  await expect(productionHeading).toBeVisible();
  const productionBox = await productionHeading.boundingBox();
  expect(productionBox).not.toBeNull();
  expect(productionBox!.y).toBeLessThan(900);
  await expect(page.getByText('共享仓库空间偏低', { exact: true })).toBeVisible();
  await expect(page.getByText('机械工厂生产受阻', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 900, height: 1000 });
  const primaryGridColumns = await page.locator('.overview-primary-grid').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  const summaryGridColumns = await page.locator('.overview-summary-row').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length);
  expect(primaryGridColumns).toBe(1);
  expect(summaryGridColumns).toBe(2);
  expect(pageErrors).toEqual([]);
});

test('desktop sidebar collapses without removing keyboard navigation', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  const toggle = page.getByRole('button', { name: '折叠侧栏' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '展开侧栏' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.game-shell')).toHaveClass(/sidebar-collapsed/);
  await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
