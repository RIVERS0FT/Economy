import { expect, test } from '@playwright/test';

test('investment page trades only explicit amounts, remembers tabs and reuses bank funding', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('bank-runtime-test.html?investment=1');
  await expect(page.getByRole('heading', { name: '投资', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: '商品', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByLabel('买入数量', { exact: true }).fill('100');
  await page.getByRole('button', { name: '确认买入', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-investment-calls', /"quantity":100/);
  await page.getByRole('tab', { name: '持仓', exact: true }).click();
  await expect(page.getByRole('heading', { name: '商品持仓', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '卖出', exact: true }).click();
  await expect(page.getByLabel('卖出数量', { exact: true })).toBeVisible();
  await page.getByLabel('卖出数量', { exact: true }).fill('40');
  await page.getByRole('button', { name: '确认卖出', exact: true }).click();
  await expect.poll(async () => {
    const calls = JSON.parse(await page.locator('body').getAttribute('data-investment-calls') || '[]');
    return calls.at(-1);
  }).toMatchObject({ quantity: 40, side: 'sell' });
  await page.getByRole('tab', { name: '资金', exact: true }).click();
  await expect(page.getByRole('heading', { name: '资金管理', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '银行贷款', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('tab', { name: '资金', exact: true })).toHaveAttribute('aria-selected', 'true');
  expect(errors).toEqual([]);
});

test('uncertain transaction keeps its original fields and cannot change direction before confirmation', async ({ page }) => {
  await page.goto('bank-runtime-test.html?investment=1&unknown=1');
  await page.getByLabel('买入数量', { exact: true }).fill('12');
  await page.getByRole('button', { name: '确认买入', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认原交易', exact: true })).toBeVisible();
  await expect(page.getByLabel('买入数量', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '卖出', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '确认原交易', exact: true }).click();
  const calls = JSON.parse(await page.locator('body').getAttribute('data-investment-calls') || '[]');
  expect(calls).toHaveLength(2); expect(calls[0]).toEqual(calls[1]);
  await expect(page.getByLabel('买入数量', { exact: true })).toBeEnabled();
});

for (const width of [320, 390, 1440]) {
  test(`investment tabs and body remain accessible without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('bank-runtime-test.html?investment=1');
    await page.getByRole('tab', { name: '商品', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: '持仓', exact: true })).toBeFocused();
    await expect(page.getByRole('tab', { name: '持仓', exact: true })).toHaveAttribute('aria-selected', 'true');
    const geometry = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: innerWidth }));
    expect(geometry.scroll).toBeLessThanOrEqual(geometry.width);
  });
}
