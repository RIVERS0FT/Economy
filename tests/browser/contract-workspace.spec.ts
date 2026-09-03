import { expect, test } from '@playwright/test';

test('contract core workspace switches between workbench market active and history views', async ({ page }) => {
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

  await expect(page.getByRole('tab', { name: /工作台/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: '合同工作台' })).toBeVisible();
  await expect(page.getByRole('tabpanel', { name: '合同市场' })).toHaveCount(0);
  await expect(page.getByRole('tabpanel', { name: '我的合同' })).toHaveCount(0);
  await expect(page.locator('.contract-master-list-item')).toHaveCount(1);
  await expect(page.locator('.contract-master-detail-panel .contract-card')).toHaveCount(1);

  await page.getByRole('tab', { name: /合同市场/ }).click();
  const market = page.getByRole('tabpanel', { name: '合同市场' });
  await expect(market).toBeVisible();
  await expect(market.getByText('每日额度', { exact: true })).toBeVisible();
  await expect(market.locator('.contract-master-detail-panel .contract-card')).toHaveCount(1);

  await page.getByRole('tab', { name: /我的合同/ }).click();
  const personal = page.getByRole('tabpanel', { name: '我的合同' });
  await expect(personal).toBeVisible();
  await expect(personal.locator('.contract-master-list-item')).toHaveCount(2);
  await expect(personal.locator('.contract-master-detail-panel .contract-card')).toHaveCount(1);

  await page.getByRole('tab', { name: '历史', exact: true }).click();
  await expect(page.getByRole('tab', { name: '历史', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: '历史合同' })).toBeVisible();
  await expect(page.locator('.contract-history-panel')).toBeVisible();
});
