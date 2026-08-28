import { expect, test, type Page } from '@playwright/test';

type ShellGeometry = {
  viewportWidth: number;
  viewportHeight: number;
  shell: { left: number; top: number; right: number; bottom: number };
  body: { left: number; top: number; right: number; bottom: number };
  chrome: { left: number; top: number; right: number; bottom: number };
  mapLayer: { left: number; top: number; right: number; bottom: number };
  strategicChrome: { left: number; top: number; right: number; bottom: number };
  floatingLayer: { left: number; top: number; right: number; bottom: number };
  primaryCard: { left: number; top: number; right: number; bottom: number };
  sidebar: { left: number; top: number; right: number; bottom: number };
  workspace: { left: number; top: number; right: number; bottom: number };
  assetBar: { left: number; top: number; right: number; bottom: number };
  pageScroll: { left: number; top: number; right: number; bottom: number };
  pageHost: { left: number; top: number; right: number; bottom: number };
  lensBar: { left: number; top: number; right: number; bottom: number };
  lensBarParentIsMapLayer: boolean;
  outliner: { left: number; top: number; right: number; bottom: number };
  outlinerCollapsed: boolean;
  pageContent: { left: number; top: number; width: number; right: number; bottom: number; contentRight: number };
  contentGrid: { left: number; right: number };
  primaryCardGap: number;
  pageScrollbar: { railTop: number; railRight: number; railBottom: number; thumbRight: number };
  pageScrollClientWidth: number;
  pageScrollHasHorizontalOverflow: boolean;
  shellGap: string;
  shellPadding: [string, string, string, string];
  workspaceMargin: [string, string, string, string];
  pageContentMaxWidth: string;
  pageContentMargin: [string, string];
  pageContentPadding: [string, string, string];
  primaryCardContainsSidebarAndPage: boolean;
  sidebarDivider: { content: string; boxShadow: string };
};

