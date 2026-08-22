import { expect, test, type Locator, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
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
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
}

test('storage denial does not block the settings runtime', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.addInitScript(() => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() { throw new DOMException('Storage disabled for runtime test', 'SecurityError'); },
      });
    }
  });
  await page.route('**/economy-api/game/invitations', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ message: '测试环境未连接邀请服务' }),
  }));
  await page.goto('runtime-test.html');
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '紧凑数字' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: '状态刷新频率' })).toContainText('每 5s');
  await expect(page.getByText('界面音效', { exact: true })).toHaveCount(0);
  await expect(page.getByText('画面性能', { exact: true })).toHaveCount(0);
  const localActivity = await page.evaluate(() => (
    window as typeof window & { __localActivityResult: { trades: unknown[] } }
  ).__localActivityResult);
  expect(localActivity).toEqual({ trades: [] });
  expect(pageErrors).toEqual([]);
});

test('local activity v5 migrates only anonymous trades into v7', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('economy.local-activity.v5.123', JSON.stringify({
      version: 5,
      assetEvents: [{ id: 'legacy-asset-event', description: '不应保留' }],
      trades: [{ id: 'legacy-trade', type: 'commodity', productId: 'wheat', side: 'sell', quantity: 2, price: 5, total: 10, fee: 0, netTotal: 10, createdAt: 1, description: '卖出 小麦' }],
      snapshot: { credits: 999, inventories: { wheat: { available: 9, frozen: 0 } } },
    }));
  });
  await page.goto('runtime-test.html');
  const result = await page.evaluate(() => ({
    view: (window as typeof window & { __localActivityResult: { trades: unknown[] } }).__localActivityResult,
    current: JSON.parse(window.localStorage.getItem('economy.local-activity.v7.123') || '{}'),
    legacy: window.localStorage.getItem('economy.local-activity.v5.123'),
  }));
  expect(result.view.trades).toHaveLength(1);
  expect(result.current.trades).toHaveLength(1);
  expect(result.current.assetEvents).toBeUndefined();
  expect(result.current.snapshot).toBeUndefined();
  expect(result.legacy).toBeNull();
});

test('desktop sidebar uses the server-configured QQ group link and settings footer', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route('**/economy-api/game/community-link', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ communityLink: { qqGroupUrl: 'https://qm.qq.com/q/browser-test', updatedAt: Date.UTC(2026, 6, 18, 12) } }),
  }));
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  const sidebar = page.locator('.desktop-sidebar');
  const communityLink = page.getByRole('link', { name: '加入 QQ 群（在新窗口打开）' });
  const settingsButton = sidebar.locator('.sidebar-footer').getByRole('button', { name: '设置' });
  const anchors = async () => ({
    identity: await centerOf(page.locator('.asset-bar-identity > img')),
    overview: await centerOf(page.getByRole('button', { name: '概览', exact: true }).locator('svg')),
    community: await centerOf(communityLink.locator('svg')),
    settings: await centerOf(settingsButton.locator('svg')),
  });
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  await expect(page.getByRole('button', { name: '展开侧栏' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '折叠侧栏' })).toHaveCount(0);
  await expect(communityLink).toHaveAttribute('href', 'https://qm.qq.com/q/browser-test');
  await expect(communityLink).toHaveAttribute('target', '_blank');
  await expect(sidebar.getByRole('button', { name: '退出登录' })).toHaveCount(0);
  await expect(sidebar.locator('.sidebar-brand')).toHaveCount(0);
  expect((await requireBox(page.locator('.asset-bar-identity > img'))).width).toBe(40);
  const before = await anchors();
  await sidebar.hover();
  await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  await page.waitForTimeout(220);
  const after = await anchors();
  for (const key of Object.keys(after) as Array<keyof typeof after>) {
    expect(Math.abs(after[key].x - before[key].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after[key].y - before[key].y)).toBeLessThanOrEqual(1);
  }
  await page.mouse.move(700, 500);
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
  expect((await requireBox(communityLink)).width).toBe(48);
  expect((await requireBox(settingsButton)).width).toBe(48);
  await settingsButton.focus();
  await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).focus();
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
});

test('compact desktop keeps QQ group and settings footer actions visible', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 768 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  const footer = page.locator('.desktop-sidebar .sidebar-footer');
  const community = footer.getByRole('link', { name: '加入 QQ 群（在新窗口打开）' });
  const settings = footer.getByRole('button', { name: '设置' });
  await expect(community).toBeVisible();
  await expect(settings).toBeVisible();
  expect((await requireBox(community)).width).toBeCloseTo(48, 0);
  expect((await requireBox(settings)).width).toBeCloseTo(48, 0);
});

