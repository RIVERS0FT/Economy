import { expect, test, type Locator } from '@playwright/test';

type BadgeGeometry = {
  position: string;
  button: { left: number; top: number; right: number; bottom: number };
  badge: { left: number; top: number; right: number; bottom: number; width: number; height: number };
  sidebar: { left: number; top: number; right: number; bottom: number };
};

async function readBadgeGeometry(button: Locator): Promise<BadgeGeometry> {
  return button.evaluate((element) => {
    const badge = element.querySelector<HTMLElement>('.sidebar-nav-count');
    const sidebar = element.closest<HTMLElement>('.desktop-sidebar');
    if (!badge || !sidebar) throw new Error('sidebar market badge fixture is incomplete');
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

test('market order badge stays inside expanded, collapsed and compact sidebar buttons', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');

  const marketButton = page.locator('.desktop-sidebar .sidebar-nav-button', {
    has: page.locator('.sidebar-nav-count'),
  });
  await expect(marketButton).toHaveCount(1);
  await expect(marketButton).toHaveAttribute('aria-label', '市场，6 笔未完成订单');
  await expect(marketButton.locator('.sidebar-nav-count')).toHaveText('6');

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
    has: page.locator('.sidebar-nav-count'),
  });
  await expect(compactButton).toHaveCount(1);

  const compact = await readBadgeGeometry(compactButton);
  expect(compact.position).toBe('absolute');
  expectBadgeInside(compact);
  expect(compact.badge.top - compact.button.top).toBeCloseTo(2, 0);
  expect(compact.button.right - compact.badge.right).toBeCloseTo(2, 0);
});