async function readShellGeometry(page: Page): Promise<ShellGeometry> {
  return page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.game-shell');
    const body = document.querySelector<HTMLElement>('.signed-in-shell__body');
    const chrome = document.querySelector<HTMLElement>('.signed-in-shell__chrome');
    const mapLayer = document.querySelector<HTMLElement>('.application-map-layer');
    const strategicChrome = document.querySelector<HTMLElement>('.workspace-strategic-chrome');
    const floatingLayer = document.querySelector<HTMLElement>('.workspace-floating-layer');
    const primaryCard = document.querySelector<HTMLElement>('.signed-in-shell__primary-card');
    const sidebar = document.querySelector<HTMLElement>('.desktop-sidebar');
    const workspace = document.querySelector<HTMLElement>('.workspace');
    const assetBar = document.querySelector<HTMLElement>('.asset-bar');
    const pageScrollArea = document.querySelector<HTMLElement>('.page-scroll-area');
    const pageScroll = document.querySelector<HTMLElement>('.page-scroll');
    const pageContent = document.querySelector<HTMLElement>('.page-content');
    const pageCardScrollArea = document.querySelector<HTMLElement>('.page-card-scroll-area');
    const pageHost = document.querySelector<HTMLElement>('.strategic-page-host');
    const lensBar = document.querySelector<HTMLElement>('.strategic-map-lens-bar');
    const outliner = document.querySelector<HTMLElement>('.strategic-outliner');
    const contentGrid = document.querySelector<HTMLElement>('.overview-dashboard-shell');
    const pageScrollbarRail = pageCardScrollArea?.querySelector<HTMLElement>(':scope > .ui-scrollbar--vertical');
    const pageScrollbarThumb = pageScrollbarRail?.querySelector<HTMLElement>('.ui-scrollbar__thumb');
    const primaryCards = [...document.querySelectorAll<HTMLElement>(
      '.overview-check-in-panel, .overview-summary-card',
    )].slice(0, 2);
    if (
      !shell
      || !body
      || !chrome
      || !mapLayer
      || !strategicChrome
      || !floatingLayer
      || !primaryCard
      || !sidebar
      || !workspace
      || !assetBar
      || !pageScrollArea
      || !pageScroll
      || !pageContent
      || !pageCardScrollArea
      || !pageHost
      || !lensBar
      || !outliner
      || !contentGrid
      || !pageScrollbarRail
      || !pageScrollbarThumb
      || primaryCards.length < 2
    ) {
      throw new Error('game shell geometry fixture is incomplete');
    }

    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const shellStyle = getComputedStyle(shell);
    const workspaceStyle = getComputedStyle(workspace);
    const pageContentStyle = getComputedStyle(pageContent);
    const sidebarDividerStyle = getComputedStyle(sidebar, '::after');
    const pageContentRect = pageContent.getBoundingClientRect();
    const contentGridRect = contentGrid.getBoundingClientRect();
    const firstCardRect = primaryCards[0].getBoundingClientRect();
    const secondCardRect = primaryCards[1].getBoundingClientRect();
    const pageScrollbarRailRect = pageScrollbarRail.getBoundingClientRect();
    const pageScrollbarThumbRect = pageScrollbarThumb.getBoundingClientRect();
    const paddingRight = Number.parseFloat(pageContentStyle.paddingRight) || 0;
    const primaryCardGap = secondCardRect.left >= firstCardRect.right - 1
      ? secondCardRect.left - firstCardRect.right
      : secondCardRect.top - firstCardRect.bottom;

    return {
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      shell: rect(shell),
      body: rect(body),
      chrome: rect(chrome),
      mapLayer: rect(mapLayer),
      strategicChrome: rect(strategicChrome),
      floatingLayer: rect(floatingLayer),
      primaryCard: rect(primaryCard),
      sidebar: rect(sidebar),
      workspace: rect(workspace),
      assetBar: rect(assetBar),
      pageScroll: rect(pageScrollArea),
      pageHost: rect(pageHost),
      lensBar: rect(lensBar),
      lensBarParentIsMapLayer: lensBar.parentElement === mapLayer,
      outliner: rect(outliner),
      outlinerCollapsed: outliner.dataset.collapsed === 'true',
      pageContent: {
        left: pageContentRect.left,
        top: pageContentRect.top,
        width: pageContentRect.width,
        right: pageContentRect.right,
        bottom: pageContentRect.bottom,
        contentRight: pageContentRect.right - paddingRight,
      },
      contentGrid: {
        left: contentGridRect.left,
        right: contentGridRect.right,
      },
      primaryCardGap,
      pageScrollbar: {
        railTop: pageScrollbarRailRect.top,
        railRight: pageScrollbarRailRect.right,
        railBottom: pageScrollbarRailRect.bottom,
        thumbRight: pageScrollbarThumbRect.right,
      },
      pageScrollClientWidth: pageScroll.clientWidth,
      pageScrollHasHorizontalOverflow: pageScroll.scrollWidth > pageScroll.clientWidth + 1,
      shellGap: shellStyle.gap,
      shellPadding: [
        shellStyle.paddingTop,
        shellStyle.paddingRight,
        shellStyle.paddingBottom,
        shellStyle.paddingLeft,
      ],
      workspaceMargin: [
        workspaceStyle.marginTop,
        workspaceStyle.marginRight,
        workspaceStyle.marginBottom,
        workspaceStyle.marginLeft,
      ],
      pageContentMaxWidth: pageContentStyle.maxWidth,
      pageContentMargin: [pageContentStyle.marginLeft, pageContentStyle.marginRight],
      pageContentPadding: [
        pageContentStyle.paddingLeft,
        pageContentStyle.paddingRight,
        pageContentStyle.paddingBottom,
      ],
      primaryCardContainsSidebarAndPage: sidebar.closest('.signed-in-shell__primary-card') === primaryCard
        && pageContent.closest('.signed-in-shell__primary-card') === primaryCard,
      sidebarDivider: {
        content: sidebarDividerStyle.content,
        boxShadow: sidebarDividerStyle.boxShadow,
      },
    };
  });
}

