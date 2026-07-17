import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
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

test('overview spans the available desktop width without compressing cards into strips', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  const layout = await requireBox(page.locator('.home-grid'));
  const primary = await requireBox(page.locator('.overview-primary-grid'));
  const summary = await requireBox(page.locator('.overview-summary-row'));
  const today = await requireBox(page.locator('.overview-today-panel'));
  const market = await requireBox(page.locator('.market-summary'));
  const summaryCards = page.locator('.overview-summary-card');

  expect(await gridTrackCount(page.locator('.home-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.overview-primary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.overview-summary-row'))).toBe(3);
  expect(Math.abs(primary.x - layout.x)).toBeLessThan(2);
  expect(Math.abs(summary.x - layout.x)).toBeLessThan(2);
  expect(Math.abs(primary.width - layout.width)).toBeLessThan(2);
  expect(Math.abs(summary.width - layout.width)).toBeLessThan(2);
  expect(summary.y).toBeGreaterThanOrEqual(primary.y + primary.height);
  expect(Math.abs(today.y - market.y)).toBeLessThan(2);
  expect(market.width).toBeGreaterThan(today.width);
  expect(today.width).toBeGreaterThan(420);
  expect(market.width).toBeGreaterThan(560);

  await expect(summaryCards).toHaveCount(3);
  const summaryBoxes = await Promise.all([0, 1, 2].map((index) => requireBox(summaryCards.nth(index))));
  expect(Math.max(...summaryBoxes.map((box) => box.y)) - Math.min(...summaryBoxes.map((box) => box.y))).toBeLessThan(2);
  expect(Math.min(...summaryBoxes.map((box) => box.width))).toBeGreaterThan(280);

  const overflowingElements = await page.locator([
    '.home-grid',
    '.overview-primary-grid',
    '.overview-summary-row',
    '.overview-today-panel',
    '.market-summary',
    '.overview-summary-card',
  ].join(', ')).evaluateAll((elements) => elements
    .filter((element) => element.scrollWidth > element.clientWidth + 1)
    .map((element) => (element as HTMLElement).className));
  expect(overflowingElements).toEqual([]);

  const headingHeights = await page.locator('.overview-primary-grid h2, .overview-summary-row h2')
    .evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(Math.max(...headingHeights)).toBeLessThan(48);

  const emptyListOverflow = await page.locator('.overview-alert-list, .overview-open-orders-list')
    .evaluateAll((elements) => elements
      .filter((element) => element.scrollHeight > element.clientHeight + 1)
      .map((element) => (element as HTMLElement).className));
  expect(emptyListOverflow).toEqual([]);
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
  expect(await gridTrackCount(page.locator('.overview-primary-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.overview-summary-row'))).toBe(2);

  const nestedOverflowModes = await page.locator('.overview-alert-list, .overview-open-orders-list, .overview-asset-events')
    .evaluateAll((elements) => elements.map((element) => getComputedStyle(element).overflowY));
  expect(nestedOverflowModes).toEqual(['visible', 'visible', 'visible']);
  expect(pageErrors).toEqual([]);
});

test('desktop sidebar collapse recomputes overview columns from the real content width', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  expect(await gridTrackCount(page.locator('.overview-primary-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.overview-summary-row'))).toBe(2);

  const toggle = page.getByRole('button', { name: '折叠侧栏' });
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '展开侧栏' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.game-shell')).toHaveClass(/sidebar-collapsed/);
  await expect(page.getByRole('button', { name: '市场', exact: true })).toBeVisible();
  await expect.poll(() => gridTrackCount(page.locator('.overview-primary-grid'))).toBe(2);
  await expect.poll(() => gridTrackCount(page.locator('.overview-summary-row'))).toBe(3);
  expect(pageErrors).toEqual([]);
});
