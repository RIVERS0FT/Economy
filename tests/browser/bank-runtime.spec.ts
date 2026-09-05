import { expect, test, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

test('bank page exposes capital management, weekly planning, and transparent credit utilization', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('bank-runtime-test.html');

  await expect(page.getByRole('heading', { name: '银行', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资产总览', exact: true })).toBeVisible();
  await expect(page.getByText('当前净资产', { exact: true })).toHaveCount(1);
  await expect(page.getByText('贷款负债', { exact: true })).toHaveCount(1);
  await expect(page.getByText('冻结资产', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('table', { name: '资产构成明细' })).toBeVisible();

  await expect(page.getByRole('heading', { name: '资金管理', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '本周资金计划', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '存入', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '25%', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '50%', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '最大', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '取出', exact: true }).click();
  await expect(page.getByLabel('取出金额')).toBeVisible();
  await expect(page.getByText('固定日利率', { exact: true })).toBeVisible();
  await expect(page.getByText('预计周扣除', { exact: true })).toBeVisible();
  await expect(page.getByText(/成功经济操作会激活本周/)).toBeVisible();

  await expect(page.getByRole('heading', { name: '工厂冻结融资', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: '可冻结工厂' })).toBeVisible();
  await expect(page.getByText('冻结资产审慎估值', { exact: true })).toBeVisible();
  await page.getByLabel('农场冻结数量').fill('2');
  await expect(page.getByText('最高可贷额度', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '申请贷款' })).toBeDisabled();
  await page.getByLabel('申请金额').fill('50');
  await expect(page.getByRole('progressbar', { name: '授信利用率' })).toHaveAttribute('aria-valuenow', '83.34');
  await expect(page.getByText('剩余授信', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '申请贷款' })).toBeEnabled();
  expect(await page.locator('.page-content').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('bank page stacks safely on mobile without a collateral horizontal table', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('bank-runtime-test.html');

  const overviewColumns = await page.locator('.asset-overview-body').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(overviewColumns).toBe(1);
  const compositionColumns = await page.locator('.asset-composition-row').first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(compositionColumns).toBe(2);
  const cashWorkspaceColumns = await page.locator('.bank-cash-workspace').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(cashWorkspaceColumns).toBe(1);
  const financingWorkspaceColumns = await page.locator('.bank-financing-workspace').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(financingWorkspaceColumns).toBe(1);

  await expect(page.getByRole('button', { name: '最大', exact: true })).toBeVisible();
  await expect(page.getByLabel('农场冻结数量')).toBeVisible();
  expect(await page.locator('.bank-collateral-list').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.locator('.page-content').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});
