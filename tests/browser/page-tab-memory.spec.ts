import { expect, test, type Page } from '@playwright/test';

async function clickMapProvinceLabel(page: Page, provinceName: string) {
  const label = page.locator('.province-map-label').filter({ hasText: new RegExp(`^${provinceName}$`) });
  await expect(label).toBeVisible();
  const point = await label.evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.ownerSVGElement?.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
  });
  await page.mouse.click(point.x, point.y);
}

test('page-level tabs restore the last valid selection across navigation and reload', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');

  await sidebar.getByRole('button', { name: /^合同/ }).click();
  const contractTabs = page.getByRole('tablist', { name: '合同工作区' });
  await contractTabs.getByRole('tab', { name: /合同市场/ }).click();
  await expect(contractTabs.getByRole('tab', { name: /合同市场/ })).toHaveAttribute('aria-selected', 'true');
  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await sidebar.getByRole('button', { name: /^合同/ }).click();
  await expect(page.getByRole('tablist', { name: '合同工作区' }).getByRole('tab', { name: /合同市场/ })).toHaveAttribute('aria-selected', 'true');

  await sidebar.getByRole('button', { name: /^排行/ }).click();
  const leaderboardSwitch = page.getByRole('group', { name: '选择排行榜' });
  await leaderboardSwitch.getByRole('button', { name: '交易榜' }).click();
  await expect(leaderboardSwitch.getByRole('button', { name: '交易榜' })).toHaveAttribute('aria-pressed', 'true');
  await sidebar.getByRole('button', { name: /^银行/ }).click();
  await sidebar.getByRole('button', { name: /^排行/ }).click();
  await expect(page.getByRole('group', { name: '选择排行榜' }).getByRole('button', { name: '交易榜' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await clickMapProvinceLabel(page, '得克萨斯');
  const texasTabs = page.getByRole('tablist', { name: '得克萨斯页面分区' });
  await texasTabs.getByRole('tab', { name: '工业', exact: true }).click();
  await expect(texasTabs.getByRole('tab', { name: '工业', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await clickMapProvinceLabel(page, '加利福尼亚');
  await expect(page.getByRole('tablist', { name: '加利福尼亚页面分区' }).getByRole('tab', { name: '工业', exact: true })).toHaveAttribute('aria-selected', 'true');

  await page.reload();
  await sidebar.getByRole('button', { name: /^合同/ }).click();
  await expect(page.getByRole('tablist', { name: '合同工作区' }).getByRole('tab', { name: /合同市场/ })).toHaveAttribute('aria-selected', 'true');
  await sidebar.getByRole('button', { name: /^排行/ }).click();
  await expect(page.getByRole('group', { name: '选择排行榜' }).getByRole('button', { name: '交易榜' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await clickMapProvinceLabel(page, '得克萨斯');
  await expect(page.getByRole('tablist', { name: '得克萨斯页面分区' }).getByRole('tab', { name: '工业', exact: true })).toHaveAttribute('aria-selected', 'true');
});