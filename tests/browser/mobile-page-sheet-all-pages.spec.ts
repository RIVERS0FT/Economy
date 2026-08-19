import { expect, test } from '@playwright/test';

const mobileBusinessPages = [
  { tab: 'home', label: '概览' },
  { tab: 'market', label: '市场' },
  { tab: 'buildings', label: '建筑' },
  { tab: 'research', label: '研发' },
  { tab: 'auction', label: '拍卖' },
  { tab: 'contracts', label: '合同' },
  { tab: 'bank', label: '银行' },
  { tab: 'leaderboard', label: '排行' },
  { tab: 'gem-shop', label: '商店' },
  { tab: 'settings', label: '设置' },
] as const;

test('all mobile business pages reuse one first-level workspace sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=activity');

  const navigation = page.locator('.mobile-bottom-navigation');
  const status = page.locator('.asset-bar');
  const sheet = page.locator('.mobile-workspace-page-sheet');
  const map = page.getByTestId('us-mainland-map');

  await expect(navigation).toBeVisible();
  await expect(status).toBeVisible();
  await expect(sheet).toBeVisible();
  await expect(map).toBeVisible();
  await sheet.evaluate((element) => {
    element.dataset.pageSheetInstanceProbe = 'stable';
  });

  for (const { tab, label } of mobileBusinessPages) {
    await navigation.getByRole('button', { name: new RegExp(`^${label}`) }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-page-key', tab);
    await expect(sheet).toHaveAttribute('data-page-sheet-instance-probe', 'stable');
    await expect(status).toBeVisible();
    await expect(navigation).toBeVisible();
  }

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);
  await expect(map).toBeVisible();
  await expect(status).toBeVisible();
  await expect(navigation).toBeVisible();
});