test('overview prioritizes business decisions and shows the weekly check-in calendar', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  await expect(page.getByRole('heading', { name: '概览', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入市场' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '今日经营', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始工作' })).toHaveCount(0);
  const outliner = page.locator('.strategic-outliner');
  await expect(outliner).toBeVisible();
  await expect(outliner.locator('[data-outliner-section="events"]')).toBeVisible();
  await expect(outliner.getByRole('button', { name: /公开经济事件/ })).toBeVisible();
  await expect(page.locator('.page-content .strategic-outliner')).toHaveCount(0);
  for (const name of ['本周签到', '生产摘要', '资产与银行', '当前挂单']) {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('list', { name: '本周签到日历' })).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(7);
  const checkInHeading = page.locator('.overview-check-in-panel .widget-heading');
  await expect(checkInHeading.getByRole('button', { name: '签到领取 1 宝石' })).toBeVisible();
  await expect(page.getByText(/\d+ \/ 7 天/)).toHaveCount(0);
  await expect(page.locator('.page-heading p')).toHaveCount(0);
  await expect(page.getByLabel('本周净资产下降 116,543')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('public economic events stay compact until explicitly expanded', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('economic-event-log-runtime-test.html');
  const event = page.locator('.economic-event-log-entry').first();
  const summary = event.locator('summary');
  await expect(summary.locator('span')).toContainText(/距离开始还有|正在进行|已经结束/);
  await expect(event.locator('.economic-event-log-details')).not.toBeVisible();
  await summary.click();
  await expect(event.locator('.economic-event-log-details')).toBeVisible();
});

test('page title stays fixed while only the page card body scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');
  const heading = page.locator('.page-fixed-header');
  const body = page.locator('.page-card-scroll');
  const before = await requireBox(heading);
  await body.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  expect(await requireBox(heading)).toEqual(before);
  expect(await body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('strategic outliner stays outside overview content and owns tutorial and public events', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=tutorial');
  const outliner = page.locator('.strategic-outliner');
  const tutorialSection = outliner.locator('[data-outliner-section="tutorial"]');
  const eventsSection = outliner.locator('[data-outliner-section="events"]');
  await expect(tutorialSection.locator('.game-guide-strip--outliner')).toContainText('建设一座工厂');
  await expect(eventsSection).toBeVisible();
  await expect(page.locator('.page-content .strategic-outliner')).toHaveCount(0);
  const tutorialBox = await requireBox(tutorialSection);
  const eventsBox = await requireBox(eventsSection);
  expect(tutorialBox.y + tutorialBox.height).toBeLessThanOrEqual(eventsBox.y);
});

test('overview uses a building-style panel beside the strategic outliner', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  const layout = await requireBox(page.locator('.strategic-page-host--building > .page-content'));
  const main = await requireBox(page.locator('.home-grid'));
  const outliner = await requireBox(page.locator('.strategic-outliner'));
  const summary = await requireBox(page.locator('.overview-summary-row'));
  const checkIn = await requireBox(page.locator('.overview-check-in-panel'));
  expect(await gridTrackCount(page.locator('.home-grid'))).toBe(1);
  expect(main.x).toBeCloseTo(layout.x + 8, 0);
  expect(Math.abs(summary.x - main.x)).toBeLessThan(2);
  expect(outliner.x).toBeGreaterThanOrEqual(layout.x + layout.width + 8);
  expect(outliner.width).toBeGreaterThanOrEqual(280);
  expect(outliner.width).toBeLessThanOrEqual(321);
  expect(summary.y).toBeGreaterThanOrEqual(checkIn.y + checkIn.height);
  const cards = page.locator('.overview-summary-card');
  await expect(cards).toHaveCount(3);
  const boxes = await Promise.all([0, 1, 2].map((index) => requireBox(cards.nth(index))));
  expect(Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width))).toBeLessThan(2);
  const overflow = await page.locator('.home-grid, .strategic-outliner, .overview-summary-row, .overview-check-in-panel, .overview-summary-card')
    .evaluateAll((elements) => elements.filter((element) => element.scrollWidth > element.clientWidth + 1).map((element) => (element as HTMLElement).className));
  expect(overflow).toEqual([]);
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
  await expect(page.getByText('连续签到 7 天可额外获得 5 宝石', { exact: true })).toHaveCount(0);
  await expect(page.getByText('签到日期由服务器按北京时间判定，不支持补签。', { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('overview shows completed and partial-week attendance states', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=check-in-complete');
  await expect(page.getByRole('button', { name: '今日已签到' })).toBeDisabled();
  await expect(page.getByText('本周全勤奖励已领取', { exact: true })).toBeVisible();
  await page.goto('runtime-test.html?view=overview&scenario=check-in-partial');
  await expect(page.getByText('注册所在周可领取每日奖励，下周起参与全勤', { exact: true })).toBeVisible();
});

test('overview check-in calendar preserves seven columns on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  const calendar = page.getByRole('list', { name: '本周签到日历' });
  await expect(calendar.getByRole('listitem')).toHaveCount(7);
  expect(await gridTrackCount(calendar)).toBe(7);
  expect(await page.locator('.overview-check-in-panel').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('overview shows authoritative asset status and opens the bank page', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  for (const text of ['资产状态', '服务器权威结果', '可支配资产', '冻结资产', '贷款负债']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByText('当前设备现金记录', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '查看详情' }).click();
  expect(await page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('bank');
});

test('overview only scrolls the order list after the visible capacity is exceeded', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');
  const shortList = page.locator('.overview-open-orders-list');
  await expect(shortList).not.toHaveClass(/overview-open-orders-list--scrollable/);
  expect(await shortList.evaluate((element) => getComputedStyle(element).overflowY)).toBe('visible');
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');
  const longList = page.locator('.overview-open-orders-list');
  await expect(longList).toHaveClass(/overview-open-orders-list--scrollable/);
  expect(await longList.evaluate((element) => getComputedStyle(element).overflowY)).toBe('auto');
  expect(await longList.evaluate((element) => element.scrollHeight > element.clientHeight + 1)).toBe(true);
});

test('overview keeps the decision rows visible and adapts to a narrower desktop', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=alerts');
  const production = page.getByRole('heading', { name: '生产摘要', exact: true });
  await expect(production).toBeVisible();
  expect((await requireBox(production)).y).toBeLessThan(900);
  await expect(page.locator('.overview-alert-list')).toHaveCount(0);
  await page.getByRole('button', { name: /^通知，/ }).click();
  const notificationPanel = page.getByRole('dialog', { name: '通知' });
  await expect(notificationPanel).toContainText('缺少生产原料');
  await expect(notificationPanel).toContainText('停止生产');
  await notificationPanel.getByRole('button', { name: '关闭通知面板' }).click();
  await page.setViewportSize({ width: 900, height: 1000 });
  expect(await gridTrackCount(page.locator('.overview-summary-row'))).toBe(1);
  expect(pageErrors).toEqual([]);
});

test('desktop command rail expansion overlays the integrated card without reflowing overview or outliner', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=empty');
  const shell = page.locator('.game-shell');
  const sidebar = page.locator('.desktop-sidebar');
  const workspace = page.locator('.workspace');
  const primaryCard = page.locator('.signed-in-shell__primary-card');
  const overviewPanel = page.locator('.strategic-page-host--building > .page-content');
  const outliner = page.locator('.strategic-outliner');
  await expect(shell).toHaveClass(/sidebar-collapsed/);
  await expect(outliner).toBeVisible();
  const before = {
    workspace: await requireBox(workspace),
    card: await requireBox(primaryCard),
    overview: await requireBox(overviewPanel),
    outliner: await requireBox(outliner),
    tracks: await gridTrackCount(page.locator('.overview-summary-row')),
  };
  await sidebar.hover();
  await expect(shell).not.toHaveClass(/sidebar-collapsed/);
  await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  await page.waitForTimeout(240);
  expect(await requireBox(workspace)).toEqual(before.workspace);
  expect(await requireBox(primaryCard)).toEqual(before.card);
  expect(await requireBox(overviewPanel)).toEqual(before.overview);
  expect(await requireBox(outliner)).toEqual(before.outliner);
  expect((await requireBox(sidebar)).x + (await requireBox(sidebar)).width).toBeGreaterThan(before.overview.x + 100);
  const dividerShadow = await sidebar.evaluate((element) => getComputedStyle(element, '::after').boxShadow);
  expect(dividerShadow).not.toBe('none');
  expect(await gridTrackCount(page.locator('.overview-summary-row'))).toBe(before.tracks);
  expect(pageErrors).toEqual([]);
});
