import { expect, test, type Page } from '@playwright/test';

const playerPages = [
  { tab: 'home', label: '概览', heading: '概览' },
  { tab: 'market', label: '市场', heading: '市场' },
  { tab: 'buildings', label: '建筑', heading: '建筑' },
  { tab: 'research', label: '研发', heading: '研发' },
  { tab: 'auction', label: '拍卖', heading: '拍卖' },
  { tab: 'contracts', label: '合同', heading: '合同' },
  { tab: 'bank', label: '银行', heading: '银行' },
  { tab: 'leaderboard', label: '排行', heading: '排行榜' },
  { tab: 'gem-shop', label: '商店', heading: '商店' },
  { tab: 'settings', label: '设置', heading: '设置' },
] as const;

async function selectPlayerPage(
  page: Page,
  target: (typeof playerPages)[number],
) {
  const mobile = await page.evaluate(() => window.matchMedia('(max-width: 720px)').matches);
  if (mobile) {
    const navigationButton = page
      .locator('.mobile-bottom-navigation .sidebar-nav-button')
      .filter({ hasText: target.label })
      .first();
    await expect(navigationButton).toHaveCount(1);
    await navigationButton.evaluate((button: HTMLButtonElement) => button.click());
  } else {
    const sidebar = page.locator('.desktop-sidebar');
    const navigationButton = target.tab === 'settings'
      ? sidebar.locator('.sidebar-footer').getByRole('button', { name: '设置', exact: true })
      : sidebar.getByRole('button', { name: new RegExp(`^${target.label}`) });
    await expect(navigationButton).toBeVisible();
    await navigationButton.click();
  }

  await expect(page.locator('.game-shell')).toHaveClass(new RegExp(`strategic-tab-${target.tab}`));
  await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
  if (mobile) {
    await expect(page.locator('.mobile-detail-sheet')).toHaveAttribute('data-page-key', target.tab);
  }
}

async function openPreview(page: Page) {
  await page.goto('?preview=game');
  await expect(page.locator('html')).toHaveAttribute('data-local-game-preview', 'true');
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: '概览' })).toBeVisible();
}