function expectStrategicDesktopLayout(layout: ShellGeometry, panelGap: number) {
  const gutter = 8;
  const primaryCardBorder = 1;
  expect(layout.shell.left).toBeCloseTo(0, 0);
  expect(layout.shell.top).toBeCloseTo(0, 0);
  expect(layout.shell.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.shell.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.shellGap).toBe('0px');
  expect(layout.shellPadding).toEqual(['0px', '0px', '0px', '0px']);

  expect(layout.chrome.left).toBeCloseTo(0, 0);
  expect(layout.chrome.top).toBeCloseTo(0, 0);
  expect(layout.chrome.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.body.left).toBeCloseTo(0, 0);
  expect(layout.body.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.body.top).toBeCloseTo(layout.chrome.bottom, 0);
  expect(layout.body.bottom).toBeCloseTo(layout.viewportHeight, 0);

  expect(layout.assetBar.left).toBeCloseTo(gutter, 0);
  expect(layout.assetBar.top).toBeCloseTo(gutter, 0);
  expect(layout.viewportWidth - layout.assetBar.right).toBeCloseTo(gutter, 0);
  expect(layout.body.top - layout.assetBar.bottom).toBeCloseTo(gutter, 0);

  expect(layout.primaryCard.left).toBeCloseTo(gutter, 0);
  expect(layout.primaryCard.top).toBeCloseTo(layout.body.top, 0);
  expect(layout.primaryCard.top - layout.assetBar.bottom).toBeCloseTo(gutter, 0);
  expect(layout.viewportHeight - layout.primaryCard.bottom).toBeCloseTo(gutter, 0);
  expect(layout.primaryCard.right - layout.primaryCard.left).toBeLessThanOrEqual(layout.viewportWidth / 3 + 1);
  expect(layout.sidebar.left).toBeCloseTo(layout.primaryCard.left + primaryCardBorder, 0);
  expect(layout.sidebar.top).toBeCloseTo(layout.primaryCard.top + primaryCardBorder, 0);
  expect(layout.sidebar.bottom).toBeCloseTo(layout.primaryCard.bottom - primaryCardBorder, 0);
  expect(layout.sidebar.right - layout.sidebar.left).toBeCloseTo(78, 0);
  expect(layout.primaryCardContainsSidebarAndPage).toBe(true);
  expect(layout.sidebarDivider.content).not.toBe('none');
  expect(layout.sidebarDivider.boxShadow).not.toBe('none');

  expect(layout.workspace.left).toBeCloseTo(0, 0);
  expect(layout.workspace.top).toBeCloseTo(layout.body.top, 0);
  expect(layout.workspace.right).toBeCloseTo(layout.viewportWidth, 0);
  expect(layout.workspace.bottom).toBeCloseTo(layout.viewportHeight, 0);
  expect(layout.workspaceMargin).toEqual(['0px', '0px', '0px', '0px']);

  expect(layout.pageScroll.left).toBeCloseTo(layout.primaryCard.left + primaryCardBorder + 78, 0);
  expect(layout.pageScroll.top).toBeCloseTo(layout.primaryCard.top + primaryCardBorder, 0);
  expect(layout.pageScroll.right).toBeCloseTo(layout.primaryCard.right - primaryCardBorder, 0);
  expect(layout.pageScroll.bottom).toBeCloseTo(layout.primaryCard.bottom - primaryCardBorder, 0);
  expect(layout.floatingLayer.left).toBeCloseTo(layout.workspace.left + gutter + 78, 0);
  expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0);
  expect(layout.floatingLayer.right).toBeCloseTo(layout.workspace.right, 0);
  expect(layout.floatingLayer.bottom).toBeCloseTo(layout.workspace.bottom, 0);
  expect(layout.mapLayer).toEqual({
    left: 0,
    top: 0,
    right: layout.viewportWidth,
    bottom: layout.viewportHeight,
  });
  expect(layout.strategicChrome).toEqual(layout.workspace);

  expect(layout.pageHost.left).toBeCloseTo(layout.pageScroll.left, 0);
  expect(layout.pageHost.right).toBeCloseTo(layout.pageScroll.right, 0);
  expect(layout.pageContent.left).toBeCloseTo(layout.pageScroll.left, 0);
  expect(layout.pageContent.width).toBeCloseTo(layout.pageScrollClientWidth, 0);
  expect(layout.pageContent.right).toBeLessThanOrEqual(layout.outliner.left - panelGap + 1);
  expect(layout.outliner.right).toBeCloseTo(layout.workspace.right - panelGap, 0);
  expect(layout.outliner.top).toBeCloseTo(layout.primaryCard.top, 0);
  expect(layout.outliner.bottom).toBeCloseTo(layout.primaryCard.bottom, 0);
  expect(layout.outlinerCollapsed).toBe(false);
  expect(layout.outliner.right - layout.outliner.left).toBeGreaterThanOrEqual(280);
  expect(layout.contentGrid.left).toBeGreaterThanOrEqual(layout.pageContent.left);
  expect(layout.contentGrid.right).toBeLessThanOrEqual(layout.pageContent.right);
  expect(layout.primaryCardGap).toBeGreaterThan(0);
  expect(layout.primaryCardGap).toBeLessThanOrEqual(24);
  expect(layout.pageContentMaxWidth).toBe('none');
  expect(layout.pageContentMargin).toEqual(['0px', '0px']);
  expect(layout.pageContentPadding).toEqual(['0px', '0px', '0px']);
  expect(layout.pageScrollHasHorizontalOverflow).toBe(false);
  expect(layout.lensBar.top).toBeLessThan(layout.pageContent.bottom);
  expect(layout.lensBar.bottom).toBeCloseTo(layout.viewportHeight - panelGap, 0);
  expect((layout.lensBar.left + layout.lensBar.right) / 2)
    .toBeCloseTo(layout.viewportWidth / 2, 0);
  expect(layout.lensBarParentIsMapLayer).toBe(true);

  expect(layout.pageScrollbar.railTop).toBeGreaterThan(layout.pageContent.top);
  expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.pageContent.right, 0);
  expect(layout.pageScrollbar.railBottom).toBeCloseTo(layout.pageContent.bottom, 0);
  expect(layout.pageScrollbar.thumbRight).toBeCloseTo(layout.pageContent.right, 0);
}

