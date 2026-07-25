import { expect, test, type Locator, type Page } from '@playwright/test';

type BadgeGeometry = {
  position: string;
  button: { left: number; top: number; right: number; bottom: number };
  badge: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  sidebar: { left: number; top: number; right: number; bottom: number };
};

async function readBadgeGeometry(button: Locator): Promise<BadgeGeometry> {
  return button.evaluate((element) => {
    const badge = element.querySelector<HTMLElement>('.navigation-badge');
    const sidebar = element.closest<HTMLElement>('.desktop-sidebar');
    if (!badge || !sidebar) throw new Error('navigation badge fixture is incomplete');
    const rect = (target: Element) => {
      const box = target.getBoundingClientRect();
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    };
    const badgeRect = badge.getBoundingClientRect();
    return {
      position: getComputedStyle(badge).position,
      button: rect(element),
      badge: {
        ...rect(badge),
        width: badgeRect.width,
        height: badgeRect.height,
      },
      sidebar: rect(sidebar),
    };
  });
}

function expectBadgeInside(geometry: BadgeGeometry) {
  expect(geometry.badge.width).toBeGreaterThan(0);
  expect(geometry.badge.height).toBeGreaterThan(0);
  expect(geometry.badge.left).toBeGreaterThanOrEqual(geometry.button.left - 1);
  expect(geometry.badge.top).toBeGreaterThanOrEqual(geometry.button.top - 1);
  expect(geometry.badge.right).toBeLessThanOrEqual(geometry.button.right + 1);
  expect(geometry.badge.bottom).toBeLessThanOrEqual(geometry.button.bottom + 1);
  expect(geometry.badge.left).toBeGreaterThanOrEqual(geometry.sidebar.left - 1);
  expect(geometry.badge.right).toBeLessThanOrEqual(geometry.sidebar.right + 1);
}

function navigationButton(page: Page, label: string) {
  return page.locator('.desktop-sidebar .sidebar-nav-button', { has: page.locator('strong', { hasText: label }) });
}

test('market order badge stays inside expanded, collapsed and compact sidebar buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');

  const marketButton = page.locator('.desktop-sidebar .sidebar-nav-button', {
    has: page.locator('.navigation-badge'),
  });
  await expect(marketButton).toHaveCount(1);
  await expect(marketButton).toHaveAttribute('aria-label', '市场，6 笔未完成订单');
  await expect(marketButton.locator('.navigation-badge')).toHaveText('6');

  const expanded = await readBadgeGeometry(marketButton);
  expect(expanded.position).toBe('static');
  expectBadgeInside(expanded);
  expect(expanded.button.right - expanded.badge.right).toBeLessThanOrEqual(12);

  await page.getByRole('button', { name: '折叠侧栏' }).click();
  await expect(page.locator('.desktop-sidebar')).toHaveAttribute('data-collapsed', 'true');
  await page.waitForTimeout(240);

  const collapsed = await readBadgeGeometry(marketButton);
  expect(collapsed.position).toBe('absolute');
  expectBadgeInside(collapsed);
  expect(collapsed.badge.top - collapsed.button.top).toBeCloseTo(2, 0);
  expect(collapsed.button.right - collapsed.badge.right).toBeCloseTo(2, 0);

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');
  const compactButton = page.locator('.desktop-sidebar .sidebar-nav-button', {
    has: page.locator('.navigation-badge'),
  });
  await expect(compactButton).toHaveCount(1);

  const compact = await readBadgeGeometry(compactButton);
  expect(compact.position).toBe('absolute');
  expectBadgeInside(compact);
  expect(compact.badge.top - compact.button.top).toBeCloseTo(2, 0);
  expect(compact.button.right - compact.badge.right).toBeCloseTo(2, 0);
});

test('navigation badge caps visible counts at 99+', async ({ page }) => {
  await page.goto('runtime-test.html?view=overview&scenario=badge-cap');
  const badge = page.locator('.desktop-sidebar .navigation-badge');
  await expect(badge).toHaveText('99+');
  await expect(badge.locator('..')).toHaveAttribute('aria-label', '市场，120 笔未完成订单');
});

test('auction and contract badges merge unique objects and keep persistent attention after visiting', async ({ page }) => {
  await page.goto('runtime-test.html?view=overview&scenario=badge-merged');

  const auctionButton = navigationButton(page, '拍卖');
  const contractButton = navigationButton(page, '合同');
  const leaderboardButton = navigationButton(page, '排行');

  await expect(auctionButton.locator('.navigation-badge')).toHaveText('3');
  await expect(auctionButton).toHaveAttribute(
    'aria-label',
    '拍卖，3 个需要关注的拍卖，其中 2 个新拍卖，2 个被超价',
  );
  await expect(contractButton.locator('.navigation-badge')).toHaveText('3');
  await expect(contractButton).toHaveAttribute(
    'aria-label',
    '合同，3 个需要关注的合同，其中 2 个新合同，2 个需要处理',
  );
  await expect(leaderboardButton.locator('.navigation-badge')).toHaveText('1');

  await auctionButton.click();
  await expect(auctionButton.locator('.navigation-badge')).toHaveText('2');
  await expect(auctionButton).toHaveAttribute(
    'aria-label',
    '拍卖，2 个需要关注的拍卖，其中 0 个新拍卖，2 个被超价',
  );

  await contractButton.click();
  await expect(contractButton.locator('.navigation-badge')).toHaveText('2');
  await expect(contractButton).toHaveAttribute(
    'aria-label',
    '合同，2 个需要关注的合同，其中 0 个新合同，2 个需要处理',
  );

  await leaderboardButton.click();
  await expect(leaderboardButton.locator('.navigation-badge')).toHaveCount(0);

  for (const label of ['概览', '资产', '商店', '设置']) {
    await expect(navigationButton(page, label).locator('.navigation-badge')).toHaveCount(0);
  }
});
