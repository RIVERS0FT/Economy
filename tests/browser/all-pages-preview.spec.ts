import { expect, test } from '@playwright/test';

const pages = [
  { navigation: /^概览/, heading: '概览' },
  { navigation: /^市场/, heading: '市场' },
  { navigation: /^建筑/, heading: '建筑' },
  { navigation: /^研发/, heading: '研发' },
  { navigation: /^拍卖/, heading: '拍卖' },
  { navigation: /^合同/, heading: '合同' },
  { navigation: /^银行/, heading: '银行' },
  { navigation: /^排行/, heading: '排行榜' },
  { navigation: /^商店/, heading: '商店' },
  { navigation: /^设置/, heading: '设置' },
] as const;

async function clickMapProvinceLabel(page: import('@playwright/test').Page, provinceName: string) {
  const label = page.locator('.province-map-label').filter({ hasText: new RegExp(`^${provinceName}$`) });
  await expect(label).toBeVisible();
  const point = await label.evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.ownerSVGElement?.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
  });
  await page.mouse.click(point.x, point.y);
}

test('account-free mode redirects into the complete game shell without API traffic', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/economy-api')) apiRequests.push(request.url());
  });

  await page.goto('all-pages-preview.html');

  await expect(page).toHaveURL(/\/economy\/\?preview=game$/);
  await expect(page.locator('html')).toHaveAttribute('data-local-game-preview', 'true');
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.locator('.desktop-sidebar .sidebar-nav-button')).toHaveCount(9);
  await expect(page.locator('.desktop-sidebar .sidebar-footer').getByRole('button', { name: '设置' })).toHaveCount(1);
  await expect(page.locator('.desktop-sidebar').getByRole('button', { name: /^地图/ })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: pages[0].heading })).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test('account-free game shell navigates all ten visible business pages and closes to the map', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  for (const target of pages) {
    const navigation = sidebar.getByRole('button', { name: target.navigation });
    await navigation.click();
    await expect(navigation).toHaveAttribute('aria-current', 'page');
    if ('heading' in target) {
      await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: '返回上一页面' })).toBeVisible();
    await expect(page.getByRole('button', { name: '关闭当前页面并显示地图' })).toBeVisible();
  }

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('.province-map-page')).toHaveCount(1);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
  await clickMapProvinceLabel(page, '得克萨斯州');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', 'US-TX');
  await expect(page.getByRole('heading', { level: 1, name: '得克萨斯州' })).toBeVisible();
  await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-presentation', 'building');
  await expect(page.getByRole('tablist', { name: '得克萨斯州页面分区' }).getByRole('tab')).toHaveCount(4);
  await expect(page.getByText('当前经营地区', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-selected-province-id', '');
});

test('player page heading keeps SVG back, centered title, and SVG close in that order', async ({ page }) => {
  await page.goto('?preview=game');

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const heading = page.locator('[data-player-page-navigation="true"]');
    const back = heading.getByRole('button', { name: '返回上一页面' });
    const close = heading.getByRole('button', { name: '关闭当前页面并显示地图' });
    await expect(heading).toBeVisible();
    await expect(back.locator('svg')).toHaveCount(1);
    await expect(close.locator('svg')).toHaveCount(1);
    await expect(back).toHaveText('');
    await expect(close).toHaveText('');

    const layout = await heading.evaluate((element) => {
      const children = [...element.children] as HTMLElement[];
      const rect = (target: HTMLElement) => {
        const box = target.getBoundingClientRect();
        return { left: box.left, top: box.top, width: box.width, height: box.height };
      };
      return {
        order: children.map((child) => (
          child.classList.contains('page-navigation-button--back')
            ? 'back'
            : child.classList.contains('page-heading-title')
              ? 'title'
              : child.classList.contains('page-navigation-button--close')
                ? 'close'
                : 'unknown'
        )),
        heading: rect(element),
        back: rect(children[0]),
        title: rect(children[1]),
        close: rect(children[2]),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        padding: [
          getComputedStyle(element).paddingTop,
          getComputedStyle(element).paddingRight,
          getComputedStyle(element).paddingBottom,
          getComputedStyle(element).paddingLeft,
        ],
      };
    });
    expect(layout.order).toEqual(['back', 'title', 'close']);
    expect(layout.back.width).toBeCloseTo(40, 0);
    expect(layout.back.height).toBeCloseTo(44, 0);
    expect(layout.close.width).toBeCloseTo(40, 0);
    expect(layout.close.height).toBeCloseTo(44, 0);
    expect(layout.title.left + layout.title.width / 2).toBeCloseTo(
      layout.heading.left + layout.heading.width / 2,
      0,
    );
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    expect(new Set(layout.padding).size).toBe(1);
  }
});

