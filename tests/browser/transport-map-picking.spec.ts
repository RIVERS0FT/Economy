import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1600, height: 900 } });

function provinceRegion(page: import('@playwright/test').Page, provinceName: string) {
  return page.locator(`.province-map-region[data-province-name="${provinceName}"]`);
}

test('transport route editor picks ordered stops directly on the strategic map and supports loops', async ({ page }) => {
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^运输/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '运输' })).toBeVisible();

  await page.locator('.transport-page-footer').getByRole('button', { name: '增加路线', exact: true }).click();
  const map = page.getByTestId('us-mainland-map');
  const pickingBar = page.locator('.transport-map-picking-bar');
  await expect(map).toHaveAttribute('data-route-picking', 'true');
  await expect(pickingBar).toBeVisible();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '0');
  await expect(page.locator('.transport-route-draft-panel')).toHaveCount(0);
  await expect(page.locator('.province-map-region[data-route-pickable="true"]')).not.toHaveCount(0);

  await provinceRegion(page, '加利福尼亚').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '1');
  await provinceRegion(page, '得克萨斯').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '2');
  await provinceRegion(page, '俄克拉何马').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '3');

  const draftRoute = page.locator('.province-map-route[data-route-kind="draft"]');
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '3');
  expect(await draftRoute.getAttribute('data-route-closed')).toBeNull();
  await expect(draftRoute.locator('.province-map-route-stop')).toHaveCount(3);

  await provinceRegion(page, '加利福尼亚').click();
  expect(await draftRoute.getAttribute('data-route-closed')).toBeNull();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '4');

  await provinceRegion(page, '得克萨斯').click();
  await expect(pickingBar).toHaveAttribute('data-picking-stop-count', '4');
  await expect(page.getByText('该州已在线路中')).toBeVisible();

  await pickingBar.getByRole('button', { name: '完成选择', exact: true }).click();
  await expect(map).toHaveAttribute('data-route-picking', 'false');
  await expect(pickingBar).toHaveCount(0);

  // The account-free preview rejects all writes, so the failed direct-create
  // attempt preserves the draft in the transport page for a retry instead of
  // pretending a server route was created.
  const pendingDraft = page.locator('.transport-route-draft-panel');
  await expect(pendingDraft).toBeVisible();
  await expect(pendingDraft.locator('.transport-route-path-stop')).toHaveCount(4);
  await expect(pendingDraft.getByText('环线', { exact: true })).toBeVisible();
  await expect(draftRoute).toHaveAttribute('data-route-stop-count', '4');
  expect(await draftRoute.getAttribute('data-route-closed')).toBeNull();

  await pendingDraft.getByRole('button', { name: '取消', exact: true }).click();
  await expect(pendingDraft).toHaveCount(0);
  await expect(page.locator('.province-map-route[data-route-kind="draft"]')).toHaveCount(0);
});
