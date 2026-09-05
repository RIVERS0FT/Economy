import { expect, test } from '@playwright/test';

for (const width of [320, 390, 960]) {
  test(`source-backed commodity freezes support hover and in-place expansion at ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    const writes: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (request.method() === 'POST') writes.push(request.url()); });
    await page.setViewportSize({ width, height: 844 });
    await page.goto('market-runtime-test.html?scenario=freeze-details');
    const trigger = page.getByRole('button', { name: '查看冻结库存 320 的来源明细' });
    await expect(trigger).toBeVisible();
    await trigger.hover();
    const preview = page.getByRole('tooltip').filter({ hasText: '冻结明细' });
    await expect(preview).toBeVisible();
    for (const text of ['生产冻结', '经营冻结', '合同冻结', '拍卖冻结', '磨坊', '120', '饲料厂', '80', 'supply-123', '70']) {
      await expect(preview).toContainText(text);
    }
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const detail = page.getByRole('region', { name: '冻结明细' });
    await expect(detail).toBeVisible();
    await expect(preview).toHaveCount(0);
    await expect(detail).not.toContainText('保障目标');
    await expect(detail).not.toContainText('缺口');
    await page.evaluate(() => window.__updateFreezeFixture?.());
    await expect(detail).toContainText('325');
    await expect(detail).toContainText('125');
    await expect(page.getByRole('button', { name: '查看冻结库存 325 的来源明细' })).toHaveAttribute('aria-expanded', 'true');
    const bounds = await detail.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width + 1);
    await expect(detail).toContainText('冻结商品只供对应业务使用');
    await page.screenshot({ path: `test-results/commodity-freezes-${width}.png`, fullPage: false });
    await page.getByRole('button', { name: '查看冻结库存 325 的来源明细' }).focus();
    await page.keyboard.press('Escape');
    await expect(detail).toHaveCount(0);
    expect(errors).toEqual([]); expect(writes).toEqual([]);
  });
}

test('unknown or zero frozen state never invents a source or renders a shortage target', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=freeze-unknown');
  await page.getByRole('button', { name: '查看冻结库存 320 的来源明细' }).click();
  const detail = page.getByRole('region', { name: '冻结明细' });
  await expect(detail).toContainText('冻结来源明细暂不可用');
  await expect(detail).not.toContainText('生产冻结');
  await page.goto('market-runtime-test.html');
  await page.getByRole('button', { name: '查看冻结库存 0 的来源明细' }).click();
  await expect(page.getByRole('region', { name: '冻结明细' })).toContainText('暂无冻结');
});