test('overview, market, buildings, and settings share a one-third card width while leaderboard and shop stay full-area', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  const workspaceCard = page.locator('.signed-in-shell__primary-card');
  const compactWidths: number[] = [];
  const compactCardWidths: number[] = [];

  await expect(workspaceCard).toHaveCount(1);
  await expect(workspaceCard.locator(':scope .desktop-sidebar')).toHaveCount(1);
  await expect(workspaceCard.locator(':scope .strategic-page-host')).toHaveCount(1);

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await clickMapProvinceLabel(page, '得克萨斯州');
  const provinceHost = page.locator('.strategic-page-host');
  const provinceContent = provinceHost.locator(':scope > .page-content:not(.page-loading)');
  await expect(provinceHost).toHaveAttribute('data-strategic-presentation', 'building');
  await expect(provinceHost.locator(':scope > .page-loading')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1, name: '得克萨斯州' })).toBeVisible();
  await expect(provinceContent).toBeVisible();
  const provinceContentBox = await provinceContent.boundingBox();
  const provinceCardBox = await workspaceCard.boundingBox();
  expect(provinceContentBox).not.toBeNull();
  expect(provinceCardBox).not.toBeNull();
  compactWidths.push(provinceContentBox!.width);
  compactCardWidths.push(provinceCardBox!.width);

  for (const label of ['概览', '市场', '建筑', '设置']) {
    const button = label === '设置'
      ? sidebar.locator('.sidebar-footer').getByRole('button', { name: '设置', exact: true })
      : sidebar.getByRole('button', { name: new RegExp(`^${label}`) });
    await button.click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    const eventRail = page.locator('.strategic-economic-event-rail');
    await expect(host).toHaveAttribute('data-strategic-presentation', 'building');
    await expect(eventRail).toBeVisible();
    await expect(content.locator('.strategic-economic-event-rail')).toHaveCount(0);
    const contentBox = await content.boundingBox();
    const cardBox = await workspaceCard.boundingBox();
    const railBox = await eventRail.boundingBox();
    expect(contentBox).not.toBeNull();
    expect(cardBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    expect(contentBox!.x + contentBox!.width).toBeLessThanOrEqual(railBox!.x - 8);
    compactWidths.push(contentBox!.width);
    compactCardWidths.push(cardBox!.width);
  }
  expect(Math.max(...compactWidths) - Math.min(...compactWidths)).toBeLessThanOrEqual(1);
  expect(Math.max(...compactCardWidths) - Math.min(...compactCardWidths)).toBeLessThanOrEqual(1);
  expect(compactCardWidths[0]).toBeLessThanOrEqual(1684 / 3);
  expect(compactCardWidths[0]).toBeCloseTo(1684 / 3, 0);

  const fullAreaWidths = new Map<string, number>();
  for (const label of ['研发', '拍卖', '合同', '银行', '排行', '商店']) {
    await sidebar.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    await expect(host).toHaveAttribute('data-strategic-presentation', 'fullscreen');
    await expect(page.locator('.strategic-economic-event-rail')).toHaveCount(0);
    const hostBox = await host.boundingBox();
    const contentBox = await content.boundingBox();
    expect(hostBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(contentBox!.width).toBeCloseTo(hostBox!.width, 0);
    expect(contentBox!.width).toBeGreaterThan(compactWidths[0] + 200);
    fullAreaWidths.set(label, contentBox!.width);
  }
  expect(fullAreaWidths.get('排行')).toBeCloseTo(fullAreaWidths.get('商店')!, 0);
});

