import { expect, test } from '@playwright/test';

const pages = [
  { navigation: /^概览/, heading: /本地预览玩家/ },
  { navigation: /^地图/, heading: '美国本土地图' },
  { navigation: /^市场/, heading: '加利福尼亚州本地市场' },
  { navigation: /^生产/, heading: '加利福尼亚州生产' },
  { navigation: /^研发/, heading: '研发' },
  { navigation: /^拍卖/, heading: '拍卖' },
  { navigation: /^合同/, heading: '合同' },
  { navigation: /^银行/, heading: '银行' },
  { navigation: /^排行/, heading: '排行榜' },
  { navigation: /^商店/, heading: '商店' },
  { navigation: /^设置/, heading: '设置' },
] as const;

test('account-free mode redirects into the complete game shell without API traffic', async ({ page }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/economy-api')) apiRequests.push(request.url());
  });

  await page.goto('all-pages-preview.html');

  await expect(page).toHaveURL(/\/economy\/\?preview=game$/);
  await expect(page.locator('html')).toHaveAttribute('data-local-game-preview', 'true');
  await expect(page.locator('.game-shell')).toBeVisible();
  await expect(page.locator('.desktop-sidebar .sidebar-nav-button')).toHaveCount(11);
  await expect(page.getByRole('heading', { level: 1, name: pages[0].heading })).toBeVisible();
  expect(apiRequests).toEqual([]);
});

test('account-free game shell navigates all eleven formal player pages', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  for (const target of pages) {
    const navigation = sidebar.getByRole('button', { name: target.navigation });
    await navigation.click();
    await expect(navigation).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1, name: target.heading })).toBeVisible();
  }

  await sidebar.getByRole('button', { name: /^地图/ }).click();
  await page.getByRole('combobox', { name: '州级地区' }).click();
  await page.getByRole('option', { name: '得克萨斯州' }).click();
  await expect(page.locator('.strategic-province-inspector')).toContainText('得克萨斯州');
});

test('leaderboard and local-only service summaries are populated in the full shell', async ({ page }) => {
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  await sidebar.getByRole('button', { name: /^排行/ }).click();
  await expect(page.locator('.leaderboard-board-card')).toHaveCount(4);
  await expect(page.locator('.leaderboard-board-card').getByText('本地预览玩家', { exact: true }).first()).toBeVisible();

  await sidebar.getByRole('button', { name: /^商店/ }).click();
  await expect(page.getByText('1 宝石 = 1,280 货币', { exact: true })).toBeVisible();
  await expect(page.getByLabel('永久邀请码')).toHaveValue('LOCAL2026');
});