async function readPageGeometry(page: Page) {
  return page.evaluate(() => {
    const mobile = window.matchMedia('(max-width: 720px)').matches;
    const pageContent = document.querySelector<HTMLElement>('.page-content--player');
    const header = pageContent?.querySelector<HTMLElement>('.page-fixed-header') ?? null;
    const scrollBody = pageContent?.querySelector<HTMLElement>('.page-card-scroll') ?? null;
    const staticBody = pageContent?.querySelector<HTMLElement>('.page-card-static') ?? null;
    const body = scrollBody ?? staticBody;
    const stack = body?.querySelector<HTMLElement>(':scope > .ui-page-stack') ?? null;
    const firstContent = stack?.firstElementChild instanceof HTMLElement ? stack.firstElementChild : null;
    const mobileSheet = document.querySelector<HTMLElement>(
      '.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet',
    );
    const mobilePageSlot = document.querySelector<HTMLElement>('.mobile-workspace-sheet-page-content');
    const primaryCard = document.querySelector<HTMLElement>('.signed-in-shell__primary-card');
    const desktopPageSlot = document.querySelector<HTMLElement>('.signed-in-shell__primary-page');
    const pageSlot = mobile ? mobilePageSlot : desktopPageSlot;

    if (!pageContent || !header || !body || !stack || !pageSlot || !primaryCard) {
      throw new Error('player page geometry fixture is incomplete');
    }
    if (mobile && !mobileSheet) throw new Error('mobile sheet geometry fixture is incomplete');

    const rect = (element: HTMLElement) => {
      const box = element.getBoundingClientRect();
      return {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
      };
    };

    const bodyStyle = getComputedStyle(body);
    const paddingLeft = Number.parseFloat(bodyStyle.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(bodyStyle.paddingRight) || 0;
    const paddingTop = Number.parseFloat(bodyStyle.paddingTop) || 0;
    const bodyRect = body.getBoundingClientRect();
    const headerRect = header.getBoundingClientRect();
    const stackRect = stack.getBoundingClientRect();
    const firstContentRect = firstContent?.getBoundingClientRect() ?? null;
    const directChildren = Array.from(stack.children)
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map(rect);
    const mobileSheetStyle = mobileSheet ? getComputedStyle(mobileSheet) : null;

    return {
      mobile,
      mobileSheet: mobileSheet ? rect(mobileSheet) : null,
      mobileSheetBorderLeft: mobileSheetStyle ? Number.parseFloat(mobileSheetStyle.borderLeftWidth) || 0 : 0,
      mobileSheetBorderRight: mobileSheetStyle ? Number.parseFloat(mobileSheetStyle.borderRightWidth) || 0 : 0,
      primaryCard: rect(primaryCard),
      pageSlot: rect(pageSlot),
      pageContent: rect(pageContent),
      body: rect(body),
      stack: {
        left: stackRect.left,
        top: stackRect.top,
        right: stackRect.right,
        bottom: stackRect.bottom,
        width: stackRect.width,
        height: stackRect.height,
      },
      directChildren,
      contentLeft: bodyRect.left + paddingLeft,
      contentRight: bodyRect.right - paddingRight,
      paddingTop,
      isScrollable: Boolean(scrollBody),
      firstContentTopGap: firstContentRect ? firstContentRect.top - headerRect.bottom : null,
      pageContentScrollWidth: pageContent.scrollWidth,
      pageContentClientWidth: pageContent.clientWidth,
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
    };
  });
}

function expectSafePageGeometry(geometry: Awaited<ReturnType<typeof readPageGeometry>>) {
  expect(geometry.pageContent.left).toBeCloseTo(geometry.pageSlot.left, 0);
  expect(geometry.pageContent.right).toBeCloseTo(geometry.pageSlot.right, 0);
  expect(geometry.body.left).toBeCloseTo(geometry.pageContent.left, 0);
  expect(geometry.body.right).toBeCloseTo(geometry.pageContent.right, 0);
  expect(geometry.pageContentScrollWidth).toBeLessThanOrEqual(geometry.pageContentClientWidth + 1);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  expect(geometry.stack.left).toBeGreaterThanOrEqual(geometry.contentLeft - 1);
  expect(geometry.stack.right).toBeLessThanOrEqual(geometry.contentRight + 1);
  for (const child of geometry.directChildren) {
    expect(child.left).toBeGreaterThanOrEqual(geometry.contentLeft - 1);
    expect(child.right).toBeLessThanOrEqual(geometry.contentRight + 1);
  }

  if (geometry.isScrollable) {
    expect(geometry.paddingTop).toBeGreaterThan(0);
    expect(geometry.firstContentTopGap).not.toBeNull();
    expect(geometry.firstContentTopGap ?? 0).toBeGreaterThanOrEqual(geometry.paddingTop - 1);
    expect(geometry.firstContentTopGap ?? 0).toBeLessThanOrEqual(geometry.paddingTop + 2);
  }

  if (geometry.mobile) {
    expect(geometry.mobileSheet).not.toBeNull();
    expect(geometry.pageSlot.left).toBeCloseTo(
      (geometry.mobileSheet?.left ?? 0) + geometry.mobileSheetBorderLeft,
      0,
    );
    expect(geometry.pageSlot.right).toBeCloseTo(
      (geometry.mobileSheet?.right ?? 0) - geometry.mobileSheetBorderRight,
      0,
    );
  } else {
    expect(geometry.pageSlot.left).toBeGreaterThan(geometry.primaryCard.left);
    expect(geometry.pageSlot.right).toBeCloseTo(geometry.primaryCard.right - 1, 0);
  }
}

test.describe('player page safe geometry', () => {
  test('desktop and mobile pages stay inside their real carrier width', async ({ page }) => {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await openPreview(page);

      for (const target of playerPages) {
        await selectPlayerPage(page, target);
        await expect(page.locator('.page-content--player')).toBeVisible();
        expectSafePageGeometry(await readPageGeometry(page));
      }
    }
  });

  test('edge breakpoints keep the buildings page fully visible', async ({ page }) => {
    const buildings = playerPages.find((target) => target.tab === 'buildings');
    if (!buildings) throw new Error('buildings page fixture is missing');

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 720, height: 900 },
      { width: 721, height: 900 },
      { width: 960, height: 900 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await openPreview(page);
      await selectPlayerPage(page, buildings);
      await expect(page.locator('.global-operation-metrics')).toBeVisible();

      const geometry = await readPageGeometry(page);
      expectSafePageGeometry(geometry);

      const metrics = await page.evaluate(() => {
        const grid = document.querySelector<HTMLElement>('.global-operation-metrics');
        const cards = grid
          ? Array.from(grid.querySelectorAll<HTMLElement>(':scope > .ui-metric-card'))
          : [];
        if (!grid || cards.length !== 4) throw new Error('buildings metrics fixture is incomplete');
        const gridBox = grid.getBoundingClientRect();
        const boxes = cards.map((card) => card.getBoundingClientRect());
        return {
          grid: { left: gridBox.left, right: gridBox.right, width: gridBox.width },
          cards: boxes.map((box) => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom })),
        };
      });

      expect(metrics.grid.left).toBeGreaterThanOrEqual(geometry.contentLeft - 1);
      expect(metrics.grid.right).toBeLessThanOrEqual(geometry.contentRight + 1);
      for (const card of metrics.cards) {
        expect(card.left).toBeGreaterThanOrEqual(metrics.grid.left - 1);
        expect(card.right).toBeLessThanOrEqual(metrics.grid.right + 1);
      }

      if (viewport.width <= 720) {
        expect(metrics.cards[0].top).toBeCloseTo(metrics.cards[1].top, 0);
        expect(metrics.cards[2].top).toBeGreaterThan(metrics.cards[0].bottom);
        expect(metrics.cards[2].top).toBeCloseTo(metrics.cards[3].top, 0);
      }
    }
  });
});
