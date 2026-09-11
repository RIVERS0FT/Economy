import { expect, test, type Page } from '@playwright/test';

async function command(page: Page, key: string, value?: boolean) {
  await page.evaluate(({ key, value }) => { (window as any).investmentHarness[key](value); }, { key, value });
}
async function openTrade(page: Page) {
  await page.goto('investment-runtime-test.html');
  await page.getByRole('tab', { name: '商品', exact: true }).click();
  await page.getByRole('button', { name: /^小麦，指数价/ }).click();
}

test('investment trade is a quantity-only full-funded detail; one pending command spans tabs', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await openTrade(page);
  await expect(page.getByRole('heading', { name: '投资', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '返回商品列表' })).toBeVisible();
  await expect(page.locator('.investment-trade-panel')).toContainText('2026/09/14 00:00（北京时间）');
  await page.getByLabel('交易数量').fill('5');
  await page.getByRole('button', { name: '确认买入' }).click();
  await expect(page.getByRole('button', { name: '交易确认中…' })).toBeDisabled();
  await page.getByRole('tab', { name: '持仓', exact: true }).click();
  await expect(page.getByRole('button', { name: '卖出小麦' })).toBeDisabled();
  const records = JSON.parse(await page.locator('body').getAttribute('data-requests') ?? '[]');
  expect(records).toEqual([{ productId: 'wheat', contractId: 'wheat:current', priceDateKey: '2026-09-11', side: 'buy', quantity: 5 }]);
  await command(page, 'finish', true);
  await expect(page.getByRole('button', { name: '卖出小麦' })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('investment holdings allow partial close and display the net return without physical inventory', async ({ page }) => {
  await page.goto('investment-runtime-test.html');
  await page.getByRole('tab', { name: '持仓', exact: true }).click();
  await page.getByRole('button', { name: '卖出小麦' }).click();
  await page.getByLabel('交易数量').fill('3');
  await expect(page.locator('.investment-trade-panel')).toContainText('29.70');
  await page.getByRole('button', { name: '确认卖出' }).click();
  expect(JSON.parse(await page.locator('body').getAttribute('data-requests') ?? '[]')[0]).toMatchObject({ side: 'sell', quantity: 3 });
  await command(page, 'finish', false);
  await expect(page.getByLabel('交易数量')).toHaveValue('3');
  await expect(page.locator('body')).toHaveAttribute('data-notices', /测试交易拒绝/);
});

test('investment page restores its tab and retains banking; mobile trade has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTrade(page);
  const panel = page.locator('.investment-trade-panel');
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.getByRole('tab', { name: '资金', exact: true }).click();
  await expect(page.getByRole('heading', { name: '资金管理', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '银行贷款', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: '资金', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '资金', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: '商品', exact: true })).toBeFocused();
});

test('stale or unavailable quotes block a trade rather than silently changing dates', async ({ page }) => {
  await openTrade(page); await page.getByLabel('交易数量').fill('5');
  await command(page, 'expire');
  await expect(page.getByRole('button', { name: '确认买入' })).toBeDisabled();
  await command(page, 'missing');
  await expect(page.getByRole('button', { name: '确认买入' })).toBeDisabled();
  await expect(page.locator('body')).not.toHaveAttribute('data-requests', /quantity/);
});

test('a response from a replaced user cannot notify or clear the new account form', async ({ page }) => {
  await openTrade(page); await page.getByLabel('交易数量').fill('5');
  await page.getByRole('button', { name: '确认买入' }).click();
  await command(page, 'switchUser');
  await page.getByRole('tab', { name: '商品', exact: true }).click();
  await page.getByRole('button', { name: /^小麦，指数价/ }).click();
  await page.getByLabel('交易数量').fill('7');
  await command(page, 'finish', true);
  await expect(page.getByLabel('交易数量')).toHaveValue('7');
  await expect(page.locator('body')).not.toHaveAttribute('data-notices', /测试成交确认/);
});
