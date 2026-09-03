import { expect, test } from '@playwright/test';

async function openCommodityDetail(page) {
  await page.goto('/market-runtime-test.html');
  const wheat = page.getByRole('button', { name: /查看.*详情/ }).first();
  await expect(wheat).toBeVisible();
  await wheat.click();
  await expect(page.getByText('即时交易', { exact: true })).toBeVisible();
}

test('commodity detail uses the daily server price and has no resting-order UI', async ({ page }) => {
  await openCommodityDetail(page);
  await expect(page.getByText('今日成交价')).toBeVisible();
  await expect(page.getByText('下次调价')).toBeVisible();
  await expect(page.getByLabel('调整交易数量')).toBeVisible();
  await expect(page.getByRole('button', { name: /立即买入/ })).toBeVisible();
  await expect(page.locator('#market-order-price')).toHaveCount(0);
  await expect(page.getByText('实时五档')).toHaveCount(0);
  await expect(page.getByText('已有订单')).toHaveCount(0);
  await expect(page.getByText('撤单', { exact: true })).toHaveCount(0);
});

test('commodity quantity shortcuts remain available for immediate trading', async ({ page }) => {
  await openCommodityDetail(page);
  await expect(page.getByRole('button', { name: '25%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '50%' })).toBeVisible();
  await expect(page.getByRole('button', { name: '最大' })).toBeVisible();
  const quantity = page.locator('#market-trade-quantity');
  await expect(quantity).toBeVisible();
  await page.getByRole('button', { name: '50%' }).click();
  await expect(quantity).not.toHaveValue('');
});

test('recent local trades remain separate from retired resting orders', async ({ page }) => {
  await openCommodityDetail(page);
  await expect(page.getByText(/最近成交/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '清除全部本地成交' })).toBeVisible();
});
