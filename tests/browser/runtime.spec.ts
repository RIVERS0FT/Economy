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

async function centerOf(locator: Locator) {
  const box = await requireBox(locator);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
}

async function expectNoPairOverlap(locator: Locator, tolerance = 1) {
  const boxes = await locator.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex];
      const right = boxes[rightIndex];
      const overlaps = left.left < right.right - tolerance
        && left.right > right.left + tolerance
        && left.top < right.bottom - tolerance
        && left.bottom > right.top + tolerance;
      expect(overlaps, `元素 ${leftIndex} 与 ${rightIndex} 不应重叠`).toBe(false);
    }
  }
}

async function expectElementsInside(locator: Locator, container: Locator, tolerance = 2) {
  const containerBox = await requireBox(container);
  const boxes = await locator.evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
  }));
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(containerBox.x - tolerance);
    expect(box.right).toBeLessThanOrEqual(containerBox.x + containerBox.width + tolerance);
    expect(box.top).toBeGreaterThanOrEqual(containerBox.y - tolerance);
    expect(box.bottom).toBeLessThanOrEqual(containerBox.y + containerBox.height + tolerance);
  }
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

test('desktop sidebar uses the server-configured QQ group link', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/economy-api/game/community-link', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        communityLink: {
          qqGroupUrl: 'https://qm.qq.com/q/browser-test',
          updatedAt: Date.UTC(2026, 6, 18, 12, 0, 0),
        },
      }),
    });
  });

  await page.goto('runtime-test.html?view=overview&scenario=empty');
  const communityLink = page.getByRole('link', { name: '加入 QQ 群（在新窗口打开）' });
  const expandedLogo = page.locator('.sidebar-logo-expand-button img');
  const overviewIcon = page.getByRole('button', { name: '概览', exact: true }).locator('svg');
  const logoutButton = page.getByRole('button', { name: '退出登录' });
  await expect(communityLink).toBeVisible();
  await expect(communityLink).toHaveAttribute('href', 'https://qm.qq.com/q/browser-test');
  await expect(communityLink).toHaveAttribute('target', '_blank');
  await expect(communityLink.locator('svg.sidebar-community-icon')).toHaveCount(1);
  await expect(page.locator('.sidebar-logout svg.sidebar-logout-icon')).toHaveCount(1);
  const expandedLogoBox = await requireBox(expandedLogo);
  expect(expandedLogoBox.width).toBe(40);
  expect(expandedLogoBox.height).toBe(40);
  const expandedAnchors = {
    logo: await centerOf(expandedLogo),
    overview: await centerOf(overviewIcon),
    community: await centerOf(communityLink.locator('svg')),
    logout: await centerOf(logoutButton.locator('svg')),
  };

  await page.getByRole('button', { name: '折叠侧栏' }).click();
  await expect(page.locator('.desktop-sidebar')).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByRole('button', { name: '折叠侧栏' })).toHaveCount(0);
  await page.waitForTimeout(100);
  const midpointAnchors = {
    logo: await centerOf(expandedLogo),
    overview: await centerOf(overviewIcon),
    community: await centerOf(communityLink.locator('svg')),
    logout: await centerOf(logoutButton.locator('svg')),
  };
  for (const key of Object.keys(expandedAnchors) as Array<keyof typeof expandedAnchors>) {
    expect(Math.abs(expandedAnchors[key].x - midpointAnchors[key].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(expandedAnchors[key].y - midpointAnchors[key].y)).toBeLessThanOrEqual(1);
  }
  await page.waitForTimeout(120);

  const expandButton = page.getByRole('button', { name: '展开侧栏' });
  const collapsedLogo = expandButton.locator('img');
  const expandIcon = expandButton.locator('.sidebar-logo-expand-icon');
  const collapsedLogoBox = await requireBox(collapsedLogo);
  expect(collapsedLogoBox.width).toBe(40);
  expect(collapsedLogoBox.height).toBe(40);
  await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
  await expect(collapsedLogo).toHaveCSS('opacity', '1');
  await expect(expandIcon).toHaveCSS('opacity', '0');

  const collapsedAnchors = {
    logo: await centerOf(collapsedLogo),
    overview: await centerOf(overviewIcon),
    community: await centerOf(communityLink.locator('svg')),
    logout: await centerOf(logoutButton.locator('svg')),
  };
  for (const key of Object.keys(expandedAnchors) as Array<keyof typeof expandedAnchors>) {
    expect(Math.abs(expandedAnchors[key].x - collapsedAnchors[key].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(expandedAnchors[key].y - collapsedAnchors[key].y)).toBeLessThanOrEqual(1);
  }

  const expandButtonBeforeHover = await requireBox(expandButton);
  await expandButton.hover();
  await expect(collapsedLogo).toHaveCSS('opacity', '0');
  await expect(expandIcon).toHaveCSS('opacity', '1');
  const expandButtonAfterHover = await requireBox(expandButton);
  expect(expandButtonAfterHover).toEqual(expandButtonBeforeHover);

  await page.mouse.move(400, 400);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(expandButton).toBeFocused();
  await expect(collapsedLogo).toHaveCSS('opacity', '0');
  await expect(expandIcon).toHaveCSS('opacity', '1');

  const communityBox = await requireBox(communityLink);
  const logoutBox = await requireBox(logoutButton);
  expect(communityBox.width).toBe(48);
  expect(communityBox.height).toBe(48);
  expect(logoutBox.width).toBe(48);
  expect(logoutBox.height).toBe(48);
  await expect(communityLink.locator('strong')).toBeHidden();
  await expect(logoutButton.locator('strong')).toBeHidden();

  await expandButton.click();
  await expect(page.locator('.desktop-sidebar')).toHaveAttribute('data-collapsed', 'false');
  await expect(page.getByRole('button', { name: '折叠侧栏' })).toBeVisible();
  await expect(page.getByText('市场在线', { exact: true })).toHaveCount(0);
  await expect(page.getByText('服务器权威经济', { exact: true })).toHaveCount(0);
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
  await expect(page.getByLabel('本周资产下降 116,543')).toBeVisible();
  await expect(page.getByText(/↓ 本周 -/)).toHaveCount(0);

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

  const emptyListOverflow = await page.locator('.overview-alert-list, .overview-open-orders-list, .overview-asset-events')
    .evaluateAll((elements) => elements
      .filter((element) => element.scrollHeight > element.clientHeight + 1)
      .map((element) => (element as HTMLElement).className));
  expect(emptyListOverflow).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('compact overview chart fills the market card without label collisions', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const chart = page.getByRole('img', { name: '近 24 小时价格、成交量与主动买卖方向趋势图' });
  const market = page.locator('.market-summary');
  await expect(chart).toBeVisible();
  await expect(page.getByTestId('overview-market-empty')).toHaveCount(0);
  await expect(page.getByText(/24h 净主动买入/)).toBeVisible();

  const chartBox = await requireBox(chart);
  const marketBox = await requireBox(market);
  expect(chartBox.width).toBeGreaterThan(marketBox.width * 0.85);
  expect(chartBox.height).toBeGreaterThan(150);
  expect(chartBox.height).toBeLessThan(230);
  expect(Math.abs((chartBox.x + chartBox.width / 2) - (marketBox.x + marketBox.width / 2))).toBeLessThan(4);

  const xLabels = chart.locator('.chart-x-tick-label');
  expect(await xLabels.count()).toBeGreaterThanOrEqual(4);
  expect(await xLabels.count()).toBeLessThanOrEqual(6);
  await expectNoPairOverlap(xLabels);
  await expectNoPairOverlap(chart.locator('.chart-price-tick-label'));
  await expectNoPairOverlap(chart.locator('.chart-volume-tick-label'));
  await expectNoPairOverlap(chart.locator('.chart-legend-item'));
  await expectElementsInside(chart.locator('.chart-x-tick-label, .chart-price-tick-label, .chart-volume-tick-label, .chart-axis-title, .chart-legend-item'), chart);
  await expect(chart.locator('.chart-axis-title')).toHaveCount(3);
  expect(await chart.locator('text[transform*="rotate(-45"]').count()).toBe(0);
  expect(pageErrors).toEqual([]);
});

test('overview market empty values stay neutral and explain one-sided order books', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const bestBidMetric = page.getByText('最高买价', { exact: true }).locator('..');
  const bestAskMetric = page.getByText('最低卖价', { exact: true }).locator('..');
  await expect(bestBidMetric).toHaveClass(/overview-metric--success/);
  await expect(bestAskMetric).toHaveClass(/overview-metric--neutral/);
  await expect(page.getByTestId('overview-market-order-state')).toHaveText('当前只有买单，暂无可供买入的卖单');

  await page.goto('runtime-test.html?view=overview&scenario=two-sided');
  await expect(page.getByText('最低卖价', { exact: true }).locator('..')).toHaveClass(/overview-metric--danger/);
  await expect(page.getByTestId('overview-market-order-state')).toHaveText('当前买卖价差：4');
  expect(pageErrors).toEqual([]);
});

