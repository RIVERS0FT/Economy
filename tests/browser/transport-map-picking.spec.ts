import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 900 } });

function provinceRegion(page: import('@playwright/test').Page, provinceName: string) {
  return page.locator(`.province-map-region[data-province-name="${provinceName}"]`);
}

test('transport route editor picks ordered stops on the strategic map and supports loops', async ({ page }) => {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '运输' })).toBeVisible();

  await page.locator('.transport-page-actions').getByRole('button', { name: '增加路线', exact: true }).click();
  await expect(page.locator('.transport-route-editor')).toBeVisible();
  await expect(page.locator('.transport-route-stop-chip')).toHaveCount(2);

  await page.getByRole('button', { name: '在地图上选择', exact: true }).click();
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-route-picking', 'true');
  await expect(page.locator('.province-map-region[data-route-pickable="true"]')).not.toHaveCount(0);
  const pickingBar = page.locator('.transport-map-picking-bar');
  await expect(pickingBar).toBeVisible();

  await pickingBar.getByRole('button', { name: '重置站点', exact: true }).click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '0');

  await provinceRegion(page, '加利福尼亚州').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '1');
  await provinceRegion(page, '得克萨斯州').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '2');
  await provinceRegion(page, '俄克拉何马州').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '3');

  const draftRoute = page.locator('.province-map-route[data-route-kind="draft"]');
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '3');
  await expect(draftRoute).toHaveAttribute('data-route-closed', 'false');
  await expect(draftRoute.locator('.province-map-route-stop')).toHaveCount(3);

  await provinceRegion(page, '加利福尼亚州').click();
  await expect(draftRoute).toHaveAttribute('data-route-closed', 'true');
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');

  await provinceRegion(page, '得克萨斯州').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');
  await expect(page.getByText('该州已在线路中')).toBeVisible();

  await pickingBar.getByRole('button', { name: '完成选择', exact: true }).click();
  await expect(map).toHaveAttribute('data-route-picking', 'false');
  await expect(pickingBar).toHaveCount(0);
  await expect(page.locator('.transport-route-stop-chip')).toHaveCount(4);
  await expect(page.locator('.transport-route-stop-chip[data-stop-role="end"]')).toHaveText(/环/);
  await expect(page.getByRole('combobox', { name: '行程' })).toBeDisabled();
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '4');

  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.locator('.transport-route-editor')).toHaveCount(0);
  await expect(page.locator('.province-map-route[data-route-kind="draft"]')).toHaveCount(0);
});
