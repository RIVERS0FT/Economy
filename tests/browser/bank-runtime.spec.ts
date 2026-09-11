import { expect, test, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

test('bank page exposes asset credit amount, term and utilization without collateral selection', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('bank-runtime-test.html');

  await expect(page.getByRole('heading', { name: '投资', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资产总览', exact: true })).toBeVisible();
  await expect(page.getByText('当前净资产', { exact: true })).toHaveCount(1);
  await expect(page.getByText('贷款负债', { exact: true })).toHaveCount(1);
  await expect(page.getByText('冻结资产', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('table', { name: '资产构成明细' })).toBeVisible();

  await expect(page.getByRole('heading', { name: '资金管理', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '本周资金计划', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '存入', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '取出', exact: true }).click();
  await expect(page.getByLabel('取出金额')).toBeVisible();
  await expect(page.getByText('固定日利率', { exact: true })).toBeVisible();
  await expect(page.getByText('预计周扣除', { exact: true })).toBeVisible();
  await expect(page.getByText(/成功经济操作会激活本周/)).toBeVisible();

  await expect(page.getByRole('heading', { name: '银行贷款', exact: true })).toBeVisible();
  await expect(page.getByText('授信资产净值', { exact: true })).toBeVisible();
  await expect(page.getByText('最高可贷额度', { exact: true })).toBeVisible();
  await expect(page.getByText(/不需要选择或冻结任何抵押物/)).toBeVisible();
  await expect(page.getByRole('table', { name: '可冻结工厂' })).toHaveCount(0);
  await expect(page.locator('.bank-collateral-list')).toHaveCount(0);

  const termGroup = page.getByRole('group', { name: '贷款周期' });
  await expect(termGroup.getByRole('button', { name: '72h · 4.00%', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await termGroup.getByRole('button', { name: '168h · 9.00%', exact: true }).click();
  await expect(termGroup.getByRole('button', { name: '168h · 9.00%', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('申请金额').fill('1000');
  await expect(page.getByRole('progressbar', { name: '授信利用率' })).toHaveAttribute('aria-valuenow', '80.26');
  await expect(page.getByText('额度使用加点', { exact: false })).toBeVisible();
  await expect(page.getByText('11.00%', { exact: true })).toBeVisible();
  await expect(page.getByText('剩余授信', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: '申请贷款' })).toBeEnabled();
  await page.getByRole('button', { name: '申请贷款' }).click();
  await expect.poll(() => page.locator('body').getAttribute('data-borrow-amount')).toBe('1000');
  await expect.poll(() => page.locator('body').getAttribute('data-borrow-term')).toBe('168');
  await expect.poll(() => page.locator('body').getAttribute('data-notice')).toBe('贷款成功');

  expect(await page.locator('.page-content').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('bank page stacks safely on mobile without collateral controls', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('bank-runtime-test.html');

  const overviewColumns = await page.locator('.asset-overview-body').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(overviewColumns).toBe(1);
  const compositionColumns = await page.locator('.asset-composition-row').first().evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(compositionColumns).toBe(2);
  const cashWorkspaceColumns = await page.locator('.bank-cash-workspace').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length);
  expect(cashWorkspaceColumns).toBe(1);

  await expect(page.getByRole('group', { name: '贷款周期' })).toBeVisible();
  await expect(page.getByLabel('申请金额')).toBeVisible();
  await expect(page.locator('.bank-collateral-list')).toHaveCount(0);
  expect(await page.locator('.bank-loan-panel').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(await page.locator('.page-content').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});
