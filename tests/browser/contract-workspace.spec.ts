import { expect, test } from '@playwright/test';

test('contract market stays visible while personal contracts switch views', async ({ page }) => {
  await page.route('**/economy-api/game/contracts/history**', async (route) => {
    await route.fulfill({ json: { history: { items: [], nextCursor: null } } });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=contracts');

  const market = page.getByRole('region', { name: '合同广场' });
  const personal = page.getByRole('region', { name: '我的合同' });
  await expect(market).toBeVisible();
  await expect(personal).toBeVisible();
  await expect(market.getByText('采购 机械', { exact: true })).toBeVisible();

  const activeCards = personal.locator('.contract-active-grid .contract-card');
  await expect(activeCards).toHaveCount(2);
  await expect(activeCards.nth(0)).toHaveClass(/contract-card--attention/);
  await expect(activeCards.nth(1)).toHaveClass(/contract-card--normal/);

  await page.getByRole('tab', { name: '历史合同', exact: true }).click();
  await expect(page.getByRole('tab', { name: '历史合同', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(market.getByText('采购 机械', { exact: true })).toBeVisible();
  await expect(page.locator('.contract-history-panel')).toBeVisible();
});