test('page navigation unfolds only the active page while the persistent map keeps its instance and geometry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');

  const before = await map.evaluate((element) => {
    (element as HTMLElement).dataset.transitionProbe = 'stable';
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  const reveal = page.locator('.signed-in-shell__page-reveal');
  await expect(reveal).toHaveAttribute('data-page-transition-key', 'market');
  await expect(reveal).toHaveCSS('animation-name', 'strategic-page-unfold');
  await expect(map).toHaveAttribute('data-transition-probe', 'stable');
  const after = await map.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  });
  expect(after).toEqual(before);
});

test('reduced motion disables card width and page unfold animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  const transitionDurationSeconds = await page.locator('.signed-in-shell__primary-card').evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(transitionDurationSeconds).toBeLessThanOrEqual(0.001);
  await expect(page.locator('.signed-in-shell__page-reveal')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.strategic-map-stage')).toHaveCSS('transform', 'none');
});

test('player page return skips the map and restores the previous business page', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  await sidebar.getByRole('button', { name: /^市场/ }).click();
  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  const returnButton = page.getByRole('button', { name: '返回上一页面' });
  await returnButton.focus();
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '市场' })).toBeVisible();
  await expect(sidebar.getByRole('button', { name: /^市场/ })).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);
  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await returnButton.focus();
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: '市场' })).toBeVisible();
});

test('leaderboard and local-only service summaries are populated in the full shell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  await sidebar.getByRole('button', { name: /^排行/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '排行榜' })).toBeVisible();
  const leaderboardSwitch = page.locator('.leaderboard-board-switch');
  const leaderboardLayout = page.locator('.leaderboard-responsive-layout');
  await expect(leaderboardSwitch.locator('button')).toHaveCount(4);
  await expect(leaderboardLayout).toBeVisible();
  expect(await leaderboardLayout.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(72 * 16);
  await expect(leaderboardSwitch).toBeHidden();
  await expect(page.locator('.leaderboard-board-card:visible')).toHaveCount(4);
  await expect(page.locator('[data-leaderboard-board="wealth"] .leaderboard-board-card').getByText('本地预览玩家', { exact: true })).toBeVisible();

  for (const viewport of [{ width: 900, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(leaderboardSwitch).toBeVisible();
    await expect(leaderboardSwitch).toHaveAttribute('role', 'group');
    await expect(leaderboardSwitch).toHaveAttribute('aria-label', '选择排行榜');
    await expect(page.locator('.leaderboard-board-card:visible')).toHaveCount(1);
    const switchGeometry = await leaderboardSwitch.evaluate((element) => {
      const buttons = [...element.querySelectorAll<HTMLElement>('button')].map((button) => button.getBoundingClientRect());
      return {
        rowSpread: Math.max(...buttons.map((button) => button.top)) - Math.min(...buttons.map((button) => button.top)),
        hasHorizontalOverflow: element.scrollWidth > element.clientWidth + 1,
      };
    });
    expect(switchGeometry.rowSpread).toBeLessThanOrEqual(1);
    expect(switchGeometry.hasHorizontalOverflow).toBe(false);
  }
  await page.setViewportSize({ width: 900, height: 900 });
  await leaderboardSwitch.getByRole('button', { name: '增长榜', exact: true }).click();
  await expect(leaderboardSwitch.getByRole('button', { name: '增长榜', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.leaderboard-board-card:visible')).toHaveCount(1);
  await expect(page.locator('[data-leaderboard-board="growth"] .leaderboard-board-card')).toBeVisible();

  await sidebar.getByRole('button', { name: /^商店/ }).click();
  await expect(page.getByText('1 宝石 = 1,280 货币', { exact: true })).toBeVisible();
  await expect(page.getByLabel('永久邀请码')).toHaveValue('LOCAL2026');
});
