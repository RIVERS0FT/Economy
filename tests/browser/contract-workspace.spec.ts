import { expect, test } from '@playwright/test';

test('contract market stays visible while personal contracts switch views', async ({ page }) => {
  await page.route('**/economy-api/game/contracts/history**', async (route) => {
    await route.fulfill({ json: { history: { items: [], nextCursor: null } } });
  });
  await page.route('**/api/game/contracts/performance**', async (route) => {
    await route.fulfill({ json: { performance: { totalEnded: 0, completed: 0, abnormalEnded: 0, defaulted: 0, completionRateBps: 0, compensationPaid: 0, compensationReceived: 0, recent: [] } } });
  });
  await page.route('**/api/game/community-link**', async (route) => {
    await route.fulfill({ json: { communityLink: null } });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=contracts');

  const market = page.getByRole('region', { name: '合同广场' });
  const personal = page.getByRole('region', { name: '我的合同' });
  await expect(market).toBeVisible();
  await expect(personal).toBeVisible();
  await expect(market.getByText('每日额度', { exact: true })).toBeVisible();

  const activeCards = personal.locator('.contract-active-grid .contract-card');
  await expect(activeCards).toHaveCount(2);
  await expect(activeCards.nth(0)).toHaveClass(/contract-card--attention/);
  await expect(activeCards.nth(1)).toHaveClass(/contract-card--normal/);

  await page.getByRole('tab', { name: '历史合同', exact: true }).click();
  await expect(page.getByRole('tab', { name: '历史合同', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(market.getByText('每日额度', { exact: true })).toBeVisible();
  await expect(page.locator('.contract-history-panel')).toBeVisible();
});
