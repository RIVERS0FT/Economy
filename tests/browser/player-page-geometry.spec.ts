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
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(page.getByTestId('us-mainland-map')).toHaveAttribute('data-map-ready', 'true');
}

async function readTitleGeometry(page: Page) {
  return page.evaluate(() => {
    const titleTrack = document.querySelector<HTMLElement>(
      '.page-heading--player-navigation .page-heading-title',
    );
    const heading = titleTrack?.querySelector<HTMLElement>(':scope > h1') ?? null;
    if (!titleTrack || !heading) throw new Error('player page title geometry fixture is incomplete');
    const trackBox = titleTrack.getBoundingClientRect();
    const headingStyle = getComputedStyle(heading);
    return {
      trackHeight: trackBox.height,
      fontSize: Number.parseFloat(headingStyle.fontSize) || 0,
      overflow: headingStyle.overflow,
      textOverflow: headingStyle.textOverflow,
      whiteSpace: headingStyle.whiteSpace,
    };
  });
}

function expectSharedSingleLineTitleGeometry(
  geometry: Awaited<ReturnType<typeof readTitleGeometry>>,
) {
  expect(geometry.trackHeight).toBeCloseTo(40, 0);
  expect(geometry.fontSize).toBeCloseTo(20, 0);
  expect(geometry.overflow).toBe('hidden');
  expect(geometry.textOverflow).toBe('ellipsis');
  expect(geometry.whiteSpace).toBe('nowrap');
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
    const primaryCardStyle = getComputedStyle(primaryCard);

    return {
      mobile,
      mobileSheet: mobileSheet ? rect(mobileSheet) : null,
      mobileSheetBorderLeft: mobileSheetStyle ? Number.parseFloat(mobileSheetStyle.borderLeftWidth) || 0 : 0,
      mobileSheetBorderRight: mobileSheetStyle ? Number.parseFloat(mobileSheetStyle.borderRightWidth) || 0 : 0,
      primaryCard: rect(primaryCard),
      primaryCardBorderRight: Number.parseFloat(primaryCardStyle.borderRightWidth) || 0,
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
    expect(geometry.pageSlot.right).toBeCloseTo(
      geometry.primaryCard.right - geometry.primaryCardBorderRight,
      0,
    );
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
        expectSharedSingleLineTitleGeometry(await readTitleGeometry(page));
      }
    }
  });

  test('edge breakpoints keep the buildings lists fully visible', async ({ page }) => {
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
      await expect(page.locator('.global-facility-catalog-list')).toBeVisible();
      await expect(page.locator('.global-province-list')).toHaveCount(0);

      const catalogGeometry = await readPageGeometry(page);
      expectSafePageGeometry(catalogGeometry);
      expectSharedSingleLineTitleGeometry(await readTitleGeometry(page));

      const catalog = await page.evaluate(() => {
        const facilityList = document.querySelector<HTMLElement>('.global-facility-catalog-list');
        const facilityRows = facilityList
          ? Array.from(facilityList.querySelectorAll<HTMLElement>(':scope > li > .global-facility-catalog-row'))
          : [];
        if (!facilityList || facilityRows.length < 3) {
          throw new Error('buildings catalog fixture is incomplete');
        }
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
        return {
          facilityList: rect(facilityList),
          facilityRows: facilityRows.map(rect),
        };
      });

      expect(catalog.facilityList.left).toBeGreaterThanOrEqual(catalogGeometry.contentLeft - 1);
      expect(catalog.facilityList.right).toBeLessThanOrEqual(catalogGeometry.contentRight + 1);
      for (const row of catalog.facilityRows) {
        expect(row.left).toBeGreaterThanOrEqual(catalog.facilityList.left - 1);
        expect(row.right).toBeLessThanOrEqual(catalog.facilityList.right + 1);
        expect(row.height).toBeGreaterThanOrEqual(66);
        expect(row.height).toBeLessThanOrEqual(80);
      }
      for (let index = 1; index < catalog.facilityRows.length; index += 1) {
        expect(catalog.facilityRows[index].top).toBeGreaterThanOrEqual(catalog.facilityRows[index - 1].bottom - 1);
      }

      const facilityRows = page.locator('.global-facility-catalog-row');
      await facilityRows.locator('.global-facility-catalog-row__open').first().evaluate((button: HTMLButtonElement) => button.click());
      await expect(page.locator('.global-facility-region-list')).toBeVisible();

      const regionGeometry = await readPageGeometry(page);
      expectSafePageGeometry(regionGeometry);
      expectSharedSingleLineTitleGeometry(await readTitleGeometry(page));

      const regions = await page.evaluate(() => {
        const regionList = document.querySelector<HTMLElement>('.global-facility-region-list');
        const regionRows = regionList
          ? Array.from(regionList.querySelectorAll<HTMLElement>(':scope > li > .global-facility-region-row'))
          : [];
        if (!regionList || regionRows.length < 1) {
          throw new Error('buildings region list fixture is incomplete');
        }
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
        return {
          regionList: rect(regionList),
          regionRows: regionRows.map(rect),
        };
      });

      expect(regions.regionList.left).toBeGreaterThanOrEqual(regionGeometry.contentLeft - 1);
      expect(regions.regionList.right).toBeLessThanOrEqual(regionGeometry.contentRight + 1);
      for (const row of regions.regionRows) {
        expect(row.left).toBeGreaterThanOrEqual(regions.regionList.left - 1);
        expect(row.right).toBeLessThanOrEqual(regions.regionList.right + 1);
        expect(row.height).toBeLessThanOrEqual(58);
      }
    }
  });
});
