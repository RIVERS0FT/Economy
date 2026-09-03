import { expect, test } from '@playwright/test';

const legacyAccessSnapshotUrl = 'runtime-test.html?view=map&scenario=locked-province';

test('legacy province access fields do not restore an unlock gate', async ({ page }) => {
  await page.goto(legacyAccessSnapshotUrl);
  await expect(page.getByText('常住人口', { exact: true })).toBeVisible();
  await expect(page.getByText('Census · 2025-07-01', { exact: true })).toBeVisible();
  await expect(page.locator('.province-unlock-button')).toHaveCount(0);
  await expect(page.getByText(/未解锁/)).toHaveCount(0);
});

test('legacy access fields cannot make a regional market read-only', async ({ page }) => {
  await page.goto(legacyAccessSnapshotUrl);
  await page.getByRole('tab', { name: '市场' }).click();
  await expect(page.locator('.market-catalog-list')).toBeVisible();
  await page.getByRole('button', { name: '查看机械详情' }).click();
  await expect(page.getByText('该地区尚未解锁，市场仅供查看。', { exact: true })).toHaveCount(0);
  await expect(page.locator('.market-submit-order')).toBeVisible();
  await expect(page.getByText('实时五档 · 点击填价', { exact: true })).toHaveCount(1);
});

test('legacy access fields cannot hide regional buildings or warehouse', async ({ page }) => {
  await page.goto(legacyAccessSnapshotUrl);
  await page.getByRole('tab', { name: '建筑' }).click();
  await expect(page.getByText('建筑功能未解锁', { exact: true })).toHaveCount(0);
  await expect(page.locator('.province-unlock-button')).toHaveCount(0);
  await expect(page.getByText('建设新工厂', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: '仓库' }).click();
  await expect(page.getByText('仓库功能未解锁', { exact: true })).toHaveCount(0);
  await expect(page.locator('.province-unlock-button')).toHaveCount(0);
  await expect(page.locator('.province-warehouse-section .warehouse-content')).toBeVisible();
});
