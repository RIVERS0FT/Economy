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

test('overview prioritizes business decisions and shows the weekly check-in calendar', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  await expect(page.getByRole('heading', { name: '晚上好，MEVIUS', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '今日经营', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '本周签到', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '生产摘要', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资产构成', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '当前挂单', exact: true })).toBeVisible();
  await expect(page.getByRole('list', { name: '本周签到日历' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(7);
  await expect(page.getByRole('button', { name: '签到领取 1 宝石' })).toBeVisible();
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
  const checkIn = await requireBox(page.locator('.overview-check-in-panel'));
  const summaryCards = page.locator('.overview-summary-card');

  expect(await gridTrackCount(page.locator('.home-grid'))).toBe(1);
  expect(await gridTrackCount(page.locator('.overview-primary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.overview-summary-row'))).toBe(3);
  expect(Math.abs(primary.x - layout.x)).toBeLessThan(2);
  expect(Math.abs(summary.x - layout.x)).toBeLessThan(2);
  expect(Math.abs(primary.width - layout.width)).toBeLessThan(2);
  expect(Math.abs(summary.width - layout.width)).toBeLessThan(2);
  expect(summary.y).toBeGreaterThanOrEqual(primary.y + primary.height);
  expect(Math.abs(today.y - checkIn.y)).toBeLessThan(2);
  expect(checkIn.width).toBeGreaterThan(today.width);
  expect(today.width).toBeGreaterThan(420);
  expect(checkIn.width).toBeGreaterThan(560);

  await expect(summaryCards).toHaveCount(3);
  const summaryBoxes = await Promise.all([0, 1, 2].map((index) => requireBox(summaryCards.nth(index))));
  expect(Math.max(...summaryBoxes.map((box) => box.y)) - Math.min(...summaryBoxes.map((box) => box.y))).toBeLessThan(2);
  expect(Math.min(...summaryBoxes.map((box) => box.width))).toBeGreaterThan(280);

  const overflowingElements = await page.locator([
    '.home-grid',
    '.overview-primary-grid',
    '.overview-summary-row',
    '.overview-today-panel',
    '.overview-check-in-panel',
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


test('overview check-in calendar distinguishes claimed, today, missed, and future days', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  const days = page.getByRole('list', { name: '本周签到日历' }).getByRole('listitem');
  await expect(days).toHaveCount(7);
  await expect(days.nth(0)).toHaveAttribute('aria-label', /周一 07-13 已签/);
  await expect(days.nth(2)).toHaveAttribute('aria-label', /周三 07-15 漏签/);
  await expect(days.nth(4)).toHaveAttribute('aria-label', /周五 07-17 今日/);
  await expect(days.nth(5)).toHaveAttribute('aria-label', /周六 07-18 未到/);
  await expect(page.getByText('连续签到 7 天可额外获得 5 宝石', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('overview shows completed and partial-week attendance states', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=check-in-complete');
  await expect(page.getByRole('button', { name: '今日已签到' })).toBeDisabled();
  await expect(page.getByText('本周全勤奖励已领取', { exact: true })).toBeVisible();

  await page.goto('runtime-test.html?view=overview&scenario=check-in-partial');
  await expect(page.getByText('注册所在周可领取每日奖励，下周起参与全勤', { exact: true })).toBeVisible();
  expect(pageErrors).toEqual([]);
});


test('overview check-in calendar preserves seven columns on mobile', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');

  const calendar = page.getByRole('list', { name: '本周签到日历' });
  await expect(calendar.getByRole('listitem')).toHaveCount(7);
  expect(await gridTrackCount(calendar)).toBe(7);
  expect(await page.locator('.overview-check-in-panel').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
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