test.describe('persistent-map grand-strategy game shell', () => {
  test('desktop shell keeps an 8px chrome gutter and one integrated workspace card over the persistent map', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');
    await expect(page.locator('.game-shell')).toBeVisible();
    await expect(page.locator('.workspace')).toBeVisible();
    await expect(page.locator('.asset-bar')).toBeVisible();
    await expect(page.locator('.page-scroll-area')).toBeVisible();
    await expect(page.locator('.page-content')).toBeVisible();
    await expect(page.locator('.strategic-outliner')).toBeVisible();

    expectStrategicDesktopLayout(await readShellGeometry(page), 8);
  });

  test('compact desktop keeps the persistent map, expanded overlay outliner, and page panel on the 8px strategic grid', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');
    await expect(page.locator('.game-shell')).toBeVisible();
    const outliner = page.locator('.strategic-outliner');
    await expect(outliner).toBeVisible();
    await expect(outliner).not.toHaveAttribute('data-collapsed', 'true');

    expectStrategicDesktopLayout(await readShellGeometry(page), 8);
  });

  test('short desktop keeps the persistent map and command chrome inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');
    await expect(page.locator('.game-shell')).toBeVisible();

    expectStrategicDesktopLayout(await readShellGeometry(page), 8);
  });

  test('map lens buttons keep icons and labels centered on one shared vertical axis', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const lensBar = page.getByRole('navigation', { name: '地图镜头' });
    const buttons = lensBar.getByRole('button');
    await expect(buttons).toHaveCount(5);

    const readLensButtonGeometry = () => lensBar.evaluate((bar) =>
      [...bar.querySelectorAll<HTMLElement>('.strategic-map-lens-button')].map((button) => {
        const icon = button.querySelector<HTMLElement>('svg');
        const label = button.querySelector<HTMLElement>('span');
        if (!icon || !label) throw new Error('lens button icon or label is missing');
        const buttonBox = button.getBoundingClientRect();
        const iconBox = icon.getBoundingClientRect();
        const labelBox = label.getBoundingClientRect();
        const style = getComputedStyle(button);
        return {
          display: style.display,
          alignItems: style.alignItems,
          justifyContent: style.justifyContent,
          iconCenterY: (iconBox.top + iconBox.bottom) / 2,
          labelCenterY: (labelBox.top + labelBox.bottom) / 2,
          contentLeft: iconBox.left,
          contentRight: labelBox.right,
          buttonCenterX: (buttonBox.left + buttonBox.right) / 2,
          buttonCenterY: (buttonBox.top + buttonBox.bottom) / 2,
        };
      }),
    );

    const inactive = await readLensButtonGeometry();
    await buttons.nth(2).click();
    await expect(page.locator('.strategic-map-stage')).toHaveAttribute('data-map-lens', 'industry');
    const active = await readLensButtonGeometry();

    for (const geometry of [...inactive, ...active]) {
      expect(geometry.display).toBe('flex');
      expect(geometry.alignItems).toBe('center');
      expect(geometry.justifyContent).toBe('center');
      expect(Math.abs(geometry.iconCenterY - geometry.labelCenterY)).toBeLessThanOrEqual(0.75);
      expect(Math.abs(geometry.iconCenterY - geometry.buttonCenterY)).toBeLessThanOrEqual(1);
      expect(Math.abs(geometry.labelCenterY - geometry.buttonCenterY)).toBeLessThanOrEqual(1);
      expect(Math.abs((geometry.contentLeft + geometry.contentRight) / 2 - geometry.buttonCenterX))
        .toBeLessThanOrEqual(1);
    }
  });

  test('desktop navigation rows keep intrinsic height and stack from the top', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');

    const navigation = page.locator('.desktop-sidebar .sidebar-nav');
    const buttons = navigation.locator('.sidebar-nav-button');
    await expect(navigation).toBeVisible();
    await expect(buttons).toHaveCount(10);

    const geometry = await navigation.evaluate((element) => {
      const navRect = element.getBoundingClientRect();
      const rows = [...element.querySelectorAll<HTMLElement>('.sidebar-nav-button')]
        .map((button) => button.getBoundingClientRect());
      return {
        alignContent: getComputedStyle(element).alignContent,
        gridAutoRows: getComputedStyle(element).gridAutoRows,
        firstOffset: rows[0]?.top - navRect.top,
        heights: rows.map((row) => row.height),
        gaps: rows.slice(1).map((row, index) => row.top - rows[index].bottom),
      };
    });

    expect(geometry.alignContent).toBe('start');
    expect(geometry.gridAutoRows).toBe('max-content');
    expect(geometry.firstOffset).toBeCloseTo(0, 0);
    expect(Math.max(...geometry.heights)).toBeLessThanOrEqual(56);
    expect(Math.min(...geometry.heights)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...geometry.gaps)).toBeLessThanOrEqual(12);
  });

  test('status bar owns game identity while the sidebar footer owns the settings entry', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');

    const identity = page.locator('.asset-bar-identity');
    await expect(identity).toBeVisible();
    await expect(identity).toContainText('金融帝国');
    await expect(identity).toContainText('MEVIUS');
    await expect(identity.locator('.player-avatar')).toHaveCount(1);
    await expect(identity).toHaveAttribute('aria-label', '玩家 MEVIUS，打开设置');
    await expect(page.locator('.desktop-sidebar .sidebar-brand-copy')).toHaveCount(0);
    await expect(page.locator('.desktop-sidebar .sidebar-brand')).toHaveCount(0);

    const sidebarNavigation = page.getByRole('navigation', { name: '游戏主导航' });
    await expect(sidebarNavigation.getByRole('button', { name: '设置', exact: true })).toHaveCount(0);
    const settingsButton = page.locator('.desktop-sidebar .sidebar-footer').getByRole('button', { name: '设置', exact: true });
    await expect(settingsButton).toBeVisible();
    await expect(page.locator('.desktop-sidebar').getByRole('button', { name: '退出登录' })).toHaveCount(0);
    const statusAlignment = await page.evaluate(() => {
      const status = document.querySelector<HTMLElement>('.asset-bar');
      const layout = document.querySelector<HTMLElement>('.asset-bar-layout');
      const tracks = Array.from(document.querySelectorAll<HTMLElement>(
        '.asset-bar-identity, .asset-bar-content, .asset-bar-action, .asset-bar-item',
      ));
      if (!status || !layout || tracks.length === 0) throw new Error('status alignment fixture is incomplete');
      const statusBox = status.getBoundingClientRect();
      const statusCenter = statusBox.top + statusBox.height / 2;
      return {
        alignItems: getComputedStyle(layout).alignItems,
        itemPaddingBlocks: tracks
          .filter((track) => track.classList.contains('asset-bar-item'))
          .map((track) => {
            const style = getComputedStyle(track);
            return [style.paddingTop, style.paddingBottom];
          }),
        itemOverflows: tracks
          .filter((track) => track.classList.contains('asset-bar-item'))
          .map((track) => track.scrollHeight > track.clientHeight),
        centerOffsets: tracks.map((track) => {
          const box = track.getBoundingClientRect();
          return box.top + box.height / 2 - statusCenter;
        }),
      };
    });
    expect(statusAlignment.alignItems).toBe('center');
    expect(statusAlignment.itemPaddingBlocks.every((padding) => padding[0] === '0px' && padding[1] === '0px')).toBe(true);
    expect(statusAlignment.itemOverflows).not.toContain(true);
    expect(Math.max(...statusAlignment.centerOffsets.map(Math.abs))).toBeLessThanOrEqual(1);
    await settingsButton.click();
    await expect.poll(() => page.evaluate(() => (window as Window & { __lastSelectedTab?: string }).__lastSelectedTab)).toBe('settings');
  });

  test('command rail expands over the page without moving the card, page, outliner, map, or status bar', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');

    const collapsed = await readShellGeometry(page);
    expectStrategicDesktopLayout(collapsed, 8);

    const sidebar = page.locator('.desktop-sidebar');
    await sidebar.hover();
    await expect(page.locator('.desktop-sidebar')).toHaveAttribute('data-collapsed', 'false');
    await page.waitForTimeout(240);

    const expanded = await readShellGeometry(page);
    expect(expanded.sidebar.left).toBeCloseTo(collapsed.sidebar.left, 0);
    expect(expanded.assetBar.left).toBeCloseTo(collapsed.assetBar.left, 0);
    expect(expanded.assetBar.right).toBeCloseTo(collapsed.assetBar.right, 0);
    expect(expanded.assetBar.top).toBeCloseTo(collapsed.assetBar.top, 0);
    expect(expanded.sidebar.right - collapsed.sidebar.right).toBeCloseTo(146, 0);
    expect(expanded.primaryCard).toEqual(collapsed.primaryCard);
    expect(expanded.workspace.left).toBeCloseTo(collapsed.workspace.left, 0);
    expect(expanded.pageScroll.left).toBeCloseTo(collapsed.pageScroll.left, 0);
    expect(expanded.pageContent.left).toBeCloseTo(collapsed.pageContent.left, 0);
    expect(expanded.pageContent.width).toBeCloseTo(collapsed.pageContent.width, 0);
    expect(expanded.outliner).toEqual(collapsed.outliner);
    expect(expanded.mapLayer).toEqual(collapsed.mapLayer);
    expect(expanded.sidebarDivider.boxShadow).not.toBe('none');
  });

  test('desktop sidebar hover feedback and geometry stay stable at wide and narrow desktop widths', async ({ page }) => {
    for (const viewport of [{ width: 1684, height: 931 }, { width: 900, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto('runtime-test.html?view=overview&scenario=empty');
      const sidebar = page.locator('.desktop-sidebar');
      const overview = sidebar.getByRole('button', { name: '概览', exact: true });
      const sidebarInsets = await sidebar.evaluate((element) => {
        const style = getComputedStyle(element);
        const navFrame = element.querySelector<HTMLElement>('.sidebar-nav-frame');
        return {
          padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft],
          navMarginTop: navFrame ? getComputedStyle(navFrame).marginTop : '',
        };
      });
      expect(sidebarInsets.padding).toEqual(['14px', '14px', '14px', '14px']);
      expect(sidebarInsets.navMarginTop).toBe('0px');
      const before = await overview.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const sidebarBox = element.closest<HTMLElement>('.desktop-sidebar')!.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          x: box.x - sidebarBox.x,
          y: box.y - sidebarBox.y,
          width: box.width,
          height: box.height,
          background: style.backgroundColor,
          border: style.borderTopColor,
        };
      });
      expect((await sidebar.boundingBox())?.width).toBeCloseTo(78, 0);

      await sidebar.hover();
      await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
      await expect(sidebar.locator('.sidebar-nav-button strong').first()).toBeVisible();
      const expandedSidebar = await sidebar.boundingBox();
      expect(expandedSidebar?.width).toBeCloseTo(224, 0);
      const hovered = await overview.evaluate((element) => {
        const box = element.getBoundingClientRect();
        const sidebarBox = element.closest<HTMLElement>('.desktop-sidebar')!.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          x: box.x - sidebarBox.x,
          y: box.y - sidebarBox.y,
          width: box.width,
          height: box.height,
          background: style.backgroundColor,
          border: style.borderTopColor,
        };
      });
      expect(hovered.x).toBeCloseTo(before.x, 0);
      expect(hovered.y).toBeCloseTo(before.y, 0);
      expect(hovered.height).toBeCloseTo(before.height, 0);
      expect(hovered.background).not.toBe(before.background);
      expect(hovered.border).not.toBe(before.border);
    }
  });

  test('page-card scrollbar stays inside the integrated card and hides after idle', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    const pageScrollArea = page.locator('.page-card-scroll-area');
    const pageScroll = page.locator('.page-card-scroll');
    await expect(pageScrollArea).toBeVisible();
    await expect(pageScrollArea).not.toHaveAttribute('data-scrollbar-active-y', 'true');

    const before = await pageScroll.evaluate((element) => ({
      overflowY: getComputedStyle(element).overflowY,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
      scrollTop: element.scrollTop,
      scrollHeight: element.scrollHeight,
    }));
    expect(before.overflowY).toBe('auto');
    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);

    await pageScroll.dispatchEvent('pointermove', { clientX: 100, clientY: 100 });
    await page.waitForTimeout(100);
    await expect(pageScrollArea).not.toHaveAttribute('data-scrollbar-active-y', 'true');

    await pageScroll.evaluate((element) => { element.scrollTop = Math.min(180, element.scrollHeight - element.clientHeight); });
    await expect(pageScrollArea).toHaveAttribute('data-scrollbar-active-y', 'true');

    const during = await pageScroll.evaluate((element) => ({ clientWidth: element.clientWidth, scrollTop: element.scrollTop }));
    expect(during.scrollTop).toBeGreaterThan(before.scrollTop);
    expect(during.clientWidth).toBe(before.clientWidth);

    const scrollbarEdge = await pageScrollArea.evaluate((element) => {
      const rail = element.querySelector<HTMLElement>(':scope > .ui-scrollbar--vertical');
      const thumb = rail?.querySelector<HTMLElement>('.ui-scrollbar__thumb');
      const pageContent = element.closest<HTMLElement>('.page-content');
      if (!rail || !thumb || !pageContent) throw new Error('page-card scrollbar is missing');
      return {
        viewportRight: document.documentElement.clientWidth,
        pageContentRight: pageContent.getBoundingClientRect().right,
        railRight: rail.getBoundingClientRect().right,
        thumbRight: thumb.getBoundingClientRect().right,
      };
    });
    expect(scrollbarEdge.railRight).toBeCloseTo(scrollbarEdge.pageContentRight, 0);
    expect(scrollbarEdge.thumbRight).toBeCloseTo(scrollbarEdge.pageContentRight, 0);
    expect(scrollbarEdge.railRight).toBeLessThan(scrollbarEdge.viewportRight);
    expect(scrollbarEdge.thumbRight).toBeLessThan(scrollbarEdge.viewportRight);

    await expect(pageScrollArea).not.toHaveAttribute('data-scrollbar-active-y', 'true', { timeout: 2_500 });
  });
});
