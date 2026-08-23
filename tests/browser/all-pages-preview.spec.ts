import { expect, test, type Page } from '@playwright/test';

const pages = [
  { label: '概览', heading: '概览' },
  { label: '市场', heading: '市场' },
  { label: '建筑', heading: '建筑' },
  { label: '研发', heading: '研发' },
  { label: '拍卖', heading: '拍卖' },
  { label: '合同', heading: '合同' },
  { label: '银行', heading: '银行' },
  { label: '排行', heading: '排行' },
  { label: '商店', heading: '商店' },
  { label: '设置', heading: '设置' },
] as const;

async function clickMapProvinceLabel(page: Page, provinceName: string) {
  const label = page.locator(`.map-label-char[data-province-name="${provinceName}"]`).first();
  await expect(label).toBeVisible();
  const box = await label.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
}

test('local preview opens the persistent strategic map first and keeps all formal pages reachable', async ({ page }) => {
  await page.goto('?preview=game');

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.locator('[data-player-page-navigation="true"]')).toHaveCount(0);

  const sidebar = page.locator('.desktop-sidebar');
  for (const target of pages) {
    const button = target.label === '设置'
      ? sidebar.locator('.sidebar-footer').getByRole('button', { name: '设置', exact: true })
      : sidebar.getByRole('button', { name: new RegExp(`^${target.label}`) });
    await button.click();
    await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
  }
});

test('player page heading keeps SVG back, centered title, and SVG close in that order', async ({ page }) => {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^概览/ }).click();

  const heading = page.locator('.page-heading--player-navigation').first();
  await expect(heading).toBeVisible();
  await expect(heading.locator('.page-navigation-button--back .game-icon')).toHaveCount(1);
  await expect(heading.locator('.page-navigation-button--close .game-icon')).toHaveCount(1);
  await expect(heading.locator('.page-heading-title h1')).toHaveText('概览');

  const layout = await heading.evaluate((element) => {
    const back = element.querySelector<HTMLElement>('.page-navigation-button--back');
    const title = element.querySelector<HTMLElement>('.page-heading-title');
    const close = element.querySelector<HTMLElement>('.page-navigation-button--close');
    if (!back || !title || !close) throw new Error('page heading navigation nodes missing');
    const rect = (node: HTMLElement) => {
      const value = node.getBoundingClientRect();
      return { left: value.left, top: value.top, width: value.width, height: value.height };
    };
    const style = getComputedStyle(element);
    return {
      back: rect(back),
      title: rect(title),
      close: rect(close),
      heading: rect(element as HTMLElement),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
    };
  });

  expect(layout.back.left).toBeLessThan(layout.title.left);
  expect(layout.title.left).toBeLessThan(layout.close.left);
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
    compactWidths.push(contentBox!.width);
    compactCardWidths.push(cardBox!.width);
  }

  for (const label of ['排行', '商店']) {
    const button = sidebar.getByRole('button', { name: new RegExp(`^${label}`) });
    await button.click();
    const host = page.locator('.strategic-page-host');
    await expect(host.locator(':scope > .page-loading')).toHaveCount(0);
    const content = host.locator(':scope > .page-content:not(.page-loading)');
    const contentBox = await content.boundingBox();
    expect(contentBox).not.toBeNull();
    expect(contentBox!.width).toBeGreaterThan(Math.max(...compactWidths) * 1.5);
  }

  expect(Math.max(...compactWidths) - Math.min(...compactWidths)).toBeLessThanOrEqual(4);
  expect(Math.max(...compactCardWidths) - Math.min(...compactCardWidths)).toBeLessThanOrEqual(4);
});

test('map remains the single close target without a visible map navigation button', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  await sidebar.getByRole('button', { name: /^概览/ }).click();
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();

  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(sidebar.getByRole('button', { name: /^地图/ })).toHaveCount(0);
  await expect(page.locator('.mobile-bottom-nav').getByRole('button', { name: /^地图/ })).toHaveCount(0);
});