test('overview cash changes exclude synchronization events and short lists do not scroll', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  await expect(page.getByText('购置机械工厂', { exact: true })).toBeVisible();
  await expect(page.getByText('服务器资产状态已同步', { exact: true })).toHaveCount(0);
  await expect(page.getByText('当前设备现金记录', { exact: true })).toBeVisible();
  expect(await page.locator('.overview-asset-events').evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

  await page.goto('runtime-test.html?view=overview&scenario=cash-empty');
  await expect(page.getByText('服务器资产状态已同步', { exact: true })).toHaveCount(0);
  await expect(page.getByText('本周暂无现金收入或支出记录。', { exact: true })).toBeVisible();
  expect(await page.locator('.overview-asset-events').evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

  await page.goto('runtime-test.html?view=overview&scenario=cash-three');
  await expect(page.locator('.overview-asset-events > div:not(.empty-state)')).toHaveCount(3);
  expect(await page.locator('.overview-asset-events').evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('overview only scrolls the order list after the visible capacity is exceeded', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const shortList = page.locator('.overview-open-orders-list');
  await expect(shortList).not.toHaveClass(/overview-open-orders-list--scrollable/);
  expect(await shortList.evaluate((element) => getComputedStyle(element).overflowY)).toBe('visible');
  expect(await shortList.evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);

  await page.goto('runtime-test.html?view=overview&scenario=many-orders');
  const longList = page.locator('.overview-open-orders-list');
  await expect(longList).toHaveClass(/overview-open-orders-list--scrollable/);
  expect(await longList.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  expect(await longList.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true);
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
